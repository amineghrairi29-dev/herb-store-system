"use client";
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiBase } from '@/lib/api-base';
import { useCustomerAuth } from '../customer-auth-provider';
import AccountSecurity from '@/components/account-security';
import styles from './profile.module.css';
import CustomerOrders from './customer-orders';
import { Leaf } from '../storefront/leaf';

const arabic = /[\u0600-\u06FF]/;
/** Up to two initials for the avatar ("Amine Ghrairi" -> "AG"). */
function initials(name: string | null, email: string) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return (words.length ? words.slice(0, 2).map((word) => word[0]) : [email[0]]).join('').toUpperCase();
}

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
  if (auth.error) return <div className={styles.wrapper}><section className={styles.state} role="alert"><h1>Mon compte</h1><p>{auth.error}</p><button className={styles.save} onClick={() => void auth.refresh()}>Réessayer</button></section></div>;
  if (!auth.customer) return <div className={styles.wrapper} aria-busy="true"><div className={styles.skeletonHero} /><div className={styles.skeletonCard} /><p role="status" className="sr-only">Chargement de votre profil…</p></div>;
  const customer = auth.customer;
  const first = customer.fullName?.trim().split(/\s+/)[0] ?? null;
  const isArabic = !!first && arabic.test(first);
  return <div className={styles.wrapper}>
    <header className={styles.hero}>
      <span className={styles.heroLeaf} aria-hidden="true"><Leaf color="#3E7B3A" vein="rgb(255 255 255 / .3)" /></span>
      <span className={styles.avatar} aria-hidden="true">{initials(customer.fullName, customer.email)}</span>
      <div className={styles.heroText}>
        <p lang="ar" dir="rtl" className={styles.heroAr}>أهلا بيك{isArabic ? ` ${first}` : ''}</p>
        <h1>{first && !isArabic ? <>Bonjour, <bdi>{first}</bdi></> : 'Mon compte'}</h1>
        <p className={styles.email} dir="auto">{customer.email}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void logout()} className={styles.logout}>
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 4H5v16h5M9 12h11m-4-4 4 4-4 4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        Se déconnecter
      </button>
    </header>
    <nav className={styles.tabs} aria-label="Sections du compte">
      <a href="#orders-title">Mes commandes</a><a href="#profile-title">Mes informations</a><a href="#account-security-title">Sécurité</a>
    </nav>
    <div className={styles.content}>
    <CustomerOrders />
    <section className={styles.card} aria-labelledby="profile-title" style={{ '--i': 1 } as React.CSSProperties}>
      <div className={styles.cardHead}><h2 id="profile-title">Mes informations</h2><p>Elles remplissent la commande à votre place.</p></div>
      <form onSubmit={save}>
        <fieldset disabled={busy} className={styles.fields}>
          <label>Nom et prénom *<input name="fullName" defaultValue={customer.fullName ?? ''} required maxLength={150} autoComplete="name" dir="auto" /></label>
          <label>Téléphone<input name="phone" type="tel" inputMode="tel" defaultValue={customer.phone ?? ''} maxLength={40} autoComplete="tel" placeholder="98 123 456" /></label>
          <label className={styles.fullWidth}>Email <span className={styles.readOnlyNote}>adresse de connexion</span><input type="email" value={customer.email} readOnly autoComplete="email" /></label>
          <label className={styles.fullWidth}>Adresse de livraison<textarea name="deliveryAddress" defaultValue={customer.deliveryAddress ?? ''} rows={3} maxLength={500} autoComplete="street-address" dir="auto" placeholder="Rue, numéro, repère (près de…)" /></label>
          <button className={styles.save} type="submit">{busy ? <><span className={styles.spinner} aria-hidden="true" />Enregistrement…</> : 'Enregistrer'}</button>
        </fieldset>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {saved && <p role="status" className={styles.success}>✓ Vos informations sont enregistrées.</p>}
      </form>
    </section>
    <AccountSecurity endpoint="/public/auth" email={customer.email} refresh={auth.refresh} />
    </div>
  </div>;
}
