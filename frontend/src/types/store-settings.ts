export const storeFields = {
  storeName: { label: 'Nom du magasin', max: 160 }, phone: { label: 'Téléphone', max: 40 }, secondaryPhone: { label: 'Téléphone secondaire', max: 40 }, email: { label: 'Email', max: 254 }, website: { label: 'Site web', max: 500 },
  address: { label: 'Adresse', max: 500 }, city: { label: 'Ville', max: 100 }, country: { label: 'Pays', max: 100 }, reportFooter: { label: 'Pied de page des rapports', max: 1000 },
} as const;
export type StoreField = keyof typeof storeFields;
export type StoreSettings = Record<StoreField, string> & { currency: 'TND' };
export type ReportIdentity = { storeName: string; phone: string | null; email: string | null; address: string | null; city: string | null; reportFooter: string | null };
export const fallbackIdentity: ReportIdentity = { storeName: 'Herb Store', phone: null, email: null, address: null, city: null, reportFooter: null };
export function readStoreSettings(value: unknown): StoreSettings {
  if (!value || typeof value !== 'object') throw new Error('Paramètres reçus invalides.');
  const row = value as Record<string, unknown>;
  if (row.currency !== 'TND' || typeof row.storeName !== 'string' || !row.storeName.trim()) throw new Error('Paramètres reçus invalides.');
  const result = { currency: 'TND' } as StoreSettings;
  for (const key of Object.keys(storeFields) as StoreField[]) {
    if (row[key] !== null && typeof row[key] !== 'string') throw new Error('Paramètres reçus invalides.');
    result[key] = row[key] as string | null ?? '';
  }
  return result;
}
export function readReportIdentity(value: unknown): ReportIdentity {
  if (!value || typeof value !== 'object') throw new Error('Identité du magasin invalide.');
  const row = value as Record<string, unknown>;
  if (typeof row.storeName !== 'string' || !row.storeName.trim()) throw new Error('Identité du magasin invalide.');
  const result: ReportIdentity = { ...fallbackIdentity, storeName: row.storeName };
  for (const key of ['phone', 'email', 'address', 'city', 'reportFooter'] as const) {
    if (row[key] !== null && typeof row[key] !== 'string') throw new Error('Identité du magasin invalide.');
    result[key] = row[key] as string | null;
  }
  return result;
}
