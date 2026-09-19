# Inttegro Flutter demo

**Kora Market** is a Material 3 storefront with a collapsing product hero,
category and finish selection, fulfillment context, and a persistent checkout
bar. It asks a backend for a finalized checkout order, initializes
`inttegro_flutter`, and presents the native Inttegro payment sheet.

The app uses the native Checkout transport and keeps a privacy-safe telemetry
subscription for the lifetime of the product screen. The repository keeps the
generated platform shells out of source control, so create them locally before
the first device run.

## Create platform shells, install, and check

This repository keeps generated Flutter platform shells out of the demo. Create
them once with your installed Flutter SDK:

```sh
flutter create --platforms=android,ios --project-name inttegro_demo_flutter .
flutter pub get
flutter analyze
flutter test
```

## Run

```sh
flutter run \
  --dart-define=INTTEGRO_DEMO_BACKEND_URL=http://localhost:3000
```

The backend must expose `POST /mobile/orders` and return
`{ "orderId": "or_..." }`. It owns `INTTEGRO_API_KEY` and builds the
fixed GHS 50.00 Dawn Brew Set order. A completed client result still requires
authoritative server-side verification.

## Deploy the companion backend

[![Deploy to Cloudflare](../assets/providers/cloudflare-button.svg)](https://deploy.workers.cloudflare.com/?url=https://github.com/inttegro/inttegro-demos/tree/deploy-nextjs-v1.8.3)
[![Run backend with Docker](../assets/providers/docker-button.svg)](../nextjs/README.md#run-with-docker)
[![Deploy with Vercel](../assets/providers/vercel-button.svg)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-nextjs-v1.8.3&project-name=inttegro-demo-nextjs&repository-name=inttegro-demo-nextjs&env=INTTEGRO_API_KEY%2CINTTEGRO_DEMO_PRODUCT_ID%2CINTTEGRO_DEMO_PRICE_ID%2CINTTEGRO_DEMO_CUSTOMER_ID%2CINTTEGRO_DEMO_PUBLIC_URL&envDescription=Add%20a%20dedicated%20Inttegro%20API%20key%2C%20active%20Product%20and%20Price%20IDs%2C%20demo%20Customer%20ID%2C%20and%20the%20public%20origin.&envLink=https%3A%2F%2Fstudio.inttegro.com%2Fkeys)

These buttons create the Next.js companion service in your own account. Put its
public origin in `INTTEGRO_DEMO_BACKEND_URL`; the native app never receives the
server-held Inttegro API key. The buttons use release `v1.8.3`.

## Understand the integration

Start with [`lib/demo_backend.dart`](./lib/demo_backend.dart) for the
merchant-backend trust boundary, then read [`lib/main.dart`](./lib/main.dart)
for sheet initialization, presentation, telemetry, and result semantics. The
`INTTEGRO:*` comments map choices and alternatives to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
