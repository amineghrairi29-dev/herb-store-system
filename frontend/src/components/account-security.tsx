"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { apiBase } from '@/lib/api-base';
import styles from './account-security.module.css';

export default function AccountSecurity({ endpoint, email, refresh, theme = 'shop' }: {
  endpoint: '/public/auth' | '/auth/account'; email: string; refresh: () => Promise<unknown>; theme?: 'shop' | 'admin';
}) {
  const [enabled, setEnabled] = useState<boolean | null>(null), [loadError, setLoadError] = useState(false), [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [success, setSuccess] = useState('');
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}${endpoint}/security`, { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); const body: unknown = await response.json(); if (!body || typeof body !== 'object' || !('hasPassword' in body) || typeof body.hasPassword !== 'boolean') throw new Error(); setEnabled(body.hasPassword); setLoadError(false); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); });
    return () => controller.abort();
  }, [endpoint, attempt]);
  async function save(event: FormEvent<HTMLFormElement>, action: 'email' | 'password') {
    event.preventDefault(); if (pending.current) return;
    const form = event.currentTarget, values = new FormData(form);
    const data = action === 'email'
      ? { email: String(values.get('email') ?? '').trim(), currentPassword: String(values.get('currentPassword') ?? '') }
      : { currentPassword: String(values.get('currentPassword') ?? ''), newPassword: String(values.get('newPassword') ?? ''), confirmPassword: String(values.get('confirmPassword') ?? '') };
    setSuccess(''); setError('');
    if (action === 'password' && 'newPassword' in data && (data.newPassword !== data.confirmPassword || new TextEncoder().encode(data.newPassword).length > 72)) {
      setError('Vérifiez la confirmation du mot de passe (72 octets maximum).'); return;
    }
    pending.current = true; setBusy(true);
    try {
      const response = await fetch(`${apiBase}${endpoint}/${action}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(data), signal: AbortSignal.timeout(20000) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        throw new Error(body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : 'Modification impossible. Réessayez.');
      }
      form.reset();
      if (await refresh() === null) throw new Error('Modification enregistrée. Impossible de recharger la session, réessayez.');
      setSuccess(action === 'email' ? 'Adresse email mise à jour. Vos autres sessions ont été fermées.' : 'Mot de passe mis à jour. Vous restez connecté ici ; vos autres sessions ont été fermées.');
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Modification impossible. Réessayez.'); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.section} data-theme={theme} aria-labelledby="account-security-title">
    <h2 id="account-security-title">Sécurité du compte</h2>
    {loadError ? <p role="alert">Impossible de charger les options de sécurité. <button className={styles.retry} onClick={() => setAttempt(value => value + 1)}>Réessayer</button></p>
      : enabled === null ? <p role="status">Chargement...</p>
      : !enabled ? <p>Votre compte utilise Google sans mot de passe local. La modification de l’email et du mot de passe nécessite un mot de passe actuel. Vos coordonnées restent modifiables.</p>
      : <>
        <form onSubmit={event => void save(event, 'email')}>
          <fieldset disabled={busy}>
            <legend>Changer d’adresse email</legend>
            <label>Nouvelle adresse email<input key={email} name="email" type="email" required maxLength={254} defaultValue={email} autoComplete="email" /></label>
            <label>Mot de passe actuel<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
            {theme === 'shop' && <p className={styles.hint}>Si Google est associé à ce compte, changer l’email le dissociera.</p>}
            <button type="submit">{busy ? 'Enregistrement...' : 'Modifier l’email'}</button>
          </fieldset>
        </form>
        <form onSubmit={event => void save(event, 'password')}>
          <fieldset disabled={busy}>
            <legend>{theme === 'admin' ? 'Changer le mot de passe' : 'Changer de mot de passe'}</legend>
            <label>Mot de passe actuel<input name="currentPassword" type="password" required autoComplete="current-password" /></label>
            <label>Nouveau mot de passe<input name="newPassword" type="password" required minLength={8} autoComplete="new-password" aria-describedby="password-policy" /></label>
            <label>Confirmer le nouveau mot de passe<input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" /></label>
            <p id="password-policy" className={styles.hint}>Au moins 8 caractères, une lettre et un chiffre ; 72 octets maximum.</p>
            <button type="submit">{busy ? 'Enregistrement...' : 'Modifier le mot de passe'}</button>
          </fieldset>
        </form>
      </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {success && <p role="status" className={styles.success}>{success}</p>}
  </section>;
}
