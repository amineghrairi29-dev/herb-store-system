import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import type { ProductTransaction } from '../prisma/product-transaction.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { audited } from '../audit/audit.service.js';

export function classificationIds(value: unknown): number[] {
  if (!Array.isArray(value) || !value.length || value.length > 100 || value.some(id => typeof id !== 'number' || !Number.isInteger(id) || id <= 0 || id > 2147483647)) throw new BadRequestException('Sélectionnez au moins une classification (100 maximum).');
  return [...new Set(value as number[])].sort((a, b) => a - b);
}
export interface ClassificationRow { id: number; nameFr: string; nameAr: string; slug: string; imagePath: string | null; isActive: boolean; sortOrder: number }
export async function productClassifications(tx: ProductTransaction, productId: number): Promise<ClassificationRow[]> {
  return (await tx.client.query<ClassificationRow>('SELECT c.id, c."nameFr", c."nameAr", c.slug, c."imagePath", c."isActive", c."sortOrder" FROM public.classification c JOIN public."productClassification" pc ON pc."classificationId" = c.id WHERE pc."productId" = $1 ORDER BY c."sortOrder", c."nameFr", c.id', [productId])).rows;
}
export async function validateLinks(tx: ProductTransaction, ids: number[], retained: number[] = []) {
  const rows = (await tx.client.query<ClassificationRow>('SELECT * FROM public.classification WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [classificationIds(ids)])).rows;
  if (rows.length !== ids.length) throw new BadRequestException('Classification introuvable.');
  if (rows.some(c => !c.isActive && !retained.includes(c.id))) throw new ConflictException('Une classification désactivée ne peut pas être ajoutée au produit.');
  if (!rows.some(c => c.isActive)) throw new BadRequestException('Sélectionnez au moins un besoin actif. Les liens désactivés sont conservés uniquement pour historique.');
  return rows;
}
export async function replaceLinks(tx: ProductTransaction, productId: number, ids: number[]) {
  await tx.client.query('DELETE FROM public."productClassification" WHERE "productId" = $1 AND NOT ("classificationId" = ANY($2::int[]))', [productId, ids]);
  await tx.client.query('INSERT INTO public."productClassification" ("productId", "classificationId") SELECT $1, unnest($2::int[]) ON CONFLICT ("productId", "classificationId") DO NOTHING', [productId, ids]);
}
function input(raw: unknown, partial: boolean) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Un objet JSON est requis.');
  const values = raw as Record<string, unknown>;
  if (Object.keys(values).some(k => !['nameFr', 'nameAr', 'isActive', 'sortOrder'].includes(k))) throw new BadRequestException('Champ non autorisé.');
  const result: { nameFr?: string; nameAr?: string; isActive?: boolean; sortOrder?: number } = {};
  if (!partial || values.nameFr !== undefined) {
    if (typeof values.nameFr !== 'string' || !values.nameFr.trim() || values.nameFr.length > 160) throw new BadRequestException('Nom requis (160 caractères maximum).');
    result.nameFr = values.nameFr.trim();
  }
  if (values.nameAr !== undefined) { if (typeof values.nameAr !== 'string' || values.nameAr.length > 160) throw new BadRequestException('Nom arabe invalide.'); result.nameAr = values.nameAr.trim(); }
  if (values.isActive !== undefined) { if (typeof values.isActive !== 'boolean') throw new BadRequestException('Statut invalide.'); result.isActive = values.isActive; }
  if (values.sortOrder !== undefined) { if (typeof values.sortOrder !== 'number' || !Number.isInteger(values.sortOrder) || values.sortOrder < 0 || values.sortOrder > 2147483647) throw new BadRequestException('Ordre invalide.'); result.sortOrder = values.sortOrder; }
  return result;
}
@Injectable()
export class ClassificationsService {
  list() { return withPurchaseTransaction(async tx => (await tx.client.query<ClassificationRow & { productCount: number }>('SELECT c.id, c."nameFr", c."nameAr", c.slug, c."imagePath", c."isActive", c."sortOrder", (SELECT count(*)::int FROM public."productClassification" pc WHERE pc."classificationId" = c.id) AS "productCount" FROM public.classification c ORDER BY c."sortOrder", c."nameFr", c.id')).rows, true); }
  async create(raw: unknown) {
    const value = input(raw, false), nameFr = value.nameFr!;
    const slug = (nameFr.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'besoin') + '-' + randomUUID().slice(0, 8);
    return withPurchaseTransaction(async tx => audited(tx, 'CLASSIFICATION_CREATE', 'CLASSIFICATION', await tx.orm.public.Classification.create({ ...value, nameFr, slug }))).catch((error: unknown) => { if (isUniqueViolation(error)) throw new ConflictException('Cette classification existe déjà.'); throw error; });
  }
  update(id: number, raw: unknown) {
    classificationIds([id]); const value = input(raw, true);
    return withPurchaseTransaction(async tx => {
      await tx.client.query('SELECT id FROM public.classification WHERE id = $1 FOR UPDATE', [id]);
      const old = await tx.orm.public.Classification.first({ id });
      if (!old) throw new NotFoundException('Classification introuvable.');
      return audited(tx, 'CLASSIFICATION_UPDATE', 'CLASSIFICATION', await tx.orm.public.Classification.where({ id }).update(value));
    });
  }
}
