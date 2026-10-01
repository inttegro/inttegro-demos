import { InttegroClient } from '@inttegro/inttegro-sdk';

const apiKey = process.env.INTTEGRO_API_KEY?.trim();
if (!apiKey) throw new Error('INTTEGRO_API_KEY is required');

const client = new InttegroClient({ apiKey });
const reference = 'OPENFIELD-GARDEN-CUSTOM-AMOUNT';
const expectedSuggestions = [5_000, 10_000, 25_000];

function matchingPrice(product, priceId) {
  const price = product.prices?.find((candidate) => (
    candidate.active
    && candidate.type === 'customer_selected_amount'
    && (!priceId || candidate.id === priceId)
  ));
  if (!price || price.customerSelectedAmount.currency.toLowerCase() !== 'ghs') return undefined;
  const policy = price.customerSelectedAmount;
  if (
    policy.minimum > expectedSuggestions[0]
    || (policy.maximum !== undefined && policy.maximum < expectedSuggestions.at(-1))
    || expectedSuggestions.some(
      (amount) => !policy.suggestedAmounts?.some((suggestion) => suggestion.value === amount),
    )
  ) return undefined;
  return price;
}

async function provision() {
  const page = await client.products.page({ pageNumber: 1, pageSize: 100 });
  let product = page.products.find((candidate) => candidate.reference === reference);
  if (!product) {
    product = await client.products.create({
      type: 'cause',
      name: 'Riverbend Learning Garden contribution',
      reference,
      about: 'Flexible contributions to equip a community learning garden.',
      publish: false,
    });
  }
  if (product.type !== 'cause') throw new Error('The existing campaign Product is not a cause');

  let price = matchingPrice(product);
  if (!price) {
    price = await client.products.addPrice({
      productId: product.id,
      type: 'customer_selected_amount',
      label: 'Choose your contribution',
      customerSelectedAmount: {
        currency: 'ghs',
        minimum: 5_000,
        maximum: 25_000,
        suggestedAmounts: [
          { id: 'seed', value: 5_000 },
          { id: 'grower', value: 10_000, recommended: true },
          { id: 'steward', value: 25_000 },
        ],
      },
    });
  }
  if (!product.active) product = await client.products.publish({ productId: product.id });

  console.log(JSON.stringify({ productId: product.id, priceId: price.id }));
}

async function smoke() {
  const productId = process.env.INTTEGRO_DEMO_PRODUCT_ID?.trim();
  const priceId = process.env.INTTEGRO_DEMO_PRICE_ID?.trim();
  if (!productId || !priceId) {
    throw new Error('INTTEGRO_DEMO_PRODUCT_ID and INTTEGRO_DEMO_PRICE_ID are required');
  }

  const product = await client.products.lookup({ productId });
  const price = matchingPrice(product, priceId);
  if (!product.active || product.type !== 'cause' || !price) {
    throw new Error('The configured catalog selection is not the expected active cause Price');
  }

  const attempt = `smoke-${Date.now()}`;
  const order = await client.orders.create({
    requestMeta: { idempotencyKey: `openfield-${attempt}` },
    number: `OPENFIELD-${attempt.toUpperCase()}`,
    customerData: {
      name: 'Openfield Smoke Test',
      emailAddress: `openfield-smoke+${Date.now()}@inttegro.dev`,
      phoneNumber: '+233200000001',
    },
    finalize: true,
    lineItems: [{
      type: 'product',
      product: {
        productId,
        customerSelectedPrice: {
          priceId,
          selectedAmount: { currency: 'ghs', value: 10_000 },
        },
        quantity: 1,
      },
    }],
    customData: { demo: 'openfield', purpose: 'customer-selected-price-smoke' },
  });
  const completed = await client.orders.complete({ orderId: order.id, paidOutOfBand: true });
  if (!completed.paidAt || !completed.completedAt) {
    throw new Error('The offline completion did not record both payment and completion');
  }

  console.log(JSON.stringify({ orderId: completed.id, status: completed.status, paidOffline: true }));
}

const command = process.argv[2] ?? 'smoke';
if (command === 'provision') await provision();
else if (command === 'smoke') await smoke();
else throw new Error(`Unknown command: ${command}`);
