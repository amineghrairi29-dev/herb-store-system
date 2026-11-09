import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';
import type { PaymentMethod } from '../purchases/dto/create-purchase-payment.dto.js';

export interface PaymentSource { id: number; amount: string; paymentMethod: PaymentMethod | string; paymentDate: string; reference: string | null; notes: string | null }
/** Caller owns the payment transaction and its parent document lock. */
export async function recordPaymentMovement(tx: PurchaseTransaction, sourceType: 'SALE_PAYMENT' | 'PURCHASE_PAYMENT', payment: PaymentSource, documentReference: string) {
  const existing = await tx.orm.public.CashMovement.first({ sourceType, sourceId: payment.id });
  if (existing) return existing;
  const sale = sourceType === 'SALE_PAYMENT';
  return tx.orm.public.CashMovement.create({ type: sale ? 'IN' : 'OUT', sourceType, sourceId: payment.id,
    salePaymentId: sale ? payment.id : null, purchasePaymentId: sale ? null : payment.id,
    amount: payment.amount, paymentMethod: payment.paymentMethod, movementDate: payment.paymentDate,
    reference: payment.reference || documentReference, description: sale ? 'Paiement vente' : 'Paiement fournisseur', notes: payment.notes });
}
