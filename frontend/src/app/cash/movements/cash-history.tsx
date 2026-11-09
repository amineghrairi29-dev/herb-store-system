"use client";
import { useEffect, useState } from "react";
import { purchaseRequest } from "@/lib/purchase-api";
import { readCashMovements, cashSourceLabels, type CashMovement } from "@/types/cash";
import { paymentMethodLabels } from "@/types/purchase-payment";
import { CashError, cashError, inputClass, secondaryClass } from "../cash-ui";
import MovementsTable from "../movements-table";
const emptyFilters = { type: "", sourceType: "", paymentMethod: "", dateFrom: "", dateTo: "" };
export default function CashHistory() {
  const [rows, setRows] = useState<CashMovement[] | null>(null), [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0), [filters, setFilters] = useState(emptyFilters);
  useEffect(() => {
    let active = true;
    purchaseRequest("/cash/movements").then(readCashMovements).then((data) => { if (active) setRows(data); }).catch((cause: unknown) => { if (active) setError(cashError(cause)); });
    return () => { active = false; };
  }, [attempt]);
  if (error) return <CashError error={error} retry={() => { setError(null); setAttempt((value) => value + 1); }} />;
  if (!rows) return <p role="status" className="py-12 text-center text-slate-600">Chargement des mouvements...</p>;
  const invalidRange = !!(filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo);
  const visible = rows.filter((row) => !invalidRange && (!filters.type || row.type === filters.type) && (!filters.sourceType || row.sourceType === filters.sourceType) && (!filters.paymentMethod || row.paymentMethod === filters.paymentMethod) && (!filters.dateFrom || row.movementDate >= filters.dateFrom) && (!filters.dateTo || row.movementDate <= filters.dateTo));
  const select = (key: "type" | "sourceType" | "paymentMethod", label: string, options: Record<string, string>) => <label className="text-sm font-medium">{label}<select className={inputClass} value={filters[key]} onChange={(event) => setFilters({ ...filters, [key]: event.target.value })}><option value="">Tous</option>{Object.entries(options).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
  return <>
    <p className="mb-5 text-sm text-slate-600">Tous les modes de paiement sont affichés. Seules les espèces affectent le solde physique.</p>
    <section aria-label="Filtres de l’historique" className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 xl:grid-cols-3">
      {select("type", "Sens", { IN: "Entrée", OUT: "Sortie" })}{select("sourceType", "Source", cashSourceLabels)}{select("paymentMethod", "Mode de paiement", paymentMethodLabels)}
      <label className="text-sm font-medium">Du<input className={inputClass} type="date" value={filters.dateFrom} onChange={(event) => setFilters({ ...filters, dateFrom: event.target.value })} /></label>
      <label className="text-sm font-medium">Au<input className={inputClass} type="date" value={filters.dateTo} onChange={(event) => setFilters({ ...filters, dateTo: event.target.value })} /></label>
      <div className="flex items-end"><button type="button" className={secondaryClass} onClick={() => setFilters(emptyFilters)}>Réinitialiser les filtres</button></div>
    </section>
    {invalidRange && <CashError error="La date de début doit précéder ou être égale à la date de fin." />}
    <p className="mb-3 text-sm text-slate-500" role="status">{visible.length} mouvement(s)</p><MovementsTable rows={visible} />
  </>;
}
