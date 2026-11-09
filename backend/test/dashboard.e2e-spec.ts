import { categoryFixture } from './category-fixture.js';
const classification = categoryFixture();
import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';
import request from 'supertest';
import { Client } from 'pg';
import { AuthModule } from '../src/auth/auth.module.js';
import { AuthService } from '../src/auth/auth.service.js';
import { UsersService } from '../src/auth/users.service.js';
import { DashboardModule } from '../src/dashboard/dashboard.module.js';
import { DashboardService } from '../src/dashboard/dashboard.service.js';
import type { FullDashboard } from '../src/dashboard/dashboard.dto.js';
import { FinanceService } from '../src/finance/finance.service.js';
import { CashService } from '../src/cash/cash.service.js';
import * as cashValues from '../src/cash/cash-values.js';
import * as transactions from '../src/purchases/purchase-transaction.js';
import { db } from '../src/prisma/db.js';
import { aggregateStock, decimalUnits } from '../src/stock-movements/stock-decimal.js';
import { lineTotal, moneyString, moneyUnits } from '../src/purchases/purchase-validation.js';
import type { Role } from '../src/auth/auth-policy.js';

describe.skipIf(process.env.RUN_DATABASE_TESTS !== '1')('Operational dashboard (disposable fixtures, real auth)', () => {
  const tag = `TEST-DASH-${crypto.randomUUID()}`, today = '2400-01-02', passwords = `Dd9-${crypto.randomUUID()}`, exactSale = lineTotal('0.100000000000000001', '0.200000000000000001');
  const client = new Client({ connectionString: process.env.DATABASE_URL }), cookies = {} as Record<Role, string>;
  let app: INestApplication<App>, before: unknown, fixtureSnapshot: unknown, baseline: FullDashboard, supplierId: number, productId: number;
  const tables = ['product', 'stockMovement', 'sale', 'saleLine', 'purchase', 'purchaseLine', 'salePayment', 'purchasePayment', 'cashMovement', 'expense', 'onlineOrder', 'onlineOrderLine', 'supplier', 'user', 'authSession'];
  async function snapshot() { const result = []; for (const table of tables) result.push((await client.query(`SELECT jsonb_agg(t ORDER BY id) AS rows FROM public."${table}" t`)).rows[0].rows); return result; }
  const get = async (role: Role = 'ADMIN') => (await request(app.getHttpServer()).get('/dashboard').set('Cookie', cookies[role]).expect(200)).body as FullDashboard;
  const delta = (a: string, b: string) => moneyString(moneyUnits(a) - moneyUnits(b));
  beforeAll(async () => {
    vi.spyOn(cashValues, 'businessDate').mockReturnValue({ today, timeZone: 'Africa/Tunis' });
    const module = await Test.createTestingModule({ imports: [AuthModule, DashboardModule] }).compile(); app = module.createNestApplication(); app.useLogger(false); await app.init();
    await client.connect(); before = await snapshot();
    for (const role of ['ADMIN'] as const) {
      const email = `${tag}-${role}@example.com`.toLowerCase(); await new UsersService().create({ email, role, fullName: tag, password: passwords, isActive: true });
      const session = await new AuthService().login({ email, password: passwords }); cookies[role] = `herb_session=${session.token}`;
    }
    baseline = await get();
    await db.transaction(async tx => {
      const supplier = await tx.orm.public.Supplier.create({ code: tag, name: 'مورد لوحة القيادة' }); supplierId = supplier.id;
      const product = await tx.orm.public.Product.create({ categoryId: classification.id, sku: tag, name: 'نعناع لوحة القيادة', productType: 'VRAC', salePrice: '1', category: tag, storageUnit: 'KG', saleUnit: 'G', conversionFactor: '1000', minStock: '2' }); await tx.orm.public.ProductClassification.create({ productId: product.id, classificationId: classification.classificationId }); productId = product.id;
      await tx.orm.public.StockMovement.create({ productId, type: 'ENTRY', quantity: '10', unit: 'KG', quantityInStorageUnit: '10' });
      await tx.orm.public.StockMovement.create({ productId, type: 'EXIT', quantity: '8000', unit: 'G', quantityInStorageUnit: '8' });
      for (const [index, date] of ['2400-01-01', today, '2400-01-03'].entries()) {
        const timestamp = date === today ? '2500-01-01T00:00:00Z' : '2200-01-01T00:00:00Z';
        const sale = await tx.orm.public.Sale.create({ reference: `${tag}-S${index}`, saleDate: date, status: 'CONFIRMED', confirmedAt: timestamp, createdAt: timestamp, customerName: 'عميل لوحة القيادة' });
        const quantity = date === today ? '0.100000000000000001' : '1', price = date === today ? '0.200000000000000001' : '5';
        await tx.orm.public.SaleLine.create({ saleId: sale.id, productId, quantity, unit: 'KG', quantityInStorageUnit: quantity, unitSalePrice: price, lineTotal: lineTotal(quantity, price) });
        const purchase = await tx.orm.public.Purchase.create({ reference: `${tag}-P${index}`, supplierId, purchaseDate: date, status: 'CONFIRMED', confirmedAt: timestamp, createdAt: timestamp });
        await tx.orm.public.PurchaseLine.create({ purchaseId: purchase.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitPurchasePrice: '0.2', lineTotal: '0.2' });
        const salePayment = await tx.orm.public.SalePayment.create({ saleId: sale.id, amount: '0.01', paymentDate: date, paymentMethod: index === 1 ? 'CARD' : 'CASH', createdAt: timestamp });
        const purchasePayment = await tx.orm.public.PurchasePayment.create({ purchaseId: purchase.id, amount: '0.1', paymentDate: date, paymentMethod: 'BANK_TRANSFER', createdAt: timestamp });
        const expense = await tx.orm.public.Expense.create({ reference: `${tag}-E${index}`, description: 'مصروف تجريبي', category: 'OTHER', amount: '0.1', paymentMethod: 'CASH', expenseDate: date, createdAt: timestamp });
        for (const row of [
          { type: 'IN', sourceType: 'SALE_PAYMENT', sourceId: salePayment.id, salePaymentId: salePayment.id, amount: '0.01', paymentMethod: index === 1 ? 'CARD' : 'CASH' },
          { type: 'OUT', sourceType: 'PURCHASE_PAYMENT', sourceId: purchasePayment.id, purchasePaymentId: purchasePayment.id, amount: '0.1', paymentMethod: 'BANK_TRANSFER' },
          { type: 'OUT', sourceType: 'EXPENSE', sourceId: expense.id, expenseId: expense.id, amount: '0.1', paymentMethod: 'CASH' },
        ]) await tx.orm.public.CashMovement.create({ ...row, movementDate: date, reference: tag, description: tag, createdAt: timestamp });
      }
      // DRAFT and CANCELLED totals must not contribute to today's confirmed sales/purchases.
      for (const status of ['DRAFT', 'CANCELLED']) {
        const sale = await tx.orm.public.Sale.create({ reference: `${tag}-${status}`, saleDate: today, status, createdAt: '2200-01-01T00:00:00Z' });
        await tx.orm.public.SaleLine.create({ saleId: sale.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitSalePrice: '999', lineTotal: '999' });
        const purchase = await tx.orm.public.Purchase.create({ reference: `${tag}-${status}`, supplierId, purchaseDate: today, status, createdAt: '2200-01-01T00:00:00Z' });
        await tx.orm.public.PurchaseLine.create({ purchaseId: purchase.id, productId, quantity: '1', unit: 'KG', quantityInStorageUnit: '1', unitPurchasePrice: '999', lineTotal: '999' });
      }
      for (const [i, minimum, stock] of [[0, null, '0'], [1, '2', '0'], [2, '2', '1'], [3, null, '1'], [4, '2', '3'], [5, '0', '1']] as const) {
        const p = await tx.orm.public.Product.create({ categoryId: classification.id, sku: `${tag}-${i}`, name: `منتج ${i}`, category: tag, productType: 'VRAC', salePrice: '1', storageUnit: 'KG', saleUnit: 'KG', conversionFactor: '1', minStock: minimum, isActive: false }); await tx.orm.public.ProductClassification.create({ productId: p.id, classificationId: classification.classificationId });
        if (stock !== '0') await tx.orm.public.StockMovement.create({ productId: p.id, type: 'ENTRY', quantity: stock, unit: 'KG', quantityInStorageUnit: stock });
      }
      for (let i = 0; i < 8; i++) await tx.orm.public.OnlineOrder.create({ reference: `${tag}-ORD${i}`, customerName: 'عميل عربي', customerPhone: '20123456', totalAmount: '0.100000000000000001', status: i < 6 ? 'PENDING' : i === 6 ? 'CONFIRMED' : 'CANCELLED', confirmedAt: i === 6 ? '2200-01-01T00:00:00Z' : null, cancelledAt: i === 7 ? '2200-01-01T00:00:00Z' : null, createdAt: i === 5 ? '2500-01-01T01:00:00Z' : `2200-01-01T00:00:0${i}Z` });
    });
    fixtureSnapshot = await snapshot();
  }, 30000);
  afterAll(async () => {
    vi.restoreAllMocks(); await app?.close();
    try { await client.query('BEGIN');
      await client.query('DELETE FROM public."cashMovement" WHERE reference = $1', [tag]);
      await client.query('DELETE FROM public."salePayment" WHERE "saleId" IN (SELECT id FROM public.sale WHERE reference LIKE $1)', [`${tag}-%`]);
      await client.query('DELETE FROM public."purchasePayment" WHERE "purchaseId" IN (SELECT id FROM public.purchase WHERE reference LIKE $1)', [`${tag}-%`]);
      await client.query('DELETE FROM public."saleLine" WHERE "productId" = $1', [productId]); await client.query('DELETE FROM public."purchaseLine" WHERE "productId" = $1', [productId]);
      await client.query('DELETE FROM public.sale WHERE reference LIKE $1', [`${tag}-%`]); await client.query('DELETE FROM public.purchase WHERE reference LIKE $1', [`${tag}-%`]);
      await client.query('DELETE FROM public.expense WHERE reference LIKE $1', [`${tag}-%`]); await client.query('DELETE FROM public."onlineOrder" WHERE reference LIKE $1', [`${tag}-%`]);
      await client.query('DELETE FROM public."stockMovement" WHERE "productId" IN (SELECT id FROM public.product WHERE category = $1)', [tag]);
      await client.query('DELETE FROM public.product WHERE category = $1', [tag]); await client.query('DELETE FROM public.supplier WHERE id = $1 AND code = $2', [supplierId, tag]);
      await client.query('DELETE FROM public."user" WHERE email LIKE $1', [`${tag.toLowerCase()}-%@example.com`]);
      await client.query('COMMIT'); expect(await snapshot()).toEqual(before);
    } catch (e: unknown) { await client.query('ROLLBACK'); throw e; } finally { await client.end(); await db.close(); }
  }, 20000);
  it('requires authentication and rejects client role/date overrides and writes', async () => {
    await request(app.getHttpServer()).get('/dashboard').expect(401);
    for (const query of ['role=ADMIN', 'date=2026-01-01']) await request(app.getHttpServer()).get(`/dashboard?${query}`).set('Cookie', cookies.ADMIN).expect(400);
    await request(app.getHttpServer()).post('/dashboard').set('Cookie', cookies.ADMIN).expect(404);
  });
  it('ADMIN receives all operational metrics without user statistics', async () => {
    const admin = await get();
    expect(Object.keys(admin.today).sort()).toEqual(['customerCollections', 'expenses', 'purchases', 'sales']);
    expect(Object.keys(admin.balances).sort()).toEqual(['customerReceivables', 'physicalCash', 'supplierPayables']); expect(admin).not.toHaveProperty('users');
  });
  it('uses exact date-field totals, preserving 36 decimals and excluding other dates/drafts/cancellations', async () => {
    const result = await get(); expect(result.businessDate).toBe(today);
    expect(delta(result.today.sales, baseline.today.sales)).toBe(exactSale);
    expect(delta(result.today.customerCollections, baseline.today.customerCollections)).toBe('0.010');
    expect(delta(result.today.purchases, baseline.today.purchases)).toBe('0.200'); expect(delta(result.today.expenses, baseline.today.expenses)).toBe('0.100');
  });
  it('matches Finance as-of-today and Caisse all-record current balance, including future dated cash', async () => {
    const dashboard = await get(), finance = await new FinanceService().summary({ dateFrom: today, dateTo: today }), cash = await new CashService().summary();
    expect(dashboard.today).toEqual({ sales: finance.salesRevenue, customerCollections: finance.customerCollections, purchases: finance.purchases, expenses: finance.expenses });
    expect(dashboard.balances).toEqual({ physicalCash: cash.physicalCashBalance, customerReceivables: finance.customerReceivables, supplierPayables: finance.supplierPayables });
  });
  it('counts all inventory with shared polarity, min thresholds, zero stock and hidden/inactive products', async () => {
    const products = await db.orm.public.Product.all(), movements = await db.orm.public.StockMovement.all();
    let empty = 0, low = 0;
    for (const p of products) { const stock = aggregateStock(movements.filter(m => m.productId === p.id)); if (stock <= 0n) empty++; else if (p.minStock !== null && stock <= decimalUnits(p.minStock)) low++; }
    const result = await get(); expect(result.alerts.outOfStockProducts).toBe(empty); expect(result.alerts.lowStockProducts).toBe(low);
    expect(result.alerts.outOfStockProducts - baseline.alerts.outOfStockProducts).toBe(2); expect(result.alerts.lowStockProducts - baseline.alerts.lowStockProducts).toBe(2);
    expect(result.stockAttention.length).toBeLessThanOrEqual(5); const ranks = result.stockAttention.map(p => p.status === 'OUT_OF_STOCK' ? 0 : 1); expect(ranks).toEqual([...ranks].sort());
  });
  it('pending count excludes confirmed/cancelled, returns latest five and exact order totals', async () => {
    const result = await get(); expect(result.alerts.pendingOnlineOrders - baseline.alerts.pendingOnlineOrders).toBe(6); expect(result.pendingOrders).toHaveLength(5);
    expect(result.pendingOrders[0]).toMatchObject({ reference: `${tag}-ORD5`, customerName: 'عميل عربي', totalAmount: '0.100000000000000001' });
    expect(result.pendingOrders.some(o => o.reference.endsWith('ORD6') || o.reference.endsWith('ORD7'))).toBe(false);
  });
  it('recent activity includes every permitted source with deterministic newest-first ordering', async () => {
    const result = await get(); expect(result.recentActivity).toHaveLength(10);
    expect(new Set(result.recentActivity.map(row => row.type))).toEqual(new Set(['SALE', 'PURCHASE', 'EXPENSE', 'CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'ONLINE_ORDER']));
    const times = result.recentActivity.map(row => Date.parse(row.occurredAt)); expect(times).toEqual([...times].sort((a, b) => b - a));
  });
  it('uses five bounded data queries and one stock aggregation', async () => {
    const original = transactions.withPurchaseTransaction, statements: string[] = [];
    const spy = vi.spyOn(transactions, 'withPurchaseTransaction').mockImplementation((work, readOnly) => original(async tx => {
      const query = vi.spyOn(tx.client, 'query'); try { return await work(tx); } finally { statements.push(...query.mock.calls.flatMap(args => typeof args[0] === 'string' ? [args[0]] : [])); query.mockRestore(); }
    }, readOnly));
    try {
      await new DashboardService().summary('ADMIN'); expect(statements).toHaveLength(5);
      expect(statements.filter(sql => sql.includes('WITH visible'))).toHaveLength(1);
      expect(spy).toHaveBeenCalledWith(expect.any(Function), true);
    } finally { spy.mockRestore(); }
  });
  it('does not mutate any business data or accounts/sessions on repeated GET requests', async () => {
    for (const role of ['ADMIN'] as const) await get(role);
    expect(await snapshot()).toEqual(fixtureSnapshot);
    await transactions.withPurchaseTransaction(async tx => { expect((await tx.client.query('SHOW transaction_read_only')).rows).toEqual([{ transaction_read_only: 'on' }]); }, true);
  });
});
