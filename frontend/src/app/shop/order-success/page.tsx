"use client";
import "./confirmation.css";
import BackLink from "../back-link";
import { useEffect, useState } from "react";
import { useCart } from "../cart-provider";
import { displayAmount } from "@/lib/purchase-decimal";
import { orderStatusLabels, type OrderReceipt } from "@/types/online-order";
export default function Success() {
  const { receipt } = useCart(), [saved, setSaved] = useState<OrderReceipt | null>(null);
  useEffect(() => { queueMicrotask(() => {
    try {
      const value: unknown = JSON.parse(sessionStorage.getItem("herb-store-order-receipt-v1") ?? "null");
      if (value && typeof value === "object" && "reference" in value && typeof value.reference === "string" && /^ORD-\d+$/.test(value.reference) && "totalAmount" in value && typeof value.totalAmount === "string" && /^\d+(?:\.\d+)?$/.test(value.totalAmount) && "status" in value && typeof value.status === "string" && Object.hasOwn(orderStatusLabels, value.status)) setSaved(value as OrderReceipt);
    } catch { /* A missing receipt never triggers another order request. */ }
  }); }, []);
  const order = receipt ?? saved;
  return <section className="order-confirmation" aria-labelledby="confirmation-title">
    <div className="oc-icon" aria-hidden="true"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{order ? <path d="m5 12 4 4L19 6" /> : <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v.01" /></>}</svg></div>
    <h1 id="confirmation-title">{order ? "Commande envoyée" : "Confirmation de commande"}</h1>
    {order ? <>
      <p className="oc-intro">Merci pour votre commande. Le magasin va vérifier votre demande.</p>
      <dl className="oc-receipt"><div><dt>Votre référence</dt><dd><bdi>{order.reference}</bdi></dd></div><div><dt>Total de la commande</dt><dd className="oc-total">{displayAmount(order.totalAmount)} <span>TND</span></dd></div></dl>
      <p className="oc-note">Conservez votre référence. Aucun paiement n’a été effectué à cette étape.</p>
    </> : <p className="oc-intro">Aucune confirmation disponible dans cet onglet. Une actualisation ne crée pas de nouvelle commande.</p>}
    <div className="oc-actions"><BackLink href="/shop">Retour à la boutique</BackLink></div>
  </section>;
}
