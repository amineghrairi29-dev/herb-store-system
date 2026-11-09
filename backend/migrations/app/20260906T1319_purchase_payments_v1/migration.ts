#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract';
import startContract from '../../snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/78047f5ba46577eb7a695fa16616690775056f023f382dec1ffbfcf89ba2c8ac/contract';
import endContract from '../../snapshots/78047f5ba46577eb7a695fa16616690775056f023f382dec1ffbfcf89ba2c8ac/contract.json' with { type: 'json' };
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
        table: 'purchasePayment',
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
          col('purchaseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'purchase_payment_amount_f3043ec0',
            "amount > 0 AND amount < 'Infinity'::numeric",
          ),
          checkExpression(
            'purchase_payment_method_a2151680',
            "\"paymentMethod\" IN ('CASH', 'BANK_TRANSFER', 'CARD', 'CHECK', 'OTHER')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchasePayment',
        index: 'purchasePayment_purchaseId_idx_10cddd2f',
        columns: ['purchaseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchasePayment',
        index: 'purchasePayment_purchaseId_paymentDate_idx_b03e9552',
        columns: ['purchaseId', 'paymentDate'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchasePayment',
        foreignKey: {
          name: 'purchasePayment_purchaseId_fkey',
          columns: ['purchaseId'],
          references: { schema: 'public', table: 'purchase', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
