'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from '@/components/auth-link';
import { authRequest } from '@/lib/auth';
import { fetchCategories, modeLabels, type Category, type Subcategory } from '@/types/category';

const field = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:outline-emerald-700';
const button = 'rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50';
const secondary = 'rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold';

function ClassificationForm({ record, subcategory, pending, onSave, onCancel }: {
  record?: Category | Subcategory; subcategory?: boolean; pending: boolean;
  onSave: (body: Record<string, string | number | boolean>) => Promise<void>; onCancel?: () => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const body: Record<string, string | number | boolean> = {
      nameAr: String(data.get('nameAr') ?? '').trim(), nameFr: String(data.get('nameFr') ?? '').trim(),
      slug: String(data.get('slug') ?? '').trim(), sortOrder: Number(data.get('sortOrder')), isActive: data.has('isActive'),
    };
    if (!subcategory) body.measurementMode = String(data.get('measurementMode'));
    void onSave(body);
  }
  return <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-8">
    <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
      <legend className="sr-only">Classification</legend>
      <label className="text-sm font-medium">Nom arabe *<input name="nameAr" required maxLength={160} dir="auto" defaultValue={record?.nameAr} className={field} /></label>
      <label className="text-sm font-medium">Nom français *<input name="nameFr" required maxLength={160} dir="auto" defaultValue={record?.nameFr} className={field} /></label>
      <label className="text-sm font-medium">Slug *<input name="slug" required maxLength={160} pattern="[a-z0-9]+(-[a-z0-9]+)*" title="Lettres minuscules, chiffres et tirets" defaultValue={record?.slug} className={field} /><span className="mt-1 block text-xs text-slate-500">Exemple : huiles-naturelles</span></label>
      {!subcategory && <label className="text-sm font-medium">Mode de mesure *<select name="measurementMode" required defaultValue={record && 'measurementMode' in record ? record.measurementMode : 'WEIGHT'} className={field}>{Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      <label className="text-sm font-medium">Ordre *<input name="sortOrder" required type="number" min={0} max={2147483647} step={1} defaultValue={record?.sortOrder ?? 0} className={field} /></label>
      <label className="flex items-center gap-2 text-sm font-medium"><input name="isActive" type="checkbox" defaultChecked={record?.isActive ?? true} className="accent-emerald-800" />Actif</label>
      {!subcategory && <p className="text-sm text-slate-500 sm:col-span-2">Le mode limite les unités autorisées. Sa modification sera refusée si des produits existants deviennent incompatibles.</p>}
      <div className="flex flex-wrap justify-end gap-3 sm:col-span-2">{onCancel ? <button type="button" onClick={onCancel} className={secondary}>Annuler</button> : <Link href="/categories" className={secondary}>Annuler</Link>}<button className={button}>{pending ? 'Enregistrement...' : 'Enregistrer'}</button></div>
    </fieldset>
  </form>;
}

export default function CategoryWorkspace({ mode = 'list', id }: { mode?: 'list' | 'new' | 'edit' | 'subcategories'; id?: number }) {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState<Subcategory | 'new' | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    fetchCategories().then(value => { if (live) setCategories(value); }).catch((cause: unknown) => { if (live) setError(cause instanceof Error ? cause.message : 'Chargement impossible.'); });
    return () => { live = false; };
  }, [retry]);
  const category = categories?.find(value => value.id === id);
  async function write(path: string, body: Record<string, string | number | boolean>, method: 'POST' | 'PATCH', redirect = false) {
    if (lock.current) return;
    lock.current = true; setPending(true); setError('');
    try {
      await authRequest(path, { method, body: JSON.stringify(body) });
      if (redirect) { window.location.replace('/categories'); return; }
      setCategories(await fetchCategories()); setEditing(null);
    } catch (cause: unknown) { setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.'); }
    finally { lock.current = false; setPending(false); }
  }
  const title = mode === 'new' ? 'Ajouter une catégorie' : mode === 'edit' ? 'Modifier la catégorie' : mode === 'subcategories' ? 'Gérer les sous-catégories' : 'Gestion des catégories';
  return <main lang="fr" className="min-h-screen min-w-0 flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className={`mx-auto ${mode === 'new' || mode === 'edit' ? 'max-w-3xl' : 'max-w-7xl'}`}>
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Catalogue</p><h1 className="text-3xl font-semibold">{title}</h1>{category && <p className="mt-3"><bdi>{category.nameFr}</bdi> · <bdi>{category.nameAr}</bdi></p>}</div>{mode === 'list' ? <Link href="/categories/new" className={button}>Ajouter une catégorie</Link> : <Link href="/categories" className={secondary}>Retour aux catégories</Link>}</header>
    {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">{error}{!categories && <button onClick={() => { setError(''); setRetry(value => value + 1); }} className="ml-4 underline">Réessayer</button>}</div>}
    {!categories ? <p role="status">Chargement...</p> : mode === 'new' ? <ClassificationForm pending={pending} onSave={body => write('/categories', body, 'POST', true)} /> : mode !== 'list' && !category ? <p role="alert">Catégorie introuvable.</p> : category?.isInternal ? <p>Catégorie interne de migration : reclassez ses produits depuis la gestion des produits.</p> : mode === 'edit' ? <ClassificationForm record={category} pending={pending} onSave={body => write(`/categories/${id}`, body, 'PATCH', true)} /> : mode === 'subcategories' && category ? <>
      <div className="mb-5 flex flex-wrap items-center gap-4"><button disabled={pending || !category.isActive} className={button} onClick={() => setEditing('new')}>Ajouter une sous-catégorie</button>{!category.isActive && <p className="text-sm text-slate-500">Réactivez la catégorie pour ajouter une sous-catégorie.</p>}</div>
      {editing && <div className="mb-6"><h2 className="mb-3 text-lg font-semibold">{editing === 'new' ? 'Ajouter une sous-catégorie' : 'Modifier la sous-catégorie'}</h2><ClassificationForm key={editing === 'new' ? 'new' : editing.id} subcategory record={editing === 'new' ? undefined : editing} pending={pending} onCancel={() => setEditing(null)} onSave={body => editing === 'new' ? write(`/categories/${id}/subcategories`, body, 'POST') : write(`/subcategories/${editing.id}`, body, 'PATCH')} /></div>}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Ordre', 'Nom arabe', 'Nom français', 'Statut', 'Actions'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{category.subcategories.map(sub => <tr key={sub.id} className="border-t border-slate-100"><td className="p-4">{sub.sortOrder}</td><td className="p-4"><bdi>{sub.nameAr}</bdi></td><td className="p-4"><bdi>{sub.nameFr}</bdi></td><td className="p-4">{sub.isActive ? 'Actif' : 'Inactif'}</td><td className="p-4"><div className="flex flex-wrap gap-4"><button disabled={pending} onClick={() => setEditing(sub)} className="font-semibold text-emerald-800">Modifier</button><button disabled={pending} className="font-semibold text-amber-800" onClick={() => void write(`/subcategories/${sub.id}`, { isActive: !sub.isActive }, 'PATCH')}>{sub.isActive ? 'Désactiver' : 'Activer'}</button></div></td></tr>)}</tbody></table>{!category.subcategories.length && <p className="p-5">Aucune sous-catégorie</p>}</div>
    </> : <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Ordre', 'Nom arabe', 'Nom français', 'Mode de mesure', 'Statut', 'Sous-catégories', 'Actions'].map(label => <th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{categories.map(row => <tr key={row.id} className="border-t border-slate-100"><td className="p-4">{row.sortOrder}</td><td className="p-4"><bdi>{row.nameAr}</bdi></td><td className="p-4"><bdi>{row.nameFr}</bdi></td><td className="p-4">{modeLabels[row.measurementMode]}</td><td className="p-4">{row.isActive ? 'Actif' : 'Inactif'}</td><td className="p-4">{row.subcategories.length}</td><td className="p-4">{row.isInternal ? <span className="text-slate-500">À reclasser dans Produits</span> : <div className="flex flex-wrap gap-3"><Link href={`/categories/${row.id}/edit`} className="font-semibold text-emerald-800">Modifier</Link><button disabled={pending} className="font-semibold text-amber-800" onClick={() => void write(`/categories/${row.id}`, { isActive: !row.isActive }, 'PATCH')}>{row.isActive ? 'Désactiver' : 'Activer'}</button><Link href={`/categories/${row.id}/subcategories`} className="font-semibold text-emerald-800">Gérer sous-catégories</Link></div>}</td></tr>)}</tbody></table>{!categories.length && <p className="p-5">Aucune catégorie disponible.</p>}</div>}
    <span className="sr-only" role="status">{pending ? 'Enregistrement...' : ''}</span>
  </div></main>;
}
