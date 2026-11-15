"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { canOpen, type CurrentUser } from '@/lib/auth';
import StoreName from './store-name';
import AdminAccountMenu from './admin-account-menu';
import AdminIcon, { type AdminIconName } from './admin-icon';
import styles from './admin-shell.module.css';

const groups: { label: string; links: [string, string, AdminIconName][] }[] = [
  { label: 'Principal', links: [['/dashboard', 'Tableau de bord', 'dashboard']] },
  { label: 'Commerce', links: [['/products', 'Produits', 'products'], ['/stock', 'Stock', 'stock'], ['/online-orders', 'Commandes en ligne', 'orders'], ['/sales', 'Ventes', 'sales']] },
  { label: 'Approvisionnement', links: [['/purchases', 'Achats', 'purchases'], ['/suppliers', 'Fournisseurs', 'suppliers']] },
  { label: 'Finance', links: [['/cash', 'Caisse', 'cash'], ['/expenses', 'Dépenses', 'expenses'], ['/finance', 'Finance', 'finance'], ['/reports', 'Rapports', 'reports']] },
  { label: 'Administration', links: [['/users', 'Utilisateurs', 'users'], ['/settings/store', 'Paramètres', 'settings'], ['/settings/delivery', 'Livraison', 'orders'], ['/audit', 'Journal d’audit', 'audit']] },
];
const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

function Navigation({ pathname, user, close }: { pathname: string; user: CurrentUser; close?: () => void }) {
  return <nav aria-label="Navigation principale">{groups.map(group => <div className={styles.group} key={group.label}><p className={styles.groupTitle}>{group.label}</p>{group.links.filter(([href]) => canOpen(user.role, href)).map(([href, label, icon]) => <Link key={href} href={href} onClick={close} aria-current={matches(pathname, href) ? 'page' : undefined} className={styles.navLink}><AdminIcon name={icon} /><span>{label}</span></Link>)}</div>)}</nav>;
}

export default function AdminShell({ user, busy, logout, children }: { user: CurrentUser; busy: boolean; logout: () => Promise<void>; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const title = pathname === '/account' ? 'Mon compte' : groups.flatMap(group => group.links).find(([href]) => matches(pathname, href))?.[1] ?? 'Gestion du magasin';
  useEffect(() => {
    if (!open) return;
    const panel = dialog.current;
    const opener = trigger.current;
    panel?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const desktop = window.matchMedia('(min-width: 1100px)');
    const resize = () => { if (desktop.matches) setOpen(false); };
    desktop.addEventListener('change', resize);
    return () => { panel?.close(); document.body.style.overflow = previous; desktop.removeEventListener('change', resize); opener?.focus(); };
  }, [open]);
  const brand = <Link href="/dashboard" className={styles.brand} onClick={() => setOpen(false)}><span className={styles.brandIcon}><AdminIcon name="products" /></span><StoreName /></Link>;
  return <div lang="fr" className={styles.shell}>
    <a href="#admin-content" className={styles.skip}>Aller au contenu</a>
    <aside className={styles.sidebar}>{brand}<Navigation pathname={pathname} user={user} /></aside>
    <dialog ref={dialog} className={styles.drawer} aria-label="Navigation du magasin" onCancel={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <div className={styles.drawerBody}><div className={styles.drawerHeader}>{brand}<button autoFocus type="button" className={styles.close} aria-label="Fermer la navigation" onClick={() => setOpen(false)}><AdminIcon name="close" /></button></div><Navigation pathname={pathname} user={user} close={() => setOpen(false)} /></div>
    </dialog>
    <div className={styles.workspace}><header className={styles.topbar}><div className={styles.pageHeading}><button ref={trigger} type="button" className={styles.menu} aria-label="Ouvrir la navigation" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)}><AdminIcon name="menu" /></button><p>{title}</p></div><AdminAccountMenu key={pathname} user={user} busy={busy} logout={logout} /></header><div id="admin-content" tabIndex={-1} className={styles.content}>{children}</div></div>
  </div>;
}
