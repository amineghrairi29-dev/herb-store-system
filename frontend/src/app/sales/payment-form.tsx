"use client";
import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Sale } from "@/types/sale";
import { isPaymentMethod, paymentMethodLabels } from "@/types/purchase-payment";
import { isSalePayment, type CreateSalePaymentInput } from "@/types/sale-payment";
import { saleError, saleRequest, readSale } from "@/lib/sale-api";
import { paymentDecimal } from "@/lib/purchase-decimal";
import { compareDecimals } from "@/lib/decimal";
import { buttonClass, inputClass, secondaryClass, SaleError, SaleShell } from "./sale-ui";
import { PaymentSummary } from "./sale-payments";

export default function PaymentForm({ id }: { id: string }) {
  const [sale, setSale] = useState<Sale | null>(null), [loadError, setLoadError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    saleRequest(`/sales/${encodeURIComponent(id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then((data) => { if (!controller.signal.aborted) setSale(readSale(data)); }).catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(saleError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <SaleShell title="Ajouter un paiement" action={<Link href={`/sales/${encodeURIComponent(id)}`} className={secondaryClass}>Retour à la vente</Link>}>
    {loadError ? <SaleError error={loadError} retry={() => { setLoadError(null); setAttempt((value) => value + 1); }} /> : !sale ? <p role="status">Chargement de la vente...</p> : <>
      <p className="text-sm text-slate-600"><bdi>{sale.reference}</bdi> · <bdi dir="auto">{sale.customerName || "Client comptoir"}</bdi></p><PaymentSummary sale={sale} />
      {sale.status !== "CONFIRMED" ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Seule une vente confirmée peut recevoir un paiement.</p> : sale.paymentStatus === "PAID" ? <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">Cette vente est entièrement payée.</p> : <LoadedPaymentForm sale={sale} />}
    </>}
  </SaleShell>;
}
function LoadedPaymentForm({ sale }: { sale: Sale }) {
  const [saving, setSaving] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const data = new FormData(event.currentTarget), amount = paymentDecimal(String(data.get("amount") ?? "")), method = String(data.get("paymentMethod") ?? ""), paymentDate = String(data.get("paymentDate") ?? "");
    if (!amount) { setError("Saisissez un montant supérieur à 0 (36 décimales maximum)."); return; }
    if (compareDecimals(amount, sale.remainingAmount) > 0) { setError("Le montant dépasse le reste à payer."); return; }
    if (!isPaymentMethod(method) || !paymentDate) { setError("Le mode et la date de paiement sont obligatoires."); return; }
    const input: CreateSalePaymentInput = { amount, paymentMethod: method, paymentDate, reference: String(data.get("reference") ?? "").trim() || null, notes: String(data.get("notes") ?? "").trim() || null };
    pending.current = true; setSaving(true); setError(null);
    try {
      const result = await saleRequest(`/sales/${sale.id}/payments`, { method: "POST", body: JSON.stringify(input) });
      if (!isSalePayment(result)) throw new Error("Réponse paiement invalide. Vérifiez l’historique avant de réessayer.");
      window.location.replace(`/sales/${sale.id}`);
    } catch (cause: unknown) { setError(`${saleError(cause)} Consultez l’historique avant de réessayer si le résultat de l’enregistrement est incertain.`); pending.current = false; setSaving(false); }
  }
  return <form onSubmit={submit} aria-busy={saving} className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Montant (DT) *<input required name="amount" inputMode="decimal" className={inputClass} /></label>
      <label className="text-sm font-medium">Mode de paiement *<select required name="paymentMethod" defaultValue="" className={inputClass}><option value="">Sélectionner un mode</option>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Date de paiement *<input required name="paymentDate" type="date" defaultValue={date} className={inputClass} /></label>
      <label className="text-sm font-medium">Référence<input name="reference" dir="auto" className={inputClass} /></label>
      <label className="text-sm font-medium sm:col-span-2">Notes<textarea name="notes" dir="auto" rows={4} className={inputClass} /></label>
    </fieldset>
    {error && <SaleError error={error} />}
    <div className="mt-6 flex flex-wrap justify-end gap-3">{saving ? <button disabled className={secondaryClass}>Annuler</button> : <Link href={`/sales/${sale.id}`} className={secondaryClass}>Annuler</Link>}<button type="submit" disabled={saving} className={buttonClass}>{saving ? "Enregistrement..." : "Enregistrer le paiement"}</button></div>
  </form>;
}
