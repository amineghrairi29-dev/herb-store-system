import { authRequest } from '@/lib/auth';
export interface Subcategory {
  id: number; categoryId: number; nameAr: string; nameFr: string; slug: string; isActive: boolean; sortOrder: number;
}
export interface Category extends Omit<Subcategory, 'categoryId'> {
  measurementMode: string; isInternal: boolean; allowedUnits: string[]; subcategories: Subcategory[];
}
export const modeLabels: Record<string, string> = { WEIGHT: 'Poids', VOLUME: 'Volume', WEIGHT_AND_VOLUME: 'Poids et volume', FLEXIBLE: 'Flexible' };
function isClassification(value: unknown): value is Subcategory {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'number' && typeof row.nameAr === 'string' && typeof row.nameFr === 'string' && typeof row.slug === 'string' && typeof row.isActive === 'boolean' && typeof row.sortOrder === 'number';
}
export async function fetchCategories(): Promise<Category[]> {
  const result = await authRequest('/categories');
  if (!Array.isArray(result) || !result.every((row: unknown) => {
    if (!isClassification(row)) return false;
    const value = row as unknown as Record<string, unknown>;
    return typeof value.measurementMode === 'string' && typeof value.isInternal === 'boolean' && Array.isArray(value.allowedUnits) && value.allowedUnits.every(unit => typeof unit === 'string') && Array.isArray(value.subcategories) && value.subcategories.every(sub => isClassification(sub) && sub.categoryId === row.id);
  })) throw new Error('Réponse de classification invalide.');
  return result as Category[];
}
