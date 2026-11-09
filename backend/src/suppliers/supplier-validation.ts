import { BadRequestException } from '@nestjs/common';
import type { CreateSupplierDto } from './dto/create-supplier.dto.js';
import type { UpdateSupplierDto } from './dto/update-supplier.dto.js';

export function validateSupplier(input: unknown, partial: false): CreateSupplierDto;
export function validateSupplier(input: unknown, partial: true): UpdateSupplierDto;
export function validateSupplier(input: unknown, partial: boolean): UpdateSupplierDto {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new BadRequestException('Un objet JSON fournisseur est requis.');
  const values: Record<string, unknown> = { ...input };
  const optional = ['contactName', 'phone', 'email', 'address', 'city', 'country', 'taxId', 'notes'];
  const allowed = ['code', 'name', 'isActive', ...optional];
  for (const key of Object.keys(values)) if (!allowed.includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  for (const key of ['code', 'name']) {
    if (partial && values[key] === undefined) continue;
    const value = values[key];
    if (typeof value !== 'string' || !value.trim()) throw new BadRequestException(`${key === 'code' ? 'Le code' : 'Le nom'} fournisseur est obligatoire.`);
    values[key] = value.trim();
  }
  for (const key of optional) {
    const value = values[key];
    if (value === undefined || value === null) continue;
    if (typeof value !== 'string') throw new BadRequestException(`Le champ ${key} doit être un texte.`);
    values[key] = value.trim() || null;
  }
  if (values.email != null && (typeof values.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) throw new BadRequestException('Adresse email invalide.');
  if (values.isActive !== undefined && typeof values.isActive !== 'boolean') throw new BadRequestException('Le statut actif doit être un booléen.');
  return values as UpdateSupplierDto;
}

export function supplierId(id: number): number {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BadRequestException('Identifiant fournisseur invalide.');
  return id;
}

export function isUniqueViolation(error: unknown): boolean {
  for (let depth = 0; depth < 5 && typeof error === 'object' && error !== null; depth++) {
    if ('code' in error && error.code === '23505') return true;
    error = 'cause' in error ? error.cause : undefined;
  }
  return false;
}
