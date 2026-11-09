import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { convertQuantity } from '../stock-movements/stock-decimal.js';
import { createMovementInTransaction } from '../stock-movements/create-movement-in-transaction.js';
import { withPurchaseTransaction, type PurchaseTransaction } from './purchase-transaction.js';
import { lineTotal, moneyUnits, purchaseId, totalAmount, validatePurchase } from './purchase-validation.js';
import { paymentSummary, validatePayment } from './dto/create-purchase-payment.dto.js';
import type { CreatePurchaseDto, PurchaseLineInput } from './dto/create-purchase.dto.js';
import { recordPaymentMovement } from '../cash/cash-payment.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';

@Injectable()
export class PurchasesService {
  private async detail(tx: PurchaseTransaction, id: number) {
    const purchase = await tx.orm.public.Purchase.first({ id });
    if (!purchase) throw new NotFoundException('Achat introuvable.');
    const supplier = await tx.orm.public.Supplier.first({ id: purchase.supplierId });
    const rows = await tx.orm.public.PurchaseLine.where({ purchaseId: id }).orderBy((line) => line.id.asc()).all();
    const lines = [];
    for (const line of rows) {
      const product = await tx.orm.public.Product.first({ id: line.productId });
      lines.push({ ...line, product });
    }
    const payments = await this.paymentHistory(tx, id);
    const total = totalAmount(lines);
    return { ...purchase, supplier, lines, totalAmount: total, ...paymentSummary(total, payments), payments };
  }
  private paymentHistory(tx: PurchaseTransaction, id: number) {
    return tx.orm.public.PurchasePayment.where({ purchaseId: id }).orderBy([(payment) => payment.paymentDate.desc(), (payment) => payment.id.desc()]).all();
  }
  findPayments(id: number) {
    return withPurchaseTransaction(async (tx) => {
      const purchase = await tx.orm.public.Purchase.first({ id: purchaseId(id) });
      if (!purchase) throw new NotFoundException('Achat introuvable.');
      return await this.paymentHistory(tx, id);
    }, true);
  }
  addPayment(id: number, body: unknown) {
    const input = validatePayment(body);
    return withPurchaseTransaction(async (tx) => {
      await tx.client.query('SELECT id FROM public.purchase WHERE id = $1 FOR UPDATE', [purchaseId(id)]);
      const purchase = await tx.orm.public.Purchase.first({ id });
      if (!purchase) throw new NotFoundException('Achat introuvable.');
      if (purchase.status !== 'CONFIRMED') throw new ConflictException('Seul un achat confirmé peut recevoir un paiement.');
      const lines = await tx.orm.public.PurchaseLine.where({ purchaseId: id }).all();
      const summary = paymentSummary(totalAmount(lines), await this.paymentHistory(tx, id));
      if (moneyUnits(input.amount) > moneyUnits(summary.remainingAmount)) throw new ConflictException(`Le montant dépasse le reste à payer : ${summary.remainingAmount} DT.`);
      const payment = await tx.orm.public.PurchasePayment.create({ ...input, purchaseId: id });
      await recordPaymentMovement(tx, 'PURCHASE_PAYMENT', payment, purchase.reference);
      return audited(tx, 'PURCHASE_PAYMENT_CREATE', 'PURCHASE_PAYMENT', payment, { amount: input.amount, paymentMethod: input.paymentMethod, purchaseId: id }, undefined, purchase.reference);
    });
  }
  private async draft(tx: PurchaseTransaction, id: number) {
    await tx.client.query('SELECT id FROM public.purchase WHERE id = $1 FOR UPDATE', [purchaseId(id)]);
    const purchase = await tx.orm.public.Purchase.first({ id });
    if (!purchase) throw new NotFoundException('Achat introuvable.');
    if (purchase.status !== 'DRAFT') throw new ConflictException('Seul un achat brouillon peut être modifié ou confirmé. Cet achat est déjà confirmé ou annulé.');
    return purchase;
  }
  private async activeSupplier(tx: PurchaseTransaction, id: number) {
    await tx.client.query('SELECT id FROM public.supplier WHERE id = $1 FOR SHARE', [id]);
    const supplier = await tx.orm.public.Supplier.first({ id });
    if (!supplier) throw new NotFoundException('Fournisseur introuvable.');
    if (!supplier.isActive) throw new ConflictException('Le fournisseur est inactif.');
  }
  private async lockProducts(tx: PurchaseTransaction, lines: readonly PurchaseLineInput[]) {
    // Same product locks as manual movements and product edits, in stable order.
    const ids = [...new Set(lines.map((line) => line.productId))].sort((a, b) => a - b);
    const locked = await tx.client.query<{ id: number }>('SELECT id FROM public.product WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
    if (locked.rowCount !== ids.length) throw new NotFoundException("Produit introuvable dans les lignes d'achat.");
  }
  private async prepareLines(tx: PurchaseTransaction, lines: readonly PurchaseLineInput[]) {
    await this.lockProducts(tx, lines);
    const prepared = [];
    for (const line of lines) {
      const product = await tx.orm.public.Product.first({ id: line.productId });
      if (!product) throw new NotFoundException('Produit introuvable.');
      prepared.push({ ...line, quantityInStorageUnit: convertQuantity(line.quantity, line.unit, product), lineTotal: lineTotal(line.quantity, line.unitPurchasePrice) });
    }
    return prepared;
  }
  private async writeDraft(tx: PurchaseTransaction, input: CreatePurchaseDto, id?: number) {
    await this.activeSupplier(tx, input.supplierId);
    const duplicate = await tx.orm.public.Purchase.first({ reference: input.reference });
    if (duplicate && duplicate.id !== id) throw new ConflictException('Cette référence achat est déjà utilisée.');
    const lines = await this.prepareLines(tx, input.lines);
    const fields = { reference: input.reference, supplierId: input.supplierId, purchaseDate: input.purchaseDate, notes: input.notes ?? null };
    const purchase = id === undefined ? await tx.orm.public.Purchase.create(fields) : await tx.orm.public.Purchase.where({ id }).update(fields);
    if (!purchase) throw new NotFoundException('Achat introuvable.');
    if (id !== undefined) await tx.orm.public.PurchaseLine.where({ purchaseId: id }).deleteAll();
    for (const line of lines) await tx.orm.public.PurchaseLine.create({ ...line, purchaseId: purchase.id });
    return this.detail(tx, purchase.id);
  }
  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error: unknown) { if (isUniqueViolation(error)) throw new ConflictException('Cette référence achat est déjà utilisée.'); throw error; }
  }
  create(body: unknown) {
    const input = validatePurchase(body, false);
    return this.unique(() => withPurchaseTransaction(async tx => audited(tx, 'PURCHASE_CREATE', 'PURCHASE', await this.writeDraft(tx, input))));
  }
  findAll() {
    return withPurchaseTransaction(async (tx) => {
      const purchases = await tx.orm.public.Purchase.orderBy((purchase) => purchase.id.desc()).all();
      const results = [];
      for (const purchase of purchases) results.push(await this.detail(tx, purchase.id));
      return results;
    }, true);
  }
  findOne(id: number) { return withPurchaseTransaction((tx) => this.detail(tx, purchaseId(id)), true); }
  update(id: number, body: unknown) {
    const changes = validatePurchase(body, true);
    return this.unique(() => withPurchaseTransaction(async (tx) => {
      const existing = await this.draft(tx, id);
      const lines = await tx.orm.public.PurchaseLine.where({ purchaseId: id }).all();
      const input = validatePurchase({ reference: existing.reference, supplierId: existing.supplierId, purchaseDate: existing.purchaseDate, notes: existing.notes,
        lines: lines.map(({ productId, quantity, unit, unitPurchasePrice }) => ({ productId, quantity, unit, unitPurchasePrice })), ...changes }, false);
      return audited(tx, 'PURCHASE_UPDATE', 'PURCHASE', await this.writeDraft(tx, input, id), { changedFields: changedFields(changes) });
    }));
  }
  confirm(id: number) {
    return withPurchaseTransaction(async (tx) => {
      const purchase = await this.draft(tx, id);
      await this.activeSupplier(tx, purchase.supplierId);
      const lines = await tx.orm.public.PurchaseLine.where({ purchaseId: id }).orderBy((line) => line.id.asc()).all();
      if (!lines.length) throw new ConflictException("L'achat ne contient aucune ligne.");
      await this.lockProducts(tx, lines);
      for (const line of lines) {
        const movement = await createMovementInTransaction(tx, { productId: line.productId, quantity: line.quantity, unit: line.unit, type: 'ENTRY', reference: purchase.reference, reason: 'Achat fournisseur' });
        // A draft's conversion is provisional: retain the exact conversion used at confirmation.
        await tx.orm.public.PurchaseLine.where({ id: line.id }).update({ quantityInStorageUnit: movement.quantityInStorageUnit });
      }
      await tx.orm.public.Purchase.where({ id }).update({ status: 'CONFIRMED', confirmedAt: new Date().toISOString() });
      return audited(tx, 'PURCHASE_CONFIRM', 'PURCHASE', await this.detail(tx, id));
    });
  }
}
