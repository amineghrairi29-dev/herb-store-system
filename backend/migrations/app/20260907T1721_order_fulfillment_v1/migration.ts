#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7630f0b72af96e2ad04395339d81b6f9db8f1468475677df14a2fd9147ab324f/contract';
import endContract from '../../snapshots/7630f0b72af96e2ad04395339d81b6f9db8f1468475677df14a2fd9147ab324f/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract';
import startContract from '../../snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('convertedAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('saleId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'onlineOrder',
        constraint: 'online_order_conversion_35dfc5b6',
        expression:
          '("saleId" IS NULL AND "convertedAt" IS NULL) OR ("saleId" IS NOT NULL AND "convertedAt" IS NOT NULL AND status = \'CONFIRMED\')',
      }),
      this.addUnique({
        schema: 'public',
        table: 'onlineOrder',
        constraint: 'onlineOrder_saleId_key',
        columns: ['saleId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'onlineOrder',
        foreignKey: {
          name: 'onlineOrder_saleId_fkey',
          columns: ['saleId'],
          references: { schema: 'public', table: 'sale', columns: ['id'] },
          onDelete: 'restrict',
          onUpdate: 'restrict',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
