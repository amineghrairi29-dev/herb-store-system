import Link from "@/components/auth-link";
import type { Purchase } from "@/types/purchase";
import { paymentMethodLabels, paymentStatusLabels, type PaymentStatus } from "@/types/purchase-payment";
import { displayAmount } from "@/lib/purchase-decimal";
import { buttonClass } from "./purchase-ui";

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${status === "PAID" ? "bg-emerald-50 text-emerald-800" : status === "PARTIALLY_PAID" ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}>{paymentStatusLabels[status]}</span>;
}
export function PaymentSummary({ purchase, showAction = false }: { purchase: Purchase; showAction?: boolean }) {
  return <section aria-label="Résumé du paiement" className="my-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-lg font-semibold">Paiement de l’achat</h2>
    <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[['Total achat', purchase.totalAmount], ['Total payé', purchase.totalPaid], ['Reste à payer', purchase.remainingAmount]].map(([label, amount]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 break-words font-semibold">{displayAmount(amount)} DT</dd></div>)}
      <div><dt className="mb-2 text-sm text-slate-500">Statut paiement</dt><dd><PaymentBadge status={purchase.paymentStatus} /></dd></div>
    </dl>
    {showAction && purchase.status === "CONFIRMED" && purchase.paymentStatus !== "PAID" && /[1-9]/.test(purchase.remainingAmount) && <Link href={`/purchases/${purchase.id}/payments/new`} className={`${buttonClass} mt-6`}>Ajouter un paiement</Link>}
  </section>;
}
export function PaymentHistory({ purchase }: { purchase: Purchase }) {
  return <section className="my-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 p-6 text-lg font-semibold">Historique des paiements</h2>
    {!purchase.payments.length ? <p className="p-8 text-center text-sm text-slate-600">Aucun paiement enregistré</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Date", "Montant", "Mode", "Référence", "Notes"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{purchase.payments.map((payment) => <tr key={payment.id}><td className="whitespace-nowrap px-5 py-4">{payment.paymentDate.split("-").reverse().join("/")}</td><td className="max-w-64 break-words px-5 py-4 font-medium">{displayAmount(payment.amount)} DT</td><td className="px-5 py-4">{paymentMethodLabels[payment.paymentMethod]}</td><td className="max-w-56 break-words px-5 py-4"><bdi dir="auto">{payment.reference || "—"}</bdi></td><td className="max-w-80 whitespace-pre-wrap break-words px-5 py-4"><bdi dir="auto">{payment.notes || "—"}</bdi></td></tr>)}</tbody></table></div>}
  </section>;
}
