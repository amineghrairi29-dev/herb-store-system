import { cartInput } from './cart-validation.js';
describe('Public cart input', () => {
  it('accepts empty carts and exact decimal quantities', () => {
    expect(cartInput({ items: [] })).toEqual([]);
    expect(cartInput({ items: [{ productId: 1, quantity: '0.000000000000000001' }] })).toEqual([{ productId: 1, quantity: '0.000000000000000001' }]);
  });
  it.each(['0', '-1', '1e3', '1,5', '', 'NaN', '1.0000000000000000001', '1'.repeat(61), 1])('rejects invalid quantity %j', (quantity) => {
    expect(() => cartInput({ items: [{ productId: 1, quantity }] })).toThrow();
  });
  it.each([null, [], {}, { items: null }, { items: [], price: '1' }, { items: [{ productId: '1', quantity: '1' }] }, { items: [{ productId: 0, quantity: '1' }] }, { items: [{ productId: 1, quantity: '1', stock: '99' }] }, { items: Array.from({ length: 101 }, (_, index) => ({ productId: index + 1, quantity: '1' })) }, { items: [{ productId: 1, quantity: '1' }, { productId: 1, quantity: '2' }] }])('rejects malformed/oversized cart %j', (body) => {
    expect(() => cartInput(body)).toThrow();
  });
});
