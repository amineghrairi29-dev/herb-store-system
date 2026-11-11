import { BadRequestException } from '@nestjs/common';

/** The 24 governorates of Tunisia, in display order. */
export const governorates = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba', 'Kairouan',
  'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba', 'Médenine', 'Monastir', 'Nabeul',
  'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan',
] as const;
export type Governorate = typeof governorates[number];

export function isGovernorate(value: unknown): value is Governorate {
  return typeof value === 'string' && (governorates as readonly string[]).includes(value);
}

/** Money amount with up to 3 decimals (millimes), returned as a normalized string. */
export function moneyText(value: unknown, field: string, max: number): string {
  const text = typeof value === 'number' ? String(value) : value;
  if (typeof text !== 'string' || !/^\d{1,7}(?:\.\d{1,3})?$/.test(text.trim()) || Number(text) >= max) throw new BadRequestException(`Montant invalide : ${field}.`);
  const [whole, fraction = ''] = text.trim().split('.');
  return `${BigInt(whole).toString()}.${fraction.padEnd(3, '0')}`;
}

/** Compares two non-negative decimal strings with at most 3 decimals. */
export function compareMoney(a: string, b: string): number {
  const millimes = (value: string) => { const [whole, fraction = ''] = value.split('.'); return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0').slice(0, 3)); };
  const x = millimes(a), y = millimes(b);
  return x === y ? 0 : x < y ? -1 : 1;
}

export type DeliveryZoneInput = { governorate: Governorate; fee: string; freeAbove: string | null; delay: string | null; isActive: boolean };

export function deliveryZoneInput(raw: unknown): DeliveryZoneInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BadRequestException('Un objet JSON est requis.');
  const value = raw as Record<string, unknown>;
  for (const key of Object.keys(value)) if (!['governorate', 'fee', 'freeAbove', 'delay', 'isActive'].includes(key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
  if (!isGovernorate(value.governorate)) throw new BadRequestException('Gouvernorat inconnu.');
  if (typeof value.isActive !== 'boolean') throw new BadRequestException('Le statut doit être un booléen.');
  const fee = moneyText(value.fee, 'frais de livraison', 1000);
  const freeAbove = value.freeAbove === null || value.freeAbove === undefined || value.freeAbove === '' ? null : moneyText(value.freeAbove, 'livraison gratuite à partir de', 1000000);
  if (freeAbove !== null && compareMoney(freeAbove, '0') <= 0) throw new BadRequestException('Le seuil de livraison gratuite doit être positif.');
  if (value.delay !== undefined && value.delay !== null && (typeof value.delay !== 'string' || value.delay.length > 80)) throw new BadRequestException('Délai invalide (80 caractères maximum).');
  const delay = typeof value.delay === 'string' && value.delay.trim() ? value.delay.trim() : null;
  return { governorate: value.governorate, fee, freeAbove, delay, isActive: value.isActive };
}

/** Delivery fee for an order: free above the zone threshold, otherwise the zone fee. */
export function deliveryFee(zone: { fee: string; freeAbove: string | null }, itemsTotal: string): string {
  return zone.freeAbove !== null && compareMoney(itemsTotal, zone.freeAbove) >= 0 ? '0.000' : zone.fee;
}
