#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/359c94795da585d29f878c1440c6c6504a5391b55fb6e2f0b6427a32e12ebd4a/contract';
import startContract from '../../snapshots/359c94795da585d29f878c1440c6c6504a5391b55fb6e2f0b6427a32e12ebd4a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract';
import endContract from '../../snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.createTable({
        schema: 'public',
        table: 'storeSettings',
        columns: [
          col('address', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('city', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('country', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currency', 'text', {
            notNull: true,
            default: lit('TND'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('email', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'int4', { notNull: true, default: lit(1), codecRef: { codecId: 'pg/int4@1' } }),
          col('phone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reportFooter', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('secondaryPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('storeName', 'text', {
            notNull: true,
            default: lit('Herb Store'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('website', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('store_settings_currency_ea996e0a', "currency = 'TND'"),
          checkExpression(
            'store_settings_name_93a0ca73',
            'length(btrim("storeName")) BETWEEN 1 AND 160',
          ),
          checkExpression('store_settings_singleton_7faf435e', 'id = 1'),
        ],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
