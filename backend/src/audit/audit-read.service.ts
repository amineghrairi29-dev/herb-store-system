import { Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { businessDate } from '../cash/cash-values.js';
import { purchaseId } from '../purchases/purchase-validation.js';
import { auditQuery } from './audit-query.js';
import { safeMetadata } from './audit-values.js';
export interface AuditRow { id: number; actorUserId: number | null; actorNameSnapshot: string | null; actorEmailSnapshot: string | null; actorRoleSnapshot: string | null; action: string; entityType: string; entityId: number | null; entityReference: string | null; outcome: string; metadataJson: unknown; ipAddress: string | null; userAgent: string | null; createdAt: string }
const columns = 'id, "actorUserId", "actorNameSnapshot", "actorEmailSnapshot", "actorRoleSnapshot", action, "entityType", "entityId", "entityReference", outcome, "metadataJson", "ipAddress", "userAgent", "createdAt"::text';
const safe = (row: AuditRow) => ({ ...row, metadataJson: safeMetadata(row.metadataJson), createdAt: new Date(row.createdAt).toISOString() });
@Injectable()
export class AuditReadService {
  list(raw: Record<string, unknown>) {
    const q = auditQuery(raw), timeZone = businessDate().timeZone, params: (string | number)[] = [], where: string[] = [];
    const bind = (value: string | number) => { params.push(value); return `$${params.length}`; };
    if (q.dateFrom) where.push(`"createdAt" >= (${bind(q.dateFrom)}::date::timestamp AT TIME ZONE ${bind(timeZone)})`);
    if (q.dateTo) where.push(`"createdAt" < ((${bind(q.dateTo)}::date + interval '1 day') AT TIME ZONE ${bind(timeZone)})`);
    for (const key of ['actorUserId', 'action', 'entityType', 'outcome'] as const) if (q[key]) where.push(`"${key}" = ${bind(q[key])}`);
    if (q.search) { const p = bind(`%${q.search.replace(/[\\%_]/g, '\\$&')}%`); where.push(`("actorNameSnapshot" ILIKE ${p} OR "actorEmailSnapshot" ILIKE ${p} OR "entityReference" ILIKE ${p})`); }
    const filter = where.length ? ` WHERE ${where.join(' AND ')}` : '';
    return withPurchaseTransaction(async tx => {
      const total = Number((await tx.client.query<{ count: string }>(`SELECT count(*) FROM public."auditEvent"${filter}`, params)).rows[0].count);
      const data = (await tx.client.query<AuditRow>(`SELECT ${columns} FROM public."auditEvent"${filter} ORDER BY "createdAt" DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, q.pageSize, (q.page - 1) * q.pageSize])).rows.map(safe);
      return { data, pagination: { page: q.page, pageSize: q.pageSize, totalItems: total, totalPages: Math.ceil(total / q.pageSize) }, timeZone };
    }, true);
  }
  detail(id: number) { purchaseId(id); return withPurchaseTransaction(async tx => { const row = (await tx.client.query<AuditRow>(`SELECT ${columns} FROM public."auditEvent" WHERE id = $1`, [id])).rows[0]; if (!row) throw new NotFoundException('Événement introuvable.'); return safe(row); }, true); }
}
