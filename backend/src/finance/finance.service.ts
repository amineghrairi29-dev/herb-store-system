import { Injectable } from '@nestjs/common';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { financePeriod, summarizeFinance } from './finance-values.js';
@Injectable()
export class FinanceService {
  summary(query: Record<string, unknown>) {
    const period = financePeriod(query);
    return withPurchaseTransaction(async (tx) => {
      // Eight bulk reads in one consistent READ ONLY snapshot; no document-by-document queries.
      const [sales, saleLines, purchases, purchaseLines, salePayments, purchasePayments, expenses, movements] = await Promise.all([
        tx.orm.public.Sale.select('id', 'status', 'saleDate').all(), tx.orm.public.SaleLine.select('saleId', 'lineTotal').all(),
        tx.orm.public.Purchase.select('id', 'status', 'purchaseDate').all(), tx.orm.public.PurchaseLine.select('purchaseId', 'lineTotal').all(),
        tx.orm.public.SalePayment.select('amount', 'paymentDate').all(), tx.orm.public.PurchasePayment.select('amount', 'paymentDate').all(),
        tx.orm.public.Expense.select('amount', 'expenseDate').all(), tx.orm.public.CashMovement.all(),
      ]);
      return summarizeFinance({ sales, saleLines, purchases, purchaseLines, salePayments, purchasePayments, expenses, movements }, period);
    }, true);
  }
}
