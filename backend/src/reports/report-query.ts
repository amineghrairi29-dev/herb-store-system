import { BadRequestException, NotFoundException } from '@nestjs/common';
import { financePeriod } from '../finance/finance-values.js';
import { categoryLabels, methodLabels, paymentStatusLabels, reportDefinitions, reportKinds, sourceLabels, statusLabels, type ReportKind } from './report-definition.js';
export function reportKind(value: string): ReportKind { if (!reportKinds.some((kind) => kind === value)) throw new NotFoundException('Rapport introuvable.'); return value as ReportKind; }
export function reportQuery(kind: ReportKind, query: Record<string, unknown>) {
  const allowed = ['period', 'dateFrom', 'dateTo', 'page', 'pageSize', 'sortBy', 'sortOrder', 'view', ...reportDefinitions[kind].filters];
  for (const key of Object.keys(query)) if (!allowed.includes(key)) throw new BadRequestException(`Filtre non autorisé : ${key}.`);
  for (const [key, value] of Object.entries(query)) if (typeof value !== 'string') throw new BadRequestException(`Valeur invalide : ${key}.`);
  const period = financePeriod(Object.fromEntries(Object.entries(query).filter(([key]) => ['period', 'dateFrom', 'dateTo'].includes(key))));
  const integer = (key: string, fallback: number) => { const value = query[key]; if (value === undefined) return fallback; if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) throw new BadRequestException(`Valeur invalide : ${key}.`); return Number(value); };
  const enums: Record<string, Record<string, string>> = { status: { ...statusLabels, ALL: 'Tous' }, paymentStatus: paymentStatusLabels, paymentMethod: methodLabels, category: categoryLabels, sourceType: sourceLabels, type: { IN: 'Entrée', OUT: 'Sortie' } };
  for (const [key, values] of Object.entries(enums)) if (query[key] !== undefined && !Object.hasOwn(values, String(query[key]))) throw new BadRequestException(`Filtre invalide : ${key}.`);
  const sortBy = query.sortBy ?? 'date', sortOrder = query.sortOrder ?? 'desc';
  if (!['date', 'reference', 'amount'].includes(String(sortBy)) || !['asc', 'desc'].includes(String(sortOrder))) throw new BadRequestException('Tri invalide.');
  if (query.view !== undefined && query.view !== 'print') throw new BadRequestException('Vue invalide.');
  if (typeof query.search === 'string' && query.search.length > 200) throw new BadRequestException('Recherche trop longue (200 caractères maximum).');
  return { period, page: integer('page', 1), pageSize: Math.min(integer('pageSize', 25), 100), sortBy: String(sortBy), sortOrder: String(sortOrder), print: query.view === 'print',
    filters: { ...Object.fromEntries(reportDefinitions[kind].filters.filter((key) => query[key] !== undefined).map((key) => [key, String(query[key]).trim()])), ...((kind === 'sales' || kind === 'purchases') && query.status === undefined ? { status: 'CONFIRMED' } : {}) } as Record<string, string>,
    supplierId: query.supplierId === undefined ? undefined : integer('supplierId', 1),
  };
}
