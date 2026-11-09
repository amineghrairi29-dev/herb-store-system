import { Client } from 'pg';
import type { ProductTransaction } from '../src/prisma/product-transaction.js';
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from '../src/prisma/contract.d';
import contractJson from '../src/prisma/contract.json' with { type: 'json' };
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';

const harness = vi.hoisted(() => ({ db: undefined as ProductTransaction | undefined }));
vi.mock('../src/prisma/db.js', () => ({ get db() {
  if (!harness.db) throw new Error('Database access outside the test transaction is forbidden.');
  return harness.db;
} }));
vi.mock('../src/prisma/product-transaction.js', () => ({
  withProductTransaction: async <T>(_id: number, work: (tx: ProductTransaction) => Promise<T>) => {
    if (!harness.db) throw new Error('Database access outside the test transaction is forbidden.');
    return work(harness.db);
  },
}));

vi.mock('../src/purchases/purchase-transaction.js', () => ({
  withPurchaseTransaction: async <T>(work: (tx: ProductTransaction) => Promise<T>) => {
    if (!harness.db) throw new Error('Database access outside the test transaction is forbidden.');
    return work(harness.db);
  },
}));
// Opt in explicitly: actual PostgreSQL writes are always rolled back, never committed.
describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Product stock references (transactional HTTP)', () => {
  it('creates, loads, edits and validates through Nest and Prisma without persisting test rows', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    const database = postgres<Contract>({ contractJson, pg: client });
    const rollback = new Error('Intentional verification rollback');
    const sku = `TEST-STOCK-${crypto.randomUUID()}`;
    let app: INestApplication<App> | undefined;
    try {
      await expect(database.transaction(async (tx) => {
        harness.db = { orm: tx.orm, client };
        const category = await tx.orm.public.Classification.create({ nameFr: sku, slug: sku.toLowerCase() });
        // Vitest does not emit constructor metadata; supply the metadata Nest gets in builds.
        Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
        const module = await Test.createTestingModule({
          controllers: [ProductsController], providers: [ProductsService],
        }).compile();
        app = module.createNestApplication();
        await app.init();
        const server = app.getHttpServer();
        const input = {
          sku, name: 'نعناع اختبار', productType: 'VRAC', salePrice: '12.500',
          classificationIds: [category.id], measurementMode: 'FLEXIBLE', storageUnit: 'KG', saleUnit: 'G',
          conversionFactor: '1000.000', minStock: '1.500', maxStock: '10.000', location: 'Rayon A / Bac 03',
          isActive: true, isSellable: true, isVisibleOnline: false,
        };
        await request(server).post('/products').send({ ...input, conversionFactor: '0' }).expect(400);
        const created = await request(server).post('/products').send(input).expect(201);
        const body: unknown = created.body;
        if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'number') {
          throw new Error('Create response did not return a product ID.');
        }
        const path = `/products/${body.id}`;
        const first = await request(server).get(path).expect(200);
        expect(first.body).toMatchObject(input);
        await request(server).patch(path).send({ maxStock: '1.000' }).expect(400);
        await request(server).patch(path).send({
          classificationIds: [category.id], conversionFactor: '1.000', storageUnit: 'PIECE', saleUnit: 'PIECE',
          minStock: null, maxStock: null, location: null, isActive: false,
        }).expect(200);
        const updated = await request(server).get(path).expect(200);
        expect(updated.body).toMatchObject({
          sku, classificationIds: [category.id], storageUnit: 'PIECE', saleUnit: 'PIECE', conversionFactor: '1.000',
          minStock: null, maxStock: null, location: null, isActive: false,
        });
        const listed = await request(server).get('/products').expect(200);
        expect(listed.body).toEqual(expect.arrayContaining([expect.objectContaining({ sku, classificationIds: [category.id] })]));
        await app.close();
        app = undefined;
        throw rollback;
      })).rejects.toBe(rollback);
      expect(await database.orm.public.Product.first({ sku })).toBeNull();
    } finally {
      await app?.close();
      harness.db = undefined;
      await database.close();
      await client.end();
    }
  }, 20000);
});
