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
import { ProductStockController, StockMovementsController } from '../src/stock-movements/stock-movements.controller.js';
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';

// Separate committed fixture rows are necessary to exercise genuine concurrent
// connections. Every fixture is owned by this UUID and removed transactionally.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Purchase HTTP integration with disposable fixtures', () => {
  const token = `TEST-PUR-${crypto.randomUUID()}`;
  let app: INestApplication<App>;
  let supplierId: number;
  let productIds: number[] = [];
  let sequence = 0;
  const reference = () => `${token}-${++sequence}`;
  const lines = () => [{ productId: productIds[0], quantity: '2', unit: 'KG', unitPurchasePrice: '18' }, { productId: productIds[1], quantity: '500', unit: 'G', unitPurchasePrice: '0.020' }];
  const create = (changes: Record<string, unknown> = {}) => request(app.getHttpServer()).post('/purchases').send({ reference: reference(), supplierId, purchaseDate: '2026-09-06', notes: 'شراء تجريبي', lines: lines(), ...changes });
  function idFrom(value: unknown): number { if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing purchase ID'); return value.id; }
  const stock = async (id: number) => (await request(app.getHttpServer()).get(`/products/${id}/stock`).expect(200)).body as unknown;
  beforeAll(async () => {
    const fixtures = await db.transaction(async (tx) => {
      const supplier = await tx.orm.public.Supplier.create({ code: token, name: 'مورد الاختبار', contactName: 'أحمد' });
      const ids: number[] = [];
      for (const suffix of ['A', 'B']) {
        const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: `${token}-${suffix}`, name: `نعناع ${suffix}`, productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
        ids.push(product.id);
      }
      return { supplierId: supplier.id, ids };
    });
    supplierId = fixtures.supplierId; productIds = fixtures.ids;
    Reflect.defineMetadata('design:paramtypes', [PurchasesService], PurchasesController);
    Reflect.defineMetadata('design:paramtypes', [StockMovementsService], ProductStockController);
    Reflect.defineMetadata('design:paramtypes', [StockMovementsService], StockMovementsController);
    const module = await Test.createTestingModule({ controllers: [PurchasesController, ProductStockController, StockMovementsController], providers: [PurchasesService, StockMovementsService] }).compile();
    app = module.createNestApplication(); await app.init();
  }, 20000);
  afterAll(async () => {
    await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const supplier = await client.query<{ id: number }>('SELECT id FROM public.supplier WHERE code = $1', [token]);
      const products = await client.query<{ id: number }>('SELECT id FROM public.product WHERE sku = ANY($1::text[])', [[`${token}-A`, `${token}-B`]]);
      const ids = products.rows.map((row) => row.id);
      if (supplier.rows.length) {
        const ownedId = supplier.rows[0].id;
        await client.query('DELETE FROM public."purchaseLine" WHERE "purchaseId" IN (SELECT id FROM public.purchase WHERE "supplierId" = $1 AND reference LIKE $2)', [ownedId, `${token}-%`]);
        await client.query('DELETE FROM public.purchase WHERE "supplierId" = $1 AND reference LIKE $2', [ownedId, `${token}-%`]);
        await client.query('DELETE FROM public.supplier WHERE id = $1 AND code = $2', [ownedId, token]);
      }
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" = ANY($1::int[])', [ids]);
      await client.query('DELETE FROM public.product WHERE id = ANY($1::int[]) AND sku = ANY($2::text[])', [ids, [`${token}-A`, `${token}-B`]]);
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.purchase WHERE reference LIKE $1', [`${token}-%`])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.supplier WHERE code = $1', [token])).rowCount).toBe(0);
      expect((await client.query('SELECT id FROM public.product WHERE sku = ANY($1::text[])', [[`${token}-A`, `${token}-B`]])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  }, 20000);
  it('keeps drafts stock-neutral, edits and reads lines and exact totals', async () => {
    const response = await create().expect(201); const id = idFrom(response.body);
    expect(response.body).toMatchObject({ status: 'DRAFT', confirmedAt: null, totalAmount: '46.000', supplier: { name: 'مورد الاختبار' }, notes: 'شراء تجريبي' });
    expect(await stock(productIds[0])).toMatchObject({ stock: '0.000' });
    expect(await stock(productIds[1])).toMatchObject({ stock: '0.000' });
    const update = await request(app.getHttpServer()).patch(`/purchases/${id}`).send({ notes: 'معدل', lines: [lines()[0]] }).expect(200);
    expect(update.body).toMatchObject({ totalAmount: '36.000', notes: 'معدل' });
    expect((await request(app.getHttpServer()).get(`/purchases/${id}`).expect(200)).body).toMatchObject({ totalAmount: '36.000' });
    expect((await request(app.getHttpServer()).get('/purchases').expect(200)).body).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
  });
  it('rejects inactive suppliers, missing products, incompatible units, duplicates and invalid inputs', async () => {
    await db.orm.public.Supplier.where({ id: supplierId }).update({ isActive: false });
    await create().expect(409);
    await db.orm.public.Supplier.where({ id: supplierId }).update({ isActive: true });
    await create({ supplierId: 2147483647 }).expect(404);
    await create({ lines: [{ ...lines()[0], productId: 2147483647 }] }).expect(404);
    await create({ lines: [{ ...lines()[0], unit: 'L' }] }).expect(400);
    await create({ lines: [lines()[0], lines()[0]] }).expect(400);
    await create({ lines: [] }).expect(400);
    for (const quantity of ['0', '-1', 'NaN', '1e2', 2]) await create({ lines: [{ ...lines()[0], quantity }] }).expect(400);
    await create({ lines: [{ ...lines()[0], unitPurchasePrice: '0' }] }).expect(400);
    const ref = reference(); await create({ reference: ref }).expect(201); await create({ reference: ref }).expect(409);
    const another = await create().expect(201);
    await request(app.getHttpServer()).patch(`/purchases/${idFrom(another.body)}`).send({ reference: ref }).expect(409);
    await request(app.getHttpServer()).get('/purchases/2147483647').expect(404);
  });
  it('revalidates supplier at confirmation and rolls back the first entry if the second line fails', async () => {
    const response = await create().expect(201), id = idFrom(response.body);
    await db.orm.public.Supplier.where({ id: supplierId }).update({ isActive: false });
    await request(app.getHttpServer()).post(`/purchases/${id}/confirm`).expect(409);
    await db.orm.public.Supplier.where({ id: supplierId }).update({ isActive: true });
    // Only this test's second product changes. First line inserts before this fails.
    await db.orm.public.Product.where({ id: productIds[1] }).update({ saleUnit: 'ML' });
    await request(app.getHttpServer()).post(`/purchases/${id}/confirm`).expect(400);
    expect(await stock(productIds[0])).toMatchObject({ stock: '0.000' });
    expect(await stock(productIds[1])).toMatchObject({ stock: '0.000' });
    expect(await db.orm.public.StockMovement.where({ productId: productIds[0] }).all()).toHaveLength(0);
    expect((await request(app.getHttpServer()).get(`/purchases/${id}`).expect(200)).body).toMatchObject({ status: 'DRAFT', confirmedAt: null });
    await db.orm.public.Product.where({ id: productIds[1] }).update({ saleUnit: 'G' });
  });
  it('confirms multiple lines exactly once under simultaneous requests and makes content immutable', async () => {
    const response = await create().expect(201), id = idFrom(response.body);
    const confirm = () => request(app.getHttpServer()).post(`/purchases/${id}/confirm`);
    const responses = await Promise.all([confirm(), confirm()]);
    expect(responses.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(responses.find((result) => result.status === 201)?.body).toMatchObject({ status: 'CONFIRMED', confirmedAt: expect.any(String), totalAmount: '46.000' });
    expect(await stock(productIds[0])).toMatchObject({ stock: '2.000' });
    expect(await stock(productIds[1])).toMatchObject({ stock: '0.500' });
    for (const productId of productIds) {
      const movements = await db.orm.public.StockMovement.where({ productId }).all();
      expect(movements).toHaveLength(1);
      expect(movements[0]).toMatchObject({ type: 'ENTRY', reason: 'Achat fournisseur' });
    }
    await confirm().expect(409);
    await request(app.getHttpServer()).patch(`/purchases/${id}`).send({ notes: 'Forbidden' }).expect(409);
    await db.orm.public.Supplier.where({ id: supplierId }).update({ isActive: false });
    expect((await request(app.getHttpServer()).get(`/purchases/${id}`).expect(200)).body).toMatchObject({ status: 'CONFIRMED', supplier: { isActive: false } });
    // Regression: shared stock helper still enforces negative-stock prevention.
    await request(app.getHttpServer()).post('/stock-movements').send({ productId: productIds[0], type: 'EXIT', quantity: '3', unit: 'KG' }).expect(409);
    expect(await stock(productIds[0])).toMatchObject({ stock: '2.000' });
  });
});
