import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { PublicCatalogueController } from '../src/public-catalogue/public-catalogue.controller.js';
import { PublicCatalogueService } from '../src/public-catalogue/public-catalogue.service.js';
import { aggregateStock, decimalUnits, movementTypes } from '../src/stock-movements/stock-decimal.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Public catalogue (isolated disposable products)', () => {
  const token = `TEST-SHOP-${crypto.randomUUID()}`;
  let app: INestApplication<App>, before: unknown;
  const ids: number[] = [];
  const snapshot = () => Promise.all([db.orm.public.Product.orderBy((r) => r.id.asc()).all(), db.orm.public.StockMovement.orderBy((r) => r.id.asc()).all(), db.orm.public.Sale.all(), db.orm.public.Purchase.all(), db.orm.public.CashMovement.all()]);
  const list = async (query: Record<string, string> = {}) => (await request(app.getHttpServer()).get('/public/products').query({ category: classification.slug, ...query }).expect(200)).body as Awaited<ReturnType<PublicCatalogueService['list']>>;
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [PublicCatalogueService], PublicCatalogueController);
    const module = await Test.createTestingModule({ controllers: [PublicCatalogueController], providers: [PublicCatalogueService] }).compile();
    app = module.createNestApplication(); await app.init();
    await db.transaction(async (tx) => {
      for (let i = 0; i < 67; i++) {
        const product = await tx.orm.public.Product.create({ categoryId: classification.id, subcategoryId: i === 0 ? classification.subcategoryId : null, sku: `${token}-${i}`, name: i === 0 ? 'نعناع' : `Menthe ${String(i).padStart(2, '0')}`, nameFr: i === 0 ? 'Menthe fraîche' : null, scientificName: i === 0 ? 'Mentha spicata' : null, productType: 'VRAC', category: token, subcategory: i === 0 ? 'Feuilles' : null, salePrice: i === 0 ? '12.500000000000000001' : String(i + 1), storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', minStock: i === 2 ? '2.5' : null, location: 'SECRET', isActive: i !== 64, isSellable: i !== 65, isVisibleOnline: i !== 66 }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId });
        if (i === 0) await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.subClassificationId });
        ids.push(product.id);
        if (i === 0 || i === 2) await tx.orm.public.StockMovement.create({ productId: product.id, type: 'ENTRY', quantity: '2.5', unit: 'KG', quantityInStorageUnit: '2.5', notes: 'INTERNAL' });
        if (i === 3) for (const type of movementTypes) await tx.orm.public.StockMovement.create({ productId: product.id, type, quantity: '0.1', unit: 'KG', quantityInStorageUnit: '0.1' });
      }
    });
    before = await snapshot();
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1 AND sku LIKE $2)', [token, `${token}-%`]);
      await client.query('DELETE FROM public.product WHERE category = $1 AND sku LIKE $2', [token, `${token}-%`]);
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.product WHERE category = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  });
  it('requires all visibility flags, retains zero stock and paginates', async () => {
    const first = await list(), second = await list({ page: '2' }), third = await list({ page: '3' });
    expect(first.pagination).toEqual({ page: 1, pageSize: 24, totalItems: 64, totalPages: 3 });
    const rows = [...first.data, ...second.data, ...third.data];
    expect(new Set(rows.map((row) => row.id)).size).toBe(64);
    expect(rows.some((row) => ids.slice(64).includes(row.id))).toBe(false);
    expect(rows.find((row) => row.id === ids[1])?.availabilityStatus).toBe('OUT_OF_STOCK');
    expect((await list({ pageSize: '1000' })).data).toHaveLength(60);
    expect((await list({ page: '99' })).data).toEqual([]);
  });
  it('returns identical safe 404 for hidden, inactive, non-sellable and missing IDs', async () => {
    const missing = await request(app.getHttpServer()).get('/public/products/2147483647').expect(404);
    for (const id of [...ids.slice(64), 'bad']) expect((await request(app.getHttpServer()).get(`/public/products/${id}`).expect(404)).body).toEqual(missing.body);
  });
  it('matches exact stock aggregation including low threshold and all six directions', async () => {
    for (const id of ids.slice(0, 4)) {
      const movements = await db.orm.public.StockMovement.where({ productId: id }).all();
      const stock = aggregateStock(movements);
      const product = await db.orm.public.Product.first({ id });
      const expected = stock <= 0n ? 'OUT_OF_STOCK' : product?.minStock && stock <= decimalUnits(product.minStock) ? 'LOW_STOCK' : 'IN_STOCK';
      const result = await request(app.getHttpServer()).get(`/public/products/${id}`).expect(200);
      expect((result.body as { availabilityStatus: string }).availabilityStatus).toBe(expected);
    }
    expect((await list({ availability: 'LOW_STOCK' })).data.map((row) => row.id)).toEqual([ids[2]]);
    expect((await list({ availability: 'IN_STOCK' })).data.map((row) => row.id)).toEqual([ids[0]]);
  });
  it('preserves UTF-8 and exact money, exposes only the public allowlist', async () => {
    const rows = (await list({ q: 'نعناع' })).data;
    expect(rows).toHaveLength(1); expect(rows[0].name).toBe('نعناع'); expect(rows[0].salePrice).toBe('12.500000000000000001');
    const keys = ['id', 'mainImagePath', 'sku', 'name', 'nameFr', 'scientificName', 'classifications', 'category', 'subcategory', 'salePrice', 'saleUnit', 'packaging', 'origin', 'description', 'availabilityStatus'].sort();
    expect(Object.keys(rows[0]).sort()).toEqual(keys);
    // The detail adds long texts and the gallery to the same allowlist.
    expect(Object.keys((await request(app.getHttpServer()).get(`/public/products/${ids[0]}`).expect(200)).body as object).sort()).toEqual([...keys, 'benefits', 'usage', 'precautions', 'gallery'].sort());
    for (const q of ['MENTHE FRAÎCHE', 'mentha', 'Feuilles', classification.slug]) expect((await list({ q })).data.length).toBeGreaterThan(0);
    expect((await list({ q: "%' OR true --" })).data).toEqual([]);
    expect((await list({ classification: String(classification.subClassificationId) })).data).toHaveLength(1);
    expect((await list({ category: 'missing' })).data).toEqual([]);
  });
  it('sorts names and numeric prices with stable pages', async () => {
    const asc = await list({ sort: 'price_asc' }), desc = await list({ sort: 'price_desc' });
    expect(asc.data[0].salePrice).toBe('2'); expect(desc.data[0].salePrice).toBe('64');
    expect((await list({ sort: 'name_asc' })).data[0].name).toBe('Menthe 01');
    expect((await list({ sort: 'name_desc' })).data[0].name).toBe('نعناع');
  });
  it('includes active classification options', async () => {
    const rows = (await request(app.getHttpServer()).get('/public/categories').expect(200)).body as { id: number; subcategories: { id: number }[] }[];
    expect(rows.map(row => row.id)).toEqual(expect.arrayContaining([classification.classificationId, classification.subClassificationId]));
  });
  it('exposes a nullable curated image path without internal category metadata', async () => {
    const category = () => new PublicCatalogueService().categories().then(rows => rows.find(row => row.id === classification.classificationId));
    expect((await category())?.imagePath).toBeNull();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('UPDATE public.classification SET "imagePath" = $1 WHERE id = $2', ['/images/categories/herbes.png', classification.classificationId]);
      const result = await category();
      expect(result?.imagePath).toBe('/images/categories/herbes.png');
      expect(Object.keys(result!).sort()).toEqual(['id', 'slug', 'nameAr', 'nameFr', 'imagePath', 'subcategories'].sort());
    } finally {
      await client.query('UPDATE public.classification SET "imagePath" = NULL WHERE id = $1', [classification.classificationId]);
      await client.end();
    }
  });
  it('validates HTTP queries and uses two bulk SELECTs regardless of page size', async () => {
    for (const query of ['page=0', 'sort=bad', 'q=a&q=b', 'availability=bad']) await request(app.getHttpServer()).get(`/public/products?${query}`).expect(400);
    const spy = vi.spyOn(Client.prototype, 'query');
    await list({ pageSize: '60' });
    const reads = spy.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.startsWith('WITH visible'));
    expect(reads).toHaveLength(2); spy.mockRestore();
  });
  it('all catalogue GETs leave stock and business data unchanged', async () => { expect(await snapshot()).toEqual(before); });
});
