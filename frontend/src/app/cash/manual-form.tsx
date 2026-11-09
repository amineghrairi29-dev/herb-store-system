"use client";
import Link from "@/components/auth-link";
import { useRef, useState, type FormEvent } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { paymentDecimal } from "@/lib/purchase-decimal";
import { CashError, cashError, inputClass, buttonClass, secondaryClass } from "./cash-ui";

export default function ManualForm({ direction }: { direction: "in" | "out" }) {
  const [submitting, setSubmitting] = useState(false), [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const data = new FormData(event.currentTarget), amount = paymentDecimal(String(data.get("amount") ?? ""));
    const description = String(data.get("description") ?? "").trim(), movementDate = String(data.get("movementDate") ?? "");
    if (!amount || !description || !movementDate) { setError("Un montant supérieur à zéro, une date et une description sont obligatoires."); return; }
    const optional = (key: string) => String(data.get(key) ?? "").trim() || null;
    pending.current = true; setSubmitting(true); setError(null);
    try {
      await purchaseRequest(`/cash/manual-${direction}`, { method: "POST", body: JSON.stringify({ amount, movementDate, description, reference: optional("reference"), notes: optional("notes") }) });
      window.location.replace("/cash");
    } catch (cause: unknown) { setError(cashError(cause)); setSubmitting(false); pending.current = false; }
  }
  return <form onSubmit={submit} className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-busy={submitting}>
    <p className="mb-6 text-sm text-slate-600">{direction === "in" ? "Enregistrer un apport ou une entrée exceptionnelle." : "Enregistrer une dépense ou un retrait de caisse."} Mode : <strong>Espèces</strong>. Le mouvement enregistré ne peut pas être modifié.</p>
    {error && <CashError error={error} />}
    <fieldset disabled={submitting} className="grid gap-5 sm:grid-cols-2">
      <legend className="sr-only">Mouvement manuel en espèces</legend>
      <label className="text-sm font-medium">Montant (DT) *<input className={inputClass} name="amount" inputMode="decimal" placeholder="0,000" required autoComplete="off" /></label>
      <label className="text-sm font-medium">Date *<input className={inputClass} name="movementDate" type="date" required /></label>
      <label className="text-sm font-medium sm:col-span-2">Description *<input className={inputClass} name="description" dir="auto" required placeholder={direction === "in" ? "Apport caisse" : "Petite dépense"} /></label>
      <label className="text-sm font-medium sm:col-span-2">Référence<input className={inputClass} name="reference" dir="auto" /></label>
      <label className="text-sm font-medium sm:col-span-2">Notes<textarea className={inputClass} name="notes" dir="auto" rows={4} /></label>
    </fieldset>
    <div className="mt-7 flex flex-wrap justify-end gap-3">{submitting ? <button disabled type="button" className={secondaryClass}>Annuler</button> : <Link href="/cash" className={secondaryClass}>Annuler</Link>}<button disabled={submitting} className={buttonClass} type="submit">{submitting ? "Enregistrement..." : direction === "in" ? "Enregistrer l’entrée" : "Enregistrer la sortie"}</button></div>
    {submitting && <p role="status" className="mt-3 text-right text-sm text-slate-600">Enregistrement...</p>}
  </form>;
}
