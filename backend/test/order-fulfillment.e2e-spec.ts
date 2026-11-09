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
import { OrderFulfillmentController } from '../src/online-orders/order-fulfillment.controller.js';
import { OrderFulfillmentService } from '../src/online-orders/order-fulfillment.service.js';
import { SalesService } from '../src/sales/sales.service.js';
import { SalesController } from '../src/sales/sales.controller.js';
import { aggregateStock, decimalString } from '../src/stock-movements/stock-decimal.js';
import { moneyUnits } from '../src/purchases/purchase-validation.js';
import * as transactions from '../src/purchases/purchase-transaction.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('OnlineOrder -> Sale lifecycle (disposable stock only)', () => {
  const token = `TEST-FULFILL-${crypto.randomUUID()}`, name = `${token} عميل`; let next = 0;
  let app: INestApplication<App>, before: unknown;
  type Converted = Awaited<ReturnType<OrderFulfillmentService['convert']>>;
  const snapshot = () => Promise.all([db.orm.public.Product.orderBy((r) => r.id.asc()).all(), db.orm.public.StockMovement.orderBy((r) => r.id.asc()).all(), db.orm.public.Sale.orderBy((r) => r.id.asc()).all(), db.orm.public.SaleLine.orderBy((r) => r.id.asc()).all(), db.orm.public.SalePayment.all(), db.orm.public.CashMovement.all(), db.orm.public.OnlineOrder.orderBy((r) => r.id.asc()).all(), db.orm.public.OnlineOrderLine.orderBy((r) => r.id.asc()).all()]);
  const stock = async (productId: number) => decimalString(aggregateStock(await db.orm.public.StockMovement.where({ productId }).all()));
  const transition = (id: number, status: string) => request(app.getHttpServer()).patch(`/online-orders/${id}/status`).send({ status });
  const convert = (id: number) => request(app.getHttpServer()).post(`/online-orders/${id}/convert-to-sale`);
  const sale = async (id: number) => (await request(app.getHttpServer()).get(`/sales/${id}`).expect(200)).body as Awaited<ReturnType<SalesService['findOne']>>;
  async function scenario(quantity = '2', price = '0.1', unit = 'KG') {
    const product = await db.orm.public.Product.create({ categoryId: classification.id, sku: `${token}-${++next}`, name: 'نعناع', category: token, productType: 'VRAC', salePrice: price, storageUnit: 'KG', saleUnit: unit, conversionFactor: unit === 'G' ? '1000' : '1', isVisibleOnline: true }); await db.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
    await db.orm.public.StockMovement.create({ productId: product.id, type: 'ENTRY', quantity: '10', unit: 'KG', quantityInStorageUnit: '10' });
    const created = (await request(app.getHttpServer()).post('/public/orders').send({ deliveryAddress: '12 rue des Plantes', customerName: name, customerPhone: '20123456', notes: token, items: [{ productId: product.id, quantity }] }).expect(201)).body as Awaited<ReturnType<OnlineOrdersService['create']>>;
    const order = (await db.orm.public.OnlineOrder.first({ reference: created.reference }))!;
    return { product, order };
  }
  beforeAll(async () => {
    for (const controller of [OnlineOrdersController, PublicOrdersController]) Reflect.defineMetadata('design:paramtypes', [OnlineOrdersService], controller);
    Reflect.defineMetadata('design:paramtypes', [OrderFulfillmentService], OrderFulfillmentController); Reflect.defineMetadata('design:paramtypes', [SalesService], OrderFulfillmentService); Reflect.defineMetadata('design:paramtypes', [SalesService], SalesController);
    const module = await Test.createTestingModule({ controllers: [OnlineOrdersController, PublicOrdersController, OrderFulfillmentController, SalesController], providers: [OnlineOrdersService, OrderFulfillmentService, SalesService] }).overrideGuard(CustomerGuard).useValue({ canActivate(context: ExecutionContext) { context.switchToHttp().getRequest().customer = { id: null }; return true; } }).compile(); app = module.createNestApplication(); app.useLogger(false); await app.init(); before = await snapshot();
  });
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close(); const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."onlineOrderLine" WHERE "orderId" IN (SELECT id FROM public."onlineOrder" WHERE "customerName" = $1)', [name]);
      await client.query('DELETE FROM public."onlineOrder" WHERE "customerName" = $1', [name]);
      await client.query('DELETE FROM public."saleLine" WHERE "saleId" IN (SELECT id FROM public.sale WHERE "customerName" = $1)', [name]);
      await client.query('DELETE FROM public.sale WHERE "customerName" = $1', [name]);
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1)', [token]);
      await client.query('DELETE FROM public.product WHERE category = $1', [token]); await client.query('COMMIT');
      expect(await snapshot()).toEqual(before);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  }, 20000);
  it('rejects pending and cancelled orders without creating sales', async () => {
    const { order } = await scenario(), previous = await db.orm.public.Sale.all();
    await convert(order.id).expect(409); await transition(order.id, 'CANCELLED').expect(200); await convert(order.id).expect(409);
    expect(await db.orm.public.Sale.all()).toEqual(previous);
  });
  it('keeps 10 stock through creation/confirmation/conversion, then deducts exactly 2 only at Sale confirmation', async () => {
    const { product, order } = await scenario(); expect(await stock(product.id)).toBe('10.000');
    await transition(order.id, 'CONFIRMED').expect(200); expect(await stock(product.id)).toBe('10.000');
    const payments = await db.orm.public.SalePayment.all(), cash = await db.orm.public.CashMovement.all();
    const converted = (await convert(order.id).expect(200)).body as Converted;
    expect(converted.saleStatus).toBe('DRAFT'); expect(await stock(product.id)).toBe('10.000');
    expect((await db.orm.public.StockMovement.where({ productId: product.id }).all())).toHaveLength(1);
    const draft = await sale(converted.saleId); expect(draft.onlineOrder).toEqual({ id: order.id, reference: order.reference });
    expect(moneyUnits(draft.totalAmount)).toBe(moneyUnits(order.totalAmount));
    expect((await convert(order.id).expect(200)).body).toEqual(converted);
    await request(app.getHttpServer()).post(`/sales/${converted.saleId}/confirm`).expect(201);
    expect(await stock(product.id)).toBe('8.000');
    const exits = (await db.orm.public.StockMovement.where({ productId: product.id }).all()).filter((m) => m.type === 'EXIT');
    expect(exits).toHaveLength(1); expect(exits[0].reference).toBe(converted.saleReference); expect(exits[0].reason).toBe('Vente');
    await request(app.getHttpServer()).post(`/sales/${converted.saleId}/confirm`).expect(409);
    expect(await stock(product.id)).toBe('8.000'); expect((await convert(order.id).expect(200)).body as object).toMatchObject({ saleId: converted.saleId, saleStatus: 'CONFIRMED' });
    await transition(order.id, 'CANCELLED').expect(409);
    expect(await db.orm.public.SalePayment.all()).toEqual(payments); expect(await db.orm.public.CashMovement.all()).toEqual(cash);
  });
  it('uses historical decimal price/unit/quantity despite changed product price and online visibility', async () => {
    const { product, order } = await scenario('2.5', '0.100000000000000001', 'G');
    await transition(order.id, 'CONFIRMED').expect(200);
    await db.orm.public.Product.where({ id: product.id }).update({ salePrice: '999', isVisibleOnline: false });
    const converted = (await convert(order.id).expect(200)).body as Converted, draft = await sale(converted.saleId);
    expect(draft.lines[0]).toMatchObject({ productId: product.id, quantity: '2.500', unit: 'G', unitSalePrice: '0.100000000000000001', quantityInStorageUnit: '0.0025', lineTotal: '0.2500000000000000025' });
    expect(moneyUnits(draft.totalAmount)).toBe(moneyUnits(order.totalAmount)); expect(await stock(product.id)).toBe('10.000');
    const details = (await request(app.getHttpServer()).get(`/online-orders/${order.id}`).expect(200)).body as Awaited<ReturnType<OnlineOrdersService['detail']>>;
    expect(details).toMatchObject({ saleId: draft.id, status: 'CONFIRMED', fulfillmentStatus: 'CONVERTED', sale: { id: draft.id, reference: draft.reference, status: 'DRAFT' } });
    const original = await db.orm.public.OnlineOrderLine.where({ orderId: order.id }).all();
    await request(app.getHttpServer()).patch(`/sales/${draft.id}`).send({ lines: [{ productId: product.id, quantity: '1', unit: 'G', unitSalePrice: '5' }] }).expect(200);
    expect(await db.orm.public.OnlineOrderLine.where({ orderId: order.id }).all()).toEqual(original);
  });
  it('concurrent conversions create one Sale and return the same durable link', async () => {
    const { order } = await scenario(); await transition(order.id, 'CONFIRMED').expect(200);
    const beforeCount = (await db.orm.public.Sale.all()).length;
    const results = await Promise.all(Array.from({ length: 5 }, () => convert(order.id)));
    expect(results.every((row) => row.status === 200)).toBe(true); expect(new Set(results.map((row) => (row.body as Converted).saleId)).size).toBe(1);
    expect((await db.orm.public.Sale.all()).length).toBe(beforeCount + 1);
  });
  it('rolls back the draft, lines and link if anything fails after linking', async () => {
    const { order } = await scenario(); await transition(order.id, 'CONFIRMED').expect(200); const previous = await snapshot();
    const original = transactions.withPurchaseTransaction;
    const spy = vi.spyOn(transactions, 'withPurchaseTransaction').mockImplementationOnce((work, readOnly) => original(async (tx) => { await work(tx); throw new Error('Injected post-link failure'); }, readOnly));
    try { await convert(order.id).expect(500); } finally { spy.mockRestore(); }
    expect(await snapshot()).toEqual(previous);
  });
  it('allows a low-stock draft, but existing Sale confirmation rejects it atomically', async () => {
    const { product, order } = await scenario(); await transition(order.id, 'CONFIRMED').expect(200);
    const manual = (await request(app.getHttpServer()).post('/sales').send({ reference: `${token}-MANUAL`, saleDate: '2026-09-07', customerName: name, lines: [{ productId: product.id, quantity: '9', unit: 'KG', unitSalePrice: '0.1' }] }).expect(201)).body as Awaited<ReturnType<SalesService['create']>>;
    expect(manual.onlineOrder).toBeNull(); await request(app.getHttpServer()).post(`/sales/${manual.id}/confirm`).expect(201); expect(await stock(product.id)).toBe('1.000');
    const converted = (await convert(order.id).expect(200)).body as Converted; const movements = await db.orm.public.StockMovement.all();
    await request(app.getHttpServer()).post(`/sales/${converted.saleId}/confirm`).expect(409);
    expect((await sale(converted.saleId)).status).toBe('DRAFT'); expect(await stock(product.id)).toBe('1.000'); expect(await db.orm.public.StockMovement.all()).toEqual(movements);
    expect(await db.orm.public.OnlineOrder.first({ id: order.id })).toMatchObject({ status: 'CONFIRMED', saleId: converted.saleId });
  });
  it('rejects inactive or non-sellable products and unsupported historical precision safely', async () => {
    for (const change of [{ isActive: false }, { isSellable: false }]) {
      const { product, order } = await scenario(); await transition(order.id, 'CONFIRMED').expect(200); await db.orm.public.Product.where({ id: product.id }).update(change);
      const previous = await db.orm.public.Sale.all(); await convert(order.id).expect(409); expect(await db.orm.public.Sale.all()).toEqual(previous);
    }
    const { order } = await scenario('1', '0.1234567890123456789'); await transition(order.id, 'CONFIRMED').expect(200); await convert(order.id).expect(409);
    expect((await db.orm.public.OnlineOrder.first({ id: order.id }))?.saleId).toBeNull();
  });
  it('enforces link uniqueness/FK and exposes no Sale deletion endpoint', async () => {
    const first = await scenario(), second = await scenario(); await transition(first.order.id, 'CONFIRMED').expect(200); await transition(second.order.id, 'CONFIRMED').expect(200);
    const linked = (await convert(first.order.id).expect(200)).body as Converted;
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await expect(client.query('UPDATE public."onlineOrder" SET "saleId" = $1, "convertedAt" = now() WHERE id = $2', [linked.saleId, second.order.id])).rejects.toMatchObject({ code: '23505' });
      await expect(client.query('DELETE FROM public.sale WHERE id = $1', [linked.saleId])).rejects.toMatchObject({ code: '23001' });
    } finally { await client.end(); }
    await request(app.getHttpServer()).delete(`/sales/${linked.saleId}`).expect(404);
  });
});
