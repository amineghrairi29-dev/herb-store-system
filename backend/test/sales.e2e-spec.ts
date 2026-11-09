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
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';
import { aggregateStock, decimalString } from '../src/stock-movements/stock-decimal.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Sales HTTP (disposable inventory)', () => {
  const token = `TEST-SALE-${crypto.randomUUID()}`;
  let app: INestApplication<App>, ids: number[] = [];
  let sequence = 0;
  function idFrom(value: unknown): number { if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing sale ID'); return value.id; }
  const line = (productId = ids[0], quantity = '2', unit = 'KG') => ({ productId, quantity, unit, unitSalePrice: '30' });
  const create = (changes: Record<string, unknown> = {}) => request(app.getHttpServer()).post('/sales').send({ reference: `${token}-${++sequence}`, saleDate: '2026-09-06', lines: [line()], ...changes });
  const get = async (id: number) => (await request(app.getHttpServer()).get(`/sales/${id}`).expect(200)).body as unknown;
  const confirm = (id: number) => request(app.getHttpServer()).post(`/sales/${id}/confirm`);
  const stock = async (id: number) => decimalString(aggregateStock(await db.orm.public.StockMovement.where({ productId: id }).all()));
  beforeAll(async () => {
    ids = await db.transaction(async (tx) => {
      const result: number[] = [];
      for (const suffix of ['A', 'B', 'C']) {
        const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: `${token}-${suffix}`, name: `نعناع ${suffix}`, productType: 'VRAC', salePrice: '0.030', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
        result.push(product.id);
      }
      return result;
    });
    const movements = new StockMovementsService();
    for (const [index, quantity] of ['10', '1', '5'].entries()) await movements.create({ productId: ids[index], type: 'ENTRY', quantity, unit: 'KG', reference: token });
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
      await client.query('DELETE FROM public."saleLine" WHERE "saleId" = ANY($1::int[])', [ownedIds]);
      await client.query('DELETE FROM public.sale WHERE id = ANY($1::int[])', [ownedIds]);
      const skus = ['A', 'B', 'C'].map((suffix) => `${token}-${suffix}`);
      const productIds = (await client.query<{ id: number }>('SELECT id FROM public.product WHERE sku = ANY($1::text[])', [skus])).rows.map((row) => row.id);
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" = ANY($1::int[])', [productIds]);
      await client.query('DELETE FROM public.product WHERE id = ANY($1::int[]) AND sku = ANY($2::text[])', [productIds, skus]);
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.sale WHERE reference LIKE $1', [`${token}-%`])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.product WHERE sku = ANY($1::text[])', [skus])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  }, 20000);
  it('keeps drafts stock-neutral, supports optional customers and replaces lines on edit', async () => {
    const response = await create({ lines: [line(), line(ids[1], '500', 'G')], customerName: 'عميل', notes: 'بيع تجريبي' }).expect(201), id = idFrom(response.body);
    expect(response.body).toMatchObject({ status: 'DRAFT', confirmedAt: null, customerName: 'عميل', customerPhone: null });
    expect(await stock(ids[0])).toBe('10.000'); expect(await stock(ids[1])).toBe('1.000');
    const result = await request(app.getHttpServer()).patch(`/sales/${id}`).send({ lines: [{ ...line(ids[0], '500', 'G'), unitSalePrice: '0.030' }], customerName: null }).expect(200);
    expect(result.body).toMatchObject({ totalAmount: '15.000', customerName: null });
    expect(await db.orm.public.SaleLine.where({ saleId: id }).all()).toHaveLength(1);
    expect(await get(id)).toMatchObject({ totalAmount: '15.000' });
    expect((await request(app.getHttpServer()).get('/sales').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
    expect(await stock(ids[0])).toBe('10.000');
  });
  it('rejects invalid/missing products, inactive/non-sellable products, duplicates and client totals', async () => {
    await create({ lines: [line(2147483647)] }).expect(404);
    await create({ lines: [line(ids[0], '1', 'L')] }).expect(400);
    await create({ lines: [line(), line()] }).expect(400);
    await create({ totalAmount: '1' }).expect(400);
    await create({ lines: [] }).expect(400);
    for (const field of ['isActive', 'isSellable']) {
      await db.orm.public.Product.where({ id: ids[0] }).update({ [field]: false });
      await create().expect(409);
      await db.orm.public.Product.where({ id: ids[0] }).update({ [field]: true });
    }
    const reference = `${token}-duplicate`; await create({ reference }).expect(201); await create({ reference }).expect(409);
    const another = await create().expect(201);
    await request(app.getHttpServer()).patch(`/sales/${idFrom(another.body)}`).send({ reference }).expect(409);
    await request(app.getHttpServer()).get('/sales/2147483647').expect(404);
    await confirm(2147483647).expect(404);
  });
  it('rolls back the first EXIT when the second product has insufficient stock', async () => {
    const response = await create({ lines: [line(ids[0], '2'), line(ids[1], '2')] }).expect(201), id = idFrom(response.body);
    const before = await db.orm.public.StockMovement.where({ productId: ids[0] }).all();
    const failed = await confirm(id).expect(409);
    expect(failed.body).toMatchObject({ message: expect.stringContaining('Stock insuffisant') });
    expect(await stock(ids[0])).toBe('10.000'); expect(await stock(ids[1])).toBe('1.000');
    expect(await db.orm.public.StockMovement.where({ productId: ids[0] }).all()).toEqual(before);
    expect(await get(id)).toMatchObject({ status: 'DRAFT', confirmedAt: null });
  });
  it('revalidates sellability at confirmation', async () => {
    const response = await create().expect(201), id = idFrom(response.body);
    await db.orm.public.Product.where({ id: ids[0] }).update({ isSellable: false });
    await confirm(id).expect(409);
    expect(await get(id)).toMatchObject({ status: 'DRAFT' });
    expect(await stock(ids[0])).toBe('10.000');
    await db.orm.public.Product.where({ id: ids[0] }).update({ isSellable: true });
  });
  it('confirms multiple lines once, creates traceable EXITs, and prevents confirmed editing', async () => {
    const response = await create({ lines: [line(ids[0], '2'), { ...line(ids[1], '500', 'G'), unitSalePrice: '0.030' }] }).expect(201), id = idFrom(response.body);
    const reference = (await db.orm.public.Sale.first({ id }))!.reference;
    const results = await Promise.all([confirm(id), confirm(id)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await stock(ids[0])).toBe('8.000'); expect(await stock(ids[1])).toBe('0.500');
    expect(await get(id)).toMatchObject({ status: 'CONFIRMED', confirmedAt: expect.any(String), totalAmount: '75.000' });
    const exits = await db.orm.public.StockMovement.where({ reference }).all();
    expect(exits).toHaveLength(2);
    expect(exits).toEqual(expect.arrayContaining([
      expect.objectContaining({ productId: ids[0], type: 'EXIT', quantity: '2.000', unit: 'KG', quantityInStorageUnit: '2.000', reason: 'Vente' }),
      expect.objectContaining({ productId: ids[1], type: 'EXIT', quantity: '500.000', unit: 'G', quantityInStorageUnit: '0.500', reason: 'Vente' }),
    ]));
    await confirm(id).expect(409);
    await request(app.getHttpServer()).patch(`/sales/${id}`).send({ notes: 'Forbidden' }).expect(409);
    expect(await db.orm.public.StockMovement.where({ reference }).all()).toHaveLength(2);
  });
  it('prevents two different sales from overselling the same product', async () => {
    const a = idFrom((await create({ lines: [line(ids[2], '4')] }).expect(201)).body);
    const b = idFrom((await create({ lines: [line(ids[2], '4')] }).expect(201)).body);
    const results = await Promise.all([confirm(a), confirm(b)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await stock(ids[2])).toBe('1.000');
    expect(await get(results[0].status === 409 ? a : b)).toMatchObject({ status: 'DRAFT', confirmedAt: null });
    expect((await db.orm.public.StockMovement.where({ productId: ids[2] }).all()).filter((movement) => movement.type === 'EXIT')).toHaveLength(1);
  });
});
