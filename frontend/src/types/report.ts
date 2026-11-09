export const reportCatalog = {
  sales: { title: 'Rapport des ventes', description: 'Ventes, encaissements liés et créances.', filters: ['status', 'paymentStatus', 'search'] },
  purchases: { title: 'Rapport des achats', description: 'Achats, paiements liés et dettes fournisseurs.', filters: ['supplierId', 'status', 'paymentStatus', 'search'] },
  expenses: { title: 'Rapport des dépenses', description: 'Dépenses par catégorie et mode de paiement.', filters: ['category', 'paymentMethod', 'search'] },
  'customer-collections': { title: 'Encaissements clients', description: 'Paiements reçus selon leur date de paiement.', filters: ['paymentMethod', 'search'] },
  'supplier-payments': { title: 'Paiements fournisseurs', description: 'Règlements par fournisseur et date de paiement.', filters: ['supplierId', 'paymentMethod', 'search'] },
  cash: { title: 'Rapport de caisse', description: 'Mouvements financiers et impact espèces.', filters: ['type', 'sourceType', 'paymentMethod'] },
  'financial-summary': { title: 'Synthèse financière', description: 'Activité sur la période et soldes à la date de fin.', filters: [] },
} as const;
export type ReportKind = keyof typeof reportCatalog;
export function isReportKind(value: string): value is ReportKind { return Object.hasOwn(reportCatalog, value); }
export interface ReportColumn { key: string; label: string; format: 'text' | 'date' | 'money' | 'count' }
export interface Report {
  title: string; note: string; generatedAt: string; period: { dateFrom: string; dateTo: string; timeZone: string };
  filters: Record<string, string>; columns: ReportColumn[]; summaryFields: ReportColumn[]; summary: Record<string, string>;
  data: Record<string, string | null>[]; complete: boolean;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings = (value: unknown): value is Record<string, string> => object(value) && Object.values(value).every((item) => typeof item === 'string');
const column = (value: unknown): value is ReportColumn => object(value) && typeof value.key === 'string' && typeof value.label === 'string' && ['text', 'date', 'money', 'count'].includes(String(value.format));
export function readReport(value: unknown): Report {
  if (!object(value) || typeof value.title !== 'string' || typeof value.note !== 'string' || typeof value.generatedAt !== 'string' || typeof value.complete !== 'boolean' || !strings(value.period) || !['dateFrom', 'dateTo', 'timeZone'].every((key) => typeof (value.period as Record<string, string>)[key] === 'string') || !strings(value.filters) || !strings(value.summary)) throw new Error('Réponse rapport invalide.');
  if (!Array.isArray(value.columns) || !value.columns.every(column) || !Array.isArray(value.summaryFields) || !value.summaryFields.every(column) || !Array.isArray(value.data) || !value.data.every((row: unknown) => object(row) && Object.values(row).every((cell) => cell === null || typeof cell === 'string'))) throw new Error('Données de rapport invalides.');
  if (!object(value.pagination) || !['page', 'pageSize', 'totalItems', 'totalPages'].every((key) => Number.isSafeInteger((value.pagination as Record<string, unknown>)[key]) && Number((value.pagination as Record<string, unknown>)[key]) >= 0)) throw new Error('Pagination invalide.');
  return value as unknown as Report;
}
