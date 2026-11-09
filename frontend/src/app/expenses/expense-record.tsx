"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { expenseCategoryLabels, readExpense, type Expense } from "@/types/expense";
import { paymentMethodLabels } from "@/types/purchase-payment";
import { CashImpact, ExpenseShell, ExpenseError, expenseError, buttonClass, secondaryClass } from "./expense-ui";
import ExpenseForm from "./expense-form";
export default function ExpenseRecord({ id, edit = false }: { id: string; edit?: boolean }) {
  const [expense, setExpense] = useState<Expense | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; purchaseRequest(`/expenses/${encodeURIComponent(id)}`).then(readExpense).then((value) => { if (active) setExpense(value); }).catch((cause: unknown) => { if (active) setError(expenseError(cause)); }); return () => { active = false; }; }, [id, attempt]);
  return <ExpenseShell title={edit ? "Modifier la dépense" : "Détail de la dépense"} action={<Link className={secondaryClass} href="/expenses">Retour aux dépenses</Link>}>
    {error ? <ExpenseError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /> : !expense ? <p role="status" className="py-12 text-center text-slate-600">Chargement de la dépense...</p> : edit ? <ExpenseForm expense={expense} /> : <section className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <dl className="grid gap-5 sm:grid-cols-2">{[["Référence", expense.reference], ["Catégorie", expenseCategoryLabels[expense.category]], ["Description", expense.description], ["Montant", `${displayAmount(expense.amount)} DT`], ["Mode de paiement", paymentMethodLabels[expense.paymentMethod]], ["Date", expense.expenseDate.split("-").reverse().join("/")], ["Notes", expense.notes || "—"], ["Créée le (UTC)", expense.createdAt]].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium"><bdi dir="auto">{value}</bdi></dd></div>)}</dl>
      <div className="my-6"><CashImpact method={expense.paymentMethod} /></div><p className="mb-5 text-sm text-slate-500">Modifiable en V1 avant la mise en place d’un verrou comptable.</p><Link href={`/expenses/${expense.id}/edit`} className={buttonClass}>Modifier</Link>
    </section>}
  </ExpenseShell>;
}
