import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { SalesController } from '../src/sales/sales.controller.js';
import { SalesService } from '../src/sales/sales.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Sale payments HTTP (disposable fixtures)', () => {
  const token = `TEST-PAY-${crypto.randomUUID()}`;
  let app: INestApplication<App>, productId: number;
  let sequence = 0;
  function idFrom(value: unknown): number { if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing ID'); return value.id; }
  const get = async (id: number) => (await request(app.getHttpServer()).get(`/sales/${id}`).expect(200)).body as unknown;
  const pay = (id: number, body: Record<string, unknown>) => request(app.getHttpServer()).post(`/sales/${id}/payments`).send({ paymentMethod: 'CASH', paymentDate: '2026-09-06', ...body });
  async function sale(confirmed = true, quantity = '1', unitSalePrice = '100') {
    const created = await request(app.getHttpServer()).post('/sales').send({ reference: `${token}-${++sequence}`, saleDate: '2026-09-06', lines: [{ productId, quantity, unit: 'KG', unitSalePrice }] }).expect(201);
    const id = idFrom(created.body);
    if (confirmed) await request(app.getHttpServer()).post(`/sales/${id}/confirm`).expect(201);
    return id;
  }
  beforeAll(async () => {
    const fixture = await db.transaction(async (tx) => {
      const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: token, name: 'منتج اختبار الدفع', productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
      await tx.orm.public.StockMovement.create({ productId: product.id, type: 'ENTRY', quantity: '100', unit: 'KG', quantityInStorageUnit: '100', reference: token });
      return { productId: product.id };
    });
    productId = fixture.productId;
    Reflect.defineMetadata('design:paramtypes', [SalesService], SalesController);
    const module = await Test.createTestingModule({ controllers: [SalesController], providers: [SalesService] }).compile();
    app = module.createNestApplication(); await app.init();
  }, 20000);
  afterAll(async () => {
    await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const ownedIds = (await client.query<{ id: number }>('SELECT id FROM public.sale WHERE reference LIKE $1', [`${token}-%`])).rows.map((row) => row.id);
      await client.query('DELETE FROM public."cashMovement" WHERE "salePaymentId" IN (SELECT id FROM public."salePayment" WHERE "saleId" = ANY($1::int[]))', [ownedIds]);
      await client.query('DELETE FROM public."salePayment" WHERE "saleId" = ANY($1::int[])', [ownedIds]);
      await client.query('DELETE FROM public."saleLine" WHERE "saleId" = ANY($1::int[])', [ownedIds]);
      await client.query('DELETE FROM public.sale WHERE id = ANY($1::int[])', [ownedIds]);
      const products = await client.query<{ id: number }>('SELECT id FROM public.product WHERE sku = $1', [token]);
      if (products.rows.length) {
        const ownedId = products.rows[0].id;
        await client.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [ownedId]);
        await client.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [ownedId, token]);
      }
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.sale WHERE reference LIKE $1', [`${token}-%`])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.product WHERE sku = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  }, 20000);
  it('rejects draft/cancelled payments and missing sales', async () => {
    const id = await sale(false);
    expect(await get(id)).toMatchObject({ paymentStatus: 'NON_PAID', totalPaid: '0.000', remainingAmount: '100.000', payments: [] });
    await pay(id, { amount: '1' }).expect(409);
    await db.orm.public.Sale.where({ id }).update({ status: 'CANCELLED' });
    await pay(id, { amount: '1' }).expect(409);
    await pay(2147483647, { amount: '1' }).expect(404);
    await request(app.getHttpServer()).get('/sales/2147483647/payments').expect(404);
    expect((await request(app.getHttpServer()).get(`/sales/${id}/payments`).expect(200)).body).toEqual([]);
  });
  it('records partial/final payments and history without changing stock, lines or sale', async () => {
    const id = await sale();
    const originalSale = await db.orm.public.Sale.first({ id });
    const originalLines = await db.orm.public.SaleLine.where({ saleId: id }).all();
    const originalStock = await db.orm.public.StockMovement.where({ productId }).all();
    const first = await pay(id, { amount: '40', reference: 'مرجع الدفع', notes: 'دفعة أولى', paymentDate: '2026-09-05' }).expect(201);
    expect(first.body).toMatchObject({ amount: '40.000', reference: 'مرجع الدفع', notes: 'دفعة أولى', saleId: id });
    expect(await get(id)).toMatchObject({ totalAmount: '100.000', totalPaid: '40.000', remainingAmount: '60.000', paymentStatus: 'PARTIALLY_PAID' });
    await pay(id, { amount: '61' }).expect(409);
    const second = await pay(id, { amount: '60', paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-09-06' }).expect(201);
    expect(await get(id)).toMatchObject({ totalAmount: '100.000', totalPaid: '100.000', remainingAmount: '0.000', paymentStatus: 'PAID' });
    await pay(id, { amount: '0.001' }).expect(409);
    expect((await request(app.getHttpServer()).get(`/sales/${id}/payments`).expect(200)).body).toEqual([second.body, first.body]);
    expect(await db.orm.public.Sale.first({ id })).toEqual(originalSale);
    expect(await db.orm.public.SaleLine.where({ saleId: id }).all()).toEqual(originalLines);
    expect(await db.orm.public.StockMovement.where({ productId }).all()).toEqual(originalStock);
    expect((await request(app.getHttpServer()).get('/sales').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ id, paymentStatus: 'PAID', totalPaid: '100.000' })]));
  });
  it('rejects invalid amounts, methods and dates without writing payments', async () => {
    const id = await sale();
    for (const amount of ['0', '-1', 'NaN', '1e2', 10]) await pay(id, { amount }).expect(400);
    await pay(id, { amount: '1', paymentMethod: 'INVALID' }).expect(400);
    await pay(id, { amount: '1', paymentDate: '2026-02-30' }).expect(400);
    await pay(id, { amount: '1', totalPaid: '999' }).expect(400);
    expect((await request(app.getHttpServer()).get(`/sales/${id}/payments`).expect(200)).body).toEqual([]);
  });
  it('serializes concurrent 80 payments against 100 remaining', async () => {
    const id = await sale();
    const results = await Promise.all([pay(id, { amount: '80', paymentMethod: 'CARD' }), pay(id, { amount: '80', paymentMethod: 'CHECK' })]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await get(id)).toMatchObject({ totalPaid: '80.000', remainingAmount: '20.000', paymentStatus: 'PARTIALLY_PAID' });
    expect(await db.orm.public.SalePayment.where({ saleId: id }).all()).toHaveLength(1);
  });
  it('settles 0.1 + 0.2 exactly and supports the full precision of sale totals', async () => {
    const id = await sale(true, '3', '0.1');
    await pay(id, { amount: '0.1', paymentMethod: 'OTHER' }).expect(201);
    expect(await get(id)).toMatchObject({ totalPaid: '0.100', remainingAmount: '0.200' });
    await pay(id, { amount: '0.2' }).expect(201);
    expect(await get(id)).toMatchObject({ totalAmount: '0.300', totalPaid: '0.300', remainingAmount: '0.000', paymentStatus: 'PAID' });
    const tinyId = await sale(true, '0.000000000000000001', '0.000000000000000001');
    const tiny = `0.${'0'.repeat(35)}1`;
    await pay(tinyId, { amount: tiny }).expect(201);
    expect(await get(tinyId)).toMatchObject({ totalAmount: tiny, totalPaid: tiny, remainingAmount: '0.000', paymentStatus: 'PAID' });
  });
});
