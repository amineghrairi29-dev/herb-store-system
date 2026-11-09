"use client";
import Link from "@/components/auth-link";
import { useRef, useState, type FormEvent } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { paymentDecimal } from "@/lib/purchase-decimal";
import { expenseCategoryLabels, isExpenseCategory, readExpense, type Expense, type ExpenseInput } from "@/types/expense";
import { isPaymentMethod, paymentMethodLabels } from "@/types/purchase-payment";
import { CashImpact, ExpenseError, expenseError, inputClass, buttonClass, secondaryClass } from "./expense-ui";
export default function ExpenseForm({ expense }: { expense?: Expense }) {
  const [method, setMethod] = useState(expense?.paymentMethod ?? "CASH"), [error, setError] = useState<string | null>(null), [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const data = new FormData(event.currentTarget), text = (key: string) => String(data.get(key) ?? "").trim();
    const reference = text("reference"), category = text("category"), description = text("description"), amount = paymentDecimal(text("amount")), expenseDate = text("expenseDate");
    if (!reference || !description || !amount || !expenseDate || !isExpenseCategory(category) || !isPaymentMethod(method)) { setError("Renseignez tous les champs obligatoires et un montant supérieur à zéro."); return; }
    const input: ExpenseInput = { reference, category, description, amount, paymentMethod: method, expenseDate, notes: text("notes") || null };
    pending.current = true; setSubmitting(true); setError(null);
    try { readExpense(await purchaseRequest(expense ? `/expenses/${expense.id}` : "/expenses", { method: expense ? "PATCH" : "POST", body: JSON.stringify(input) })); window.location.replace("/expenses"); }
    catch (cause: unknown) { setError(expenseError(cause)); setSubmitting(false); pending.current = false; }
  }
  return <form onSubmit={submit} aria-busy={submitting} className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="mb-6 text-sm text-slate-600">Dépense hors achat fournisseur. Les dépenses restent modifiables en V1, avant la mise en place d’un verrou comptable. Le mouvement financier lié est mis à jour avec la dépense.</p>
    {error && <ExpenseError error={error} />}
    <fieldset disabled={submitting} className="grid gap-5 sm:grid-cols-2"><legend className="sr-only">Informations de la dépense</legend>
      <label className="text-sm font-medium">Référence *<input name="reference" className={inputClass} defaultValue={expense?.reference} placeholder="EXP-0001" dir="auto" required /></label>
      <label className="text-sm font-medium">Catégorie *<select name="category" className={inputClass} defaultValue={expense?.category ?? ""} required><option value="" disabled>Choisir une catégorie</option>{Object.entries(expenseCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium sm:col-span-2">Description *<input name="description" className={inputClass} defaultValue={expense?.description} dir="auto" required /></label>
      <label className="text-sm font-medium">Montant (DT) *<input name="amount" className={inputClass} defaultValue={expense?.amount} inputMode="decimal" placeholder="0,000" autoComplete="off" required /></label>
      <label className="text-sm font-medium">Mode de paiement *<select name="paymentMethod" className={inputClass} value={method} onChange={(event) => { if (isPaymentMethod(event.target.value)) setMethod(event.target.value); }} required>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Date *<input name="expenseDate" type="date" className={inputClass} defaultValue={expense?.expenseDate} required /></label>
      <label className="text-sm font-medium sm:col-span-2">Notes<textarea name="notes" className={inputClass} defaultValue={expense?.notes ?? ""} dir="auto" rows={4} /></label>
    </fieldset>
    <div className="mt-6"><CashImpact method={method} /></div>
    <div className="mt-7 flex flex-wrap justify-end gap-3">{submitting ? <button type="button" disabled className={secondaryClass}>Annuler</button> : <Link href="/expenses" className={secondaryClass}>Annuler</Link>}<button type="submit" className={buttonClass} disabled={submitting}>{submitting ? "Enregistrement..." : "Enregistrer"}</button></div>
    {submitting && <p role="status" className="mt-3 text-right text-sm text-slate-600">Enregistrement...</p>}
  </form>;
}
