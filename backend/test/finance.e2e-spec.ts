import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { db } from '../src/prisma/db.js';
import { FinanceController } from '../src/finance/finance.controller.js';
import { FinanceService } from '../src/finance/finance.service.js';
import * as transaction from '../src/purchases/purchase-transaction.js';
import { summarizeCash } from '../src/cash/cash-values.js';
import { moneyUnits } from '../src/purchases/purchase-validation.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Finance read-only HTTP (disposable fixtures)', () => {
  const token = `TEST-FIN-${crypto.randomUUID()}`, range = '?dateFrom=2400-01-01&dateTo=2400-01-02';
  let app: INestApplication<App>, productId: number, supplierId: number;
  let baseline: Record<string, string>, before: unknown;
  const get = async (query = range) => (await request(app.getHttpServer()).get(`/finance/summary${query}`).expect(200)).body as Record<string, unknown>;
  const snapshot = () => Promise.all([db.orm.public.Sale.all(), db.orm.public.SaleLine.all(), db.orm.public.Purchase.all(), db.orm.public.PurchaseLine.all(), db.orm.public.SalePayment.all(), db.orm.public.PurchasePayment.all(), db.orm.public.Expense.all(), db.orm.public.CashMovement.all(), db.orm.public.StockMovement.all()]);
  const signed = (value: string) => value.startsWith('-') ? -moneyUnits(value.slice(1)) : moneyUnits(value);
  beforeAll(async () => {
    Reflect.defineMetadata('design:paramtypes', [FinanceService], FinanceController);
    const module = await Test.createTestingModule({ controllers: [FinanceController], providers: [FinanceService] }).compile(); app = module.createNestApplication(); await app.init();
    baseline = await get() as Record<string, string>;
    await db.transaction(async (tx) => {
      const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: token, name: 'اختبار التقارير', productType: 'VRAC', salePrice: '1', category: 'Test', storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId }); productId = product.id;
      const supplier = await tx.orm.public.Supplier.create({ code: token, name: 'مورد التقارير' }); supplierId = supplier.id;
      for (const confirmed of [true, false]) {
        const common = { reference: `${token}-${confirmed}`, status: confirmed ? 'CONFIRMED' : 'DRAFT', confirmedAt: confirmed ? new Date().toISOString() : null };
        const sale = await tx.orm.public.Sale.create({ ...common, saleDate: '2400-01-01' });
        const purchase = await tx.orm.public.Purchase.create({ ...common, supplierId, purchaseDate: '2400-01-02' });
        await tx.orm.public.SaleLine.create({ saleId: sale.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitSalePrice: confirmed ? '0.3' : '999', lineTotal: confirmed ? '0.3' : '999' });
        await tx.orm.public.PurchaseLine.create({ purchaseId: purchase.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitPurchasePrice: confirmed ? '0.2' : '999', lineTotal: confirmed ? '0.2' : '999' });
        if (confirmed) {
          const salePayment = await tx.orm.public.SalePayment.create({ saleId: sale.id, amount: '0.1', paymentMethod: 'CARD', paymentDate: '2400-01-02' });
          const purchasePayment = await tx.orm.public.PurchasePayment.create({ purchaseId: purchase.id, amount: '0.1', paymentMethod: 'BANK_TRANSFER', paymentDate: '2400-01-02' });
          await tx.orm.public.CashMovement.create({ type: 'IN', sourceType: 'SALE_PAYMENT', sourceId: salePayment.id, salePaymentId: salePayment.id, amount: '0.1', paymentMethod: 'CARD', movementDate: '2400-01-02', reference: token, description: 'Paiement vente' });
          await tx.orm.public.CashMovement.create({ type: 'OUT', sourceType: 'PURCHASE_PAYMENT', sourceId: purchasePayment.id, purchasePaymentId: purchasePayment.id, amount: '0.1', paymentMethod: 'BANK_TRANSFER', movementDate: '2400-01-02', reference: token, description: 'Paiement fournisseur' });
        }
      }
      const expense = await tx.orm.public.Expense.create({ reference: token, category: 'OTHER', description: 'مصروف', amount: '0.1', paymentMethod: 'CASH', expenseDate: '2400-01-01' });
      await tx.orm.public.CashMovement.create({ type: 'OUT', sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id, amount: '0.1', paymentMethod: 'CASH', movementDate: '2400-01-01', reference: token, description: 'مصروف' });
    });
    before = await snapshot();
  }, 20000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close(); const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."cashMovement" WHERE reference = $1', [token]);
      await client.query('DELETE FROM public."salePayment" WHERE "saleId" IN (SELECT id FROM public.sale WHERE reference LIKE $1)', [`${token}-%`]);
      await client.query('DELETE FROM public."purchasePayment" WHERE "purchaseId" IN (SELECT id FROM public.purchase WHERE reference LIKE $1)', [`${token}-%`]);
      await client.query('DELETE FROM public."saleLine" WHERE "productId" = $1', [productId]); await client.query('DELETE FROM public."purchaseLine" WHERE "productId" = $1', [productId]);
      await client.query('DELETE FROM public.sale WHERE reference LIKE $1', [`${token}-%`]); await client.query('DELETE FROM public.purchase WHERE reference LIKE $1', [`${token}-%`]);
      await client.query('DELETE FROM public.expense WHERE reference = $1', [token]); await client.query('DELETE FROM public.product WHERE id = $1 AND sku = $2', [productId, token]); await client.query('DELETE FROM public.supplier WHERE id = $1 AND code = $2', [supplierId, token]);
      await client.query('COMMIT'); expect((await client.query('SELECT id FROM public."cashMovement" WHERE reference = $1', [token])).rowCount).toBe(0);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { await client.end(); await db.close(); }
  });
  it('aggregates confirmed documents, separate payments and expenses exactly once at boundaries', async () => {
    const result = await get();
    expect(result).toMatchObject({ salesRevenue: '0.300', purchases: '0.200', customerCollections: '0.100', supplierPayments: '0.100', expenses: '0.100', estimatedActivityResult: '0.000' });
    expect(signed(String(result.customerReceivables)) - signed(baseline.customerReceivables)).toBe(moneyUnits('0.2'));
    expect(signed(String(result.supplierPayables)) - signed(baseline.supplierPayables)).toBe(moneyUnits('0.1'));
    expect(signed(String(result.physicalCashBalance)) - signed(baseline.physicalCashBalance)).toBe(-moneyUnits('0.1'));
    expect(result.recentActivity).toEqual(expect.arrayContaining([expect.objectContaining({ description: 'مصروف', sourceType: 'EXPENSE' })]));
  });
  it('uses independent flow dates and as-of end date for balances, matching Caisse', async () => {
    const last = await get('?dateFrom=2400-01-02&dateTo=2400-01-02');
    expect(last).toMatchObject({ salesRevenue: '0.000', customerCollections: '0.100', purchases: '0.200', expenses: '0.000' });
    const full = await get(); expect(last.physicalCashBalance).toBe(full.physicalCashBalance); expect(last.customerReceivables).toBe(full.customerReceivables);
    const rows = await db.orm.public.CashMovement.all(); expect(full.physicalCashBalance).toBe(summarizeCash(rows.filter((row) => row.movementDate <= '2400-01-02'), '2400-01-02').physicalCashBalance);
    const old = await get('?dateFrom=0001-01-01&dateTo=0001-01-01'); expect(old).toMatchObject({ salesRevenue: '0.000', purchases: '0.000', expenses: '0.000', physicalCashBalance: '0.000', customerReceivables: '0.000', supplierPayables: '0.000' });
  });
  it('validates filters and exposes no write endpoints', async () => {
    for (const query of ['?dateFrom=2400-01-01', '?dateFrom=2400-02-30&dateTo=2400-03-01', '?dateFrom=2400-02-01&dateTo=2400-01-01', '?period=invalid']) await request(app.getHttpServer()).get(`/finance/summary${query}`).expect(400);
    for (const preset of ['today', 'month', 'year']) expect((await get(`?period=${preset}`)).period).toBeDefined();
    await request(app.getHttpServer()).post('/finance/summary').send({}).expect(404);
  });
  it('executes in a read-only transaction and changes no documents, payments, expenses, cash or stock', async () => {
    const spy = vi.spyOn(transaction, 'withPurchaseTransaction');
    try { await get(); expect(spy).toHaveBeenCalledWith(expect.any(Function), true); } finally { spy.mockRestore(); }
    await transaction.withPurchaseTransaction(async (tx) => { expect((await tx.client.query('SHOW transaction_read_only')).rows).toEqual([{ transaction_read_only: 'on' }]); }, true);
    expect(await snapshot()).toEqual(before);
  });
});
