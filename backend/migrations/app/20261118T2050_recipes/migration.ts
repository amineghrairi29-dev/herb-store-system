#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6bc518f2e1b046cb63d54557b23d6c0dbeb43fedb6daf3a07b5511b79c088725/contract';
import startContract from '../../snapshots/6bc518f2e1b046cb63d54557b23d6c0dbeb43fedb6daf3a07b5511b79c088725/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/7201cd94efb02fcb99738a523f0d83dfbbb8d44c520c137b8308043510792b8a/contract';
import endContract from '../../snapshots/7201cd94efb02fcb99738a523f0d83dfbbb8d44c520c137b8308043510792b8a/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('ingredients', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('recipeFormat', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_recipe_format_349a8c94',
        expression: "\"recipeFormat\" IN ('BOX', 'BAG', 'LIQUID')",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
