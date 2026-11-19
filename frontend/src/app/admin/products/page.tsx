import type { Metadata } from "next";
import Link from "@/components/auth-link";
import ProductsTable from "./products-table";

export const metadata: Metadata = {
  title: "Recettes",
  description: "Les recettes faites main de Dar Slouma : objectif, format, prix et visibilité.",
};

export default function ProductsPage() {
  return (
    <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Catalogue</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Recettes{" "}
              <span lang="ar" dir="rtl" className="font-normal text-emerald-800">
                · الوصفات
              </span>
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Chaque recette répond à un objectif, avec son format, son prix et sa visibilité sur le site.
            </p>
          </div>
          <Link
            href="/admin/products/new"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              +
            </span>
            Nouvelle recette
          </Link>
        </header>
        <nav aria-label="Navigation du catalogue" className="mb-5 flex flex-wrap gap-5">
          <Link href="/admin/classifications" className="text-sm font-semibold text-emerald-800 hover:underline">
            Gérer les objectifs
          </Link>
          <Link href="/admin/stock" className="text-sm font-semibold text-emerald-800 hover:underline">
            Saisir le stock →
          </Link>
          <Link href="/admin/online-orders" className="text-sm font-semibold text-emerald-800 hover:underline">
            Commandes en ligne
          </Link>
        </nav>
        <ProductsTable />
      </div>
    </main>
  );
}
