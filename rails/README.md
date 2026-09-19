# Inttegro + Rails demo

**Kora Market** is a product-led Rails storefront with finish selection, an
accessible bag dialog, and truthful return states. Rails creates the physical
product order and keeps the Inttegro credential server-side.

```bash
bundle install
cp .env.example .env
set -a && source .env && set +a
bin/rails server --port 3006
```

Open <http://localhost:3006>. Configure `INTTEGRO_DEMO_PRODUCT_ID` and
`INTTEGRO_DEMO_PRICE_ID` with the active Kora Market Product and Price. Rails
resolves and validates both server-side; the storefront cannot submit its own
product or amount. Run `bin/rails test` for the focused checks.

## Try the Checkout presentations

Open the bag and choose **Embedded**, **Modal**, or **Hosted page**. Embedded is
the default. Rails returns a no-store finalized Order ID for embedded/modal
Checkout and a `303` to the Inttegro URL for hosted or no-JavaScript checkout.
The shared browser behavior is in
[`public/checkout-presentations.js`](./public/checkout-presentations.js).

## Run with Docker

After configuring `.env`, run `docker compose up --build --wait`. Compose
starts the production image at <http://localhost:3006> and monitors
`GET /health`. It defaults `RAILS_FORCE_SSL` to `false` only for this direct
localhost path. Behind a TLS-terminating proxy, set `RAILS_FORCE_SSL=true` and
`INTTEGRO_DEMO_PUBLIC_URL` to the exact HTTPS origin. Hosted production remains
secure by default. Use `docker compose down` to stop it.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-rails-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy on Railway](../assets/providers/railway-button.svg)](https://railway.com/new/template/CssQzr?utm_medium=integration&utm_source=inttegro-demos&utm_campaign=rails)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-rails-v1.8.3)

Cloud Run, Railway, and Render build the released Dockerfile with Puma. The Railway
template pins the release commit and generates the framework signing secret
separately from `INTTEGRO_API_KEY`. Railway uses process readiness for this
demo because Rails redirects the platform's internal HTTP health probe to
HTTPS; the public `GET /health` endpoint remains available over HTTPS. See
[`DEPLOYING.md`](../DEPLOYING.md).

## Understand the integration

Start with
[`app/services/checkout_service.rb`](./app/services/checkout_service.rb) for
Order creation and safe error mapping, then read
[`app/controllers/checkouts_controller.rb`](./app/controllers/checkouts_controller.rb)
for the JSON/303 handoff and correlation boundary. The `INTTEGRO:*` comments map
choices and alternatives to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
