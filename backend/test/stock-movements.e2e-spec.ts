import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { ProductsController } from '../src/products/products.controller.js';
import { ProductsService } from '../src/products/products.service.js';
import { ProductStockController, StockMovementsController } from '../src/stock-movements/stock-movements.controller.js';
import { StockMovementsService } from '../src/stock-movements/stock-movements.service.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Stock movements V1 (disposable database fixtures)', () => {
  it('checks conversion, aggregation, concurrent exits, and history protection through HTTP', async () => {
    let app: INestApplication<App> | undefined;
    const sku = `TEST-MOVEMENTS-${crypto.randomUUID()}`;
    let id: number | undefined;
    try {
      Reflect.defineMetadata('design:paramtypes', [ProductsService], ProductsController);
      Reflect.defineMetadata('design:paramtypes', [StockMovementsService], StockMovementsController);
      Reflect.defineMetadata('design:paramtypes', [StockMovementsService], ProductStockController);
      const module = await Test.createTestingModule({
        controllers: [ProductsController, StockMovementsController, ProductStockController],
        providers: [ProductsService, StockMovementsService],
      }).compile();
      app = module.createNestApplication();
      await app.init();
      const server = app.getHttpServer();
      const created = await request(server).post('/products').send({
        sku, name: 'نعناع اختبار المخزون', productType: 'VRAC', salePrice: '12.500', classificationIds: [classification.classificationId], measurementMode: 'FLEXIBLE',
        storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', minStock: '1',
      }).expect(201);
      const body: unknown = created.body;
      if (typeof body !== 'object' || body === null || !('id' in body) || typeof body.id !== 'number') throw new Error('Missing fixture ID.');
      id = body.id;
      const movement = (type: string, quantity: string, unit = 'KG') => request(server).post('/stock-movements').send({ productId: id, type, quantity, unit });
      const stock = () => request(server).get(`/products/${id}/stock`).expect(200);
      expect((await stock()).body).toEqual({ productId: id, stock: '0.000', unit: 'KG' });
      await movement('EXIT', '1').expect(409);
      await movement('ENTRY', '1', 'L').expect(400);
      await request(server).post('/stock-movements').send({ productId: id, type: 'ENTRY', quantity: '1', unit: 'KG', quantityInStorageUnit: '999' }).expect(400);
      await request(server).post('/stock-movements').send({ productId: 2147483647, type: 'ENTRY', quantity: '1', unit: 'KG' }).expect(404);
      const entry = await movement('ENTRY', '10').expect(201);
      expect(entry.body).toMatchObject({ productId: id, quantityInStorageUnit: '10.000' });
      const entryBody: unknown = entry.body;
      if (typeof entryBody !== 'object' || entryBody === null || !('id' in entryBody) || typeof entryBody.id !== 'number') throw new Error('Missing movement ID.');
      await request(server).get(`/stock-movements/${entryBody.id}`).expect(200);
      await movement('EXIT', '500', 'G').expect(201);
      await movement('LOSS', '0.2').expect(201);
      expect((await stock()).body).toMatchObject({ stock: '9.300' });
      await movement('ADJUSTMENT_IN', '0.2').expect(201);
      await movement('ADJUSTMENT_OUT', '0.2').expect(201);
      await movement('RETURN_IN', '0.7').expect(201);
      expect((await stock()).body).toMatchObject({ stock: '10.000' });
      const exits = await Promise.all([movement('EXIT', '7'), movement('EXIT', '7')]);
      expect(exits.map((response) => response.status).sort()).toEqual([201, 409]);
      expect((await stock()).body).toMatchObject({ stock: '3.000' });
      await request(server).patch(`/products/${id}`).send({ storageUnit: 'G' }).expect(409);
      await request(server).patch(`/products/${id}`).send({ conversionFactor: '2' }).expect(409);
      await request(server).patch(`/products/${id}`).send({ classificationIds: [classification.classificationId], measurementMode: 'FLEXIBLE', conversionFactor: '1000.000' }).expect(200);
      await request(server).delete(`/products/${id}`).expect(409);
      await movement('EXIT', '3').expect(201);
      expect((await stock()).body).toMatchObject({ stock: '0.000' });
      await movement('LOSS', '0.001').expect(409);
      const list = await request(server).get('/stock-movements').expect(200);
      expect(list.body).toEqual(expect.arrayContaining([expect.objectContaining({ productId: id, type: 'ENTRY' })]));
    } finally {
      await app?.close();
      // Cleanup is limited to the exact generated SKU and ID owned by this test.
      const fixture = await db.orm.public.Product.first({ sku });
      if (fixture && (id === undefined || fixture.id === id)) {
        const cleanup = new Client({ connectionString: process.env.DATABASE_URL });
        await cleanup.connect();
        try {
          await cleanup.query('BEGIN');
          await cleanup.query('DELETE FROM public."stockMovement" WHERE "productId" = $1', [fixture.id]);
          await cleanup.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [fixture.id, sku]);
          await cleanup.query('COMMIT');
        } catch (error: unknown) {
          await cleanup.query('ROLLBACK');
          throw error;
        } finally { await cleanup.end(); }
      }
      await db.close();
    }
  }, 30000);
});
