import assert from 'node:assert/strict';
import test from 'node:test';

import type { Product } from '@inttegro/inttegro-sdk';

import { buildOrderRequest, DemoError, parseCheckoutInput, selectCatalogProduct } from '../src/checkout.js';

const product = {
  id: 'prod_openfield', active: true, type: 'cause',
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

test('parses a bounded contribution from FormData', () => {
  const form = new FormData();
  form.set('name', 'Akua Mensah');
  form.set('email', 'akua@example.com');
  form.set('phone', '+233544998605');
  form.set('tier', 'grower');
  form.set('attempt_id', 'attempt_1234');
  assert.equal(parseCheckoutInput(form).tier, 'grower');
});

test('rejects arbitrary public contribution tiers', () => {
  assert.throws(
    () => parseCheckoutInput({ name: 'Akua', email: 'akua@example.com', phone: '+233544998605', tier: 'custom', attempt_id: 'attempt_1234' }),
    (error: unknown) => error instanceof DemoError && error.code === 'validation_error',
  );
});

test('uses the cause price policy and server-owned selected amount', () => {
  const input = parseCheckoutInput({ name: 'Akua Mensah', email: 'akua@example.com', phone: '+233544998605', tier: 'steward', attempt_id: 'attempt_1234' });
  const request = buildOrderRequest(input, 'https://redwoodsdk-demo.inttegro.dev', selectCatalogProduct(product, 'pr_openfield'));
  assert.equal(request.number, 'OPENFIELD-ATTEMPT-1234');
  const lineItem = request.lineItems[0];
  assert.equal(lineItem?.type, 'product');
  if (lineItem?.type !== 'product') assert.fail('expected a product line item');
  assert.equal(lineItem.product.productId, 'prod_openfield');
  assert.equal(lineItem.product.quantity, 1);
  assert.deepEqual(lineItem.product.customerSelectedPrice, {
    priceId: 'pr_openfield',
    selectedAmount: { currency: 'ghs', value: 25_000 },
  });
  assert.equal(request.customData?.contributionTier, 'steward');
});

test('requires a cause with a matching customer-selected price policy', () => {
  const wrongType = { ...structuredClone(product), type: 'service' } as Product;
  assert.throws(
    () => selectCatalogProduct(wrongType, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );

  const wrongPolicy = structuredClone(product) as Product;
  if (wrongPolicy.prices?.[0]?.type === 'customer_selected_amount') {
    wrongPolicy.prices[0].customerSelectedAmount.minimum = 10_000;
  }
  assert.throws(
    () => selectCatalogProduct(wrongPolicy, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );
});
