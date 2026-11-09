// Read-only integrity review; never repairs or deletes records.
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(resolve(root,'backend/package.json'));
require('dotenv').config({path:resolve(root,'backend/.env'),quiet:true});
const client=new (require('pg').Client)({connectionString:process.env.DATABASE_URL});
const quote=value=>'"'+value.replaceAll('"','""')+'"';
const report={foreignKeys:[],checks:{},rowCounts:{}};
try {
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const keys=(await client.query(`SELECT c.conname, n.nspname AS schema, t.relname AS child, pn.nspname AS parent_schema, p.relname AS parent,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.num ORDER BY k.ord) AS parent_columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class p ON p.oid=c.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace WHERE c.contype='f' AND n.nspname='public' ORDER BY c.conname`)).rows;
  for(const key of keys) {
    const join=key.columns.map((name,i)=>`c.${quote(name)}=p.${quote(key.parent_columns[i])}`).join(' AND ');
    const notNull=key.columns.map(name=>`c.${quote(name)} IS NOT NULL`).join(' AND ');
    const count=(await client.query(`SELECT count(*)::int AS n FROM ${quote(key.schema)}.${quote(key.child)} c LEFT JOIN ${quote(key.parent_schema)}.${quote(key.parent)} p ON ${join} WHERE ${notNull} AND p.${quote(key.parent_columns[0])} IS NULL`)).rows[0].n;
    report.foreignKeys.push({constraint:key.conname,orphans:count});
  }
  const queries={
    duplicateCashSources:`SELECT count(*)::int AS n FROM (SELECT "sourceType","sourceId" FROM public."cashMovement" WHERE "sourceId" IS NOT NULL GROUP BY 1,2 HAVING count(*)>1) t`,
    duplicateOrderSales:`SELECT count(*)::int AS n FROM (SELECT "saleId" FROM public."onlineOrder" WHERE "saleId" IS NOT NULL GROUP BY 1 HAVING count(*)>1) t`,
    inconsistentConversions:`SELECT count(*)::int AS n FROM public."onlineOrder" WHERE ("saleId" IS NOT NULL AND (status<>'CONFIRMED' OR "convertedAt" IS NULL)) OR ("saleId" IS NULL AND "convertedAt" IS NOT NULL)`,
    missingSalePaymentCash:`SELECT count(*)::int AS n FROM public."salePayment" p LEFT JOIN public."cashMovement" c ON c."salePaymentId"=p.id WHERE c.id IS NULL`,
    missingPurchasePaymentCash:`SELECT count(*)::int AS n FROM public."purchasePayment" p LEFT JOIN public."cashMovement" c ON c."purchasePaymentId"=p.id WHERE c.id IS NULL`,
    missingExpenseCash:`SELECT count(*)::int AS n FROM public.expense e LEFT JOIN public."cashMovement" c ON c."expenseId"=e.id WHERE c.id IS NULL`,
    inconsistentCashAmounts:`SELECT count(*)::int AS n FROM public."cashMovement" c LEFT JOIN public."salePayment" s ON s.id=c."salePaymentId" LEFT JOIN public."purchasePayment" p ON p.id=c."purchasePaymentId" LEFT JOIN public.expense e ON e.id=c."expenseId" WHERE c.amount<>coalesce(s.amount,p.amount,e.amount,c.amount) OR c."paymentMethod"<>coalesce(s."paymentMethod",p."paymentMethod",e."paymentMethod",c."paymentMethod")`,
    purchaseEntryCardinality:`SELECT count(*)::int AS n FROM public.purchase p JOIN public."purchaseLine" l ON l."purchaseId"=p.id WHERE p.status='CONFIRMED' AND (SELECT count(*) FROM public."stockMovement" m WHERE m."productId"=l."productId" AND m.reference=p.reference AND m.type='ENTRY' AND m.reason='Achat fournisseur')<>1`,
    saleExitCardinality:`SELECT count(*)::int AS n FROM public.sale s JOIN public."saleLine" l ON l."saleId"=s.id WHERE s.status='CONFIRMED' AND (SELECT count(*) FROM public."stockMovement" m WHERE m."productId"=l."productId" AND m.reference=s.reference AND m.type='EXIT' AND m.reason='Vente')<>1`,
  };
  for(const [name,sql] of Object.entries(queries)) report.checks[name]=(await client.query(sql)).rows[0].n;
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  for(const {tablename} of tables) report.rowCounts[tablename]=(await client.query(`SELECT count(*)::int AS n FROM public.${quote(tablename)}`)).rows[0].n;
  await client.query('ROLLBACK');
  report.passed=report.foreignKeys.every(key=>key.orphans===0)&&Object.values(report.checks).every(n=>n===0);
} finally {await client.end();}
await mkdir(resolve(root,'.tmp'),{recursive:true});
await writeFile(resolve(root,'.tmp/final-qa-integrity.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!report.passed)process.exitCode=1;
