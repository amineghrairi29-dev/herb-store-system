#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract';
import endContract from '../../snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d45f39e1fb1b0150d3608e234d825c1100eba4633f1c411790e4be051afd468f/contract';
import startContract from '../../snapshots/d45f39e1fb1b0150d3608e234d825c1100eba4633f1c411790e4be051afd468f/contract.json' with { type: 'json' };
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
        table: 'stockMovement',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('quantityInStorageUnit', 'numeric', {
            notNull: true,
            codecRef: { codecId: 'pg/numeric@1' },
          }),
          col('reason', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('unit', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'stock_movement_quantity_80c93d85',
            "quantity > 0 AND quantity < 'Infinity'::numeric",
          ),
          checkExpression(
            'stock_movement_storage_quantity_3ecf1744',
            '"quantityInStorageUnit" > 0 AND "quantityInStorageUnit" < \'Infinity\'::numeric',
          ),
          checkExpression(
            'stock_movement_type_7394475f',
            "type IN ('ENTRY', 'EXIT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOSS', 'RETURN_IN')",
          ),
          checkExpression(
            'stock_movement_unit_f6a80600',
            "unit IN ('KG', 'G', 'L', 'ML', 'PIECE')",
          ),
        ],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stockMovement',
        index: 'stockMovement_productId_createdAt_idx_58d1a09b',
        columns: ['productId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'stockMovement',
        index: 'stockMovement_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'stockMovement',
        foreignKey: {
          name: 'stockMovement_productId_fkey',
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
