import { financePeriod, summarizeFinance, type FinanceData } from './finance-values.js';
import { summarizeCash } from '../cash/cash-values.js';
const period = { dateFrom: '2026-09-01', dateTo: '2026-09-30', timeZone: 'Africa/Tunis' };
const empty = (): FinanceData => ({ sales: [], saleLines: [], purchases: [], purchaseLines: [], salePayments: [], purchasePayments: [], expenses: [], movements: [] });
function fixture(): FinanceData {
  return { ...empty(),
    sales: [{ id: 1, status: 'CONFIRMED', saleDate: '2026-08-31' }, { id: 2, status: 'CONFIRMED', saleDate: '2026-09-01' }, { id: 3, status: 'DRAFT', saleDate: '2026-09-15' }, { id: 4, status: 'CONFIRMED', saleDate: '2026-09-30' }, { id: 5, status: 'CONFIRMED', saleDate: '2026-10-01' }],
    saleLines: [{ saleId: 1, lineTotal: '1' }, { saleId: 2, lineTotal: '0.1' }, { saleId: 3, lineTotal: '999' }, { saleId: 4, lineTotal: '0.2' }, { saleId: 5, lineTotal: '888' }],
    purchases: [{ id: 1, status: 'CONFIRMED', purchaseDate: '2026-08-31' }, { id: 2, status: 'CONFIRMED', purchaseDate: '2026-09-30' }, { id: 3, status: 'DRAFT', purchaseDate: '2026-09-01' }],
    purchaseLines: [{ purchaseId: 1, lineTotal: '3' }, { purchaseId: 2, lineTotal: '2' }, { purchaseId: 3, lineTotal: '999' }],
    salePayments: [{ amount: '0.1', paymentDate: '2026-08-31' }, { amount: '0.2', paymentDate: '2026-09-30' }, { amount: '100', paymentDate: '2026-10-01' }],
    purchasePayments: [{ amount: '1', paymentDate: '2026-09-01' }, { amount: '100', paymentDate: '2026-10-01' }],
    expenses: [{ amount: '0.1', expenseDate: '2026-09-01' }, { amount: '0.2', expenseDate: '2026-09-30' }, { amount: '100', expenseDate: '2026-10-01' }],
  };
}
describe('Finance definitions and dates', () => {
  it('separates confirmed revenue/purchases, payments, expenses and exact as-of balances', () => {
    expect(summarizeFinance(fixture(), period)).toMatchObject({ salesRevenue: '0.300', customerCollections: '0.200', purchases: '2.000', supplierPayments: '1.000', expenses: '0.300', customerReceivables: '1.000', supplierPayables: '4.000', estimatedActivityResult: '-2.000' });
  });
  it('payments change collections/payables without changing document totals or expenses', () => {
    const data = fixture(), before = summarizeFinance(data, period);
    data.salePayments.push({ amount: '0.1', paymentDate: '2026-09-15' }); data.purchasePayments.push({ amount: '0.2', paymentDate: '2026-09-15' });
    const after = summarizeFinance(data, period);
    expect(after).toMatchObject({ salesRevenue: before.salesRevenue, purchases: before.purchases, expenses: before.expenses, estimatedActivityResult: before.estimatedActivityResult, customerCollections: '0.300', supplierPayments: '1.200', customerReceivables: '0.900', supplierPayables: '3.800' });
  });
  it('includes both boundary dates; start date does not reset balances; end date excludes future records', () => {
    const full = summarizeFinance(fixture(), period), last = summarizeFinance(fixture(), { ...period, dateFrom: period.dateTo });
    expect(last).toMatchObject({ salesRevenue: '0.200', expenses: '0.200', customerReceivables: full.customerReceivables, supplierPayables: full.supplierPayables });
    expect(full.evolution).toEqual([{ date: '2026-09-01', sales: '0.100', collections: '0.000', expenses: '0.100' }, { date: '2026-09-30', sales: '0.200', collections: '0.200', expenses: '0.200' }]);
  });
  it('matches Caisse cash math including negative cash, noncash methods, manual flows and future exclusion', () => {
    const data = empty();
    data.movements = ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER'].map((paymentMethod, id) => ({ id, paymentMethod, amount: '2', type: 'OUT', sourceType: 'MANUAL_OUT', movementDate: '2026-09-01', createdAt: '2026-09-01 12:00:00+00', reference: 'مرجع', description: 'Test' }));
    data.movements.push({ ...data.movements[0], id: 9, type: 'IN', amount: '10', movementDate: '2026-10-01' });
    const result = summarizeFinance(data, period);
    expect(result.physicalCashBalance).toBe('-2.000'); expect(result.physicalCashBalance).toBe(summarizeCash(data.movements.slice(0, 5), period.dateTo).physicalCashBalance);
    expect(result.byPaymentMethod.every((row) => row.outflows === '2.000' && row.net === '-2.000')).toBe(true);
    expect(result.expenses).toBe('0.000'); expect(result.recentActivity).toHaveLength(5); expect(result.attention.negativeCash).toBe(true);
  });
  it('preserves tiny decimal values and zero periods with prior balances', () => {
    const data = empty(), tiny = `0.${'0'.repeat(35)}1`;
    data.expenses.push({ amount: tiny, expenseDate: period.dateFrom });
    expect(summarizeFinance(data, period).estimatedActivityResult).toBe(`-${tiny}`);
    expect(summarizeFinance(empty(), period)).toMatchObject({ salesRevenue: '0.000', customerCollections: '0.000', purchases: '0.000', supplierPayments: '0.000', expenses: '0.000', customerReceivables: '0.000', supplierPayables: '0.000', physicalCashBalance: '0.000', estimatedActivityResult: '0.000', evolution: [], recentActivity: [] });
    expect(summarizeFinance(fixture(), { ...period, dateFrom: '2026-09-10', dateTo: '2026-09-11' })).toMatchObject({ salesRevenue: '0.000', expenses: '0.000', customerReceivables: '1.000', supplierPayables: '2.000' });
  });
  it('groups large periods by month and limits recent activity without altering input', () => {
    const data = fixture(), before = structuredClone(data);
    const result = summarizeFinance(data, { ...period, dateFrom: '2026-01-01' });
    expect(result.grouping).toBe('month'); expect(result.evolution.find((row) => row.date === '2026-09')).toMatchObject({ sales: '0.300', collections: '0.200', expenses: '0.300' }); expect(data).toEqual(before);
  });
  it('uses business-local month/year-to-date presets including leap day', () => {
    const clock = { today: '2028-02-29', timeZone: 'Africa/Tunis' };
    expect(financePeriod({}, clock)).toEqual({ dateFrom: '2028-02-01', dateTo: clock.today, timeZone: clock.timeZone });
    expect(financePeriod({ period: 'today' }, clock).dateFrom).toBe(clock.today);
    expect(financePeriod({ period: 'year' }, clock).dateFrom).toBe('2028-01-01');
    expect(financePeriod({ dateFrom: '2028-02-29', dateTo: '2028-02-29' }, clock).dateTo).toBe('2028-02-29');
  });
  it.each([{ dateFrom: '2026-09-01' }, { dateFrom: '2026-02-30', dateTo: '2026-03-01' }, { dateFrom: '2026-10-01', dateTo: '2026-09-01' }, { period: 'bad' }, { period: ['today'] }, { dateFrom: '2026-01-01', dateTo: '2026-01-02', period: 'today' }, { extra: 'bad' }])('rejects malformed period %j', (query) => { expect(() => financePeriod(query)).toThrow(); });
});
