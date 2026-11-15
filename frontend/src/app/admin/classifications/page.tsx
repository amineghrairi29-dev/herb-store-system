"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { authRequest } from '@/lib/auth';
import { fetchClassifications, type Classification } from '@/types/classification';

export default function ClassificationsPage() {
  const [rows, setRows] = useState<Classification[] | null>(null), [editing, setEditing] = useState<Classification | null>(null);
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0), [formKey, setFormKey] = useState(0);
  useEffect(() => { let live = true; fetchClassifications().then(data => { if (live) setRows(data); }).catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Chargement impossible.'); }); return () => { live = false; }; }, [attempt]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return; const data = new FormData(e.currentTarget);
    setBusy(true); setError('');
    try { await authRequest(`/classifications${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify({ nameFr: String(data.get('nameFr') ?? '').trim(), nameAr: String(data.get('nameAr') ?? '').trim(), sortOrder: Number(data.get('sortOrder')), isActive: data.has('isActive') }) }); setRows(await fetchClassifications()); setEditing(null); setFormKey(n => n + 1); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  const field = 'mt-1 w-full rounded-lg border border-slate-300 px-3 py-2';
  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-6xl"><h1 className="text-3xl font-semibold">Besoins produits</h1><p className="mt-2 text-sm text-slate-600">Des besoins réutilisables pour organiser vos produits.</p>
    {error && <div role="alert" className="my-4 rounded-lg bg-red-50 p-4 text-red-800">{error} <button className="underline" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Réessayer</button></div>}
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]"><section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">Classifications disponibles</h2>{!rows ? <p role="status" className="mt-4">Chargement...</p> : !rows.length ? <p className="mt-4 text-sm text-slate-500">Aucune classification. Créez-en une pour commencer.</p> : <ul className="mt-3 divide-y divide-slate-100">{rows.map(c => <li key={c.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words font-medium"><bdi>{c.nameFr}</bdi></p><p className="text-xs text-slate-500">{c.productCount ?? 0} produit(s) · {c.isActive ? 'Active' : 'Désactivée'}</p></div><button disabled={busy} onClick={() => { setEditing(c); setError(''); }} className="text-sm font-semibold text-emerald-800 hover:underline">Modifier</button></li>)}</ul>}</section>
    <form key={`${editing?.id ?? 'new'}-${formKey}`} onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-semibold">{editing ? 'Modifier la classification' : 'Nouvelle classification'}</h2><fieldset disabled={busy} className="mt-4 space-y-4 text-sm"><label className="block">Nom *<input name="nameFr" required maxLength={160} defaultValue={editing?.nameFr ?? ''} dir="auto" className={field} /></label><label className="block">Nom arabe<input name="nameAr" maxLength={160} defaultValue={editing?.nameAr ?? ''} dir="auto" className={field} /></label><label className="block">Ordre d’affichage<input name="sortOrder" type="number" min={0} step={1} required defaultValue={editing?.sortOrder ?? 0} className={field} /></label><label className="flex items-center gap-2"><input name="isActive" type="checkbox" defaultChecked={editing?.isActive ?? true} />Active</label>{editing && <p className="text-xs text-slate-500">La désactivation conserve les liens. Les produits sans autre classification active sont masqués dans la boutique.</p>}<div className="flex flex-wrap gap-3"><button className="rounded-lg bg-emerald-800 px-4 py-2 text-white">{busy ? 'Enregistrement...' : 'Enregistrer'}</button>{editing && <button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Annuler</button>}</div></fieldset></form></div>
  </div></main>;
}
