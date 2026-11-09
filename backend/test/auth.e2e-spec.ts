import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { UsersService } from '../src/auth/users.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';
import { StockMovementsController, ProductStockController } from '../src/stock-movements/stock-movements.controller.js';
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';
import { PurchasesController } from '../src/purchases/purchases.controller.js';
import { PurchasesService } from '../src/purchases/purchases.service.js';
import { SalesController } from '../src/sales/sales.controller.js';
import { SalesService } from '../src/sales/sales.service.js';
import { FinanceController } from '../src/finance/finance.controller.js';
import { FinanceService } from '../src/finance/finance.service.js';
import { OnlineOrdersController, PublicOrdersController } from '../src/online-orders/online-orders.controller.js';
import { OnlineOrdersService } from '../src/online-orders/online-orders.service.js';
import { OrderFulfillmentController } from '../src/online-orders/order-fulfillment.controller.js';
import { OrderFulfillmentService } from '../src/online-orders/order-fulfillment.service.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { PublicCartController } from '../src/public-catalogue/public-cart.controller.js';
import { PublicCartService } from '../src/public-catalogue/public-cart.service.js';
import type { SafeUser, Role } from '../src/auth/auth-policy.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Authentication + RBAC (UUID fixtures)', () => {
  const tag = `test-auth-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`, origin = 'http://localhost:3000';
  const db = new Client({ connectionString: process.env.DATABASE_URL }), users = new UsersService();
  let app: INestApplication<App>, before: unknown, productId: number;
  const accounts = {} as Record<Role, SafeUser>, cookies = {} as Record<Role, string>;
  const tables = ['product', 'stockMovement', 'sale', 'saleLine', 'salePayment', 'cashMovement', 'onlineOrder', 'onlineOrderLine', 'purchase', 'purchaseLine', 'purchasePayment', 'expense', 'supplier', 'user', 'authSession'];
  async function snapshot() { const rows: unknown[] = []; for (const table of tables) rows.push((await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows); return rows; }
  const login = (email: string, pass = password) => request(app.getHttpServer()).post('/auth/login').set('Origin', origin).send({ email, password: pass });
  const as = (role: Role) => ({ get: (path: string) => request(app.getHttpServer()).get(path).set('Cookie', cookies[role]), post: (path: string) => request(app.getHttpServer()).post(path).set('Cookie', cookies[role]).set('Origin', origin), patch: (path: string) => request(app.getHttpServer()).patch(path).set('Cookie', cookies[role]).set('Origin', origin) });
  async function makeUser(role: Role, suffix: string = role, isActive = true) { const result = await users.create({ email: `${tag}-${suffix}@example.com`, fullName: `${tag} عميل`, role, isActive, password }); if (!('id' in result)) throw new Error('Expected user'); return result; }
  beforeAll(async () => {
    for (const [controller, service] of [[ProductsController, ProductsService], [StockMovementsController, StockMovementsService], [ProductStockController, StockMovementsService], [PurchasesController, PurchasesService], [SalesController, SalesService], [FinanceController, FinanceService], [OnlineOrdersController, OnlineOrdersService], [PublicOrdersController, OnlineOrdersService], [OrderFulfillmentController, OrderFulfillmentService], [OrderFulfillmentService, SalesService], [PublicCatalogueController, PublicCatalogueService], [PublicCartController, PublicCartService]]) Reflect.defineMetadata('design:paramtypes', [service], controller);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init();
    await db.connect(); before = await snapshot();
    for (const role of ['ADMIN'] as const) { accounts[role] = await makeUser(role); const response = await login(accounts[role].email).expect(200); cookies[role] = String(response.headers['set-cookie'][0]).split(';')[0]; }
    productId = (await db.query(`INSERT INTO public.product ("categoryId",sku,name,"productType","salePrice",category,"storageUnit","saleUnit","conversionFactor","isActive","isSellable","isVisibleOnline","updatedAt") VALUES (${classification.id},$1,'نعناع','VRAC',1,$1,'KG','KG',1,true,true,true,now()) RETURNING id`, [tag])).rows[0].id;
    await classification.link(db, productId);
    await db.query(`INSERT INTO public."stockMovement" ("productId",type,quantity,unit,"quantityInStorageUnit") VALUES ($1,'ENTRY',10,'KG',10)`, [productId]);
  }, 30000);
  afterAll(async () => {
    await app?.close();
    await db.query('BEGIN');
    await db.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName" = $1)', [tag]);
    await db.query('DELETE FROM public."onlineOrder" WHERE "customerName" = $1', [tag]);
    await db.query('DELETE FROM public."cashMovement" WHERE "salePaymentId" IN (SELECT p.id FROM public."salePayment" p JOIN public.sale s ON s.id = p."saleId" WHERE s."customerName" = $1)', [tag]);
    await db.query('DELETE FROM public."salePayment" WHERE "saleId" IN (SELECT id FROM public.sale WHERE "customerName" = $1)', [tag]);
    await db.query('DELETE FROM public."saleLine" WHERE "saleId" IN (SELECT id FROM public.sale WHERE "customerName" = $1)', [tag]);
    await db.query('DELETE FROM public.sale WHERE "customerName" = $1', [tag]);
    await db.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [productId]);
    await db.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [productId, tag]);
    await db.query('DELETE FROM public."user" WHERE email LIKE $1', [`${tag}-%@example.com`]);
    await db.query('COMMIT'); const after = await snapshot(); await db.end(); expect(after).toEqual(before);
  }, 20000);
  it('login normalizes email, sets HttpOnly/Lax cookie, returns only safe fields and updates lastLoginAt', async () => {
    const response = await login(` ${accounts.ADMIN.email.toUpperCase()} `).expect(200);
    expect(Object.keys(response.body as object).sort()).toEqual(['email', 'fullName', 'id', 'role']); expect(response.headers['set-cookie'][0]).toContain('HttpOnly'); expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect((await users.findOne(accounts.ADMIN.id)).lastLoginAt).not.toBeNull();
  });
  it('wrong password, unknown and inactive accounts have the same generic failure', async () => {
    const inactive = await makeUser('ADMIN', 'INACTIVE', false);
    const results = [await login(accounts.ADMIN.email, 'Wrong-pass9').expect(401), await login(`${tag}-unknown@example.com`).expect(401), await login(inactive.email).expect(401)];
    expect(results[0].body).toEqual(results[1].body); expect(results[1].body).toEqual(results[2].body);
  });
  it('me works only with a live session; logout revokes a copied cookie', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401); await as('ADMIN').get('/auth/me').expect(200);
    const response = await login(accounts.ADMIN.email).expect(200), cookie = String(response.headers['set-cookie'][0]).split(';')[0];
    const logout = await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).set('Origin', origin).expect(200); expect(logout.headers['set-cookie'][0]).toContain('Expires=Thu, 01 Jan 1970');
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
  });
  it.each(['/products', '/stock-movements', '/purchases', '/sales', '/suppliers', '/cash/summary', '/expenses', '/finance/summary', '/reports/sales', '/online-orders', '/users'])('unauthenticated %s returns 401', async path => { await request(app.getHttpServer()).get(path).expect(401); });
  it.each(['/products', '/categories', '/classifications', '/stock-movements', '/purchases', '/sales', '/suppliers', '/cash/summary', '/expenses', '/finance/summary', '/reports/sales', '/online-orders', '/users', '/audit-events', '/settings/store', '/dashboard'])('ADMIN can access %s', async path => { await as('ADMIN').get(path).expect(200); });
  it('ADMIN can create/edit/confirm sales and record a noncash customer payment using existing rules', async () => {
    const created = await as('ADMIN').post('/sales').send({ reference: `${tag}-SALE`, saleDate: '2026-09-07', customerName: tag, lines: [{ productId, quantity: '1', unit: 'KG', unitSalePrice: '1' }] }).expect(201); const id = (created.body as { id: number }).id;
    await as('ADMIN').patch(`/sales/${id}`).send({ notes: 'اختبار' }).expect(200); await as('ADMIN').post(`/sales/${id}/confirm`).expect(201);
    await as('ADMIN').post(`/sales/${id}/payments`).send({ amount: '1', paymentDate: '2026-09-07', paymentMethod: 'BANK_TRANSFER', reference: tag }).expect(201);
  });
  it('public catalogue/cart stay public; ADMIN confirms/converts and cancels orders', async () => {
    await request(app.getHttpServer()).get('/public/products').expect(200); await request(app.getHttpServer()).get('/public/categories').expect(200);
    await request(app.getHttpServer()).post('/public/cart/validate').send({ items: [{ productId, quantity: '2' }] }).expect(200);
    for (const status of ['CONFIRMED', 'CANCELLED']) {
      const receipt = { body: await new OnlineOrdersService().create({ deliveryAddress: '12 rue des Plantes', customerName: tag, customerPhone: '20123456', items: [{ productId, quantity: '2' }] }) };
      const id = (await db.query('SELECT id FROM public."onlineOrder" WHERE reference = $1', [(receipt.body as { reference: string }).reference])).rows[0].id as number;
      await as('ADMIN').get(`/online-orders/${id}`).expect(200); await as('ADMIN').patch(`/online-orders/${id}/status`).send({ status }).expect(200);
      if (status === 'CONFIRMED') await as('ADMIN').post(`/online-orders/${id}/convert-to-sale`).expect(200);
    }
    await as('ADMIN').get('/online-orders').expect(200);
  });
  it('user validation rejects duplicate email, weak/overlong passwords, invalid roles and unknown fields', async () => {
    const input = { fullName: tag, email: accounts.ADMIN.email.toUpperCase(), role: 'ADMIN', password };
    await as('ADMIN').post('/users').send(input).expect(409);
    for (const change of [{ password: 'weak' }, { password: 'a'.repeat(73) + '1' }, { role: 'OWNER' }, { role: 'MANAGER' }, { role: 'SELLER' }, { role: 'AGENT' }, { role: 'CUSTOMER' }, { passwordHash: 'invalid' }]) await as('ADMIN').post('/users').send({ ...input, email: `${tag}-invalid@example.com`, ...change }).expect(400);
    const list = await as('ADMIN').get('/users').expect(200); expect(JSON.stringify(list.body)).not.toContain('passwordHash');
  });
  it('self-deactivation is rejected; changing password/deactivation revokes existing sessions', async () => {
    await as('ADMIN').patch(`/users/${accounts.ADMIN.id}`).send({ isActive: false }).expect(409);
    const target = await makeUser('ADMIN', 'REVOCATION');
    for (const change of ['password', 'inactive']) {
      const response = await login(target.email).expect(200), cookie = String(response.headers['set-cookie'][0]).split(';')[0];
      if (change === 'password') await as('ADMIN').patch(`/users/${target.id}/password`).send({ password }).expect(200);
      else await as('ADMIN').patch(`/users/${target.id}`).send({ isActive: false }).expect(200);
      await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
    }
  });
  it('rejects expired/invalid cookies and cross-origin or missing-origin writes', async () => {
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', 'herb_session=invalid').expect(401);
    const expiring = await makeUser('ADMIN', 'EXPIRING');
    const auth = new AuthService(), session = await auth.login({ email: expiring.email, password });
    await db.query('UPDATE public."authSession" SET "expiresAt" = now() - interval \'1 second\' WHERE "userId" = $1', [expiring.id]); await expect(auth.current(session.token)).rejects.toThrow('Session expirée');
    for (const bad of [undefined, 'https://evil.example']) { const req = request(app.getHttpServer()).post('/users').set('Cookie', cookies.ADMIN); if (bad) req.set('Origin', bad); await req.send({}).expect(403); }
    await request(app.getHttpServer()).post('/auth/login').set('Origin', 'https://evil.example').send({ email: accounts.ADMIN.email, password }).expect(403);
  });
  it('bootstrap does not overwrite an existing user or create a second initial admin', async () => {
    const beforeUser = await users.findOne(accounts.ADMIN.id);
    const result = await users.create({ email: accounts.ADMIN.email, fullName: 'Changed', role: 'ADMIN', password }, true); expect(result).toHaveProperty('created', false); expect(await users.findOne(accounts.ADMIN.id)).toEqual(beforeUser);
    expect(await users.create({ email: `${tag}-bootstrap@example.com`, fullName: tag, role: 'ADMIN', password }, true)).toHaveProperty('created', false);
  });
  it('serializes concurrent admin deactivations and preserves the last active admin', async context => {
    const others = await db.query('SELECT id FROM public."user" WHERE role = \'ADMIN\' AND "isActive" = true AND id <> $1', [accounts.ADMIN.id]);
    if (others.rowCount) { context.skip(); return; } // Never change an existing real admin to arrange a test.
    await as('ADMIN').patch(`/users/${accounts.ADMIN.id}`).send({ isActive: false }).expect(409);
    await expect(users.update(accounts.ADMIN.id, { isActive: false }, -1)).rejects.toThrow('dernier administrateur');
    const second = await makeUser('ADMIN', 'SECOND');
    const results = await Promise.allSettled([users.update(accounts.ADMIN.id, { isActive: false }, -1), users.update(second.id, { isActive: false }, -1)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((await db.query('SELECT id FROM public."user" WHERE role = \'ADMIN\' AND "isActive" = true')).rowCount).toBe(1);
  });
  it('throttles repeated failed logins with a standard 429 response', async () => {
    let lastStatus = 0;
    for (let i = 0; i < 11; i++) lastStatus = (await login(`${tag}-unknown@example.com`, 'Wrong-pass9')).status;
    expect(lastStatus).toBe(429);
  });
});
