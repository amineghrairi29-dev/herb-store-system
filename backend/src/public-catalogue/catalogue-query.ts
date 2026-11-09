import { BadRequestException } from '@nestjs/common';

export const availabilityValues = ['OUT_OF_STOCK', 'LOW_STOCK', 'IN_STOCK'] as const;
export type Availability = typeof availabilityValues[number];
export const sorts = { name_asc: 'lower(name) ASC, id ASC', name_desc: 'lower(name) DESC, id ASC', price_asc: 'catalogue."salePrice" ASC, id ASC', price_desc: 'catalogue."salePrice" DESC, id ASC' } as const;
export function catalogueQuery(query: Record<string, unknown>) {
  const allowed = ['q', 'classification', 'category', 'subcategory', 'availability', 'sort', 'page', 'pageSize'];
  for (const key of Object.keys(query)) if (!allowed.includes(key)) throw new BadRequestException('Paramètre inconnu.');
  const text = (key: string) => {
    const value = query[key];
    if (value === undefined) return '';
    if (typeof value !== 'string' || value.length > 200) throw new BadRequestException(`Paramètre ${key} invalide.`);
    return value.trim();
  };
  const integer = (key: string, fallback: number) => {
    const value = text(key);
    if (!value && query[key] === undefined) return fallback;
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw new BadRequestException(`Paramètre ${key} invalide.`);
    return Number(value);
  };
  const sort = text('sort') || 'name_asc', availability = text('availability');
  if (!Object.hasOwn(sorts, sort) || (availability && !availabilityValues.includes(availability as Availability))) throw new BadRequestException('Tri ou disponibilité invalide.');
  return { q: text('q'), classification: text('classification') || text('category'), category: text('category'), subcategory: text('subcategory'), availability, sort: sort as keyof typeof sorts, page: integer('page', 1), pageSize: Math.min(integer('pageSize', 24), 60) };
}
