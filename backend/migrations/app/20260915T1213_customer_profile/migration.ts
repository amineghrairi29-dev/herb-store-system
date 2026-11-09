#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract';
import startContract from '../../snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract';
import endContract from '../../snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'customer',
        column: col('deliveryAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
