#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract';
import endContract from '../../snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/78047f5ba46577eb7a695fa16616690775056f023f382dec1ffbfcf89ba2c8ac/contract';
import startContract from '../../snapshots/78047f5ba46577eb7a695fa16616690775056f023f382dec1ffbfcf89ba2c8ac/contract.json' with { type: 'json' };
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
        table: 'sale',
        columns: [
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('customerPhone', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('saleDate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('DRAFT'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sale_confirmation_date_20364fc4',
            '(status = \'CONFIRMED\') = ("confirmedAt" IS NOT NULL)',
          ),
          checkExpression('sale_status_81ae2bd2', "status IN ('DRAFT', 'CONFIRMED', 'CANCELLED')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'saleLine',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lineTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('quantityInStorageUnit', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('saleId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unitSalePrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'sale_line_price_73dd1f28',
            '"unitSalePrice" > 0 AND "unitSalePrice" < \'Infinity\'::numeric',
          ),
          checkExpression(
            'sale_line_quantity_80c93d85',
            "quantity > 0 AND quantity < 'Infinity'::numeric",
          ),
          checkExpression(
            'sale_line_storage_quantity_3ecf1744',
            '"quantityInStorageUnit" > 0 AND "quantityInStorageUnit" < \'Infinity\'::numeric',
          ),
          checkExpression('sale_line_total_d576bd61', '"lineTotal" = quantity * "unitSalePrice"'),
          checkExpression('sale_line_unit_f6a80600', "unit IN ('KG', 'G', 'L', 'ML', 'PIECE')"),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sale',
        constraint: 'sale_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'saleLine',
        constraint: 'saleLine_saleId_productId_key',
        columns: ['saleId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sale',
        index: 'sale_status_saleDate_idx_c45ae1dc',
        columns: ['status', 'saleDate'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'saleLine',
        index: 'saleLine_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'saleLine',
        index: 'saleLine_saleId_idx_b4c0fb73',
        columns: ['saleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'saleLine',
        foreignKey: {
          name: 'saleLine_saleId_fkey',
          columns: ['saleId'],
          references: { schema: 'public', table: 'sale', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'saleLine',
        foreignKey: {
          name: 'saleLine_productId_fkey',
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
