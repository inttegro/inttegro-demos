# RedwoodSDK demo — Openfield

Openfield is a server-first React fundraiser running on Cloudflare with
RedwoodSDK and the Inttegro TypeScript SDK. The Riverbend campaign is rendered
as a React Server Component; a Worker route validates each contribution,
resolves its catalogue price, creates an Order, and redirects to
the selected Inttegro-hosted Checkout presentation.

This demo targets current **RedwoodSDK**, not the legacy RedwoodGraphQL stack.
RedwoodSDK intentionally runs on Cloudflare's workerd runtime, so unsupported
general-purpose hosts are not presented as equivalent deployment options.

## What it demonstrates

- React Server Components rendered and streamed by RedwoodSDK
- Web-standard `Request`, `Response`, `FormData`, and URL handling
- an Inttegro API key held only as a Cloudflare Worker secret
- trusted Product and Price lookup inside the Worker
- bounded supporter tiers mapped to server-owned quantities
- retry-safe idempotency and a readable `OPENFIELD-…` order number
- a minimal JSON Order reference for embedded/modal Checkout and a resilient
  `303` hosted-page fallback
- safe completion, cancellation, configuration, and validation states

Start with [`src/checkout.ts`](./src/checkout.ts), then follow the route boundary
in [`src/worker.tsx`](./src/worker.tsx). `INTTEGRO:*` comments link integration
choices to the relevant Inttegro documentation and explain alternatives.

## Try the Checkout presentations

Choose a contribution tier, then choose **Embedded**, **Modal**, or **Hosted page**.
Embedded is the default. The Worker returns only a no-store finalized
Order ID for the first two and a `303` hosted-page redirect for the third or a
browser without JavaScript. The shared client boundary is
[`public/checkout-presentations.js`](./public/checkout-presentations.js).

## Configure the campaign Product

Create and publish a service Product named `Riverbend Learning Garden
contribution` with an active Price of exactly **GHS 50**. The visible GHS 50,
100, and 250 tiers are trusted quantities of that catalogue unit. The form
never submits a Product ID, currency, price, or arbitrary quantity.

For local development, copy `.env.example` to `.dev.vars` and provide:

```dotenv
INTTEGRO_API_KEY=sk_test_replace_me
INTTEGRO_DEMO_PRODUCT_ID=prod_replace_me
INTTEGRO_DEMO_PRICE_ID=pr_replace_me
INTTEGRO_DEMO_PUBLIC_URL=http://localhost:5173
```

For a deployed Worker, store the first three values as encrypted secrets. The
public URL may be a plain binding, but must be the exact deployment origin.

## Run locally

```sh
npm install
npm run dev
```

Run `npm run check` to regenerate binding types, type-check, test the checkout
contract, and create a production Worker build.

## Deploy your own

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-redwoodsdk-v1.8.3)

RedwoodSDK is Cloudflare-native. The button starts from the immutable 1.8.3
deployment branch. Cloudflare asks the reader for the required bindings without
placing credentials in Git.

## Production boundaries

Openfield demonstrates immediate flexible funding. It does not implement
future pledge capture, all-or-nothing campaign settlement, escrow, organizer
payouts, tax-deductible receipts, or regulatory onboarding. A production
service must persist contribution state, consume authenticated server events,
reconcile missed events, and change campaign totals only from verified payment
state. It must also add CSRF or strict origin protection, rate limits, and abuse
controls. The `/complete` browser return is intentionally non-authoritative.

See [`INTEGRATION_GUIDE.md`](../INTEGRATION_GUIDE.md) and
[`integration-decisions.json`](../integration-decisions.json) for the complete
portable integration model.
