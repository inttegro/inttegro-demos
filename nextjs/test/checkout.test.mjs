import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildMobileOrderRequest,
  buildOrderRequest,
  parseCheckoutInput,
  parseMobileCheckoutInput,
  selectCatalogProduct,
} from '../lib/checkout.ts';

const catalogSelection = {
  type: 'physical',
  name: 'Dawn Brew Set',
  about: 'Hand-thrown stoneware',
  reference: 'DEMO-KORA-DAWN-BREW',
  price: { currency: 'ghs', value: 5000 },
};

test('rejects invalid customer input', () => {
  const form = new FormData();
  form.set('name', 'Akua');
  form.set('email', 'not-an-email');
  form.set('phone', '+233200000000');
  form.set('attempt_id', 'attempt_123');

  assert.throws(() => parseCheckoutInput(form), /valid email/);
});

test('builds the Kora Market Dawn Brew Set order', () => {
  const request = buildOrderRequest(
    {
      name: 'Akua',
      email: 'akua@example.com',
      phone: '+233200000000',
      attemptId: 'attempt_123',
    },
    'https://demo.example',
    catalogSelection,
  );

  assert.equal(request.requestMeta?.idempotencyKey, 'demo-attempt_123');
  assert.equal(request.number, 'KORA-ATTEMPT-123');
  assert.equal(request.finalize, true);
  assert.equal(request.checkoutSettings?.redirectUrl, 'https://demo.example/complete');
  assert.equal(request.lineItems?.[0]?.product?.name, 'Dawn Brew Set');
  assert.equal(request.lineItems?.[0]?.product?.type, 'physical');
  assert.equal(request.lineItems?.[0]?.product?.price.value, 5000);
});

test('accepts only a client-generated mobile checkout attempt ID', () => {
  assert.deepEqual(
    parseMobileCheckoutInput({ attemptId: ' mobile_attempt_123 ' }),
    { attemptId: 'mobile_attempt_123' },
  );
  assert.throws(
    () => parseMobileCheckoutInput({
      attemptId: 'mobile_attempt_123',
      item: { value: 1 },
    }),
    /valid mobile checkout attempt ID/,
  );
});

test('builds a finalized mobile-money-only order on the server', () => {
  const request = buildMobileOrderRequest(
    { attemptId: 'mobile_attempt_123' },
    'cus_demo',
    catalogSelection,
  );

  assert.equal(request.requestMeta?.idempotencyKey, 'mobile-demo-mobile_attempt_123');
  assert.equal(request.number, 'KORA-MOBILE-MOBILE-ATTEMPT-123');
  assert.equal(request.customerId, 'cus_demo');
  assert.equal(request.finalize, true);
  assert.deepEqual(request.paymentMethodTypes, ['mobile_money']);
  assert.equal(request.lineItems?.[0]?.product?.name, 'Dawn Brew Set');
  assert.equal(request.lineItems?.[0]?.product?.price.value, 5000);
});

test('selects only the configured active catalogue price', () => {
  const selected = selectCatalogProduct({
    id: 'prod_demo',
    type: 'physical',
    name: 'Dawn Brew Set',
    active: true,
    createdAt: new Date('2026-09-06T00:00:00Z'),
    prices: [
      { id: 'pr_old', active: false, type: 'fixed_amount', fixedAmount: { currency: 'ghs', value: 4000 } },
      { id: 'pr_demo', active: true, type: 'fixed_amount', fixedAmount: { currency: 'ghs', value: 5000 } },
    ],
  }, 'pr_demo');

  assert.equal(selected.name, 'Dawn Brew Set');
  assert.deepEqual(selected.price, { currency: 'ghs', value: 5000 });
  assert.throws(
    () => selectCatalogProduct({
      id: 'prod_demo',
      type: 'physical',
      name: 'Dawn Brew Set',
      active: true,
      createdAt: new Date('2026-09-06T00:00:00Z'),
      prices: [],
    }, 'pr_missing'),
    /configured demo price/,
  );
});
