"use client";
import { auditRoleLabel } from '@/types/audit';

import { use, useEffect, useState } from 'react';
import Link from '@/components/auth-link';
import { authRequest } from '@/lib/auth';
import { actionLabels, entityLabels, auditDate, readAudit, type AuditEvent } from '@/types/audit';
export default function AuditDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params), [data, setData] = useState<AuditEvent | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; authRequest(`/audit-events/${encodeURIComponent(id)}`).then(readAudit).then(value => { if (active) setData(value); }).catch((failure: unknown) => { if (active) setError(failure instanceof Error ? failure.message : 'Chargement impossible.'); }); return () => { active = false; }; }, [id, attempt]);
  return <main lang="fr" className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-4xl"><Link href="/audit" className="font-semibold text-emerald-800 hover:underline">Retour au journal</Link><h1 className="mt-6 text-3xl font-semibold">Détail de l’événement</h1>
    {error ? <div role="alert" className="mt-6 rounded-lg bg-red-50 p-5 text-red-900"><p>{error}</p><button className="mt-3 underline" onClick={() => { setError(''); setAttempt(value => value + 1); }}>Réessayer</button></div> : !data ? <p role="status" className="mt-6">Chargement de l’événement...</p> : <article className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-8"><dl className="grid gap-6 sm:grid-cols-2">{[
      ['Date et heure', `${auditDate(data.createdAt, 'UTC')} UTC`], ['Utilisateur', `${data.actorNameSnapshot ?? 'Non identifié'}${data.actorUserId ? ` (ID ${data.actorUserId})` : ''}`], ['Email', data.actorEmailSnapshot], ['Rôle', auditRoleLabel(data.actorRoleSnapshot)], ['Action', `${actionLabels[data.action]} (${data.action})`], ['Entité', `${entityLabels[data.entityType]}${data.entityId ? ` #${data.entityId}` : ''}`], ['Référence', data.entityReference], ['Résultat', data.outcome === 'SUCCESS' ? 'Réussite' : 'Échec'], ['Adresse IP', data.ipAddress], ['Navigateur / User-Agent', data.userAgent],
    ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="mt-2 whitespace-pre-wrap break-words"><bdi>{value || '—'}</bdi></dd></div>)}</dl><h2 className="mt-8 text-xl font-semibold">Détails</h2>{Object.keys(data.metadataJson).length ? <pre className="mt-4 whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-4 text-sm">{JSON.stringify(data.metadataJson, null, 2)}</pre> : <p className="mt-3 text-sm text-slate-500">Aucun détail supplémentaire.</p>}</article>}
  </div></main>;
}
