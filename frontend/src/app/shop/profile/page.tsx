"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiBase } from '@/lib/api-base';
import { useCustomerAuth } from '../customer-auth-provider';
import BackLink from '../back-link';
import AccountSecurity from '@/components/account-security';
import styles from './profile.module.css';

export default function ProfilePage() {
  const auth = useCustomerAuth(), router = useRouter(), pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  useEffect(() => { if (!auth.loading && !auth.customer && !auth.error) router.replace('/shop/auth?returnTo=/shop/profile'); }, [auth.loading, auth.customer, auth.error, router]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const fields = new FormData(event.currentTarget);
    pending.current = true; setBusy(true); setError(''); setSaved(false);
    try {
      const response = await fetch(`${apiBase}/public/auth/profile`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify({ fullName: String(fields.get('fullName') ?? '').trim(), phone: String(fields.get('phone') ?? '').trim(), deliveryAddress: String(fields.get('deliveryAddress') ?? '').trim() }), signal: AbortSignal.timeout(15000) });
      if (response.status === 401) { await auth.refresh(); router.replace('/shop/auth?returnTo=/shop/profile'); return; }
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === 'object' && 'message' in body ? body.message : null;
        throw new Error(typeof message === 'string' ? message : 'Impossible d’enregistrer votre profil.');
      }
      if (!await auth.refresh()) throw new Error('Profil enregistré. Impossible de recharger la session, réessayez.');
      setSaved(true);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : 'Enregistrement impossible.'); }
    finally { pending.current = false; setBusy(false); }
  }
  async function logout() {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await auth.logout(); router.replace('/auth'); }
    catch { setError('Déconnexion impossible. Réessayez.'); }
    finally { pending.current = false; setBusy(false); }
  }
  if (auth.error) return <div className={styles.wrapper}><BackLink href="/shop">Retour à la boutique</BackLink><section className={styles.state} role="alert"><h1>Mon compte</h1><p>{auth.error}</p><button className={styles.save} onClick={() => void auth.refresh()}>Réessayer</button></section></div>;
  if (!auth.customer) return <div className={styles.wrapper}><BackLink href="/shop">Retour à la boutique</BackLink><section className={styles.state} aria-busy="true"><h1>Mon compte</h1><p role="status">Chargement de votre profil...</p></section></div>;
  return <div className={styles.wrapper}>
    <BackLink href="/shop">Retour à la boutique</BackLink>
    <header className={styles.heading}>
      <h1>Mon compte</h1><p className={styles.intro}>Vos informations, pour une prochaine visite en toute simplicité.</p>
    </header>
    <div className={styles.layout}>
    <aside className={styles.account} aria-label="Votre compte">
      <span className={styles.avatar} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="8" r="3.5" /><path d="M5 20v-2a7 7 0 0 1 14 0v2" /></svg></span>
      <h2 className={styles.name} dir="auto">{auth.customer.fullName || 'Mon compte'}</h2>
      <p className={styles.email} dir="auto">{auth.customer.email}</p>
      <div className={styles.accountActions}>
        <button type="button" disabled={busy} onClick={() => void logout()} className={styles.logout}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4H5v16h5M9 12h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Se déconnecter
        </button>
      </div>
    </aside>
    <div className={styles.content}>
    <section className={styles.card} aria-labelledby="profile-title">
      <h2 id="profile-title">Informations du compte</h2>
      <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          <label>Nom *<input name="fullName" defaultValue={auth.customer.fullName ?? ''} required maxLength={150} autoComplete="name" dir="auto" /></label>
          <label>Téléphone<input name="phone" type="tel" defaultValue={auth.customer.phone ?? ''} maxLength={40} autoComplete="tel" /></label>
          <label className={styles.fullWidth}>Email <span className={styles.readOnlyNote}>Votre adresse de connexion</span><input type="email" value={auth.customer.email} readOnly autoComplete="email" /></label>
          <label className={styles.fullWidth}>Adresse de livraison par défaut<textarea name="deliveryAddress" defaultValue={auth.customer.deliveryAddress ?? ''} rows={3} maxLength={500} autoComplete="street-address" dir="auto" /></label>
          <button className={styles.save} type="submit">{busy ? 'Enregistrement...' : 'Enregistrer les modifications'}</button>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {saved && <p role="status" className={styles.success}>Votre profil a été enregistré.</p>}
      </form>
    </section>
    <AccountSecurity endpoint="/public/auth" email={auth.customer.email} refresh={auth.refresh} />
    </div>
    </div>
  </div>;
}
