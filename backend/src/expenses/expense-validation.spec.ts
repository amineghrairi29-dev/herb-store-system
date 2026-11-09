import { expenseCategories, validateExpense } from './expense-validation.js';
const valid = { reference: ' EXP-TEST ', category: 'RENT', description: ' إيجار ', amount: '1200.5', paymentMethod: 'CASH', expenseDate: '2026-09-06', notes: null };
describe('Expense validation', () => {
  it('normalizes text and exact decimal amounts', () => { expect(validateExpense(valid)).toEqual({ ...valid, reference: 'EXP-TEST', description: 'إيجار', amount: '1200.500' }); });
  it.each(expenseCategories)('accepts category %s', (category) => { expect(validateExpense({ ...valid, category }).category).toBe(category); });
  it.each(['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'])('accepts method %s', (paymentMethod) => { expect(validateExpense({ ...valid, paymentMethod }).paymentMethod).toBe(paymentMethod); });
  it.each(['0', '-1', 'NaN', '1e3', 'Infinity', 1, null])('rejects amount %s', (amount) => { expect(() => validateExpense({ ...valid, amount })).toThrow(); });
  it('rejects missing/invalid fields and metadata overrides', () => {
    for (const patch of [{ reference: ' ' }, { description: '' }, { category: 'INVALID' }, { paymentMethod: 'INVALID' }, { expenseDate: '2026-02-30' }, { expenseDate: '' }, { notes: 2 }, { id: 1 }, { sourceType: 'MANUAL_OUT' }]) expect(() => validateExpense({ ...valid, ...patch })).toThrow();
    expect(() => validateExpense(null)).toThrow(); expect(() => validateExpense([])).toThrow();
  });
  it('preserves 36 decimal places without rounding', () => { const amount = '9007199254740993.123456789012345678901234567890123456'; expect(validateExpense({ ...valid, amount }).amount).toBe(amount); });
});
