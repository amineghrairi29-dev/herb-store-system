"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { expenseCategoryLabels, readExpenses, type Expense } from "@/types/expense";
import { paymentMethodLabels } from "@/types/purchase-payment";
import { ExpenseError, expenseError, inputClass, secondaryClass } from "./expense-ui";
const defaults = { category: "", paymentMethod: "", dateFrom: "", dateTo: "", search: "" };
export default function ExpensesTable() {
  const [rows, setRows] = useState<Expense[] | null>(null), [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0), [filters, setFilters] = useState(defaults);
  useEffect(() => { let active = true; purchaseRequest("/expenses").then(readExpenses).then((value) => { if (active) setRows(value); }).catch((cause: unknown) => { if (active) setError(expenseError(cause)); }); return () => { active = false; }; }, [attempt]);
  if (error) return <ExpenseError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} />;
  if (!rows) return <p role="status" className="py-12 text-center text-slate-600">Chargement des dépenses...</p>;
  const invalidRange = !!(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo), search = filters.search.trim().toLocaleLowerCase();
  const visible = rows.filter((row) => !invalidRange && (!filters.category || row.category === filters.category) && (!filters.paymentMethod || row.paymentMethod === filters.paymentMethod) && (!filters.dateFrom || row.expenseDate >= filters.dateFrom) && (!filters.dateTo || row.expenseDate <= filters.dateTo) && (!search || `${row.reference} ${row.description}`.toLocaleLowerCase().includes(search)));
  return <>
    <section aria-label="Filtres des dépenses" className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-3">
      <label className="text-sm font-medium">Recherche<input className={inputClass} type="search" dir="auto" placeholder="Référence ou description" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
      <label className="text-sm font-medium">Catégorie<select className={inputClass} value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">Toutes</option>{Object.entries(expenseCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Mode de paiement<select className={inputClass} value={filters.paymentMethod} onChange={(event) => setFilters({ ...filters, paymentMethod: event.target.value })}><option value="">Tous</option>{Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-medium">Du<input type="date" className={inputClass} value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label className="text-sm font-medium">Au<input type="date" className={inputClass} value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <div className="flex items-end"><button type="button" className={secondaryClass} onClick={() => setFilters(defaults)}>Réinitialiser les filtres</button></div>
    </section>
    {invalidRange && <ExpenseError error="La date de début doit précéder ou être égale à la date de fin." />}
    <p role="status" className="mb-3 text-sm text-slate-500">{visible.length} dépense(s)</p>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{!visible.length ? <p className="p-8 text-center text-sm text-slate-600">{rows.length ? "Aucune dépense ne correspond aux filtres" : "Aucune dépense enregistrée"}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Référence", "Date", "Catégorie", "Description", "Montant", "Mode de paiement", "Actions"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{visible.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="max-w-56 break-words px-5 py-4"><bdi dir="auto">{row.reference}</bdi></td><td className="whitespace-nowrap px-5 py-4">{row.expenseDate.split("-").reverse().join("/")}</td><td className="px-5 py-4">{expenseCategoryLabels[row.category]}</td><td className="max-w-80 break-words px-5 py-4"><bdi dir="auto">{row.description}</bdi></td><td className="max-w-64 break-words px-5 py-4 font-semibold">{displayAmount(row.amount)} DT</td><td className="px-5 py-4">{paymentMethodLabels[row.paymentMethod]}</td><td className="px-5 py-4"><div className="flex gap-4 font-semibold text-emerald-800"><Link href={`/expenses/${row.id}`} className="hover:underline">Voir</Link><Link href={`/expenses/${row.id}/edit`} className="hover:underline">Modifier</Link></div></td></tr>)}</tbody>
    </table></div>}</div>
  </>;
}
