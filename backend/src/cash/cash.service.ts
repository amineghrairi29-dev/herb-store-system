import { Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction as transaction, type PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { purchaseId } from '../purchases/purchase-validation.js';
import { businessDate, validateManual } from './cash-values.js';
import { readCashSummary } from './cash-read.js';
@Injectable()
export class CashService {
  summary() { return transaction(async (tx) => { const { today, timeZone } = businessDate(); return { ...await readCashSummary(tx, today), businessDate: today, timeZone }; }, true); }
  private async linked(tx: PurchaseTransaction, row: NonNullable<Awaited<ReturnType<PurchaseTransaction['orm']['public']['CashMovement']['first']>>>) {
    const salePayment = row.salePaymentId === null ? null : await tx.orm.public.SalePayment.first({ id: row.salePaymentId });
    const purchasePayment = row.purchasePaymentId === null ? null : await tx.orm.public.PurchasePayment.first({ id: row.purchasePaymentId });
    const sale = salePayment ? await tx.orm.public.Sale.first({ id: salePayment.saleId }) : null;
    const purchase = purchasePayment ? await tx.orm.public.Purchase.first({ id: purchasePayment.purchaseId }) : null;
    const expense = row.expenseId === null ? null : await tx.orm.public.Expense.first({ id: row.expenseId });
    return { ...row, linkedSaleId: sale?.id ?? null, linkedPurchaseId: purchase?.id ?? null, linkedExpenseId: expense?.id ?? null, linkedReference: sale?.reference ?? purchase?.reference ?? expense?.reference ?? null };
  }
  findAll() { return transaction(async (tx) => { const rows = await tx.orm.public.CashMovement.orderBy([(row) => row.movementDate.desc(), (row) => row.createdAt.desc(), (row) => row.id.desc()]).all(); const result = []; for (const row of rows) result.push(await this.linked(tx, row)); return result; }, true); }
  findOne(id: number) { return transaction(async (tx) => { const row = await tx.orm.public.CashMovement.first({ id: purchaseId(id) }); if (!row) throw new NotFoundException('Mouvement financier introuvable.'); return this.linked(tx, row); }, true); }
  manual(type: 'IN' | 'OUT', body: unknown) { const input = validateManual(body); return transaction(async tx => audited(tx, type === 'IN' ? 'CASH_MANUAL_IN_CREATE' : 'CASH_MANUAL_OUT_CREATE', 'CASH_MOVEMENT', await tx.orm.public.CashMovement.create({ ...input, type, sourceType: type === 'IN' ? 'MANUAL_IN' : 'MANUAL_OUT', sourceId: null, salePaymentId: null, purchasePaymentId: null }), { amount: input.amount, paymentMethod: input.paymentMethod })); }
}
