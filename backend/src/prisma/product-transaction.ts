import 'dotenv/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Client } from 'pg';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

// Reuse Prisma's installed PostgreSQL driver for the row-lock operation that its
// current ORM query surface does not expose. All ORM work uses this same client.
export type ProductTransaction = Pick<ReturnType<typeof postgres<Contract>>, 'orm'> & { client: Client };

export async function withProductTransaction<T>(id: number, work: (tx: ProductTransaction) => Promise<T>): Promise<T> {
  if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BadRequestException('Identifiant de produit invalide.');
  // A dedicated Client has no pool release() method for Prisma to invoke between
  // queries. Ownership stays here for the entire row lock/check/insert transaction.
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  const scoped = postgres<Contract>({ contractJson, pg: client });
  try {
    return await scoped.transaction(async tx => {
    await client.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    const locked = await client.query<{ id: number }>(
      'SELECT id FROM public.product WHERE id = $1 FOR UPDATE', [id],
    );
    if (locked.rowCount === 0) throw new NotFoundException('Produit introuvable.');
    return work({ orm: tx.orm, client });
    });
  } finally {
    await scoped.close();
    await client.end();
  }
}
