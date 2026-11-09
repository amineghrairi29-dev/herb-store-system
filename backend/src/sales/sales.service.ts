import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction as withDocumentTransaction, type PurchaseTransaction as DocumentTransaction } from '../purchases/purchase-transaction.js';
import { lineTotal, moneyUnits, purchaseId as documentId, totalAmount } from '../purchases/purchase-validation.js';
import { paymentSummary } from '../purchases/dto/create-purchase-payment.dto.js';
import { validateSalePayment } from './dto/create-sale-payment.dto.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { convertQuantity } from '../stock-movements/stock-decimal.js';
import { createMovementInTransaction } from '../stock-movements/create-movement-in-transaction.js';
import { validateSale } from './sale-validation.js';
import type { CreateSaleDto, SaleLineInput } from './dto/create-sale.dto.js';
import { recordPaymentMovement } from '../cash/cash-payment.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';

@Injectable()
export class SalesService {
  private async detail(tx: DocumentTransaction, id: number) {
    const sale = await tx.orm.public.Sale.first({ id });
    if (!sale) throw new NotFoundException('Vente introuvable.');
    const rows = await tx.orm.public.SaleLine.where({ saleId: id }).orderBy((line) => line.id.asc()).all();
    const lines = [];
    for (const line of rows) lines.push({ ...line, product: await tx.orm.public.Product.first({ id: line.productId }) });
    const total = totalAmount(lines), payments = await this.paymentHistory(tx, id);
    const onlineOrder = await tx.orm.public.OnlineOrder.select('id', 'reference').first({ saleId: id });
    return { ...sale, lines, totalAmount: total, ...paymentSummary(total, payments), payments, onlineOrder: onlineOrder ?? null };
  }
  private paymentHistory(tx: DocumentTransaction, id: number) {
    return tx.orm.public.SalePayment.where({ saleId: id }).orderBy([(payment) => payment.paymentDate.desc(), (payment) => payment.id.desc()]).all();
  }
  findPayments(id: number) {
    return withDocumentTransaction(async (tx) => {
      if (!await tx.orm.public.Sale.first({ id: documentId(id) })) throw new NotFoundException('Vente introuvable.');
      return await this.paymentHistory(tx, id);
    }, true);
  }
  addPayment(id: number, body: unknown) {
    const input = validateSalePayment(body);
    return withDocumentTransaction(async (tx) => {
      await tx.client.query('SELECT id FROM public.sale WHERE id = $1 FOR UPDATE', [documentId(id)]);
      const sale = await tx.orm.public.Sale.first({ id });
      if (!sale) throw new NotFoundException('Vente introuvable.');
      if (sale.status !== 'CONFIRMED') throw new ConflictException('Seule une vente confirmée peut recevoir un paiement.');
      const lines = await tx.orm.public.SaleLine.where({ saleId: id }).all();
      const summary = paymentSummary(totalAmount(lines), await this.paymentHistory(tx, id));
      if (moneyUnits(input.amount) > moneyUnits(summary.remainingAmount)) throw new ConflictException(`Le montant dépasse le reste à payer : ${summary.remainingAmount} DT.`);
      const payment = await tx.orm.public.SalePayment.create({ ...input, saleId: id });
      await recordPaymentMovement(tx, 'SALE_PAYMENT', payment, sale.reference);
      return audited(tx, 'SALE_PAYMENT_CREATE', 'SALE_PAYMENT', payment, { amount: input.amount, paymentMethod: input.paymentMethod, saleId: id }, undefined, sale.reference);
    });
  }
  private async draft(tx: DocumentTransaction, id: number) {
    await tx.client.query('SELECT id FROM public.sale WHERE id = $1 FOR UPDATE', [documentId(id)]);
    const sale = await tx.orm.public.Sale.first({ id });
    if (!sale) throw new NotFoundException('Vente introuvable.');
    if (sale.status !== 'DRAFT') throw new ConflictException('Seule une vente brouillon peut être modifiée ou confirmée. Cette vente est déjà confirmée ou annulée.');
    return sale;
  }
  private async lockProducts(tx: DocumentTransaction, lines: readonly SaleLineInput[]) {
    const ids = [...new Set(lines.map((line) => line.productId))].sort((a, b) => a - b);
    const locked = await tx.client.query<{ id: number }>('SELECT id FROM public.product WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE', [ids]);
    if (locked.rowCount !== ids.length) throw new NotFoundException('Produit introuvable dans les lignes de vente.');
  }
  private async sellableProduct(tx: DocumentTransaction, id: number) {
    const product = await tx.orm.public.Product.first({ id });
    if (!product) throw new NotFoundException('Produit introuvable.');
    if (!product.isActive || !product.isSellable) throw new ConflictException(`Le produit ${product.sku} doit être actif et vendable.`);
    return product;
  }
  private async writeDraft(tx: DocumentTransaction, input: CreateSaleDto, id?: number) {
    const duplicate = await tx.orm.public.Sale.first({ reference: input.reference });
    if (duplicate && duplicate.id !== id) throw new ConflictException('Cette référence vente est déjà utilisée.');
    await this.lockProducts(tx, input.lines);
    const lines = [];
    for (const line of input.lines) {
      const product = await this.sellableProduct(tx, line.productId);
      lines.push({ ...line, quantityInStorageUnit: convertQuantity(line.quantity, line.unit, product), lineTotal: lineTotal(line.quantity, line.unitSalePrice) });
    }
    const fields = { reference: input.reference, saleDate: input.saleDate, customerName: input.customerName ?? null, customerPhone: input.customerPhone ?? null, notes: input.notes ?? null };
    const sale = id === undefined ? await tx.orm.public.Sale.create(fields) : await tx.orm.public.Sale.where({ id }).update(fields);
    if (!sale) throw new NotFoundException('Vente introuvable.');
    if (id !== undefined) await tx.orm.public.SaleLine.where({ saleId: id }).deleteAll();
    for (const line of lines) await tx.orm.public.SaleLine.create({ ...line, saleId: sale.id });
    return this.detail(tx, sale.id);
  }
  private async unique<T>(work: () => Promise<T>): Promise<T> {
    try { return await work(); }
    catch (error: unknown) { if (isUniqueViolation(error)) throw new ConflictException('Cette référence vente est déjà utilisée.'); throw error; }
  }
  create(body: unknown) {
    const input = validateSale(body, false);
    return this.unique(() => withDocumentTransaction(async tx => audited(tx, 'SALE_CREATE', 'SALE', await this.writeDraft(tx, input))));
  }
  /** Allows a caller to atomically create a normal draft and its source link. */
  createDraftInTransaction(tx: DocumentTransaction, body: unknown) {
    return this.writeDraft(tx, validateSale(body, false));
  }
  findAll() {
    return withDocumentTransaction(async (tx) => {
      const sales = await tx.orm.public.Sale.orderBy((sale) => sale.id.desc()).all();
      const result = [];
      for (const sale of sales) result.push(await this.detail(tx, sale.id));
      return result;
    }, true);
  }
  findOne(id: number) { return withDocumentTransaction((tx) => this.detail(tx, documentId(id)), true); }
  update(id: number, body: unknown) {
    const changes = validateSale(body, true);
    return this.unique(() => withDocumentTransaction(async (tx) => {
      const sale = await this.draft(tx, id);
      const lines = await tx.orm.public.SaleLine.where({ saleId: id }).all();
      const input = validateSale({ reference: sale.reference, saleDate: sale.saleDate, customerName: sale.customerName, customerPhone: sale.customerPhone, notes: sale.notes,
        lines: lines.map(({ productId, quantity, unit, unitSalePrice }) => ({ productId, quantity, unit, unitSalePrice })), ...changes }, false);
      return audited(tx, 'SALE_UPDATE', 'SALE', await this.writeDraft(tx, input, id), { changedFields: changedFields(changes) });
    }));
  }
  confirm(id: number) {
    return withDocumentTransaction(async (tx) => {
      const sale = await this.draft(tx, id);
      const lines = await tx.orm.public.SaleLine.where({ saleId: id }).orderBy((line) => line.id.asc()).all();
      if (!lines.length) throw new ConflictException('La vente ne contient aucune ligne.');
      await this.lockProducts(tx, lines);
      for (const line of lines) {
        await this.sellableProduct(tx, line.productId);
        const movement = await createMovementInTransaction(tx, { productId: line.productId, type: 'EXIT', quantity: line.quantity, unit: line.unit, reference: sale.reference, reason: 'Vente' });
        await tx.orm.public.SaleLine.where({ id: line.id }).update({ quantityInStorageUnit: movement.quantityInStorageUnit });
      }
      await tx.orm.public.Sale.where({ id }).update({ status: 'CONFIRMED', confirmedAt: new Date().toISOString() });
      return audited(tx, 'SALE_CONFIRM', 'SALE', await this.detail(tx, id));
    });
  }
}
