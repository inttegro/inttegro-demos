import re
from dataclasses import dataclass
from urllib.parse import urlparse

import inttegro
from inttegro import APIError, LineItemType, ProductType


# Inttegro integration map
#
# INTTEGRO:FLOW [hosted-checkout] This server-only module validates an untrusted
# ticket request, creates and finalizes an Order, and returns the hosted invoice
# URL used by the FastAPI route.
# INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY stays in the trusted Python
# process. Never publish it through frontend configuration, HTML, client code,
# mobile bundles, or error responses.
# INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment offers additional UI
# control but makes the merchant own more payment states, recovery behavior,
# method-specific logic, testing, and compliance analysis.
# INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
# INTTEGRO:DOCS https://studio.inttegro.com/orders
# INTTEGRO:DOCS https://studio.inttegro.com/keys
# See ../../INTEGRATION_GUIDE.md and ../../integration-decisions.json for the full
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


def parse_checkout_input(name: str, email: str, phone: str, attempt_id: str) -> CheckoutInput:
    value = CheckoutInput(name.strip(), email.strip(), phone.strip(), attempt_id.strip())
    if not value.name or not value.phone or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", value.email):
        raise DemoError("validation_error", "Enter a name, valid email, and phone number.")
    if not re.fullmatch(r"[A-Za-z0-9_-]{8,100}", value.attempt_id):
        raise DemoError("validation_error", "Start a fresh checkout and try again.")
    return value


def validated_origin(value: str) -> str:
    # INTTEGRO:SECURITY [configured-public-origin] Production should use an
    # allow-listed configured origin. A request-derived fallback is safe only
    # behind a precisely configured trusted proxy chain. Return URLs must be
    # absolute HTTP(S); Inttegro appends order_id after checkout.
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise DemoError("configuration_error", "The demo public URL is invalid.")
    return f"{parsed.scheme}://{parsed.netloc}"


def select_catalog_product(product, price_id: str) -> CatalogSelection:
    # INTTEGRO:SECURITY [catalog-authority] The untrusted form supplies no
    # product, price, or amount. Resolve and validate them on this server.
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


def build_order_request(value: CheckoutInput, origin: str, product: CatalogSelection) -> inttegro.orders.CreateRequest:
    return inttegro.orders.CreateRequest(
        # INTTEGRO:DECISION [stable-idempotency-key] Reuse the key for retries of
        # this logical checkout. Production systems persist a cart- or booking-
        # derived key; creating a fresh key after a timeout permits duplicates.
        # https://studio.inttegro.com/idempotency
        request_meta=inttegro.orders.RequestMeta(idempotency_key=f"demo-{value.attempt_id}"),
        # INTTEGRO:DECISION [merchant-order-number] Send a recognizable merchant
        # reference so Inttegro does not fall back to its generated or_ ID. The
        # validated attempt keeps this demo value stable across retries. A real
        # booking service should use its durable reservation number without PII.
        number=f"AFTERGLOW-{value.attempt_id.replace('_', '-').upper()[:48]}",
        # INTTEGRO:DECISION [inline-customer] customer_data matches this guest
        # flow. Account-based products should resolve customer_id on the trusted
        # server. The Orders API accepts exactly one customer representation.
        customer_data=inttegro.orders.Customer(name=value.name, email_address=value.email, phone_number=value.phone),
        # INTTEGRO:DECISION [finalize-on-create] The item and total are settled,
        # so finalization freezes the order and generates invoice formats in one
        # call. Use draft -> update -> finalize for mutable tax, inventory,
        # approval, shipping, or line items.
        finalize=True,
        checkout_settings=inttegro.orders.CheckoutSettings(redirect_url=f"{origin}/complete", cancel_url=f"{origin}/cancel"),
        line_items=[inttegro.orders.ProductLineItem(
            type=LineItemType.PRODUCT,
            product=inttegro.orders.Product(
                # INTTEGRO:DECISION [catalog-snapshot] The service resolves the
                # configured Product and Price and snapshots the verified fields
                # into the Order for compatibility across SDK versions.
                # INTTEGRO:ALTERNATIVE [catalog-snapshot] SDKs with the typed
                # catalogue union can send product_id + price_id + quantity
                # instead, without mixing in inline product fields.
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
    value: CheckoutInput,
    origin: str,
    client: inttegro.AsyncInttegroClient,
    product_id: str,
    price_id: str,
) -> tuple[str, str]:
    # INTTEGRO:SECURITY [server-api-key] The route constructs this client from
    # server runtime bindings. The secret never enters form data, HTML, browser
    # JavaScript, logs, or a public error response.
    if not re.fullmatch(r"prod_[A-Za-z0-9]+", product_id) or not re.fullmatch(r"pr_[A-Za-z0-9]+", price_id):
        raise DemoError("configuration_error", "Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.")
    try:
        # INTTEGRO:DECISION [async-client] FastAPI handlers run on an event loop,
        # so every SDK network operation is awaited. Calling InttegroClient here
        # would block unrelated requests. Synchronous frameworks should keep the
        # original client instead. The route reuses one AsyncInttegroClient and
        # its HTTP connection pool across requests.
        # https://studio.inttegro.com/sdk-observability
        # INTTEGRO:FLOW [catalog-lookup] Fetch at checkout time so publication
        # and price changes are observed. High-volume apps may use a short cache
        # with an explicit invalidation policy. https://studio.inttegro.com/products
        product = select_catalog_product(await client.products.lookup(product_id), price_id)
        order = await client.orders.create(build_order_request(value, validated_origin(origin), product))
        # INTTEGRO:DECISION [returned-checkout-url] Use the response field rather
        # than constructing a URL from order.id and undocumented routing.
        checkout_url = order.invoice.format.web.url
        if not checkout_url:
            raise DemoError("api_error", "Inttegro did not return a hosted checkout URL.")
        return order.id, checkout_url
    except DemoError:
        raise
    except APIError as error:
        # INTTEGRO:SECURITY [safe-error-boundary] Keep raw upstream payloads,
        # credentials, and traces private. Log bounded metadata and request IDs;
        # expose only stable public categories.
        raise DemoError("api_error", "Inttegro rejected the checkout request.") from error
    except Exception as error:
        raise DemoError("api_error", "Checkout is temporarily unavailable.") from error
