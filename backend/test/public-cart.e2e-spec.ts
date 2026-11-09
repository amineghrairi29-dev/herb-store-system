import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { PublicCartController } from '../src/public-catalogue/public-cart.controller.js';
import { PublicCartService } from '../src/public-catalogue/public-cart.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Public cart validation (disposable fixtures)', () => {
  const token = `TEST-CART-${crypto.randomUUID()}`, ids: number[] = [];
  let app: INestApplication<App>, before: unknown;
  const snapshot = () => Promise.all([db.orm.public.Product.orderBy((r) => r.id.asc()).all(), db.orm.public.StockMovement.orderBy((r) => r.id.asc()).all(), db.orm.public.Sale.all(), db.orm.public.Purchase.all(), db.orm.public.CashMovement.all()]);
  const validate = async (items: { productId: number; quantity: string }[]) => (await request(app.getHttpServer()).post('/public/cart/validate').send({ items }).expect(200)).body as Awaited<ReturnType<PublicCartService['validate']>>;
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [PublicCartService], PublicCartController);
    const module = await Test.createTestingModule({ controllers: [PublicCartController], providers: [PublicCartService] }).compile(); app = module.createNestApplication(); await app.init();
    await db.transaction(async (tx) => {
      for (let i = 0; i < 7; i++) {
        const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: `${token}-${i}`, name: 'نعناع', productType: 'VRAC', salePrice: '0.100000000000000001', category: token, storageUnit: 'KG', saleUnit: i === 6 ? 'KG' : 'G', conversionFactor: i === 5 ? '3' : i === 6 ? '1' : '1000', isActive: i !== 2, isSellable: i !== 3, isVisibleOnline: i !== 1, minStock: '2', location: 'SECRET' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId }); ids.push(product.id);
        if (i !== 4) await tx.orm.public.StockMovement.create({ productId: product.id, type: 'ENTRY', quantity: '10', unit: 'KG', quantityInStorageUnit: '10', notes: 'PRIVATE' });
      }
    }); before = await snapshot();
  });
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1 AND sku LIKE $2)', [token, `${token}-%`]);
      await client.query('DELETE FROM public.product WHERE category = $1 AND sku LIKE $2', [token, `${token}-%`]); await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public.product WHERE category = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  });
  it('validates a whole cart, returning current exact prices and safe public products', async () => {
    const result = await validate([{ productId: ids[0], quantity: '10000' }, { productId: ids[6], quantity: '0.5' }]);
    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(item).toMatchObject({ valid: true, quantityAvailable: true, availabilityStatus: 'IN_STOCK', currentPrice: '0.100000000000000001' });
      expect(item.product?.name).toBe('نعناع');
      expect(Object.keys(item).sort()).toEqual(['productId', 'valid', 'quantityAvailable', 'availabilityStatus', 'currentPrice', 'product', 'message'].sort());
      expect(Object.keys(item.product!).sort()).toEqual(['id', 'mainImagePath', 'sku', 'name', 'nameFr', 'scientificName', 'classifications', 'category', 'subcategory', 'salePrice', 'saleUnit', 'packaging', 'origin', 'description', 'availabilityStatus'].sort());
    }
  });
  it('gives identical unavailable responses for hidden, inactive, non-sellable and missing products', async () => {
    for (const productId of [ids[1], ids[2], ids[3], 2147483647]) expect((await validate([{ productId, quantity: '1' }])).items[0]).toEqual({ productId, valid: false, quantityAvailable: false, availabilityStatus: null, currentPrice: null, product: null, message: 'Produit indisponible' });
  });
  it('rejects zero stock, excessive quantities and inexact conversions without exposing stock', async () => {
    const result = await validate([{ productId: ids[4], quantity: '1' }, { productId: ids[0], quantity: '10000.000000000000001' }, { productId: ids[5], quantity: '1' }]);
    expect(result.items.every((item) => !item.valid && !item.quantityAvailable)).toBe(true);
    expect(result.items[0].availabilityStatus).toBe('OUT_OF_STOCK');
    expect(result.items[2].message).toContain('incompatible');
    expect((await validate([{ productId: ids[5], quantity: '3' }])).items[0].valid).toBe(true);
  });
  it('rejects invalid quantities and duplicate IDs through HTTP', async () => {
    for (const quantity of ['0', '-1', 'abc', '1e2']) await request(app.getHttpServer()).post('/public/cart/validate').send({ items: [{ productId: ids[0], quantity }] }).expect(400);
    await request(app.getHttpServer()).post('/public/cart/validate').send({ items: [{ productId: ids[0], quantity: '1' }, { productId: ids[0], quantity: '1' }] }).expect(400);
    expect((await validate([])).items).toEqual([]);
  });
  it('uses one bulk stock query for multiple items', async () => {
    const spy = vi.spyOn(Client.prototype, 'query');
    await validate(ids.map((productId) => ({ productId, quantity: '1' })));
    expect(spy.mock.calls.filter(([sql]) => typeof sql === 'string' && sql.startsWith('WITH visible'))).toHaveLength(1); spy.mockRestore();
  });
  it('never changes stock or business data', async () => { expect(await snapshot()).toEqual(before); });
});
