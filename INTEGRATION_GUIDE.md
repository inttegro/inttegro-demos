# Inttegro integration guide

This guide explains the choices shared by the demo applications. It is written
for engineers evaluating an integration and for machine readers that need
stable, explicit decision context. The runnable code remains the source for
framework mechanics; this guide explains *why* the code has that shape.

For a structured version of the same decisions, read
[`integration-decisions.json`](./integration-decisions.json). Decision IDs in
that file are also embedded in source comments, so a reader can move from a
line of code to its rationale and alternatives without guessing.

## Comment vocabulary

Comments beside Inttegro integration code use these stable markers:

| Marker | Meaning |
| --- | --- |
| `INTTEGRO:FLOW` | A step in the request, checkout, or verification lifecycle. |
| `INTTEGRO:SECURITY` | A trust boundary, secret-handling rule, or privacy constraint. |
| `INTTEGRO:DECISION` | The option selected by these demos and the reason for it. |
| `INTTEGRO:ALTERNATIVE` | A valid option that may better fit another product. |
| `INTTEGRO:VERIFY` | A result that must be confirmed using authoritative server state. |
| `INTTEGRO:OBSERVABILITY` | Logging, tracing, correlation, and data-minimization guidance. |
| `INTTEGRO:DOCS` | A canonical Inttegro documentation link. |

The optional value in square brackets is a decision ID from the JSON registry,
for example `INTTEGRO:DECISION [finalize-on-create]`. Markers are deliberately
plain text so source search, documentation generators, and retrieval systems
can index them in every language.

## Architecture A: server-owned Checkout for web applications

Next.js, Nuxt, Express, Django, FastAPI, Rails, Laravel, Go, Spring Boot,
NestJS, RedwoodSDK, and Astro use the same server-owned flow:

```text
browser form
    -> demo server validates customer and attempt data
    -> server creates and finalizes an order with its Inttegro API key
    -> hosted page: server sends a 303 to the URL returned by Inttegro
    -> embedded/modal: server sends no-store JSON containing only { orderId }
    -> browser completes the same Inttegro-hosted experience
    -> browser returns to /complete or /cancel with order_id appended
    -> merchant server looks up the order before fulfillment
```

### One Checkout experience, three presentations

Every demo offers **Embedded**, **Modal**, and **Hosted page** at the point of
checkout. All three use the same server-created Order and the same
Inttegro-hosted payment experience. Only placement changes: inline Checkout
keeps the order context visible, a modal creates a focused interruption, and
the hosted page provides a full-page handoff with no dependency on merchant
JavaScript.

The selector exists so readers can compare those trade-offs in a real product
journey. A production product normally chooses one presentation deliberately
instead of asking every payer. The native HTML form remains the baseline; the
browser module intercepts only embedded and modal submissions. This progressive
enhancement means failed or disabled JavaScript can still reach the hosted page.

The server distinguishes the two representations with content negotiation. An
ordinary form request gets `303 See Other` and the hosted URL. A request with
`Accept: application/json` gets `201 Created`, `Cache-Control: no-store`, and
only `{ "orderId": "or_…" }`. The API key, catalog selection, amount, customer
authority, and full upstream response never cross into merchant JavaScript.

These standalone framework demos load the fixed versioned runtime directly
from `https://js.inttegro.com`. That keeps Rails, Django, Go, and Java examples
free of an otherwise unnecessary Node build. The package adapters are currently
a developer preview; after publication, production JavaScript applications
should normally use `@inttegro/js` or the React, Vue, Svelte, or Angular adapter
for typed lifecycle and cleanup integration. Those packages still load the
executable runtime only from Inttegro's controlled origin; never download,
proxy, bundle, mirror, or self-host it.

The merchant page owns the outer modal: its close control, focus restoration,
scroll containment, and visual motion. Inttegro owns the isolated iframe and
the payment controls inside it. Open the dialog before calling `mount()` so the
frame can measure its available space, and destroy the controller when the
dialog closes. Embedded Checkout hides the completed merchant form and mounts
beside it; the controller is destroyed whenever the owning page replaces that
surface.

An application with a materially custom payment experience can use the Orders
payment endpoints instead, but then it owns more state transitions, recovery
UI, payment-method behavior, testing, and compliance analysis. Embedding the
Inttegro-hosted iframe is not direct API payment: the merchant controls
placement, while Inttegro still owns sensitive payment entry and confirmation.

Canonical documentation:

- [Accept payment with Inttegro Checkout](https://studio.inttegro.com/accept-payment-with-inttegro-checkout)
- [Web Checkout SDKs](https://studio.inttegro.com/web)
- [JavaScript runtime and loader](https://studio.inttegro.com/web/javascript)
- [Orders API and lifecycle](https://studio.inttegro.com/orders)
- [Payment methods](https://studio.inttegro.com/payment-methods)

### Keep the API key on a trusted server

`INTTEGRO_API_KEY` is read only by server code. Browser JavaScript, rendered
HTML, mobile bundles, logs, error query strings, and source-control files must
never contain it. Frameworks differ in how they expose environment variables;
avoid conventions such as `NEXT_PUBLIC_`, `NUXT_PUBLIC_`, `VITE_`, or
`EXPO_PUBLIC_` for an Inttegro API key because those prefixes intentionally
publish values to client code.

The demos construct SDK clients close to the operation to keep each example
self-contained. A long-running production service can inject and reuse one
client configured at startup. Reuse is preferable when the SDK transport pools
connections, configuration should fail fast, or the application injects an
OpenTelemetry provider. Never rotate a key by copying it into code; use the
platform's secret store and a controlled process restart or client refresh.

Canonical documentation:

- [API keys](https://studio.inttegro.com/keys)
- [Inttegro SDKs](https://studio.inttegro.com/sdks)

### Match the client to the framework's concurrency model

FastAPI, async Django views, and Python Workers use `AsyncInttegroClient` and
await every resource operation. One application-lifetime client owns the HTTPX
connection pool and is closed during framework shutdown. Calling the
synchronous client from an async handler would block the event loop; wrapping
it in a thread is not portable to runtimes such as Cloudflare Python Workers,
which do not provide OS threads.

The synchronous `InttegroClient` remains the correct choice for synchronous
Django or Flask views, scripts, and jobs. Its continued availability is a
compatibility boundary, not an invitation to mix both models in one request
path. When an application injects its own async HTTP client, that pool remains
application-owned and the application must close it.

Cloudflare bindings also deserve an explicit adapter. FastAPI can receive its
bindings in the ASGI scope. Django reads signing, allowed-host, and CSRF
settings during initialization, so the Worker adapter applies those values
before importing the ASGI application. The Django demo contains no ORM or
blocking synchronous I/O; applications that do should follow Cloudflare's WSGI
and storage guidance or use a container rather than copying its narrow inline
framework-hook shim.

Canonical documentation:

- [Python SDK](https://studio.inttegro.com/sdks/python)
- [SDK observability](https://studio.inttegro.com/sdk-observability)

### Make order creation replay-safe

The browser generates one opaque `attempt_id` when it renders the checkout.
The server validates it and derives `demo-{attempt_id}` as the order-creation
idempotency key. If a network retry repeats the same logical submission, it
reuses the key and Inttegro can return the first successful result instead of
creating a second order.

The attempt ID is not authentication, authorization, or a CSRF control. A real
merchant should bind the idempotency key to a durable cart, invoice, or checkout
attempt stored in its database and enforce normal session ownership and CSRF
protection. Generate a new key only when the business operation has genuinely
changed. Reusing a key with a changed payload causes an idempotency conflict.

Canonical documentation:

- [Idempotent requests](https://studio.inttegro.com/idempotency)

### Supply the merchant's order number

Every demo sets the Order's top-level `number`. This is the human-facing,
merchant-owned reference used in operational reconciliation and as an invoice
label fallback. When it is omitted, Inttegro uses the generated `or_…` order ID
as the order number. That fallback is useful for integrations without their own
numbering system, but it is a poor default for merchants that already identify
carts, bookings, invoices, or sales orders in their own system.

The demos have no database, so they form a recognizable reference from the
story name and the already validated checkout `attempt_id`: `KORA-…` for the
storefronts, `AFTERGLOW-…` for ticketing, `INV-2048-…` for Ledgerline, and
`OPENFIELD-…` for contributions. The
suffix is normalized, bounded to keep the complete value below Inttegro's
80-character limit, and—critically—stable when the same request is retried.

Production code should not invent a new random number at the API boundary.
Read the durable merchant order number from the same trusted cart, reservation,
or receivables record that owns the idempotency key, then persist its mapping to
the returned Inttegro order ID. Do not encode names, email addresses, phone
numbers, or other customer PII in the number. An order number is a correlation
handle, not authentication, authorization, proof of ownership, or proof of
payment.

`number`, `request_meta.idempotency_key`, and `invoice_settings.number` serve
different purposes. The order number is for people and business systems; the
idempotency key controls request replay; an explicit invoice number is optional
rendering/accounting data. Reusing one stable business identifier as input to
both the order number and idempotency-key strategy can be sensible, but the
fields should not be treated as interchangeable.

Canonical documentation:

- [Orders API](https://studio.inttegro.com/orders)

### Choose customer and catalog representations deliberately

Order creation accepts exactly one customer representation. The web demos use
inline `customer_data` because their stories collect guest details at checkout.
Applications with accounts, repeat buyers, saved addresses, or customer history
should usually create or resolve a Customer on the server and send
`customer_id` instead. Never send both fields.

Each server demo reads `INTTEGRO_DEMO_PRODUCT_ID` and
`INTTEGRO_DEMO_PRICE_ID` from trusted deployment configuration (Nuxt uses the
equivalent `NUXT_` names). It calls the Products lookup operation at checkout,
requires the configured Product to be active, and verifies that the configured
Price belongs to it and has a positive fixed amount. The browser and mobile
apps send none of those values, so changing an input field or request body
cannot select a different product or total.

The demos then snapshot the verified Product name, type, description,
reference, and Price into the Order's inline line-item shape. This is an
intentional portability trade-off: current maintained SDK releases do not all
expose the same typed request model for catalog references. When the SDK in your
language supports it, the more direct catalog-backed alternative is to send
`product_id`, `price_id`, and `quantity` and omit every inline product field.
Use `product_id` with an explicit server-calculated price when identity comes
from Inttegro but transaction pricing belongs to trusted merchant logic.

Looking up on every checkout makes publication and price changes take effect
immediately and keeps the example easy to reason about. A high-volume service
can cache the validated snapshot briefly, but must define invalidation for
unpublishing, archiving, price activation, currency changes, and catalog
rollouts. Treat a missing, inactive, mismatched, or zero-value configuration as
a deployment error rather than falling back to a hard-coded amount.

If the merchant owns its canonical catalog elsewhere, resolve product identity
and price from that database and send an inline snapshot. Do not mix inline
product fields with `product_id` in one line item, and never accept authoritative
catalog or money fields from an untrusted browser or mobile request.

Every `price.value` is an integer in the currency's smallest unit. In these
demos, `5000` GHS minor units means GHS 50.00. Convert decimal user input with a
currency-aware money type; do not use binary floating-point arithmetic for
amounts.

Canonical documentation:

- [Products and prices](https://studio.inttegro.com/products)
- [Orders API and line-item shapes](https://studio.inttegro.com/orders)

### Finalize now or build a draft

The demos send `finalize: true`. Their cart is already complete, so one request
freezes its line items and totals and produces the invoice formats needed for
checkout. This reduces round trips and keeps every framework comparable.

Use the two-step alternative—create a draft, update it, then call the finalize
operation—when totals depend on shipping, tax, inventory, manual approval, or
other work that is not settled at creation time. Finalization is a business
boundary: after it, treat the order as immutable rather than silently changing
what the customer agreed to pay.

### Treat the public origin as deployment configuration

Inttegro returns the customer to the `redirect_url` or `cancel_url` supplied in
`checkout_settings` and appends the order ID. The URLs must be absolute HTTP(S)
URLs and must not already contain an `order_id` parameter. The demos derive a
local origin from the request but allow `INTTEGRO_DEMO_PUBLIC_URL` to override
it for tunnels, reverse proxies, and production hosts.

Production services should prefer an allow-listed configured origin. Trust
forwarded host and protocol headers only when the application is behind a known
proxy and its framework is configured with the exact trusted proxy chain. An
untrusted Host header must not be allowed to choose a payment return target.

### Choose the response representation deliberately

The hosted URL is read from `order.invoice.format.web.url`. Do not construct an
Inttegro URL from an order ID or rely on undocumented hostname/path patterns.
Returned links can evolve independently of the merchant integration.

For Hosted page and the native form fallback, handlers answer with `303 See
Other`, which tells the browser to follow the hosted URL with GET. `302` is
historically ambiguous after POST; `307` and `308` preserve POST and could
resubmit the merchant form body to the checkout destination.

Embedded and modal Checkout send the same form with `Accept: application/json`.
The server answers `201 Created` with only the finalized Order ID. Mark that
response `Cache-Control: no-store`: the ID is intentionally usable by the payer
but should not be retained by shared caches, analytics, or URLs. Do not return
the API key, authoritative input values, raw Order payload, or the hosted URL
merely because a browser requested JSON.

### Store correlation, then verify before fulfillment

The demos place the returned order ID in a short-lived `HttpOnly`, `SameSite=Lax`
cookie so the example can demonstrate server-held correlation without exposing
the value to browser scripts. That cookie is not proof of ownership or payment.
A production merchant should persist its own order/cart ID, the Inttegro order
ID, the customer or tenant owner, and the idempotency key in one durable record.

Neither arrival at `/complete` nor a successful payment-sheet callback is
authoritative fulfillment evidence. A customer can replay a return URL, close a
browser before returning, or complete asynchronously. Read the appended order
ID, resolve it through the merchant's ownership mapping, and use an
authenticated server-side order lookup before releasing goods or services.

Inttegro does not currently expose merchant-facing webhooks. Use bounded
polling for the immediate result and a scheduled reconciliation job for orders
left in non-terminal states. Make fulfillment idempotent so both paths can
observe the same paid order safely. Do not poll forever inside one browser
request.

Canonical documentation:

- [Webhooks and reconciliation](https://studio.inttegro.com/webhooks)
- [Orders lookup](https://studio.inttegro.com/orders#lookup-an-order)

### Preserve useful errors without leaking upstream details

The demos translate failures into three stable public categories:
`configuration_error`, `validation_error`, and `api_error`. Raw SDK responses,
authorization headers, stack traces, and provider details stay server-side.
Production systems should log the stable merchant order ID, Inttegro request ID
when available, operation, duration, and safe error type—not API keys, customer
contact details, payment data, or entire request/response bodies.

Current server SDKs integrate with an application-owned OpenTelemetry provider.
They do not select an exporter or vendor. Configure tracing once at application
startup if you need it; preserve the request context across retries and
background reconciliation.

Canonical documentation:

- [SDK observability](https://studio.inttegro.com/sdk-observability)

## Architecture B: native payment sheet

SwiftUI, Jetpack Compose, Flutter, and React Native use a merchant-backend
boundary:

```text
mobile app creates an opaque attempt ID
    -> authenticated merchant backend creates and finalizes the order
    -> backend returns only { orderId }
    -> app configures and presents the Inttegro payment sheet
    -> app reports immediate UX feedback
    -> merchant backend verifies order state before fulfillment
```

The Next.js demo supplies the illustrative `POST /mobile/orders` endpoint. It
keeps both `INTTEGRO_API_KEY` and `INTTEGRO_DEMO_CUSTOMER_ID` server-side,
accepts a narrow request body, limits the order to the intended product and
payment method, and returns only the order ID required by the SDK.

### Authenticate the mobile-to-backend request in production

The endpoint is intentionally minimal so each native app can run locally. It
does not demonstrate merchant authentication. A production endpoint must bind
the request to the signed-in customer, authorize the cart on the server, apply
rate limits, and consider platform attestation or abuse controls. Never accept
price, currency, product identity, fulfillment state, or `customer_id` from an
untrusted mobile client without server-side validation.

If your product supports guest checkout, issue a short-lived, narrowly scoped
checkout capability from your backend rather than embedding the Inttegro API
key. If the merchant already has a backend-for-frontend or API gateway, put the
order-creation operation there; a Next.js route is not required.

### Pass an order ID, not a server credential

The mobile SDK receives the finalized `orderId` and a registered return URL.
The API key is never compiled into the application. The return URL brings the
user back after external authorization but is not payment confirmation. Make
the custom URL scheme or universal/app link unique to the application and
register it in each platform's native configuration.

### Observe lifecycle events safely

Each demo subscribes to the SDK's privacy-safe payment-sheet telemetry and logs
bounded fields such as flow ID, event name, sequence, operation, HTTP status,
request ID, and error type. Production applications can bridge these events to
their own telemetry pipeline, but should preserve the SDK's data minimization.
Do not attach customer details, secrets, or raw provider payloads.

Telemetry is diagnostic, not business state. A `completed` UI result means the
sheet completed its client-side flow; the merchant backend still owns payment
verification and idempotent fulfillment.

## Production checklist

Before adapting a demo for live traffic:

1. Move API keys into the deployment platform's secret store and test rotation.
2. Persist merchant and Inttegro identifiers in a durable ownership mapping.
3. Derive idempotency keys from stable business attempts and reuse them on retry.
4. Recompute products, quantities, price, currency, discounts, tax, and shipping
   on the trusted server.
5. Configure an allow-listed public origin and trusted proxy settings.
6. Add authentication, authorization, CSRF protection where relevant, rate
   limiting, and abuse controls.
7. Implement bounded status lookup plus scheduled reconciliation.
8. Make fulfillment and post-payment side effects idempotent.
9. Configure privacy-safe logs, metrics, traces, alerts, and request-ID capture.
10. Test success, cancellation, declines, timeouts, retries, duplicate submits,
    deep-link returns, process death, accessibility, and reduced connectivity.

The demos optimize for clarity and cross-framework comparability. Your
production design should preserve the trust boundaries and lifecycle rules even
when you choose one of the documented alternatives.
