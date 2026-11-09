import type { PurchaseTransaction } from '../purchases/purchase-transaction.js';
import type { Activity } from './dashboard.dto.js';
/** Each document branch is capped before line totals/joins; one SQL round-trip. */
export async function dashboardActivity(tx: PurchaseTransaction): Promise<Activity[]> {
  const branches = [
    `SELECT s.id, 'SALE' AS type, COALESCE(s."confirmedAt",s."createdAt") AS "occurredAt", s.reference, COALESCE(s."customerName",'Vente') AS description, (SELECT COALESCE(SUM("lineTotal"),0)::text FROM public."saleLine" WHERE "saleId" = s.id) AS amount, '/sales/' || s.id AS href, s.status FROM (SELECT * FROM public.sale ORDER BY COALESCE("confirmedAt","createdAt") DESC, id DESC LIMIT 10) s`,
    `SELECT p.id, 'CUSTOMER_PAYMENT', p."createdAt", COALESCE(p.reference,s.reference), COALESCE(s."customerName",'Encaissement client'), p.amount::text, '/sales/' || s.id, NULL::text FROM (SELECT * FROM public."salePayment" ORDER BY "createdAt" DESC, id DESC LIMIT 10) p JOIN public.sale s ON s.id = p."saleId"`,
    `SELECT o.id, 'ONLINE_ORDER', COALESCE(o."cancelledAt",o."confirmedAt",o."createdAt"), o.reference, o."customerName", o."totalAmount"::text, '/online-orders/' || o.id, o.status FROM (SELECT * FROM public."onlineOrder" ORDER BY COALESCE("cancelledAt","confirmedAt","createdAt") DESC, id DESC LIMIT 10) o`,
  ];
  branches.push(
    `SELECT p.id, 'PURCHASE', COALESCE(p."confirmedAt",p."createdAt"), p.reference, s.name, (SELECT COALESCE(SUM("lineTotal"),0)::text FROM public."purchaseLine" WHERE "purchaseId" = p.id), '/purchases/' || p.id, p.status FROM (SELECT * FROM public.purchase ORDER BY COALESCE("confirmedAt","createdAt") DESC, id DESC LIMIT 10) p JOIN public.supplier s ON s.id = p."supplierId"`,
    `SELECT e.id, 'EXPENSE', e."createdAt", e.reference, e.description, e.amount::text, '/expenses/' || e.id, NULL::text FROM (SELECT * FROM public.expense ORDER BY "createdAt" DESC, id DESC LIMIT 10) e`,
    `SELECT p.id, 'SUPPLIER_PAYMENT', p."createdAt", COALESCE(p.reference,d.reference), s.name, p.amount::text, '/purchases/' || d.id, NULL::text FROM (SELECT * FROM public."purchasePayment" ORDER BY "createdAt" DESC, id DESC LIMIT 10) p JOIN public.purchase d ON d.id = p."purchaseId" JOIN public.supplier s ON s.id = d."supplierId"`,
  );
  return (await tx.client.query<Activity>(`SELECT * FROM (${branches.join(' UNION ALL ')}) activity ORDER BY "occurredAt" DESC, type, id DESC LIMIT 10`)).rows;
}
