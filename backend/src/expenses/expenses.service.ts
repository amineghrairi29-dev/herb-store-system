import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction as transaction } from '../purchases/purchase-transaction.js';
import { purchaseId } from '../purchases/purchase-validation.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';
import { expenseObject, validateExpense } from './expense-validation.js';
import { syncExpenseCash } from './expense-cash.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';

@Injectable()
export class ExpensesService {
  findAll() { return transaction(async (tx) => await tx.orm.public.Expense.orderBy([(row) => row.expenseDate.desc(), (row) => row.id.desc()]).all(), true); }
  findOne(id: number) { return transaction(async (tx) => { const expense = await tx.orm.public.Expense.first({ id: purchaseId(id) }); if (!expense) throw new NotFoundException('Dépense introuvable.'); return expense; }, true); }
  async create(body: unknown) {
    const input = validateExpense(body);
    try { return await transaction(async (tx) => {
      const expense = await tx.orm.public.Expense.create(input);
      await syncExpenseCash(tx, { ...input, id: expense.id }, true);
      return audited(tx, 'EXPENSE_CREATE', 'EXPENSE', expense, { amount: input.amount, paymentMethod: input.paymentMethod });
    }); } catch (error: unknown) { if (isUniqueViolation(error)) throw new ConflictException('Cette référence de dépense existe déjà.'); throw error; }
  }
  async update(id: number, body: unknown) {
    purchaseId(id); const patch = expenseObject(body);
    try { return await transaction(async (tx) => {
      await tx.client.query('SELECT id FROM public.expense WHERE id = $1 FOR UPDATE', [id]);
      const current = await tx.orm.public.Expense.first({ id });
      if (!current) throw new NotFoundException('Dépense introuvable.');
      const { reference, category, description, amount, paymentMethod, expenseDate, notes } = current;
      const input = validateExpense({ reference, category, description, amount, paymentMethod, expenseDate, notes, ...patch });
      const expense = await tx.orm.public.Expense.where({ id }).update(input);
      await syncExpenseCash(tx, { ...input, id }, false);
      return audited(tx, 'EXPENSE_UPDATE', 'EXPENSE', expense, { changedFields: changedFields(patch) });
    }); } catch (error: unknown) { if (isUniqueViolation(error)) throw new ConflictException('Cette référence de dépense existe déjà.'); throw error; }
  }
}
