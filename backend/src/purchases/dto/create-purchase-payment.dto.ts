import { BadRequestException } from '@nestjs/common';
import { moneyString, moneyUnits } from '../purchase-validation.js';

export const paymentMethods = ['CASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER'] as const;
export type PaymentMethod = typeof paymentMethods[number];
export class CreatePurchasePaymentDto {
  amount: string;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
}
export function validatePayment(body: unknown): CreatePurchasePaymentDto {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Un objet JSON paiement est requis.');
  const values: Record<string, unknown> = { ...body };
  for (const key of Object.keys(values)) if (!['amount', 'paymentMethod', 'paymentDate', 'reference', 'notes'].includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  const amount = moneyUnits(values.amount);
  if (amount <= 0n) throw new BadRequestException('Le montant doit être supérieur à 0.');
  if (!paymentMethods.some((method) => method === values.paymentMethod)) throw new BadRequestException('Mode de paiement invalide.');
  const date = values.paymentDate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01' || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new BadRequestException('Date de paiement invalide (AAAA-MM-JJ).');
  for (const key of ['reference', 'notes']) {
    if (values[key] === undefined || values[key] === null) continue;
    if (typeof values[key] !== 'string') throw new BadRequestException(`Le champ ${key} doit être un texte.`);
    values[key] = values[key].trim() || null;
  }
  return { ...values, amount: moneyString(amount) } as unknown as CreatePurchasePaymentDto;
}

export function paymentSummary(total: string, payments: readonly { amount: string }[]) {
  const paid = payments.reduce((sum, payment) => sum + moneyUnits(payment.amount), 0n);
  const remaining = moneyUnits(total) - paid;
  // Negative balances indicate invalid persisted data; never silently hide them.
  if (remaining < 0n) throw new Error('Le total des paiements dépasse le montant de l’achat.');
  const paymentStatus = paid === 0n ? 'NON_PAID' : remaining === 0n ? 'PAID' : 'PARTIALLY_PAID';
  return { totalPaid: moneyString(paid), remainingAmount: moneyString(remaining), paymentStatus };
}
