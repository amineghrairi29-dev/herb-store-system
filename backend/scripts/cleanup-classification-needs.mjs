// Run from backend: node scripts/cleanup-classification-needs.mjs
// Idempotent data cleanup; no product/link/business table writes.
import 'dotenv/config';
import assert from 'node:assert/strict';
import { Client } from 'pg';
const db = new Client({ connectionString: process.env.DATABASE_URL });
const needs = ['Cheveux', 'Visage & peau', 'Digestion & estomac', 'Articulations', 'Jambes', 'Sommeil & détente', 'Respiration'];
await db.connect();
try {
  await db.query('BEGIN');
  await db.query('LOCK TABLE public.classification IN EXCLUSIVE MODE');
  const tables = (await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'classification' ORDER BY tablename")).rows;
  const snapshot = async () => {
    const result = [];
    for (const { tablename } of tables) {
      const table = '"' + tablename.replaceAll('"', '""') + '"';
      result.push((await db.query(`SELECT md5(COALESCE(string_agg(v, '' ORDER BY v), '')) AS hash FROM (SELECT row_to_json(t)::text AS v FROM public.${table} t) rows`)).rows[0].hash);
    }
    return result;
  };
  const before = await snapshot();
  const disabled = await db.query('UPDATE public.classification SET "isActive"=false, "updatedAt"=now() WHERE ("legacyCategoryId" IS NOT NULL OR "legacySubcategoryId" IS NOT NULL) AND "isActive" RETURNING id, "nameFr"');
  // Historical seed fingerprints only; never create or reactivate classifications.
  const starters = await db.query('UPDATE public.classification c SET "isActive"=false, "updatedAt"=now() WHERE c.id BETWEEN 96 AND 102 AND c."nameFr"=ANY($1::text[]) AND c."legacyCategoryId" IS NULL AND c."legacySubcategoryId" IS NULL AND c."isActive" AND NOT EXISTS (SELECT 1 FROM public."productClassification" pc WHERE pc."classificationId"=c.id) RETURNING id, "nameFr"', [needs]);
  disabled.rows.push(...starters.rows);
  assert.deepEqual(await snapshot(), before, 'Non-classification data changed; rolling back');
  const active = (await db.query('SELECT id, "nameFr" FROM public.classification WHERE "isActive" ORDER BY "sortOrder", id')).rows;
  const unassigned = (await db.query('SELECT count(*)::int AS count FROM public.product p WHERE NOT EXISTS (SELECT 1 FROM public."productClassification" pc JOIN public.classification c ON c.id=pc."classificationId" WHERE pc."productId"=p.id AND c."isActive")')).rows[0].count;
  await db.query('COMMIT');
  console.log(JSON.stringify({ disabled: disabled.rows, active, productsNeedingActiveClassification: unassigned, otherTablesUnchanged: true }, null, 2));
} catch (error) { await db.query('ROLLBACK'); throw error; }
finally { await db.end(); }
