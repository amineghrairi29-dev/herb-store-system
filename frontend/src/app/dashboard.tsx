"use client";
import { useEffect, useState } from 'react';
import Link from '@/components/auth-link';
import { useAuth } from '@/components/auth-provider';
import { authRequest } from '@/lib/auth';
import { displayAmount } from '@/lib/purchase-decimal';
import { activityLabels, readDashboard, type Dashboard } from '@/types/dashboard';
import AdminIcon, { type AdminIconName } from '@/components/admin-icon';
import styles from './dashboard.module.css';
const sectionClass = styles.panel;
const linkClass = 'text-sm font-semibold text-emerald-800 hover:underline';
const dateTime = (value: string, timeZone: string) => new Date(value).toLocaleString('fr-FR', { timeZone, dateStyle: 'short', timeStyle: 'short' });
const statusLabels: Record<string, string> = { DRAFT: 'Brouillon', CONFIRMED: 'Confirmé(e)', CANCELLED: 'Annulé(e)', PENDING: 'En attente' };
export default function OperationalDashboard() {
  const { user } = useAuth(); const [data, setData] = useState<Dashboard | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const role = user!.role;
  useEffect(() => { let active = true; authRequest('/dashboard').then(value => readDashboard(value, role)).then(value => { if (active) setData(value); }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Erreur inattendue.'); }); return () => { active = false; }; }, [role, attempt]);
  const actions = [['/sales/new', 'Nouvelle vente'], ['/purchases/new', 'Nouvel achat'], ['/stock/new-entry', 'Entrée stock'], ['/expenses/new', 'Nouvelle dépense'], ['/online-orders', 'Commandes en ligne']];
  function retry() { setData(null); setError(''); setAttempt(value => value + 1); }
  const cards = data ? [
    { label: 'Ventes aujourd’hui', value: data.today.sales, href: '/sales', helper: 'Ventes confirmées', money: true },
    { label: 'Encaissements aujourd’hui', value: data.today.customerCollections, href: '/sales', helper: 'Paiements clients · tous modes', money: true },
    ...[
      { label: 'Achats aujourd’hui', value: data.today.purchases!, href: '/purchases', helper: 'Achats confirmés', money: true },
      { label: 'Dépenses aujourd’hui', value: data.today.expenses!, href: '/expenses', helper: 'Hors achats fournisseurs', money: true },
      { label: 'Solde espèces', value: data.balances.physicalCash, href: '/cash', helper: 'Solde actuel de la caisse', money: true },
      { label: 'Créances clients', value: data.balances.customerReceivables, href: '/finance', helper: 'Cumul à la date du jour', money: true },
      { label: 'Dettes fournisseurs', value: data.balances.supplierPayables, href: '/finance', helper: 'Cumul à la date du jour', money: true },
    ],
    { label: 'Commandes en attente', value: String(data.alerts.pendingOnlineOrders), href: '/online-orders?status=PENDING', helper: 'À traiter', money: false },
    { label: 'Ruptures de stock', value: String(data.alerts.outOfStockProducts), href: '/stock', helper: 'Tous les produits', money: false },
    { label: 'Stocks faibles', value: String(data.alerts.lowStockProducts), href: '/stock', helper: 'Seuil minimum atteint', money: false },
  ] : [];
  const primary = [cards[0], cards[1], cards[4], cards[5]];
  const secondary = [cards[2], cards[3], cards[6]];
  const alerts = cards.slice(7);
  const actionIcons: AdminIconName[] = ['sales', 'purchases', 'stock', 'expenses', 'orders'];
  const metric = (card: (typeof cards)[number]) => <Link key={card.label} href={card.href} data-dashboard-metric={card.label} className={styles.metric}><h2>{card.label}</h2><p className={styles.value}>{card.money ? <>{displayAmount(card.value)} <span>DT</span></> : card.value}</p><p className={styles.helper}>{card.helper}</p></Link>;
  return <main lang="fr" className={styles.page}><div className={styles.inner}>
    <header className={styles.heading}><div><h1>Tableau de bord</h1><p>Bonjour, <bdi>{user!.fullName}</bdi></p></div>{data && <time dateTime={data.businessDate}>{data.businessDate.split('-').reverse().join('/')} &middot; {data.timeZone}</time>}</header>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900"><p className="font-semibold">Impossible de charger le tableau de bord.</p><p className="mt-2 text-sm">{error}</p><button onClick={retry} className="mt-4 rounded-lg border border-red-300 px-4 py-2 font-semibold">Réessayer</button></div> : !data ? <p role="status" className={`${sectionClass} py-12 text-center text-slate-600`}>Chargement du tableau de bord...</p> : <>
      <section aria-label="Indicateurs principaux" className={styles.primary}>{primary.map(metric)}</section>
      <section aria-label="Indicateurs complémentaires" className={styles.secondary}>{secondary.map(metric)}</section>
      <section aria-label="Alertes opérationnelles" className={styles.alerts}>{alerts.map((card,index) => <Link key={card.label} href={card.href} data-dashboard-metric={card.label} className={styles.alert}><span className={styles.alertIcon}><AdminIcon name={index === 0 ? 'orders' : 'alert'} /></span><div><h2>{card.label}</h2><p>{card.helper}</p></div><strong>{card.value}</strong></Link>)}</section>
      <section aria-label="Actions rapides" className={styles.actions}><h2>Actions rapides</h2><div className={styles.actionGrid}>{actions.map(([href,label],index) => <Link key={href} href={href}><AdminIcon name={actionIcons[index]} /><span>{label}</span><AdminIcon name="arrow" /></Link>)}</div></section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className={sectionClass}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Stock à surveiller</h2><Link href="/stock" className={linkClass}>Voir le stock</Link></div>{!data.stockAttention.length ? <p className="mt-5 text-sm text-slate-500">Aucune alerte de stock.</p> : <ul className="mt-4 divide-y divide-slate-100">{data.stockAttention.map(product => <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><Link href={`/stock/products/${product.id}`} className="break-words font-medium text-emerald-900 hover:underline"><bdi>{product.name}</bdi></Link><p className="mt-1 break-words text-sm text-slate-500"><bdi>{product.category}</bdi> · {displayAmount(product.stock)} {product.unit}</p></div><span className={`rounded-full px-3 py-1 text-xs font-medium ${product.status === 'OUT_OF_STOCK' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-900'}`}>{product.status === 'OUT_OF_STOCK' ? 'Rupture' : 'Stock faible'}</span></li>)}</ul>}</section>
        <section className={sectionClass}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Commandes en attente</h2><Link href="/online-orders?status=PENDING" className={linkClass}>Voir les commandes</Link></div>{!data.pendingOrders.length ? <p className="mt-5 text-sm text-slate-500">Aucune commande en attente.</p> : <ul className="mt-4 divide-y divide-slate-100">{data.pendingOrders.map(order => <li key={order.id} className="flex flex-wrap justify-between gap-3 py-4"><div className="min-w-0 flex-1"><Link href={`/online-orders/${order.id}`} className="break-words font-medium text-emerald-900 hover:underline">{order.reference}</Link><p className="mt-1 break-words text-sm"><bdi>{order.customerName}</bdi></p><time dateTime={order.createdAt} className="mt-1 block text-xs text-slate-500">{dateTime(order.createdAt, data.timeZone)}</time></div><p className="max-w-full break-words text-sm font-semibold">{displayAmount(order.totalAmount)} DT</p></li>)}</ul>}</section></div>
      <section className={`${sectionClass} mt-6`}><h2 className="text-xl font-semibold">Dernière activité</h2><p className="mt-2 text-xs text-slate-500">Derniers documents, confirmations et paiements enregistrés.</p>{!data.recentActivity.length ? <p className="mt-5 text-sm text-slate-500">Aucune activité récente.</p> : <ul className="mt-4 divide-y divide-slate-100">{data.recentActivity.map(item => <li key={`${item.type}-${item.id}`} className="grid gap-2 py-4 sm:grid-cols-[10rem_1fr_auto]"><div><p className="text-sm font-medium">{activityLabels[item.type]}</p><time dateTime={item.occurredAt} className="mt-1 block text-xs text-slate-500">{dateTime(item.occurredAt, data.timeZone)}</time></div><div className="min-w-0"><Link href={item.href} className={`${linkClass} break-words`}>{item.reference}</Link><p className="mt-1 break-words text-sm text-slate-600"><bdi>{item.description}</bdi></p>{item.status && <p className="mt-1 text-xs text-slate-500">{statusLabels[item.status] ?? item.status}</p>}</div><p className="max-w-full break-words text-sm font-semibold sm:max-w-60">{displayAmount(item.amount)} DT</p></li>)}</ul>}</section>
    </>}
  </div></main>;
}
