import { reportCsv } from './report-csv.js';
import type { ReportsService } from './reports.service.js';
describe('Report CSV', () => {
  const report: Awaited<ReturnType<ReportsService['report']>> = { title: 'Dépenses', note: 'Test', period: { dateFrom: '2026-01-01', dateTo: '2026-01-02', timeZone: 'Africa/Tunis' }, filters: {}, generatedAt: '2026-01-02T12:00:00Z', columns: [{ key: 'reference', label: 'Référence', format: 'text' }, { key: 'amount', label: 'Montant', format: 'money' }], summaryFields: [{ key: 'amount', label: 'Total', format: 'money' }], summary: { amount: '0.300' }, data: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 0 }, complete: true };
  it('preserves BOM, French/Arabic, embedded delimiters/quotes/newlines and decimal precision', () => {
    const amount = '9007199254740993.123456789012345678901234567890123456';
    const csv = reportCsv({ ...report, data: [{ reference: 'إيجار; "Étage"\nSuite', amount }] });
    expect(csv.charCodeAt(0)).toBe(0xfeff); expect(csv).toContain('"إيجار; ""Étage""\nSuite"'); expect(csv).toContain(`"${amount}"`); expect(csv).toContain('"Total";"0.300"');
  });
  it('neutralizes spreadsheet formulas in text while preserving negative numeric amounts', () => { const csv = reportCsv({ ...report, data: [{ reference: '=1+1', amount: '-0.100' }, { reference: '\t@SUM(A1)', amount: '0.100' }] }); expect(csv).toContain('"\'=1+1";"-0.100"'); expect(csv).toContain('"\'\t@SUM(A1)"'); });
  it('returns valid metadata, zero-capable summaries and column headers for empty results', () => { const csv = reportCsv(report); expect(csv).toContain('"Référence";"Montant"\r\n'); expect(csv).toContain(report.generatedAt); });
});
