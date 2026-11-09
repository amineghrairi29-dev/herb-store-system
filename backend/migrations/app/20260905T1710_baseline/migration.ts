#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/0851594de9abb165f8316fec46c1a9283a68c9e02664dac6424c2f8cda2df85b/contract';
import endContract from '../../snapshots/0851594de9abb165f8316fec46c1a9283a68c9e02664dac6424c2f8cda2df85b/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations(): Migration<never, End>['operations'] {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'product',
        columns: [
          col('barcode', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isSellable', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isVisibleOnline', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('nameFr', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('origin', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('packaging', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('productType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('salePrice', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('scientificName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sku', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'product',
        constraint: 'product_sku_key',
        columns: ['sku'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'product',
        constraint: 'product_barcode_key',
        columns: ['barcode'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
