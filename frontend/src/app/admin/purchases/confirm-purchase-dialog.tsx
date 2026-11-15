"use client";
import { useEffect, useRef, useState } from "react";
import type { Purchase } from "@/types/purchase";
import { purchaseError, purchaseRequest, readPurchase } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { buttonClass, secondaryClass, PurchaseError } from "./purchase-ui";
export default function ConfirmPurchaseDialog({ purchase, onCancel, onConfirmed }: { purchase: Purchase; onCancel: () => void; onConfirmed: (purchase: Purchase) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), cancel = useRef<HTMLButtonElement>(null), pending = useRef(false);
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); cancel.current?.focus(); return () => element?.close(); }, []);
  async function confirm() {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try { onConfirmed(readPurchase(await purchaseRequest(`/purchases/${purchase.id}/confirm`, { method: "POST" }))); }
    catch (cause: unknown) { setError(purchaseError(cause)); pending.current = false; setSaving(false); }
  }
  return <dialog ref={dialog} aria-labelledby="confirm-purchase-title" aria-describedby="confirm-purchase-warning" aria-busy={saving} onCancel={(event) => { event.preventDefault(); if (!pending.current) onCancel(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
    <h2 id="confirm-purchase-title" className="text-xl font-semibold">Confirmer cet achat ?</h2><p id="confirm-purchase-warning" className="mt-3 text-sm text-slate-600">La confirmation ajoutera les quantités au stock et ne pourra pas être répétée.</p>
    <dl className="my-5 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-4 text-sm"><dt>Référence</dt><dd className="break-words"><bdi>{purchase.reference}</bdi></dd><dt>Fournisseur</dt><dd className="break-words"><bdi dir="auto">{purchase.supplier.name}</bdi></dd><dt>Nombre de lignes</dt><dd>{purchase.lines.length}</dd><dt>Total</dt><dd className="break-words font-semibold">{displayAmount(purchase.totalAmount)} DT</dd></dl>
    {error && <PurchaseError error={error} />}
    <div className="flex flex-wrap justify-end gap-3"><button ref={cancel} type="button" disabled={saving} onClick={onCancel} className={secondaryClass}>Annuler</button><button type="button" disabled={saving} onClick={() => void confirm()} className={buttonClass}>{saving ? "Confirmation..." : "Confirmer l’achat"}</button></div>
  </dialog>;
}
