import 'dotenv/config';
import { Client } from 'pg';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const tables = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const snapshot = {};
  for (const { tablename } of tables.rows) {
    if (['category', 'subcategory'].includes(tablename) || tablename.startsWith('_')) continue;
    const name = '"' + tablename.replaceAll('"', '""') + '"';
    const result = await client.query(`SELECT (to_jsonb(t) - ${tablename === 'product' ? "ARRAY['categoryId','subcategoryId']" : "ARRAY[]::text[]"})::text AS row FROM public.${name} t ORDER BY 1`);
    snapshot[tablename] = { count: result.rows.length, hash: createHash('sha256').update(JSON.stringify(result.rows)).digest('hex') };
  }
  const file = '../.tmp/category-preservation.json';
  if (process.argv.includes('--before')) { fs.writeFileSync(file, JSON.stringify(snapshot, null, 2)); console.log('Preservation baseline saved (counts and hashes only).'); }
  else {
    const before = JSON.parse(fs.readFileSync(file, 'utf8'));
    const changed = Object.keys(before).filter(key => JSON.stringify(before[key]) !== JSON.stringify(snapshot[key]));
    console.log(JSON.stringify({ unchanged: changed.length === 0, changedTables: changed, productCount: snapshot.product?.count }));
    if (changed.length) process.exitCode = 1;
    const counts = await client.query('SELECT c."isInternal", count(*)::int AS products FROM public.product p JOIN public.category c ON c.id = p."categoryId" GROUP BY c."isInternal"');
    console.log(JSON.stringify(counts.rows));
  }
} finally { await client.end(); }
