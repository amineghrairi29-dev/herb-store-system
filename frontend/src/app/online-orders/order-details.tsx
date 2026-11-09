"use client";
import { useState } from "react";
import { displayAmount } from "@/lib/purchase-decimal";
import { orderStatusLabels, type OnlineOrder } from "@/types/online-order";
import { orderRequest, useOrderData } from "./order-api";
import OrderFulfillment from "./order-fulfillment";
export default function OrderDetails({ id }: { id: string }) {
  const { data: order, error, refresh } = useOrderData<OnlineOrder>(`/online-orders/${encodeURIComponent(id)}`);
  const [busy, setBusy] = useState(false), [failure, setFailure] = useState("");
  async function transition(status: "CONFIRMED" | "CANCELLED") {
    if (busy || !window.confirm(`${status === "CONFIRMED" ? "Confirmer" : "Annuler"} la commande ${order?.reference} ? Cette action ne modifie pas le stock.`)) return;
    setBusy(true); setFailure("");
    try { await orderRequest(`/online-orders/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); refresh(); }
    catch (error: unknown) { setFailure(error instanceof Error ? error.message : "Impossible de modifier le statut."); }
    finally { setBusy(false); }
  }
  if (error) return <div role="alert"><p>{error}</p><button onClick={refresh} className="underline">Réessayer</button></div>;
  if (!order) return <p role="status">Chargement de la commande...</p>;
  return <><h1 className="break-words text-3xl font-semibold">Commande {order.reference}</h1><p className="mt-3 font-medium" data-order-status>{orderStatusLabels[order.status]}</p><div className="mt-6 grid gap-5 md:grid-cols-2"><section className="min-w-0 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Client</h2><dl className="mt-4 space-y-3">{[["Nom", order.customerName], ["Téléphone", order.customerPhone], ["Email", order.customerEmail], ["Notes", order.notes], ["Créée le", new Date(order.createdAt).toLocaleString("fr-FR")], ["Confirmée le", order.confirmedAt && new Date(order.confirmedAt).toLocaleString("fr-FR")], ["Annulée le", order.cancelledAt && new Date(order.cancelledAt).toLocaleString("fr-FR")]].map(([label, value]) => value && <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="whitespace-pre-wrap break-words"><bdi>{value}</bdi></dd></div>)}</dl></section><section className="min-w-0 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Traitement</h2><p className="mt-3 text-sm text-slate-600">Confirmer signifie accepter la demande client. Aucune vente, déduction ou réservation de stock, ni aucun paiement ne sera créé.</p>{order.status === "PENDING" && order.saleId === null && <div className="mt-5 flex flex-wrap gap-3"><button disabled={busy} onClick={() => void transition("CONFIRMED")} className="rounded-lg bg-emerald-800 px-4 py-2 text-white disabled:opacity-50">{busy ? "Enregistrement..." : "Confirmer"}</button><button disabled={busy} onClick={() => void transition("CANCELLED")} className="rounded-lg border border-red-300 px-4 py-2 text-red-800 disabled:opacity-50">Annuler</button></div>}{failure && <p role="alert" className="mt-4 text-red-800">{failure}</p>}</section></div><OrderFulfillment order={order} refresh={refresh} /><section className="mt-6 space-y-4 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Produits commandés</h2>{order.items.map((item) => <article key={item.productId} className="min-w-0 border-t pt-4"><h3 className="break-words font-semibold"><bdi>{item.productNameSnapshot}</bdi></h3><p className="mt-2 break-words text-sm">{item.quantity.replace(".", ",")} {item.unitSnapshot} × {displayAmount(item.unitPrice)} DT</p><p className="mt-1 break-words font-medium">{displayAmount(item.lineTotal)} DT</p></article>)}<p className="break-words border-t pt-4 text-xl font-semibold">Total : {displayAmount(order.totalAmount)} DT</p></section></>;
}
