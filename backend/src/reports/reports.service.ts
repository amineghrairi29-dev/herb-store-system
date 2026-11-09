import { Injectable } from '@nestjs/common';
import { withPurchaseTransaction, type PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { moneyString, moneyUnits, totalAmount } from '../purchases/purchase-validation.js';
import { paymentSummary } from '../purchases/dto/create-purchase-payment.dto.js';
import { signedMoney, summarizeCash } from '../cash/cash-values.js';
import { FinanceService } from '../finance/finance.service.js';
import { categoryLabels, financeFields, methodLabels, paymentStatusLabels, reportDefinitions, sourceLabels, statusLabels, type ReportKind } from './report-definition.js';
import { reportQuery } from './report-query.js';
export type ReportRow = Record<string, string | null>;
type Query = ReturnType<typeof reportQuery>;
const sum = (rows: ReportRow[], key: string) => moneyString(rows.reduce((value, row) => value + moneyUnits(row[key] ?? '0'), 0n));
const matches = (value: string | null, search?: string) => !search || (value ?? '').toLocaleLowerCase().includes(search.toLocaleLowerCase());
@Injectable()
export class ReportsService {
  constructor(private readonly finance: FinanceService) {}
  async report(kind: ReportKind, query: Record<string, unknown>, all = false) {
    const params = reportQuery(kind, query), definition = reportDefinitions[kind];
    let rows: ReportRow[], summary: Record<string, string>;
    if (kind === 'financial-summary') {
      const result = await this.finance.summary({ dateFrom: params.period.dateFrom, dateTo: params.period.dateTo });
      summary = Object.fromEntries(financeFields.map(({ key }) => [key, result[key as keyof typeof result] as string]));
      rows = financeFields.map(({ key, label }) => ({ id: key, metric: label, amount: summary[key], basis: ['customerReceivables', 'supplierPayables', 'physicalCashBalance'].includes(key) ? `Au ${params.period.dateTo}` : 'Sur la période' }));
    } else ({ rows, summary } = await withPurchaseTransaction((tx) => this.tabular(tx, kind, params), true));
    if (kind !== 'financial-summary') rows.sort((a, b) => {
      let comparison: number;
      if (params.sortBy === 'amount') { const left = moneyUnits(a.amount ?? a.total ?? '0'), right = moneyUnits(b.amount ?? b.total ?? '0'); comparison = left < right ? -1 : left > right ? 1 : 0; }
      else comparison = (a[params.sortBy] ?? '').localeCompare(b[params.sortBy] ?? '');
      return (params.sortOrder === 'asc' ? comparison : -comparison) || Number(b.id) - Number(a.id);
    });
    const totalItems = rows.length, totalPages = Math.ceil(totalItems / params.pageSize);
    return { title: definition.title, note: definition.note, period: params.period, filters: params.filters, generatedAt: new Date().toISOString(), columns: definition.columns, summaryFields: definition.summaryFields, summary,
      data: all || params.print ? rows : rows.slice((params.page - 1) * params.pageSize, params.page * params.pageSize),
      pagination: { page: params.page, pageSize: params.pageSize, totalItems, totalPages }, complete: all || params.print,
    };
  }
  private async tabular(tx: PurchaseTransaction, kind: Exclude<ReportKind, 'financial-summary'>, q: Query): Promise<{ rows: ReportRow[]; summary: Record<string, string> }> {
    const dates = [q.period.dateFrom, q.period.dateTo], f = q.filters;
    if (kind === 'sales' || kind === 'purchases') {
      const sale = kind === 'sales';
      // SQL identifiers are fixed literals, never query parameters. Values stay parameterized.
      const sql = sale ? 'SELECT s.id, s.reference, s."saleDate" AS date, s.status, s."customerName" AS party FROM public.sale s WHERE s."saleDate" BETWEEN $1 AND $2 AND ($3 = \'ALL\' OR s.status = $3)' : 'SELECT p.id, p.reference, p."purchaseDate" AS date, p.status, s.name AS party, p."supplierId" FROM public.purchase p JOIN public.supplier s ON s.id = p."supplierId" WHERE p."purchaseDate" BETWEEN $1 AND $2 AND ($3 = \'ALL\' OR p.status = $3)';
      const documents = (await tx.client.query<{ id: number; reference: string; date: string; status: string; party: string | null; supplierId?: number }>(sql, [...dates, f.status])).rows.filter((row) => (!q.supplierId || row.supplierId === q.supplierId) && matches(sale ? `${row.reference} ${row.party ?? ''}` : row.reference, f.search));
      const ids = documents.map((row) => row.id);
      const lines = (await tx.client.query<{ parentId: number; lineTotal: string }>(sale ? 'SELECT "saleId" AS "parentId", "lineTotal" FROM public."saleLine" WHERE "saleId" = ANY($1::int[])' : 'SELECT "purchaseId" AS "parentId", "lineTotal" FROM public."purchaseLine" WHERE "purchaseId" = ANY($1::int[])', [ids])).rows;
      const payments = (await tx.client.query<{ parentId: number; amount: string }>(sale ? 'SELECT "saleId" AS "parentId", amount FROM public."salePayment" WHERE "saleId" = ANY($1::int[])' : 'SELECT "purchaseId" AS "parentId", amount FROM public."purchasePayment" WHERE "purchaseId" = ANY($1::int[])', [ids])).rows;
      const groupedLines = new Map<number, typeof lines>(), groupedPayments = new Map<number, typeof payments>();
      for (const row of lines) { const group = groupedLines.get(row.parentId) ?? []; group.push(row); groupedLines.set(row.parentId, group); }
      for (const row of payments) { const group = groupedPayments.get(row.parentId) ?? []; group.push(row); groupedPayments.set(row.parentId, group); }
      const rows = documents.flatMap((doc): ReportRow[] => {
        const total = totalAmount(groupedLines.get(doc.id) ?? []), paid = paymentSummary(total, groupedPayments.get(doc.id) ?? []);
        if (f.paymentStatus && paid.paymentStatus !== f.paymentStatus) return [];
        return [{ id: String(doc.id), reference: doc.reference, date: doc.date, party: doc.party, status: statusLabels[doc.status], statusCode: doc.status, total, paid: paid.totalPaid, remaining: paid.remainingAmount, paymentStatus: paymentStatusLabels[paid.paymentStatus] }];
      });
      const confirmed = rows.filter((row) => row.statusCode === 'CONFIRMED');
      return { rows, summary: { count: String(rows.length), confirmedTotal: sum(confirmed, 'total'), paid: sum(rows, 'paid'), remaining: sum(confirmed, 'remaining') } };
    }
    if (kind === 'expenses') {
      const expenses = (await tx.client.query<{ id: number; reference: string; expenseDate: string; category: string; description: string; amount: string; paymentMethod: string }>('SELECT id, reference, "expenseDate", category, description, amount, "paymentMethod" FROM public.expense WHERE "expenseDate" BETWEEN $1 AND $2', dates)).rows;
      const rows = expenses.filter((row) => (!f.category || f.category === row.category) && (!f.paymentMethod || f.paymentMethod === row.paymentMethod) && matches(`${row.reference} ${row.description}`, f.search)).map((row): ReportRow => ({ id: String(row.id), reference: row.reference, date: row.expenseDate, category: categoryLabels[row.category], description: row.description, amount: row.amount, paymentMethod: methodLabels[row.paymentMethod] }));
      return { rows, summary: { count: String(rows.length), amount: sum(rows, 'amount') } };
    }
    if (kind === 'cash') {
      const movements = (await tx.client.query<{ id: number; movementDate: string; type: string; sourceType: string; reference: string | null; description: string; paymentMethod: string; amount: string }>('SELECT id, "movementDate", type, "sourceType", reference, description, "paymentMethod", amount FROM public."cashMovement" WHERE "movementDate" BETWEEN $1 AND $2', dates)).rows.filter((row) => (!f.type || f.type === row.type) && (!f.sourceType || f.sourceType === row.sourceType) && (!f.paymentMethod || f.paymentMethod === row.paymentMethod));
      const totals = summarizeCash(movements, q.period.dateTo);
      return { rows: movements.map((row) => ({ id: String(row.id), date: row.movementDate, type: row.type === 'IN' ? 'Entrée' : 'Sortie', sourceType: sourceLabels[row.sourceType], reference: row.reference, description: row.description, paymentMethod: methodLabels[row.paymentMethod], amount: row.amount, cashImpact: row.paymentMethod === 'CASH' ? signedMoney(moneyUnits(row.amount) * (row.type === 'IN' ? 1n : -1n)) : '0.000' })), summary: { cashInflows: totals.cashInflows, cashOutflows: totals.cashOutflows, physicalCashBalance: totals.physicalCashBalance, netFinancialFlow: totals.netFinancialFlow } };
    }
    const sql = kind === 'customer-collections' ? 'SELECT p.id, p."paymentDate" AS date, p.amount, p."paymentMethod", p.reference, s.reference AS document, s."customerName" AS party FROM public."salePayment" p JOIN public.sale s ON s.id = p."saleId" WHERE p."paymentDate" BETWEEN $1 AND $2' : 'SELECT p.id, p."paymentDate" AS date, p.amount, p."paymentMethod", p.reference, d.reference AS document, s.name AS party, d."supplierId" FROM public."purchasePayment" p JOIN public.purchase d ON d.id = p."purchaseId" JOIN public.supplier s ON s.id = d."supplierId" WHERE p."paymentDate" BETWEEN $1 AND $2';
    const payments = (await tx.client.query<{ id: number; date: string; amount: string; paymentMethod: string; reference: string | null; document: string; party: string | null; supplierId?: number }>(sql, dates)).rows;
    const rows = payments.filter((row) => (!f.paymentMethod || f.paymentMethod === row.paymentMethod) && (!q.supplierId || q.supplierId === row.supplierId) && matches(kind === 'customer-collections' ? `${row.document} ${row.party ?? ''}` : row.document, f.search)).map((row): ReportRow => ({ id: String(row.id), date: row.date, document: row.document, party: row.party, amount: row.amount, paymentMethod: methodLabels[row.paymentMethod], reference: row.reference }));
    return { rows, summary: { count: String(rows.length), amount: sum(rows, 'amount') } };
  }
}
