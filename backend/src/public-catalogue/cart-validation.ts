import { BadRequestException } from '@nestjs/common';
import { decimalString, decimalUnits } from '../stock-movements/stock-decimal.js';

export interface CartInput { productId: number; quantity: string }
export function cartInput(body: unknown): CartInput[] {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => key !== 'items') || !('items' in body) || !Array.isArray(body.items) || body.items.length > 100) throw new BadRequestException('Un panier de 100 lignes maximum est requis.');
  const seen = new Set<number>();
  return body.items.map((item: unknown) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || Object.keys(item).some((key) => !['productId', 'quantity'].includes(key)) || !('productId' in item) || !('quantity' in item)) throw new BadRequestException('Ligne de panier invalide.');
    const id = item.productId;
    if (typeof id !== 'number' || !Number.isInteger(id) || id < 1 || id > 2147483647 || seen.has(id)) throw new BadRequestException('Identifiant invalide ou produit en double.');
    seen.add(id);
    const quantity = decimalUnits(item.quantity);
    if (quantity <= 0n) throw new BadRequestException('La quantité doit être supérieure à 0.');
    return { productId: id, quantity: decimalString(quantity) };
  });
}
