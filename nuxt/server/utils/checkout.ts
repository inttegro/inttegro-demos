import {
  InttegroAPIError,
  InttegroClient,
  type Amount,
  type CreateOrderRequest,
  type Product,
} from '@inttegro/inttegro-sdk';

/**
 * Inttegro integration map
 *
 * INTTEGRO:FLOW [hosted-checkout] This Nitro server utility validates an
 * untrusted form, creates a finalized Order, and returns the hosted invoice URL
 * that the route will redirect to.
 * INTTEGRO:SECURITY [server-api-key] Runtime config must keep the key private;
 * never place it under runtimeConfig.public or a NUXT_PUBLIC_* variable.
 * INTTEGRO:ALTERNATIVE [hosted-checkout] A direct API payment flow is possible,
 * but the merchant then owns additional payment states, recovery UI,
 * method-specific behavior, testing, and compliance analysis.
 * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
 * INTTEGRO:DOCS https://studio.inttegro.com/orders
 * INTTEGRO:DOCS https://studio.inttegro.com/keys
 * See ../../../INTEGRATION_GUIDE.md and ../../../integration-decisions.json for the shared
 * rationale and machine-readable alternatives.
 */

export class DemoError extends Error {
  constructor(readonly code: 'configuration_error' | 'validation_error' | 'api_error', message: string) { super(message); }
}

export type CheckoutInput = { name: string; email: string; phone: string; attemptId: string };

export type CatalogSelection = {
  type: Product['type'];
  name: string;
  about?: string;
  reference?: string;
  price: Amount;
};

function merchantOrderNumber(prefix: string, attemptId: string): string {
  return `${prefix}-${attemptId.replaceAll('_', '-').toUpperCase().slice(0, 48)}`;
}

export function parseCheckoutInput(body: Record<string, unknown>): CheckoutInput {
  const input = { name: String(body.name ?? '').trim(), email: String(body.email ?? '').trim(), phone: String(body.phone ?? '').trim(), attemptId: String(body.attempt_id ?? '').trim() };
  if (!input.name || !input.phone || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new DemoError('validation_error', 'Enter a name, valid email, and phone number.');
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.attemptId)) throw new DemoError('validation_error', 'Start a fresh checkout and try again.');
  return input;
}

export function selectCatalogProduct(product: Product, priceId: string): CatalogSelection {
  // INTTEGRO:SECURITY [catalog-authority] Resolve the Product and Price on this
  // trusted Nitro server. The browser sends neither identifier nor amount, so
  // it cannot swap catalogue records or tamper with the price.
  if (!product.active) throw new DemoError('configuration_error', 'The configured demo product is not active.');
  const price = product.prices?.find(candidate => candidate.id === priceId && candidate.active);
  const fixedAmount = price && 'fixedAmount' in price ? price.fixedAmount : undefined;
  if (
    !price
    || !('type' in price)
    || price.type !== 'fixed_amount'
    || !fixedAmount
    || !Number.isSafeInteger(fixedAmount.value)
    || fixedAmount.value <= 0
  ) {
    throw new DemoError('configuration_error', 'The configured demo price is not active for this product.');
  }
  return {
    type: product.type,
    name: product.name,
    ...(product.about ? { about: product.about } : {}),
    ...(product.reference ? { reference: product.reference } : {}),
    price: fixedAmount,
  };
}

export function buildOrderRequest(input: CheckoutInput, origin: string, product: CatalogSelection): CreateOrderRequest {
  return {
    // INTTEGRO:DECISION [stable-idempotency-key] Reuse this key when retrying the
    // same logical checkout. Production systems should persist a cart- or
    // invoice-derived key; a fresh random key per network retry permits duplicates.
    // https://studio.inttegro.com/idempotency
    requestMeta: { idempotencyKey: `demo-${input.attemptId}` },
    // INTTEGRO:DECISION [merchant-order-number] Supply a recognizable merchant
    // reference rather than accepting Inttegro's generated or_ ID fallback. The
    // demo derives it from the validated attempt so replayed requests agree.
    // Production systems should use a persisted cart/order number without PII.
    number: merchantOrderNumber('KORA', input.attemptId),
    // INTTEGRO:DECISION [inline-customer] customer_data fits this guest flow.
    // Account-based products should resolve customer_id on the server; the
    // Orders API accepts exactly one of these representations.
    customerData: { name: input.name, emailAddress: input.email, phoneNumber: input.phone },
    // INTTEGRO:DECISION [finalize-on-create] This fixed cart is complete, so one
    // call freezes the order and creates invoice formats. If shipping, tax,
    // inventory, or approval is pending, create a draft and finalize later.
    finalize: true,
    checkoutSettings: { redirectUrl: `${origin}/complete`, cancelUrl: `${origin}/cancel` },
    lineItems: [{
      type: 'product',
      product: {
        // INTTEGRO:DECISION [catalog-snapshot] The service looks up the configured
        // Inttegro Product and Price, validates their relationship, and snapshots
        // that authoritative data into the Order. This works across SDK versions.
        // INTTEGRO:ALTERNATIVE [catalog-snapshot] SDKs that expose the typed
        // catalogue union can instead send product_id + price_id + quantity.
        // Never mix that reference shape with these inline product fields.
        ...product,
        quantity: 1,
      },
    }],
  };
}

export async function createHostedCheckout(
  input: CheckoutInput,
  apiKey: string,
  origin: string,
  productId: string,
  priceId: string,
) {
  // INTTEGRO:SECURITY [server-api-key] The SDK call belongs in Nitro server
  // code. Use a deployment secret manager in production, not source or public
  // runtime configuration.
  if (!apiKey.trim()) throw new DemoError('configuration_error', 'Set NUXT_INTTEGRO_API_KEY on the server.');
  if (!/^prod_[A-Za-z0-9]+$/.test(productId) || !/^pr_[A-Za-z0-9]+$/.test(priceId)) {
    throw new DemoError('configuration_error', 'Set NUXT_DEMO_PRODUCT_ID and NUXT_DEMO_PRICE_ID on the server.');
  }
  let publicOrigin: string;
  // INTTEGRO:SECURITY [configured-public-origin] Prefer an allow-listed origin
  // in production. A request-derived fallback is safe only behind a precisely
  // configured trusted proxy chain. Return URLs must be absolute HTTP(S) URLs.
  try { publicOrigin = new URL(origin).origin; } catch { throw new DemoError('configuration_error', 'The demo public URL is invalid.'); }
  try {
    // INTTEGRO:ALTERNATIVE [server-api-key] Long-running apps may inject one SDK
    // client configured at startup for connection reuse and application-owned
    // OpenTelemetry. Per-operation construction keeps this demo focused.
    // https://studio.inttegro.com/sdk-observability
    const client = new InttegroClient({ apiKey });
    // INTTEGRO:FLOW [catalog-lookup] Fetch at checkout time so publication and
    // price changes are observed. A high-volume app may use a short bounded cache
    // with explicit invalidation rather than an unbounded process-lifetime cache.
    // https://studio.inttegro.com/products
    const product = selectCatalogProduct(await client.products.lookup({ productId }), priceId);
    const order = await client.orders.create(buildOrderRequest(input, publicOrigin, product));
    // INTTEGRO:DECISION [returned-checkout-url] Use the URL in the response;
    // constructing one from order.id relies on undocumented routing details.
    const checkoutUrl = order.invoice?.format?.web?.url;
    if (!checkoutUrl) throw new DemoError('api_error', 'Inttegro did not return a hosted checkout URL.');
    return { checkoutUrl, orderId: order.id };
  } catch (error) {
    // INTTEGRO:SECURITY [safe-error-boundary] Never expose raw SDK payloads,
    // authorization data, or stack traces. Keep request IDs and safe diagnostics
    // in access-controlled server telemetry.
    if (error instanceof DemoError) throw error;
    if (error instanceof InttegroAPIError) throw new DemoError('api_error', 'Inttegro rejected the checkout request.');
    throw new DemoError('api_error', 'Checkout is temporarily unavailable.');
  }
}
