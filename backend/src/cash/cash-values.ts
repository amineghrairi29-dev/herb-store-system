import { BadRequestException } from '@nestjs/common';
import { moneyString, moneyUnits } from '../purchases/purchase-validation.js';
import { validatePayment } from '../purchases/dto/create-purchase-payment.dto.js';
export function signedMoney(value: bigint): string { return value < 0n ? `-${moneyString(-value)}` : moneyString(value); }
export function businessDate() {
  const timeZone = process.env.CASH_TIME_ZONE || 'Africa/Tunis';
  const parts = new Intl.DateTimeFormat('en', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)!.value;
  return { today: `${part('year')}-${part('month')}-${part('day')}`, timeZone };
}
export function summarizeCash(rows: readonly { amount: string; type: string; paymentMethod: string; movementDate: string }[], today: string) {
  let cashIn = 0n, cashOut = 0n, financialIn = 0n, financialOut = 0n, todayIn = 0n, todayOut = 0n;
  for (const row of rows) {
    const amount = moneyUnits(row.amount), incoming = row.type === 'IN';
    if (incoming) financialIn += amount; else financialOut += amount;
    if (row.paymentMethod !== 'CASH') continue;
    if (incoming) cashIn += amount; else cashOut += amount;
    if (row.movementDate === today) { if (incoming) todayIn += amount; else todayOut += amount; }
  }
  return { physicalCashBalance: signedMoney(cashIn - cashOut), cashInflows: moneyString(cashIn), cashOutflows: moneyString(cashOut), totalFinancialInflows: moneyString(financialIn), totalFinancialOutflows: moneyString(financialOut), netFinancialFlow: signedMoney(financialIn - financialOut), todayCashInflows: moneyString(todayIn), todayCashOutflows: moneyString(todayOut) };
}
export function validateManual(body: unknown) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new BadRequestException('Un objet JSON est requis.');
  const value = body as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!['amount', 'movementDate', 'description', 'reference', 'notes'].includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  if (typeof value.description !== 'string' || !value.description.trim()) throw new BadRequestException('La description est obligatoire.');
  const payment = validatePayment({ amount: value.amount, paymentDate: value.movementDate, paymentMethod: 'CASH', reference: value.reference ?? null, notes: value.notes ?? null });
  return { amount: payment.amount, movementDate: payment.paymentDate, paymentMethod: 'CASH', description: value.description.trim(), reference: payment.reference ?? null, notes: payment.notes ?? null };
}
