"use client";
import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isProductDetails, type ProductDetails } from "@/types/product";
import type { Sale, SaleInput } from "@/types/sale";
import { readSale, saleError, saleRequest } from "@/lib/sale-api";
import { displayAmount, previewSubtotal, previewTotal, purchaseDecimal as saleDecimal } from "@/lib/purchase-decimal";
import { suggestedSalePrice } from "@/lib/sale-price";
import { buttonClass, inputClass, secondaryClass, SaleError, SaleShell } from "./sale-ui";
import ProductStock from "./product-stock";

interface FormDataSource { products: ProductDetails[]; sale?: Sale }
interface DraftLine { key: number; productId: string; quantity: string; unit: string; unitSalePrice: string }
export default function SaleForm({ id }: { id?: string }) {
  const [data, setData] = useState<FormDataSource | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    Promise.all([saleRequest("/products", { signal }), id ? saleRequest(`/sales/${encodeURIComponent(id)}`, { signal }) : Promise.resolve(undefined)]).then(([products, sale]) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(products) || !products.every(isProductDetails)) throw new Error("Données produits invalides.");
      setData({ products, sale: sale === undefined ? undefined : readSale(sale) });
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(saleError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <SaleShell title={id ? "Modifier la vente" : "Nouvelle vente"}>
    {error ? <SaleError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /> : !data ? <p role="status">Chargement...</p> : data.sale && data.sale.status !== "DRAFT" ? <div className="rounded-xl border border-slate-200 bg-white p-6"><p>Cette vente est en lecture seule.</p><Link href={`/sales/${data.sale.id}`} className="mt-4 inline-block font-semibold text-emerald-800">Voir la vente</Link></div> : <LoadedSaleForm {...data} />}
    {(!data || error) && <Link href="/sales" className={secondaryClass}>Annuler</Link>}
  </SaleShell>;
}
function LoadedSaleForm({ products, sale }: FormDataSource) {
  const [reference, setReference] = useState(sale?.reference ?? ""), [customerName, setCustomerName] = useState(sale?.customerName ?? ""), [customerPhone, setCustomerPhone] = useState(sale?.customerPhone ?? "");
  const today = new Date();
  const [date, setDate] = useState(sale?.saleDate ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`), [notes, setNotes] = useState(sale?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(sale?.lines.map((line, key) => ({ key, productId: String(line.productId), quantity: line.quantity, unit: line.unit, unitSalePrice: line.unitSalePrice })) ?? [{ key: 0, productId: "", quantity: "", unit: "", unitSalePrice: "" }]);
  const nextKey = useRef(lines.length), pending = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const totals = lines.map((line) => previewSubtotal(line.quantity, line.unitSalePrice)), total = previewTotal(totals);
  function change(key: number, update: Partial<DraftLine>) { setLines((rows) => rows.map((row) => row.key === key ? { ...row, ...update } : row)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    setError(null);
    if (!reference.trim() || !date || !lines.length) { setError("Renseignez une référence, une date et au moins une ligne."); return; }
    const prepared: SaleInput["lines"] = [];
    for (const line of lines) {
      const product = products.find((item) => String(item.id) === line.productId), quantity = saleDecimal(line.quantity), unitSalePrice = saleDecimal(line.unitSalePrice);
      if (!product?.isActive || !product.isSellable || !quantity || !unitSalePrice || ![product.storageUnit, product.saleUnit].includes(line.unit)) { setError("Chaque ligne requiert un produit actif et vendable, une unité compatible, une quantité et un prix positifs (18 décimales maximum)."); return; }
      if (prepared.some((item) => item.productId === product.id)) { setError("Un produit ne peut apparaître que sur une seule ligne."); return; }
      prepared.push({ productId: product.id, quantity, unit: line.unit, unitSalePrice });
    }
    const input: SaleInput = { reference: reference.trim(), saleDate: date, customerName: customerName.trim() || null, customerPhone: customerPhone.trim() || null, notes: notes.trim() || null, lines: prepared };
    pending.current = true; setSaving(true);
    try {
      const saved = readSale(await saleRequest(sale ? `/sales/${sale.id}` : "/sales", { method: sale ? "PATCH" : "POST", body: JSON.stringify(input) }));
      window.location.replace(`/sales/${saved.id}`);
    } catch (cause: unknown) { setError(saleError(cause)); pending.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} aria-busy={saving} className="space-y-6">
    <p className="text-sm text-slate-600">Le brouillon ne modifie pas le stock. Les quantités seront déduites uniquement après confirmation.</p>
    <fieldset disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><legend className="px-2 text-lg font-semibold">Informations vente</legend>
      <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Référence *<input required dir="auto" value={reference} onChange={(event) => setReference(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium">Date de vente *<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium">Nom client<input dir="auto" value={customerName} onChange={(event) => setCustomerName(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium">Téléphone client<input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium sm:col-span-2">Notes<textarea dir="auto" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></label></div>
    </fieldset>
    <fieldset disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><legend className="px-2 text-lg font-semibold">Lignes de vente</legend>
      <p className="mb-5 text-sm text-slate-600">Le prix de référence correspond à l’unité de vente. Changer d’unité remplace le prix par la suggestion correspondante, convertie exactement pour l’unité de stockage. Vous pouvez modifier ce prix. Les totaux sont des aperçus.</p>
      {!products.some((product) => product.isActive && product.isSellable) && <p className="mb-5 text-sm text-amber-800">Aucun produit actif et vendable disponible.</p>}
      <div className="space-y-5">{lines.map((line, index) => {
        const product = products.find((item) => String(item.id) === line.productId), units = product ? [...new Set([product.saleUnit, product.storageUnit])] : [];
        return <div key={line.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Ligne {index + 1}</h3><button type="button" disabled={lines.length <= 1} onClick={() => setLines((rows) => rows.filter((row) => row.key !== line.key))} className="text-sm font-semibold text-red-700 disabled:opacity-40" aria-label={`Retirer la ligne ${index + 1}`}>Retirer</button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Produit *<select required value={line.productId} onChange={(event) => { const selected = products.find((item) => String(item.id) === event.target.value); change(line.key, { productId: event.target.value, unit: selected?.saleUnit ?? "", unitSalePrice: selected ? suggestedSalePrice(selected, selected.saleUnit) ?? "" : "" }); }} className={inputClass}><option value="">Sélectionner un produit</option>{products.filter((item) => (item.isActive && item.isSellable) || String(item.id) === line.productId).map((item) => <option key={item.id} value={item.id} disabled={!item.isActive || !item.isSellable || lines.some((row) => row.key !== line.key && row.productId === String(item.id))} dir="auto">{item.sku} — {item.name}{!item.isActive || !item.isSellable ? " (indisponible)" : ""}</option>)}</select></label>
            <label className="text-sm font-medium">Quantité *<input required inputMode="decimal" value={line.quantity} onChange={(event) => change(line.key, { quantity: event.target.value })} className={inputClass} /></label>
            <label className="text-sm font-medium">Unité *<select required value={line.unit} onChange={(event) => change(line.key, { unit: event.target.value, unitSalePrice: product ? suggestedSalePrice(product, event.target.value) ?? "" : "" })} className={inputClass}><option value="">Choisir une unité</option>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label className="text-sm font-medium">Prix de vente unitaire{line.unit ? ` (DT/${line.unit})` : ""} *<input required inputMode="decimal" value={line.unitSalePrice} onChange={(event) => change(line.key, { unitSalePrice: event.target.value })} className={inputClass} /></label></div>
          {product && suggestedSalePrice(product, line.unit) === null && <p className="mt-3 text-sm text-amber-800">Aucun prix exact compatible ne peut être proposé pour cette unité. Saisissez explicitement le prix unitaire.</p>}
          {product && <ProductStock key={product.id} id={product.id} />}
          <p className="mt-4 break-words text-right text-sm font-semibold">Sous-total : {totals[index] === null ? "—" : `${displayAmount(totals[index])} DT`}</p>
        </div>;
      })}</div>
      <button type="button" className={`${secondaryClass} mt-5`} onClick={() => { const key = nextKey.current++; setLines((rows) => [...rows, { key, productId: "", quantity: "", unit: "", unitSalePrice: "" }]); }}>Ajouter une ligne</button>
      <p className="mt-6 break-words text-right text-lg font-semibold">Total vente : {total === null ? "—" : `${displayAmount(total)} DT`}</p>
    </fieldset>
    {error && <SaleError error={error} />}
    <div className="flex flex-wrap justify-end gap-3">{saving ? <button disabled className={secondaryClass}>Annuler</button> : <Link href="/sales" className={secondaryClass}>Annuler</Link>}<button type="submit" disabled={saving} className={buttonClass}>{saving ? "Enregistrement..." : "Enregistrer le brouillon"}</button></div>
  </form>;
}
