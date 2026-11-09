import type { Metadata } from "next";
import Link from "@/components/auth-link";
import StockDetails from "./stock-details";
export const metadata: Metadata = { title: "Détail du stock produit" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-7xl">
    <Link href="/stock" className="text-sm font-semibold text-emerald-800 hover:underline">← Gestion du stock</Link>
    <h1 className="mb-8 mt-5 text-3xl font-semibold tracking-tight">Détail du stock produit</h1>
    <StockDetails key={id} id={id} />
  </div></main>;
}
