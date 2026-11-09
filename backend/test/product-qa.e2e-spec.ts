import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Final product QA (owned fixtures)', () => {
  const tag = `QA-PRODUCT-${crypto.randomUUID()}`;
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  let app: INestApplication<App>;
  const input = { name: 'نعناع', nameFr: 'Menthe fraîche', scientificName: 'Mentha', get classificationIds() { return [classification.classificationId]; }, measurementMode: 'FLEXIBLE', productType: 'VRAC', salePrice: '12.500', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000.000' };
  beforeAll(async () => {
    await db.connect(); Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
    const module = await Test.createTestingModule({ controllers: [ProductsController], providers: [ProductsService] }).compile();
    app = module.createNestApplication(); app.useLogger(false); await app.init();
  });
  afterAll(async () => {
    await app?.close();
    await db.query('DELETE FROM public."saleLine" WHERE "saleId" IN (SELECT id FROM public.sale WHERE reference LIKE $1)', [tag + '%']);
    await db.query('DELETE FROM public.sale WHERE reference LIKE $1', [tag + '%']);
    await db.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE sku LIKE $1)', [tag + '%']);
    await db.query('DELETE FROM public.product WHERE sku LIKE $1', [tag + '%']);
    await db.end();
  });
  it('normalizes blank barcodes to null on create/update and preserves real barcode uniqueness', async () => {
    const server = app.getHttpServer();
    const a = await request(server).post('/products').send({ ...input, sku: tag + '-A', barcode: '' }).expect(201);
    expect(a.body.barcode).toBeNull();
    const b = await request(server).post('/products').send({ ...input, sku: tag + '-B', barcode: ' \t ' }).expect(201);
    expect(b.body.barcode).toBeNull();
    const c = await request(server).post('/products').send({ ...input, sku: tag + '-C', barcode: null }).expect(201);
    expect(c.body.barcode).toBeNull();
    await request(server).patch(`/products/${a.body.id}`).send({ nameFr: 'Menthe modifiée', barcode: '' }).expect(200);
    await request(server).patch(`/products/${a.body.id}`).send({ barcode: ` ${tag}-CODE ` }).expect(200);
    await request(server).patch(`/products/${b.body.id}`).send({ barcode: tag + '-CODE' }).expect(409);
    await request(server).post('/products').send({ ...input, sku: tag + '-D', barcode: tag + '-CODE' }).expect(409);
    await request(server).post('/products').send({ ...input, sku: tag + '-A' }).expect(409);
    await request(server).patch(`/products/${b.body.id}`).send({ sku: tag + '-A' }).expect(409);
    await request(server).patch(`/products/${a.body.id}`).send({ barcode: '  ' }).expect(200);
    expect((await request(server).get(`/products/${a.body.id}`).expect(200)).body.barcode).toBeNull();
    await request(server).patch(`/products/${b.body.id}`).send({ barcode: tag + '-CODE' }).expect(200);
    expect((await request(server).get(`/products/${b.body.id}`).expect(200)).body).toMatchObject({ barcode: tag + '-CODE', name: 'نعناع', salePrice: '12.500' });
    await request(server).delete(`/products/${c.body.id}`).expect(200);
    await request(server).get(`/products/${c.body.id}`).expect(404);
    await request(server).patch(`/products/${c.body.id}`).send({ barcode: null }).expect(404);
    await request(server).delete(`/products/${c.body.id}`).expect(404);
  });
  it.each(['invalid', '1.5', '0', '-1', '2147483648'])('rejects invalid product ID %s with 400', async id => {
    await request(app.getHttpServer()).get(`/products/${id}`).expect(400);
  });
  it('returns 409 for a product referenced by a draft document without deleting either record', async () => {
    const product = (await request(app.getHttpServer()).post('/products').send({ ...input, sku: tag + '-REFERENCED' }).expect(201)).body as { id: number };
    const sale = (await db.query('INSERT INTO public.sale (reference,"saleDate","updatedAt") VALUES ($1,\'2026-09-09\',now()) RETURNING id', [tag + '-DRAFT'])).rows[0] as { id: number };
    await db.query('INSERT INTO public."saleLine" ("saleId","productId",quantity,unit,"quantityInStorageUnit","unitSalePrice","lineTotal") VALUES ($1,$2,1,\'KG\',1,1,1)', [sale.id, product.id]);
    await request(app.getHttpServer()).delete(`/products/${product.id}`).expect(409);
    await request(app.getHttpServer()).get(`/products/${product.id}`).expect(200);
    expect((await db.query('SELECT id FROM public."saleLine" WHERE "saleId"=$1', [sale.id])).rowCount).toBe(1);
  });
});
