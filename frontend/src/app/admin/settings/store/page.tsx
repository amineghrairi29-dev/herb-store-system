"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authRequest } from '@/lib/auth';
import { readStoreSettings, storeFields, type StoreField, type StoreSettings } from '@/types/store-settings';
const inputClass = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-emerald-700 focus:outline-emerald-700';
const sections: { title: string; fields: StoreField[] }[] = [
  { title: 'Informations générales', fields: ['storeName', 'phone', 'secondaryPhone', 'email', 'website'] },
  { title: 'Adresse', fields: ['address', 'city', 'country'] },
  { title: 'Paramètres commerciaux', fields: [] },
  { title: 'Rapports', fields: ['reportFooter'] },
];
export default function StoreSettingsPage() {
  const [values, setValues] = useState<StoreSettings | null>(null), [loadError, setLoadError] = useState(''), [saveError, setSaveError] = useState(''), [success, setSuccess] = useState(false), [saving, setSaving] = useState(false), [attempt, setAttempt] = useState(0);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    authRequest('/settings/store').then(readStoreSettings).then(data => { if (active) setValues(data); }).catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : 'Chargement impossible.'); });
    return () => { active = false; };
  }, [attempt]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!values || pending.current) return;
    setSuccess(false); setSaveError('');
    if (!values.storeName.trim()) { setSaveError('Le nom du magasin est obligatoire.'); return; }
    pending.current = true; setSaving(true);
    try {
      const result = readStoreSettings(await authRequest('/settings/store', { method: 'PATCH', body: JSON.stringify(values) }));
      setValues(result); setSuccess(true); window.dispatchEvent(new Event('store:updated'));
    } catch (error: unknown) { setSaveError(error instanceof Error ? error.message : 'Enregistrement impossible.'); }
    finally { pending.current = false; setSaving(false); }
  }
  return <main lang="fr" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-4xl">
    <h1 className="text-3xl font-semibold tracking-tight">Paramètres du magasin</h1><p className="mt-3 text-sm text-slate-600">Identité du magasin et informations affichées sur vos rapports. Les champs marqués * sont obligatoires.</p>
    {loadError ? <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5"><p>Impossible de charger les paramètres. {loadError}</p><button className="mt-4 font-semibold underline" onClick={() => { setLoadError(''); setAttempt(value => value + 1); }}>Réessayer</button></div> : !values ? <p role="status" className="py-12">Chargement des paramètres...</p> : <form className="mt-8 space-y-6" onSubmit={save}>
      {sections.map(section => <fieldset key={section.title} disabled={saving} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6"><legend className="px-2 text-lg font-semibold">{section.title}</legend><div className="grid gap-5 sm:grid-cols-2">
        {section.fields.map(key => <label key={key} className={`text-sm font-medium ${['address', 'reportFooter'].includes(key) ? 'sm:col-span-2' : ''}`}>{storeFields[key].label}{key === 'storeName' ? ' *' : ''}
          {['address', 'reportFooter'].includes(key) ? <textarea name={key} dir="auto" rows={3} maxLength={storeFields[key].max} className={inputClass} value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setSuccess(false); }} /> : <input name={key} dir="auto" type={key === 'email' ? 'email' : key === 'website' ? 'url' : key.toLowerCase().includes('phone') ? 'tel' : 'text'} required={key === 'storeName'} maxLength={storeFields[key].max} className={inputClass} value={values[key]} onChange={event => { setValues({ ...values, [key]: event.target.value }); setSuccess(false); }} />}
        </label>)}
        {!section.fields.length && <label className="text-sm font-medium">Devise *<input name="currency" value="TND" readOnly className={`${inputClass} bg-slate-50`} /><span className="mt-2 block text-xs text-slate-500">Dinar tunisien (TND). Les montants sont affichés en DT.</span></label>}
      </div></fieldset>)}
      {saveError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">{saveError}</p>}
      {success && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">Les paramètres du magasin ont été enregistrés.</p>}
      <button type="submit" disabled={saving} className="rounded-lg bg-emerald-800 px-5 py-3 font-semibold text-white hover:bg-emerald-900 disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
    </form>}
  </div></main>;
}
