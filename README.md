# Inttegro checkout demos

[![release](https://img.shields.io/github/v/release/inttegro/inttegro-demos?label=release)](https://github.com/inttegro/inttegro-demos/releases/latest)
[![live catalogue](https://img.shields.io/website?url=https%3A%2F%2Fdemos.inttegro.dev&label=live%20catalogue)](https://demos.inttegro.dev)
[![license](https://img.shields.io/github/license/inttegro/inttegro-demos)](./LICENSE)

See Inttegro integrations running inside complete stores, ticketing flows,
invoices, fundraisers, and native mobile experiences—not isolated API snippets.

[Explore the live catalogue](https://demos.inttegro.dev) ·
[Start with the TypeScript SDK](https://github.com/inttegro/inttegro-sdk-typescript) ·
[Read the integration guides](https://studio.inttegro.com/sdks/typescript)

## Choose a working example

The live applications below are deployed from this repository. Start with
Next.js for the shortest route from clone to checkout, or choose the stack your
service already uses.

| Stack | Customer story | Live application | Source |
| --- | --- | --- | --- |
| **Next.js + TypeScript** | Kora Market storefront | [Try checkout](https://nextjs-demo.inttegro.dev) | [Open source](./nextjs) |
| Express + TypeScript | Afterglow Sessions tickets | [Reserve a ticket](https://express-demo.inttegro.dev) | [Open source](./express) |
| Nuxt + TypeScript | Kora Market storefront | [Try checkout](https://nuxt-demo.inttegro.dev) | [Open source](./nuxt) |
| NestJS + TypeScript | Openfield fundraiser | [Make a contribution](https://nestjs-demo.inttegro.dev) | [Open source](./nestjs) |
| RedwoodSDK + TypeScript | Openfield fundraiser | [Make a contribution](https://redwoodsdk-demo.inttegro.dev) | [Open source](./redwoodsdk) |
| Astro + TypeScript | Openfield fundraiser | [Make a contribution](https://astro-demo.inttegro.dev) | [Open source](./astro) |
| Django + Python | Afterglow Sessions tickets | [Reserve a ticket](https://django-demo.inttegro.dev) | [Open source](./django) |
| FastAPI + Python | Afterglow Sessions tickets | [Reserve a ticket](https://fastapi-demo.inttegro.dev) | [Open source](./fastapi) |
| Go | Ledgerline invoice | [Pay an invoice](https://go-demo.inttegro.dev) | [Open source](./go) |
| Rails + Ruby | Kora Market storefront | [Try checkout](https://rails-demo.inttegro.dev) | [Open source](./rails) |
| Laravel + PHP | Kora Market storefront | [Try checkout](https://laravel-demo.inttegro.dev) | [Open source](./laravel) |

Every story uses the same production-minded security boundary: secret keys stay
on the server, prices are resolved from the trusted Inttegro catalogue, and the
browser return is never treated as authoritative payment proof. The applications
remain individually cloneable even though they share fixtures, artwork, and
contract checks in this repository.

If these examples shorten your integration, [star the repository](https://github.com/inttegro/inttegro-demos) so other developers can find them.

## Product stories

| Story | Demos | Customer journey |
| --- | --- | --- |
| **Kora Market** | Next.js, Nuxt, Rails, Laravel | Discover the Dawn Brew Set, choose a finish, review the bag, and choose embedded, modal, or hosted-page Checkout. |
| **Afterglow Sessions** | Express, Django, FastAPI | Explore an intimate live lineup, review venue details, and reserve a courtyard ticket. |
| **Ledgerline** | Go, Spring Boot | Review a client invoice, inspect its service lines, and settle the balance securely. |
| **Kora Market mobile** | SwiftUI, Compose, Flutter, React Native | Browse a native product detail experience and present the Inttegro payment sheet. |
| **Openfield** | NestJS, RedwoodSDK, Astro | Choose a trusted contribution tier, support a community learning garden, and compare all three web Checkout presentations. |

Original product and event artwork is generated for this repository and stored
locally under [`assets/`](./assets); demos do not depend on third-party image
hosts or runtime font services.

## Current release

The current release is **1.8.3**. Use
[`releases/v1.8.3.json`](./releases/v1.8.3.json) to resolve each demo to its
immutable Git tag and integration entry points. Studio and external
documentation must link through those tags rather than `main`; see
[RELEASING.md](./RELEASING.md) for the versioning, permalink, signature, and
correction policy.

### V1

| Demo | SDK | Status |
| --- | --- | --- |
| Next.js + TypeScript | TypeScript | Implemented and verified |
| Express + TypeScript | TypeScript | Implemented and verified |
| Vue + Nuxt | TypeScript | Implemented and verified |
| Go | Go | Implemented and verified |
| Django + Python | Python | Implemented and verified |
| FastAPI + Python | Python | Implemented and verified |
| Rails + Ruby | Ruby | Implemented and verified |
| Laravel + PHP | PHP | Implemented and verified |
| Spring Boot + Java | Java | Implemented; SDK publication gated |
| iOS + SwiftUI | Inttegro SDK | Implemented with native Checkout transport |
| Android + Jetpack Compose | Inttegro SDK | Implemented with native Checkout transport |
| Flutter | Inttegro Flutter | Implemented; generated platform shells stay local |
| React Native + Expo | Inttegro React Native | Implemented as an Expo development build |

### V2

NestJS, RedwoodSDK, and Astro are included in **1.8.3**. They share the Openfield
fundraiser story while preserving each framework's native runtime model:
NestJS is a portable Node service; RedwoodSDK is a Cloudflare-native Worker
application; and Astro uses components, server endpoints, and the standalone
Node adapter. ASP.NET Core, React + Vite, Angular, and SvelteKit remain planned.

## Shared journey

Each implemented demo:

1. Places payment inside a complete storefront, ticketing, invoice, or mobile
   commerce journey.
2. Collects only the customer and order data required by that journey.
3. Creates and finalizes an order through an official Inttegro SDK.
4. Supplies explicit completion and cancellation URLs.
5. Lets the payer use the same Inttegro-hosted Checkout inline, in an app-owned
   modal, or on the hosted invoice page. The native form falls back to a `303`
   redirect when JavaScript is unavailable.
6. Explains that the browser return is not authoritative fulfillment evidence.
7. Handles configuration, validation, and Inttegro API failures without leaking
   credentials or raw internal errors.

See [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) for the rationale,
trade-offs, production alternatives, and links to canonical Inttegro
documentation. Its companion
[`integration-decisions.json`](./integration-decisions.json) exposes the same
decision model to documentation tools and machine readers. Source comments use
stable `INTTEGRO:*` markers and decision IDs from that registry.

See [CONTRACT.md](./CONTRACT.md) for the normative acceptance contract and
[MOBILE.md](./MOBILE.md) for the mobile backend boundary and device checks.

## Deploy your own

[![Run with Docker](./assets/providers/docker-button.svg)](./DEPLOYING.md#docker-and-compose)

The suite includes a public-facing catalogue, checked-in provider manifests,
and a machine-readable deployment matrix. Start with
[`DEPLOYING.md`](./DEPLOYING.md) for the reader experience, environment
contract, provider trade-offs, immutable deployment refs, and verification
gates. [`deployments.json`](./deployments.json) is the source of truth consumed
by tools and the generated catalogue.

The public URLs are `demos.inttegro.dev` and
`{framework}-demo.inttegro.dev`. The domain is active on Cloudflare. Reader
deployment manifests remain host-neutral; Inttegro-owned custom-domain bindings
are attached during release operations so a cloned demo never targets an
Inttegro hostname. All application code also works on localhost and
provider-assigned preview origins.

For local or self-hosted containers, each currently runnable server demo has a
`compose.yaml`. Configure its environment file, then run
`docker compose up --build --wait` from that demo's directory. See the Docker
section in [`DEPLOYING.md`](./DEPLOYING.md) for health checks, native app
backends, and the Spring Boot SDK publication gate.

## Configuration

Server demos use these environment variables:

```dotenv
INTTEGRO_API_KEY=sk_test_replace_me
INTTEGRO_DEMO_PRODUCT_ID=prod_replace_me
INTTEGRO_DEMO_PRICE_ID=pr_replace_me
INTTEGRO_DEMO_CUSTOMER_ID=cu_replace_me
INTTEGRO_DEMO_PUBLIC_URL=http://localhost:3000
```

`INTTEGRO_API_KEY` must never be exposed to browser or mobile code.
`INTTEGRO_DEMO_PRODUCT_ID` and `INTTEGRO_DEMO_PRICE_ID` select the catalog item
that the trusted server looks up and validates at checkout; public requests do
not supply product identity or amount.
`INTTEGRO_DEMO_CUSTOMER_ID` is used only by the Next.js mobile-order route and
must also remain server-side.
`INTTEGRO_DEMO_PUBLIC_URL` is the externally reachable origin used for checkout
completion and cancellation URLs. Each demo documents its own default port.

## Supporting assets

The cURL examples, Postman collection, shared fixtures, and automated contract
checks are supporting assets rather than separate demo applications.

Run the dependency-free suite check from this repository's root:

```sh
node scripts/check.mjs
```
