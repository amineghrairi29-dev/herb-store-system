import Link from '@/components/auth-link';
import { reportCatalog } from '@/types/report';
export const metadata = { title: 'Rapports' };
export default function Page() {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <nav className="mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800" aria-label="Navigation"><Link href="/finance">Finance</Link><Link href="/cash">Caisse</Link><Link href="/products">Produits</Link></nav>
    <header className="mb-8"><h1 className="text-3xl font-semibold">Rapports</h1><p className="mt-3 text-sm text-slate-600">Analyse et export des données de gestion</p></header>
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(reportCatalog).map(([kind, report]) => <Link key={kind} href={`/reports/${kind}`} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm hover:border-emerald-700"><h2 className="text-lg font-semibold text-emerald-800">{report.title}</h2><p className="mt-3 text-sm text-slate-600">{report.description}</p><p className="mt-5 text-sm font-semibold">Consulter →</p></Link>)}</div>
  </div></main>;
}
