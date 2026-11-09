import { paymentMethods, paymentSummary, validatePayment } from './dto/create-purchase-payment.dto.js';
const input = { amount: '10', paymentMethod: 'CASH', paymentDate: '2026-09-06' };
describe('Purchase payments validation and balances', () => {
  it('accepts all methods, trims Arabic text and normalizes optional fields', () => {
    for (const paymentMethod of paymentMethods) expect(validatePayment({ ...input, paymentMethod, reference: ' PAY-1 ', notes: ' دفع ' })).toMatchObject({ amount: '10.000', paymentMethod, reference: 'PAY-1', notes: 'دفع' });
    expect(validatePayment({ ...input, notes: '', reference: null })).toMatchObject({ notes: null, reference: null });
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1e3', '1,2', 10, null, '', '0.' + '0'.repeat(36) + '1'])('rejects invalid amount %j', (amount) => {
    expect(() => validatePayment({ ...input, amount })).toThrow();
  });
  it('rejects invalid methods, dates, malformed bodies and derived fields', () => {
    for (const body of [null, [], {}, { ...input, paymentMethod: 'WIRE' }, { ...input, paymentDate: '2026-02-30' }, { ...input, paymentDate: '' }, { ...input, paymentDate: '0000-01-01' }, { ...input, notes: 42 }, { ...input, totalPaid: '10' }]) expect(() => validatePayment(body)).toThrow();
  });
  it('derives exact zero, partial and paid balances without binary floating point', () => {
    expect(paymentSummary('1500', [])).toEqual({ totalPaid: '0.000', remainingAmount: '1500.000', paymentStatus: 'NON_PAID' });
    expect(paymentSummary('1500', [{ amount: '800' }])).toEqual({ totalPaid: '800.000', remainingAmount: '700.000', paymentStatus: 'PARTIALLY_PAID' });
    expect(paymentSummary('0.3', [{ amount: '0.1' }, { amount: '0.2' }])).toEqual({ totalPaid: '0.300', remainingAmount: '0.000', paymentStatus: 'PAID' });
    expect(paymentSummary('9007199254740993.001', [{ amount: '9007199254740993' }]).remainingAmount).toBe('0.001');
    const tiny = `0.${'0'.repeat(35)}1`;
    expect(validatePayment({ ...input, amount: tiny }).amount).toBe(tiny);
    expect(paymentSummary(tiny, [{ amount: tiny }]).paymentStatus).toBe('PAID');
    expect(() => paymentSummary('1', [{ amount: '2' }])).toThrow();
  });
});