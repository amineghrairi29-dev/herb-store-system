"use client";
import { useState, type FormEvent } from "react";
import { apiBase } from "@/lib/api-base";
import { displayAmount } from "@/lib/purchase-decimal";
import { tunisianPhone } from "@/lib/phone";
import { customerOrderLabel, customerSteps, type DeliveryStatus, type OrderStatus } from "@/types/online-order";
import "./track-order.css";

interface Tracked { reference: string; status: OrderStatus; deliveryStatus: DeliveryStatus | null; grandTotal?: string; totalAmount: string; createdAt: string; items: { productNameSnapshot: string; quantity: string; unitSnapshot: string }[] }

/** Guest order tracking: reference + phone, the same pair the shop asks for on the phone. */
export default function TrackOrder() {
  const [order, setOrder] = useState<Tracked | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const fields = new FormData(event.currentTarget);
    const reference = String(fields.get("reference") ?? "").trim().toUpperCase().replace(/^(\d+)$/, "ORD-$1");
    const phone = tunisianPhone(String(fields.get("phone") ?? ""));
    if (!/^ORD-\d{6,10}$/.test(reference) || !phone) { setError("Vérifiez la référence (ex. ORD-000123) et le numéro de téléphone."); return; }
    setBusy(true); setError(""); setOrder(null);
    try {
      const response = await fetch(`${apiBase}/public/orders/${encodeURIComponent(reference)}?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (response.status === 429) throw new Error("Trop de tentatives. Réessayez dans quelques minutes.");
      if (!response.ok) throw new Error("Aucune commande ne correspond à cette référence et ce numéro.");
      setOrder(await response.json() as Tracked);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Erreur réseau."); }
    finally { setBusy(false); }
  }
  const label = order ? customerOrderLabel(order.status, order.deliveryStatus) : "";
  const step = customerSteps.indexOf(label as (typeof customerSteps)[number]);
  return <section className="sf-information-page track-order">
    <p className="sf-eyebrow">Suivi</p>
    <h1>Où en est ma commande ?</h1>
    <form onSubmit={submit} className="track-form">
      <label>Référence<input name="reference" required placeholder="ORD-000123" autoComplete="off" /></label>
      <label>Téléphone<input name="phone" type="tel" inputMode="tel" required placeholder="98 123 456" autoComplete="tel" /></label>
      <button className="sf-button" disabled={busy}>{busy ? "Recherche…" : "Suivre"}</button>
    </form>
    {error && <p role="alert" className="track-error">{error}</p>}
    {order && <div className="track-result" aria-live="polite">
      <h2><bdi>{order.reference}</bdi> · {label}</h2>
      {step >= 0 ? <ol className="track-steps">{customerSteps.map((name, index) => <li key={name} data-done={index <= step || undefined} data-current={index === step || undefined}>{name}</li>)}</ol>
        : <p className="track-note">{order.status === "CANCELLED" ? "Cette commande a été annulée." : "Cette commande a été retournée."} Pour toute question, contactez-nous.</p>}
      <ul className="track-items">{order.items.map((item, index) => <li key={index}><bdi>{item.productNameSnapshot}</bdi> — {item.quantity.replace(".", ",")} {item.unitSnapshot}</li>)}</ul>
      <p className="track-total">Total : {displayAmount(order.grandTotal ?? order.totalAmount)} TND</p>
    </div>}
  </section>;
}
