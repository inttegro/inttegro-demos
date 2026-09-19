# Inttegro + Go demo

**Ledgerline** is a polished client invoice portal built on idiomatic
`net/http`. Customers review service lines and settle INV-2048 through an
Inttegro Checkout whose Order is created entirely on the server.

```bash
cp .env.example .env
set -a && source .env && set +a
go mod download
go run .
```

Open <http://localhost:3003>. Configure `INTTEGRO_DEMO_PRODUCT_ID` and
`INTTEGRO_DEMO_PRICE_ID` with the active Ledgerline retainer Product and Price.
The service resolves and validates both before constructing the Order; the
invoice form cannot choose its own service or amount. Run `go test ./...` for
the focused checks.

## Try the Checkout presentations

The payment form offers **Embedded**, **Modal**, and **Hosted page**. Embedded
is the default. The first two negotiate a no-store JSON response containing
only the finalized Order ID; hosted and no-JavaScript submissions receive a
`303`. See [`static/checkout-presentations.js`](./static/checkout-presentations.js)
for the framework-neutral browser boundary.

## Run with Docker

After configuring `.env`, run `docker compose up --build --wait`. Compose
starts the distroless production image at <http://localhost:3003>. Use
`docker compose down` to stop it. Set `INTTEGRO_DEMO_PUBLIC_URL` to the exact
HTTPS origin before exposing the container publicly.

## Deploy your own

[![Deploy to Cloud Run](../assets/providers/cloud-run-button.svg)](https://deploy.cloud.run/?git_repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos.git&revision=deploy-go-v1.8.3)
[![Run with Docker](../assets/providers/docker-button.svg)](#run-with-docker)
[![Deploy on Railway](../assets/providers/railway-button.svg)](https://railway.com/new/template/ABT6ae?utm_medium=integration&utm_source=inttegro-demos&utm_campaign=go)
[![Deploy to Render](../assets/providers/render-button.svg)](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Finttegro%2Finttegro-demos%2Ftree%2Fdeploy-go-v1.8.3)

Cloud Run, Railway, and Render build a small distroless image from the released
multi-stage Dockerfile. The deployment links target immutable release refs. See
[`DEPLOYING.md`](../DEPLOYING.md).

## Understand the integration

[`main.go`](./main.go) keeps the complete integration deliberately visible:
input validation, Order construction, hosted URL selection, safe errors,
correlation, and the JSON/303 handoff. Its `INTTEGRO:*` comments map choices and
alternatives to the shared [integration guide](../INTEGRATION_GUIDE.md) and
[machine-readable decision registry](../integration-decisions.json).
