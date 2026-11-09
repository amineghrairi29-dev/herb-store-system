import { BadRequestException } from '@nestjs/common';
import { auditActions, auditEntities } from './audit-values.js';
export function auditQuery(raw: Record<string, unknown>) {
  const allowed = ['dateFrom', 'dateTo', 'actorUserId', 'action', 'entityType', 'outcome', 'search', 'page', 'pageSize'];
  for (const [key, value] of Object.entries(raw)) if (!allowed.includes(key) || typeof value !== 'string') throw new BadRequestException('Filtre d’audit invalide.');
  const q = raw as Record<string, string>;
  const integer = (key: string, fallback?: number) => { if (!q[key]) return fallback; if (!/^[1-9]\d*$/.test(q[key]) || Number(q[key]) > 2147483647) throw new BadRequestException(`Filtre ${key} invalide.`); return Number(q[key]); };
  for (const key of ['dateFrom', 'dateTo']) if (q[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(q[key]) || !Number.isFinite(Date.parse(q[key])) || new Date(q[key]).toISOString().slice(0, 10) !== q[key])) throw new BadRequestException('Date invalide.');
  if (q.dateFrom && q.dateTo && q.dateFrom > q.dateTo) throw new BadRequestException('Plage de dates invalide.');
  if (q.action && !(auditActions as readonly string[]).includes(q.action) || q.entityType && !(auditEntities as readonly string[]).includes(q.entityType) || q.outcome && !['SUCCESS', 'FAILURE'].includes(q.outcome)) throw new BadRequestException('Filtre d’audit invalide.');
  if ((q.search?.length ?? 0) > 200 || q.search?.includes('\0')) throw new BadRequestException('Recherche invalide.');
  return { dateFrom: q.dateFrom || undefined, dateTo: q.dateTo || undefined, actorUserId: integer('actorUserId'), action: q.action || undefined, entityType: q.entityType || undefined, outcome: q.outcome || undefined, search: q.search?.trim() || undefined, page: integer('page', 1)!, pageSize: Math.min(integer('pageSize', 25)!, 100) };
}
