import Link from "@/components/auth-link";
import SuppliersTable from "./suppliers-table";
export const metadata = { title: "Gestion des fournisseurs" };
export default function SuppliersPage() {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Partenaires</p><h1 className="text-3xl font-semibold sm:text-4xl">Gestion des fournisseurs</h1><p className="mt-3 text-sm text-slate-600">Gérez les coordonnées et le statut de vos fournisseurs.</p></div>
      <Link href="/suppliers/new" className="rounded-lg bg-emerald-800 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-900">Ajouter un fournisseur</Link>
    </header>
    <nav aria-label="Navigation" className="mb-5 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/purchases">Achats</Link><Link href="/products">Produits</Link><Link href="/stock">Stock</Link></nav>
    <SuppliersTable />
  </div></main>;
}
