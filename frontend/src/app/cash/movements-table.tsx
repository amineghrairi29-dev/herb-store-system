import Link from "@/components/auth-link";
import { displayAmount } from "@/lib/purchase-decimal";
import { cashSourceLabels, type CashMovement } from "@/types/cash";
import { paymentMethodLabels } from "@/types/purchase-payment";

export default function MovementsTable({ rows }: { rows: CashMovement[] }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
    {!rows.length ? <p className="p-8 text-center text-sm text-slate-600">Aucun mouvement disponible</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Date", "Sens", "Source", "Montant", "Mode", "Référence", "Description"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-slate-50">
        <td className="whitespace-nowrap px-5 py-4">{row.movementDate.split("-").reverse().join("/")}</td>
        <td className="px-5 py-4"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.type === "IN" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{row.type === "IN" ? "Entrée" : "Sortie"}</span></td>
        <td className="px-5 py-4">{cashSourceLabels[row.sourceType]}</td>
        <td className="max-w-64 break-words px-5 py-4 font-semibold">{row.type === "IN" ? "+" : "−"}{displayAmount(row.amount)} DT</td>
        <td className="px-5 py-4">{paymentMethodLabels[row.paymentMethod]}</td>
        <td className="max-w-56 break-words px-5 py-4"><bdi dir="auto">{row.reference || "—"}</bdi>{(row.linkedSaleId || row.linkedPurchaseId || row.linkedExpenseId) && <Link className="mt-2 block text-xs font-semibold text-emerald-800 underline" href={row.linkedSaleId ? `/sales/${row.linkedSaleId}` : row.linkedPurchaseId ? `/purchases/${row.linkedPurchaseId}` : `/expenses/${row.linkedExpenseId}`}><bdi dir="auto">{row.linkedReference || "Voir le document"}</bdi></Link>}</td>
        <td className="max-w-80 break-words px-5 py-4"><bdi dir="auto">{row.description}</bdi>{row.notes && <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">Notes</summary><p className="mt-2 whitespace-pre-wrap"><bdi dir="auto">{row.notes}</bdi></p></details>}</td>
      </tr>)}</tbody>
    </table></div>}
  </div>;
}
