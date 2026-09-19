# Inttegro + Express demo

**Afterglow Sessions** is a cinematic event page with lineup, venue, and ticket
reservation states. Express validates the guest details and creates one
finalized ticket Order for all three Inttegro Checkout presentations.

```bash
cp .env.example .env
npm install
set -a && source .env && set +a
npm run dev
```

Open <http://localhost:3001>. Configure `INTTEGRO_DEMO_PRODUCT_ID` and
`INTTEGRO_DEMO_PRICE_ID` with the active Afterglow admission Product and Price.
Express resolves and validates both on the server; the reservation form cannot
choose its own ticket or amount. Run `npm run check` to compile and execute the
focused unit tests.

## Try the Checkout presentations

The reservation form offers **Embedded**, **Modal**, and **Hosted page**.
Embedded is the default. The first two fetch only a no-store finalized Order ID;
the hosted choice and no-JavaScript fallback follow a server `303`. Read
[`public/checkout-presentations.js`](./public/checkout-presentations.js) for the
progressive enhancement and controller lifecycle.

## Run with Docker

After configuring `.env`, run `docker compose up --build --wait`. Compose
starts the production image at <http://localhost:3001> and monitors
`GET /health`. Use
`docker compose down` to stop it. Set `INTTEGRO_DEMO_PUBLIC_URL` to the exact
HTTPS origin before exposing the container publicly.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-express-v1.8.3)
[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-express-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy on Railway](../assets/providers/railway-button.svg)](https://railway.com/new/template/MJF7nD?utm_medium=integration&utm_source=inttegro-demos&utm_campaign=express)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-express-v1.8.3)

Cloudflare uses a separate Node HTTP adapter entry point; the ordinary Express
application and Inttegro integration remain unchanged. Cloud Run, Railway, and
Render build the released Dockerfile. The deployment links target immutable
release branches. See [`DEPLOYING.md`](../DEPLOYING.md).

## Understand the integration

Start with [`src/checkout.ts`](./src/checkout.ts) for the finalized ticket Order
and hosted URL, then read [`src/app.ts`](./src/app.ts) for the JSON/303 handoff and
verification boundary. `src/server.ts` and `src/worker.ts` are intentionally
thin, provider-specific transport entry points. The `INTTEGRO:*` comments map
choices and alternatives to the shared [integration guide](../INTEGRATION_GUIDE.md)
and [machine-readable decision registry](../integration-decisions.json).
