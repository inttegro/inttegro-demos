# Inttegro React Native + Expo demo

**Kora Market** is a tactile Expo storefront with category browsing, original
product imagery, finish selection, maker context, and a persistent checkout
bar. It asks a backend for a finalized checkout order, initializes
`@inttegro/react-native`, and presents the native Inttegro payment sheet.

The app uses the native Checkout transport and subscribes to privacy-safe SDK
telemetry for the lifetime of the React component. Expo Go cannot load custom
native modules, so run it as an Expo development build.

## Install and check

```sh
cp .env.example .env
npm install
npm test
```

## Run

```sh
npm run ios
# or
npm run android
```

The configured demo backend must expose `POST /mobile/orders` and return
`{ "orderId": "or_..." }`. That backend owns the merchant API
key and constructs the fixed GHS 50.00 Dawn Brew Set order. A completed client
result still requires authoritative server-side payment verification.

## Deploy the companion backend

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-nextjs-v1.8.3)
[![Run backend with Docker](../assets/providers/docker-button.svg)](../nextjs/README.md#run-with-docker)
[![Deploy with Vercel](../assets/providers/vercel-button.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-nextjs-v1.8.3&project-name=inttegro-demo-nextjs&repository-name=inttegro-demo-nextjs&env=INTTEGRO_API_KEY%2CINTTEGRO_DEMO_PRODUCT_ID%2CINTTEGRO_DEMO_PRICE_ID%2CINTTEGRO_DEMO_CUSTOMER_ID%2CINTTEGRO_DEMO_PUBLIC_URL&envDescription=Add%20a%20dedicated%20Inttegro%20API%20key%2C%20active%20Product%20and%20Price%20IDs%2C%20demo%20Customer%20ID%2C%20and%20the%20public%20origin.&envLink=https%3A%2F%2Fstudio.inttegro.com%2Fkeys)

These buttons create the Next.js companion service in your own account. Put its
public origin in `INTTEGRO_DEMO_BACKEND_URL`; the native app never receives the
server-held Inttegro API key. The buttons use release `v1.8.3`.

## Understand the integration

Start with [`src/demoBackend.ts`](./src/demoBackend.ts) for the merchant-backend
trust boundary, then read [`App.tsx`](./App.tsx) for sheet initialization,
presentation, telemetry, and result semantics. The `INTTEGRO:*` comments map
choices and alternatives to the shared [integration guide](../INTEGRATION_GUIDE.md)
and [machine-readable decision registry](../integration-decisions.json).
