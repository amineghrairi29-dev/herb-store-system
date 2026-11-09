#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/6956e1ac4b455a991a50697f625c1a6ba02320d8bfdb0562981fa0ca320b652a/contract';
import endContract from '../../snapshots/6956e1ac4b455a991a50697f625c1a6ba02320d8bfdb0562981fa0ca320b652a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract';
import startContract from '../../snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract.json' with { type: 'json' };
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
        table: 'salePayment',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paymentDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('paymentMethod', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('saleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sale_payment_amount_f3043ec0',
            "amount > 0 AND amount < 'Infinity'::numeric",
          ),
          checkExpression(
            'sale_payment_method_7b70b0f1',
            "\"paymentMethod\" IN ('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salePayment',
        index: 'salePayment_saleId_idx_b4c0fb73',
        columns: ['saleId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'salePayment',
        index: 'salePayment_saleId_paymentDate_idx_b5f0969a',
        columns: ['saleId', 'paymentDate'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'salePayment',
        foreignKey: {
          name: 'salePayment_saleId_fkey',
          columns: ['saleId'],
          references: { schema: 'public', table: 'sale', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
