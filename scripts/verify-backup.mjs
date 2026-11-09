// Read-only source snapshot; creates/drops only its own UUID recovery database.
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(resolve(root, 'backend/package.json'));
require('dotenv').config({ path: resolve(root, 'backend/.env'), quiet: true });
const { Client } = require('pg');
const source = new Client({ connectionString: process.env.DATABASE_URL });
const targetName = `herb_restore_${randomUUID().replaceAll('-', '')}`;
const sourceUrl = new URL(process.env.DATABASE_URL);
const sourceName = decodeURIComponent(sourceUrl.pathname.slice(1));
assert.notEqual(targetName, sourceName);
const targetUrl = new URL(sourceUrl); targetUrl.pathname = `/${targetName}`;
const target = new Client({ connectionString: targetUrl.toString() });
const childEnv = { ...process.env, PGHOST: sourceUrl.hostname, PGPORT: sourceUrl.port || '5432', PGDATABASE: sourceName, PGUSER: decodeURIComponent(sourceUrl.username), PGPASSWORD: decodeURIComponent(sourceUrl.password), PGCLIENTENCODING: 'UTF8' };
if (sourceUrl.searchParams.has('sslmode')) childEnv.PGSSLMODE = sourceUrl.searchParams.get('sslmode');
function run(script, args = []) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts', script), ...args], { env: childEnv, windowsHide: true });
    let output = '', diagnostics = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { diagnostics += data; });
    child.on('error', () => reject(new Error(`${script} could not start.`)));
    child.on('close', code => {
      for (const sensitive of [process.env.DATABASE_URL, childEnv.PGPASSWORD, sourceUrl.password].filter(Boolean)) diagnostics = diagnostics.replaceAll(sensitive, '[REDACTED]');
      code === 0 ? resolveRun(output.trim()) : reject(new Error(`${script} failed with exit ${code}: ${diagnostics}`));
    });
  });
}
const quote = value => '"' + value.replaceAll('"', '""') + '"';
async function snapshot(client) {
  await client.query("SET TIME ZONE 'UTC'");
  const tables = (await client.query("SELECT schemaname, tablename FROM pg_tables WHERE schemaname NOT LIKE 'pg_%' AND schemaname <> 'information_schema' ORDER BY schemaname, tablename")).rows;
  const result = {}; let arabic = false, accented = false;
  for (const { schemaname, tablename } of tables) {
    const rows = (await client.query(`SELECT row_to_json(t)::text AS value FROM ${quote(schemaname)}.${quote(tablename)} t ORDER BY row_to_json(t)::text COLLATE "C"`)).rows;
    const digest = createHash('sha256');
    for (const { value } of rows) { digest.update(value).update('\n'); arabic ||= /[\u0600-\u06ff]/u.test(value); accented ||= /[\u00c0-\u024f]/u.test(value); }
    result[`${schemaname}.${tablename}`] = { count: rows.length, digest: digest.digest('hex') };
  }
  return { tables: result, arabic, accented };
}
let created = false, connected = false, report;
try {
  await source.connect();
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const before = await snapshot(source);
  const snapshotId = (await source.query('SELECT pg_export_snapshot() AS id')).rows[0].id;
  const archive = await run('backup-db.ps1', ['-Snapshot', snapshotId]);
  assert.ok((await stat(archive)).size > 0);
  assert.match(archive, /herb_store_db_\d{4}-\d{2}-\d{2}_\d{6}_\d{3}_[a-f0-9]{32}\.dump$/);
  await source.query('COMMIT');
  await source.query(`CREATE DATABASE ${quote(targetName)} TEMPLATE template0 ENCODING 'UTF8'`);
  created = true;
  await run('restore-db.ps1', ['-BackupFile', archive, '-TargetDatabase', targetName, '-ConfirmEmptyDatabase']);
  await target.connect(); connected = true;
  const restored = await snapshot(target);
  // Don't let assertion diagnostics print row hashes or private content.
  assert.ok(JSON.stringify(before) === JSON.stringify(restored), 'Restored table counts/content differ from the exported source snapshot.');
  for (const name of ['product', 'user', 'stockMovement', 'sale', 'onlineOrder', 'storeSettings', 'auditEvent']) assert.ok(before.tables[`public.${name}`], `Missing required table: ${name}`);
  await assert.rejects(run('restore-db.ps1', ['-BackupFile', archive, '-TargetDatabase', sourceName, '-ConfirmEmptyDatabase']));
  await assert.rejects(run('restore-db.ps1', ['-BackupFile', archive, '-TargetDatabase', targetName, '-ConfirmEmptyDatabase']));
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const after = await snapshot(source); await source.query('COMMIT');
  assert.ok(JSON.stringify(before) === JSON.stringify(after), 'Source changed during validation (possibly an external writer).');
  report = { archive, archiveBytes: (await stat(archive)).size, restored: true, sourceUnchanged: true, utf8ArabicPresent: before.arabic, accentedTextPresent: before.accented, exactTextAndDecimalsMatch: true, unsafeTargetsRejected: true, tableCounts: Object.fromEntries(Object.entries(before.tables).map(([key, value]) => [key, value.count])) };
} finally {
  if (connected) await target.end();
  if (created) {
    // No FORCE: do not terminate unrelated sessions, and never derive this name from user input.
    assert.match(targetName, /^herb_restore_[a-f0-9]{32}$/);
    await source.query(`DROP DATABASE ${quote(targetName)}`);
    if (report) report.disposableDatabaseDropped = true;
  }
  await source.end();
}
await mkdir(resolve(root, '.tmp'), { recursive: true });
await writeFile(resolve(root, '.tmp/security-backup-validation.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
