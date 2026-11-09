import type { Metadata } from "next";
import Link from "@/components/auth-link";
import ProductsTable from "./products-table";

export const metadata: Metadata = {
  title: "Gestion des produits",
  description: "Catalogue et gestion des produits de votre herboristerie.",
};

export default function ProductsPage() {
  return (
    <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Catalogue</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Gestion des produits</h1>
            <p className="mt-3 text-sm text-slate-600">Consultez les prix, le statut et la visibilité de vos produits.</p>
          </div>
          <Link href="/products/new" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            Ajouter un produit
          </Link>
        </header>
        <nav aria-label="Navigation du catalogue" className="mb-5 flex flex-wrap gap-5">
          <Link href="/online-orders" className="text-sm font-semibold text-emerald-800 hover:underline">Commandes en ligne</Link>
          <Link href="/reports" className="text-sm font-semibold text-emerald-800 hover:underline">Rapports</Link>
          <Link href="/finance" className="text-sm font-semibold text-emerald-800 hover:underline">Finance</Link>
          <Link href="/expenses" className="text-sm font-semibold text-emerald-800 hover:underline">Dépenses</Link>
          <Link href="/cash" className="text-sm font-semibold text-emerald-800 hover:underline">Caisse</Link>
          <Link href="/sales" className="text-sm font-semibold text-emerald-800 hover:underline">Ventes</Link>
          <Link href="/suppliers" className="text-sm font-semibold text-emerald-800 hover:underline">Fournisseurs</Link>
          <Link href="/stock" className="text-sm font-semibold text-emerald-800 hover:underline">Consulter le stock →</Link>
        </nav>
        <ProductsTable />
      </div>
    </main>
  );
}
