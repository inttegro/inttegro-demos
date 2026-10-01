import assert from 'node:assert/strict';
import test from 'node:test';

import type { Product } from '@inttegro/inttegro-sdk';

import {
  buildOrderRequest,
  DemoError,
  parseCheckoutInput,
  selectCatalogProduct,
} from '../src/lib/checkout.js';

const product = {
  id: 'prod_openfield',
  active: true,
  type: 'cause',
  name: 'Riverbend Learning Garden contribution',
  about: 'A contribution unit for the Openfield campaign.',
  reference: 'OPENFIELD-GARDEN',
  prices: [{
    id: 'pr_openfield',
    active: true,
    type: 'customer_selected_amount',
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
  }],
} as unknown as Product;

test('validates and normalizes a public contribution', () => {
  const input = parseCheckoutInput({
    name: '  Akua Mensah ',
    email: ' akua@example.com ',
    phone: ' +233544998605 ',
    tier: 'grower',
    attempt_id: 'attempt_1234',
    ignored_price: '1',
  });
  assert.deepEqual(input, {
    name: 'Akua Mensah',
    email: 'akua@example.com',
    phone: '+233544998605',
    tier: 'grower',
    attemptId: 'attempt_1234',
  });
});

test('rejects an unrecognized contribution tier before calling Inttegro', () => {
  assert.throws(
    () => parseCheckoutInput({
      name: 'Akua Mensah',
      email: 'akua@example.com',
      phone: '+233544998605',
      tier: 'custom',
      attempt_id: 'attempt_1234',
    }),
    (error: unknown) => error instanceof DemoError && error.code === 'validation_error',
  );
});

test('builds a server-owned contribution order for the selected tier', () => {
  const input = parseCheckoutInput({
    name: 'Akua Mensah',
    email: 'akua@example.com',
    phone: '+233544998605',
    tier: 'steward',
    attempt_id: 'attempt_1234',
  });
  const selection = selectCatalogProduct(product, 'pr_openfield');
  const request = buildOrderRequest(input, 'https://astro-demo.inttegro.dev', selection);

  assert.equal(request.number, 'OPENFIELD-ATTEMPT-1234');
  assert.deepEqual(request.requestMeta, { idempotencyKey: 'demo-attempt_1234' });
  assert.equal(request.checkoutSettings?.redirectUrl, 'https://astro-demo.inttegro.dev/complete');
  assert.equal(request.checkoutSettings?.cancelUrl, 'https://astro-demo.inttegro.dev/cancel');
  const lineItem = request.lineItems[0];
  assert.equal(lineItem?.type, 'product');
  if (lineItem?.type !== 'product') assert.fail('expected a product line item');
  assert.equal(lineItem.product.productId, 'prod_openfield');
  assert.equal(lineItem.product.quantity, 1);
  assert.deepEqual(lineItem.product.customerSelectedPrice, {
    priceId: 'pr_openfield',
    selectedAmount: { currency: 'ghs', value: 25_000 },
  });
});

test('requires a cause with a matching customer-selected price policy', () => {
  const wrongType = { ...structuredClone(product), type: 'service' } as Product;
  assert.throws(
    () => selectCatalogProduct(wrongType, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );

  const wrongPolicy = structuredClone(product) as Product;
  if (wrongPolicy.prices?.[0]?.type === 'customer_selected_amount') {
    wrongPolicy.prices[0].customerSelectedAmount.maximum = 10_000;
  }
  assert.throws(
    () => selectCatalogProduct(wrongPolicy, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );
});
