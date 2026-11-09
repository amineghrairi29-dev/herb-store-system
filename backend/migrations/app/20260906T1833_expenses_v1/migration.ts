#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract';
import endContract from '../../snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract';
import startContract from '../../snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract.json' with { type: 'json' };
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
      this.dropCheckConstraint({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cash_movement_source_5b454499',
      }),
      this.createTable({
        schema: 'public',
        table: 'expense',
        columns: [
          col('amount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('category', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expenseDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('paymentMethod', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('expense_amount_f3043ec0', "amount > 0 AND amount < 'Infinity'::numeric"),
          checkExpression(
            'expense_category_d34e8cde',
            "category IN ('RENT', 'ELECTRICITY', 'WATER', 'SALARY', 'TRANSPORT', 'MAINTENANCE', 'ADMINISTRATIVE', 'TAX', 'OTHER')",
          ),
          checkExpression(
            'expense_method_7b70b0f1',
            "\"paymentMethod\" IN ('CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER')",
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'cashMovement',
        column: col('expenseId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cash_movement_source_2ce79fdb',
        expression:
          '("sourceType" = \'SALE_PAYMENT\' AND type = \'IN\' AND "sourceId" IS NOT NULL AND "salePaymentId" IS NOT NULL AND "sourceId" = "salePaymentId" AND "purchasePaymentId" IS NULL AND "expenseId" IS NULL) OR ("sourceType" = \'PURCHASE_PAYMENT\' AND type = \'OUT\' AND "sourceId" IS NOT NULL AND "purchasePaymentId" IS NOT NULL AND "sourceId" = "purchasePaymentId" AND "salePaymentId" IS NULL AND "expenseId" IS NULL) OR ("sourceType" IN (\'MANUAL_IN\', \'MANUAL_OUT\') AND type = CASE WHEN "sourceType" = \'MANUAL_IN\' THEN \'IN\' ELSE \'OUT\' END AND "sourceId" IS NULL AND "salePaymentId" IS NULL AND "purchasePaymentId" IS NULL AND "expenseId" IS NULL AND "paymentMethod" = \'CASH\') OR ("sourceType" = \'EXPENSE\' AND type = \'OUT\' AND "sourceId" IS NOT NULL AND "expenseId" IS NOT NULL AND "sourceId" = "expenseId" AND "salePaymentId" IS NULL AND "purchasePaymentId" IS NULL)',
      }),
      this.addUnique({
        schema: 'public',
        table: 'cashMovement',
        constraint: 'cashMovement_expenseId_key',
        columns: ['expenseId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'expense',
        constraint: 'expense_reference_key',
        columns: ['reference'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_category_expenseDate_idx_4ada0e62',
        columns: ['category', 'expenseDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'expense',
        index: 'expense_expenseDate_idx_4f88c6df',
        columns: ['expenseDate'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cashMovement',
        foreignKey: {
          name: 'cashMovement_expenseId_fkey',
          columns: ['expenseId'],
          references: { schema: 'public', table: 'expense', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
