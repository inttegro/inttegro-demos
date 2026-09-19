# Astro demo — Openfield

Openfield is a production-shaped community fundraiser rendered with Astro and
the Inttegro TypeScript SDK. Astro components deliver the content-heavy
Riverbend campaign, while a server endpoint validates the supporter, resolves
trusted catalogue data, and creates the finalized Order used by all three
Checkout presentations.

This is immediate flexible funding, not a delayed Kickstarter-style pledge.
The example neither promises tax deductibility nor treats the browser return as
evidence of payment.

## What it demonstrates

- Astro 7 server rendering with the official standalone Node adapter
- `.astro` components for the campaign, contribution form, and result states
- a framework-native `POST /checkout` server endpoint
- Astro's same-origin form protection and a bounded request-body limit
- server-side Product and Price lookup with `@inttegro/inttegro-sdk`
- a bounded tier translated to a trusted quantity rather than a public amount
- a retry-stable idempotency key and readable merchant Order number
- a no-store minimal Order reference for embedded or modal Checkout
- a resilient `303` hosted-page fallback that still works without JavaScript

The extensive `INTTEGRO:*` comments in
[`src/lib/checkout.ts`](./src/lib/checkout.ts) explain the commercial and trust
decisions. [`src/pages/checkout.ts`](./src/pages/checkout.ts) owns Astro's HTTP
boundary, safe errors, cookie correlation, and response negotiation.

## Try the Checkout presentations

Choose a contribution tier, then choose **Embedded**, **Modal**, or **Hosted page**.
Embedded is the default. Embedded and modal receive only a no-store finalized
Order ID; hosted and no-JavaScript submissions receive a `303` to the URL
returned by Inttegro. All three create the same server-authoritative Order.

## Configure the campaign Product

Create and publish a Product named `Riverbend Learning Garden contribution`
with an active Price of exactly **GHS 50**. The three visible tiers multiply
that trusted unit price by 1, 2, or 5 on the server. A public request cannot
choose an arbitrary amount, Product, Price, or currency.

Copy `.env.example` to `.env` and set:

```dotenv
INTTEGRO_API_KEY=sk_test_replace_me
INTTEGRO_DEMO_PRODUCT_ID=prod_replace_me
INTTEGRO_DEMO_PRICE_ID=pr_replace_me
INTTEGRO_DEMO_PUBLIC_URL=http://localhost:3014
```

`INTTEGRO_API_KEY` must remain a server secret. The public URL must be the exact
origin that receives `/complete` and `/cancel`; production applications should
allow-list it rather than infer it from arbitrary proxy headers.

## Run locally

```sh
npm install
npm run dev
```

Open <http://localhost:3014>. Run `npm run check` for Astro diagnostics, the
checkout contract tests, and a production server build.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-astro-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-astro-v1.8.3)

Cloud Run and Render start from the immutable 1.8.3 deployment branch. The
checked-in Railway configuration is used by Inttegro's live deployment, but a
public one-click Railway template is not published yet.

### Run with Docker

```sh
docker compose up --build --wait
```

The container exposes `GET /health`. Use `docker compose down` when finished.

## Production boundaries

Openfield shows the checkout handoff, not a complete crowdfunding ledger. A
real platform should persist its contribution attempt and idempotency key,
verify payment through authenticated server state, reconcile missed results,
update campaign totals transactionally, and issue receipts from that durable
state. Keep Astro's same-origin form check enabled; add session-bound CSRF where
the surrounding account model requires it, plus rate limits and abuse controls
before accepting public traffic. Never increment a total because a browser
visited `/complete`.

See the repository-level [`INTEGRATION_GUIDE.md`](../INTEGRATION_GUIDE.md) and
[`integration-decisions.json`](../integration-decisions.json) for the shared
decision model.
