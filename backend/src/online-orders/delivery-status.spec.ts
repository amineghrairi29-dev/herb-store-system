import { canMoveDelivery, isDeliveryStatus } from './delivery-status.js';
describe('Delivery status', () => {
  it('recognizes statuses', () => { expect(isDeliveryStatus('SHIPPED')).toBe(true); expect(isDeliveryStatus('LOST')).toBe(false); expect(isDeliveryStatus(null)).toBe(false); });
  it.each([[null, 'PREPARING'], [null, 'DELIVERED'], ['PREPARING', 'SHIPPED'], ['SHIPPED', 'DELIVERED'], ['SHIPPED', 'RETURNED'], ['DELIVERED', 'RETURNED']] as const)('allows %s -> %s', (from, to) => { expect(canMoveDelivery(from, to)).toBe(true); });
  it.each([[null, 'RETURNED'], ['SHIPPED', 'PREPARING'], ['DELIVERED', 'SHIPPED'], ['RETURNED', 'DELIVERED'], ['PREPARING', 'PREPARING']] as const)('refuses %s -> %s', (from, to) => { expect(canMoveDelivery(from, to)).toBe(false); });
});
