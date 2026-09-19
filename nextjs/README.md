# Inttegro + Next.js demo

**Kora Market** is a responsive App Router storefront for the Dawn Brew Set. It
combines product discovery, finish selection, an accessible bag dialog, and
three presentations of a server-owned Inttegro Checkout.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open <http://localhost:3000>. Keep `INTTEGRO_API_KEY` in the server environment;
do not prefix it with `NEXT_PUBLIC_`. Configure
`INTTEGRO_DEMO_PRODUCT_ID` and `INTTEGRO_DEMO_PRICE_ID` with an active Kora
Market Product and one of its active Prices. Checkout resolves both through the
Products API instead of trusting product or amount data from the browser.

The server also exposes `POST /mobile/orders` for the four mobile demos; set the
server-owned `INTTEGRO_DEMO_CUSTOMER_ID` before using that route. The mobile
request receives the same catalog-backed product and returns only the finalized
Order ID needed by the Inttegro SDK.

## Try the Checkout presentations

Open the bag and choose **Embedded**, **Modal**, or **Hosted page**. Embedded is
the demo default. Embedded and Modal request a no-store JSON representation
containing only the finalized Order ID; Hosted page—and browsers without
JavaScript—receive the same endpoint's `303` redirect. The presentation module
is [`public/checkout-presentations.js`](./public/checkout-presentations.js).

Run the checks with:

```bash
npm run check
```

## Run with Docker

After configuring `.env.local`, build and start the production image with one
command:

```bash
docker compose up --build --wait
```

The Compose service exposes <http://localhost:3000>, checks `GET /health`, and
passes the environment file only to the running container—not the image build.
Use `docker compose down` to stop it. A public deployment must replace
`INTTEGRO_DEMO_PUBLIC_URL` with its HTTPS origin.

## Deploy your own

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-nextjs-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy with Vercel](../assets/providers/vercel-button.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-nextjs-v1.8.3&project-name=inttegro-demo-nextjs&repository-name=inttegro-demo-nextjs&env=INTTEGRO_API_KEY%2CINTTEGRO_DEMO_PRODUCT_ID%2CINTTEGRO_DEMO_PRICE_ID%2CINTTEGRO_DEMO_CUSTOMER_ID%2CINTTEGRO_DEMO_PUBLIC_URL&envDescription=Add%20a%20dedicated%20Inttegro%20API%20key%2C%20active%20Product%20and%20Price%20IDs%2C%20demo%20Customer%20ID%2C%20and%20the%20public%20origin.&envLink=https%3A%2F%2Fstudio.inttegro.com%2Fkeys)

Vercel is the idiomatic target; Cloudflare uses the checked-in OpenNext adapter
to preserve the App Router and route handlers. Both flows clone an immutable
deployment ref derived from the tagged source and ask for your own test
credentials. Both buttons use the published `nextjs-v1.8.3` deployment ref. See
[`DEPLOYING.md`](../DEPLOYING.md) for the security contract and verification
status.

## Understand the integration

Start with [`lib/checkout.ts`](./lib/checkout.ts) for the hosted and native Order
requests, then read [`app/checkout/route.ts`](./app/checkout/route.ts) for the
JSON/303 response boundary and
[`app/mobile/orders/route.ts`](./app/mobile/orders/route.ts) for the mobile trust
boundary. Source comments link each consequential choice to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
