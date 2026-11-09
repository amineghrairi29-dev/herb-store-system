import Link from "@/components/auth-link";
import type { Sale } from "@/types/sale";
import { paymentMethodLabels } from "@/types/purchase-payment";
import { displayAmount } from "@/lib/purchase-decimal";
import { PaymentBadge } from "../purchases/purchase-payments";
import { buttonClass } from "./sale-ui";
export function PaymentSummary({ sale, showAction = false }: { sale: Sale; showAction?: boolean }) {
  return <section aria-label="Résumé du paiement" className="my-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">Paiement de la vente</h2>
    <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[["Total vente", sale.totalAmount], ["Total payé", sale.totalPaid], ["Reste à payer", sale.remainingAmount]].map(([label, amount]) => <div key={label}><dt className="text-sm text-slate-500">{label}</dt><dd className="mt-2 break-words font-semibold">{displayAmount(amount)} DT</dd></div>)}<div><dt className="mb-2 text-sm text-slate-500">Statut paiement</dt><dd><PaymentBadge status={sale.paymentStatus} /></dd></div></dl>
    {showAction && sale.status === "CONFIRMED" && sale.paymentStatus !== "PAID" && /[1-9]/.test(sale.remainingAmount) && <Link href={`/sales/${sale.id}/payments/new`} className={`${buttonClass} mt-6`}>Ajouter un paiement</Link>}
  </section>;
}
export function PaymentHistory({ sale }: { sale: Sale }) {
  return <section className="my-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-200 p-6 text-lg font-semibold">Historique des paiements</h2>
    {!sale.payments.length ? <p className="p-8 text-center text-sm text-slate-600">Aucun paiement enregistré</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Date", "Montant", "Mode", "Référence", "Notes"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{sale.payments.map((payment) => <tr key={payment.id}><td className="whitespace-nowrap px-5 py-4">{payment.paymentDate.split("-").reverse().join("/")}</td><td className="max-w-64 break-words px-5 py-4 font-medium">{displayAmount(payment.amount)} DT</td><td className="px-5 py-4">{paymentMethodLabels[payment.paymentMethod]}</td><td className="max-w-56 break-words px-5 py-4"><bdi dir="auto">{payment.reference || "—"}</bdi></td><td className="max-w-80 whitespace-pre-wrap break-words px-5 py-4"><bdi dir="auto">{payment.notes || "—"}</bdi></td></tr>)}</tbody></table></div>}
  </section>;
}
