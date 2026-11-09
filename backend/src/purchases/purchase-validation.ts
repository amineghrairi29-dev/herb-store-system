import { BadRequestException } from '@nestjs/common';
import { decimalString, decimalUnits } from '../stock-movements/stock-decimal.js';
import type { CreatePurchaseDto, PurchaseLineInput, UpdatePurchaseDto } from './dto/create-purchase.dto.js';

export function purchaseId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 2147483647) throw new BadRequestException('Identifiant invalide.');
  return value;
}
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new BadRequestException('Un objet JSON est requis.');
  for (const key of Object.keys(value)) if (!keys.includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  return value as Record<string, unknown>;
}
function positive(value: unknown): string {
  const units = decimalUnits(value);
  if (units <= 0n) throw new BadRequestException('La quantité et le prix doivent être supérieurs à 0.');
  return decimalString(units);
}
export function validatePurchase(body: unknown, partial: false): CreatePurchaseDto;
export function validatePurchase(body: unknown, partial: true): UpdatePurchaseDto;
export function validatePurchase(body: unknown, partial: boolean): UpdatePurchaseDto {
  const value = object(body, ['reference', 'supplierId', 'purchaseDate', 'notes', 'lines']);
  const result: UpdatePurchaseDto = {};
  if (!partial || 'reference' in value) {
    if (typeof value.reference !== 'string' || !value.reference.trim()) throw new BadRequestException('La référence est obligatoire.');
    result.reference = value.reference.trim();
  }
  if (!partial || 'supplierId' in value) result.supplierId = purchaseId(value.supplierId);
  if (!partial || 'purchaseDate' in value) {
    const date = value.purchaseDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01' || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new BadRequestException("Date d'achat invalide (AAAA-MM-JJ).");
    result.purchaseDate = date;
  }
  if ('notes' in value) {
    if (value.notes !== null && typeof value.notes !== 'string') throw new BadRequestException('Les notes doivent être un texte.');
    result.notes = typeof value.notes === 'string' ? value.notes.trim() || null : null;
  }
  if (!partial || 'lines' in value) {
    if (!Array.isArray(value.lines) || value.lines.length === 0) throw new BadRequestException("Au moins une ligne d'achat est requise.");
    const seen = new Set<number>();
    result.lines = value.lines.map((raw: unknown): PurchaseLineInput => {
      const line = object(raw, ['productId', 'quantity', 'unit', 'unitPurchasePrice']);
      const productId = purchaseId(line.productId);
      if (seen.has(productId)) throw new BadRequestException('Un produit ne peut apparaître que sur une seule ligne.');
      seen.add(productId);
      if (typeof line.unit !== 'string' || !['KG', 'G', 'L', 'ML', 'PIECE'].includes(line.unit)) throw new BadRequestException('Unité invalide.');
      return { productId, quantity: positive(line.quantity), unit: line.unit, unitPurchasePrice: positive(line.unitPurchasePrice) };
    });
  }
  return result;
}

// Inputs have up to 18 decimal places each. Preserve all 36 product decimals.
const MONEY_SCALE = 10n ** 36n;
export function moneyUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{1,130}(?:\.\d{1,36})?$/.test(value)) throw new BadRequestException('Un montant décimal en texte est requis (36 décimales maximum).');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * MONEY_SCALE + BigInt(fraction.padEnd(36, '0'));
}
export function moneyString(value: bigint): string {
  return `${value / MONEY_SCALE}.${(value % MONEY_SCALE).toString().padStart(36, '0').replace(/0+$/, '').padEnd(3, '0')}`;
}
export function lineTotal(quantity: string, price: string): string { return moneyString(decimalUnits(quantity) * decimalUnits(price)); }
export function totalAmount(lines: readonly { lineTotal: string }[]): string {
  return moneyString(lines.reduce((sum, line) => sum + moneyUnits(line.lineTotal), 0n));
}
