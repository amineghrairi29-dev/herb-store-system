import Link from "@/components/auth-link";
import type { ReactNode } from "react";
import { saleStatusLabels, type SaleStatus } from "@/types/sale";
export { buttonClass, secondaryClass, inputClass, PurchaseError as SaleError } from "../purchases/purchase-ui";
export function SaleShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav aria-label="Navigation" className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/sales">Ventes</Link><Link href="/products">Produits</Link><Link href="/stock">Stock</Link><Link href="/purchases">Achats</Link><Link href="/cash">Caisse</Link></nav>
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{action}</header>{children}
  </div></main>;
}
export function SaleBadge({ status }: { status: SaleStatus }) { return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${status === "CONFIRMED" ? "bg-emerald-50 text-emerald-800" : status === "DRAFT" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{saleStatusLabels[status]}</span>; }
