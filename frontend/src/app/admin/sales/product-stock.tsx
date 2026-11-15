"use client";
import { useEffect, useState } from "react";
import { saleError, saleRequest } from "@/lib/sale-api";
import { displayAmount } from "@/lib/purchase-decimal";
export default function ProductStock({ id }: { id: number }) {
  const [stock, setStock] = useState<{ stock: string; unit: string } | null>(null), [error, setError] = useState<string | null>(null), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    saleRequest(`/products/${id}/stock`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) }).then((value) => {
      if (controller.signal.aborted) return;
      if (typeof value !== "object" || value === null || !("stock" in value) || typeof value.stock !== "string" || !("unit" in value) || typeof value.unit !== "string") throw new Error("Réponse stock invalide.");
      setStock({ stock: value.stock, unit: value.unit });
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(saleError(cause)); });
    return () => controller.abort();
  }, [id, attempt]);
  return <div className="mt-4 text-sm text-slate-600">{error ? <p role="alert">{error} <button type="button" onClick={() => { setError(null); setAttempt((value) => value + 1); }} className="font-semibold underline">Réessayer</button></p> : stock ? <p>Stock actuel : <strong>{displayAmount(stock.stock)} {stock.unit}</strong> · À titre indicatif</p> : <p role="status">Chargement du stock...</p>}</div>;
}
