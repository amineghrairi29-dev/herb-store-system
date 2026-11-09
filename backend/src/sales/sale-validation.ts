import { BadRequestException } from '@nestjs/common';
import { decimalString, decimalUnits } from '../stock-movements/stock-decimal.js';
import { purchaseId as documentId } from '../purchases/purchase-validation.js';
import type { CreateSaleDto, SaleLineInput, UpdateSaleDto } from './dto/create-sale.dto.js';

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
export function validateSale(body: unknown, partial: false): CreateSaleDto;
export function validateSale(body: unknown, partial: true): UpdateSaleDto;
export function validateSale(body: unknown, partial: boolean): UpdateSaleDto {
  const value = object(body, ['reference', 'saleDate', 'customerName', 'customerPhone', 'notes', 'lines']);
  const result: UpdateSaleDto = {};
  if (!partial || 'reference' in value) {
    if (typeof value.reference !== 'string' || !value.reference.trim()) throw new BadRequestException('La référence est obligatoire.');
    result.reference = value.reference.trim();
  }
  if (!partial || 'saleDate' in value) {
    const date = value.saleDate;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '0001-01-01' || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new BadRequestException('Date de vente invalide (AAAA-MM-JJ).');
    result.saleDate = date;
  }
  for (const key of ['customerName', 'customerPhone', 'notes'] as const) {
    if (!(key in value)) continue;
    const text = value[key];
    if (text !== null && typeof text !== 'string') throw new BadRequestException(`Le champ ${key} doit être un texte.`);
    result[key] = typeof text === 'string' ? text.trim() || null : null;
  }
  if (!partial || 'lines' in value) {
    if (!Array.isArray(value.lines) || !value.lines.length) throw new BadRequestException('Au moins une ligne de vente est requise.');
    const seen = new Set<number>();
    result.lines = value.lines.map((raw: unknown): SaleLineInput => {
      const line = object(raw, ['productId', 'quantity', 'unit', 'unitSalePrice']);
      const productId = documentId(line.productId);
      if (seen.has(productId)) throw new BadRequestException('Un produit ne peut apparaître que sur une seule ligne.');
      seen.add(productId);
      if (typeof line.unit !== 'string' || !['KG', 'G', 'L', 'ML', 'PIECE'].includes(line.unit)) throw new BadRequestException('Unité invalide.');
      return { productId, quantity: positive(line.quantity), unit: line.unit, unitSalePrice: positive(line.unitSalePrice) };
    });
  }
  return result;
}
