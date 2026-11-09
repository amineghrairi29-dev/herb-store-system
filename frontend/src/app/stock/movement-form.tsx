"use client";

import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ProductDetails } from "@/types/product";
import { compareDecimals, normalizeDecimal } from "@/lib/decimal";
import { productStock, StockApiError, stockError, stockProducts, stockRequest, type ProductStock } from "@/lib/stock-api";
import { isNegativeMovement, type MovementConfig, type MovementType } from "./movement-config";

type LoadState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; products: ProductDetails[] };
type BalanceState = { status: "loading" } | { status: "error"; message: string } | { status: "success"; balance: ProductStock };
interface CreateMovementInput {
  productId: number; type: MovementType; quantity: string; unit: string;
  reason?: string; reference?: string; notes?: string;
}
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-2 focus:outline-emerald-700";

export default function MovementForm({ type, title, submitLabel, showCurrentStock, helperText }: Pick<MovementConfig, "type" | "title" | "submitLabel" | "showCurrentStock" | "helperText">) {
  const isNegative = isNegativeMovement(type);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState("");
  const [unit, setUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [balance, setBalance] = useState<BalanceState>({ status: "loading" });
  const [balanceAttempt, setBalanceAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    void stockProducts(signal).then((products) => {
      if (!controller.signal.aborted) setState({ status: "success", products });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setState({ status: "error", message: stockError(cause) });
    });
    return () => controller.abort();
  }, [attempt]);

  const selected = state.status === "success" ? state.products.find((product) => String(product.id) === selectedId) : undefined;
  const units = selected ? [...new Set([selected.storageUnit, selected.saleUnit])] : [];
  const productId = selected?.id;
  useEffect(() => {
    if (!showCurrentStock || productId === undefined) return;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
    void productStock(productId, signal).then((value) => {
      if (!controller.signal.aborted) setBalance({ status: "success", balance: value });
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) setBalance({ status: "error", message: stockError(cause) });
    });
    return () => controller.abort();
  }, [showCurrentStock, productId, balanceAttempt]);
  const balanceReady = balance.status === "success" && balance.balance.productId === productId;

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const values = new FormData(event.currentTarget);
    const quantity = normalizeDecimal(String(values.get("quantity") ?? ""));
    if (!selected || !units.includes(unit)) { showError("Veuillez sélectionner un produit et une unité compatible."); return; }
    if (showCurrentStock && !balanceReady) { showError("Veuillez attendre le chargement du stock actuel ou réessayer."); return; }
    if (quantity === null || compareDecimals(quantity, "0.000") <= 0) { showError("La quantité doit être un nombre décimal supérieur à 0."); return; }
    if (!/^\d{1,60}\.\d{1,18}$/.test(quantity)) { showError("La quantité peut contenir au maximum 60 chiffres entiers et 18 décimales."); return; }
    const input: CreateMovementInput = { productId: selected.id, type, quantity, unit };
    for (const field of ["reason", "reference", "notes"] as const) {
      const value = String(values.get(field) ?? "").trim();
      if (value) input[field] = value;
    }
    pending.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await stockRequest("/stock-movements", {
        method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(input),
      });
      window.location.replace("/stock");
    } catch (cause: unknown) {
      if (isNegative && cause instanceof StockApiError && cause.status === 409) {
        showError(`Stock insuffisant pour effectuer cette opération. ${cause.message} (HTTP ${cause.status})`);
        setBalance({ status: "loading" });
        setBalanceAttempt((value) => value + 1);
      } else {
        showError(stockError(cause));
      }
      pending.current = false;
      setSubmitting(false);
    }
  }

  return <>
    <header className="mb-8">
      <p className={`mb-2 text-xs font-semibold uppercase tracking-widest ${isNegative ? "text-amber-800" : "text-emerald-700"}`}>Stock</p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-slate-600">{helperText} Les champs marqués d’un * sont obligatoires.</p>
    </header>
    <section aria-label={title} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {state.status === "loading" && <p role="status" className="p-12 text-center text-sm text-slate-600">Chargement des produits…</p>}
    {state.status === "error" && <div role="alert" className="m-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p>{state.message}</p>
      <button type="button" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }} className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 font-semibold">Réessayer</button>
    </div>}
    {state.status === "success" && state.products.length === 0 && <p role="status" className="p-8 text-sm text-slate-600">Aucun produit disponible. <Link href="/products/new" className="font-semibold text-emerald-800 underline">Ajouter un produit</Link></p>}
    {state.status === "success" && state.products.length > 0 ? <form onSubmit={submit}>
      {error && <div ref={errorRef} tabIndex={-1} role="alert" className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      <fieldset disabled={submitting} className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8 disabled:opacity-70">
        <legend className="sr-only">{title}</legend>
        <label className="text-sm font-medium sm:col-span-2">Produit *
          <select required value={selectedId} onChange={(event) => {
            setSelectedId(event.target.value); setUnit(""); setError(null); setBalance({ status: "loading" });
          }} className={inputClass}>
            <option value="" disabled>Sélectionner un produit</option>
            {state.products.map((product) => <option key={product.id} value={product.id} dir="auto">{product.name} — {product.sku}</option>)}
          </select>
        </label>
        {showCurrentStock && selected && <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm sm:col-span-2">
          {balance.status === "loading" && <p role="status">Chargement du stock actuel…</p>}
          {balance.status === "success" && balance.balance.productId === selected.id && <p role="status">
            Stock actuel : <strong className="tabular-nums">{balance.balance.stock.replace(".", ",")} {balance.balance.unit}</strong>
          </p>}
          {balance.status === "error" && <div role="alert" className="text-red-900">
            <p>{balance.message}</p>
            <button type="button" onClick={() => { setBalance({ status: "loading" }); setBalanceAttempt((value) => value + 1); }} className="mt-3 rounded-md border border-red-300 bg-white px-3 py-2 font-semibold">Réessayer</button>
          </div>}
        </div>}
        <label className="text-sm font-medium">Quantité *
          <input name="quantity" required inputMode="decimal" placeholder="500" className={inputClass} aria-describedby="quantity-help" />
          <span id="quantity-help" className="mt-2 block text-xs font-normal text-slate-500">Virgule ou point accepté.</span>
        </label>
        <label className="text-sm font-medium">Unité *
          <select required disabled={!selected} value={unit} onChange={(event) => setUnit(event.target.value)} className={inputClass}>
            <option value="" disabled>Sélectionner une unité</option>
            {units.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        {selected && <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-900 sm:col-span-2">1 {selected.storageUnit} = {selected.conversionFactor.replace(".", ",")} {selected.saleUnit}. Le mouvement sera comptabilisé en {selected.storageUnit}.</p>}
        <label className="text-sm font-medium">Motif<input name="reason" dir="auto" list={type === "EXIT" ? "exit-reasons" : undefined} className={inputClass} /></label>
        {type === "EXIT" && <datalist id="exit-reasons"><option value="Vente manuelle" /><option value="Utilisation interne" /><option value="Sortie diverse" /></datalist>}
        <label className="text-sm font-medium">Référence<input name="reference" dir="auto" className={inputClass} /></label>
        <label className="text-sm font-medium sm:col-span-2">Notes<textarea name="notes" dir="auto" rows={4} className={`${inputClass} resize-y`} /></label>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        {submitting ? <button type="button" disabled className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold opacity-50">Annuler</button>
          : <Link href="/stock" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold hover:bg-slate-100">Annuler</Link>}
        <button type="submit" disabled={submitting || (showCurrentStock && !balanceReady)} className={`rounded-lg px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${isNegative ? "bg-amber-800 hover:bg-amber-900 focus-visible:outline-amber-700" : "bg-emerald-800 hover:bg-emerald-900 focus-visible:outline-emerald-700"}`}>{submitting ? "Enregistrement..." : submitLabel}</button>
        <span role="status" className="sr-only">{submitting ? "Enregistrement..." : ""}</span>
      </div>
    </form> : <Link href="/stock" className="m-6 inline-block rounded-md px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Annuler</Link>}
  </section></>;
}
