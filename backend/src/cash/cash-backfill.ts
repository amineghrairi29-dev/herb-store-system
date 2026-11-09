import type { Client } from 'pg';

/** Caller owns a transaction. Optional IDs limit automated tests to their fixtures. */
export async function backfillCash(client: Client, apply: boolean, scope?: { salePaymentIds: number[]; purchasePaymentIds: number[] }) {
  if (apply) await client.query('LOCK TABLE public."salePayment", public."purchasePayment" IN SHARE ROW EXCLUSIVE MODE');
  const result: Record<string, { payments: number; missing: number; inserted: number }> = {};
  for (const sale of [true, false]) {
    const sourceType = sale ? 'SALE_PAYMENT' : 'PURCHASE_PAYMENT';
    const paymentTable = sale ? 'salePayment' : 'purchasePayment', parentTable = sale ? 'sale' : 'purchase';
    const parentId = sale ? 'saleId' : 'purchaseId', linkId = sale ? 'salePaymentId' : 'purchasePaymentId';
    const ids = scope ? (sale ? scope.salePaymentIds : scope.purchasePaymentIds) : undefined;
    const params = ids ? [ids] : [];
    // Identifiers and SQL literals below come only from the fixed branches above.
    const expected = `SELECT p.id, p.amount, p."paymentMethod", p."paymentDate", COALESCE(NULLIF(p.reference, ''), d.reference) AS reference, p.notes, p."createdAt" FROM public."${paymentTable}" p JOIN public.${parentTable} d ON d.id = p."${parentId}" ${ids ? 'WHERE p.id = ANY($1::int[])' : ''}`;
    const counts = await client.query<{ payments: number; missing: number; inconsistent: number }>(`WITH expected AS (${expected}) SELECT count(*)::int AS payments, count(*) FILTER (WHERE c.id IS NULL)::int AS missing, count(*) FILTER (WHERE c.id IS NOT NULL AND (c.amount IS DISTINCT FROM e.amount OR c."paymentMethod" IS DISTINCT FROM e."paymentMethod" OR c."movementDate" IS DISTINCT FROM e."paymentDate" OR c.reference IS DISTINCT FROM e.reference OR c.notes IS DISTINCT FROM e.notes))::int AS inconsistent FROM expected e LEFT JOIN public."cashMovement" c ON c."sourceType" = '${sourceType}' AND c."sourceId" = e.id`, params);
    const count = counts.rows[0];
    if (count.inconsistent) throw new Error(`Existing ${sourceType} cash links have inconsistent values; review before backfill.`);
    let inserted = 0;
    if (apply) {
      const insertedRows = await client.query(`WITH expected AS (${expected}) INSERT INTO public."cashMovement" (type, "sourceType", "sourceId", "${linkId}", amount, "paymentMethod", "movementDate", reference, description, notes, "createdAt") SELECT '${sale ? 'IN' : 'OUT'}', '${sourceType}', e.id, e.id, e.amount, e."paymentMethod", e."paymentDate", e.reference, '${sale ? 'Paiement vente' : 'Paiement fournisseur'}', e.notes, e."createdAt" FROM expected e ON CONFLICT ("sourceType", "sourceId") DO NOTHING`, params);
      inserted = insertedRows.rowCount ?? 0;
    }
    result[sourceType] = { payments: count.payments, missing: count.missing, inserted };
  }
  return result;
}
