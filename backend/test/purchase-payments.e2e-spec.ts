import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { PurchasesController } from '../src/purchases/purchases.controller.js';
import { PurchasesService } from '../src/purchases/purchases.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Purchase payments HTTP (disposable fixtures)', () => {
  const token = `TEST-PAY-${crypto.randomUUID()}`;
  let app: INestApplication<App>, supplierId: number, productId: number;
  let sequence = 0;
  function idFrom(value: unknown): number { if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing ID'); return value.id; }
  const get = async (id: number) => (await request(app.getHttpServer()).get(`/purchases/${id}`).expect(200)).body as unknown;
  const pay = (id: number, body: Record<string, unknown>) => request(app.getHttpServer()).post(`/purchases/${id}/payments`).send({ paymentMethod: 'CASH', paymentDate: '2026-09-06', ...body });
  async function purchase(confirmed = true, quantity = '1', unitPurchasePrice = '100') {
    const created = await request(app.getHttpServer()).post('/purchases').send({ reference: `${token}-${++sequence}`, supplierId, purchaseDate: '2026-09-06', lines: [{ productId, quantity, unit: 'KG', unitPurchasePrice }] }).expect(201);
    const id = idFrom(created.body);
    if (confirmed) await request(app.getHttpServer()).post(`/purchases/${id}/confirm`).expect(201);
    return id;
  }
  beforeAll(async () => {
    const fixture = await db.transaction(async (tx) => {
      const supplier = await tx.orm.public.Supplier.create({ code: token, name: 'مورد اختبار الدفع' });
      const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: token, name: 'منتج اختبار الدفع', productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
      return { supplierId: supplier.id, productId: product.id };
    });
    supplierId = fixture.supplierId; productId = fixture.productId;
    Reflect.defineMetadata('design:paramtypes', [PurchasesService], PurchasesController);
    const module = await Test.createTestingModule({ controllers: [PurchasesController], providers: [PurchasesService] }).compile();
    app = module.createNestApplication(); await app.init();
  }, 20000);
  afterAll(async () => {
    await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const suppliers = await client.query<{ id: number }>('SELECT id FROM public.supplier WHERE code = $1', [token]);
      if (suppliers.rows.length) {
        const ownedId = suppliers.rows[0].id;
        const ids = (await client.query<{ id: number }>('SELECT id FROM public.purchase WHERE "supplierId" = $1 AND reference LIKE $2', [ownedId, `${token}-%`])).rows.map((row) => row.id);
        await client.query('DELETE FROM public."cashMovement" WHERE "purchasePaymentId" IN (SELECT id FROM public."purchasePayment" WHERE "purchaseId" = ANY($1::int[]))', [ids]);
        await client.query('DELETE FROM public."purchasePayment" WHERE "purchaseId" = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM public."purchaseLine" WHERE "purchaseId" = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM public.purchase WHERE id = ANY($1::int[])', [ids]);
        await client.query('DELETE FROM public.supplier WHERE id = $1 AND code = $2', [ownedId, token]);
      }
      const products = await client.query<{ id: number }>('SELECT id FROM public.product WHERE sku = $1', [token]);
      if (products.rows.length) {
        const ownedId = products.rows[0].id;
        await client.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [ownedId]);
        await client.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [ownedId, token]);
      }
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.purchase WHERE reference LIKE $1', [`${token}-%`])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.supplier WHERE code = $1', [token])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.product WHERE sku = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  }, 20000);
  it('rejects draft/cancelled payments and missing purchases', async () => {
    const id = await purchase(false);
    expect(await get(id)).toMatchObject({ paymentStatus: 'NON_PAID', totalPaid: '0.000', remainingAmount: '100.000', payments: [] });
    await pay(id, { amount: '1' }).expect(409);
    await db.orm.public.Purchase.where({ id }).update({ status: 'CANCELLED' });
    await pay(id, { amount: '1' }).expect(409);
    await pay(2147483647, { amount: '1' }).expect(404);
    await request(app.getHttpServer()).get('/purchases/2147483647/payments').expect(404);
    expect((await request(app.getHttpServer()).get(`/purchases/${id}/payments`).expect(200)).body).toEqual([]);
  });
  it('records partial/final payments and history without changing stock, lines or purchase', async () => {
    const id = await purchase();
    const originalPurchase = await db.orm.public.Purchase.first({ id });
    const originalLines = await db.orm.public.PurchaseLine.where({ purchaseId: id }).all();
    const originalStock = await db.orm.public.StockMovement.where({ productId }).all();
    const first = await pay(id, { amount: '40', reference: 'مرجع الدفع', notes: 'دفعة أولى', paymentDate: '2026-09-05' }).expect(201);
    expect(first.body).toMatchObject({ amount: '40.000', reference: 'مرجع الدفع', notes: 'دفعة أولى', purchaseId: id });
    expect(await get(id)).toMatchObject({ totalAmount: '100.000', totalPaid: '40.000', remainingAmount: '60.000', paymentStatus: 'PARTIALLY_PAID' });
    await pay(id, { amount: '61' }).expect(409);
    const second = await pay(id, { amount: '60', paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-09-06' }).expect(201);
    expect(await get(id)).toMatchObject({ totalAmount: '100.000', totalPaid: '100.000', remainingAmount: '0.000', paymentStatus: 'PAID' });
    await pay(id, { amount: '0.001' }).expect(409);
    expect((await request(app.getHttpServer()).get(`/purchases/${id}/payments`).expect(200)).body).toEqual([second.body, first.body]);
    expect(await db.orm.public.Purchase.first({ id })).toEqual(originalPurchase);
    expect(await db.orm.public.PurchaseLine.where({ purchaseId: id }).all()).toEqual(originalLines);
    expect(await db.orm.public.StockMovement.where({ productId }).all()).toEqual(originalStock);
    expect((await request(app.getHttpServer()).get('/purchases').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ id, paymentStatus: 'PAID', totalPaid: '100.000' })]));
  });
  it('rejects invalid amounts, methods and dates without writing payments', async () => {
    const id = await purchase();
    for (const amount of ['0', '-1', 'NaN', '1e2', 10]) await pay(id, { amount }).expect(400);
    await pay(id, { amount: '1', paymentMethod: 'INVALID' }).expect(400);
    await pay(id, { amount: '1', paymentDate: '2026-02-30' }).expect(400);
    await pay(id, { amount: '1', totalPaid: '999' }).expect(400);
    expect((await request(app.getHttpServer()).get(`/purchases/${id}/payments`).expect(200)).body).toEqual([]);
  });
  it('serializes concurrent 80 payments against 100 remaining', async () => {
    const id = await purchase();
    const results = await Promise.all([pay(id, { amount: '80', paymentMethod: 'CARD' }), pay(id, { amount: '80', paymentMethod: 'CHECK' })]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await get(id)).toMatchObject({ totalPaid: '80.000', remainingAmount: '20.000', paymentStatus: 'PARTIALLY_PAID' });
    expect(await db.orm.public.PurchasePayment.where({ purchaseId: id }).all()).toHaveLength(1);
  });
  it('settles 0.1 + 0.2 exactly and supports the full precision of purchase totals', async () => {
    const id = await purchase(true, '3', '0.1');
    await pay(id, { amount: '0.1', paymentMethod: 'OTHER' }).expect(201);
    expect(await get(id)).toMatchObject({ totalPaid: '0.100', remainingAmount: '0.200' });
    await pay(id, { amount: '0.2' }).expect(201);
    expect(await get(id)).toMatchObject({ totalAmount: '0.300', totalPaid: '0.300', remainingAmount: '0.000', paymentStatus: 'PAID' });
    const tinyId = await purchase(true, '0.000000000000000001', '0.000000000000000001');
    const tiny = `0.${'0'.repeat(35)}1`;
    await pay(tinyId, { amount: tiny }).expect(201);
    expect(await get(tinyId)).toMatchObject({ totalAmount: tiny, totalPaid: tiny, remainingAmount: '0.000', paymentStatus: 'PAID' });
  });
});
