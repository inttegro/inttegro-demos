const origins = new Map([
  ['django-demo.inttegro.dev', 'https://inttegro-django-demo.true-sense-inc.workers.dev'],
  ['fastapi-demo.inttegro.dev', 'https://inttegro-fastapi-demo.true-sense-inc.workers.dev'],
  ['go-demo.inttegro.dev', 'https://inttegro-go-demo.true-sense-inc.workers.dev'],
  ['laravel-demo.inttegro.dev', 'https://inttegro-laravel-demo.true-sense-inc.workers.dev'],
  ['rails-demo.inttegro.dev', 'https://inttegro-rails-demo.true-sense-inc.workers.dev'],
])

export default {
  async fetch(request) {
    const publicUrl = new URL(request.url)
    const origin = origins.get(publicUrl.hostname)

    if (!origin) {
      return new Response('Unknown Inttegro demo host.', { status: 404 })
    }

    const upstreamUrl = new URL(publicUrl.pathname + publicUrl.search, origin)
    const headers = new Headers(request.headers)
    headers.set('X-Forwarded-Host', publicUrl.host)
    headers.set('X-Forwarded-Proto', 'https')

    // Rails compares Origin with the internal request host while validating its
    // authenticity token. Accept only the browser's exact public origin, then
    // translate that trusted value across the reverse-proxy boundary. Leave
    // every cross-origin value untouched so the application rejects it.
    if (headers.get('Origin') === publicUrl.origin) {
      headers.set('Origin', origin)
    }
    const referer = headers.get('Referer')
    if (referer?.startsWith(`${publicUrl.origin}/`)) {
      headers.set('Referer', referer.replace(publicUrl.origin, origin))
    }

    const upstreamResponse = await fetch(
      new Request(upstreamUrl, {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
      }),
    )

    const responseHeaders = new Headers(upstreamResponse.headers)
    const location = responseHeaders.get('Location')
    if (location && location.startsWith(origin)) {
      responseHeaders.set('Location', location.replace(origin, publicUrl.origin))
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    })
  },
}
