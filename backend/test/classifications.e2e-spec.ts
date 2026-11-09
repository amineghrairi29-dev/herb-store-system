import 'dotenv/config';
import { Client } from 'pg';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureHttpSecurity } from '../src/auth/http-security.js';
import { UsersService } from '../src/auth/users.service.js';
import { ProductsService } from '../src/products/products.service.js';
import { ProductsController } from '../src/products/products.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Required classifications (owned UUID fixtures)', () => {
  const tag = `classification-${crypto.randomUUID()}`, password = `Aa9-${crypto.randomUUID()}`;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication<App>, cookie: string, before: unknown, a: number, b: number, productId: number;
  const products = new ProductsService(), catalogue = new PublicCatalogueService(), stock = new StockMovementsService();
  const tables = ['product', 'stockMovement', 'classification', 'productClassification', 'category', 'subcategory', 'sale', 'saleLine', 'salePayment', 'purchase', 'purchaseLine', 'purchasePayment', 'cashMovement', 'expense', 'supplier', 'onlineOrder', 'onlineOrderLine', 'customer', 'customerSession', 'user', 'authSession'];
  async function snapshot() { const rows = []; for (const table of tables) rows.push((await db.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows); return rows; }
  const post = (path: string) => request(app.getHttpServer()).post(path).set('Cookie', cookie).set('Origin', 'http://localhost:3000');
  const patch = (path: string) => request(app.getHttpServer()).patch(path).set('Cookie', cookie).set('Origin', 'http://localhost:3000');
  const input = () => ({ sku: tag, name: 'منتج تجريبي', productType: 'VRAC', salePrice: '12.500', classificationIds: [a, b], measurementMode: 'WEIGHT', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', isActive: true, isSellable: true, isVisibleOnline: true });
  beforeAll(async () => {
    await db.connect(); before = await snapshot();
    Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
    Reflect.defineMetadata('design:paramtypes', [PublicCatalogueService], PublicCatalogueController);
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = mod.createNestApplication(); app.useLogger(false); configureHttpSecurity(app); await app.init();
    await new UsersService().create({ email: `${tag}@example.test`, fullName: tag, role: 'ADMIN', password });
    const login = await request(app.getHttpServer()).post('/auth/login').set('Origin', 'http://localhost:3000').send({ email: `${tag}@example.test`, password }).expect(200);
    cookie = String(login.headers['set-cookie'][0]).split(';')[0];
  });
  afterAll(async () => {
    await app?.close();
    await db.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE sku=$1)', [tag]);
    await db.query('DELETE FROM public.product WHERE sku=$1', [tag]);
    await db.query('DELETE FROM public.classification WHERE "nameFr" LIKE $1', [`${tag}%`]);
    await db.query('DELETE FROM public."user" WHERE email=$1', [`${tag}@example.test`]);
    expect(await snapshot()).toEqual(before); await db.end();
  });
  it('allows ADMIN to create persistent reusable classifications, not visitors', async () => {
    await request(app.getHttpServer()).get('/classifications').expect(401);
    a = (await post('/classifications').send({ nameFr: `${tag} Cheveux`, nameAr: 'الشعر' }).expect(201)).body.id as number;
    b = (await post('/classifications').send({ nameFr: `${tag} Visage` }).expect(201)).body.id as number;
    const list = await request(app.getHttpServer()).get('/classifications').set('Cookie', cookie).expect(200);
    expect((list.body as { id: number }[]).some(c => c.id === a)).toBe(true);
    // Starter needs must be discoverable before the first product is assigned.
    expect((await catalogue.categories()).map(c => c.id)).toEqual(expect.arrayContaining([a, b]));
    expect((await catalogue.categories(true)).some(c => [a, b].includes(c.id))).toBe(false);
    await post('/classifications').send({ nameFr: 'Invalid', measurementMode: 'VOLUME' }).expect(400);
  });
  it('rejects create without classifications, empty selection or unavailable identifiers', async () => {
    const { classificationIds: _ids, ...rest } = input();
    await post('/products').send(rest).expect(400);
    await post('/products').send({ ...input(), classificationIds: [] }).expect(400);
    await post('/products').send({ ...input(), classificationIds: [2147483647] }).expect(400);
  });
  it('creates one product in multiple classifications without duplicate public results', async () => {
    const result = await post('/products').send(input()).expect(201); productId = result.body.id as number;
    const detail = await products.findOne(productId); expect(new Set(detail.classificationIds)).toEqual(new Set([a, b]));
    for (const id of [a, b]) { const result = await catalogue.list({ classification: String(id) }); expect(result.data.map(p => p.id)).toEqual([productId]); expect(result.pagination.totalItems).toBe(1); }
    expect((await catalogue.categories()).filter(c => [a, b].includes(c.id))).toHaveLength(2);
    const response = await request(app.getHttpServer()).get(`/public/products?classification=${b}`).expect(200);
    expect(response.body.data[0].classifications).toHaveLength(2);
    for (const key of ['measurementMode', 'storageUnit', 'conversionFactor', 'legacyCategoryId', 'derivedStock', 'purchasePrice']) expect(response.body.data[0]).not.toHaveProperty(key);
  });
  it('requires a classification on edit and rolls back rejected links', async () => {
    await patch(`/products/${productId}`).send({ classificationIds: [] }).expect(400);
    await patch(`/products/${productId}`).send({ classificationIds: [2147483647], name: 'Must not persist' }).expect(400);
    expect((await products.findOne(productId)).name).toBe(input().name);
    await patch(`/products/${productId}`).send({ classificationIds: [b] }).expect(200);
    expect((await catalogue.list({ classification: String(a) })).data).toHaveLength(0);
    await patch(`/products/${productId}`).send({ classificationIds: [a, b] }).expect(200);
  });
  it('drawer includes only needs with public sellable products', async () => {
    const visible = async () => (await request(app.getHttpServer()).get('/public/classifications?withProducts=true').expect(200)).body as { id: number }[];
    expect((await visible()).map(c => c.id)).toEqual(expect.arrayContaining([a, b]));
    for (const flag of ['isActive', 'isSellable', 'isVisibleOnline']) {
      await patch(`/products/${productId}`).send({ [flag]: false }).expect(200);
      expect((await visible()).some(c => [a, b].includes(c.id))).toBe(false);
      await patch(`/products/${productId}`).send({ [flag]: true }).expect(200);
    }
  });
  it('renames and disables linked classifications without deleting links or exposing hidden-only products', async () => {
    await patch(`/classifications/${a}`).send({ nameFr: `${tag} Cheveux renommé`, isActive: false }).expect(200);
    expect((await products.findOne(productId)).classificationIds).toContain(a);
    expect((await catalogue.detail(String(productId))).classifications.map(c => c.id)).toEqual([b]);
    await patch(`/classifications/${b}`).send({ isActive: false }).expect(200);
    expect((await catalogue.categories()).some(c => c.id === a || c.id === b)).toBe(false);
    expect((await catalogue.categories(true)).some(c => c.id === a || c.id === b)).toBe(false);
    expect((await catalogue.list({ classification: String(a) })).data).toHaveLength(0);
    await expect(catalogue.detail(String(productId))).rejects.toThrow();
    await patch(`/products/${productId}`).send({ description: 'Must not persist' }).expect(400);
    await patch(`/products/${productId}`).send({ classificationIds: [a, b] }).expect(400);
    expect((await products.findOne(productId)).description).not.toBe('Must not persist');
    await post('/products').send({ ...input(), sku: `${tag}-rejected` }).expect(409);
    await patch(`/classifications/${b}`).send({ isActive: true }).expect(200);
    await patch(`/products/${productId}`).send({ classificationIds: [a, b] }).expect(200);
    expect((await catalogue.detail(String(productId))).id).toBe(productId);
  });
  it('keeps unit conversion, stock protection and classification changes independent', async () => {
    await stock.create({ productId, type: 'ENTRY', quantity: '2.5', unit: 'KG' });
    await stock.create({ productId, type: 'EXIT', quantity: '500', unit: 'G' });
    expect((await stock.stock(productId)).stock).toBe('2.000');
    await expect(stock.create({ productId, type: 'EXIT', quantity: '3000', unit: 'G' })).rejects.toThrow();
    await patch(`/products/${productId}`).send({ classificationIds: [b] }).expect(200);
    expect((await stock.stock(productId)).stock).toBe('2.000');
    await patch(`/products/${productId}`).send({ storageUnit: 'G' }).expect(409);
    await patch(`/products/${productId}`).send({ measurementMode: 'VOLUME' }).expect(400);
    const detail = await products.findOne(productId); expect(detail.salePrice).toBe('12.500'); expect(detail.conversionFactor).toBe('1000');
  });
});
