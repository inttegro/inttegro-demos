# Demo acceptance contract

This contract keeps all Inttegro demos behaviorally equivalent while allowing
each application to follow its framework's normal project structure.

## Web Checkout presentation flow

Every server-backed demo must expose:

| Route | Behavior |
| --- | --- |
| `GET /` | Render the complete app story and generate a fresh checkout attempt ID. |
| `POST /checkout` | Validate the form and create one finalized Inttegro Order. An ordinary HTML request receives a `303` to the returned hosted URL; `Accept: application/json` receives `201 {"orderId":"…"}` for embedded or modal Checkout. |
| `GET /complete` | Explain that the browser returned successfully and server-side status remains authoritative. |
| `GET /cancel` | Explain that checkout was canceled and offer a safe retry. |
| `GET /health` | Return a non-secret readiness response without calling Inttegro. |

The order request must use:

- a server-only `INTTEGRO_API_KEY`;
- an idempotency key derived from the submitted checkout attempt ID;
- integer minor units (`5000` means GHS 50.00);
- `finalize: true`;
- a line item whose product type and name match the visible app story;
- explicit redirect and cancellation URLs; and
- the hosted checkout URL returned by Inttegro rather than one constructed by
  the demo; and
- a JSON response containing only the finalized Order ID, marked
  `Cache-Control: no-store`, when merchant-page Checkout is requested.

Browser JavaScript progressively enhances the native form with three choices:

- **Embedded** mounts Inttegro Checkout below the order form;
- **Modal** mounts the same Checkout inside an app-owned accessible dialog; and
- **Hosted page** follows the returned Inttegro Pages URL.

The default is Embedded. Hosted page remains the no-JavaScript fallback. The
presentation changes neither the Order request nor the server trust boundary.
The browser must load executable Checkout code only from the fixed, versioned
`https://js.inttegro.com` URL and must never mirror or self-host it.

## Input contract

The checkout form contains `name`, `email`, `phone`, and `attempt_id`.
Storefront, ticketing, and invoice stories use one fixed GHS 50.00 purchase so
integrations remain comparable. Openfield uses a catalog `cause` Product and a
server-validated tier whose only effect is the amount selected under its saved
`customer_selected_amount` Price policy:

| Story | API line item | Product type |
| --- | --- | --- |
| Kora Market | `Dawn Brew Set` | `physical` |
| Afterglow Sessions | `Afterglow Sessions - Courtyard admission` | `digital` |
| Ledgerline | `Invoice INV-2048` | `service` |
| Openfield | Configured campaign Product and Price | `cause` |

The first three stories use fixed GHS `5000` prices and quantity `1`. Openfield
requires a GHS customer-selected Price whose range includes `5000` through
`25000`, whose suggestions include `5000`, `10000`, and `25000`, and always
uses quantity `1`. Visible product names, totals, fulfillment language, and API
requests must agree.

Applications must trim input, reject missing fields, require a syntactically
valid email address, and reject attempt IDs outside `[A-Za-z0-9_-]`.

## Error contract

- Missing server configuration is reported as `configuration_error`.
- Invalid customer input is reported as `validation_error`.
- Inttegro SDK errors are mapped to a safe code and message.
- API keys, authorization headers, stack traces, and raw upstream payloads are
  never sent to the browser.
- A retry of the same logical submission reuses the same attempt ID and
  therefore the same idempotency key.

## Mobile contract

Mobile applications never receive `INTTEGRO_API_KEY`. Their demo backend creates
and finalizes an immutable, mobile-money-only checkout order from a
client-generated attempt ID. The application passes only its `orderId` and
presentation configuration to the Inttegro SDK. A client callback is not proof
of payment; fulfillment uses authoritative server-side payment state.

Each mobile host consumes the SDK's privacy-safe telemetry stream for the
payment-sheet lifecycle. Card, Apple Pay, and Google Pay must not be advertised
until those payment methods are implemented end to end.

## Verification

Every server-backed demo must provide:

- one command to install dependencies;
- one command to run locally;
- one command that performs its available static and automated checks;
- at least one test for invalid input;
- at least one test proving the expected Inttegro order request; and
- an `.env.example` containing placeholders only.

It must also verify that every presentation creates the same authoritative
Order shape, that embedded and modal responses expose only `orderId`, and that
closing a merchant-owned modal destroys its Checkout controller and restores
focus through the platform dialog behavior.

Every implemented integration entry point must also:

- link to applicable canonical documentation at `studio.inttegro.com`;
- use the stable `INTTEGRO:*` comment vocabulary documented in
  [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md);
- identify consequential choices with a decision ID from
  [`integration-decisions.json`](./integration-decisions.json).

Taken together, each demo's entry points must explain at least one viable
alternative where the example's choice is not universally correct.

Comments must describe trust boundaries and lifecycle semantics, not merely
translate the next line of code. The JSON registry is part of the public demo
contract: paths must exist, decision IDs must be unique, and every referenced
documentation key must resolve.

## Release and permalink contract

Every demo in a published suite has a semantic version and immutable annotated
tag in that release manifest. A release includes:

- one signed suite tag named `v{version}`;
- one signed alias named `{demo-id}-v{version}` for every implemented demo;
- a tracked `releases/v{version}.json` manifest containing the exact demo paths
  and source entry points; and
- a single GitHub Release on the suite tag, generated from the corresponding
  tracked Markdown notes.

All tags for a suite release point to the same commit. Studio permalinks use a
per-demo tag, repository-relative source path, and explicit line range. They
must never use `main`, a branch name, or an unversioned source URL. Published
tags are never moved or reused; corrections require a new patch release. See
[RELEASING.md](./RELEASING.md) for the complete policy.

Mobile demos instead test configuration validation and the demo-backend request
boundary, then follow the native device and accessibility matrix in
[MOBILE.md](./MOBILE.md).
