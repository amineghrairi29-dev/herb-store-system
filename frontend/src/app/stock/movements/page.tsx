import type { Metadata } from "next";
import Link from "@/components/auth-link";
import HistoryContent from "./history-content";
export const metadata: Metadata = { title: "Historique des mouvements de stock" };
export default function Page() {
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <Link href="/stock" className="text-sm font-semibold text-emerald-800 hover:underline">← Gestion du stock</Link>
    <h1 className="mb-3 mt-5 text-3xl font-semibold tracking-tight">Historique des mouvements de stock</h1>
    <p className="mb-8 text-sm text-slate-600">Consultez les entrées, sorties et corrections enregistrées.</p>
    <HistoryContent />
  </div></main>;
}
