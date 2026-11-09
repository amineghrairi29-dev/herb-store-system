import { classificationIds } from '../classifications/classifications.service.js';
import { measurementUnits } from './product-measurement.js';
import { BadRequestException } from '@nestjs/common';
import type { CreateProductDto } from './dto/create-product.dto.js';
import type { UpdateProductDto } from './dto/update-product.dto.js';

const requiredText = ['sku', 'name', 'productType', 'measurementMode', 'storageUnit', 'saleUnit'] as const;
const optionalText = ['nameFr', 'scientificName', 'barcode', 'origin', 'packaging', 'description', 'location'] as const;
const decimals = ['salePrice', 'conversionFactor', 'minStock', 'maxStock'] as const;
const booleans = ['isActive', 'isSellable', 'isVisibleOnline'] as const;
const units = ['KG', 'G', 'L', 'ML', 'PIECE'];

export function compareDecimals(left: string, right: string): number {
  const [leftWhole, leftFraction = ''] = left.split('.');
  const [rightWhole, rightFraction = ''] = right.split('.');
  const a = leftWhole.replace(/^0+(?=\d)/, '');
  const b = rightWhole.replace(/^0+(?=\d)/, '');
  if (a.length !== b.length) return a.length > b.length ? 1 : -1;
  if (a !== b) return a > b ? 1 : -1;
  const length = Math.max(leftFraction.length, rightFraction.length);
  const af = leftFraction.padEnd(length, '0');
  const bf = rightFraction.padEnd(length, '0');
  return af === bf ? 0 : af > bf ? 1 : -1;
}

export function validateStockRange(minStock?: string | null, maxStock?: string | null): void {
  if (minStock != null && maxStock != null && compareDecimals(maxStock, minStock) < 0) {
    throw new BadRequestException('Le stock maximum doit être supérieur ou égal au stock minimum.');
  }
}

export function validateProductInput(input: unknown, partial: false): CreateProductDto;
export function validateProductInput(input: unknown, partial: true): UpdateProductDto;
export function validateProductInput(input: unknown, partial: boolean): CreateProductDto | UpdateProductDto {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BadRequestException('Un objet JSON produit est requis.');
  }
  const values: Record<string, unknown> = { ...input };
  const allowed: readonly string[] = [...requiredText, ...optionalText, ...decimals, ...booleans, 'classificationIds'];
  for (const key of Object.keys(values)) {
    if (!allowed.includes(key)) throw new BadRequestException(`Champ produit non autorisé : ${key}.`);
  }
  if (!partial || values.classificationIds !== undefined) values.classificationIds = classificationIds(values.classificationIds);
  if (values.measurementMode !== undefined && !Object.hasOwn(measurementUnits, String(values.measurementMode))) throw new BadRequestException('Mode de mesure invalide.');
  for (const key of requiredText) {
    if (partial && values[key] === undefined) continue;
    const value = values[key];
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`Le champ ${key} est obligatoire.`);
    }
    values[key] = value.trim();
  }
  for (const key of optionalText) {
    const value = values[key];
    if (value === undefined) continue;
    const nullable = key === 'location' || key === 'barcode';
    if (nullable && value === null) continue;
    if (typeof value !== 'string') throw new BadRequestException(`Le champ ${key} doit être un texte.`);
    values[key] = key === 'barcode' ? value.trim() || null : value.trim();
  }
  for (const key of ['storageUnit', 'saleUnit']) {
    if (values[key] !== undefined && !units.includes(String(values[key]))) {
      throw new BadRequestException(`Unité invalide pour ${key}.`);
    }
  }
  if (values.productType !== undefined && !['VRAC', 'EMBALLE'].includes(String(values.productType))) {
    throw new BadRequestException('Type de produit invalide.');
  }
  for (const key of decimals) {
    const value = values[key];
    const optional = key === 'minStock' || key === 'maxStock';
    if ((value === undefined && (partial || optional)) || (value === null && optional)) continue;
    if (typeof value !== 'string' || !/^\d+(?:\.\d+)?$/.test(value) || (!optional && !/[1-9]/.test(value))) {
      throw new BadRequestException(`${key} doit être une chaîne décimale ${optional ? 'supérieure ou égale à 0' : 'supérieure à 0'}.`);
    }
  }
  for (const key of booleans) {
    if (values[key] !== undefined && typeof values[key] !== 'boolean') {
      throw new BadRequestException(`Le champ ${key} doit être un booléen.`);
    }
  }
  // Every accepted key and value has been checked above; PATCH may omit fields.
  const validated = values as UpdateProductDto;
  validateStockRange(validated.minStock, validated.maxStock);
  return validated;
}
