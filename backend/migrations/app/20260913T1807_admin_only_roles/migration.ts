#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract';
import endContract from '../../snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dc67b7a1fb69f555fd101cce792acd4ab0736937fbe55606c8b135bf6be340d0/contract';
import startContract from '../../snapshots/dc67b7a1fb69f555fd101cce792acd4ab0736937fbe55606c8b135bf6be340d0/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';
import postgres from '@prisma/orm-postgres/runtime';

const db = postgres<End>({ contractJson: endContract, url: 'postgresql://localhost/migration-plan' });

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_cd3d4bd8',
      }),
      this.dataTransform(endContract, 'revoke-obsolete-internal-sessions', {
        check: () => db.raw.sql`SELECT 1 AS id WHERE EXISTS (SELECT 1 FROM public."authSession" s JOIN public."user" u ON u.id = s."userId" WHERE u.role <> 'ADMIN')`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`DELETE FROM public."authSession" s USING public."user" u WHERE u.id = s."userId" AND u.role <> 'ADMIN'`.affectedCount().build(),
      }),
      this.dataTransform(endContract, 'retain-obsolete-users-as-inactive-admins', {
        check: () => db.raw.sql`SELECT id FROM public."user" WHERE role <> 'ADMIN' LIMIT 1`.returnsRow({ id: 'pg/int4@1' }).build(),
        run: () => db.raw.sql`UPDATE public."user" SET role = 'ADMIN', "isActive" = false, "updatedAt" = now() WHERE role <> 'ADMIN'`.affectedCount().build(),
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'user',
        constraint: 'user_role_570c02ea',
        expression: "role = 'ADMIN'",
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
