import { BadRequestException } from '@nestjs/common';
import { decimalUnits, movementTypes, type MovementType } from '../stock-decimal.js';

export class CreateStockMovementDto {
  productId: number;
  type: MovementType;
  quantity: string;
  unit: string;
  reason?: string;
  reference?: string;
  notes?: string;
}

export function validateMovement(input: unknown): CreateStockMovementDto {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new BadRequestException('Un objet JSON est requis.');
  const values: Record<string, unknown> = { ...input };
  const allowed = ['productId', 'type', 'quantity', 'unit', 'reason', 'reference', 'notes'];
  for (const key of Object.keys(values)) {
    if (!allowed.includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  }
  if (typeof values.productId !== 'number' || !Number.isSafeInteger(values.productId) || values.productId <= 0 || values.productId > 2147483647) {
    throw new BadRequestException('Identifiant de produit invalide.');
  }
  if (!movementTypes.some((type) => type === values.type)) throw new BadRequestException('Type de mouvement invalide.');
  if (decimalUnits(values.quantity) <= 0n) throw new BadRequestException('La quantité doit être supérieure à 0.');
  if (typeof values.unit !== 'string' || !['KG', 'G', 'L', 'ML', 'PIECE'].includes(values.unit)) throw new BadRequestException('Unité invalide.');
  for (const key of ['reason', 'reference', 'notes']) {
    if (values[key] === undefined) continue;
    if (typeof values[key] !== 'string') throw new BadRequestException(`Le champ ${key} doit être un texte.`);
    values[key] = values[key].trim();
  }
  return values as unknown as CreateStockMovementDto;
}
