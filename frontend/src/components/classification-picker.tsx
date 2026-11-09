"use client";
import { useEffect, useState } from 'react';
import { authRequest } from '@/lib/auth';
import { fetchClassifications, readClassification, type Classification } from '@/types/classification';

export default function ClassificationPicker({ selected, onChange, onValidityChange }: { selected: number[]; onChange: (ids: number[]) => void; onValidityChange: (valid: boolean) => void }) {
  const [items, setItems] = useState<Classification[] | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [name, setName] = useState(''), [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => { onValidityChange(!busy && !!items?.some(c => c.isActive && selected.includes(c.id))); }, [items, selected, busy, onValidityChange]);
  useEffect(() => { let live = true; fetchClassifications().then(rows => { if (live) setItems(rows); }).catch((e: unknown) => { if (live) setError(e instanceof Error ? e.message : 'Chargement impossible.'); }); return () => { live = false; }; }, [attempt]);
  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true); setError('');
    try { const c = readClassification(await authRequest('/classifications', { method: 'POST', body: JSON.stringify({ nameFr: name.trim() }) })); setItems(rows => [...(rows ?? []), c]); onChange([...selected, c.id]); setName(''); setAdding(false); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Création impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3">
    <p className="text-sm text-slate-600">Sélectionnez au moins un besoin actif. Plusieurs choix sont possibles.</p>
    {!items && !error && <p role="status">Chargement des classifications...</p>}
    <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">{items?.filter(c => c.isActive).map(c => <label key={c.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="checkbox" name="classificationIds" value={c.id} disabled={busy} checked={selected.includes(c.id)} onChange={e => onChange(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} className="accent-emerald-800" /><bdi>{c.nameFr}</bdi></label>)}</div>
    {items && !items.some(c => c.isActive) && <p className="text-sm text-slate-500">Ajoutez votre premier besoin ci-dessous.</p>}
    {!adding ? <button type="button" disabled={!items} onClick={() => setAdding(true)} className="text-sm font-semibold text-emerald-800 hover:underline disabled:opacity-50">+ Ajouter un besoin</button> : <div className="flex flex-col gap-2 sm:flex-row"><label className="flex-1 text-sm">Nouveau besoin<input autoFocus value={name} maxLength={160} disabled={busy} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void create(); } }} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Ex. Cheveux" /></label><button type="button" disabled={busy || !items || !name.trim()} onClick={() => void create()} className="self-end rounded-lg border border-emerald-800 px-4 py-2 text-sm text-emerald-900 disabled:opacity-50">{busy ? 'Création...' : 'Créer et sélectionner'}</button><button type="button" disabled={busy} onClick={() => { setAdding(false); setName(''); setError(''); }} className="self-end px-3 py-2 text-sm text-slate-600">Annuler</button></div>}
    {error && <p role="alert" className="text-sm text-red-800">{error} {!items && <button type="button" className="underline" onClick={() => { setError(''); setAttempt(n => n + 1); }}>Réessayer</button>}</p>}
  </div>;
}
