#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/041bfee8d1354cc639e224ee75a14e805f9844af58ec4a30bb19970a43b01e51/contract';
import endContract from '../../snapshots/041bfee8d1354cc639e224ee75a14e805f9844af58ec4a30bb19970a43b01e51/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract';
import startContract from '../../snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract.json' with { type: 'json' };
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
        table: 'deliveryZone',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('delay', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('fee', 'numeric', { notNull: true, codecRef: { codecId: 'pg/numeric@1' } }),
          col('freeAbove', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('governorate', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('sortOrder', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('delivery_zone_delay_f0704b23', 'delay IS NULL OR length(delay) <= 80'),
          checkExpression('delivery_zone_fee_fb4159c8', 'fee >= 0 AND fee < 1000'),
          checkExpression(
            'delivery_zone_free_above_e057d75c',
            '"freeAbove" IS NULL OR ("freeAbove" > 0 AND "freeAbove" < 1000000)',
          ),
          checkExpression(
            'delivery_zone_governorate_c0cc3d26',
            'length(btrim(governorate)) BETWEEN 1 AND 80',
          ),
        ],
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryCity', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryFee', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryGovernorate', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'deliveryZone',
        constraint: 'deliveryZone_governorate_key',
        columns: ['governorate'],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'onlineOrder',
        constraint: 'online_order_delivery_fee_77848000',
        expression: '"deliveryFee" IS NULL OR ("deliveryFee" >= 0 AND "deliveryFee" < 1000)',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
