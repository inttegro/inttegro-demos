import {
  InttegroAPIError,
  InttegroClient,
  type CreateOrderRequest,
  type Currency,
  type Product,
} from '@inttegro/inttegro-sdk';

/**
 * Inttegro integration map
 *
 * INTTEGRO:FLOW [hosted-checkout] A RedwoodSDK route validates the supporter,
 * resolves the campaign product from Inttegro on the Worker, creates and
 * finalizes an Order, and redirects to the returned hosted checkout URL.
 * INTTEGRO:SECURITY [server-api-key] The API key is a Cloudflare Worker secret.
 * It never enters a React component, public environment variable, or response.
 * INTTEGRO:ALTERNATIVE [hosted-checkout] Direct payments trade the hosted
 * handoff for greater payment-state, recovery, testing, and compliance work.
 * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
 * INTTEGRO:DOCS https://studio.inttegro.com/orders
 * INTTEGRO:DOCS https://studio.inttegro.com/keys
 */

const tiers = {
  seed: { selectedAmount: 5_000 },
  grower: { selectedAmount: 10_000 },
  steward: { selectedAmount: 25_000 },
} as const;

type Tier = keyof typeof tiers;

type CheckoutInput = {
  name: string;
  email: string;
  phone: string;
  tier: Tier;
  attemptId: string;
};

type CatalogSelection = {
  productId: string;
  priceId: string;
  currency: Currency;
};

export class DemoError extends Error {
  constructor(
    readonly code: 'configuration_error' | 'validation_error' | 'api_error',
    message: string,
  ) {
    super(message);
  }
}

export function parseCheckoutInput(values: FormData | Record<string, unknown>): CheckoutInput {
  const value = (key: string) => String(values instanceof FormData ? values.get(key) ?? '' : values[key] ?? '').trim();
  const input = {
    name: value('name'),
    email: value('email'),
    phone: value('phone'),
    tier: value('tier'),
    attemptId: value('attempt_id'),
  };
  if (
    input.name.length < 2 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
    !/^\+[1-9][0-9]{7,14}$/.test(input.phone) ||
    !(input.tier in tiers) ||
    !/^[A-Za-z0-9_-]{8,100}$/.test(input.attemptId)
  ) {
    throw new DemoError('validation_error', 'Choose a contribution and enter a valid name, email, and international phone number.');
  }
  return { ...input, tier: input.tier as Tier };
}

export function selectCatalogProduct(product: Product, priceId: string): CatalogSelection {
  // INTTEGRO:SECURITY [catalog-authority] Public input names a bounded tier,
  // never a price, amount, currency, or Product ID. The Worker owns and
  // validates those values before creating the Order.
  if (!product.active || product.type !== 'cause') {
    throw new DemoError('configuration_error', 'The configured campaign product must be an active cause.');
  }
  const price = product.prices?.find((candidate) => candidate.id === priceId && candidate.active);
  const tierAmounts = Object.values(tiers).map(({ selectedAmount }) => selectedAmount);
  if (
    !price
    || price.type !== 'customer_selected_amount'
    || price.customerSelectedAmount.currency.toLowerCase() !== 'ghs'
    || tierAmounts.some((amount) => amount < price.customerSelectedAmount.minimum)
    || (
      price.customerSelectedAmount.maximum !== undefined
      && tierAmounts.some((amount) => amount > price.customerSelectedAmount.maximum!)
    )
    || tierAmounts.some(
      (amount) => !price.customerSelectedAmount.suggestedAmounts?.some(
        (suggestion) => suggestion.value === amount,
      ),
    )
  ) {
    throw new DemoError('configuration_error', 'The campaign requires an active GHS customer-selected price with the visible suggestions.');
  }
  return {
    productId: product.id,
    priceId: price.id,
    currency: price.customerSelectedAmount.currency,
  };
}

export function buildOrderRequest(input: CheckoutInput, origin: string, product: CatalogSelection): CreateOrderRequest {
  return {
    requestMeta: { idempotencyKey: `demo-${input.attemptId}` },
    // INTTEGRO:DECISION [merchant-order-number] Use a readable, retry-stable
    // reference with no supporter PII; do not accept the generated or_ ID as a
    // human-facing campaign receipt number.
    number: `OPENFIELD-${input.attemptId.replaceAll('_', '-').toUpperCase().slice(0, 48)}`,
    customerData: { name: input.name, emailAddress: input.email, phoneNumber: input.phone },
    // INTTEGRO:DECISION [finalize-on-create] This is immediate flexible funding,
    // not a future Kickstarter-style pledge. Deferred capture needs a separate
    // authorization and campaign-close design.
    finalize: true,
    checkoutSettings: { redirectUrl: `${origin}/complete`, cancelUrl: `${origin}/cancel` },
    lineItems: [{
      type: 'product',
      product: {
        productId: product.productId,
        customerSelectedPrice: {
          priceId: product.priceId,
          selectedAmount: {
            currency: product.currency,
            value: tiers[input.tier].selectedAmount,
          },
        },
        quantity: 1,
      },
    }],
    customData: { campaign: 'riverbend-learning-garden', contributionTier: input.tier },
  };
}

function validOrigin(value: string): string {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid protocol');
    return parsed.origin;
  } catch {
    throw new DemoError('configuration_error', 'The demo public URL is invalid.');
  }
}

export async function createHostedCheckout(values: FormData | Record<string, unknown>, requestUrl: string, workerEnv: Cloudflare.Env) {
  const input = parseCheckoutInput(values);
  const apiKey = workerEnv.INTTEGRO_API_KEY?.trim();
  const productId = workerEnv.INTTEGRO_DEMO_PRODUCT_ID?.trim() ?? '';
  const priceId = workerEnv.INTTEGRO_DEMO_PRICE_ID?.trim() ?? '';
  if (!apiKey) throw new DemoError('configuration_error', 'Set INTTEGRO_API_KEY as a Worker secret.');
  if (!/^prod_[A-Za-z0-9]+$/.test(productId) || !/^pr_[A-Za-z0-9]+$/.test(priceId)) {
    throw new DemoError('configuration_error', 'Set the campaign Product and Price IDs as Worker secrets.');
  }
  const origin = validOrigin(workerEnv.INTTEGRO_DEMO_PUBLIC_URL?.trim() || new URL(requestUrl).origin);
  try {
    const client = new InttegroClient({ apiKey });
    const product = selectCatalogProduct(await client.products.lookup({ productId }), priceId);
    const order = await client.orders.create(buildOrderRequest(input, origin, product));
    const checkoutUrl = order.invoice?.format?.web?.url;
    if (!checkoutUrl) throw new DemoError('api_error', 'Inttegro did not return a hosted checkout URL.');
    return { orderId: order.id, checkoutUrl };
  } catch (error) {
    if (error instanceof DemoError) throw error;
    if (error instanceof InttegroAPIError) throw new DemoError('api_error', 'Inttegro rejected the contribution request.');
    throw new DemoError('api_error', 'Contributions are temporarily unavailable.');
  }
}
