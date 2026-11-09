"use client";
import Link from "@/components/auth-link";
import { useRef, useState } from "react";
import type { OnlineOrder } from "@/types/online-order";
import { saleStatusLabels } from "@/types/sale";
import { orderRequest } from "./order-api";
export default function OrderFulfillment({ order, refresh }: { order: OnlineOrder; refresh: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const locked = useRef(false);
  async function convert() {
    if (locked.current || !window.confirm("Cette action crée une vente brouillon. Le stock ne sera déduit qu’après confirmation de la vente. Continuer ?")) return;
    locked.current = true; setBusy(true); setError("");
    try { await orderRequest(`/online-orders/${order.id}/convert-to-sale`, { method: "POST" }); refresh(); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Impossible de créer la vente."); }
    finally { locked.current = false; setBusy(false); }
  }
  if (order.sale) return <section className="mt-6 min-w-0 rounded-xl border border-emerald-200 bg-white p-5"><h2 className="text-xl font-semibold">Vente créée</h2><p className="mt-3 break-words">{order.sale.reference} · {saleStatusLabels[order.sale.status]}</p><Link href={`/sales/${order.sale.id}`} className="mt-4 inline-block text-emerald-800 underline">Voir la vente</Link><p className="mt-3 text-sm text-slate-600">La commande reste un historique. Seule la confirmation de la vente enregistre la sortie de stock.</p></section>;
  if (order.status !== "CONFIRMED" || order.saleId !== null) return null;
  return <section className="mt-6 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Préparer la vente</h2><p className="mt-3 text-sm text-slate-600">Cette action crée une vente brouillon. Le stock ne sera déduit qu’après confirmation de la vente.</p><button disabled={busy} onClick={() => void convert()} className="mt-4 rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">{busy ? "Création..." : "Créer la vente"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}</section>;
}
