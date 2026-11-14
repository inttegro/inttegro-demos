import os
import asyncio
from contextlib import asynccontextmanager
from html import escape
from pathlib import Path
import re
from typing import Any, AsyncIterator
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import FastAPI, Form, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from inttegro import AsyncInttegroClient

from .checkout import DemoError, create_hosted_checkout, parse_checkout_input


# INTTEGRO:FLOW [checkout-presentation] POST /checkout creates one finalized
# Order for Afterglow's hosted-page, embedded, and modal Checkout documented at
# https://studio.inttegro.com/accept-payment-with-inttegro-checkout.
# INTTEGRO:VERIFY [server-side-verification] A return to /complete is a browser
# signal, not payment evidence. Verify the order server-side and reconcile
# non-terminal states as described at https://studio.inttegro.com/webhooks.

ROOT = Path(__file__).resolve().parent
STATIC_ROOT = ROOT.parents[1] / "public" / "static"
TEMPLATE_ROOT = ROOT / "templates"
HOME_ERROR_BLOCK = re.compile(
    r'{% if error_code == "configuration_error" %}.*?{% endif %}', re.DOTALL
)
RESULT_CONDITIONAL = re.compile(
    r"{% if complete %}(.*?){% else %}(.*?){% endif %}", re.DOTALL
)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    yield
    client = getattr(app.state, "inttegro_client", None)
    if client is not None:
        await client.aclose()


app = FastAPI(title="Inttegro FastAPI demo", docs_url="/api/docs", lifespan=lifespan)


@app.middleware("http")
async def revalidate_angular_bundle(request: Request, call_next):
    """Prevent a deployment from leaving an older Checkout client in cache."""

    response = await call_next(request)
    if request.url.path == "/static/angular/main.js":
        # INTTEGRO:DECISION [versioned-client-asset] The HTML also changes the
        # bundle URL when this integration changes. Revalidation protects later
        # Railway deployments whose CDN may otherwise retain the old JavaScript
        # while the FastAPI server has already advanced to the new release.
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    return response


if STATIC_ROOT.is_dir():
    # Containers serve this directory through Starlette. Cloudflare Static
    # Assets are intentionally absent from the Worker filesystem and intercept
    # /static/* before the ASGI application runs.
    app.mount("/static", StaticFiles(directory=STATIC_ROOT), name="static")


def render_home(attempt_id: str, error_code: str, error_message: str) -> str:
    """Render the demo shell without native template-engine dependencies."""

    source = (TEMPLATE_ROOT / "home.html").read_text()
    if error_code == "configuration_error":
        error_section = (
            '<section class="setup-card has-config-error" role="status">'
            '<span class="setup-kicker">Setup required</span>'
            "<h3>Connect this copy to Inttegro</h3>"
            "<p>Add <code>INTTEGRO_API_KEY</code> as a server-side secret, set the active Product and Price IDs plus this deployment’s public URL, then redeploy. The key never belongs in browser JavaScript.</p>"
            '<div class="setup-actions"><a href="https://studio.inttegro.com/keys">Create an API key</a>'
            '<a href="https://github.com/inttegro/inttegro-demos/blob/fastapi-v1.8.3/fastapi/README.md#deploy-your-own">Deployment guide</a></div>'
            "</section>"
        )
    elif error_code:
        error_section = (
            '<p class="inline-error" role="alert"><strong>'
            f"{escape(error_code)}:</strong> {escape(error_message)}</p>"
        )
    else:
        error_section = ""

    rendered = HOME_ERROR_BLOCK.sub(lambda _: error_section, source, count=1)
    return rendered.replace("{{ attempt_id }}", escape(attempt_id, quote=True))


def render_result(complete: bool) -> str:
    """Resolve the result page's fixed complete/cancel copy."""

    source = (TEMPLATE_ROOT / "result.html").read_text()
    return RESULT_CONDITIONAL.sub(lambda match: match.group(1 if complete else 2), source)


def runtime_setting(request: Request, name: str) -> str:
    """Read a Worker binding first, then the ordinary process environment."""

    worker_environment: Any = request.scope.get("env")
    value = getattr(worker_environment, name, None) if worker_environment is not None else None
    return str(value).strip() if value is not None else os.environ.get(name, "").strip()


async def inttegro_client(request: Request) -> AsyncInttegroClient:
    api_key = runtime_setting(request, "INTTEGRO_API_KEY")
    if not api_key:
        raise DemoError("configuration_error", "Set INTTEGRO_API_KEY on the server.")

    # INTTEGRO:DECISION [connection-pooling] Reuse one client per process or
    # Worker isolate. The lock avoids constructing duplicate pools when the
    # first requests arrive concurrently. A secret rotation creates a new pool
    # and closes the old one without ever persisting or logging the key.
    lock = getattr(request.app.state, "inttegro_client_lock", None)
    if lock is None:
        lock = asyncio.Lock()
        request.app.state.inttegro_client_lock = lock
    async with lock:
        client = getattr(request.app.state, "inttegro_client", None)
        if client is None or client.http.api_key != api_key:
            if client is not None:
                await client.aclose()
            client = AsyncInttegroClient(api_key=api_key)
            request.app.state.inttegro_client = client
        return client


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return HTMLResponse(render_home(
        uuid4().hex,
        request.query_params.get("code", ""),
        request.query_params.get("message", ""),
    ))


@app.post("/checkout")
async def checkout(request: Request, name: str = Form(), email: str = Form(), phone: str = Form(), attempt_id: str = Form()):
    wants_json = "application/json" in request.headers.get("accept", "")
    try:
        value = parse_checkout_input(name, email, phone, attempt_id)
        origin = os.environ.get("INTTEGRO_DEMO_PUBLIC_URL", "").strip() or str(request.base_url).rstrip("/")
        client = await inttegro_client(request)
        order_id, checkout_url = await create_hosted_checkout(
            value,
            origin,
            client,
            runtime_setting(request, "INTTEGRO_DEMO_PRODUCT_ID"),
            runtime_setting(request, "INTTEGRO_DEMO_PRICE_ID"),
        )
        # INTTEGRO:DECISION [see-other-redirect] 303 follows the hosted URL with
        # GET. A 307/308 would preserve POST and could replay the merchant form.
        response = (
            JSONResponse({"orderId": order_id}, status_code=201, headers={"Cache-Control": "no-store"})
            if wants_json
            else RedirectResponse(checkout_url, status_code=303)
        )
        # INTTEGRO:DECISION [durable-order-correlation] This cookie is only a
        # server-readable demo correlation aid. It is neither authorization nor
        # proof of payment; persist an owner-scoped order mapping in production.
        response.set_cookie("inttegro_demo_order", order_id, max_age=1800, httponly=True, samesite="lax", secure=request.url.scheme == "https")
        return response
    except DemoError as error:
        # INTTEGRO:SECURITY [safe-error-boundary] Only bounded public messages go
        # to the browser; detailed SDK diagnostics remain in protected telemetry.
        if wants_json:
            status = 400 if error.code == "validation_error" else 503
            return JSONResponse({"code": error.code, "message": error.message}, status_code=status, headers={"Cache-Control": "no-store"})
        return RedirectResponse(f"/?{urlencode({'code': error.code, 'message': error.message})}", status_code=303)


@app.get("/complete", response_class=HTMLResponse)
async def complete(request: Request):
    return HTMLResponse(render_result(True))


@app.get("/cancel", response_class=HTMLResponse)
async def cancel(request: Request):
    return HTMLResponse(render_result(False))


@app.get("/health", response_class=JSONResponse)
async def health():
    return {"status": "ok", "demo": "fastapi"}
