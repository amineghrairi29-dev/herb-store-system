import type { Contract as Start } from '../../snapshots/0851594de9abb165f8316fec46c1a9283a68c9e02664dac6424c2f8cda2df85b/contract';
import startContract from '../../snapshots/0851594de9abb165f8316fec46c1a9283a68c9e02664dac6424c2f8cda2df85b/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/157aac5039093104db450eef048832e87b4c4bf1ef9c0e9ba08ccf3211dc37ee/contract';
import endContract from '../../snapshots/157aac5039093104db450eef048832e87b4c4bf1ef9c0e9ba08ccf3211dc37ee/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations(): Migration<Start, End>['operations'] {
    return [
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('category', 'text', {
          notNull: true,
          default: lit('À classer'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('conversionFactor', 'numeric', {
          notNull: true,
          default: lit('1'),
          codecRef: { codecId: 'pg/numeric@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('location', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('maxStock', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('minStock', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('saleUnit', 'text', {
          notNull: true,
          default: lit('PIECE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('storageUnit', 'text', {
          notNull: true,
          default: lit('PIECE'),
          codecRef: { codecId: 'pg/text@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'product',
        column: col('subcategory', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_conversion_positive_d42822dd',
        expression: '"conversionFactor" > 0 AND "conversionFactor" < \'Infinity\'::numeric',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_max_stock_nonnegative_0d474a0d',
        expression: '"maxStock" >= 0 AND "maxStock" < \'Infinity\'::numeric',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_min_stock_nonnegative_8afd5bbc',
        expression: '"minStock" >= 0 AND "minStock" < \'Infinity\'::numeric',
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'product',
        constraint: 'product_stock_range_c80007e0',
        expression: '"maxStock" >= "minStock"',
      }),
    ];
  }
}
MigrationCLI.run(import.meta.url, M);