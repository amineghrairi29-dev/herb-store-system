import { summarizeCash, validateManual } from './cash-values.js';

describe('Cash values', () => {
  it('separates physical cash from all-method flows and uses movement date for today', () => {
    const rows = [
      { amount: '0.1', type: 'IN', paymentMethod: 'CASH', movementDate: '2026-09-06' },
      { amount: '0.2', type: 'IN', paymentMethod: 'CASH', movementDate: '2026-09-05' },
      { amount: '1', type: 'OUT', paymentMethod: 'CASH', movementDate: '2026-09-06' },
      ...['CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'].flatMap((paymentMethod) => [
        { amount: '10', type: 'IN', paymentMethod, movementDate: '2026-09-06' },
        { amount: '2', type: 'OUT', paymentMethod, movementDate: '2026-09-06' },
      ]),
    ];
    expect(summarizeCash(rows, '2026-09-06')).toEqual({ physicalCashBalance: '-0.700', cashInflows: '0.300', cashOutflows: '1.000', totalFinancialInflows: '40.300', totalFinancialOutflows: '9.000', netFinancialFlow: '31.300', todayCashInflows: '0.100', todayCashOutflows: '1.000' });
  });
  it('preserves 36 decimal places and integers beyond floating-point precision', () => {
    const tiny = `0.${'0'.repeat(35)}1`, large = '9007199254740993';
    const row = { type: 'IN', paymentMethod: 'CASH', movementDate: '2026-09-06' };
    expect(summarizeCash([{ ...row, amount: large }, { ...row, amount: tiny }], row.movementDate).physicalCashBalance).toBe(`${large}.${'0'.repeat(35)}1`);
    expect(summarizeCash([], row.movementDate).physicalCashBalance).toBe('0.000');
  });
  it.each(['0', '-1', 'NaN', 'Infinity', '1e2', 1, null, undefined])('rejects invalid amount %s', (amount) => {
    expect(() => validateManual({ amount, movementDate: '2026-09-06', description: 'Test' })).toThrow();
  });
  it('requires a real date and description and rejects source/method/balance overrides', () => {
    const valid = { amount: '0.1', movementDate: '2026-09-06', description: '  إيداع  ' };
    expect(validateManual(valid)).toMatchObject({ amount: '0.100', description: 'إيداع', paymentMethod: 'CASH' });
    for (const override of [{ movementDate: '2026-02-30' }, { description: ' ' }, { paymentMethod: 'CARD' }, { type: 'OUT' }, { sourceId: 1 }, { balance: '100' }]) expect(() => validateManual({ ...valid, ...override })).toThrow();
  });
});
