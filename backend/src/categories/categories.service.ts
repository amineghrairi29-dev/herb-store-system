import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { allowedUnits, categoryId, categoryInput, type CategoryInput } from './category-validation.js';

function writeError(error: unknown): never {
  if (isUniqueViolation(error)) throw new ConflictException('Ce slug est déjà utilisé.');
  throw error;
}
@Injectable()
export class CategoriesService {
  async list() {
    return withPurchaseTransaction(async tx => {
      const categories = await tx.orm.public.Category.all();
      const subcategories = await tx.orm.public.Subcategory.all();
      const order = (a: { sortOrder: number; nameFr: string; id: number }, b: typeof a) => a.sortOrder - b.sortOrder || a.nameFr.localeCompare(b.nameFr, 'fr') || a.id - b.id;
      return categories.sort(order).map(c => ({ ...c, allowedUnits: allowedUnits(c.measurementMode), subcategories: subcategories.filter(s => s.categoryId === c.id).sort(order) }));
    }, true);
  }
  async detail(id: number) {
    categoryId(id);
    const result = (await this.list()).find(c => c.id === id);
    if (!result) throw new NotFoundException('Catégorie introuvable.');
    return result;
  }
  async create(raw: unknown) {
    const input = categoryInput(raw, false) as CategoryInput;
    return withPurchaseTransaction(async tx => audited(tx, 'CATEGORY_CREATE', 'CATEGORY', await tx.orm.public.Category.create(input), undefined, undefined, input.slug)).catch(writeError);
  }
  async update(id: number, raw: unknown) {
    categoryId(id);
    const input = categoryInput(raw, true);
    return withPurchaseTransaction(async tx => {
      await tx.client.query('SELECT id FROM public.category WHERE id = $1 FOR UPDATE', [id]);
      const old = await tx.orm.public.Category.first({ id });
      if (!old) throw new NotFoundException('Catégorie introuvable.');
      if (old.isInternal) throw new ConflictException('La catégorie interne de migration ne peut pas être modifiée. Reclassez ses produits.');
      if (input.measurementMode && input.measurementMode !== old.measurementMode) {
        const units = allowedUnits(input.measurementMode);
        const incompatible = await tx.client.query('SELECT id FROM public.product WHERE "categoryId" = $1 AND (NOT ("storageUnit" = ANY($2::text[])) OR NOT ("saleUnit" = ANY($2::text[]))) LIMIT 1', [id, units]);
        if (incompatible.rowCount) throw new ConflictException('Ce mode rendrait les unités de produits existants incompatibles. Reclassez ces produits avant de modifier le mode.');
      }
      const result = await tx.orm.public.Category.where({ id }).update(input);
      await audited(tx, 'CATEGORY_UPDATE', 'CATEGORY', result, { changedFields: changedFields(input) }, id, input.slug ?? old.slug);
      if (input.isActive !== undefined && input.isActive !== old.isActive) await audited(tx, input.isActive ? 'CATEGORY_ACTIVATE' : 'CATEGORY_DEACTIVATE', 'CATEGORY', result, { activeBefore: old.isActive, activeAfter: input.isActive }, id, old.slug);
      return result;
    }).catch(writeError);
  }
  async subcategories(id: number) { return (await this.detail(id)).subcategories; }
  async createSubcategory(id: number, raw: unknown) {
    categoryId(id);
    const input = categoryInput(raw, false, true) as Omit<CategoryInput, 'measurementMode'>;
    return withPurchaseTransaction(async tx => {
      await tx.client.query('SELECT id FROM public.category WHERE id = $1 FOR UPDATE', [id]);
      const parent = await tx.orm.public.Category.first({ id });
      if (!parent) throw new NotFoundException('Catégorie introuvable.');
      if (!parent.isActive || parent.isInternal) throw new ConflictException('La catégorie parente doit être active.');
      return audited(tx, 'SUBCATEGORY_CREATE', 'SUBCATEGORY', await tx.orm.public.Subcategory.create({ ...input, categoryId: id }), undefined, undefined, input.slug);
    }).catch(writeError);
  }
  async updateSubcategory(id: number, raw: unknown) {
    categoryId(id);
    const input = categoryInput(raw, true, true);
    const found = await db.orm.public.Subcategory.first({ id });
    if (!found) throw new NotFoundException('Sous-catégorie introuvable.');
    return withPurchaseTransaction(async tx => {
      await tx.client.query('SELECT id FROM public.category WHERE id = $1 FOR UPDATE', [found.categoryId]);
      const old = await tx.orm.public.Subcategory.first({ id });
      if (!old) throw new NotFoundException('Sous-catégorie introuvable.');
      const result = await tx.orm.public.Subcategory.where({ id }).update(input);
      await audited(tx, 'SUBCATEGORY_UPDATE', 'SUBCATEGORY', result, { changedFields: changedFields(input) }, id, input.slug ?? old.slug);
      if (input.isActive !== undefined && input.isActive !== old.isActive) await audited(tx, input.isActive ? 'SUBCATEGORY_ACTIVATE' : 'SUBCATEGORY_DEACTIVATE', 'SUBCATEGORY', result, { activeBefore: old.isActive, activeAfter: input.isActive }, id, old.slug);
      return result;
    }).catch(writeError);
  }
}
