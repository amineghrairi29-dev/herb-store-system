import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import { CustomerGuard } from '../src/customer-auth/customer.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { OnlineOrdersService } from '../src/online-orders/online-orders.service.js';
import { OnlineOrdersController, PublicOrdersController } from '../src/online-orders/online-orders.controller.js';
import * as transactions from '../src/purchases/purchase-transaction.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Online orders (disposable fixtures)', () => {
  const token = `TEST-ORDER-${crypto.randomUUID()}`, name = `عميل ${token}`, ids: number[] = [];
  let app: INestApplication<App>, before: unknown;
  type Receipt = Awaited<ReturnType<OnlineOrdersService['create']>>;
  const business = () => Promise.all([db.orm.public.Product.orderBy((r) => r.id.asc()).all(), db.orm.public.StockMovement.orderBy((r) => r.id.asc()).all(), db.orm.public.Sale.all(), db.orm.public.SaleLine.all(), db.orm.public.SalePayment.all(), db.orm.public.CashMovement.all()]);
  const data = () => ({ deliveryAddress: '12 rue des Plantes', customerName: name, customerPhone: '20123456', customerEmail: 'test@example.com', notes: 'Private customer note', items: [{ productId: ids[0], quantity: '2.5' }] });
  const create = async () => (await request(app.getHttpServer()).post('/public/orders').send(data()).expect(201)).body as Receipt;
  const orderId = async (reference: string) => (await db.orm.public.OnlineOrder.first({ reference }))!.id;
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [OnlineOrdersService], OnlineOrdersController); Reflect.defineMetadata('design:paramtypes', [OnlineOrdersService], PublicOrdersController);
    const module = await Test.createTestingModule({ controllers: [OnlineOrdersController, PublicOrdersController], providers: [OnlineOrdersService] }).overrideGuard(CustomerGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest().customer = { id: null }; return true; } }).compile(); app = module.createNestApplication(); app.useLogger(false); await app.init();
    await db.transaction(async (tx) => {
      for (let i = 0; i < 6; i++) {
        const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: `${token}-${i}`, name: 'نعناع', productType: 'VRAC', salePrice: '0.100000000000000001', category: token, storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', isActive: i !== 1, isSellable: i !== 2, isVisibleOnline: i !== 3 }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId }); ids.push(product.id);
        if (i !== 4) await tx.orm.public.StockMovement.create({ productId: product.id, type: 'ENTRY', quantity: '10', unit: 'KG', quantityInStorageUnit: '10' });
      }
    }); before = await business();
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close(); const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName" = $1)', [name]);
      await client.query('DELETE FROM public."onlineOrder" WHERE "customerName" = $1', [name]);
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1)', [token]);
      await client.query('DELETE FROM public.product WHERE category = $1', [token]); await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public."onlineOrder" WHERE "customerName" = $1', [name])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  });
  it('creates a PENDING order with exact snapshots and immutable totals', async () => {
    const created = await create(); expect(created.status).toBe('PENDING'); expect(created.reference).toMatch(/^ORD-\d{6,}$/);
    expect(created.totalAmount).toBe('0.2500000000000000025'); expect(created.items[0]).toMatchObject({ productNameSnapshot: 'نعناع', unitSnapshot: 'KG', unitPrice: '0.100000000000000001', quantity: '2.500', lineTotal: '0.2500000000000000025' });
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('UPDATE public.product SET name = $2, "salePrice" = 0.2 WHERE id = $1', [ids[0], 'Changed']);
      expect((await create()).totalAmount).toBe('0.500');
      const historical = (await request(app.getHttpServer()).get(`/online-orders/${await orderId(created.reference)}`).expect(200)).body as Awaited<ReturnType<OnlineOrdersService['detail']>>;
      expect(historical.deliveryAddress).toBe('12 rue des Plantes'); expect(historical.totalAmount).toBe(created.totalAmount); expect(historical.items[0].productNameSnapshot).toBe('نعناع');
    } finally { await client.query('UPDATE public.product SET name = $2, "salePrice" = $3 WHERE id = $1', [ids[0], 'نعناع', '0.100000000000000001']); await client.end(); }
    await request(app.getHttpServer()).patch(`/online-orders/${await orderId(created.reference)}`).send({ totalAmount: '1' }).expect(404);
  });
  it('persists delivery information and uses the authenticated account email', async () => {
    const customer = await db.orm.public.Customer.create({ email: `${token.toLowerCase()}@test.local` });
    let id: number | undefined;
    try {
      const receipt = await app.get(OnlineOrdersService).create({ ...data(), customerEmail: 'different@example.com', deliveryAddress: '  12 rue des Plantes  ' }, customer.id);
      const order = (await db.orm.public.OnlineOrder.first({ reference: receipt.reference }))!;
      id = order.id;
      expect(order.deliveryAddress).toBe('12 rue des Plantes');
      expect(order.customerEmail).toBe(customer.email);
      expect(order.customerId).toBe(customer.id);
    } finally {
      if (id !== undefined) {
        await db.orm.public.OnlineOrderLine.where({ orderId: id }).delete();
        await db.orm.public.OnlineOrder.where({ id }).delete();
      }
      await db.orm.public.Customer.where({ id: customer.id }).delete();
    }
  });
  it('previews authoritative totals without creating orders', async () => {
    const previous = await db.orm.public.OnlineOrder.all();
    const response = await request(app.getHttpServer()).post('/public/orders/preview').send({ items: data().items }).expect(200);
    expect(response.body as object).toMatchObject({ totalAmount: '0.2500000000000000025', items: [expect.objectContaining({ lineTotal: '0.2500000000000000025' })] });
    expect(await db.orm.public.OnlineOrder.all()).toEqual(previous);
    await request(app.getHttpServer()).post('/public/orders/preview').send({ items: [] }).expect(400);
  });
  it('rejects every visibility exclusion, zero/excess stock and malformed orders atomically', async () => {
    const previous = await db.orm.public.OnlineOrder.all();
    for (const productId of ids.slice(1, 5)) await request(app.getHttpServer()).post('/public/orders').send({ ...data(), items: [{ productId: ids[0], quantity: '1' }, { productId, quantity: '1' }] }).expect(409);
    await request(app.getHttpServer()).post('/public/orders').send({ ...data(), items: [{ productId: ids[0], quantity: '11' }] }).expect(409);
    for (const patch of [{ customerPhone: '' }, { customerEmail: 'bad' }, { items: [{ productId: ids[0], quantity: '0' }] }, { items: [{ productId: ids[0], quantity: '1' }, { productId: ids[0], quantity: '1' }] }, { totalAmount: '0.01' }]) await request(app.getHttpServer()).post('/public/orders').send({ ...data(), ...patch }).expect(400);
    expect(await db.orm.public.OnlineOrder.all()).toEqual(previous);
  });
  it('rolls back an already inserted order and lines when transaction fails', async () => {
    const previous = await db.orm.public.OnlineOrder.all(), lines = await db.orm.public.OnlineOrderLine.all();
    const original = transactions.withPurchaseTransaction;
    const spy = vi.spyOn(transactions, 'withPurchaseTransaction').mockImplementationOnce((work, readOnly) => original(async (tx) => { await work(tx); throw new Error('Injected failure after line insertion'); }, readOnly));
    try { await request(app.getHttpServer()).post('/public/orders').send(data()).expect(500); } finally { spy.mockRestore(); }
    expect(await db.orm.public.OnlineOrder.all()).toEqual(previous); expect(await db.orm.public.OnlineOrderLine.all()).toEqual(lines);
  });
  it('uses unique sequence references under concurrency without reserving stock', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => request(app.getHttpServer()).post('/public/orders').send({ ...data(), items: [{ productId: ids[0], quantity: '10' }] })));
    expect(results.every((row) => row.status === 201)).toBe(true); expect(new Set(results.map((row) => (row.body as Receipt).reference)).size).toBe(5);
  });
  it('requires matching phone and exposes only public lookup fields', async () => {
    const created = await create(), server = app.getHttpServer();
    const missing = await request(server).get('/public/orders/ORD-99999999?phone=20123456').expect(404);
    for (const suffix of ['', '?phone=99999999', '?phone=20123456&phone=20123456']) expect((await request(server).get(`/public/orders/${created.reference}${suffix}`).expect(404)).body).toEqual(missing.body);
    const lookup = await request(server).get(`/public/orders/${created.reference}?phone=20123456`).expect(200);
    const value = lookup.body as Awaited<ReturnType<OnlineOrdersService['lookup']>>;
    expect(Object.keys(value).sort()).toEqual(['reference', 'status', 'totalAmount', 'createdAt', 'items'].sort());
    expect(Object.keys(value.items[0]).sort()).toEqual(['productNameSnapshot', 'unitSnapshot', 'quantity', 'unitPrice', 'lineTotal'].sort());
    expect(lookup.headers['cache-control']).toBe('no-store');
  });
  it.each(['CONFIRMED', 'CANCELLED'])('allows only PENDING -> %s and preserves all other commercial fields', async (status) => {
    const created = await create(), id = await orderId(created.reference), previous = await db.orm.public.OnlineOrder.first({ id }), lines = await db.orm.public.OnlineOrderLine.where({ orderId: id }).all();
    const response = await request(app.getHttpServer()).patch(`/online-orders/${id}/status`).send({ status }).expect(200);
    expect(response.body as object).toMatchObject({ ...previous, status, updatedAt: expect.any(String), ...(status === 'CONFIRMED' ? { confirmedAt: expect.any(String) } : { cancelledAt: expect.any(String) }) });
    expect(await db.orm.public.OnlineOrderLine.where({ orderId: id }).all()).toEqual(lines);
    for (const next of ['CONFIRMED', 'CANCELLED']) await request(app.getHttpServer()).patch(`/online-orders/${id}/status`).send({ status: next }).expect(409);
    await request(app.getHttpServer()).patch(`/online-orders/${id}/status`).send({ status: 'PENDING' }).expect(400);
  });
  it('serializes competing status transitions', async () => {
    const id = await orderId((await create()).reference);
    const results = await Promise.all(['CONFIRMED', 'CANCELLED'].map((status) => request(app.getHttpServer()).patch(`/online-orders/${id}/status`).send({ status })));
    expect(results.map((row) => row.status).sort()).toEqual([200, 409]);
  });
  it('filters admin results and sorts newest first', async () => {
    const response = await request(app.getHttpServer()).get('/online-orders').query({ q: token, status: 'CONFIRMED' }).expect(200);
    const result = response.body as Awaited<ReturnType<OnlineOrdersService['list']>>;
    expect(result.data.length).toBeGreaterThan(0); expect(result.data.every((row) => row.status === 'CONFIRMED')).toBe(true);
    expect(result.data.map((row) => row.id)).toEqual(result.data.map((row) => row.id).sort((a, b) => b - a));
    await request(app.getHttpServer()).get('/online-orders?dateFrom=2026-02-30').expect(400);
    await request(app.getHttpServer()).get('/online-orders?dateFrom=0000-01-01').expect(400);
    await request(app.getHttpServer()).get('/online-orders?status=bad').expect(400);
  });
  it('creation and status changes never alter products, stock, sales or cash', async () => { expect(await business()).toEqual(before); });
});
