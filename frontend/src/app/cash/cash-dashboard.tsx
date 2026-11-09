"use client";
import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { displayAmount } from "@/lib/purchase-decimal";
import { readCashMovements, readCashSummary, type CashMovement, type CashSummary } from "@/types/cash";
import { CashError, cashError } from "./cash-ui";
import MovementsTable from "./movements-table";
export default function CashDashboard() {
  const [data, setData] = useState<{ summary: CashSummary; rows: CashMovement[] } | null>(null);
  const [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    Promise.all([purchaseRequest("/cash/summary"), purchaseRequest("/cash/movements")]).then(([summary, rows]) => {
      const result = { summary: readCashSummary(summary), rows: readCashMovements(rows) };
      if (active) setData(result);
    }).catch((cause: unknown) => { if (active) setError(cashError(cause)); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <CashError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} />;
  if (!data) return <p role="status" className="py-12 text-center text-slate-600">Chargement de la caisse...</p>;
  const { summary, rows } = data;
  const cards = [["Solde espèces", summary.physicalCashBalance, "Espèces uniquement"], ["Entrées espèces", summary.cashInflows, "Cumul des entrées en espèces"], ["Sorties espèces", summary.cashOutflows, "Cumul des sorties en espèces"], ["Flux financier net", summary.netFinancialFlow, "Tous les modes de paiement"]];
  return <>
    <p className="mb-6 text-sm text-slate-600">Le solde espèces est calculé à partir des mouvements en espèces. Le flux financier global inclut aussi cartes, virements, chèques et autres modes.</p>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, amount, helper]) => <div key={label} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><dt className="text-sm font-medium text-slate-600">{label}</dt><dd className="mt-3 break-words text-2xl font-semibold">{displayAmount(amount)} DT</dd><dd className="mt-2 text-xs text-slate-500">{helper}</dd></div>)}</dl>
    <div className="my-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-2"><p>Flux financier global : entrées <strong>{displayAmount(summary.totalFinancialInflows)} DT</strong> · sorties <strong>{displayAmount(summary.totalFinancialOutflows)} DT</strong></p><p>Aujourd’hui ({summary.businessDate.split("-").reverse().join("/")}, {summary.timeZone}) : entrées espèces <strong>{displayAmount(summary.todayCashInflows)} DT</strong> · sorties espèces <strong>{displayAmount(summary.todayCashOutflows)} DT</strong></p></div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Derniers mouvements</h2><Link href="/cash/movements" className="text-sm font-semibold text-emerald-800 underline">Voir tout l&apos;historique</Link></div><MovementsTable rows={rows.slice(0, 10)} />
  </>;
}
