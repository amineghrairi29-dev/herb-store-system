import type { Metadata } from "next";
import Link from "@/components/auth-link";
import StockTable from "./stock-table";

export const metadata: Metadata = { title: "Gestion du stock" };

export default function StockPage() {
  return (
    <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Link href="/products" className="text-sm font-medium text-emerald-800 hover:underline">← Gestion des produits</Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Gestion du stock</h1>
            <p className="mt-3 text-sm text-slate-600">Consultez les quantités disponibles et enregistrez vos mouvements de stock.</p>
          </div>
        </header>
        <StockTable />
      </div>
    </main>
  );
}
