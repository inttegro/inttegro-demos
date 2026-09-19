# Inttegro + Django demo

**Afterglow Sessions** is an event-discovery and ticket-reservation experience.
Django validates the guest details, creates a finalized digital ticket order
with the Inttegro Python SDK, and supports all three web Checkout presentations.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
set -a && source .env && set +a
python manage.py runserver 3004
```

Configure `INTTEGRO_DEMO_PRODUCT_ID` and `INTTEGRO_DEMO_PRICE_ID` with the
active Afterglow admission Product and Price. Django looks them up and validates
their relationship server-side; the reservation form supplies no product or
amount. The checkout view runs under ASGI, awaits `AsyncInttegroClient`, and
reuses one HTTP connection pool per process or Worker isolate. Run
`python manage.py test` for the focused checks.

## Try the Checkout presentations

The reservation form offers **Embedded**, **Modal**, and **Hosted page**.
Embedded is the default. The async view returns only a no-store finalized Order
ID for embedded/modal Checkout and preserves a `303` hosted-page path for the
native form. Browser ownership is documented in
[`checkout-presentations.js`](./src/checkout/static/checkout/checkout-presentations.js).

## Run with Docker

After configuring `.env`, run `docker compose up --build --wait`. Compose
starts the production image at <http://localhost:3004> and monitors
`GET /health`. Use
`docker compose down` to stop it. Set `INTTEGRO_DEMO_PUBLIC_URL` to the exact
HTTPS origin before exposing the container publicly.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-django-v1.8.3)
[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-django-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy on Railway](../assets/providers/railway-button.svg)](https://railway.com/new/template/0h-Ilj?utm_medium=integration&utm_source=inttegro-demos&utm_campaign=django)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-django-v1.8.3)

Cloud Run, Railway, and Render build the release-pinned Dockerfile. Railway generates the Django signing
secret, and configures its public and health-check hostnames. On Render, set
`DJANGO_CSRF_TRUSTED_ORIGINS` to the deployment's exact HTTPS origin, such as
`https://inttegro-demo-django.onrender.com`; this remains separate from the
host-only `DJANGO_ALLOWED_HOSTS` value. The proxy must overwrite
`X-Forwarded-Proto` before Django is allowed to trust it.

Cloudflare uses Django's ASGI application and serves the collected `/static/*`
files through Workers Static Assets. Set `DJANGO_ALLOWED_HOSTS` to the assigned
hostname and `DJANGO_CSRF_TRUSTED_ORIGINS` plus
`INTTEGRO_DEMO_PUBLIC_URL` to its exact HTTPS origin. Run
`npm run dev:cloudflare` for the Worker runtime locally. Inttegro Python SDK
6.3.0 or newer is required because its outbound requests are asynchronous.

Python Workers do not provide OS threads, while Django's ASGI handler delegates
small synchronous framework hooks to `asgiref`'s thread pool. This demo has no
ORM or blocking synchronous I/O, so [`src/worker_compat.py`](./src/worker_compat.py)
runs only those hooks inline at the Worker boundary. Do not reuse that shim in a
database-backed application: follow Cloudflare's WSGI and `django-cf` guidance,
or use the unmodified ASGI application in a container. See
[`DEPLOYING.md`](../DEPLOYING.md) for the compatibility decision.

## Understand the integration

Start with [`src/checkout/service.py`](./src/checkout/service.py) for the typed Order
request and safe error mapping, then read
[`src/checkout/views.py`](./src/checkout/views.py) for the 303 handoff and correlation
boundary, including its JSON representation. The `INTTEGRO:*` comments map choices and alternatives to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
