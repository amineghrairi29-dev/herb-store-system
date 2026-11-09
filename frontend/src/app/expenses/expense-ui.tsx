import Link from "@/components/auth-link";
import type { ReactNode } from "react";
export { buttonClass, secondaryClass, inputClass, PurchaseError as ExpenseError } from "../purchases/purchase-ui";
export { cashError as expenseError } from "../cash/cash-ui";
export function ExpenseShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav aria-label="Navigation" className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/finance">Finance</Link><Link href="/expenses">Dépenses</Link><Link href="/cash">Caisse</Link><Link href="/sales">Ventes</Link><Link href="/purchases">Achats</Link><Link href="/products">Produits</Link><Link href="/stock">Stock</Link></nav>
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{action}</header>{children}
  </div></main>;
}
export function CashImpact({ method }: { method: string }) { return <section className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"><h2 className="font-semibold">Impact caisse</h2><p className="mt-2">{method === "CASH" ? "Cette dépense diminue le solde espèces." : "Cette dépense est enregistrée dans le flux financier mais n’impacte pas le solde espèces."}</p></section>; }
