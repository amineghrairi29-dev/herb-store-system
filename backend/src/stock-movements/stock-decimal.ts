import { BadRequestException } from '@nestjs/common';

const SCALE = 10n ** 18n;

/** Fixed-point inventory arithmetic: no binary floating-point conversion. */
export function decimalUnits(value: unknown): bigint {
  if (typeof value !== 'string' || !/^\d{1,60}(?:\.\d{1,18})?$/.test(value)) {
    throw new BadRequestException('Une chaîne décimale positive est requise (18 décimales maximum).');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, '0'));
}

export function decimalString(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % SCALE).toString().padStart(18, '0').replace(/0+$/, '').padEnd(3, '0');
  return `${sign}${absolute / SCALE}.${fraction}`;
}

export function convertQuantity(quantity: string, unit: string, product: {
  storageUnit: string; saleUnit: string; conversionFactor: string;
}): string {
  const amount = decimalUnits(quantity);
  const factor = decimalUnits(product.conversionFactor);
  if (amount <= 0n || factor <= 0n) throw new BadRequestException('La quantité et le facteur doivent être supérieurs à 0.');
  if (product.storageUnit === product.saleUnit && factor !== SCALE) {
    throw new BadRequestException('Pour des unités identiques, le facteur de conversion du produit doit être 1.');
  }
  if (unit === product.storageUnit) return decimalString(amount);
  if (unit !== product.saleUnit) throw new BadRequestException('Unité incompatible avec la configuration du produit.');
  const numerator = amount * SCALE;
  if (numerator % factor !== 0n) {
    throw new BadRequestException('Conversion non exacte à 18 décimales. Saisissez la quantité en unité de stockage.');
  }
  const converted = decimalString(numerator / factor);
  decimalUnits(converted);
  return converted;
}

export const movementTypes = ['ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN'] as const;
export type MovementType = typeof movementTypes[number];
export const positiveTypes: readonly string[] = ['ENTRY', 'ADJUSTMENT_IN', 'RETURN_IN'];

export function aggregateStock(movements: readonly { type: string; quantityInStorageUnit: string }[]): bigint {
  return movements.reduce((total, movement) => {
    const amount = decimalUnits(movement.quantityInStorageUnit);
    return total + (positiveTypes.includes(movement.type) ? amount : -amount);
  }, 0n);
}
