import Link from "@/components/auth-link";
import type { StockStatus } from "@/lib/stock-view";
import { isNegativeMovement, movementConfigs } from "./movement-config";

export const controlClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
export function StatusBadge({ status }: { status: StockStatus }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${status === "Rupture" ? "bg-red-50 text-red-800" : status === "Stock faible" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>{status}</span>;
}
export function StockActions() {
  return <nav aria-label="Actions du stock" className="mb-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
    {Object.values(movementConfigs).map((config) => <Link key={config.type} href={config.route} className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${isNegativeMovement(config.type) ? "bg-amber-50 text-amber-900 hover:bg-amber-100" : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}>{config.actionLabel}</Link>)}
    <Link href="/stock/movements" className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-emerald-700">Historique</Link>
  </nav>;
}
export function LoadFeedback({ state, reload }: { state: { status: string; message?: string }; reload: () => void }) {
  if (state.status === "loading") return <p role="status" className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600">Chargement des données du stock…</p>;
  if (state.status === "error") return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-900"><p>{state.message}</p><button type="button" onClick={reload} className={`${controlClass} mt-4 font-semibold`}>Réessayer</button></div>;
  return null;
}
