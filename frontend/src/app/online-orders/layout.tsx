import Link from "@/components/auth-link";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Commandes en ligne" };
export default function Layout({ children }: { children: React.ReactNode }) { return <main lang="fr" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-7xl"><nav className="mb-6 flex flex-wrap gap-5"><Link href="/products" className="text-sm text-emerald-800 underline">Gestion des produits</Link><Link href="/online-orders" className="text-sm text-emerald-800 underline">Commandes en ligne</Link></nav>{children}</div></main>; }
