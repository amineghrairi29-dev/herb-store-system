import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { ReportsController } from '../src/reports/reports.controller.js';
import { ReportsService } from '../src/reports/reports.service.js';
import { FinanceController } from '../src/finance/finance.controller.js';
import { FinanceService } from '../src/finance/finance.service.js';
import { reportKinds } from '../src/reports/report-definition.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Reports HTTP and exports (disposable fixtures)', () => {
  const token = `TEST-REPORT-${crypto.randomUUID()}`, dates = 'dateFrom=2401-01-01&dateTo=2401-01-02';
  let app: INestApplication<App>, productId: number, supplierId: number, before: unknown;
  const snapshot = () => Promise.all([db.orm.public.Sale.all(), db.orm.public.SaleLine.all(), db.orm.public.SalePayment.all(), db.orm.public.Purchase.all(), db.orm.public.PurchaseLine.all(), db.orm.public.PurchasePayment.all(), db.orm.public.Expense.all(), db.orm.public.CashMovement.all(), db.orm.public.StockMovement.all()]);
  const report = async (kind: string, filter = '') => (await request(app.getHttpServer()).get(`/reports/${kind}?${dates}${filter}`).expect(200)).body as Awaited<ReturnType<ReportsService['report']>>;
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [ReportsService], ReportsController); Reflect.defineMetadata('design:paramtypes', [FinanceService], ReportsService); Reflect.defineMetadata('design:paramtypes', [FinanceService], FinanceController);
    const module = await Test.createTestingModule({ controllers: [ReportsController, FinanceController], providers: [ReportsService, FinanceService] }).compile(); app = module.createNestApplication(); await app.init();
    await db.transaction(async (tx) => {
      const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: token, name: 'منتج التقارير', productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId }); productId = product.id;
      const supplier = await tx.orm.public.Supplier.create({ code: token, name: 'مورد التقارير' }); supplierId = supplier.id;
      const other = await tx.orm.public.Supplier.create({ code: `${token}-OTHER`, name: 'Autre fournisseur' });
      for (let index = 0; index < 28; index++) {
        const confirmed = index < 27, price = confirmed ? '0.1' : '999';
        const sale = await tx.orm.public.Sale.create({ reference: `${token}-S${String(index).padStart(2, '0')}`, customerName: 'عميل التقرير', saleDate: index % 2 === 0 ? '2401-01-01' : '2401-01-02', status: confirmed ? 'CONFIRMED' : 'DRAFT', confirmedAt: confirmed ? new Date().toISOString() : null });
        await tx.orm.public.SaleLine.create({ saleId: sale.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitSalePrice: price, lineTotal: price });
        if (index === 0) for (const paymentDate of ['2401-01-02', '2401-02-01']) {
          const payment = await tx.orm.public.SalePayment.create({ saleId: sale.id, amount: '0.05', paymentMethod: 'CASH', paymentDate, reference: token });
          await tx.orm.public.CashMovement.create({ type: 'IN', sourceType: 'SALE_PAYMENT', sourceId: payment.id, salePaymentId: payment.id, amount: payment.amount, paymentMethod: payment.paymentMethod, movementDate: paymentDate, reference: token, description: 'Paiement vente' });
        }
      }
      for (let index = 0; index < 3; index++) {
        const confirmed = index < 2, price = confirmed ? '0.2' : '999';
        const purchase = await tx.orm.public.Purchase.create({ reference: `${token}-P${index}`, supplierId: index === 1 ? other.id : supplierId, purchaseDate: index === 0 ? '2401-01-01' : '2401-01-02', status: confirmed ? 'CONFIRMED' : 'DRAFT', confirmedAt: confirmed ? new Date().toISOString() : null });
        await tx.orm.public.PurchaseLine.create({ purchaseId: purchase.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitPurchasePrice: price, lineTotal: price });
        if (index === 0) { const payment = await tx.orm.public.PurchasePayment.create({ purchaseId: purchase.id, amount: '0.03', paymentMethod: 'BANK_TRANSFER', paymentDate: '2401-01-02', reference: token }); await tx.orm.public.CashMovement.create({ type: 'OUT', sourceType: 'PURCHASE_PAYMENT', sourceId: payment.id, purchasePaymentId: payment.id, amount: payment.amount, paymentMethod: payment.paymentMethod, movementDate: payment.paymentDate, reference: token, description: 'Paiement fournisseur' }); }
      }
      for (const cash of [true, false]) {
        const expense = await tx.orm.public.Expense.create({ reference: `${token}-E${cash}`, category: cash ? 'RENT' : 'TRANSPORT', description: cash ? 'إيجار; "Étage"\nSuite' : 'Transport', amount: cash ? '0.1' : '0.2', paymentMethod: cash ? 'CASH' : 'CARD', expenseDate: cash ? '2401-01-01' : '2401-01-02' });
        await tx.orm.public.CashMovement.create({ type: 'OUT', sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id, amount: expense.amount, paymentMethod: expense.paymentMethod, movementDate: expense.expenseDate, reference: token, description: expense.description });
      }
      await tx.orm.public.CashMovement.create({ type: 'IN', sourceType: 'MANUAL_IN', amount: '0.01', paymentMethod: 'CASH', movementDate: '2401-01-01', reference: token, description: 'Apport test' });
    });
    before = await snapshot();
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close(); const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."cashMovement" WHERE reference = $1', [token]);
      await client.query('DELETE FROM public."salePayment" WHERE "saleId" IN (SELECT id FROM public.sale WHERE reference LIKE $1)', [`${token}-%`]);
      await client.query('DELETE FROM public."purchasePayment" WHERE "purchaseId" IN (SELECT id FROM public.purchase WHERE reference LIKE $1)', [`${token}-%`]);
      await client.query('DELETE FROM public."saleLine" WHERE "productId" = $1', [productId]); await client.query('DELETE FROM public."purchaseLine" WHERE "productId" = $1', [productId]);
      await client.query('DELETE FROM public.sale WHERE reference LIKE $1', [`${token}-%`]); await client.query('DELETE FROM public.purchase WHERE reference LIKE $1', [`${token}-%`]);
      await client.query('DELETE FROM public.expense WHERE reference LIKE $1', [`${token}-%`]); await client.query('DELETE FROM public.product WHERE sku = $1', [token]); await client.query('DELETE FROM public.supplier WHERE code = $1 OR code = $2', [token, `${token}-OTHER`]);
      await client.query('COMMIT'); expect((await client.query('SELECT id FROM public."cashMovement" WHERE reference = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  }, 20000);
  it('paginates rows but summarizes all confirmed sales, retaining current attached payments', async () => {
    const first = await report('sales'), second = await report('sales', '&page=2');
    expect(first.data).toHaveLength(25); expect(second.data).toHaveLength(2); expect(first.pagination).toMatchObject({ totalItems: 27, totalPages: 2 });
    expect(first.summary).toEqual({ count: '27', confirmedTotal: '2.700', paid: '0.100', remaining: '2.600' }); expect(second.summary).toEqual(first.summary);
    expect(new Set([...first.data, ...second.data].map((row) => row.id)).size).toBe(27);
    expect((await report('sales', '&status=ALL')).summary.confirmedTotal).toBe('2.700'); expect((await report('sales', '&status=DRAFT')).summary.confirmedTotal).toBe('0.000');
    const paid = await report('sales', '&paymentStatus=PAID'); expect(paid.pagination.totalItems).toBe(1); expect(paid.data[0].paid).toBe('0.100');
    expect((await report('sales', '&search=does-not-exist')).pagination.totalItems).toBe(0);
  });
  it('keeps purchase and payment totals distinct and filters suppliers', async () => {
    const purchases = await report('purchases'); expect(purchases.summary).toEqual({ count: '2', confirmedTotal: '0.400', paid: '0.030', remaining: '0.370' });
    expect((await report('purchases', '&status=ALL')).summary.confirmedTotal).toBe('0.400'); expect((await report('purchases', `&supplierId=${supplierId}`)).summary.confirmedTotal).toBe('0.200');
    expect((await report('supplier-payments')).summary.amount).toBe('0.030'); expect((await report('supplier-payments', '&paymentMethod=CASH')).data).toEqual([]);
    expect((await report('customer-collections')).summary.amount).toBe('0.050'); expect((await report('customer-collections', `&search=${encodeURIComponent('عميل')}`)).pagination.totalItems).toBe(1);
  });
  it('counts expenses exactly and preserves CASH-only period impact', async () => {
    expect((await report('expenses')).summary.amount).toBe('0.300'); expect((await report('expenses', '&category=RENT')).summary.amount).toBe('0.100');
    const cash = await report('cash'); expect(cash.summary).toEqual({ cashInflows: '0.060', cashOutflows: '0.100', physicalCashBalance: '-0.040', netFinancialFlow: '-0.270' });
    const card = await report('cash', '&paymentMethod=CARD'); expect(card.summary.physicalCashBalance).toBe('0.000'); expect(card.data.every((row) => row.cashImpact === '0.000')).toBe(true);
    expect((await report('cash', '&sourceType=EXPENSE&type=OUT')).data).toHaveLength(2);
  });
  it('matches Finance for identical dates/end date', async () => {
    const finance = (await request(app.getHttpServer()).get(`/finance/summary?${dates}`).expect(200)).body as Record<string, unknown>;
    const summary = (await report('financial-summary')).summary;
    for (const [key, value] of Object.entries(summary)) expect(value).toBe(finance[key]);
  });
  it('validates filter inputs, caps size, sorts safely and includes date boundaries', async () => {
    expect((await report('sales', '&pageSize=1000')).pagination.pageSize).toBe(100);
    const sorted = await report('sales', '&sortBy=reference&sortOrder=asc&pageSize=100'); expect(sorted.data[0].reference).toBe(`${token}-S00`); expect(sorted.data.at(-1)?.reference).toBe(`${token}-S26`);
    const single = (await request(app.getHttpServer()).get('/reports/expenses?dateFrom=2401-01-02&dateTo=2401-01-02').expect(200)).body as Awaited<ReturnType<ReportsService['report']>>; expect(single.summary.amount).toBe('0.200');
    for (const query of ['dateFrom=2401-02-01&dateTo=2401-01-01', `${dates}&status=INVALID`, `${dates}&page=0`, `${dates}&sortBy=password`]) await request(app.getHttpServer()).get(`/reports/sales?${query}`).expect(400);
    await request(app.getHttpServer()).get(`/reports/cash?${dates}&sourceType=INVALID`).expect(400);
  });
  it('exports all filtered rows independent of page and provides complete print data', async () => {
    const csv = await request(app.getHttpServer()).get(`/reports/sales/export.csv?${dates}&page=2`).expect(200);
    expect(csv.headers['content-type']).toContain('text/csv'); expect(csv.headers['content-disposition']).toContain('attachment');
    expect(csv.text).toContain(`${token}-S00`); expect(csv.text).toContain(`${token}-S26`); expect(csv.text).not.toContain(`${token}-S27`); expect(csv.text).toContain('"2.700"');
    const printed = await report('sales', '&view=print&page=2'); expect(printed.complete).toBe(true); expect(printed.data).toHaveLength(27);
    const filtered = await request(app.getHttpServer()).get(`/reports/expenses/export.csv?${dates}&category=RENT`).expect(200);
    expect(filtered.text.charCodeAt(0)).toBe(0xfeff); expect(filtered.text).toContain('إيجار; ""Étage""\nSuite'); expect(filtered.text).not.toContain('"Transport"');
  });
  it('exports valid empty reports and every report kind', async () => {
    for (const kind of reportKinds) {
      const csv = await request(app.getHttpServer()).get(`/reports/${kind}/export.csv?dateFrom=0001-01-01&dateTo=0001-01-01`).expect(200);
      expect(csv.text.charCodeAt(0)).toBe(0xfeff); expect(csv.text).toContain('"0.000"'); expect(csv.text).not.toContain(token);
    }
  });
  it('uses three bulk selects for sales and leaves all business records unchanged', async () => {
    const spy = vi.spyOn(Client.prototype, 'query');
    try {
      await report('sales', '&pageSize=100');
      const queries = spy.mock.calls.map((args) => args[0]).filter((arg): arg is string => typeof arg === 'string' && /^SELECT /i.test(arg) && /public\.(sale|"saleLine"|"salePayment")/.test(arg));
      expect(queries).toHaveLength(3);
    } finally { spy.mockRestore(); }
    await request(app.getHttpServer()).post('/reports/sales').send({}).expect(404); await request(app.getHttpServer()).patch('/reports/cash').send({}).expect(404);
    expect(await snapshot()).toEqual(before);
  });
});
