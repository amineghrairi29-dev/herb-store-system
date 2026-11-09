import { validateSalePayment } from './dto/create-sale-payment.dto.js';
import { paymentSummary } from '../purchases/dto/create-purchase-payment.dto.js';
describe('Sale payment shared rules', () => {
  it('normalizes exact sale payments and preserves Arabic text', () => {
    expect(validateSalePayment({ amount: '20', paymentMethod: 'CASH', paymentDate: '2026-09-06', reference: ' دفع ' })).toMatchObject({ amount: '20.000', reference: 'دفع' });
    expect(paymentSummary('50', [{ amount: '20' }])).toEqual({ totalPaid: '20.000', remainingAmount: '30.000', paymentStatus: 'PARTIALLY_PAID' });
    expect(paymentSummary('50', [{ amount: '20' }, { amount: '30' }]).paymentStatus).toBe('PAID');
  });
  it('rejects client-owned balance and parent fields', () => {
    const input = { amount: '1', paymentMethod: 'CARD', paymentDate: '2026-09-06' };
    for (const key of ['saleId', 'totalPaid', 'remainingAmount', 'paymentStatus']) expect(() => validateSalePayment({ ...input, [key]: '1' })).toThrow();
  });
});
