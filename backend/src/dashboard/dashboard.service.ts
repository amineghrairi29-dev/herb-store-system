import { Injectable, ForbiddenException } from '@nestjs/common';
import type { Role } from '../auth/auth-policy.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { businessDate } from '../cash/cash-values.js';
import { readCashSummary } from '../cash/cash-read.js';
import { positiveTypes } from '../stock-movements/stock-decimal.js';
import { stockCatalogue } from '../stock-movements/stock-read.js';
import { dashboardFinance } from './dashboard-finance.js';
import { dashboardActivity } from './dashboard-activity.js';
import type { FullDashboard, PendingOrder, StockAttention } from './dashboard.dto.js';
@Injectable()
export class DashboardService {
  summary(role: Role): Promise<FullDashboard> {
    if (role !== 'ADMIN') throw new ForbiddenException();
    const calendar = businessDate();
    return withPurchaseTransaction(async tx => {
      // One consistent REPEATABLE READ, READ ONLY snapshot; five fixed SELECTs.
      // pg uses one connection per snapshot; await queries instead of queuing concurrent work.
      const finance = await dashboardFinance(tx, calendar.today);
      const cash = await readCashSummary(tx, calendar.today);
      const stock = await tx.client.query<{ outOfStockCount: number; lowStockCount: number; items: StockAttention[] }>(`${stockCatalogue('all')}
          SELECT (SELECT count(*)::int FROM catalogue WHERE "availabilityStatus" = 'OUT_OF_STOCK') AS "outOfStockCount",
          (SELECT count(*)::int FROM catalogue WHERE "availabilityStatus" = 'LOW_STOCK') AS "lowStockCount",
          COALESCE((SELECT jsonb_agg(p ORDER BY rank, name, id) FROM (SELECT id, name, category, "availabilityStatus" AS status, "derivedStock"::text AS stock, "storageUnit" AS unit, CASE WHEN "availabilityStatus" = 'OUT_OF_STOCK' THEN 0 ELSE 1 END AS rank FROM catalogue WHERE "availabilityStatus" <> 'IN_STOCK' ORDER BY rank, name, id LIMIT 5) p), '[]'::jsonb) AS items`, [positiveTypes]);
      const orders = await tx.client.query<{ count: number; items: PendingOrder[] }>(`SELECT (SELECT count(*)::int FROM public."onlineOrder" WHERE status = 'PENDING') AS count,
          COALESCE((SELECT jsonb_agg(o ORDER BY "createdAt" DESC, id DESC) FROM (SELECT id, reference, "customerName", "createdAt", "totalAmount"::text FROM public."onlineOrder" WHERE status = 'PENDING' ORDER BY "createdAt" DESC, id DESC LIMIT 5) o), '[]'::jsonb) AS items`);
      const recentActivity = await dashboardActivity(tx);
      const common = { businessDate: calendar.today, timeZone: calendar.timeZone, alerts: { pendingOnlineOrders: orders.rows[0].count, outOfStockProducts: stock.rows[0].outOfStockCount, lowStockProducts: stock.rows[0].lowStockCount },
        stockAttention: stock.rows[0].items.map(({ id, name, category, status, stock, unit }) => ({ id, name, category, status, stock, unit })), pendingOrders: orders.rows[0].items, recentActivity };
      if (!cash || !finance.balances || !('purchases' in finance.today) || !('expenses' in finance.today)) throw new Error('Résumé opérationnel incomplet.');
      return { ...common, today: finance.today, balances: { ...finance.balances, physicalCash: cash.physicalCashBalance } };
    }, true);
  }
}
