"use client";
import { useEffect, useRef } from "react";

export default function SupplierConfirmation({ name, code, pending, error, onCancel, onConfirm }: {
  name: string; code: string; pending: boolean; error: string | null; onCancel: () => void; onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); cancel.current?.focus(); return () => element?.close(); }, []);
  return <dialog ref={dialog} aria-labelledby="deactivate-title" aria-describedby="deactivate-description" aria-busy={pending}
    onCancel={(event) => { event.preventDefault(); if (!pending) onCancel(); }}
    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
    <h2 id="deactivate-title" className="text-xl font-semibold">Désactiver le fournisseur ?</h2>
    <p className="mt-4 break-words font-semibold"><bdi dir="auto">{name}</bdi> · <bdi>{code}</bdi></p>
    <p id="deactivate-description" className="mt-3 text-sm text-slate-600">Ce fournisseur sera désactivé mais son historique futur restera conservé.</p>
    {error && <p role="alert" className="mt-4 text-sm text-red-800">{error}</p>}
    <div className="mt-6 flex flex-wrap justify-end gap-3">
      <button ref={cancel} type="button" disabled={pending} onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50">Annuler</button>
      <button type="button" disabled={pending} onClick={onConfirm} className="rounded-lg bg-amber-800 px-4 py-2 font-semibold text-white disabled:opacity-50">{pending ? "Enregistrement..." : "Désactiver"}</button>
    </div>
  </dialog>;
}
