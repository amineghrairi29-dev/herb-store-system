import Link from '@/components/auth-link';
import FinanceDashboard from './finance-dashboard';
export const metadata = { title: 'Tableau de bord financier' };
export default function Page() {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav aria-label="Navigation" className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/reports">Rapports</Link><Link href="/finance">Finance</Link><Link href="/cash">Caisse</Link><Link href="/expenses">Dépenses</Link><Link href="/sales">Ventes</Link><Link href="/purchases">Achats</Link><Link href="/products">Produits</Link></nav>
    <header className="mb-8"><h1 className="text-3xl font-semibold tracking-tight">Tableau de bord financier</h1><p className="mt-3 text-sm text-slate-600">Vue synthétique de l’activité financière</p></header><FinanceDashboard />
  </div></main>;
}
