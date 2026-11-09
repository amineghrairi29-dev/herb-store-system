import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { db } from '../prisma/db.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';
import { isUniqueViolation, supplierId, validateSupplier } from './supplier-validation.js';

@Injectable()
export class SuppliersService {
  private duplicate(): never { throw new ConflictException('Ce code fournisseur est déjà utilisé.'); }

  async create(body: unknown) {
    const input = validateSupplier(body, false);
    if (await db.orm.public.Supplier.first({ code: input.code })) this.duplicate();
    try { return await withPurchaseTransaction(async tx => audited(tx, 'SUPPLIER_CREATE', 'SUPPLIER', await tx.orm.public.Supplier.create(input))); }
    catch (error: unknown) { if (isUniqueViolation(error)) this.duplicate(); throw error; }
  }
  findAll() { return db.orm.public.Supplier.orderBy((supplier) => supplier.name.asc()).all(); }
  async findOne(id: number) {
    const supplier = await db.orm.public.Supplier.first({ id: supplierId(id) });
    if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
    return supplier;
  }
  async update(id: number, body: unknown) {
    const input = validateSupplier(body, true);
    const existing = await this.findOne(id);
    if (Object.keys(input).length === 0) return existing;
    if (input.code !== undefined && input.code !== existing.code && await db.orm.public.Supplier.first({ code: input.code })) this.duplicate();
    try {
      return await withPurchaseTransaction(async tx => {
      await tx.client.query('SELECT id FROM public.supplier WHERE id = $1 FOR UPDATE', [id]);
      const before = await tx.orm.public.Supplier.first({ id });
      const updated = await tx.orm.public.Supplier.where({ id }).update(input);
      if (!updated) throw new NotFoundException('Fournisseur introuvable.');
      return audited(tx, input.isActive !== undefined && input.isActive !== before?.isActive ? (input.isActive ? 'SUPPLIER_ACTIVATE' : 'SUPPLIER_DEACTIVATE') : 'SUPPLIER_UPDATE', 'SUPPLIER', updated, { changedFields: changedFields(input), activeBefore: before?.isActive, activeAfter: updated.isActive });
      });
    } catch (error: unknown) { if (isUniqueViolation(error)) this.duplicate(); throw error; }
  }
}
