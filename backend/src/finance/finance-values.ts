import { BadRequestException } from '@nestjs/common';
import { businessDate, signedMoney, summarizeCash } from '../cash/cash-values.js';
import { moneyString, moneyUnits, totalAmount } from '../purchases/purchase-validation.js';
import { paymentMethods } from '../purchases/dto/create-purchase-payment.dto.js';

export interface FinancePeriod { dateFrom: string; dateTo: string; timeZone: string }
export function financePeriod(query: Record<string, unknown>, calendar = businessDate()): FinancePeriod {
  for (const key of Object.keys(query)) if (!['dateFrom', 'dateTo', 'period'].includes(key)) throw new BadRequestException(`Filtre non autorisé : ${key}.`);
  if ('dateFrom' in query || 'dateTo' in query) {
    if ('period' in query) throw new BadRequestException('Choisissez une période ou deux dates personnalisées.');
    const valid = (date: unknown): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '0001-01-01' && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
    if (!valid(query.dateFrom) || !valid(query.dateTo) || query.dateFrom > query.dateTo) throw new BadRequestException('Dates invalides : indiquez une date de début et de fin valides, dans cet ordre.');
    return { dateFrom: query.dateFrom, dateTo: query.dateTo, timeZone: calendar.timeZone };
  }
  const preset = query.period ?? 'month';
  if (!['today', 'month', 'year'].includes(String(preset)) || typeof preset !== 'string') throw new BadRequestException('Période invalide.');
  return { dateFrom: preset === 'today' ? calendar.today : preset === 'month' ? `${calendar.today.slice(0, 7)}-01` : `${calendar.today.slice(0, 4)}-01-01`, dateTo: calendar.today, timeZone: calendar.timeZone };
}
interface Document { id: number; status: string }
interface Amount { amount: string }
export interface FinanceData {
  sales: (Document & { saleDate: string })[];
  saleLines: { saleId: number; lineTotal: string }[];
  purchases: (Document & { purchaseDate: string })[];
  purchaseLines: { purchaseId: number; lineTotal: string }[];
  salePayments: (Amount & { paymentDate: string })[];
  purchasePayments: (Amount & { paymentDate: string })[];
  expenses: (Amount & { expenseDate: string })[];
  movements: (Amount & { id: number; type: string; sourceType: string; paymentMethod: string; movementDate: string; createdAt: string; reference: string | null; description: string })[];
}
const sum = (rows: readonly Amount[]) => rows.reduce((value, row) => value + moneyUnits(row.amount), 0n);
/** Shared receivable/payable definition; signed historical balances are not clamped. */
export const outstandingBalance = (confirmedTotal: bigint, paid: bigint) => confirmedTotal - paid;
export function summarizeFinance(data: FinanceData, period: FinancePeriod) {
  const inPeriod = (date: string) => date >= period.dateFrom && date <= period.dateTo;
  const throughEnd = (date: string) => date <= period.dateTo;
  const sales = data.sales.filter((row) => row.status === 'CONFIRMED');
  const purchases = data.purchases.filter((row) => row.status === 'CONFIRMED');
  const salesTotal = (predicate: (date: string) => boolean) => { const ids = new Set(sales.filter((row) => predicate(row.saleDate)).map((row) => row.id)); return moneyUnits(totalAmount(data.saleLines.filter((line) => ids.has(line.saleId)))); };
  const purchasesTotal = (predicate: (date: string) => boolean) => { const ids = new Set(purchases.filter((row) => predicate(row.purchaseDate)).map((row) => row.id)); return moneyUnits(totalAmount(data.purchaseLines.filter((line) => ids.has(line.purchaseId)))); };
  const revenue = salesTotal(inPeriod), purchaseTotal = purchasesTotal(inPeriod), expenses = sum(data.expenses.filter((row) => inPeriod(row.expenseDate)));
  const receivables = outstandingBalance(salesTotal(throughEnd), sum(data.salePayments.filter((row) => throughEnd(row.paymentDate))));
  const payables = outstandingBalance(purchasesTotal(throughEnd), sum(data.purchasePayments.filter((row) => throughEnd(row.paymentDate))));
  const cash = summarizeCash(data.movements.filter((row) => throughEnd(row.movementDate)), period.dateTo).physicalCashBalance;
  const movements = data.movements.filter((row) => inPeriod(row.movementDate));
  const byPaymentMethod = paymentMethods.map((paymentMethod) => { const totals = summarizeCash(movements.filter((row) => row.paymentMethod === paymentMethod), period.dateTo); return { paymentMethod, inflows: totals.totalFinancialInflows, outflows: totals.totalFinancialOutflows, net: totals.netFinancialFlow }; });
  const grouping = (Date.parse(`${period.dateTo}T00:00:00Z`) - Date.parse(`${period.dateFrom}T00:00:00Z`)) / 86400000 < 62 ? 'day' : 'month';
  const buckets = new Map<string, { sales: bigint; collections: bigint; expenses: bigint }>();
  const add = (date: string, key: 'sales' | 'collections' | 'expenses', amount: bigint) => { if (!inPeriod(date)) return; const bucket = grouping === 'day' ? date : date.slice(0, 7); const row = buckets.get(bucket) ?? { sales: 0n, collections: 0n, expenses: 0n }; row[key] += amount; buckets.set(bucket, row); };
  const saleDates = new Map(sales.map((row) => [row.id, row.saleDate]));
  for (const line of data.saleLines) { const date = saleDates.get(line.saleId); if (date) add(date, 'sales', moneyUnits(line.lineTotal)); }
  for (const row of data.salePayments) add(row.paymentDate, 'collections', moneyUnits(row.amount));
  for (const row of data.expenses) add(row.expenseDate, 'expenses', moneyUnits(row.amount));
  return {
    period, balanceAsOf: period.dateTo, salesRevenue: moneyString(revenue), customerCollections: moneyString(sum(data.salePayments.filter((row) => inPeriod(row.paymentDate)))), purchases: moneyString(purchaseTotal), supplierPayments: moneyString(sum(data.purchasePayments.filter((row) => inPeriod(row.paymentDate)))), expenses: moneyString(expenses), customerReceivables: signedMoney(receivables), supplierPayables: signedMoney(payables), physicalCashBalance: cash, estimatedActivityResult: signedMoney(revenue - purchaseTotal - expenses),
    byPaymentMethod, grouping,
    evolution: [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({ date, sales: moneyString(row.sales), collections: moneyString(row.collections), expenses: moneyString(row.expenses) })),
    recentActivity: [...movements].sort((a, b) => b.movementDate.localeCompare(a.movementDate) || b.createdAt.localeCompare(a.createdAt) || b.id - a.id).slice(0, 10).map(({ id, type, sourceType, amount, paymentMethod, movementDate, reference, description }) => ({ id, type, sourceType, amount, paymentMethod, movementDate, reference, description })),
    attention: { customerReceivables: receivables > 0n, supplierPayables: payables > 0n, negativeCash: cash.startsWith('-') },
  };
}
