import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { UsersService } from '../src/auth/users.service.js';
import type { Role } from '../src/auth/auth-policy.js';
import { StoreSettingsModule } from '../src/settings/store-settings.module.js';
import { StoreSettingsService } from '../src/settings/store-settings.service.js';
import { defaultSettings } from '../src/settings/store-settings.values.js';
import * as transactions from '../src/purchases/purchase-transaction.js';
import { FinanceService } from '../src/finance/finance.service.js';
import { CashService } from '../src/cash/cash.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Store settings (real SQL and auth, isolated settings table)', () => {
  const tag = `settings_${crypto.randomUUID().replaceAll('-', '')}`, testTable = `public."${tag}"`, password = `Ss9-${crypto.randomUUID()}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL }), cookies = {} as Record<Role, string>;
  const tables = ['product', 'stockMovement', 'sale', 'saleLine', 'purchase', 'purchaseLine', 'salePayment', 'purchasePayment', 'cashMovement', 'expense', 'onlineOrder', 'onlineOrderLine', 'supplier', 'user', 'authSession', 'storeSettings'];
  let app: INestApplication<App>, before: unknown, financialBefore: unknown, cashBefore: unknown;
  const snapshot = async () => { const rows = []; for (const table of tables) rows.push((await client.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows); return rows; };
  const get = (role: Role) => request(app.getHttpServer()).get('/settings/store').set('Cookie', cookies[role]);
  const patch = (body: object, role: Role = 'ADMIN') => request(app.getHttpServer()).patch('/settings/store').set('Cookie', cookies[role]).set('Origin', 'http://localhost:3000').send(body);
  beforeAll(async () => {
    await client.connect(); before = await snapshot();
    // LIKE INCLUDING ALL preserves singleton/default/check constraints. Production settings are never changed.
    await client.query(`CREATE TABLE ${testTable} (LIKE public."storeSettings" INCLUDING ALL)`);
    const original = transactions.withPurchaseTransaction;
    vi.spyOn(transactions, 'withPurchaseTransaction').mockImplementation((work, readOnly) => original(tx => work({ ...tx, client: new Proxy(tx.client, {
      get(target, property) {
        if (property === 'query') return (...args: unknown[]) => { if (typeof args[0] === 'string') args[0] = args[0].replaceAll('public."storeSettings"', testTable); return Reflect.apply(target.query, target, args); };
        const value: unknown = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
      },
    }) }), readOnly));
    const module = await Test.createTestingModule({ imports: [AuthModule, StoreSettingsModule] }).compile(); app = module.createNestApplication(); app.useLogger(false); await app.init();
    for (const role of ['ADMIN'] as const) {
      const email = `${tag}-${role}@example.com`.toLowerCase(); await new UsersService().create({ email, role, fullName: tag, password, isActive: true });
      const session = await new AuthService().login({ email, password }); cookies[role] = `herb_session=${session.token}`;
    }
    financialBefore = await new FinanceService().summary({ period: 'today' }); cashBefore = await new CashService().summary();
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks(); if (app) await app.close();
    await client.query('DELETE FROM public."user" WHERE email LIKE $1', [`${tag}-%@example.com`]);
    await client.query(`DROP TABLE IF EXISTS ${testTable}`);
    try { expect(await snapshot()).toEqual(before); } finally { await client.end(); }
  });
  it('rejects unauthenticated direct settings access', async () => {
    await request(app.getHttpServer()).get('/settings/store').expect(401);
    await request(app.getHttpServer()).patch('/settings/store').send({ storeName: 'No' }).expect(401);
  });
  it('returns defaults repeatedly without creating rows', async () => {
    for (let i = 0; i < 3; i++) expect((await get('ADMIN').expect(200)).body).toEqual(defaultSettings);
    expect((await client.query(`SELECT * FROM ${testTable}`)).rowCount).toBe(0);
  });
  it('rejects invalid input and cross-origin writes before persistence', async () => {
    for (const body of [{ storeName: '' }, { storeName: null }, { email: 'wrong' }, { currency: 'EUR' }, { id: 2 }, { country: 'x'.repeat(101) }]) await patch(body).expect(400);
    await request(app.getHttpServer()).patch('/settings/store').set('Cookie', cookies.ADMIN).send({ storeName: 'No' }).expect(403);
    expect((await client.query(`SELECT * FROM ${testTable}`)).rowCount).toBe(0);
  });
  it('atomically initializes one singleton under concurrent saves and preserves independent fields', async () => {
    await Promise.all([patch({ storeName: 'أعشاب تونس' }).expect(200), patch({ phone: '22111222' }).expect(200), patch({ city: 'Tunis' }).expect(200)]);
    const saved = (await get('ADMIN').expect(200)).body as Record<string, unknown>;
    expect(saved).toMatchObject({ id: 1, storeName: 'أعشاب تونس', phone: '22111222', city: 'Tunis', currency: 'TND' });
    expect(saved.createdAt).toBeTruthy(); expect(saved.updatedAt).toBeTruthy(); expect((await client.query(`SELECT * FROM ${testTable}`)).rowCount).toBe(1);
  });
  it('persists French/Arabic, clears optional text, and preserves omitted fields', async () => {
    await patch({ address: 'شارع الأعشاب · Tunis', reportFooter: 'Merci · شكراً', email: 'contact@example.com', secondaryPhone: '123', website: 'https://example.com' }).expect(200);
    await patch({ secondaryPhone: '', country: 'Tunisie' }).expect(200);
    expect((await get('ADMIN').expect(200)).body).toMatchObject({ storeName: 'أعشاب تونس', address: 'شارع الأعشاب · Tunis', reportFooter: 'Merci · شكراً', secondaryPhone: null, country: 'Tunisie' });
  });
  it('database enforces singleton and TND even outside API validation', async () => {
    await expect(client.query(`INSERT INTO ${testTable} (id, "updatedAt") VALUES (2, now())`)).rejects.toMatchObject({ code: '23514' });
    await expect(client.query(`UPDATE ${testTable} SET currency = 'EUR'`)).rejects.toMatchObject({ code: '23514' });
    expect((await client.query(`SELECT * FROM ${testTable}`)).rowCount).toBe(1);
  });
  it('public output contains only storefront contact fields; report identity is permission protected', async () => {
    const publicInfo = (await request(app.getHttpServer()).get('/public/store-info').expect(200)).body as Record<string, unknown>;
    expect(Object.keys(publicInfo).sort()).toEqual(['address', 'city', 'email', 'phone', 'secondaryPhone', 'storeName']);
    expect(publicInfo).toMatchObject({ storeName: 'أعشاب تونس', address: 'شارع الأعشاب · Tunis', email: 'contact@example.com' });
    await request(app.getHttpServer()).patch('/public/store-info').set('Cookie', cookies.ADMIN).set('Origin', 'http://localhost:3000').send({}).expect(404);
    await request(app.getHttpServer()).get('/reports/store-info/identity').expect(401);
    for (const role of ['ADMIN'] as const) {
      const row = (await request(app.getHttpServer()).get('/reports/store-info/identity').set('Cookie', cookies[role]).expect(200)).body as Record<string, unknown>;
      expect(Object.keys(row).sort()).toEqual(['address', 'city', 'email', 'phone', 'reportFooter', 'storeName']); expect(row.reportFooter).toBe('Merci · شكراً');
    }
  });
  it('repeated reads do not mutate settings and financial results are unchanged', async () => {
    const service = new StoreSettingsService(), saved = await service.read(); await service.read(); expect(await service.read()).toEqual(saved);
    expect(await new FinanceService().summary({ period: 'today' })).toEqual(financialBefore); expect(await new CashService().summary()).toEqual(cashBefore);
  });
});
