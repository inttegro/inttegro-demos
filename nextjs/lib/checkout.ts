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
 * INTTEGRO:FLOW This module is server-only. It validates an untrusted request,
 * creates a finalized Order, and returns either its hosted checkout URL (web)
 * or its ID (native payment sheet).
 * INTTEGRO:SECURITY [server-api-key] INTTEGRO_API_KEY and the demo Customer ID
 * must never move into a NEXT_PUBLIC_* variable, Client Component, or mobile
 * response. A browser or application bundle cannot keep a merchant secret.
 * INTTEGRO:DECISION [hosted-checkout] Web customers use the hosted invoice URL
 * returned by Inttegro, keeping payment entry and provider confirmation out of
 * the merchant application.
 * INTTEGRO:ALTERNATIVE [hosted-checkout] Direct API payment is appropriate only
 * when the merchant intends to own the larger payment state machine, recovery
 * UI, method-specific behavior, testing, and compliance analysis.
 * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
 * INTTEGRO:DOCS https://studio.inttegro.com/orders
 * INTTEGRO:DOCS https://studio.inttegro.com/keys
 * See ../../INTEGRATION_GUIDE.md and ../../integration-decisions.json for the complete
 * rationale and machine-readable alternatives.
 */

export type CheckoutInput = {
  name: string;
  email: string;
  phone: string;
  attemptId: string;
};

export type MobileCheckoutInput = {
  attemptId: string;
};

export type CatalogSelection = {
  type: Product['type'];
  name: string;
  about?: string;
  reference?: string;
  price: Amount;
};

type MobileCreateOrderRequest = CreateOrderRequest & {
  paymentMethodTypes: ['mobile_money'];
};

export class DemoError extends Error {
  readonly code: 'configuration_error' | 'validation_error' | 'api_error';

  constructor(
    code: 'configuration_error' | 'validation_error' | 'api_error',
    message: string,
  ) {
    super(message);
    this.code = code;
  }
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attemptPattern = /^[A-Za-z0-9_-]{8,100}$/;

function merchantOrderNumber(prefix: string, attemptId: string): string {
  return `${prefix}-${attemptId.replaceAll('_', '-').toUpperCase().slice(0, 48)}`;
}

export function parseCheckoutInput(form: FormData): CheckoutInput {
  const input = {
    name: String(form.get('name') ?? '').trim(),
    email: String(form.get('email') ?? '').trim(),
    phone: String(form.get('phone') ?? '').trim(),
    attemptId: String(form.get('attempt_id') ?? '').trim(),
  };

  if (!input.name || !input.phone || !emailPattern.test(input.email)) {
    throw new DemoError('validation_error', 'Enter a name, valid email, and phone number.');
  }
  if (!attemptPattern.test(input.attemptId)) {
    throw new DemoError('validation_error', 'Start a fresh checkout and try again.');
  }
  return input;
}

export function parseMobileCheckoutInput(value: unknown): MobileCheckoutInput {
  if (
    typeof value !== 'object'
    || value === null
    || Array.isArray(value)
    || Object.keys(value).some((key) => key !== 'attemptId')
    || !('attemptId' in value)
    || typeof value.attemptId !== 'string'
  ) {
    throw new DemoError('validation_error', 'Send a valid mobile checkout attempt ID.');
  }

  const attemptId = value.attemptId.trim();
  if (!attemptPattern.test(attemptId)) {
    throw new DemoError('validation_error', 'Start a fresh mobile checkout and try again.');
  }
  return { attemptId };
}

function configuredOrigin(requestOrigin: string): string {
  // INTTEGRO:SECURITY [configured-public-origin] A configured public origin is
  // safer in production. The request origin keeps localhost convenient, but it
  // is safe only when Host/forwarded headers come through a trusted proxy chain.
  // Inttegro return URLs must be absolute HTTP(S) URLs and must not already
  // contain order_id; Inttegro appends the created order ID on return.
  const value = process.env.INTTEGRO_DEMO_PUBLIC_URL?.trim() || requestOrigin;
  try {
    return new URL(value).origin;
  } catch {
    throw new DemoError('configuration_error', 'The demo public URL is invalid.');
  }
}

export function selectCatalogProduct(product: Product, priceId: string): CatalogSelection {
  // INTTEGRO:SECURITY [catalog-authority] The browser never submits product or
  // price data. The trusted server resolves both IDs and validates the selected
  // price against the Product returned by Inttegro before creating the Order.
  // This prevents a customer from changing the amount or swapping catalogue
  // records in an untrusted form or mobile request.
  if (!product.active) {
    throw new DemoError('configuration_error', 'The configured demo product is not active.');
  }
  const price = product.prices?.find((candidate) => candidate.id === priceId && candidate.active);
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

function configuredCatalogIds(): { productId: string; priceId: string } {
  const productId = process.env.INTTEGRO_DEMO_PRODUCT_ID?.trim() || '';
  const priceId = process.env.INTTEGRO_DEMO_PRICE_ID?.trim() || '';
  if (!/^prod_[A-Za-z0-9]+$/.test(productId) || !/^pr_[A-Za-z0-9]+$/.test(priceId)) {
    throw new DemoError(
      'configuration_error',
      'Set INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID on the server.',
    );
  }
  return { productId, priceId };
}

async function loadCatalogSelection(inttegro: InttegroClient): Promise<CatalogSelection> {
  const { productId, priceId } = configuredCatalogIds();
  // INTTEGRO:FLOW [catalog-lookup] Fetch the Product at checkout time so the
  // Order uses current server-authoritative catalogue data. High-volume apps
  // can cache this read briefly, but must define invalidation for product,
  // publication, and price changes instead of keeping an unbounded process cache.
  // https://studio.inttegro.com/products
  const product = await inttegro.products.lookup({ productId });
  return selectCatalogProduct(product, priceId);
}

export function buildOrderRequest(
  input: CheckoutInput,
  origin: string,
  product: CatalogSelection,
): CreateOrderRequest {
  return {
    // INTTEGRO:DECISION [stable-idempotency-key] One browser-rendered attempt ID
    // represents one logical order creation. Reuse it for retries. Production
    // systems should persist a key derived from a durable cart or invoice ID;
    // generating a fresh value on every retry defeats replay protection.
    // https://studio.inttegro.com/idempotency
    requestMeta: { idempotencyKey: `demo-${input.attemptId}` },

    // INTTEGRO:DECISION [merchant-order-number] Give the Order a recognizable,
    // merchant-owned reference instead of letting Inttegro fall back to its
    // generated or_ ID. This demo derives a retry-stable value from its validated
    // attempt ID. Production code should use the durable cart or sales-order
    // number already stored in the merchant system; never put customer PII here.
    number: merchantOrderNumber('KORA', input.attemptId),

    // INTTEGRO:DECISION [inline-customer] This is a guest checkout, so the
    // request carries customer_data. Account-based products should resolve a
    // stored Customer server-side and send customer_id instead—never both.
    customerData: {
      name: input.name,
      emailAddress: input.email,
      phoneNumber: input.phone,
    },

    // INTTEGRO:DECISION [finalize-on-create] The demo's lines and total are
    // already settled. finalize freezes the order and generates its invoice
    // formats in the same operation. If shipping, tax, approval, or inventory
    // can still change, create a draft, update it, then finalize explicitly.
    finalize: true,
    checkoutSettings: {
      redirectUrl: `${origin}/complete`,
      cancelUrl: `${origin}/cancel`,
    },
    lineItems: [
      {
        type: 'product',
        product: {
          // INTTEGRO:DECISION [catalog-snapshot] This cross-SDK demo first looks
          // up an Inttegro Product and its configured Price, then snapshots the
          // verified fields as an inline Order item. That keeps the example
          // portable across SDK releases whose typed order models do not yet all
          // expose the catalog-reference union.
          // INTTEGRO:ALTERNATIVE [catalog-snapshot] When your SDK exposes it,
          // send { product_id, price_id, quantity } instead. That is the most
          // compact catalogue-backed shape; never mix it with inline fields.
          ...product,
          quantity: 1,
        },
      },
    ],
  };
}

export function buildMobileOrderRequest(
  input: MobileCheckoutInput,
  customerId: string,
  product: CatalogSelection,
): MobileCreateOrderRequest {
  return {
    // INTTEGRO:DECISION [stable-idempotency-key] A retry of the same native
    // checkout intent must send the same attempt ID. In production, persist it
    // with the authenticated customer's cart.
    requestMeta: { idempotencyKey: `mobile-demo-${input.attemptId}` },

    // INTTEGRO:DECISION [merchant-order-number] This reference is generated by
    // the trusted backend and remains stable when the native app retries. A real
    // backend should use its persisted mobile cart/order number, not client PII
    // or a new timestamp generated for each request.
    number: merchantOrderNumber('KORA-MOBILE', input.attemptId),

    // INTTEGRO:SECURITY [server-customer-id] Customer ownership is resolved by
    // the trusted backend. Never let an untrusted app select an arbitrary
    // customer_id; derive it from the authenticated merchant principal.
    customerId,
    // INTTEGRO:DECISION [finalize-on-create] The mobile SDK needs the ID of an
    // immutable checkout-ready order, so this fixed cart finalizes immediately.
    finalize: true,
    // INTTEGRO:DECISION [mobile-backend-boundary] The backend constrains allowed
    // methods and commercial data. The app submits only an opaque attempt ID.
    paymentMethodTypes: ['mobile_money'],
    lineItems: [
      {
        type: 'product',
        product: {
          ...product,
          quantity: 1,
        },
      },
    ],
  };
}

export async function createHostedCheckout(input: CheckoutInput, requestOrigin: string) {
  // INTTEGRO:SECURITY [server-api-key] This function must remain on the server.
  // Use the deployment platform's secret manager in production and rotate the
  // key there; never serialize it into an error or response.
  const apiKey = process.env.INTTEGRO_API_KEY?.trim();
  if (!apiKey) {
    throw new DemoError('configuration_error', 'Set INTTEGRO_API_KEY on the server.');
  }

  const origin = configuredOrigin(requestOrigin);
  // INTTEGRO:ALTERNATIVE [server-api-key] A production service may construct and
  // inject one client at startup for fail-fast configuration, connection reuse,
  // and application-owned OpenTelemetry. Per-call construction is clearer here.
  // https://studio.inttegro.com/sdk-observability
  const inttegro = new InttegroClient({ apiKey });

  try {
    const product = await loadCatalogSelection(inttegro);
    const order = await inttegro.orders.create(buildOrderRequest(input, origin, product));

    // INTTEGRO:DECISION [returned-checkout-url] Use the response's URL. Building
    // a URL from order.id would depend on undocumented Inttegro routing details.
    const checkoutUrl = order.invoice?.format?.web?.url;
    if (!checkoutUrl) {
      throw new DemoError('api_error', 'Inttegro did not return a hosted checkout URL.');
    }
    return { checkoutUrl, orderId: order.id };
  } catch (error) {
    // INTTEGRO:SECURITY [safe-error-boundary] Public errors stay stable and
    // non-sensitive. Capture request IDs and safe error metadata in protected
    // server telemetry; never return raw upstream payloads or authorization data.
    if (error instanceof DemoError) throw error;
    if (error instanceof InttegroAPIError) {
      throw new DemoError('api_error', 'Inttegro rejected the checkout request.');
    }
    throw new DemoError('api_error', 'Checkout is temporarily unavailable.');
  }
}

export async function createMobileCheckout(input: MobileCheckoutInput) {
  // INTTEGRO:FLOW [mobile-backend-boundary] This is the illustrative merchant
  // backend for all four native demos. A production route also authenticates
  // the caller, authorizes the cart, rate-limits abuse, and recomputes totals.
  // https://studio.inttegro.com/orders
  const apiKey = process.env.INTTEGRO_API_KEY?.trim();
  const customerId = process.env.INTTEGRO_DEMO_CUSTOMER_ID?.trim();
  if (!apiKey || !customerId) {
    throw new DemoError(
      'configuration_error',
      'Set INTTEGRO_API_KEY and INTTEGRO_DEMO_CUSTOMER_ID on the server.',
    );
  }

  const inttegro = new InttegroClient({ apiKey });
  try {
    const product = await loadCatalogSelection(inttegro);
    const order = await inttegro.orders.create(buildMobileOrderRequest(input, customerId, product));
    if (!order.id?.trim()) {
      throw new DemoError('api_error', 'Inttegro did not return a checkout order ID.');
    }
    // Return only the minimal capability the SDK needs. Product, price,
    // customer_id, payment-method policy, and API key remain server-owned.
    return { orderId: order.id.trim() };
  } catch (error) {
    if (error instanceof DemoError) throw error;
    if (error instanceof InttegroAPIError) {
      throw new DemoError('api_error', 'Inttegro rejected the mobile checkout request.');
    }
    throw new DemoError('api_error', 'Mobile checkout is temporarily unavailable.');
  }
}
