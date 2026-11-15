"use client";

import styles from './account.module.css';
import { useRef, useState, type FormEvent } from 'react';
import { useAuth } from '@/components/auth-provider';
import AccountSecurity from '@/components/account-security';
import { authRequest } from '@/lib/auth';

export default function AccountPage() {
  const { user, reload } = useAuth();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    pending.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      await authRequest('/auth/account/profile', { method: 'PATCH', body: JSON.stringify({ fullName: String(fields.get('fullName') ?? '').trim() }) });
      await reload(); setSaved(true);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Modification impossible.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (!user) return null;
  return <main lang="fr" className={styles.page}>
    <h1 className={styles.title}>Mon compte</h1>
    <section className={styles.card} aria-labelledby="account-info">
      <h2 id="account-info" className={styles.sectionTitle}>Informations du compte</h2>
      <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          <label className={styles.label}>Nom affiché<input name="fullName" defaultValue={user.fullName} autoComplete="name" dir="auto" required maxLength={150} className={styles.input} /></label>
          <label className={styles.label}>Email<input value={user.email} type="email" readOnly autoComplete="email" className={styles.input} /></label>
          <button type="submit" className={styles.save}>{busy ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {saved && <p role="status" className={styles.success}>Informations enregistrées.</p>}
      </form>
    </section>
    <AccountSecurity endpoint="/auth/account" email={user.email} refresh={reload} theme="admin" />
  </main>;
}
