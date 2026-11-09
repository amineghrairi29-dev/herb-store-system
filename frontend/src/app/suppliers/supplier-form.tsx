"use client";
import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { readSupplier, supplierError, supplierRequest } from "@/lib/supplier-api";
import { supplierTextFields, type CreateSupplierInput, type Supplier, type SupplierTextField } from "@/types/supplier";
import SupplierConfirmation from "./supplier-confirmation";

const labels: Record<SupplierTextField, string> = { code: "Code fournisseur", name: "Nom fournisseur", contactName: "Nom du contact", phone: "Téléphone", email: "Email", address: "Adresse", city: "Ville", country: "Pays", taxId: "Identifiant fiscal", notes: "Notes" };
const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-emerald-700 focus:outline-emerald-700";

export default function SupplierForm({ id }: { id?: string }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const [confirmation, setConfirmation] = useState<CreateSupplierInput | null>(null);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    supplierRequest(`/${encodeURIComponent(id)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then((data) => { if (!controller.signal.aborted) setSupplier(readSupplier(data)); })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setLoadError(supplierError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, attempt]);

  async function save(input: CreateSupplierInput) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      readSupplier(await supplierRequest(id ? `/${encodeURIComponent(id)}` : "", { method: id ? "PATCH" : "POST", body: JSON.stringify(input) }));
      window.location.replace("/suppliers");
    } catch (cause: unknown) { setError(supplierError(cause)); pending.current = false; setSaving(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    const data = new FormData(event.currentTarget);
    const fields = Object.fromEntries(supplierTextFields.map((key) => [key, String(data.get(key) ?? "").trim()])) as Record<SupplierTextField, string>;
    if (!fields.code || !fields.name) { setError("Le code et le nom du fournisseur sont obligatoires."); return; }
    if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) { setError("Adresse email invalide."); return; }
    const input: CreateSupplierInput = { ...fields, isActive: data.get("isActive") === "on" };
    for (const key of supplierTextFields) if (key !== "code" && key !== "name" && !input[key]) input[key] = null;
    setError(null);
    if (supplier?.isActive && !input.isActive) setConfirmation(input); else void save(input);
  }
  return <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 text-slate-900 sm:px-8 sm:py-12"><div className="mx-auto max-w-3xl">
    <h1 className="text-3xl font-semibold">{id ? "Modifier le fournisseur" : "Ajouter un fournisseur"}</h1>
    <p className="mb-8 mt-3 text-sm text-slate-600">Renseignez les coordonnées du fournisseur. Les champs marqués * sont obligatoires.</p>
    {loading ? <p role="status">Chargement du fournisseur...</p> : loadError ? <div role="alert" className="rounded-xl border border-red-200 bg-white p-6"><p>{loadError}</p><button onClick={() => { setLoadError(null); setLoading(true); setAttempt((value) => value + 1); }} className="mt-4 font-semibold text-emerald-800">Réessayer</button></div> :
      <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8" aria-busy={saving}>
        <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
          {supplierTextFields.map((key) => <label key={key} className={`text-sm font-medium ${key === "notes" || key === "address" ? "sm:col-span-2" : ""}`}>
            {labels[key]}{key === "code" || key === "name" ? " *" : ""}
            {key === "notes" ? <textarea name={key} dir="auto" rows={4} defaultValue={supplier?.[key] ?? ""} className={inputClass} /> :
              <input name={key} dir="auto" type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} required={key === "code" || key === "name"} defaultValue={supplier?.[key] ?? ""} className={inputClass} />}
          </label>)}
          <label className="flex items-center gap-3 text-sm font-medium sm:col-span-2"><input name="isActive" type="checkbox" defaultChecked={supplier?.isActive ?? true} className="size-4 accent-emerald-800" />Actif</label>
        </fieldset>
        {error && <p role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {saving ? <button disabled className="rounded-lg border px-5 py-3 opacity-50">Annuler</button> : <Link href="/suppliers" className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold">Annuler</Link>}
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{saving ? "Enregistrement..." : "Enregistrer"}</button>
        </div>
      </form>}
    {(loading || loadError) && <Link href="/suppliers" className="mt-6 inline-block font-semibold text-emerald-800">Annuler</Link>}
    {confirmation && <SupplierConfirmation name={confirmation.name} code={confirmation.code} pending={saving} error={error} onCancel={() => { if (!pending.current) setConfirmation(null); }} onConfirm={() => void save(confirmation)} />}
  </div></main>;
}
