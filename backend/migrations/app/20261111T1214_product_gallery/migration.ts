#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/1a271a6c502a71c3ab8fe6d9513c16c6dfe6b31688e2885947d59b949744f9c3/contract';
import startContract from '../../snapshots/1a271a6c502a71c3ab8fe6d9513c16c6dfe6b31688e2885947d59b949744f9c3/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6bc518f2e1b046cb63d54557b23d6c0dbeb43fedb6daf3a07b5511b79c088725/contract';
import endContract from '../../snapshots/6bc518f2e1b046cb63d54557b23d6c0dbeb43fedb6daf3a07b5511b79c088725/contract.json' with { type: 'json' };
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

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'productImage',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('path', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('product_image_path_0c199711', "path LIKE '/uploads/products/%'"),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('benefits', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('precautions', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('usage', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'productImage',
        constraint: 'productImage_path_key',
        columns: ['path'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productImage',
        index: 'productImage_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'productImage',
        index: 'productImage_productId_sortOrder_idx_fe80956b',
        columns: ['productId', 'sortOrder'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'productImage',
        foreignKey: {
          name: 'productImage_productId_fkey',
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
