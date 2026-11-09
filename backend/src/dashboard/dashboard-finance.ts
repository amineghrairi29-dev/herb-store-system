import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { moneyString, moneyUnits } from '../purchases/purchase-validation.js';
import { outstandingBalance } from '../finance/finance-values.js';
import { signedMoney } from '../cash/cash-values.js';
const canonical = (value: string) => moneyString(moneyUnits(value));
/** Fixed SQL identifiers; complete owner dashboard totals. */
export async function dashboardFinance(tx: PurchaseTransaction, today: string) {
  const result = await tx.client.query<{ sales: string; customerCollections: string; purchases: string; expenses: string; salesToDate: string; collectionsToDate: string; purchasesToDate: string; supplierPaymentsToDate: string }>(`WITH
    sales AS (SELECT COALESCE(SUM(l."lineTotal") FILTER (WHERE s."saleDate" = $1),0) AS today, COALESCE(SUM(l."lineTotal"),0) AS total FROM public.sale s JOIN public."saleLine" l ON l."saleId" = s.id WHERE s.status = 'CONFIRMED' AND s."saleDate" <= $1),
    collections AS (SELECT COALESCE(SUM(amount) FILTER (WHERE "paymentDate" = $1),0) AS today, COALESCE(SUM(amount),0) AS total FROM public."salePayment" WHERE "paymentDate" <= $1)
    , purchases AS (SELECT COALESCE(SUM(l."lineTotal") FILTER (WHERE p."purchaseDate" = $1),0) AS today, COALESCE(SUM(l."lineTotal"),0) AS total FROM public.purchase p JOIN public."purchaseLine" l ON l."purchaseId" = p.id WHERE p.status = 'CONFIRMED' AND p."purchaseDate" <= $1),
    supplier_payments AS (SELECT COALESCE(SUM(amount),0) AS total FROM public."purchasePayment" WHERE "paymentDate" <= $1),
    expenses AS (SELECT COALESCE(SUM(amount),0) AS today FROM public.expense WHERE "expenseDate" = $1)
    SELECT sales.today::text AS sales, collections.today::text AS "customerCollections"
    , purchases.today::text AS purchases, expenses.today::text AS expenses, sales.total::text AS "salesToDate", collections.total::text AS "collectionsToDate", purchases.total::text AS "purchasesToDate", supplier_payments.total::text AS "supplierPaymentsToDate"
    FROM sales CROSS JOIN collections CROSS JOIN purchases CROSS JOIN supplier_payments CROSS JOIN expenses`, [today]);
  const row = result.rows[0];
  const common = { sales: canonical(row.sales), customerCollections: canonical(row.customerCollections) };
  return { today: { ...common, purchases: canonical(row.purchases), expenses: canonical(row.expenses) }, balances: {
    customerReceivables: signedMoney(outstandingBalance(moneyUnits(row.salesToDate), moneyUnits(row.collectionsToDate))),
    supplierPayables: signedMoney(outstandingBalance(moneyUnits(row.purchasesToDate), moneyUnits(row.supplierPaymentsToDate))),
  } };
}
