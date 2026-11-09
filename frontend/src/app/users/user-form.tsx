"use client";
import Link from '@/components/auth-link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authRequest, roleLabels, type ManagedUser, type Role } from '@/lib/auth';
import { useAuth } from '@/components/auth-provider';
import { readManagedUser } from '@/lib/auth';
import { buttonClass, fieldClass, UserShell } from './user-ui';
export default function UserForm({ id }: { id?: string }) {
  const [existing, setExisting] = useState<ManagedUser | null>(null), [loadError, setLoadError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { if (!id) return; let active = true; authRequest(`/users/${id}`).then(value => { if (active) { setExisting(readManagedUser(value)); setLoadError(''); } }).catch((e: unknown) => { if (active) setLoadError(e instanceof Error ? e.message : 'Chargement impossible.'); }); return () => { active = false; }; }, [id, attempt]);
  return <UserShell title={id ? 'Modifier un utilisateur' : 'Nouvel utilisateur'}>{loadError ? <div role="alert">{loadError}<button onClick={() => setAttempt(v => v + 1)} className="ml-3 underline">Réessayer</button></div> : id && !existing ? <p role="status">Chargement...</p> : <Fields key={existing?.id ?? 'new'} existing={existing} />}</UserShell>;
}
function Fields({ existing }: { existing: ManagedUser | null }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [resetting, setResetting] = useState(false), [passwordError, setPasswordError] = useState(''), [notice, setNotice] = useState('');
  const { user, reload } = useAuth(), router = useRouter();
  function passwordCheck(value: string) { if ([...value].length < 8 || !/\p{L}/u.test(value) || !/[0-9]/.test(value) || new TextEncoder().encode(value).length > 72) throw new Error('Au moins 8 caractères, une lettre et un chiffre ; 72 octets UTF-8 maximum.'); }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); const fields = new FormData(event.currentTarget);
    try {
      const input = { fullName: String(fields.get('fullName') ?? '').trim(), role: fields.get('role'), isActive: fields.get('isActive') === 'on' };
      if (!input.fullName) throw new Error('Nom requis.');
      const password = String(fields.get('password') ?? ''); if (!existing) passwordCheck(password);
      await authRequest(existing ? `/users/${existing.id}` : '/users', { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(existing ? input : { ...input, email: fields.get('email'), password }) });
      if (existing?.id === user?.id) await reload(); router.push('/users'); router.refresh();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Enregistrement impossible.'); } finally { setBusy(false); }
  }
  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (resetting || !existing) return; const form = event.currentTarget, fields = new FormData(form); setResetting(true); setPasswordError(''); setNotice('');
    try { const password = String(fields.get('newPassword') ?? ''); passwordCheck(password); await authRequest(`/users/${existing.id}/password`, { method: 'PATCH', body: JSON.stringify({ password }) }); form.reset(); setNotice('Mot de passe modifié. Les sessions de cet utilisateur ont été fermées.'); if (existing.id === user?.id) { await reload(); router.replace('/login'); } }
    catch (e: unknown) { setPasswordError(e instanceof Error ? e.message : 'Modification impossible.'); } finally { setResetting(false); }
  }
  return <div className="max-w-3xl space-y-6"><form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2"><label>Nom<input name="fullName" required maxLength={150} defaultValue={existing?.fullName} className={fieldClass} dir="auto" /></label><label>Email<input name="email" type="email" required maxLength={254} readOnly={Boolean(existing)} defaultValue={existing?.email} className={fieldClass} autoComplete="off" /></label><label>Rôle<select name="role" defaultValue={existing?.role ?? 'ADMIN'} className={fieldClass}>{(Object.keys(roleLabels) as Role[]).map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>{!existing && <label>Mot de passe<input name="password" type="password" autoComplete="new-password" required minLength={8} className={fieldClass} /><span className="mt-2 block text-xs text-slate-600">8 caractères minimum, une lettre et un chiffre.</span></label>}<label className="flex items-center gap-3"><input name="isActive" type="checkbox" defaultChecked={existing?.isActive ?? true} />Actif</label></fieldset>{error && <p role="alert" className="mt-4 text-red-800">{error}</p>}<div className="mt-7 flex flex-wrap justify-end gap-4"><Link href="/users" className="rounded-lg border px-5 py-3">Annuler</Link><button disabled={busy} className={buttonClass}>{busy ? 'Enregistrement...' : 'Enregistrer'}</button></div></form>{existing && <form onSubmit={resetPassword} className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-semibold">Changer le mot de passe</h2><p className="mt-2 text-sm text-slate-600">Cette action ferme toutes les sessions de cet utilisateur.</p><label className="mt-5 block">Nouveau mot de passe<input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={fieldClass} /></label>{passwordError && <p role="alert" className="mt-4 text-red-800">{passwordError}</p>}{notice && <p role="status" className="mt-4 text-emerald-800">{notice}</p>}<button disabled={resetting} className={`${buttonClass} mt-5`}>{resetting ? 'Enregistrement...' : 'Changer le mot de passe'}</button></form>}</div>;
}
