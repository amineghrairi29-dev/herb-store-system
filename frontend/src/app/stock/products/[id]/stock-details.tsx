"use client";
import { useCallback } from "react";
import Link from "@/components/auth-link";
import { loadStockDetails } from "@/lib/stock-read";
import { emptyMovementFilters, filterMovements, stockStatus } from "@/lib/stock-view";
import { useStockLoad } from "../../use-stock-load";
import { controlClass, LoadFeedback, StatusBadge } from "../../stock-ui";
import MovementHistory from "../../movement-history";
export default function StockDetails({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => loadStockDetails(id, signal), [id]);
  const { state, reload } = useStockLoad(load);
  if (state.status !== "success") return <LoadFeedback state={state} reload={reload} />;
  const { product, balance, movements } = state.data;
  const recent = filterMovements(movements, emptyMovementFilters).slice(0, 20);
  return <>
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-2xl font-semibold"><bdi dir="auto">{product.name}</bdi></h2><button type="button" onClick={reload} className={controlClass}>Actualiser</button></div>
      <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["SKU", product.sku], ["Catégorie", product.category], ["Stock actuel", `${balance.stock.replace(".", ",")} ${balance.unit}`],
          ["Unité de stockage", balance.unit], ["Stock minimum", product.minStock === null ? "—" : `${product.minStock.replace(".", ",")} ${balance.unit}`],
          ["Stock maximum", product.maxStock === null ? "—" : `${product.maxStock.replace(".", ",")} ${balance.unit}`], ["Emplacement", product.location || "—"],
        ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-2 break-words font-medium"><bdi dir="auto">{value}</bdi></dd></div>)}
        <div><dt className="text-xs text-slate-500">Statut</dt><dd className="mt-2"><StatusBadge status={stockStatus(balance.stock, product.minStock)} /></dd></div>
      </dl>
    </section>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">20 derniers mouvements</h2><Link href="/stock/movements" className="text-sm font-semibold text-emerald-800 hover:underline">Historique complet</Link></div>
    <MovementHistory products={[product]} movements={recent} filterable={false} />
  </>;
}
