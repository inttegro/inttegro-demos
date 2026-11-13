# Demo origin edge

This Cloudflare Worker gives the container-hosted demos stable Inttegro origins
while their application runtimes evolve independently. It accepts only the five
listed first-party hostnames, forwards each request to its matching Cloudflare
Worker, preserves HTTPS proxy metadata, and rewrites an upstream-local redirect
back to the public origin.

Deploy from this directory with an authenticated Wrangler session:

```sh
npx wrangler@latest deploy
```

The services must set `INTTEGRO_DEMO_PUBLIC_URL` to their matching
`https://{framework}-demo.inttegro.dev` origin. Django must additionally trust
that origin through `DJANGO_CSRF_TRUSTED_ORIGINS`.
