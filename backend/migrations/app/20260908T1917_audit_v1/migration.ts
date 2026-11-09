#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract';
import endContract from '../../snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract';
import startContract from '../../snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'auditEvent',
        columns: [
          col('action', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('actorEmailSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorNameSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorRoleSnapshot', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('actorUserId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entityId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('entityReference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('entityType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('metadataJson', 'json', { codecRef: { codecId: 'pg/json@1' } }),
          col('outcome', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('audit_outcome_389d9d7d', "outcome IN ('SUCCESS', 'FAILURE')"),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditEvent',
        index: 'auditEvent_action_createdAt_idx_a6d20b4b',
        columns: ['action', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditEvent',
        index: 'auditEvent_actorUserId_createdAt_idx_bdb71afa',
        columns: ['actorUserId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditEvent',
        index: 'auditEvent_createdAt_id_idx_3855cff1',
        columns: ['createdAt', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditEvent',
        index: 'auditEvent_entityType_createdAt_idx_c2aec402',
        columns: ['entityType', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'auditEvent',
        index: 'auditEvent_outcome_createdAt_idx_f02d4ff3',
        columns: ['outcome', 'createdAt'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
