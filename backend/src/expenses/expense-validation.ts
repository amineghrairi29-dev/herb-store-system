import { BadRequestException } from '@nestjs/common';
import { validatePayment, type PaymentMethod } from '../purchases/dto/create-purchase-payment.dto.js';

export const expenseCategories = ['RENT', 'ELECTRICITY', 'WATER', 'SALARY', 'TRANSPORT', 'MAINTENANCE', 'ADMINISTRATIVE', 'TAX', 'OTHER'] as const;
export type ExpenseCategory = typeof expenseCategories[number];
export interface ExpenseInput { reference: string; category: ExpenseCategory; description: string; amount: string; paymentMethod: PaymentMethod; expenseDate: string; notes: string | null }
export function expenseObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Un objet JSON dépense est requis.');
  for (const key of Object.keys(body)) if (!['reference', 'category', 'description', 'amount', 'paymentMethod', 'expenseDate', 'notes'].includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  return body as Record<string, unknown>;
}
export function validateExpense(body: unknown): ExpenseInput {
  const row = expenseObject(body);
  if (typeof row.reference !== 'string' || !row.reference.trim()) throw new BadRequestException('La référence est obligatoire.');
  if (typeof row.description !== 'string' || !row.description.trim()) throw new BadRequestException('La description est obligatoire.');
  if (!expenseCategories.some((category) => category === row.category)) throw new BadRequestException('Catégorie de dépense invalide.');
  const payment = validatePayment({ amount: row.amount, paymentMethod: row.paymentMethod, paymentDate: row.expenseDate, notes: row.notes ?? null });
  return { reference: row.reference.trim(), category: row.category as ExpenseCategory, description: row.description.trim(), amount: payment.amount, paymentMethod: payment.paymentMethod, expenseDate: payment.paymentDate, notes: payment.notes ?? null };
}
