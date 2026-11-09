import { authRequest } from '@/lib/auth';
export interface Classification { id: number; nameFr: string; nameAr: string; slug: string; isActive: boolean; sortOrder: number; imagePath: string | null; productCount?: number }
export function readClassification(value: unknown): Classification {
  if (!value || typeof value !== 'object') throw new Error('Classification invalide.');
  const c = value as Record<string, unknown>;
  if (typeof c.id !== 'number' || typeof c.nameFr !== 'string' || typeof c.nameAr !== 'string' || typeof c.slug !== 'string' || typeof c.isActive !== 'boolean' || typeof c.sortOrder !== 'number' || (c.imagePath !== null && typeof c.imagePath !== 'string')) throw new Error('Classification invalide.');
  return value as Classification;
}
export async function fetchClassifications() {
  const value = await authRequest('/classifications');
  if (!Array.isArray(value)) throw new Error('Réponse des classifications invalide.');
  return value.map(readClassification);
}
