"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import type { Purchase } from "@/types/purchase";
import { purchaseError, purchaseRequest, readPurchase } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { buttonClass, secondaryClass, PurchaseBadge, PurchaseError, PurchaseShell } from "./purchase-ui";
import ConfirmPurchaseDialog from "./confirm-purchase-dialog";
import { PaymentHistory, PaymentSummary } from "./purchase-payments";
export default function PurchaseDetails({ id }: { id: string }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0), [confirming, setConfirming] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    purchaseRequest(`/purchases/${encodeURIComponent(id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then((data) => { if (!controller.signal.aborted) setPurchase(readPurchase(data)); }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(purchaseError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <PurchaseShell title="Détail de l’achat" action={<Link href="/purchases" className={secondaryClass}>Retour aux achats</Link>}>
    {error ? <PurchaseError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} /> : !purchase ? <p role="status">Chargement de l’achat...</p> : <>
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="break-words text-xl font-semibold"><bdi>{purchase.reference}</bdi></h2><PurchaseBadge status={purchase.status} /></div>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Fournisseur</dt><dd className="mt-1 break-words font-medium"><bdi dir="auto">{purchase.supplier.name}</bdi> · <bdi>{purchase.supplier.code}</bdi></dd></div><div><dt className="text-slate-500">Date d’achat</dt><dd className="mt-1">{purchase.purchaseDate.split("-").reverse().join("/")}</dd></div>{purchase.confirmedAt && <div><dt className="text-slate-500">Confirmé le</dt><dd className="mt-1">{new Date(purchase.confirmedAt).toLocaleString("fr-FR")}</dd></div>}<div className="sm:col-span-2"><dt className="text-slate-500">Notes</dt><dd dir="auto" className="mt-1 whitespace-pre-wrap break-words">{purchase.notes || "—"}</dd></div></dl>
        {purchase.status === "DRAFT" ? <div className="mt-6 flex flex-wrap gap-3"><Link href={`/purchases/${purchase.id}/edit`} className={secondaryClass}>Modifier</Link><button onClick={() => setConfirming(true)} className={buttonClass}>Confirmer</button></div> : <p className="mt-6 text-sm text-slate-600">Achat en lecture seule.{purchase.status === "CONFIRMED" ? " Les entrées de stock ont été enregistrées." : ""}</p>}
      </section>
      <section aria-label="Lignes d’achat" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Produit", "Quantité", "Unité", "Prix unitaire", "Sous-total"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{purchase.lines.map((line) => <tr key={line.id}><td className="max-w-64 break-words px-5 py-4"><bdi dir="auto">{line.product.name}</bdi><span className="mt-1 block text-xs text-slate-500"><bdi>{line.product.sku}</bdi></span></td><td className="max-w-56 break-words px-5 py-4">{displayAmount(line.quantity)}</td><td className="px-5 py-4">{line.unit}</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(line.unitPurchasePrice)} DT/{line.unit}</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(line.lineTotal)} DT</td></tr>)}</tbody></table></div><p className="break-words border-t border-slate-200 p-6 text-right text-lg font-semibold">Total achat : {displayAmount(purchase.totalAmount)} DT</p></section>
      <PaymentSummary purchase={purchase} showAction />
      <PaymentHistory purchase={purchase} />
      {confirming && <ConfirmPurchaseDialog purchase={purchase} onCancel={() => setConfirming(false)} onConfirmed={(updated) => { setPurchase(updated); setConfirming(false); }} />}
    </>}
  </PurchaseShell>;
}
