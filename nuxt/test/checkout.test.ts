import { describe, expect, it } from 'vitest';
import { buildOrderRequest, DemoError, parseCheckoutInput, selectCatalogProduct } from '../server/utils/checkout';

const catalogSelection = {
  type: 'physical' as const,
  name: 'Dawn Brew Set',
  reference: 'DEMO-KORA-DAWN-BREW',
  price: { currency: 'ghs' as const, value: 5000 },
};

describe('Nuxt checkout', () => {
  it('rejects invalid input', () => {
    expect(() => parseCheckoutInput({ name: 'Akua', email: 'bad', phone: '+233', attempt_id: 'attempt_123' })).toThrow(DemoError);
  });

  it('builds the shared order request', () => {
    const request = buildOrderRequest(
      { name: 'Akua', email: 'akua@example.com', phone: '+233', attemptId: 'attempt_123' },
      'https://demo.example',
      catalogSelection,
    );
    expect(request.request_meta?.idempotency_key).toBe('demo-attempt_123');
    expect(request.number).toBe('KORA-ATTEMPT-123');
    expect(request.finalize).toBe(true);
    const lineItem = request.line_items[0];
    expect(lineItem?.type).toBe('product');
    if (!lineItem || lineItem.type !== 'product') throw new Error('expected a product line item');
    expect(lineItem.product.name).toBe('Dawn Brew Set');
    expect(lineItem.product.type).toBe('physical');
    expect(lineItem.product.price.value).toBe(5000);
  });

  it('rejects a price that is not active on the configured product', () => {
    expect(() => selectCatalogProduct({
      id: 'prod_demo',
      type: 'physical',
      name: 'Dawn Brew Set',
      active: true,
      created_at: '2026-09-06T00:00:00Z',
      prices: [{
        id: 'pr_demo',
        active: false,
        type: 'fixed_amount',
        fixedAmount: { currency: 'ghs', value: 5000 },
      }],
    }, 'pr_demo')).toThrow(/configured demo price/);
  });
});
