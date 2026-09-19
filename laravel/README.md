# Inttegro + Laravel demo

**Kora Market** is a product-led Laravel storefront with an interactive finish
picker and accessible bag dialog. Laravel validates the customer and redirects
or returns the minimal Order reference needed by the selected Checkout presentation.

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan serve --port 3007
```

Open <http://localhost:3007>. Configure `INTTEGRO_DEMO_PRODUCT_ID` and
`INTTEGRO_DEMO_PRICE_ID` with the active Kora Market Product and Price. Laravel
resolves and validates both server-side; the storefront cannot submit its own
product or amount. Run `composer test` for the focused checks.

## Try the Checkout presentations

Open the bag and choose **Embedded**, **Modal**, or **Hosted page**. Embedded is
the default. Laravel returns a no-store finalized Order ID for embedded/modal
Checkout and a `303` to the exact Inttegro URL for the hosted choice or native
form fallback. The client boundary is in
[`public/checkout-presentations.js`](./public/checkout-presentations.js).

## Run with Docker

After configuring `.env` and setting `APP_KEY` to the output of
`php artisan key:generate --show`, run `docker compose up --build --wait`. Compose
starts the production image at <http://localhost:3007> and monitors
`GET /health`. Use `docker compose down` to stop it. Set both `APP_URL` and
`INTTEGRO_DEMO_PUBLIC_URL` to the exact HTTPS origin before exposing the
container publicly.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-laravel-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy on Railway](../assets/providers/railway-button.svg)](https://railway.com/new/template/p5qiP5?utm_medium=integration&utm_source=inttegro-demos&utm_campaign=laravel)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-laravel-v1.8.3)

Cloud Run, Railway, and Render build the released Dockerfile. The Railway template pins the
release commit and generates `APP_KEY` in the deployment, separate from the
Inttegro test API key. See
[`DEPLOYING.md`](../DEPLOYING.md).

## Understand the integration

Start with [`app/Services/CheckoutService.php`](./app/Services/CheckoutService.php)
for the Order payload and SDK boundary, then read
[`app/Http/Controllers/CheckoutController.php`](./app/Http/Controllers/CheckoutController.php)
for validation, correlation, and the JSON/303 handoff. The `INTTEGRO:*` comments map
choices and alternatives to the shared
[integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
