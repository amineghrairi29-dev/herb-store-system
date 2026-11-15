"use client";
import { useEffect, useState, type FormEvent } from 'react';
import { authRequest } from '@/lib/auth';

interface Zone { governorate: string; fee: string | null; freeAbove: string | null; delay: string | null; isActive: boolean }
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base focus:border-emerald-700 focus:outline-emerald-700 disabled:bg-slate-50';
const trimAmount = (value: string | null) => (value === null ? '' : value.replace(/\.?0+$/, ''));

function ZoneRow({ zone, onSaved }: { zone: Zone; onSaved: (zone: Zone) => void }) {
  const [isActive, setActive] = useState(zone.isActive), [fee, setFee] = useState(trimAmount(zone.fee)), [freeAbove, setFreeAbove] = useState(trimAmount(zone.freeAbove)), [delay, setDelay] = useState(zone.delay ?? '');
  const [saving, setSaving] = useState(false), [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    if (isActive && fee.trim() === '') { setMessage({ ok: false, text: 'Indiquez les frais avant d’activer.' }); return; }
    setSaving(true); setMessage(null);
    try {
      const saved = await authRequest('/settings/delivery-zones', { method: 'PUT', body: JSON.stringify({ governorate: zone.governorate, isActive, fee: fee.trim() || '0', freeAbove: freeAbove.trim() || null, delay: delay.trim() || null }) }) as Zone;
      onSaved(saved); setMessage({ ok: true, text: 'Enregistré' });
    } catch (error: unknown) { setMessage({ ok: false, text: error instanceof Error ? error.message : 'Enregistrement impossible.' }); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className={`grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-[1.2fr_1fr_1fr_1.4fr_auto] sm:items-end ${isActive ? 'border-emerald-300' : 'border-slate-200'}`}>
    <label className="flex items-center gap-3 text-sm font-semibold sm:pb-2"><input type="checkbox" className="h-5 w-5 accent-emerald-700" checked={isActive} onChange={(event) => setActive(event.target.checked)} />{zone.governorate}</label>
    <label className="text-sm">Frais (TND)<input className={input} inputMode="decimal" value={fee} onChange={(event) => setFee(event.target.value)} placeholder="7" /></label>
    <label className="text-sm">Gratuite dès (TND)<input className={input} inputMode="decimal" value={freeAbove} onChange={(event) => setFreeAbove(event.target.value)} placeholder="Jamais" /></label>
    <label className="text-sm">Délai affiché<input className={input} maxLength={80} value={delay} onChange={(event) => setDelay(event.target.value)} placeholder="24 à 48 h" /></label>
    <div className="flex items-center gap-3">
      <button disabled={saving} className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? '…' : 'Enregistrer'}</button>
      {message && <span role={message.ok ? 'status' : 'alert'} className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-700'}`}>{message.text}</span>}
    </div>
  </form>;
}

export default function DeliverySettingsPage() {
  const [zones, setZones] = useState<Zone[] | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    authRequest('/settings/delivery-zones').then((data) => { if (active) setZones(data as Zone[]); }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Chargement impossible.'); });
    return () => { active = false; };
  }, [attempt]);
  const activeCount = zones?.filter((zone) => zone.isActive).length ?? 0;
  return <main lang="fr" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-5xl">
    <h1 className="text-3xl font-semibold tracking-tight">Livraison</h1>
    <p className="mt-3 text-sm text-slate-600">Cochez les gouvernorats où vous livrez et indiquez les frais. Seuls les gouvernorats cochés sont proposés aux clients. Tant qu’aucun n’est coché, les commandes restent possibles sans frais de livraison.</p>
    <p className="mt-2 text-sm font-medium text-emerald-800">{zones ? `${activeCount} gouvernorat${activeCount > 1 ? 's' : ''} actif${activeCount > 1 ? 's' : ''}` : ''}</p>
    {error ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"><p>{error}</p><button className="mt-3 font-semibold underline" onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Réessayer</button></div>
      : !zones ? <p role="status" className="mt-6">Chargement…</p>
      : <div className="mt-6 grid gap-3">{zones.map((zone) => <ZoneRow key={zone.governorate} zone={zone} onSaved={(saved) => setZones((list) => list?.map((row) => (row.governorate === saved.governorate ? saved : row)) ?? null)} />)}</div>}
  </div></main>;
}
