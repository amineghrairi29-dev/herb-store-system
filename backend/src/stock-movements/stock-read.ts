/** Shared bulk stock/status query. $1 is always the authoritative positiveTypes array. */
export function stockCatalogue(scope: 'public' | 'all') {
  const filter = scope === 'public' ? 'WHERE "isActive" = true AND "isSellable" = true AND "isVisibleOnline" = true AND EXISTS (SELECT 1 FROM public."productClassification" pc JOIN public.classification c ON c.id=pc."classificationId" WHERE pc."productId"=product.id AND c."isActive")' : '';
  return `WITH visible AS (SELECT * FROM public.product ${filter}),
 balances AS (SELECT m."productId", SUM(CASE WHEN m.type = ANY($1::text[]) THEN m."quantityInStorageUnit" ELSE -m."quantityInStorageUnit" END) AS stock
 FROM public."stockMovement" m JOIN visible p ON p.id = m."productId" GROUP BY m."productId"),
 catalogue AS (SELECT p.*, COALESCE(b.stock, 0) AS "derivedStock", CASE WHEN COALESCE(b.stock, 0) <= 0 THEN 'OUT_OF_STOCK'
 WHEN p."minStock" IS NOT NULL AND b.stock <= p."minStock" THEN 'LOW_STOCK' ELSE 'IN_STOCK' END AS "availabilityStatus"
 FROM visible p LEFT JOIN balances b ON b."productId" = p.id)`;
}
