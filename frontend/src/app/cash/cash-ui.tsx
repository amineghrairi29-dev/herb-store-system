import Link from "@/components/auth-link";
import type { ReactNode } from "react";
export { buttonClass, secondaryClass, inputClass, PurchaseError as CashError } from "../purchases/purchase-ui";
export function CashShell({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav aria-label="Navigation" className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/finance">Finance</Link><Link href="/cash">Caisse</Link><Link href="/expenses">Dépenses</Link><Link href="/sales">Ventes</Link><Link href="/purchases">Achats</Link><Link href="/products">Produits</Link><Link href="/stock">Stock</Link></nav>
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1>{action}</header>{children}
  </div></main>;
}
export function cashError(cause: unknown): string {
  if (cause instanceof TypeError) return "Connexion à l’API impossible. Vérifiez le serveur et la configuration CORS.";
  if (cause instanceof Error && ["TimeoutError", "AbortError"].includes(cause.name)) return "Le serveur ne répond pas. Vérifiez l’historique avant de réessayer un enregistrement.";
  return cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.";
}
