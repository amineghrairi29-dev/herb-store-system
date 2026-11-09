import { reportKind, reportQuery } from './report-query.js';
describe('Report input validation', () => {
  it('uses confirmed defaults and caps page size without allowing unbounded page requests', () => { expect(reportQuery('sales', { pageSize: '500' })).toMatchObject({ page: 1, pageSize: 100, filters: { status: 'CONFIRMED' } }); });
  it.each([{ page: '0' }, { page: '-1' }, { page: '1.5' }, { pageSize: '0' }, { pageSize: '100000000000000000000' }, { status: 'INVALID' }, { paymentStatus: 'NO' }, { sortBy: 'DROP TABLE sale' }, { sortOrder: 'DOWN' }, { status: ['CONFIRMED'] }, { dateFrom: '2026-01-02', dateTo: '2026-01-01' }, { dateFrom: '2026-02-30', dateTo: '2026-03-01' }, { view: 'all' }, { unexpected: 'x' }])('rejects invalid sales query %j', (query) => { expect(() => reportQuery('sales', query)).toThrow(); });
  it('validates report-specific filters and rejects unknown reports', () => {
    expect(() => reportQuery('expenses', { category: 'INVALID' })).toThrow(); expect(() => reportQuery('cash', { paymentMethod: 'INVALID' })).toThrow(); expect(() => reportQuery('cash', { sourceType: 'INVALID' })).toThrow(); expect(() => reportQuery('purchases', { supplierId: 'NaN' })).toThrow(); expect(() => reportQuery('financial-summary', { category: 'RENT' })).toThrow(); expect(() => reportKind('invalid')).toThrow();
  });
});
