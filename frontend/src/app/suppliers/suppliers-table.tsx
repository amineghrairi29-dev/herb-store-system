"use client";
import Link from "@/components/auth-link";
import { useEffect, useRef, useState } from "react";
import { isSupplier, type Supplier } from "@/types/supplier";
import { readSupplier, supplierError, supplierRequest } from "@/lib/supplier-api";
import SupplierConfirmation from "./supplier-confirmation";

export default function SuppliersTable() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    supplierRequest("", { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then((data) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(data) || !data.every(isSupplier)) throw new Error("Liste des fournisseurs invalide.");
      setSuppliers(data);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(supplierError(cause)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  async function toggle(supplier: Supplier) {
    if (pending.current) return;
    pending.current = true; setSaving(true); setActionError(null);
    try {
      const updated = readSupplier(await supplierRequest(`/${supplier.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !supplier.isActive }) }));
      setSuppliers((rows) => rows.map((row) => row.id === updated.id ? updated : row)); setSelected(null);
    } catch (cause: unknown) { setActionError(supplierError(cause)); }
    finally { pending.current = false; setSaving(false); }
  }
  const search = query.trim().toLocaleLowerCase("fr");
  const visible = suppliers.filter((supplier) => `${supplier.name} ${supplier.code}`.toLocaleLowerCase("fr").includes(search));
  return <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Fournisseurs" aria-busy={loading || saving}>
    <div className="border-b border-slate-200 p-5"><label htmlFor="supplier-search" className="mb-2 block text-sm font-medium">Rechercher par nom ou code</label><input id="supplier-search" type="search" dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-md" /></div>
    {actionError && !selected && <p role="alert" className="m-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">{actionError}</p>}
    {loading ? <p role="status" className="p-8 text-center text-slate-600">Chargement des fournisseurs...</p> : error ? <div role="alert" className="p-8 text-red-800"><p>{error}</p><button className="mt-3 font-semibold underline" onClick={() => { setLoading(true); setError(null); setAttempt((value) => value + 1); }}>Réessayer</button></div> : visible.length === 0 ? <p className="p-8 text-center text-slate-600">{suppliers.length === 0 ? "Aucun fournisseur disponible" : "Aucun fournisseur ne correspond à votre recherche."}</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Code", "Fournisseur", "Contact", "Téléphone", "Email", "Ville", "Statut", "Actions"].map((label) => <th key={label} scope="col" className="px-5 py-4">{label}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{visible.map((supplier) => <tr key={supplier.id} className="hover:bg-slate-50">
          {[supplier.code, supplier.name, supplier.contactName, supplier.phone, supplier.email, supplier.city].map((value, index) => <td key={index} className="max-w-64 break-words px-5 py-4"><bdi dir="auto">{value || "—"}</bdi></td>)}
          <td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${supplier.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>{supplier.isActive ? "Actif" : "Inactif"}</span></td>
          <td className="px-5 py-4"><div className="flex items-center gap-4"><Link href={`/suppliers/${supplier.id}/edit`} className="font-semibold text-emerald-800 hover:underline">Modifier</Link><button disabled={saving} className="font-semibold text-amber-800 hover:underline disabled:opacity-50" onClick={() => { setActionError(null); if (supplier.isActive) setSelected(supplier); else void toggle(supplier); }}>{saving ? "Enregistrement..." : supplier.isActive ? "Désactiver" : "Activer"}</button></div></td>
        </tr>)}</tbody></table></div>}
    {selected && <SupplierConfirmation name={selected.name} code={selected.code} pending={saving} error={actionError} onCancel={() => { if (!pending.current) { setSelected(null); setActionError(null); } }} onConfirm={() => void toggle(selected)} />}
  </section>;
}
