"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { apiBase } from '@/lib/api-base';
import type { PublicClassification } from '@/types/public-product';
import styles from './needs-drawer.module.css';

export default function NeedsDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [needs, setNeeds] = useState<PublicClassification[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fetch(`${apiBase}/public/classifications?withProducts=true`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async response => { if (!response.ok) throw new Error(`Needs HTTP ${response.status}`); return await response.json() as PublicClassification[]; })
      .then(rows => { if (!controller.signal.aborted) setNeeds(rows); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); document.body.style.overflow = overflow; };
  }, [open, attempt]);
  function close() { dialog.current?.close(); }
  return <>
    <button ref={trigger} type="button" className={styles.trigger} aria-label="Explorer par besoin" aria-haspopup="dialog" aria-expanded={open} aria-controls="shop-needs-drawer" onClick={() => { setNeeds(null); setError(false); dialog.current?.showModal(); setOpen(true); }}>
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    <dialog ref={dialog} id="shop-needs-drawer" className={styles.drawer} aria-labelledby="shop-needs-title" onClose={() => { setOpen(false); trigger.current?.focus(); }} onClick={event => { if (event.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } }}>
      <div className={styles.heading}><h2 id="shop-needs-title">Explorer par besoin</h2><button type="button" onClick={close} aria-label="Fermer les besoins">×</button></div>
      {error ? <div role="alert"><p>Impossible de charger les besoins.</p><button className={styles.retry} onClick={() => { setError(false); setNeeds(null); setAttempt(n => n + 1); }}>Réessayer</button></div> : !needs ? <p role="status">Chargement...</p> : needs.length ? <nav aria-label="Besoins produits"><ul className={styles.list}>{needs.map(need => <li key={need.id}><Link href={`/shop/besoins/${encodeURIComponent(need.slug)}`} onClick={close}><bdi>{need.nameFr}</bdi><span aria-hidden="true">→</span></Link></li>)}</ul></nav> : <p className={styles.empty}>Aucun besoin disponible pour le moment.</p>}
    </dialog>
  </>;
}
