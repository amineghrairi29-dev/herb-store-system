import Link from "@/components/auth-link";
import type { ReactNode } from "react";
import { purchaseStatusLabels, type PurchaseStatus } from "@/types/purchase";
export const buttonClass = "inline-flex items-center justify-center rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-50";
export const secondaryClass = "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50";
export const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-emerald-700";
export function PurchaseShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav aria-label="Navigation" className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/purchases">Achats</Link><Link href="/suppliers">Fournisseurs</Link><Link href="/products">Produits</Link><Link href="/stock">Stock</Link><Link href="/cash">Caisse</Link></nav>
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{action}</header>{children}
  </div></main>;
}
export function PurchaseBadge({ status }: { status: PurchaseStatus }) { return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${status === "CONFIRMED" ? "bg-emerald-50 text-emerald-800" : status === "DRAFT" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{purchaseStatusLabels[status]}</span>; }
export function PurchaseError({ error, retry }: { error: string; retry?: () => void }) { return <div role="alert" className="my-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{error}</p>{retry && <button type="button" className="mt-3 font-semibold underline" onClick={retry}>Réessayer</button>}</div>; }
