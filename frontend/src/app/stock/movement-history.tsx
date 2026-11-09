"use client";
import { useState } from "react";
import Link from "@/components/auth-link";
import type { ProductDetails } from "@/types/product";
import { emptyMovementFilters, filterMovements, movementLabels, movementTime, type StockMovement } from "@/lib/stock-view";
import { isNegativeMovement } from "./movement-config";
import { controlClass } from "./stock-ui";

export default function MovementHistory({ products, movements, filterable = true }: { products: ProductDetails[]; movements: StockMovement[]; filterable?: boolean }) {
  const [filters, setFilters] = useState(emptyMovementFilters);
  const rows = filterMovements(movements, filters);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const invalidRange = filters.from && filters.to && filters.from > filters.to;
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {filterable && <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-5">
      <label className="flex flex-col gap-2 text-sm font-medium">Produit<select value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })} className={controlClass}><option value="">Tous les produits</option>{[...products].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((product) => <option key={product.id} value={product.id} dir="auto">{product.name} — {product.sku}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Type de mouvement<select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })} className={controlClass}><option value="">Tous les types</option>{Object.entries(movementLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Date du<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} className={controlClass} /></label>
      <label className="flex flex-col gap-2 text-sm font-medium">Date au<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} className={controlClass} /></label>
      <button type="button" onClick={() => setFilters(emptyMovementFilters)} className={`${controlClass} self-end font-semibold hover:bg-slate-50`}>Réinitialiser les filtres</button>
      <p className="text-xs text-slate-500 sm:col-span-2 lg:col-span-5">Dates inclusives, dans votre fuseau horaire local. {rows.length} mouvement(s).</p>
      {invalidRange && <p role="alert" className="text-sm text-red-800 sm:col-span-2 lg:col-span-5">La date de fin doit être supérieure ou égale à la date de début.</p>}
    </div>}
    {rows.length === 0 ? <p role="status" className="px-6 py-16 text-center text-sm text-slate-600">Aucun mouvement de stock</p> : <div role="region" aria-label="Historique des mouvements, défilement horizontal disponible" tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-emerald-700">
      <table className="w-full min-w-[1150px] text-left text-sm">
        <caption className="sr-only">Mouvements de stock, du plus récent au plus ancien</caption>
        <thead className="bg-slate-50 text-xs text-slate-600"><tr>{["Date", "Produit", "SKU", "Type", "Quantité", "Unité", "Quantité en unité de stockage", "Motif", "Référence"].map((label) => <th key={label} scope="col" className="px-4 py-4 font-semibold">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{rows.map((movement) => {
          const product = productMap.get(movement.productId);
          const date = new Date(movementTime(movement.createdAt));
          return <tr key={movement.id} className="hover:bg-slate-50/80">
            <td className="whitespace-nowrap px-4 py-4"><time dateTime={date.toISOString()}>{date.toLocaleString("fr-FR")}</time></td>
            <th scope="row" className="max-w-56 break-words px-4 py-4 font-medium"><Link href={`/stock/products/${movement.productId}`} className="text-emerald-800 hover:underline"><bdi dir="auto">{product?.name ?? `Produit #${movement.productId}`}</bdi></Link></th>
            <td className="px-4 py-4 font-mono text-xs"><bdi>{product?.sku ?? "—"}</bdi></td>
            <td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${isNegativeMovement(movement.type) ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>{movementLabels[movement.type]}</span></td>
            <td className="px-4 py-4 tabular-nums">{movement.quantity.replace(".", ",")}</td><td className="px-4 py-4">{movement.unit}</td>
            <td className="whitespace-nowrap px-4 py-4 tabular-nums">{movement.quantityInStorageUnit.replace(".", ",")} {product?.storageUnit ?? ""}</td>
            <td className="max-w-64 break-words px-4 py-4"><bdi dir="auto">{movement.reason || "—"}</bdi></td>
            <td className="max-w-48 break-words px-4 py-4"><bdi dir="auto">{movement.reference || "—"}</bdi></td>
          </tr>;
        })}</tbody>
      </table>
    </div>}
  </section>;
}
