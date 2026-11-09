"use client";

import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { CurrentUser } from '@/lib/auth';
import styles from './admin-account-menu.module.css';

function UserIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" strokeLinecap="round" /></svg>;
}

export default function AdminAccountMenu({ user, busy, logout }: {
  user: CurrentUser; busy: boolean; logout: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return <div className={styles.account} ref={root}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
    onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    }}>
    <button ref={trigger} type="button" className={styles.trigger} aria-expanded={open} aria-controls={panelId}
      aria-label={`Compte : ${user.fullName}`} onClick={() => setOpen(value => !value)}>
      <span className={styles.avatar}><UserIcon /></span>
      <bdi className={styles.name}>{user.fullName}</bdi>
      <svg className={styles.chevron} aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m4 6 4 4 4-4" /></svg>
    </button>
    <div id={panelId} className={styles.dropdown} hidden={!open}>
      <Link href="/account" className={styles.summary} onClick={() => setOpen(false)}>
        <span className={styles.avatar}><UserIcon /></span>
        <span className={styles.identity}><bdi className={styles.fullName}>{user.fullName}</bdi><bdi className={styles.email}>{user.email}</bdi></span>
      </Link>
      <div className={styles.actions}>
        <button type="button" className={styles.logout} disabled={busy} onClick={() => void logout()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></svg>
          {busy ? 'Déconnexion...' : 'Se déconnecter'}
        </button>
      </div>
    </div>
  </div>;
}
