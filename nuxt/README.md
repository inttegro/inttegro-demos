# Inttegro + Vue/Nuxt demo

**Kora Market** is a responsive Vue storefront with an interactive product
finish picker and accessible bag dialog. A Nitro server route creates the
Inttegro order; no secret is exposed through public runtime configuration.

```bash
cp .env.example .env
npm install
npm run dev
```

Open <http://localhost:3002>. Configure `NUXT_DEMO_PRODUCT_ID` and
`NUXT_DEMO_PRICE_ID` with an active Kora Market Product and one of its active
Prices. The Nitro route resolves both server-side, verifies their relationship,
and never accepts product or amount data from the browser. Run `npm run check`
for type checking and tests.

## Try the Checkout presentations

Open the bag and choose **Embedded**, **Modal**, or **Hosted page**. Embedded is
the default. The Nitro route returns a no-store `{ orderId }` representation to
the first two and a `303` redirect to the hosted choice or native form fallback.
The browser lifecycle is visible in
[`public/checkout-presentations.js`](./public/checkout-presentations.js).

## Run with Docker

After configuring `.env`, build and start the production image with one
command:

```bash
docker compose up --build --wait
```

The Compose service exposes <http://localhost:3002>, checks `GET /health`, and
passes the environment file only to the running container—not the image build.
Use `docker compose down` to stop it. A public deployment must replace
`NUXT_DEMO_PUBLIC_URL` with its HTTPS origin.

## Deploy your own

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-nuxt-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy with Vercel](../assets/providers/vercel-button.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-nuxt-v1.8.3&project-name=inttegro-demo-nuxt&repository-name=inttegro-demo-nuxt&env=NUXT_INTTEGRO_API_KEY%2CNUXT_DEMO_PRODUCT_ID%2CNUXT_DEMO_PRICE_ID%2CNUXT_DEMO_PUBLIC_URL&envDescription=Add%20a%20dedicated%20Inttegro%20API%20key%2C%20active%20Product%20and%20Price%20IDs%2C%20and%20the%20public%20origin.&envLink=https%3A%2F%2Fstudio.inttegro.com%2Fkeys)

Cloudflare is the recommended target and builds through Nitro's Cloudflare
preset. Its Worker configuration keeps Nitro's generated Node shims in charge
instead of layering Cloudflare's runtime shims over them; this avoids a startup
conflict around `node:buffer`. Vercel keeps Nuxt's provider-aware production
build. Both buttons use an immutable deployment ref derived from
the published `nuxt-v1.8.3` deployment ref. See
[`DEPLOYING.md`](../DEPLOYING.md) for readiness
and trade-offs.

## Understand the integration

Start with [`server/utils/checkout.ts`](./server/utils/checkout.ts) for Order
construction and error mapping, then read
[`server/routes/checkout.post.ts`](./server/routes/checkout.post.ts) for cookie
correlation and the JSON/303 response boundary. The `INTTEGRO:*` comments map choices and
alternatives to the shared [integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
