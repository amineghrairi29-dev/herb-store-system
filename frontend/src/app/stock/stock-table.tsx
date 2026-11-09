"use client";

import { useState } from "react";
import Link from "@/components/auth-link";
import { loadOverview } from "@/lib/stock-read";
import { filterStock, stockStatus, stockSummary } from "@/lib/stock-view";
import { useStockLoad } from "./use-stock-load";
import { controlClass, LoadFeedback, StatusBadge, StockActions } from "./stock-ui";

export default function StockTable() {
  const { state, reload } = useStockLoad(loadOverview);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  if (state.status !== "success") return <><StockActions /><LoadFeedback state={state} reload={reload} /></>;
  const { rows, movements, asOf } = state.data;
  const summary = stockSummary(rows, movements, asOf);
  const visible = filterStock(rows, search, status);
  return <>
    <section aria-label="Résumé du stock" className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Total produits", summary.total],
        ["Produits en stock faible", summary.low],
        ["Produits en rupture", summary.empty],
        ["Total mouvements récents", summary.recent],
      ].map(([label, count]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-600">{label}</p><p className="mt-3 text-3xl font-semibold tabular-nums">{count}</p>{label === "Total mouvements récents" && <p className="mt-2 text-xs text-slate-500">7 derniers jours (168 heures)</p>}</div>)}
    </section>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500"><p>Données chargées le {new Date(asOf).toLocaleString("fr-FR")}. Les indicateurs portent sur tous les produits.</p><button type="button" onClick={reload} className={controlClass}>Actualiser</button></div>
    <StockActions />
    <section aria-label="Stocks des produits" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <h2 className="border-b border-slate-200 px-6 py-5 font-semibold">État du stock</h2>
      <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium">Rechercher un produit ou SKU<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={controlClass} /></label>
        <label className="flex flex-col gap-2 text-sm font-medium">Statut<select value={status} onChange={(event) => setStatus(event.target.value)} className={controlClass}><option value="">Tous les statuts</option>{["Rupture", "Stock faible", "Normal"].map((label) => <option key={label}>{label}</option>)}</select></label>
        <button type="button" onClick={() => { setSearch(""); setStatus(""); }} className={controlClass}>Réinitialiser</button>
      </div>
      <p role="status" className="px-5 py-3 text-xs text-slate-500">{visible.length} produit(s) affiché(s). Priorité aux ruptures, puis aux stocks faibles.</p>
      {visible.length === 0 ? <p className="px-6 py-16 text-center text-sm text-slate-600">{rows.length === 0 ? "Aucun produit disponible" : "Aucun produit ne correspond aux filtres"}</p> : <div tabIndex={0} role="region" aria-label="Tableau du stock, défilement horizontal disponible" className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-700">
        <table className="w-full min-w-[1050px] text-left text-sm">
          <caption className="sr-only">Quantités et seuils exprimés en unité de stockage</caption>
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Produit", "SKU", "Catégorie", "Stock actuel", "Unité de stockage", "Stock minimum", "Emplacement", "Statut", "Actions"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-5 py-4 font-semibold">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{visible.map(({ product, balance }) => <tr key={product.id} className="hover:bg-slate-50/80">
            <th scope="row" className="max-w-56 break-words px-5 py-5 font-semibold"><bdi dir="auto">{product.name}</bdi></th>
            <td className="px-5 py-5 font-mono text-xs text-slate-500"><bdi>{product.sku}</bdi></td>
            <td className="max-w-48 break-words px-5 py-5"><bdi dir="auto">{product.category}</bdi></td>
            <td className="whitespace-nowrap px-5 py-5 font-semibold tabular-nums">{balance.stock.replace(".", ",")}</td>
            <td className="px-5 py-5">{balance.unit}</td>
            <td className="px-5 py-5 tabular-nums">{product.minStock?.replace(".", ",") ?? "—"}</td>
            <td className="max-w-48 break-words px-5 py-5"><bdi dir="auto">{product.location || "—"}</bdi></td>
            <td className="px-5 py-5"><StatusBadge status={stockStatus(balance.stock, product.minStock)} /></td>
            <td className="px-5 py-5"><Link href={`/stock/products/${product.id}`} aria-label={`Voir le stock de ${product.name}`} className="rounded-md px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">Détails</Link></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>
  </>;
}
