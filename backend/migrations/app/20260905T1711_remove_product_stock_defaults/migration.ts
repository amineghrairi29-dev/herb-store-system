#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/157aac5039093104db450eef048832e87b4c4bf1ef9c0e9ba08ccf3211dc37ee/contract';
import startContract from '../../snapshots/157aac5039093104db450eef048832e87b4c4bf1ef9c0e9ba08ccf3211dc37ee/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d45f39e1fb1b0150d3608e234d825c1100eba4633f1c411790e4be051afd468f/contract';
import endContract from '../../snapshots/d45f39e1fb1b0150d3608e234d825c1100eba4633f1c411790e4be051afd468f/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.dropDefault({ schema: 'public', table: 'product', column: 'category' }),
      this.dropDefault({ schema: 'public', table: 'product', column: 'conversionFactor' }),
      this.dropDefault({ schema: 'public', table: 'product', column: 'saleUnit' }),
      this.dropDefault({ schema: 'public', table: 'product', column: 'storageUnit' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
