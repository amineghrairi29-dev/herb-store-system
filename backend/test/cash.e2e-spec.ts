import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { CashController } from '../src/cash/cash.controller.js';
import { CashService } from '../src/cash/cash.service.js';
import { SalesController } from '../src/sales/sales.controller.js';
import { SalesService } from '../src/sales/sales.service.js';
import { PurchasesController } from '../src/purchases/purchases.controller.js';
import { PurchasesService } from '../src/purchases/purchases.service.js';
import * as cashPayment from '../src/cash/cash-payment.js';
import { backfillCash } from '../src/cash/cash-backfill.js';
import { withPurchaseTransaction } from '../src/purchases/purchase-transaction.js';
import { moneyUnits } from '../src/purchases/purchase-validation.js';
import { businessDate, summarizeCash } from '../src/cash/cash-values.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Caisse HTTP and database integrity (disposable fixtures)', () => {
  const token = `TEST-CASH-${crypto.randomUUID()}`;
  let app: INestApplication<App>, productId: number, supplierId: number, sequence = 0;
  let originalStock: unknown;
  const idFrom = (value: unknown): number => { if (typeof value !== 'object' || !value || !('id' in value) || typeof value.id !== 'number') throw new Error('Missing ID'); return value.id; };
  const signed = (value: string) => value.startsWith('-') ? -moneyUnits(value.slice(1)) : moneyUnits(value);
  const summary = async () => (await request(app.getHttpServer()).get('/cash/summary').expect(200)).body as { physicalCashBalance: string; totalFinancialInflows: string; totalFinancialOutflows: string };
  const pay = (sale: boolean, id: number, amount = '1', paymentMethod = 'CASH') => request(app.getHttpServer()).post(`/${sale ? 'sales' : 'purchases'}/${id}/payments`).send({ amount, paymentMethod, paymentDate: '2026-09-06', notes: 'دفع اختباري' });
  // Confirmed documents are fixtures; these tests exercise payments only, without stock operations.
  async function document(sale: boolean) {
    return db.transaction(async (tx) => {
      const common = { reference: `${token}-${++sequence}`, status: 'CONFIRMED', confirmedAt: new Date().toISOString() };
      const line = { productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', lineTotal: '100' };
      if (sale) { const doc = await tx.orm.public.Sale.create({ ...common, saleDate: '2026-09-06' }); await tx.orm.public.SaleLine.create({ ...line, saleId: doc.id, unitSalePrice: '100' }); return doc; }
      const doc = await tx.orm.public.Purchase.create({ ...common, supplierId, purchaseDate: '2026-09-06' }); await tx.orm.public.PurchaseLine.create({ ...line, purchaseId: doc.id, unitPurchasePrice: '100' }); return doc;
    });
  }
  beforeAll(async () => {
    originalStock = await db.orm.public.StockMovement.orderBy((row) => row.id.asc()).all();
    const fixture = await db.transaction(async (tx) => ({
      product: await tx.orm.public.Product.create({ categoryId: classification.id, sku: token, name: 'منتج اختبار الصندوق', productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }),
      supplier: await tx.orm.public.Supplier.create({ code: token, name: 'مورد اختبار الصندوق' }),
    }));
    productId = fixture.product.id; supplierId = fixture.supplier.id;
    Reflect.defineMetadata('design:paramtypes', [CashService], CashController);
    Reflect.defineMetadata('design:paramtypes', [SalesService], SalesController);
    Reflect.defineMetadata('design:paramtypes', [PurchasesService], PurchasesController);
    const module = await Test.createTestingModule({ controllers: [CashController, SalesController, PurchasesController], providers: [CashService, SalesService, PurchasesService] }).compile();
    app = module.createNestApplication({ logger: false }); await app.init();
  }, 20000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close();
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const sales = (await client.query<{ id: number }>('SELECT id FROM public.sale WHERE reference LIKE $1', [`${token}-%`])).rows.map((row) => row.id);
      const purchases = (await client.query<{ id: number }>('SELECT id FROM public.purchase WHERE reference LIKE $1', [`${token}-%`])).rows.map((row) => row.id);
      await client.query('DELETE FROM public."cashMovement" WHERE reference = $1 OR "salePaymentId" IN (SELECT id FROM public."salePayment" WHERE "saleId" = ANY($2::int[])) OR "purchasePaymentId" IN (SELECT id FROM public."purchasePayment" WHERE "purchaseId" = ANY($3::int[]))', [token, sales, purchases]);
      await client.query('DELETE FROM public."salePayment" WHERE "saleId" = ANY($1::int[])', [sales]);
      await client.query('DELETE FROM public."purchasePayment" WHERE "purchaseId" = ANY($1::int[])', [purchases]);
      await client.query('DELETE FROM public."saleLine" WHERE "saleId" = ANY($1::int[])', [sales]);
      await client.query('DELETE FROM public."purchaseLine" WHERE "purchaseId" = ANY($1::int[])', [purchases]);
      await client.query('DELETE FROM public.sale WHERE id = ANY($1::int[])', [sales]);
      await client.query('DELETE FROM public.purchase WHERE id = ANY($1::int[])', [purchases]);
      await client.query('DELETE FROM public.product WHERE sku = $1', [token]);
      await client.query('DELETE FROM public.supplier WHERE code = $1', [token]);
      await client.query('COMMIT');
      expect((await client.query('SELECT id FROM public."cashMovement" WHERE reference LIKE $1', [`${token}%`])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; }
    finally { await client.end(); await db.close(); }
  }, 20000);
  it.each([true, false])('links exactly one movement for every payment method (sale=%s)', async (sale) => {
    const doc = await document(sale);
    for (const method of ['CASH', 'CARD', 'BANK_TRANSFER', 'CHECK', 'OTHER']) {
      const before = await summary();
      const response = await pay(sale, doc.id, '0.1', method).expect(201), paymentId = idFrom(response.body);
      const rows = await db.orm.public.CashMovement.where({ sourceType: sale ? 'SALE_PAYMENT' : 'PURCHASE_PAYMENT', sourceId: paymentId }).all();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: sale ? 'IN' : 'OUT', amount: '0.100', paymentMethod: method, movementDate: '2026-09-06', reference: doc.reference, notes: 'دفع اختباري' });
      const after = await summary();
      expect(signed(after.physicalCashBalance) - signed(before.physicalCashBalance)).toBe(method === 'CASH' ? moneyUnits('0.1') * (sale ? 1n : -1n) : 0n);
      const metric = sale ? 'totalFinancialInflows' : 'totalFinancialOutflows';
      expect(moneyUnits(after[metric]) - moneyUnits(before[metric])).toBe(moneyUnits('0.1'));
    }
  });
  it.each([true, false])('rolls back both payment and inserted cash movement on failure (sale=%s)', async (sale) => {
    const doc = await document(sale), before = await summary();
    const original = cashPayment.recordPaymentMovement;
    const spy = vi.spyOn(cashPayment, 'recordPaymentMovement').mockImplementationOnce(async (...args) => { await original(...args); throw new Error('Injected cash failure'); });
    try { await pay(sale, doc.id).expect(500); } finally { spy.mockRestore(); }
    expect(sale ? await db.orm.public.SalePayment.where({ saleId: doc.id }).all() : await db.orm.public.PurchasePayment.where({ purchaseId: doc.id }).all()).toEqual([]);
    expect(await db.orm.public.CashMovement.where({ reference: doc.reference }).all()).toEqual([]);
    expect(await summary()).toEqual(before);
  });
  it.each([true, false])('serializes concurrent payments and repeated linking (sale=%s)', async (sale) => {
    const doc = await document(sale);
    const results = await Promise.all([pay(sale, doc.id, '80'), pay(sale, doc.id, '80')]);
    expect(results.map((row) => row.status).sort()).toEqual([201, 409]);
    const payment = sale ? (await db.orm.public.SalePayment.where({ saleId: doc.id }).all())[0] : (await db.orm.public.PurchasePayment.where({ purchaseId: doc.id }).all())[0];
    const sourceType = sale ? 'SALE_PAYMENT' : 'PURCHASE_PAYMENT';
    const retry = () => withPurchaseTransaction(async (tx) => {
      await tx.client.query(sale ? 'SELECT id FROM public.sale WHERE id = $1 FOR UPDATE' : 'SELECT id FROM public.purchase WHERE id = $1 FOR UPDATE', [doc.id]);
      return cashPayment.recordPaymentMovement(tx, sourceType, payment, doc.reference);
    });
    const linked = await Promise.all([retry(), retry()]);
    expect(linked[0].id).toBe(linked[1].id);
    expect(await db.orm.public.CashMovement.where({ sourceType, sourceId: payment.id }).all()).toHaveLength(1);
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await expect(client.query('INSERT INTO public."cashMovement" (type,"sourceType","sourceId","salePaymentId","purchasePaymentId",amount,"paymentMethod","movementDate",description) SELECT type,"sourceType","sourceId","salePaymentId","purchasePaymentId",amount,"paymentMethod","movementDate",description FROM public."cashMovement" WHERE id=$1', [linked[0].id])).rejects.toMatchObject({ code: '23505' }); }
    finally { await client.end(); }
  });
  it('dry-runs and backfills legacy payments exactly once without changing originals', async () => {
    const sale = await document(true), purchase = await document(false);
    const legacy = await db.transaction(async (tx) => ({
      sale: await tx.orm.public.SalePayment.create({ saleId: sale.id, amount: '0.123456789012345678901234567890123456', paymentMethod: 'CARD', paymentDate: '2026-09-01', reference: 'مرجع قديم', notes: 'ملاحظة' }),
      purchase: await tx.orm.public.PurchasePayment.create({ purchaseId: purchase.id, amount: '0.2', paymentMethod: 'BANK_TRANSFER', paymentDate: '2026-09-02' }),
    }));
    const scope = { salePaymentIds: [legacy.sale.id], purchasePaymentIds: [legacy.purchase.id] };
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('BEGIN');
      const dry = await backfillCash(client, false, scope);
      expect(dry).toEqual({ SALE_PAYMENT: { payments: 1, missing: 1, inserted: 0 }, PURCHASE_PAYMENT: { payments: 1, missing: 1, inserted: 0 } });
      const first = await backfillCash(client, true, scope), second = await backfillCash(client, true, scope);
      expect(first.SALE_PAYMENT.inserted).toBe(1); expect(first.PURCHASE_PAYMENT.inserted).toBe(1);
      expect(second.SALE_PAYMENT).toEqual({ payments: 1, missing: 0, inserted: 0 }); expect(second.PURCHASE_PAYMENT.inserted).toBe(0);
      await client.query('COMMIT');
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); }
    expect(await db.orm.public.SalePayment.first({ id: legacy.sale.id })).toEqual(legacy.sale);
    expect(await db.orm.public.PurchasePayment.first({ id: legacy.purchase.id })).toEqual(legacy.purchase);
    expect(await db.orm.public.CashMovement.first({ sourceType: 'SALE_PAYMENT', sourceId: legacy.sale.id })).toMatchObject({ amount: legacy.sale.amount, paymentMethod: 'CARD', movementDate: legacy.sale.paymentDate, reference: legacy.sale.reference, notes: legacy.sale.notes, createdAt: legacy.sale.createdAt });
    expect(await db.orm.public.CashMovement.first({ sourceType: 'PURCHASE_PAYMENT', sourceId: legacy.purchase.id })).toMatchObject({ amount: legacy.purchase.amount, paymentMethod: 'BANK_TRANSFER', reference: purchase.reference, createdAt: legacy.purchase.createdAt });
  });
  it('records exact manual cash in/out, preserves UTF-8 and rejects invalid/override inputs', async () => {
    const before = await summary(), body = { amount: '0.1', movementDate: '2026-09-06', description: 'إيداع صندوق', reference: token, notes: 'اختبار' };
    await request(app.getHttpServer()).post('/cash/manual-in').send(body).expect(201);
    expect(signed((await summary()).physicalCashBalance) - signed(before.physicalCashBalance)).toBe(moneyUnits('0.1'));
    const response = await request(app.getHttpServer()).post('/cash/manual-out').send({ ...body, amount: '0.2' }).expect(201);
    expect(response.body).toMatchObject({ paymentMethod: 'CASH', type: 'OUT', sourceType: 'MANUAL_OUT', description: body.description, sourceId: null });
    expect(signed((await summary()).physicalCashBalance) - signed(before.physicalCashBalance)).toBe(-moneyUnits('0.1'));
    for (const amount of ['0', '-1', 'NaN', 1]) await request(app.getHttpServer()).post('/cash/manual-in').send({ ...body, amount }).expect(400);
    await request(app.getHttpServer()).post('/cash/manual-out').send({ ...body, paymentMethod: 'CARD' }).expect(400);
    await request(app.getHttpServer()).post('/cash/manual-in').send({ ...body, description: ' ' }).expect(400);
    await request(app.getHttpServer()).post('/cash/manual-in').send({ ...body, movementDate: '2026-02-30' }).expect(400);
    await request(app.getHttpServer()).patch(`/cash/movements/${idFrom(response.body)}`).send({ amount: '2' }).expect(404);
    await request(app.getHttpServer()).delete(`/cash/movements/${idFrom(response.body)}`).expect(404);
  });
  it('returns exact summary, sorted linked history and leaves every stock movement unchanged', async () => {
    const rows = await db.orm.public.CashMovement.orderBy([(row) => row.movementDate.desc(), (row) => row.createdAt.desc(), (row) => row.id.desc()]).all();
    const { today, timeZone } = businessDate();
    expect(await summary()).toEqual({ ...summarizeCash(rows, today), businessDate: today, timeZone });
    const history = (await request(app.getHttpServer()).get('/cash/movements').expect(200)).body as Array<{ id: number; linkedSaleId: number | null; linkedPurchaseId: number | null; sourceType: string }>;
    expect(history.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect(history.filter((row) => row.sourceType === 'SALE_PAYMENT').every((row) => row.linkedSaleId !== null)).toBe(true);
    expect(history.filter((row) => row.sourceType === 'PURCHASE_PAYMENT').every((row) => row.linkedPurchaseId !== null)).toBe(true);
    expect((await request(app.getHttpServer()).get(`/cash/movements/${history[0].id}`).expect(200)).body).toEqual(history[0]);
    await request(app.getHttpServer()).get('/cash/movements/2147483647').expect(404);
    expect(await db.orm.public.StockMovement.orderBy((row) => row.id.asc()).all()).toEqual(originalStock);
  });
});
