"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { fallbackIdentity, readReportIdentity, type ReportIdentity } from '@/types/store-settings';
import Link from '@/components/auth-link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { purchaseRequest } from '@/lib/purchase-api';
import { reportCatalog, readReport, type Report, type ReportKind } from '@/types/report';
import { paymentMethodLabels, paymentStatusLabels } from '@/types/purchase-payment';
import { expenseCategoryLabels } from '@/types/expense';
import { cashSourceLabels } from '@/types/cash';
import { CashError, cashError, buttonClass, inputClass, secondaryClass } from '../cash/cash-ui';
import ReportContent from './report-content';
import './reports.css';
const options: Record<string, Record<string, string>> = { status: { CONFIRMED: 'Confirmé', DRAFT: 'Brouillon', CANCELLED: 'Annulé', ALL: 'Tous les statuts' }, paymentStatus: paymentStatusLabels, paymentMethod: paymentMethodLabels, category: expenseCategoryLabels, type: { IN: 'Entrée', OUT: 'Sortie' }, sourceType: cashSourceLabels };
const labels: Record<string, string> = { status: 'Statut', paymentStatus: 'Statut paiement', paymentMethod: 'Mode de paiement', category: 'Catégorie', type: 'Sens', sourceType: 'Source', supplierId: 'Fournisseur', search: 'Recherche' };
export default function ReportPage({ kind }: { kind: ReportKind }) {
  const definition = reportCatalog[kind];
  const [mode, setMode] = useState('month'), [from, setFrom] = useState(''), [to, setTo] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('period=month'), [attempt, setAttempt] = useState(0), [report, setReport] = useState<Report | null>(null), [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({}), [supplierError, setSupplierError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'csv' | 'print' | null>(null), [exportError, setExportError] = useState<string | null>(null), [printReport, setPrintReport] = useState<Report | null>(null);
  const pending = useRef(false);
  const [identity, setIdentity] = useState<ReportIdentity>(fallbackIdentity);
  useEffect(() => { let active = true; purchaseRequest('/reports/store-info/identity').then(readReportIdentity).then(value => { if (active) setIdentity(value); }).catch(() => { if (active) setIdentity(fallbackIdentity); }); return () => { active = false; }; }, [attempt]);
  useEffect(() => { let active = true; purchaseRequest(`/reports/${kind}?${query}`).then(readReport).then((value) => { if (active) setReport(value); }).catch((cause: unknown) => { if (active) setError(cashError(cause)); }); return () => { active = false; }; }, [kind, query, attempt]);
  useEffect(() => {
    if (kind !== 'purchases' && kind !== 'supplier-payments') return;
    let active = true;
    purchaseRequest('/suppliers').then((data) => { if (!Array.isArray(data)) throw new Error('Liste des fournisseurs invalide.'); const entries: [string, string][] = data.map((row: unknown) => { if (!row || typeof row !== 'object' || !('id' in row) || typeof row.id !== 'number' || !('name' in row) || typeof row.name !== 'string') throw new Error('Fournisseur invalide.'); return [String(row.id), row.name]; }); if (active) { setSuppliers(Object.fromEntries(entries)); setSupplierError(null); } }).catch((cause: unknown) => { if (active) setSupplierError(cashError(cause)); });
    return () => { active = false; };
  }, [kind, attempt]);
  useEffect(() => {
    if (!printReport) return;
    const done = () => { setPrintReport(null); setBusy(null); pending.current = false; };
    window.addEventListener('afterprint', done);
    const frame = requestAnimationFrame(() => { try { window.print(); } catch (cause: unknown) { setExportError(cashError(cause)); done(); } });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('afterprint', done); };
  }, [printReport]);
  function load(next: string) { setReport(null); setError(null); setExportError(null); setQuery(next); setAttempt((value) => value + 1); }
  function build(preset = mode) { const next = new URLSearchParams(); if (preset === 'custom') { next.set('dateFrom', from); next.set('dateTo', to); } else next.set('period', preset); for (const [key, value] of Object.entries(fields)) if (value) next.set(key, value); return next.toString(); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (mode === 'custom' && (!from || !to || from > to)) { setExportError('Choisissez une plage de dates valide.'); return; } load(build()); }
  function paginate(page: number, pageSize?: string) { const next = new URLSearchParams(query); next.set('page', String(page)); if (pageSize) next.set('pageSize', pageSize); load(next.toString()); }
  async function output(type: 'csv' | 'print') {
    if (pending.current || !report) return; pending.current = true; setBusy(type); setExportError(null);
    try {
      if (type === 'print') { const next = new URLSearchParams(query); next.set('view', 'print'); const [freshReport, freshIdentity] = await Promise.all([purchaseRequest(`/reports/${kind}?${next}`).then(readReport), purchaseRequest('/reports/store-info/identity').then(readReportIdentity).catch(() => fallbackIdentity)]); setIdentity(freshIdentity); setPrintReport(freshReport); return; }
      const response = await authFetch(`${apiBase}/reports/${kind}/export.csv?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Échec de l’export (HTTP ${response.status}). ${await response.text()}`);
      const url = URL.createObjectURL(await response.blob()), anchor = document.createElement('a'); anchor.href = url; anchor.download = `${kind}-${report.period.dateFrom}-${report.period.dateTo}.csv`; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause: unknown) { setExportError(cashError(cause)); }
    setBusy(null); pending.current = false;
  }
  return <main lang="fr" className={`report-root min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12 ${printReport ? 'print-ready' : ''}`}>
    <div className="report-screen mx-auto max-w-7xl">
      <nav aria-label="Navigation" className="report-controls mb-6 flex flex-wrap gap-5 text-sm font-semibold text-emerald-800"><Link href="/reports">Rapports</Link><Link href="/finance">Finance</Link><Link href="/cash">Caisse</Link></nav>
      <form onSubmit={submit} className="report-controls mb-6 rounded-xl border border-slate-200 bg-white p-5"><fieldset disabled={busy !== null}>
        <legend className="sr-only">Filtres du rapport</legend><div className="flex flex-wrap gap-2">{[['today', 'Aujourd’hui'], ['month', 'Ce mois'], ['year', 'Cette année'], ['custom', 'Personnalisé']].map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} className={mode === value ? buttonClass : secondaryClass} onClick={() => { setMode(value); if (value !== 'custom') load(build(value)); }}>{label}</button>)}</div>
        <p className="mt-3 text-xs text-slate-500">Ce mois / cette année : jusqu’à aujourd’hui, selon le fuseau de la caisse. Appliquez les filtres avant d’exporter.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{mode === 'custom' && <><label className="text-sm font-medium">Date début<input required type="date" className={inputClass} value={from} onChange={(event) => setFrom(event.target.value)} /></label><label className="text-sm font-medium">Date fin<input required type="date" className={inputClass} value={to} onChange={(event) => setTo(event.target.value)} /></label></>}
          {definition.filters.map((key) => <label key={key} className="text-sm font-medium">{labels[key]}{key === 'search' ? <input type="search" maxLength={200} dir="auto" className={inputClass} placeholder={kind === 'sales' || kind === 'customer-collections' ? 'Référence ou client' : kind === 'expenses' ? 'Référence ou description' : 'Référence'} value={fields[key] ?? ''} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /> : <select className={inputClass} value={fields[key] ?? ''} onChange={(event) => setFields({ ...fields, [key]: event.target.value })}><option value="">{key === 'status' ? 'Confirmé (par défaut)' : 'Tous'}</option>{Object.entries(key === 'supplierId' ? suppliers : options[key]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</label>)}
          {kind !== 'financial-summary' && <><label className="text-sm font-medium">Trier par<select className={inputClass} value={fields.sortBy ?? 'date'} onChange={(event) => setFields({ ...fields, sortBy: event.target.value })}><option value="date">Date</option><option value="reference">Référence</option><option value="amount">Montant</option></select></label><label className="text-sm font-medium">Ordre<select className={inputClass} value={fields.sortOrder ?? 'desc'} onChange={(event) => setFields({ ...fields, sortOrder: event.target.value })}><option value="desc">Décroissant</option><option value="asc">Croissant</option></select></label></>}
        </div><div className="mt-5 flex flex-wrap gap-2"><button className={buttonClass} type="submit">Appliquer</button><button className={secondaryClass} type="button" onClick={() => { setFields({}); setMode('month'); setFrom(''); setTo(''); load('period=month'); }}>Réinitialiser</button></div>
      </fieldset>{supplierError && <CashError error={supplierError} retry={() => setAttempt((value) => value + 1)} />}</form>
      <div className="report-controls mb-6 flex flex-wrap gap-3"><button className={secondaryClass} disabled={!!busy || !report} onClick={() => output('csv')}>{busy === 'csv' ? 'Export en cours...' : 'Exporter CSV'}</button><button className={secondaryClass} disabled={!!busy || !report} onClick={() => output('print')}>{busy === 'print' ? 'Préparation...' : 'Imprimer / PDF'}</button></div>
      {exportError && <CashError error={exportError} />}{error ? <CashError error={error} retry={() => load(query)} /> : report ? <><ReportContent report={report} identity={identity} /><div className="report-controls mt-5 flex flex-wrap items-center justify-between gap-3"><label className="text-sm">Lignes par page<select className="ml-3 rounded border border-slate-300 bg-white px-3 py-2" value={report.pagination.pageSize} disabled={!!busy} onChange={(event) => paginate(1, event.target.value)}>{[25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label><div className="flex gap-3"><button className={secondaryClass} disabled={!!busy || report.pagination.page <= 1} onClick={() => paginate(report.pagination.page - 1)}>Précédent</button><button className={secondaryClass} disabled={!!busy || report.pagination.page >= report.pagination.totalPages} onClick={() => paginate(report.pagination.page + 1)}>Suivant</button></div></div></> : <p role="status" className="py-12 text-center text-slate-600">Chargement du rapport...</p>}
    </div>
    {printReport && <div className="report-print-view"><ReportContent report={printReport} identity={identity} /></div>}
  </main>;
}
