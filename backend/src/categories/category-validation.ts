import { BadRequestException } from '@nestjs/common';
import { measurementUnits } from '../products/product-measurement.js';
export { measurementUnits } from '../products/product-measurement.js';

export type MeasurementMode = keyof typeof measurementUnits;
export function allowedUnits(mode: string): readonly string[] {
  if (!Object.hasOwn(measurementUnits, mode)) throw new BadRequestException('Mode de mesure invalide.');
  return measurementUnits[mode as MeasurementMode];
}
export function categoryId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > 2147483647) throw new BadRequestException('Identifiant de classification invalide.');
  return value;
}
export type CategoryInput = { nameAr: string; nameFr: string; slug: string; measurementMode: string; isActive?: boolean; sortOrder?: number };
export function categoryInput(raw: unknown, partial: boolean, subcategory = false): Partial<CategoryInput> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Un objet JSON est requis.');
  const input = { ...raw } as Record<string, unknown>;
  const required = ['nameAr', 'nameFr', 'slug', ...(subcategory ? [] : ['measurementMode'])];
  for (const key of Object.keys(input)) if (![...required, 'isActive', 'sortOrder'].includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  for (const key of required) {
    if (partial && input[key] === undefined) continue;
    if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > 160) throw new BadRequestException(`Le champ ${key} est obligatoire (160 caractères maximum).`);
    input[key] = input[key].trim();
  }
  if (input.slug !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(input.slug))) throw new BadRequestException('Slug invalide : utilisez des lettres minuscules, chiffres et tirets.');
  if (input.measurementMode !== undefined) allowedUnits(String(input.measurementMode));
  if (input.isActive !== undefined && typeof input.isActive !== 'boolean') throw new BadRequestException('Le statut doit être un booléen.');
  if (input.sortOrder !== undefined && (!Number.isInteger(input.sortOrder) || Number(input.sortOrder) < 0 || Number(input.sortOrder) > 2147483647)) throw new BadRequestException('L’ordre doit être un entier positif ou nul.');
  return input as Partial<CategoryInput>;
}
