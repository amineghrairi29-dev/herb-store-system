import 'dotenv/config';
import { Client } from 'pg';
// Every integration file owns a disposable audit table. Real application history is never rewritten by tests.
if (process.env.RUN_DATABASE_TESTS === '1') {
  const table = `public."test_audit_${crypto.randomUUID().replaceAll('-', '')}"`;
  const settings = `public."test_settings_${crypto.randomUUID().replaceAll('-', '')}"`;
  let owner: Client;
  const original = Client.prototype.query;
  beforeAll(async () => {
    owner = new Client({ connectionString: process.env.DATABASE_URL }); await owner.connect();
    await owner.query(`CREATE TABLE ${table} (LIKE public."auditEvent" INCLUDING ALL)`);
    await owner.query(`CREATE TABLE ${settings} (LIKE public."storeSettings" INCLUDING ALL)`);
    Client.prototype.query = function (this: Client, ...args: unknown[]) {
      if (typeof args[0] === 'string') args[0] = args[0].replaceAll('public."auditEvent"', table).replaceAll('public."storeSettings"', settings);
      return Reflect.apply(original, this, args);
    } as Client['query'];
  });
  afterAll(async () => { Client.prototype.query = original; await owner?.query(`DROP TABLE IF EXISTS ${table}`); await owner?.query(`DROP TABLE IF EXISTS ${settings}`); await owner?.end(); });
}
