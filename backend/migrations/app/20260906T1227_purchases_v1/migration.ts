#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract';
import endContract from '../../snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract';
import startContract from '../../snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract.json' with { type: 'json' };
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
        table: 'purchase',
        columns: [
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('purchaseDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('supplierId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'purchase_confirmation_date_20364fc4',
            '(status = \'CONFIRMED\') = ("confirmedAt" IS NOT NULL)',
          ),
          checkExpression(
            'purchase_status_81ae2bd2',
            "status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'purchaseLine',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lineTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('purchaseId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('quantityInStorageUnit', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unitPurchasePrice', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'purchase_line_price_1f6dc554',
            '"unitPurchasePrice" > 0 AND "unitPurchasePrice" < \'Infinity\'::numeric',
          ),
          checkExpression(
            'purchase_line_quantity_80c93d85',
            "quantity > 0 AND quantity < 'Infinity'::numeric",
          ),
          checkExpression(
            'purchase_line_storage_quantity_3ecf1744',
            '"quantityInStorageUnit" > 0 AND "quantityInStorageUnit" < \'Infinity\'::numeric',
          ),
          checkExpression(
            'purchase_line_total_326f0479',
            '"lineTotal" = quantity * "unitPurchasePrice"',
          ),
          checkExpression('purchase_line_unit_f6a80600', "unit IN ('KG', 'G', 'L', 'ML', 'PIECE')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'purchase',
        constraint: 'purchase_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'purchaseLine',
        constraint: 'purchaseLine_purchaseId_productId_key',
        columns: ['purchaseId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_status_purchaseDate_idx_686c578a',
        columns: ['status', 'purchaseDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchase',
        index: 'purchase_supplierId_idx_c4d9a8b9',
        columns: ['supplierId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchaseLine',
        index: 'purchaseLine_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'purchaseLine',
        index: 'purchaseLine_purchaseId_idx_10cddd2f',
        columns: ['purchaseId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchase',
        foreignKey: {
          name: 'purchase_supplierId_fkey',
          columns: ['supplierId'],
          references: { schema: 'public', table: 'supplier', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchaseLine',
        foreignKey: {
          name: 'purchaseLine_purchaseId_fkey',
          columns: ['purchaseId'],
          references: { schema: 'public', table: 'purchase', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'purchaseLine',
        foreignKey: {
          name: 'purchaseLine_productId_fkey',
          columns: ['productId'],
          references: { schema: 'public', table: 'product', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
