import { orderInput, orderLineTotal, orderTotal } from './order-input.js';
const valid = { deliveryAddress: ' 12 rue des Plantes ', customerName: ' عميل ', customerPhone: ' 20123456 ', items: [{ productId: 1, quantity: '2.5' }] };
describe('Online order input and exact totals', () => {
  it('trims customer values and preserves decimal quantities', () => { expect(orderInput(valid)).toMatchObject({ customerName: 'عميل', customerPhone: '20123456', customerEmail: null, deliveryAddress: '12 rue des Plantes', items: [{ productId: 1, quantity: '2.500' }] }); });
  it.each([{ deliveryAddress: undefined }, { deliveryAddress: null }, { deliveryAddress: '' }, { deliveryAddress: '   ' }, { deliveryAddress: 'x'.repeat(501) },{ customerName: '' }, { customerName: 'x'.repeat(151) }, { customerPhone: '' }, { customerPhone: 'letters' }, { customerEmail: 'not-email' }, { notes: 'x'.repeat(2001) }, { items: [] }, { items: [{ productId: 1, quantity: '0' }] }, { items: [{ productId: 1, quantity: '-1' }] }, { items: [{ productId: 1, quantity: '1e3' }] }, { items: [{ productId: 1, quantity: '1' }, { productId: 1, quantity: '2' }] }, { totalAmount: '0.01' }, { reference: 'ORD-FAKE' }])('rejects invalid or client-controlled input %j', (patch) => { expect(() => orderInput({ ...valid, ...patch })).toThrow(); });
  it('multiplies and sums without money rounding', () => {
    expect(orderLineTotal('2.5', '0.100000000000000001')).toBe('0.2500000000000000025');
    expect(orderTotal(['0.2500000000000000025', '0.2'])).toBe('0.4500000000000000025');
    expect(orderLineTotal('2', '9007199254740993.01')).toBe('18014398509481986.020');
  });
});
