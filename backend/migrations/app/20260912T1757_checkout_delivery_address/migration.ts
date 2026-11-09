#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract';
import startContract from '../../snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/dc67b7a1fb69f555fd101cce792acd4ab0736937fbe55606c8b135bf6be340d0/contract';
import endContract from '../../snapshots/dc67b7a1fb69f555fd101cce792acd4ab0736937fbe55606c8b135bf6be340d0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'onlineOrder',
        column: col('deliveryAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
