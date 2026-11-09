import 'dotenv/config';
import { Client } from 'pg';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../prisma/contract.d';
import contractJson from '../prisma/contract.json' with { type: 'json' };
import type { ProductTransaction } from '../prisma/product-transaction.js';

export type PurchaseTransaction = ProductTransaction & { client: Client };

/** One owned PostgreSQL connection for locks, Prisma reads/writes, and commit. */
export async function withPurchaseTransaction<T>(work: (tx: PurchaseTransaction) => Promise<T>, readOnly = false): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  await client.connect();
  const scoped = postgres<Contract>({ contractJson, pg: client });
  try {
    // Use Prisma's transaction-scoped ORM: root .update()/.delete() open their
    // own mutation transactions and must never be used inside a raw BEGIN.
    return await scoped.transaction(async (tx) => {
      await client.query(readOnly ? 'SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      return work({ orm: tx.orm, client });
    });
  }
  finally { await scoped.close(); await client.end(); }
}
