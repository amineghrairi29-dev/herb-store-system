import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { AppModule } from '../src/app.module.js';
import { UsersService } from '../src/auth/users.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import type { Role, SafeUser } from '../src/auth/auth-policy.js';
import { auditContext } from '../src/audit/audit-context.js';
import { AuditService } from '../src/audit/audit.service.js';
import type { AuditRow } from '../src/audit/audit-read.service.js';
import { ProductsService } from '../src/products/products.service.js';
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';
import { SuppliersService } from '../src/suppliers/suppliers.service.js';
import { PurchasesService } from '../src/purchases/purchases.service.js';
import { SalesService } from '../src/sales/sales.service.js';
import { ExpensesService } from '../src/expenses/expenses.service.js';
import { CashService } from '../src/cash/cash.service.js';
import { OnlineOrdersService } from '../src/online-orders/online-orders.service.js';
import { OrderFulfillmentService } from '../src/online-orders/order-fulfillment.service.js';
import { StoreSettingsService } from '../src/settings/store-settings.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Audit traceability (isolated audit/settings tables, owned business fixtures)', () => {
  const tag = `TEST-AUDIT-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`, origin = 'http://localhost:3000';
  const db = new Client({ connectionString: process.env.DATABASE_URL }), users = new UsersService(), products = new ProductsService(), stock = new StockMovementsService(), sales = new SalesService(), purchases = new PurchasesService(), suppliers = new SuppliersService(), expenses = new ExpensesService(), cash = new CashService(), orders = new OnlineOrdersService();
  let app: INestApplication<App>, before: unknown, productId: number, supplierId: number, saleId: number, userId: number;
  const actors = {} as Record<Role, SafeUser>, cookies = {} as Record<Role, string>;
  const tables = ['product', 'stockMovement', 'sale', 'saleLine', 'purchase', 'purchaseLine', 'salePayment', 'purchasePayment', 'cashMovement', 'expense', 'onlineOrder', 'onlineOrderLine', 'supplier', 'user', 'authSession'];
  const snapshot = async () => { const rows = []; for (const table of tables) rows.push((await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows); return rows; };
  const scope = <T>(work: () => T) => auditContext.run({ actor: actors.ADMIN, ipAddress: '127.0.0.1', userAgent: 'Audit integration test' }, work);
  const events = async (action?: string) => (await db.query<AuditRow>(`SELECT * FROM public."auditEvent"${action ? ' WHERE action = $1' : ''} ORDER BY id`, action ? [action] : [])).rows;
  const get = (path: string, role: Role = 'ADMIN') => request(app.getHttpServer()).get(path).set('Cookie', cookies[role]);
  beforeAll(async () => {
    await db.connect(); before = await snapshot();
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); app.useLogger(false); await app.init();
    for (const role of ['ADMIN'] as const) {
      const user = await users.create({ email: `${tag}-${role}@example.com`, fullName: `مدير ${tag}`, role, password }); if (!('id' in user)) throw new Error('Expected user'); actors[role] = user;
      const session = await new AuthService().login({ email: user.email, password }); cookies[role] = `herb_session=${session.token}`;
    }
  }, 30000);
  afterAll(async () => {
    await app?.close();
    const ids = async (table: string, field: string) => (await db.query<{ id: number }>(`SELECT id FROM public."${table}" WHERE "${field}" LIKE $1`, [`%${tag}%`])).rows.map(row => row.id);
    const saleIds = await ids('sale', 'reference'), purchaseIds = await ids('purchase', 'reference'), expenseIds = await ids('expense', 'reference'), orderIds = await ids('onlineOrder', 'customerName');
    await db.query('BEGIN');
    await db.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" = ANY($1::int[])', [orderIds]); await db.query('DELETE FROM public."onlineOrder" WHERE id = ANY($1::int[])', [orderIds]);
    await db.query('DELETE FROM public."cashMovement" WHERE reference LIKE $1 OR "salePaymentId" IN (SELECT id FROM public."salePayment" WHERE "saleId" = ANY($2::int[])) OR "purchasePaymentId" IN (SELECT id FROM public."purchasePayment" WHERE "purchaseId" = ANY($3::int[])) OR "expenseId" = ANY($4::int[])', [`%${tag}%`, saleIds, purchaseIds, expenseIds]);
    for (const [line, parent, key, owned] of [['salePayment', 'sale', 'saleId', saleIds], ['purchasePayment', 'purchase', 'purchaseId', purchaseIds], ['saleLine', 'sale', 'saleId', saleIds], ['purchaseLine', 'purchase', 'purchaseId', purchaseIds]] as const) { void parent; await db.query(`DELETE FROM public."${line}" WHERE "${key}" = ANY($1::int[])`, [owned]); }
    await db.query('DELETE FROM public.sale WHERE id = ANY($1::int[])', [saleIds]); await db.query('DELETE FROM public.purchase WHERE id = ANY($1::int[])', [purchaseIds]); await db.query('DELETE FROM public.expense WHERE id = ANY($1::int[])', [expenseIds]);
    await db.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE sku LIKE $1)', [`${tag}%`]); await db.query('DELETE FROM public.product WHERE sku LIKE $1', [`${tag}%`]); await db.query('DELETE FROM public.supplier WHERE code LIKE $1', [`${tag}%`]);
    await db.query('DELETE FROM public."user" WHERE email LIKE $1', [`${tag.toLowerCase()}-%@example.com`]); await db.query('COMMIT');
    try { expect(await snapshot()).toEqual(before); } finally { await db.end(); }
  });
  it('audits successful login, credential failure and logout without credential or forwarded-header leakage', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').set('Origin', origin).set('User-Agent', 'Audit browser').set('X-Forwarded-For', '203.0.113.99').send({ email: actors.ADMIN.email, password }).expect(200);
    const cookie = String(login.headers['set-cookie'][0]).split(';')[0];
    await request(app.getHttpServer()).post('/auth/login').set('Origin', origin).send({ email: actors.ADMIN.email, password: 'Wrong-secret-123' }).expect(401);
    await request(app.getHttpServer()).post('/auth/logout').set('Origin', origin).set('Cookie', cookie).expect(200);
    expect(await events('AUTH_LOGIN_SUCCESS')).toHaveLength(1); expect(await events('AUTH_LOGIN_FAILURE')).toHaveLength(1); expect(await events('AUTH_LOGOUT')).toHaveLength(1);
    const row = (await events('AUTH_LOGIN_SUCCESS'))[0]; expect(row.actorUserId).toBe(actors.ADMIN.id); expect(row.ipAddress).not.toBe('203.0.113.99'); expect(row.userAgent).toBe('Audit browser');
    const serialized = JSON.stringify(await events()); for (const secret of [password, 'Wrong-secret-123', cookie, 'passwordHash', 'Authorization', 'tokenHash']) expect(serialized).not.toContain(secret);
  });
  it('keeps login/logout available on audit failure and logs only a constant operational message', async () => {
    const log = vi.spyOn(Logger, 'error').mockImplementation(() => {}), writer = vi.spyOn(AuditService, 'record').mockRejectedValue(new Error('secret-must-not-be-logged'));
    try {
      const login = await request(app.getHttpServer()).post('/auth/login').set('Origin', origin).send({ email: actors.ADMIN.email, password }).expect(200);
      const cookie = String(login.headers['set-cookie'][0]).split(';')[0];
      await request(app.getHttpServer()).post('/auth/logout').set('Origin', origin).set('Cookie', cookie).expect(200);
      expect(log).toHaveBeenCalledTimes(2); expect(log.mock.calls.every(call => call[0] === 'Security audit write failed')).toBe(true);
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-must-not-be-logged');
    } finally { writer.mockRestore(); log.mockRestore(); }
  });
  it('audits user creation, active changes and password changes with snapshots', async () => scope(async () => {
    const created = await users.create({ email: `${tag}-target@example.com`, fullName: 'مستخدم تجريبي', role: 'ADMIN', password }); if (!('id' in created)) throw new Error(); userId = created.id;
    await users.update(userId, { isActive: false }, actors.ADMIN.id); await users.update(userId, { isActive: true }, actors.ADMIN.id); await users.password(userId, { password });
    for (const action of ['USER_CREATE', 'USER_DEACTIVATE', 'USER_ACTIVATE', 'USER_PASSWORD_CHANGE']) expect(await events(action)).toHaveLength(1);
    await users.update(actors.ADMIN.id, { fullName: 'Changed actor name' }, actors.ADMIN.id); expect((await events('USER_CREATE'))[0].actorNameSnapshot).toBe(actors.ADMIN.fullName);
  }));
  it('audits products and all six manual movement types once each', async () => scope(async () => {
    const product = await products.create({ sku: tag, name: 'نعناع', productType: 'VRAC', classificationIds: [classification.classificationId], measurementMode: 'FLEXIBLE', salePrice: '2', storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', isVisibleOnline: true }); productId = product.id;
    await products.update(productId, { nameFr: 'Menthe' });
    for (const type of ['ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'RETURN_IN']) await stock.create({ productId, type, quantity: type === 'ENTRY' ? '100' : '1', unit: 'KG', reference: tag });
    for (const action of ['PRODUCT_CREATE', 'PRODUCT_UPDATE', 'STOCK_ENTRY_CREATE', 'STOCK_EXIT_CREATE', 'STOCK_LOSS_CREATE', 'STOCK_ADJUSTMENT_IN_CREATE', 'STOCK_ADJUSTMENT_OUT_CREATE', 'STOCK_RETURN_IN_CREATE']) expect(await events(action)).toHaveLength(1);
  }));
  it('audits supplier create/update and activation changes', async () => scope(async () => {
    supplierId = (await suppliers.create({ code: tag, name: 'Fournisseur Test' })).id;
    await suppliers.update(supplierId, { name: 'مورد تجريبي' }); await suppliers.update(supplierId, { isActive: false }); await suppliers.update(supplierId, { isActive: true });
    for (const action of ['SUPPLIER_CREATE', 'SUPPLIER_UPDATE', 'SUPPLIER_DEACTIVATE', 'SUPPLIER_ACTIVATE']) expect(await events(action)).toHaveLength(1);
  }));
  it('audits purchase and sale lifecycle/payments without duplicate automatic stock or cash events', async () => scope(async () => {
    const purchase = await purchases.create({ reference: `${tag}-PUR`, supplierId, purchaseDate: '2026-09-08', lines: [{ productId, quantity: '2', unit: 'KG', unitPurchasePrice: '1' }] });
    await purchases.update(purchase.id, { notes: 'test' }); await purchases.confirm(purchase.id); await purchases.addPayment(purchase.id, { amount: '1', paymentDate: '2026-09-08', paymentMethod: 'CASH' });
    const sale = await sales.create({ reference: `${tag}-SALE`, saleDate: '2026-09-08', lines: [{ productId, quantity: '2', unit: 'KG', unitSalePrice: '2' }] }); saleId = sale.id;
    await sales.update(sale.id, { notes: 'test' }); await sales.confirm(sale.id); await sales.addPayment(sale.id, { amount: '1', paymentDate: '2026-09-08', paymentMethod: 'CASH' });
    for (const action of ['PURCHASE_CREATE', 'PURCHASE_UPDATE', 'PURCHASE_CONFIRM', 'PURCHASE_PAYMENT_CREATE', 'SALE_CREATE', 'SALE_UPDATE', 'SALE_CONFIRM', 'SALE_PAYMENT_CREATE']) expect(await events(action)).toHaveLength(1);
    expect(await events('STOCK_EXIT_CREATE')).toHaveLength(1); expect(await events('STOCK_ENTRY_CREATE')).toHaveLength(1); expect(await events('CASH_MANUAL_IN_CREATE')).toHaveLength(0);
  }));
  it('audits expenses, manual cash and settings updates with only changed settings field names', async () => scope(async () => {
    const expense = await expenses.create({ reference: `${tag}-EXP`, description: 'test', category: 'OTHER', amount: '1', paymentMethod: 'CASH', expenseDate: '2026-09-08' }); await expenses.update(expense.id, { description: 'updated' });
    for (const type of ['IN', 'OUT'] as const) await cash.manual(type, { reference: tag, amount: '1', movementDate: '2026-09-08', description: 'test' });
    await new StoreSettingsService().update({ storeName: 'Private sample', reportFooter: 'Private footer' });
    for (const action of ['EXPENSE_CREATE', 'EXPENSE_UPDATE', 'CASH_MANUAL_IN_CREATE', 'CASH_MANUAL_OUT_CREATE', 'STORE_SETTINGS_UPDATE']) expect(await events(action)).toHaveLength(1);
    expect((await events('STORE_SETTINGS_UPDATE'))[0].metadataJson).toEqual({ changedFields: ['reportFooter', 'storeName'] }); expect(JSON.stringify(await events())).not.toContain('Private footer');
  }));
  it('audits order confirmation/cancellation/conversion once; public creation and repeated conversion are quiet', async () => scope(async () => {
    const first = await orders.create({ deliveryAddress: '12 rue des Plantes', customerName: `${tag} عميل`, customerPhone: '22111222', items: [{ productId, quantity: '1' }] });
    const second = await orders.create({ deliveryAddress: '12 rue des Plantes', customerName: `${tag} عميل`, customerPhone: '22111222', items: [{ productId, quantity: '1' }] });
    const ids = (await db.query<{ id: number; reference: string }>('SELECT id, reference FROM public."onlineOrder" WHERE "customerName" = $1 ORDER BY id', [`${tag} عميل`])).rows;
    expect(first).toBeTruthy(); expect(second).toBeTruthy();
    await orders.status(ids[0].id, { status: 'CONFIRMED' }); await orders.status(ids[1].id, { status: 'CANCELLED' });
    // Fixture reference lets cleanup own the generated WEB sale as well.
    await db.query('UPDATE public."onlineOrder" SET reference = $1 WHERE id = $2', [`${tag}-ORDER`, ids[0].id]);
    const fulfillment = new OrderFulfillmentService(sales); await fulfillment.convert(ids[0].id); await fulfillment.convert(ids[0].id);
    for (const action of ['ONLINE_ORDER_CONFIRM', 'ONLINE_ORDER_CANCEL', 'ONLINE_ORDER_CONVERT_TO_SALE']) expect(await events(action)).toHaveLength(1);
    expect(await events('SALE_CREATE')).toHaveLength(1);
  }));
  it('rolls back business writes if audit insert fails, and emits no success for rejected operations', async () => scope(async () => {
    const count = (await events()).length;
    await expect(stock.create({ productId, type: 'EXIT', quantity: '999999', unit: 'KG' })).rejects.toThrow(); expect((await events()).length).toBe(count);
    const previous = await products.findOne(productId), fail = vi.spyOn(AuditService, 'record').mockRejectedValueOnce(new Error('Audit unavailable'));
    await expect(products.update(productId, { name: 'Must rollback' })).rejects.toThrow('Audit unavailable'); fail.mockRestore(); expect(await products.findOne(productId)).toEqual(previous); expect((await events()).length).toBe(count);
    const draft = await sales.create({ reference: `${tag}-ROLLBACK`, saleDate: '2026-09-08', lines: [{ productId, quantity: '1', unit: 'KG', unitSalePrice: '2' }] });
    const movements = await stock.stock(productId), failure = vi.spyOn(AuditService, 'record').mockRejectedValueOnce(new Error('Audit unavailable'));
    await expect(sales.confirm(draft.id)).rejects.toThrow('Audit unavailable'); failure.mockRestore(); expect((await sales.findOne(draft.id)).status).toBe('DRAFT'); expect(await stock.stock(productId)).toEqual(movements); expect(await events('SALE_CONFIRM')).toHaveLength(1);
  }));
  it('enforces read-only ADMIN API and preserves audit records across forbidden writes', async () => {
    await request(app.getHttpServer()).get('/audit-events').expect(401);
    const rows = await events(), id = rows[0].id;
    await get(`/audit-events/${id}`).expect(200); await get('/audit-events/2147483647').expect(404);
    for (const method of ['patch', 'delete', 'post'] as const) await request(app.getHttpServer())[method](`/audit-events/${id}`).set('Cookie', cookies.ADMIN).set('Origin', origin).send({ action: 'ALTERED' }).expect(404);
    expect(await events()).toEqual(rows);
  });
  it('filters dates, actors, actions, entities, outcomes and search, caps pages and sorts newest first', async () => {
    const rows = await events(), first = rows[0]; await db.query('UPDATE public."auditEvent" SET "createdAt" = $1 WHERE id = $2', ['2026-01-01T23:30:00Z', first.id]);
    const byDate = await get('/audit-events?dateFrom=2026-01-02&dateTo=2026-01-02').expect(200); expect(byDate.body.data.map((r: AuditRow) => r.id)).toContain(first.id);
    const filtered = await get(`/audit-events?actorUserId=${actors.ADMIN.id}&action=SALE_CONFIRM&entityType=SALE&outcome=SUCCESS&search=${encodeURIComponent(tag)}`).expect(200); expect(filtered.body.data).toHaveLength(1); expect(filtered.body.data[0].entityId).toBe(saleId);
    const failure = await get('/audit-events?outcome=FAILURE').expect(200); expect(failure.body.data).toHaveLength(1);
    const page1 = await get('/audit-events?pageSize=2').expect(200), page2 = await get('/audit-events?pageSize=2&page=2').expect(200); expect(page1.body.data).toHaveLength(2); expect(page2.body.data).toHaveLength(2); expect(page1.body.data[1].id).not.toBe(page2.body.data[0].id);
    expect(new Date(page1.body.data[0].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(page1.body.data[1].createdAt).getTime());
    expect((await get('/audit-events?pageSize=1000').expect(200)).body.pagination.pageSize).toBe(100);
    await get('/audit-events?dateFrom=2026-02-30').expect(400); await get('/audit-events?actorUserId=bad').expect(400);
    const serialized = JSON.stringify((await get('/audit-events?pageSize=100').expect(200)).body); for (const secret of [password, cookies.ADMIN, 'passwordHash', 'tokenHash', 'Private footer']) expect(serialized).not.toContain(secret);
  });
});
