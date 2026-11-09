import { BadRequestException } from '@nestjs/common';

export const measurementUnits = {
  WEIGHT: ['G', 'KG'], VOLUME: ['ML', 'L'],
  WEIGHT_AND_VOLUME: ['G', 'KG', 'ML', 'L'], FLEXIBLE: ['G', 'KG', 'ML', 'L', 'PIECE'],
} as const;
export function validateMeasurement(mode: string, storageUnit: string, saleUnit: string) {
  if (!Object.hasOwn(measurementUnits, mode)) throw new BadRequestException('Mode de mesure invalide.');
  const units: readonly string[] = measurementUnits[mode as keyof typeof measurementUnits];
  if (!units.includes(storageUnit) || !units.includes(saleUnit)) throw new BadRequestException('Les unités doivent correspondre au mode de mesure du produit.');
}
