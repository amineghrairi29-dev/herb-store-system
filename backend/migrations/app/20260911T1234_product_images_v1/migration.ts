#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract';
import startContract from '../../snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract';
import endContract from '../../snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('mainImagePath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
