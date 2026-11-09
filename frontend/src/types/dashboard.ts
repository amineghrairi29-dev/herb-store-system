import type { Role } from '@/lib/auth';
export const activityLabels = { SALE: 'Vente', PURCHASE: 'Achat', EXPENSE: 'Dépense', CUSTOMER_PAYMENT: 'Encaissement client', SUPPLIER_PAYMENT: 'Paiement fournisseur', ONLINE_ORDER: 'Commande en ligne' } as const;
export type ActivityType = keyof typeof activityLabels;
export interface DashboardActivity { id: number; type: ActivityType; occurredAt: string; reference: string; description: string; amount: string; href: string; status: string | null }
export interface Dashboard {
  businessDate: string; timeZone: string;
  today: { sales: string; customerCollections: string; purchases: string; expenses: string };
  balances: { physicalCash: string; customerReceivables: string; supplierPayables: string };
  alerts: { pendingOnlineOrders: number; outOfStockProducts: number; lowStockProducts: number };
  stockAttention: { id: number; name: string; category: string; status: 'OUT_OF_STOCK' | 'LOW_STOCK'; stock: string; unit: string }[];
  pendingOrders: { id: number; reference: string; customerName: string; createdAt: string; totalAmount: string }[];
  recentActivity: DashboardActivity[];
}
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const money = (v: unknown) => typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v);
const text = (v: unknown) => typeof v === 'string';
const count = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
export function readDashboard(value: unknown, role: Role): Dashboard {
  const invalid = () => { throw new Error('Réponse du tableau de bord invalide.'); };
  if (!object(value) || !text(value.businessDate) || !text(value.timeZone) || !object(value.today) || !object(value.alerts)) return invalid();
  if (!money(value.today.sales) || !money(value.today.customerCollections) || !['pendingOnlineOrders', 'outOfStockProducts', 'lowStockProducts'].every(k => count((value.alerts as Record<string, unknown>)[k]))) return invalid();
  if (role !== 'ADMIN') return invalid();
  if (!money(value.today.purchases) || !money(value.today.expenses) || !object(value.balances) || !['physicalCash', 'customerReceivables', 'supplierPayables'].every(k => money((value.balances as Record<string, unknown>)[k]))) return invalid();
  if (!Array.isArray(value.stockAttention) || value.stockAttention.length > 5 || !value.stockAttention.every(v => object(v) && count(v.id) && text(v.name) && text(v.category) && ['OUT_OF_STOCK', 'LOW_STOCK'].includes(String(v.status)) && money(v.stock) && text(v.unit))) return invalid();
  if (!Array.isArray(value.pendingOrders) || value.pendingOrders.length > 5 || !value.pendingOrders.every(v => object(v) && count(v.id) && text(v.reference) && text(v.customerName) && text(v.createdAt) && money(v.totalAmount))) return invalid();
  const allowed = Object.keys(activityLabels);
  if (!Array.isArray(value.recentActivity) || value.recentActivity.length > 10 || !value.recentActivity.every(v => object(v) && count(v.id) && allowed.includes(String(v.type)) && text(v.occurredAt) && text(v.reference) && text(v.description) && money(v.amount) && typeof v.href === 'string' && /^\/(sales|purchases|expenses|online-orders)\/\d+$/.test(v.href) && (v.status === null || text(v.status)))) return invalid();
  return value as unknown as Dashboard;
}
