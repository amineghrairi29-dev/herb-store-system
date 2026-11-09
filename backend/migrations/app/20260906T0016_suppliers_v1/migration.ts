#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract';
import startContract from '../../snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract';
import endContract from '../../snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'supplier',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('code', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('contactName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('taxId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'supplier',
        constraint: 'supplier_code_key',
        columns: ['code'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
