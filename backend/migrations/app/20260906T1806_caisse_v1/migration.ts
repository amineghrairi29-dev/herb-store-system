#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6956e1ac4b455a991a50697f625c1a6ba02320d8bfdb0562981fa0ca320b652a/contract';
import startContract from '../../snapshots/6956e1ac4b455a991a50697f625c1a6ba02320d8bfdb0562981fa0ca320b652a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract';
import endContract from '../../snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract.json' with { type: 'json' };
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
        table: 'cashMovement',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('movementDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paymentMethod', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('purchasePaymentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('salePaymentId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sourceId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('sourceType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'cash_movement_amount_f3043ec0',
            "amount > 0 AND amount < 'Infinity'::numeric",
          ),
          checkExpression(
            'cash_movement_method_7b70b0f1',
            "\"paymentMethod\" IN ('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER')",
          ),
          checkExpression(
            'cash_movement_source_5b454499',
            '("sourceType" = \'SALE_PAYMENT\' AND type = \'IN\' AND "sourceId" IS NOT NULL AND "salePaymentId" IS NOT NULL AND "sourceId" = "salePaymentId" AND "purchasePaymentId" IS NULL) OR ("sourceType" = \'PURCHASE_PAYMENT\' AND type = \'OUT\' AND "sourceId" IS NOT NULL AND "purchasePaymentId" IS NOT NULL AND "sourceId" = "purchasePaymentId" AND "salePaymentId" IS NULL) OR ("sourceType" IN (\'MANUAL_IN\', \'MANUAL_OUT\') AND type = CASE WHEN "sourceType" = \'MANUAL_IN\' THEN \'IN\' ELSE \'OUT\' END AND "sourceId" IS NULL AND "salePaymentId" IS NULL AND "purchasePaymentId" IS NULL AND "paymentMethod" = \'CASH\')',
          ),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cashMovement_salePaymentId_key',
        columns: ['salePaymentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cashMovement_purchasePaymentId_key',
        columns: ['purchasePaymentId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cashMovement_sourceType_sourceId_key',
        columns: ['sourceType', 'sourceId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cashMovement',
        index: 'cashMovement_movementDate_idx_ae2ac201',
        columns: ['movementDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cashMovement',
        index: 'cashMovement_paymentMethod_movementDate_idx_9b5898ec',
        columns: ['paymentMethod', 'movementDate'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cashMovement',
        foreignKey: {
          name: 'cashMovement_salePaymentId_fkey',
          columns: ['salePaymentId'],
          references: { schema: 'public', table: 'salePayment', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cashMovement',
        foreignKey: {
          name: 'cashMovement_purchasePaymentId_fkey',
          columns: ['purchasePaymentId'],
          references: { schema: 'public', table: 'purchasePayment', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
