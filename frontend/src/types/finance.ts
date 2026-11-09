import { isPaymentMethod, type PaymentMethod } from './purchase-payment';
import { cashSourceLabels, type CashSource } from './cash';
export const financeMetrics = ['salesRevenue', 'customerCollections', 'purchases', 'supplierPayments', 'expenses', 'customerReceivables', 'supplierPayables', 'physicalCashBalance', 'estimatedActivityResult'] as const;
export type FinanceMetric = typeof financeMetrics[number];
export type FinanceSummary = Record<FinanceMetric, string> & {
  period: { dateFrom: string; dateTo: string; timeZone: string }; balanceAsOf: string;
  byPaymentMethod: { paymentMethod: PaymentMethod; inflows: string; outflows: string; net: string }[];
  grouping: 'day' | 'month'; evolution: { date: string; sales: string; collections: string; expenses: string }[];
  recentActivity: { id: number; type: 'IN' | 'OUT'; sourceType: CashSource; amount: string; paymentMethod: PaymentMethod; movementDate: string; reference: string | null; description: string }[];
  attention: { customerReceivables: boolean; supplierPayables: boolean; negativeCash: boolean };
};
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const money = (value: unknown) => typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value);
export function readFinance(value: unknown): FinanceSummary {
  if (!object(value) || !financeMetrics.every((key) => money(value[key])) || !object(value.period) || !['dateFrom', 'dateTo', 'timeZone'].every((key) => typeof value.period === 'object' && value.period !== null && typeof (value.period as Record<string, unknown>)[key] === 'string') || typeof value.balanceAsOf !== 'string') throw new Error('Résumé financier invalide.');
  if (!Array.isArray(value.byPaymentMethod) || !value.byPaymentMethod.every((row: unknown) => object(row) && typeof row.paymentMethod === 'string' && isPaymentMethod(row.paymentMethod) && money(row.inflows) && money(row.outflows) && money(row.net))) throw new Error('Flux financiers invalides.');
  if (!['day', 'month'].includes(String(value.grouping)) || !Array.isArray(value.evolution) || !value.evolution.every((row: unknown) => object(row) && typeof row.date === 'string' && money(row.sales) && money(row.collections) && money(row.expenses))) throw new Error('Évolution financière invalide.');
  if (!Array.isArray(value.recentActivity) || !value.recentActivity.every((row: unknown) => object(row) && typeof row.id === 'number' && ['IN', 'OUT'].includes(String(row.type)) && typeof row.sourceType === 'string' && Object.hasOwn(cashSourceLabels, row.sourceType) && money(row.amount) && typeof row.paymentMethod === 'string' && isPaymentMethod(row.paymentMethod) && typeof row.movementDate === 'string' && (row.reference === null || typeof row.reference === 'string') && typeof row.description === 'string')) throw new Error('Opérations financières invalides.');
  if (!object(value.attention) || typeof value.attention.customerReceivables !== 'boolean' || typeof value.attention.supplierPayables !== 'boolean' || typeof value.attention.negativeCash !== 'boolean') throw new Error('Indicateurs financiers invalides.');
  return value as FinanceSummary;
}
