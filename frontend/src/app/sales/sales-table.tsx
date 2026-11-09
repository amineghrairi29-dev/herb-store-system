"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { isSale, saleStatusLabels, type Sale } from "@/types/sale";
import { saleError, saleRequest } from "@/lib/sale-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { inputClass, SaleBadge, SaleError } from "./sale-ui";
import ConfirmSaleDialog from "./confirm-sale-dialog";
import { PaymentBadge } from "../purchases/purchase-payments";
export default function SalesTable() {
  const [rows, setRows] = useState<Sale[] | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState(""), [status, setStatus] = useState(""), [selected, setSelected] = useState<Sale | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    saleRequest("/sales", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then((data) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data) || !data.every(isSale)) throw new Error("Liste des ventes invalide.");
      setRows(data);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(saleError(cause)); });
    return () => controller.abort();
  }, [attempt]);
  const query = search.trim().toLocaleLowerCase("fr"), visible = rows?.filter((row) => (!status || row.status === status) && `${row.reference} ${row.customerName ?? ""}`.toLocaleLowerCase("fr").includes(query));
  return <section aria-label="Ventes" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    <div className="grid gap-4 border-b border-slate-200 p-5 sm:grid-cols-2"><label className="text-sm font-medium">Rechercher une référence ou un client<input type="search" dir="auto" value={search} onChange={(event) => setSearch(event.target.value)} className={inputClass} /></label><label className="text-sm font-medium">Statut<select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="">Tous les statuts</option>{Object.entries(saleStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {error ? <SaleError error={error} retry={() => { setError(null); setRows(null); setAttempt((value) => value + 1); }} /> : !rows ? <p role="status" className="p-8 text-center">Chargement des ventes...</p> : !visible?.length ? <p className="p-8 text-center text-slate-600">{rows.length ? "Aucune vente ne correspond à votre recherche." : "Aucune vente disponible"}</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[1250px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Référence", "Date", "Client", "Nombre de lignes", "Total", "Payé", "Reste", "Paiement", "Statut vente", "Actions"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{visible.map((row) => <tr key={row.id} className="hover:bg-slate-50"><td className="max-w-56 break-words px-5 py-4"><bdi>{row.reference}</bdi></td><td className="whitespace-nowrap px-5 py-4">{row.saleDate.split("-").reverse().join("/")}</td><td className="max-w-64 break-words px-5 py-4"><bdi dir="auto">{row.customerName || "Client comptoir"}</bdi></td><td className="px-5 py-4">{row.lines.length}</td><td className="max-w-64 break-words px-5 py-4 font-medium">{displayAmount(row.totalAmount)} DT</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(row.totalPaid)} DT</td><td className="max-w-64 break-words px-5 py-4">{displayAmount(row.remainingAmount)} DT</td><td className="px-5 py-4"><PaymentBadge status={row.paymentStatus} /></td><td className="px-5 py-4"><SaleBadge status={row.status} /></td><td className="px-5 py-4"><div className="flex gap-4 font-semibold text-emerald-800"><Link href={`/sales/${row.id}`} className="hover:underline">Voir</Link>{row.status === "DRAFT" && <><Link href={`/sales/${row.id}/edit`} className="hover:underline">Modifier</Link><button onClick={() => setSelected(row)} className="hover:underline">Confirmer</button></>}</div></td></tr>)}</tbody></table></div>}
    {selected && <ConfirmSaleDialog sale={selected} onCancel={() => setSelected(null)} onConfirmed={(updated) => { setRows((items) => items?.map((item) => item.id === updated.id ? updated : item) ?? null); setSelected(null); }} />}
  </section>;
}
