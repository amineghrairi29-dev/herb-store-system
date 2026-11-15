#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/041bfee8d1354cc639e224ee75a14e805f9844af58ec4a30bb19970a43b01e51/contract';
import startContract from '../../snapshots/041bfee8d1354cc639e224ee75a14e805f9844af58ec4a30bb19970a43b01e51/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/1a271a6c502a71c3ab8fe6d9513c16c6dfe6b31688e2885947d59b949744f9c3/contract';
import endContract from '../../snapshots/1a271a6c502a71c3ab8fe6d9513c16c6dfe6b31688e2885947d59b949744f9c3/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryStatus', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryStatusAt', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-string@1' },
        }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'onlineOrder',
        constraint: 'online_order_delivery_status_c57d254c',
        expression:
          "(\"deliveryStatus\" IS NULL AND \"deliveryStatusAt\" IS NULL) OR (status = 'CONFIRMED' AND \"deliveryStatus\" IN ('PREPARING', 'SHIPPED', 'DELIVERED', 'RETURNED') AND \"deliveryStatusAt\" IS NOT NULL)",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
