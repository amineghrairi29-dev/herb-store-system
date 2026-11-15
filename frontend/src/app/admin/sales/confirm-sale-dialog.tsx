"use client";
import { useEffect, useRef, useState } from "react";
import type { Sale } from "@/types/sale";
import { readSale, saleError, saleRequest } from "@/lib/sale-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { buttonClass, secondaryClass, SaleError } from "./sale-ui";
export default function ConfirmSaleDialog({ sale, onCancel, onConfirmed }: { sale: Sale; onCancel: () => void; onConfirmed: (sale: Sale) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), pending = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); cancel.current?.focus(); return () => element?.close(); }, []);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try { onConfirmed(readSale(await saleRequest(`/sales/${sale.id}/confirm`, { method: "POST" }))); }
    catch (cause: unknown) { setError(saleError(cause)); pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="confirm-sale-title" aria-describedby="confirm-sale-warning" aria-busy={saving} onCancel={(event) => { event.preventDefault(); if (!pending.current) onCancel(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
    <h2 id="confirm-sale-title" className="text-xl font-semibold">Confirmer cette vente ?</h2><p id="confirm-sale-warning" className="mt-3 text-sm text-slate-600">La confirmation déduira les quantités du stock et ne pourra pas être répétée.</p>
    <dl className="my-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm"><dt>Référence</dt><dd className="break-words"><bdi>{sale.reference}</bdi></dd><dt>Nombre de lignes</dt><dd>{sale.lines.length}</dd><dt>Total</dt><dd className="break-words font-semibold">{displayAmount(sale.totalAmount)} DT</dd></dl>
    {error && <SaleError error={error} />}
    <div className="flex flex-wrap justify-end gap-3"><button ref={cancel} type="button" disabled={saving} onClick={onCancel} className={secondaryClass}>Annuler</button><button type="button" disabled={saving} onClick={() => void confirm()} className={buttonClass}>{saving ? "Confirmation..." : "Confirmer la vente"}</button></div>
  </dialog>;
}
