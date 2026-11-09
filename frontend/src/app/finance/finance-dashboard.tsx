"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { purchaseRequest } from '@/lib/purchase-api';
import { displayAmount } from '@/lib/purchase-decimal';
import { readFinance, type FinanceSummary, type FinanceMetric } from '@/types/finance';
import { cashSourceLabels } from '@/types/cash';
import { paymentMethodLabels } from '@/types/purchase-payment';
import { CashError, cashError, buttonClass, secondaryClass, inputClass } from '../cash/cash-ui';
const flowCards: { key: FinanceMetric; label: string; helper: string }[] = [
  { key: 'salesRevenue', label: 'Chiffre d’affaires', helper: 'Ventes confirmées sur la période' },
  { key: 'customerCollections', label: 'Encaissements clients', helper: 'Paiements clients reçus sur la période, tous modes' },
  { key: 'purchases', label: 'Achats', helper: 'Achats confirmés sur la période' },
  { key: 'supplierPayments', label: 'Paiements fournisseurs', helper: 'Paiements fournisseurs sur la période, tous modes' },
  { key: 'expenses', label: 'Dépenses', helper: 'Dépenses hors achats fournisseurs' },
  { key: 'estimatedActivityResult', label: 'Solde activité estimé', helper: 'Ventes confirmées − achats confirmés − dépenses' },
];
const balanceCards: typeof flowCards = [
  { key: 'customerReceivables', label: 'Créances clients', helper: 'Ventes confirmées cumulées − paiements clients cumulés' },
  { key: 'supplierPayables', label: 'Dettes fournisseurs', helper: 'Achats confirmés cumulés − paiements fournisseurs cumulés' },
  { key: 'physicalCashBalance', label: 'Solde espèces', helper: 'Entrées − sorties en espèces uniquement, selon la caisse' },
];
const dateLabel = (value: string) => value.split('-').reverse().join('/');
export default function FinanceDashboard() {
  const [selection, setSelection] = useState('month'), [query, setQuery] = useState('period=month'), [attempt, setAttempt] = useState(0);
  const [dateFrom, setFrom] = useState(''), [dateTo, setTo] = useState(''), [validation, setValidation] = useState<string | null>(null);
  const [data, setData] = useState<FinanceSummary | null>(null), [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; purchaseRequest(`/finance/summary?${query}`).then(readFinance).then((value) => { if (active) setData(value); }).catch((cause: unknown) => { if (active) setError(cashError(cause)); }); return () => { active = false; }; }, [query, attempt]);
  function load(next: string) { setData(null); setError(null); setValidation(null); setQuery(next); setAttempt((value) => value + 1); }
  function preset(value: string) { setSelection(value); setValidation(null); if (value !== 'custom') load(`period=${value}`); }
  function custom(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!dateFrom || !dateTo || dateFrom > dateTo) { setValidation('Choisissez une plage de dates valide.'); return; } load(new URLSearchParams({ dateFrom, dateTo }).toString()); }
  const cards = (items: typeof flowCards) => data && <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(({ key, label, helper }) => <div key={key} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><dt className="text-sm font-medium text-slate-600">{label}</dt><dd className="mt-3 break-words text-2xl font-semibold">{displayAmount(data[key])} DT</dd><dd className="mt-2 text-xs text-slate-500">{helper}</dd></div>)}</dl>;
  const tableClass = 'w-full min-w-[560px] text-left text-sm', cell = 'max-w-64 break-words px-5 py-3', head = 'bg-slate-50 text-xs uppercase text-slate-600';
  return <>
    <section aria-label="Période du tableau de bord" className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap gap-2">{[['today', 'Aujourd’hui'], ['month', 'Ce mois'], ['year', 'Cette année'], ['custom', 'Personnalisé']].map(([value, label]) => <button key={value} type="button" aria-pressed={selection === value} className={selection === value ? buttonClass : secondaryClass} onClick={() => preset(value)}>{label}</button>)}</div>
      {selection === 'custom' && <form onSubmit={custom} className="mt-5 flex flex-wrap items-end gap-4"><label className="text-sm font-medium">Date début<input type="date" required className={inputClass} value={dateFrom} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-sm font-medium">Date fin<input type="date" required className={inputClass} value={dateTo} onChange={(event) => setTo(event.target.value)} /></label><button type="submit" className={buttonClass}>Appliquer</button><button type="button" className={secondaryClass} onClick={() => { setFrom(''); setTo(''); preset('month'); }}>Réinitialiser</button></form>}
      <p className="mt-3 text-xs text-slate-500">Ce mois et cette année : du début de la période à aujourd’hui, selon le fuseau de la caisse.</p>
      {validation && <CashError error={validation} />}
    </section>
    {error ? <CashError error={error} retry={() => load(query)} /> : !data ? <p role="status" className="py-12 text-center text-slate-600">Chargement des indicateurs financiers...</p> : <>
      <h2 className="mb-4 text-lg font-semibold">Activité du {dateLabel(data.period.dateFrom)} au {dateLabel(data.period.dateTo)}</h2>{cards(flowCards)}
      <p className="my-5 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">Le solde activité estimé est un indicateur simplifié. Les achats représentent des acquisitions de stock, pas le coût des produits vendus. Ce montant n’est pas un bénéfice net comptable.</p>
      <h2 className="mb-4 mt-8 text-lg font-semibold">Soldes au {dateLabel(data.balanceAsOf)}</h2>{cards(balanceCards)}
      <p className="mt-3 text-xs text-slate-500">Soldes cumulés jusqu’à la date de fin incluse, indépendamment de la date de début. Fuseau : {data.period.timeZone}. Calculés à partir des enregistrements actuels ; les corrections de dépenses peuvent modifier les vues passées.</p>
      <section className="my-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">À surveiller</h2><ul className="mt-3 space-y-2 text-sm text-slate-600">{data.attention.customerReceivables && <li>Créances clients à encaisser : {displayAmount(data.customerReceivables)} DT.</li>}{data.attention.supplierPayables && <li>Dettes fournisseurs à régler : {displayAmount(data.supplierPayables)} DT.</li>}{data.attention.negativeCash && <li>Le solde espèces enregistré est négatif : {displayAmount(data.physicalCashBalance)} DT.</li>}{!Object.values(data.attention).some(Boolean) && <li>Aucun point signalé pour ces trois indicateurs.</li>}</ul></section>
      <h2 className="mb-2 mt-8 text-lg font-semibold">Flux par mode de paiement</h2><p className="mb-4 text-sm text-slate-600">Mouvements de caisse sur la période, y compris dépenses et mouvements manuels. Seules les espèces affectent le solde physique.</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className={tableClass}><thead className={head}><tr>{['Mode', 'Entrées', 'Sorties', 'Net'].map((label) => <th scope="col" className={cell} key={label}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.byPaymentMethod.map((row) => <tr key={row.paymentMethod}><th scope="row" className={`${cell} font-medium`}>{paymentMethodLabels[row.paymentMethod]}</th>{[row.inflows, row.outflows, row.net].map((value, index) => <td key={index} className={cell}>{displayAmount(value)} DT</td>)}</tr>)}</tbody></table></div>
      <h2 className="mb-2 mt-8 text-lg font-semibold">Évolution financière</h2><p className="mb-4 text-sm text-slate-600">Par {data.grouping === 'day' ? 'jour' : 'mois'} · dates avec activité uniquement · montants en DT</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{!data.evolution.length ? <p className="p-6 text-center text-sm text-slate-600">Aucune vente, aucun encaissement ni dépense sur la période.</p> : <table className={tableClass}><thead className={head}><tr>{['Date', 'Ventes', 'Encaissements', 'Dépenses'].map((label) => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.evolution.map((row) => <tr key={row.date}><th scope="row" className={`${cell} font-medium`}>{dateLabel(row.date)}</th><td className={cell}>{displayAmount(row.sales)}</td><td className={cell}>{displayAmount(row.collections)}</td><td className={cell}>{displayAmount(row.expenses)}</td></tr>)}</tbody></table>}</div>
      <h2 className="mb-4 mt-8 text-lg font-semibold">Dernières opérations financières</h2>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">{!data.recentActivity.length ? <p className="p-6 text-center text-sm text-slate-600">Aucune opération financière sur la période.</p> : <table className="w-full min-w-[850px] text-left text-sm"><thead className={head}><tr>{['Date', 'Type', 'Référence', 'Montant', 'Sens', 'Mode'].map((label) => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.recentActivity.map((row) => <tr key={row.id}><td className={cell}>{dateLabel(row.movementDate)}</td><td className={cell}>{cashSourceLabels[row.sourceType]}</td><td className={cell}><bdi dir="auto">{row.reference || '—'}</bdi></td><td className={cell}>{displayAmount(row.amount)} DT</td><td className={`${cell} ${row.type === 'IN' ? 'text-emerald-800' : 'text-amber-900'}`}>{row.type === 'IN' ? 'Entrée' : 'Sortie'}</td><td className={cell}>{paymentMethodLabels[row.paymentMethod]}</td></tr>)}</tbody></table>}</div>
    </>}
  </>;
}
