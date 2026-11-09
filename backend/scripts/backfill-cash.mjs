import 'dotenv/config';
import { Client } from 'pg';
import { backfillCash } from '../src/cash/cash-backfill.ts';

const apply = process.argv.includes('--apply');
if (process.argv.slice(2).some((arg) => !['--apply', '--dry-run'].includes(arg))) throw new Error('Use --dry-run or --apply.');
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query('BEGIN');
  const counts = await backfillCash(client, apply);
  await client.query(apply ? 'COMMIT' : 'ROLLBACK');
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', counts }, null, 2));
} catch (error) { await client.query('ROLLBACK'); throw error; }
finally { await client.end(); }
