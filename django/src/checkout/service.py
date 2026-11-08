import re
from dataclasses import dataclass
from urllib.parse import urlparse

import inttegro
from inttegro import APIError, LineItemType, ProductType


# Inttegro integration map
#
# INTTEGRO:FLOW [hosted-checkout] This server-only module validates an untrusted
# reservation, creates and finalizes an Order, and returns the hosted invoice
# URL used by the Django view.
# INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY must stay in the trusted
# Django process. Never put it in a template, static asset, browser response, or
# settings value that a frontend build publishes.
# INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment is available to apps
# prepared to own more payment state, recovery UI, method-specific behavior,
# testing, and compliance analysis.
# INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
# INTTEGRO:DOCS https://studio.inttegro.com/orders
# INTTEGRO:DOCS https://studio.inttegro.com/keys
# See ../../INTEGRATION_GUIDE.md and ../../integration-decisions.json for the complete
# rationale and machine-readable alternatives.


class DemoError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class CheckoutInput:
    name: str
    email: str
    phone: str
    attempt_id: str


@dataclass(frozen=True)
class CatalogSelection:
    type: ProductType
    name: str
    about: str | None
    reference: str | None
    price: inttegro.PriceParams


def parse_checkout_input(values) -> CheckoutInput:
    checkout = CheckoutInput(
        name=str(values.get("name", "")).strip(),
        email=str(values.get("email", "")).strip(),
        phone=str(values.get("phone", "")).strip(),
        attempt_id=str(values.get("attempt_id", "")).strip(),
    )
    if not checkout.name or not checkout.phone or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", checkout.email):
        raise DemoError("validation_error", "Enter a name, valid email, and phone number.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,100}", checkout.attempt_id):
        raise DemoError("validation_error", "Start a fresh checkout and try again.")
    return checkout


def validated_origin(value: str) -> str:
    # INTTEGRO:SECURITY [configured-public-origin] Prefer a configured,
    # allow-listed origin in production. A request-derived fallback is safe only
    # behind Django's precisely configured trusted proxy/host boundary. Return
    # URLs must be HTTP(S); Inttegro appends order_id after checkout.
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise DemoError("configuration_error", "The demo public URL is invalid.")
    return f"{parsed.scheme}://{parsed.netloc}"


def select_catalog_product(product, price_id: str) -> CatalogSelection:
    # INTTEGRO:SECURITY [catalog-authority] The public form supplies no product,
    # price, or amount. Resolve them with the server credential and verify that
    # the configured active Price belongs to this Product.
    if not product.active:
        raise DemoError("configuration_error", "The configured demo product is not active.")
    price = next((candidate for candidate in (product.prices or []) if candidate.id == price_id and candidate.active), None)
    if price is None or price.fixed_amount is None or price.fixed_amount.value <= 0:
        raise DemoError("configuration_error", "The configured demo price is not active for this product.")
    return CatalogSelection(
        type=product.type,
        name=product.name,
        about=product.about,
        reference=product.reference,
        price=inttegro.PriceParams(currency=price.fixed_amount.currency, value=price.fixed_amount.value),
    )


def build_order_request(checkout: CheckoutInput, origin: str, product: CatalogSelection) -> inttegro.orders.CreateRequest:
    return inttegro.orders.CreateRequest(
        # INTTEGRO:DECISION [stable-idempotency-key] Reuse this key when retrying
        # the same logical reservation. In production, persist it with a durable
        # cart or booking; a new random key on retry can create a duplicate.
        # https://studio.inttegro.com/idempotency
        request_meta=inttegro.orders.RequestMeta(idempotency_key=f"demo-{checkout.attempt_id}"),
        # INTTEGRO:DECISION [merchant-order-number] Send a human-facing merchant
        # reference instead of accepting Inttegro's generated or_ ID fallback.
        # This demo derives a retry-stable value from its validated attempt. A
        # production ticketing system should use its persisted booking number
        # and must not encode customer PII in the reference.
        number=f"AFTERGLOW-{checkout.attempt_id.replace('_', '-').upper()[:48]}",
        # INTTEGRO:DECISION [inline-customer] Guest checkout uses customer_data.
        # Account-based flows should resolve customer_id on the server. The
        # Orders API accepts exactly one of the two customer representations.
        customer_data=inttegro.orders.Customer(name=checkout.name, email_address=checkout.email, phone_number=checkout.phone),
        # INTTEGRO:DECISION [finalize-on-create] The ticket and total are settled,
        # so one call freezes the order and produces invoice formats. If tax,
        # inventory, approval, or items can change, create a draft and finalize
        # it only after those values become authoritative.
        finalize=True,
        checkout_settings=inttegro.orders.CheckoutSettings(redirect_url=f"{origin}/complete", cancel_url=f"{origin}/cancel"),
        line_items=[inttegro.orders.ProductLineItem(
            type=LineItemType.PRODUCT,
            product=inttegro.orders.Product(
                # INTTEGRO:DECISION [catalog-snapshot] The service looks up the
                # configured Inttegro Product and Price, validates their
                # relationship, and snapshots those authoritative fields into
                # the Order for compatibility across SDK versions.
                # INTTEGRO:ALTERNATIVE [catalog-snapshot] When the SDK exposes
                # the typed catalogue union, send product_id + price_id +
                # quantity instead and do not mix in inline fields.
                type=product.type,
                name=product.name,
                about=product.about,
                reference=product.reference,
                quantity=1,
                price=product.price,
            ),
        )],
    )


async def create_hosted_checkout(
    checkout: CheckoutInput,
    origin: str,
    client: inttegro.AsyncInttegroClient,
    product_id: str,
    price_id: str,
) -> tuple[str, str]:
    # INTTEGRO:SECURITY [server-api-key] The view constructs this client from
    # server runtime bindings. The secret never enters form data, templates,
    # static files, logs, or a public error response.
    if not re.fullmatch(r"prod_[A-Za-z0-9]+", product_id) or not re.fullmatch(r"pr_[A-Za-z0-9]+", price_id):
        raise DemoError("configuration_error", "Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.")
    try:
        # INTTEGRO:DECISION [async-client] This Django view runs under ASGI and
        # awaits every SDK network operation. The same ASGI application runs in
        # Uvicorn containers and Cloudflare Workers. Traditional synchronous
        # Django applications can continue to use InttegroClient instead.
        # https://studio.inttegro.com/sdk-observability
        # INTTEGRO:FLOW [catalog-lookup] Fetch at checkout time so product
        # publication and price changes are observed. High-volume services can
        # add a short cache with explicit invalidation.
        # https://studio.inttegro.com/products
        product = select_catalog_product(await client.products.lookup(product_id), price_id)
        order = await client.orders.create(build_order_request(checkout, origin, product))
        # INTTEGRO:DECISION [returned-checkout-url] Use the response's URL. Do
        # not construct one from order.id and undocumented routing conventions.
        checkout_url = order.invoice.format.web.url
        if not checkout_url:
            raise DemoError("api_error", "Inttegro did not return a hosted checkout URL.")
        return order.id, checkout_url
    except DemoError:
        raise
    except APIError as error:
        # INTTEGRO:SECURITY [safe-error-boundary] Keep upstream bodies,
        # credentials, and stack traces in protected server diagnostics. Public
        # messages remain stable and safe; log request IDs when available.
        raise DemoError("api_error", "Inttegro rejected the checkout request.") from error
    except Exception as error:
        raise DemoError("api_error", "Checkout is temporarily unavailable.") from error
