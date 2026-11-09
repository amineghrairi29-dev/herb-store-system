"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import type { Sale } from "@/types/sale";
import { readSale, saleError, saleRequest } from "@/lib/sale-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { buttonClass, secondaryClass, SaleBadge, SaleError, SaleShell } from "./sale-ui";
import ConfirmSaleDialog from "./confirm-sale-dialog";
import { PaymentHistory, PaymentSummary } from "./sale-payments";
export default function SaleDetails({ id }: { id: string }) {
  const [sale, setSale] = useState<Sale | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    saleRequest(`/sales/${encodeURIComponent(id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then((data) => { if (!controller.signal.aborted) setSale(readSale(data)); }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(saleError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <SaleShell title="Détail de la vente" action={<Link href="/sales" className={secondaryClass}>Retour aux ventes</Link>}>
    {error ? <SaleError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /> : !sale ? <p role="status">Chargement de la vente...</p> : <>
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="break-words text-xl font-semibold"><bdi>{sale.reference}</bdi></h2><SaleBadge status={sale.status} /></div>
        {sale.onlineOrder && <p className="mt-4 text-sm text-emerald-900">Origine : Commande en ligne<br />Commande : <Link href={`/online-orders/${sale.onlineOrder.id}`} className="underline">{sale.onlineOrder.reference}</Link></p>}
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Client</dt><dd className="mt-1 break-words font-medium"><bdi dir="auto">{sale.customerName || "Client comptoir"}</bdi></dd></div><div><dt className="text-slate-500">Téléphone client</dt><dd className="mt-1"><bdi>{sale.customerPhone || "—"}</bdi></dd></div><div><dt className="text-slate-500">Date de vente</dt><dd className="mt-1">{sale.saleDate.split("-").reverse().join("/")}</dd></div>{sale.confirmedAt && <div><dt className="text-slate-500">Confirmée le</dt><dd className="mt-1">{new Date(sale.confirmedAt).toLocaleString("fr-FR")}</dd></div>}<div className="sm:col-span-2"><dt className="text-slate-500">Notes</dt><dd dir="auto" className="mt-1 whitespace-pre-wrap break-words">{sale.notes || "—"}</dd></div></dl>
        {sale.status === "DRAFT" ? <div className="mt-6 flex flex-wrap gap-3"><Link href={`/sales/${sale.id}/edit`} className={secondaryClass}>Modifier</Link><button onClick={() => setConfirming(true)} className={buttonClass}>Confirmer</button></div> : <p className="mt-6 text-sm text-slate-600">Vente en lecture seule.{sale.status === "CONFIRMED" ? " Les sorties de stock ont été enregistrées." : ""}</p>}
      </section>
      <section aria-label="Lignes de vente" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Produit", "Quantité", "Unité", "Prix unitaire", "Sous-total"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sale.lines.map((line) => <tr key={line.id}><td className="max-w-64 break-words px-5 py-4"><bdi dir="auto">{line.product.name}</bdi><span className="mt-1 block text-xs text-slate-500"><bdi>{line.product.sku}</bdi></span></td><td className="max-w-56 break-words px-5 py-4">{displayAmount(line.quantity)}</td><td className="px-5 py-4">{line.unit}</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(line.unitSalePrice)} DT/{line.unit}</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(line.lineTotal)} DT</td></tr>)}</tbody></table></div><p className="break-words border-t border-slate-200 p-6 text-right text-lg font-semibold">Total vente : {displayAmount(sale.totalAmount)} DT</p></section>
      <PaymentSummary sale={sale} showAction />
      <PaymentHistory sale={sale} />
      {confirming && <ConfirmSaleDialog sale={sale} onCancel={() => setConfirming(false)} onConfirmed={(updated) => { setSale(updated); setConfirming(false); }} />}
    </>}
  </SaleShell>;
}
