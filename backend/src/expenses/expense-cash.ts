import { ConflictException } from '@nestjs/common';
import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';
import type { ExpenseInput } from './expense-validation.js';

/** Expense-only editing exception: caller owns the transaction and expense row lock. */
export async function syncExpenseCash(tx: PurchaseTransaction, expense: ExpenseInput & { id: number }, creating: boolean) {
  const values = { amount: expense.amount, paymentMethod: expense.paymentMethod, movementDate: expense.expenseDate, reference: expense.reference, description: expense.description, notes: expense.notes };
  if (creating) return tx.orm.public.CashMovement.create({ ...values, type: 'OUT', sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id, salePaymentId: null, purchasePaymentId: null });
  const movement = await tx.orm.public.CashMovement.first({ sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id });
  if (!movement) throw new ConflictException('Le mouvement financier lié est introuvable. La dépense n’a pas été modifiée.');
  return tx.orm.public.CashMovement.where({ id: movement.id }).update(values);
}
