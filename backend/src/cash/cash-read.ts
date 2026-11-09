import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';
import { summarizeCash } from './cash-values.js';
/** At most 20 grouped rows; preserves Caisse's all-record current balance and today flows. */
export async function readCashSummary(tx: PurchaseTransaction, today: string) {
  const rows = await tx.client.query<{ amount: string; type: string; paymentMethod: string; movementDate: string }>(`SELECT SUM(amount)::text AS amount, type, "paymentMethod", CASE WHEN "movementDate" = $1 THEN $1 ELSE '' END AS "movementDate"
    FROM public."cashMovement" GROUP BY type, "paymentMethod", CASE WHEN "movementDate" = $1 THEN $1 ELSE '' END`, [today]);
  return summarizeCash(rows.rows, today);
}
