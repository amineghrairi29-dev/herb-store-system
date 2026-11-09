#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract';
import endContract from '../../snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract';
import startContract from '../../snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';
const db = postgres<End>({ contractJson: endContract, url: 'postgresql://localhost/migration-plan' });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'category',
        column: col('imagePath', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(endContract, 'assign-curated-category-images', {
        check: () => db.raw.sql`SELECT id FROM public.category WHERE "imagePath" IS NULL AND slug IN ('herbes', 'huiles-et-liquides-naturels', 'epices', 'parfums', 'melanges-speciaux') LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`UPDATE public.category c SET "imagePath" = images.path
          FROM (VALUES
            ('herbes', '/images/categories/herbes.png'),
            ('huiles-et-liquides-naturels', '/images/categories/huiles-liquides.png'),
            ('epices', '/images/categories/epices.png'),
            ('parfums', '/images/categories/parfums.png'),
            ('melanges-speciaux', '/images/categories/melanges-speciaux.png')
          ) AS images(slug, path)
          WHERE c.slug = images.slug AND c."imagePath" IS NULL`.affectedCount().build(),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
