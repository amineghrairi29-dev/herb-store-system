#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract';
import startContract from '../../snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract';
import endContract from '../../snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract.json' with { type: 'json' };
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
        table: 'onlineOrder',
        columns: [
          col('cancelledAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('confirmedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('customerEmail', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('customerName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('customerPhone', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('notes', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reference', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('totalAmount', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'online_order_status_e490f5ea',
            '(status = \'PENDING\' AND "confirmedAt" IS NULL AND "cancelledAt" IS NULL) OR (status = \'CONFIRMED\' AND "confirmedAt" IS NOT NULL AND "cancelledAt" IS NULL) OR (status = \'CANCELLED\' AND "cancelledAt" IS NOT NULL AND "confirmedAt" IS NULL)',
          ),
          checkExpression(
            'online_order_total_cb431b28',
            '"totalAmount" > 0 AND "totalAmount" < \'Infinity\'::numeric',
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'onlineOrderLine',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('lineTotal', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('orderId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productNameSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('unitPrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('unitSnapshot', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'online_line_price_c86ef394',
            '"unitPrice" > 0 AND "unitPrice" < \'Infinity\'::numeric',
          ),
          checkExpression(
            'online_line_quantity_80c93d85',
            "quantity > 0 AND quantity < 'Infinity'::numeric",
          ),
          checkExpression('online_line_total_0e973f01', '"lineTotal" = quantity * "unitPrice"'),
        ],
      }),
      this.addUnique({
        schema: 'public',
        table: 'onlineOrder',
        constraint: 'onlineOrder_reference_key',
        columns: ['reference'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'onlineOrderLine',
        constraint: 'onlineOrderLine_orderId_productId_key',
        columns: ['orderId', 'productId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'onlineOrder',
        index: 'onlineOrder_status_createdAt_idx_58610442',
        columns: ['status', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'onlineOrderLine',
        index: 'onlineOrderLine_orderId_idx_d284871b',
        columns: ['orderId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'onlineOrderLine',
        index: 'onlineOrderLine_productId_idx_5858600a',
        columns: ['productId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'onlineOrderLine',
        foreignKey: {
          name: 'onlineOrderLine_orderId_fkey',
          columns: ['orderId'],
          references: { schema: 'public', table: 'onlineOrder', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'onlineOrderLine',
        foreignKey: {
          name: 'onlineOrderLine_productId_fkey',
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
