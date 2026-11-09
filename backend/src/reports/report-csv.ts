import type { ReportsService } from './reports.service.js';
/** BOM + semicolon CSV for French spreadsheet imports. Text cells cannot execute formulas. */
export function reportCsv(report: Awaited<ReturnType<ReportsService['report']>>): string {
  const escape = (value: string | null, numeric = false) => {
    let text = value ?? '';
    let start = 0;
    while (start < text.length && (text.charCodeAt(start) < 32 || /\s/.test(text[start]))) start++;
    if (!numeric && start < text.length && '=+@-'.includes(text[start])) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const row = (values: (string | null)[]) => values.map((value) => escape(value)).join(';');
  const lines = [row([report.title]), row(['Période', report.period.dateFrom, report.period.dateTo]), row(['Généré le (UTC)', report.generatedAt]), row(['Filtres', JSON.stringify(report.filters)]), row(['Définitions', report.note]), ''];
  for (const field of report.summaryFields) lines.push(`${escape(field.label)};${escape(report.summary[field.key], field.format === 'money' || field.format === 'count')}`);
  lines.push('', row(report.columns.map((field) => field.label)));
  for (const record of report.data) lines.push(report.columns.map((field) => escape(record[field.key], field.format === 'money' || field.format === 'count')).join(';'));
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
