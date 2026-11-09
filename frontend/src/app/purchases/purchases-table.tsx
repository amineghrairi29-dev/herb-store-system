"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { isPurchase, purchaseStatusLabels, type Purchase } from "@/types/purchase";
import { purchaseError, purchaseRequest } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { inputClass, PurchaseBadge, PurchaseError } from "./purchase-ui";
import ConfirmPurchaseDialog from "./confirm-purchase-dialog";
import { PaymentBadge } from "./purchase-payments";
export default function PurchasesTable() {
  const [rows, setRows] = useState<Purchase[] | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [selected, setSelected] = useState<Purchase | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    purchaseRequest("/purchases", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then((data) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data) || !data.every(isPurchase)) throw new Error("Liste des achats invalide.");
      setRows(data);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(purchaseError(cause)); });
    return () => controller.abort();
  }, [attempt]);
  const query = search.trim().toLocaleLowerCase("fr");
  const visible = rows?.filter((row) => (!status || row.status === status) && `${row.reference} ${row.supplier.name}`.toLocaleLowerCase("fr").includes(query));
  return <section aria-label="Achats" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2"><label className="text-sm font-medium">Rechercher une référence ou un fournisseur<input type="search" dir="auto" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium">Statut<select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="">Tous les statuts</option>{Object.entries(purchaseStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {error ? <PurchaseError error={error} retry={() => { setError(null); setRows(null); setAttempt((value) => value + 1); }} /> : !rows ? <p role="status" className="p-8 text-center">Chargement des achats...</p> : !visible?.length ? <p className="p-8 text-center text-slate-600">{rows.length ? "Aucun achat ne correspond à votre recherche." : "Aucun achat disponible"}</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Référence", "Fournisseur", "Date", "Nombre de lignes", "Total", "Payé", "Reste", "Paiement", "Statut achat", "Actions"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="max-w-56 break-words px-5 py-4"><bdi>{row.reference}</bdi></td><td className="max-w-64 break-words px-5 py-4"><bdi dir="auto">{row.supplier.name}</bdi></td><td className="whitespace-nowrap px-5 py-4">{row.purchaseDate.split("-").reverse().join("/")}</td><td className="px-5 py-4">{row.lines.length}</td><td className="max-w-64 break-words px-5 py-4 font-medium">{displayAmount(row.totalAmount)} DT</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(row.totalPaid)} DT</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(row.remainingAmount)} DT</td><td className="px-5 py-4"><PaymentBadge status={row.paymentStatus} /></td><td className="px-5 py-4"><PurchaseBadge status={row.status} /></td><td className="px-5 py-4"><div className="flex gap-4 font-semibold text-emerald-800"><Link href={`/purchases/${row.id}`} className="hover:underline">Voir</Link>{row.status === "DRAFT" && <><Link href={`/purchases/${row.id}/edit`} className="hover:underline">Modifier</Link><button onClick={() => setSelected(row)} className="hover:underline">Confirmer</button></>}</div></td></tr>)}</tbody></table></div>}
    {selected && <ConfirmPurchaseDialog purchase={selected} onCancel={() => setSelected(null)} onConfirmed={(updated) => { setRows((items) => items?.map((item) => item.id === updated.id ? updated : item) ?? null); setSelected(null); }} />}
  </section>;
}
