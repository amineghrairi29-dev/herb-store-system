"use client";
import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { isProduct, type Product } from "@/types/product";
import { isSupplier, type Supplier } from "@/types/supplier";
import type { Purchase, PurchaseInput } from "@/types/purchase";
import { purchaseError, purchaseRequest, readPurchase } from "@/lib/purchase-api";
import { displayAmount, previewSubtotal, previewTotal, purchaseDecimal } from "@/lib/purchase-decimal";
import { buttonClass, inputClass, secondaryClass, PurchaseError, PurchaseShell } from "./purchase-ui";

interface FormDataSource { products: Product[]; suppliers: Supplier[]; purchase?: Purchase }
interface DraftLine { key: number; productId: string; quantity: string; unit: string; unitPurchasePrice: string }
export default function PurchaseForm({ id }: { id?: string }) {
  const [data, setData] = useState<FormDataSource | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    Promise.all([purchaseRequest("/products", { signal }), purchaseRequest("/suppliers", { signal }), id ? purchaseRequest(`/purchases/${encodeURIComponent(id)}`, { signal }) : Promise.resolve(undefined)])
      .then(([products, suppliers, purchase]) => {
        if (controller.signal.aborted) return;
        if (!Array.isArray(products) || !products.every(isProduct) || !Array.isArray(suppliers) || !suppliers.every(isSupplier)) throw new Error("Données produits ou fournisseurs invalides.");
        setData({ products, suppliers, purchase: purchase === undefined ? undefined : readPurchase(purchase) });
      }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(purchaseError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <PurchaseShell title={id ? "Modifier l’achat" : "Nouvel achat"}>
    {error ? <PurchaseError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /> : !data ? <p role="status">Chargement...</p> : data.purchase && data.purchase.status !== "DRAFT" ? <div className="rounded-xl border border-slate-200 bg-white p-6"><p>Cet achat est en lecture seule.</p><Link href={`/purchases/${data.purchase.id}`} className="mt-4 inline-block font-semibold text-emerald-800">Voir l’achat</Link></div> : <LoadedPurchaseForm {...data} />}
    {(!data || error) && <Link href="/purchases" className={secondaryClass}>Annuler</Link>}
  </PurchaseShell>;
}
function LoadedPurchaseForm({ products, suppliers, purchase }: FormDataSource) {
  const [reference, setReference] = useState(purchase?.reference ?? "");
  const [supplierId, setSupplierId] = useState(purchase?.supplierId.toString() ?? "");
  const today = new Date();
  const [date, setDate] = useState(purchase?.purchaseDate ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`);
  const [notes, setNotes] = useState(purchase?.notes ?? "");
  const [lines, setLines] = useState<DraftLine[]>(purchase?.lines.map((line, key) => ({ key, productId: String(line.productId), quantity: line.quantity, unit: line.unit, unitPurchasePrice: line.unitPurchasePrice })) ?? [{ key: 0, productId: "", quantity: "", unit: "", unitPurchasePrice: "" }]);
  const nextKey = useRef(lines.length), pending = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const totals = lines.map((line) => previewSubtotal(line.quantity, line.unitPurchasePrice));
  const total = previewTotal(totals);
  const activeSuppliers = suppliers.filter((supplier) => supplier.isActive || String(supplier.id) === supplierId);
  function change(key: number, update: Partial<DraftLine>) { setLines((rows) => rows.map((row) => row.key === key ? { ...row, ...update } : row)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    setError(null);
    const supplier = suppliers.find((item) => String(item.id) === supplierId);
    if (!reference.trim() || !supplier?.isActive || !date || lines.length === 0) { setError("Renseignez une référence, un fournisseur actif, une date et au moins une ligne."); return; }
    const prepared: PurchaseInput["lines"] = [];
    for (const line of lines) {
      const product = products.find((item) => String(item.id) === line.productId);
      const quantity = purchaseDecimal(line.quantity), unitPurchasePrice = purchaseDecimal(line.unitPurchasePrice);
      if (!product || !quantity || !unitPurchasePrice || ![product.storageUnit, product.saleUnit].includes(line.unit)) { setError("Chaque ligne requiert un produit, une unité compatible, une quantité et un prix positifs (18 décimales maximum)."); return; }
      if (prepared.some((item) => item.productId === product.id)) { setError("Un produit ne peut apparaître que sur une seule ligne."); return; }
      prepared.push({ productId: product.id, quantity, unit: line.unit, unitPurchasePrice });
    }
    const input: PurchaseInput = { reference: reference.trim(), supplierId: supplier.id, purchaseDate: date, notes: notes.trim() || null, lines: prepared };
    pending.current = true; setSaving(true);
    try {
      const saved = readPurchase(await purchaseRequest(purchase ? `/purchases/${purchase.id}` : "/purchases", { method: purchase ? "PATCH" : "POST", body: JSON.stringify(input) }));
      window.location.replace(`/purchases/${saved.id}`);
    } catch (cause: unknown) { setError(purchaseError(cause)); pending.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} aria-busy={saving} className="space-y-6">
    <p className="text-sm text-slate-600">L’enregistrement crée un brouillon. Le stock sera augmenté uniquement après confirmation.</p>
    <fieldset disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><legend className="px-2 text-lg font-semibold">Informations achat</legend>
      <div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-medium">Référence *<input required dir="auto" value={reference} onChange={(event) => setReference(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium">Fournisseur *<select required value={supplierId} onChange={(event) => setSupplierId(event.target.value)} className={inputClass}><option value="">Sélectionner un fournisseur</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id} disabled={!supplier.isActive} dir="auto">{supplier.code} — {supplier.name}{!supplier.isActive ? " (Inactif)" : ""}</option>)}</select></label>
        <label className="text-sm font-medium">Date d’achat *<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label>
        <label className="text-sm font-medium sm:col-span-2">Notes<textarea dir="auto" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} className={inputClass} /></label></div>
      {!suppliers.some((supplier) => supplier.isActive) && <p className="mt-4 text-sm text-amber-800">Aucun fournisseur actif disponible. <Link href="/suppliers/new" className="underline">Ajouter un fournisseur</Link></p>}
    </fieldset>
    <fieldset disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><legend className="px-2 text-lg font-semibold">Lignes d’achat</legend>
      <p className="mb-5 text-sm text-slate-600">Le prix unitaire est exprimé en DT par unité sélectionnée (ex. 0,020 DT/G). Les sous-totaux sont des aperçus ; le serveur calcule les montants enregistrés.</p>
      <div className="space-y-5">{lines.map((line, index) => {
        const product = products.find((item) => String(item.id) === line.productId);
        const units = product ? [...new Set([product.storageUnit, product.saleUnit])] : [];
        return <div key={line.key} className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Ligne {index + 1}</h3><button type="button" disabled={lines.length <= 1} onClick={() => setLines((rows) => rows.filter((row) => row.key !== line.key))} className="text-sm font-semibold text-red-700 disabled:opacity-40" aria-label={`Retirer la ligne ${index + 1}`}>Retirer</button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium">Produit *<select required value={line.productId} onChange={(event) => { const selected = products.find((item) => String(item.id) === event.target.value); change(line.key, { productId: event.target.value, unit: selected?.storageUnit ?? "" }); }} className={inputClass}><option value="">Sélectionner un produit</option>{products.map((item) => <option key={item.id} value={item.id} disabled={lines.some((row) => row.key !== line.key && row.productId === String(item.id))} dir="auto">{item.sku} — {item.name}</option>)}</select></label>
            <label className="text-sm font-medium">Quantité *<input required inputMode="decimal" value={line.quantity} onChange={(event) => change(line.key, { quantity: event.target.value })} className={inputClass} /></label>
            <label className="text-sm font-medium">Unité *<select required value={line.unit} onChange={(event) => change(line.key, { unit: event.target.value })} className={inputClass}><option value="">Choisir une unité</option>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
            <label className="text-sm font-medium">Prix d’achat unitaire{line.unit ? ` (DT/${line.unit})` : ""} *<input required inputMode="decimal" value={line.unitPurchasePrice} onChange={(event) => change(line.key, { unitPurchasePrice: event.target.value })} className={inputClass} /></label></div>
          <p className="mt-4 break-words text-right text-sm font-semibold">Sous-total : {totals[index] === null ? "—" : `${displayAmount(totals[index])} DT`}</p>
        </div>;
      })}</div>
      <button type="button" className={`${secondaryClass} mt-5`} onClick={() => setLines((rows) => [...rows, { key: nextKey.current++, productId: "", quantity: "", unit: "", unitPurchasePrice: "" }])}>Ajouter une ligne</button>
      <p className="mt-6 break-words text-right text-lg font-semibold">Total achat : {total === null ? "—" : `${displayAmount(total)} DT`}</p>
    </fieldset>
    {error && <PurchaseError error={error} />}
    <div className="flex flex-wrap justify-end gap-3">{saving ? <button disabled className={secondaryClass}>Annuler</button> : <Link href="/purchases" className={secondaryClass}>Annuler</Link>}<button type="submit" disabled={saving} className={buttonClass}>{saving ? "Enregistrement..." : "Enregistrer le brouillon"}</button></div>
  </form>;
}
