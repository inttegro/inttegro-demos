import assert from 'node:assert/strict';
import test from 'node:test';

import type { Product } from '@inttegro/inttegro-sdk';

import { buildOrderRequest, DemoError, parseCheckoutInput, selectCatalogProduct } from '../src/checkout.service.js';

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

test('validates the public contribution DTO', async () => {
  const input = await parseCheckoutInput({
    name: 'Akua Mensah',
    email: 'akua@example.com',
    phone: '+233544998605',
    tier: 'grower',
    attempt_id: 'attempt_1234',
    price: '1',
  });
  assert.equal(input.tier, 'grower');
});

test('rejects an unrecognized tier before calling Inttegro', async () => {
  await assert.rejects(
    parseCheckoutInput({
      name: 'Akua Mensah',
      email: 'akua@example.com',
      phone: '+233544998605',
      tier: 'custom',
      attempt_id: 'attempt_1234',
    }),
    (error: unknown) => error instanceof DemoError && error.code === 'validation_error',
  );
});

test('builds a server-owned contribution order with a readable number', async () => {
  const input = await parseCheckoutInput({
    name: 'Akua Mensah',
    email: 'akua@example.com',
    phone: '+233544998605',
    tier: 'steward',
    attempt_id: 'attempt_1234',
  });
  const selection = selectCatalogProduct(product, 'pr_openfield');
  const request = buildOrderRequest(input, 'https://nestjs-demo.inttegro.dev', selection);

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
  assert.deepEqual(request.requestMeta, { idempotencyKey: 'demo-attempt_1234' });
  assert.equal(request.checkoutSettings?.redirectUrl, 'https://nestjs-demo.inttegro.dev/complete');
});

test('requires a cause with a matching customer-selected price policy', () => {
  const wrongType = { ...structuredClone(product), type: 'service' } as Product;
  assert.throws(
    () => selectCatalogProduct(wrongType, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );

  const wrongPolicy = structuredClone(product) as Product;
  if (wrongPolicy.prices?.[0]?.type === 'customer_selected_amount') {
    wrongPolicy.prices[0].customerSelectedAmount.suggestedAmounts = [];
  }
  assert.throws(
    () => selectCatalogProduct(wrongPolicy, 'pr_openfield'),
    (error: unknown) => error instanceof DemoError && error.code === 'configuration_error',
  );
});
