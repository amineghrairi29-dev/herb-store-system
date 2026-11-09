import { Injectable, Logger } from '@nestjs/common';
import { Client } from 'pg';
import type { SafeUser } from '../auth/auth-policy.js';
import { auditContext } from './audit-context.js';
import { auditActions, auditEntities, safeMetadata, type AuditAction, type AuditEntity } from './audit-values.js';
const text = (value: unknown, limit: number) => typeof value === 'string' ? value.slice(0, limit).split('').map(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? ' ' : char).join('') : null;
@Injectable()
export class AuditService {
  static async record(client: Client, event: { action: AuditAction; entityType: AuditEntity; entityId?: number | null; entityReference?: unknown; metadata?: unknown; outcome?: 'SUCCESS' | 'FAILURE'; actor?: SafeUser | null }) {
    const context = auditContext.getStore(); if (!context) return; // Explicit request/system scope, never implicit attribution.
    if (!auditActions.includes(event.action) || !auditEntities.includes(event.entityType)) throw new Error('Invalid audit event');
    const actor = event.actor === undefined ? context.actor : event.actor;
    await client.query('INSERT INTO public."auditEvent" ("actorUserId", "actorNameSnapshot", "actorEmailSnapshot", "actorRoleSnapshot", action, "entityType", "entityId", "entityReference", outcome, "metadataJson", "ipAddress", "userAgent") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)', [actor?.id ?? null, text(actor?.fullName, 160), text(actor?.email, 254), actor?.role ?? null, event.action, event.entityType, event.entityId ?? null, text(event.entityReference, 200), event.outcome ?? 'SUCCESS', JSON.stringify(safeMetadata(event.metadata)), text(context.ipAddress, 64), text(context.userAgent, 512)]);
  }
  static async security(action: 'AUTH_LOGIN_SUCCESS' | 'AUTH_LOGIN_FAILURE' | 'AUTH_LOGOUT', actor: SafeUser | null) {
    if (!auditContext.getStore()) return;
    const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000, query_timeout: 3000 });
    try { await client.connect(); await this.record(client, { action, actor, entityType: 'AUTH_SESSION', outcome: action === 'AUTH_LOGIN_FAILURE' ? 'FAILURE' : 'SUCCESS' }); }
    catch { Logger.error('Security audit write failed', 'AuditService'); } // Never log errors/parameters containing credentials.
    finally { await client.end().catch(() => {}); }
  }
}
export async function audited<T>(tx: { client: Client }, action: AuditAction, entityType: AuditEntity, result: T, metadata?: unknown, id?: number, reference?: unknown): Promise<T> {
  const row = result && typeof result === 'object' ? result as Record<string, unknown> : {};
  await AuditService.record(tx.client, { action, entityType, entityId: id ?? (typeof row.id === 'number' ? row.id : null), entityReference: reference ?? row.reference ?? row.sku ?? row.code ?? null, metadata });
  return result;
}
