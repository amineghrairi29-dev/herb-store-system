import { BadRequestException } from '@nestjs/common';
import { roles, type Role } from './auth-policy.js';
export function objectBody(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Données invalides.');
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !keys.includes(key))) throw new BadRequestException('Champ non autorisé.');
  return body;
}
export function emailValue(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestException('Adresse email invalide.');
  return value.trim().toLowerCase();
}
export function nameValue(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 150) throw new BadRequestException('Nom requis (150 caractères maximum).');
  return value.trim();
}
export function roleValue(value: unknown): Role {
  if (!roles.includes(value as Role)) throw new BadRequestException('Rôle invalide.'); return value as Role;
}
export function activeValue(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new BadRequestException('Statut actif invalide.'); return value;
}
export function passwordValue(value: unknown): string {
  if (typeof value !== 'string' || [...value].length < 8 || Buffer.byteLength(value, 'utf8') > 72 || !/\p{L}/u.test(value) || !/[0-9]/.test(value)) throw new BadRequestException('Le mot de passe doit contenir au moins 8 caractères, une lettre et un chiffre (72 octets UTF-8 maximum).');
  return value;
}
