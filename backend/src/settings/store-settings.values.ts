import { BadRequestException } from '@nestjs/common';
export const settingsLimits = { storeName: 160, phone: 40, secondaryPhone: 40, email: 254, address: 500, city: 100, country: 100, website: 500, reportFooter: 1000 } as const;
export type SettingsTextField = keyof typeof settingsLimits;
export type SettingsInput = { storeName?: string; currency?: 'TND' } & Partial<Record<Exclude<SettingsTextField, 'storeName'>, string | null>>;
export interface StoreSettings extends Record<Exclude<SettingsTextField, 'storeName'>, string | null> { id: number; storeName: string; currency: 'TND'; createdAt: string | null; updatedAt: string | null }
export const defaultSettings: StoreSettings = { id: 1, storeName: 'Herb Store', currency: 'TND', phone: null, secondaryPhone: null, email: null, address: null, city: null, country: null, website: null, reportFooter: null, createdAt: null, updatedAt: null };
export function settingsInput(body: unknown): SettingsInput {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Paramètres invalides.');
  const fields = body as Record<string, unknown>, result: Record<string, string | null> = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (key === 'currency') { if (raw !== 'TND') throw new BadRequestException('La devise doit être TND.'); result.currency = 'TND'; continue; }
    if (!Object.hasOwn(settingsLimits, key)) throw new BadRequestException(`Champ non autorisé : ${key}.`);
    if (raw !== null && typeof raw !== 'string') throw new BadRequestException(`Le champ ${key} doit être du texte.`);
    const value = typeof raw === 'string' ? raw.trim() : null;
    if (key === 'storeName' && !value) throw new BadRequestException('Le nom du magasin est obligatoire.');
    if (value && (value.length > settingsLimits[key as SettingsTextField] || value.includes('\0'))) throw new BadRequestException(`Le champ ${key} est trop long ou contient un caractère invalide.`);
    if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException('Adresse email invalide.');
    if (key === 'website' && value) {
      try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(); }
      catch { throw new BadRequestException('Le site web doit être une URL http:// ou https:// valide.'); }
    }
    result[key] = value || null;
  }
  if (!Object.keys(result).length) throw new BadRequestException('Aucune modification fournie.');
  return result as SettingsInput;
}
export function reportIdentity(row: StoreSettings) {
  return { storeName: row.storeName, phone: row.phone, email: row.email, address: row.address, city: row.city, reportFooter: row.reportFooter };
}
