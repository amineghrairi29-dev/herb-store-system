"use client";
import { apiBase } from "@/lib/api-base";
import Link from "next/link";
import BackLink from "../back-link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "../cart-provider";
import type { CartItem } from "@/lib/cart";
import { displayAmount } from "@/lib/purchase-decimal";
import type { OrderReceipt, OrderLine } from "@/types/online-order";
import type { Customer } from "../customer-auth-provider";

interface OrderQuote { items: OrderLine[]; totalAmount: string }
async function preview(items: CartItem[], signal?: AbortSignal): Promise<OrderQuote> {
  const response = await fetch(`${apiBase}/public/orders/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), cache: "no-store", signal });
  if (!response.ok) throw new Error("Impossible d’actualiser la commande. Vérifiez les disponibilités du panier et réessayez.");
  return response.json() as Promise<OrderQuote>;
}

export default function Checkout({ customer }: { customer: Customer }) {
  const cart = useCart(), router = useRouter(), locked = useRef(false);
  const [error, setError] = useState("");
  const [quoted, setQuoted] = useState<{ key: string; data: OrderQuote | null; error: string } | null>(null);
  const key = JSON.stringify([cart.items, cart.validation]);
  const { refresh } = cart;
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!cart.items.length || !cart.validation || cart.validation.some((line) => !line.valid)) return;
    const controller = new AbortController();
    void preview(cart.items, controller.signal).then((data) => { if (!controller.signal.aborted) setQuoted({ key, data, error: "" }); }).catch((failure: unknown) => { if (!controller.signal.aborted) setQuoted({ key, data: null, error: failure instanceof Error ? failure.message : "Erreur réseau." }); });
    return () => controller.abort();
  }, [cart.items, cart.validation, key]);
  const quote = quoted?.key === key ? quoted.data : null;
  const valid = !!cart.items.length && !!cart.validation && cart.validation.every((line) => line.valid) && quote !== null;
  const total = valid ? quote.totalAmount : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || !valid || !cart.beginOrder()) return;
    locked.current = true; setError("");
    const fields = new FormData(event.currentTarget), items = cart.items.map((item) => ({ ...item }));
    try {
      const checked = await preview(items);
      if (checked.items.some((line) => line.unitPrice !== quote?.items.find((previous) => previous.productId === line.productId)?.unitPrice)) throw new Error("Les prix ont changé. Vérifiez le nouveau récapitulatif avant de renvoyer votre commande.");
      const response = await fetch(`${apiBase}/public/orders`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ customerName: String(fields.get("customerName") ?? "").trim(), customerPhone: String(fields.get("customerPhone") ?? "").trim(), deliveryAddress: String(fields.get("deliveryAddress") ?? "").trim(), notes: String(fields.get("notes") ?? "").trim() || null, items }) });
      if (response.status === 401) { router.replace("/shop/auth?returnTo=/shop/checkout"); return; }
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Impossible d’enregistrer la commande. Réessayez.";
        throw new Error(message);
      }
      const created: OrderReceipt = await response.json();
      const receipt = { reference: created.reference, status: created.status, totalAmount: created.totalAmount, createdAt: created.createdAt };
      cart.finishOrder(receipt); router.replace("/shop/order-success");
    } catch (failure: unknown) { console.error("Order submission failed", failure); setError(failure instanceof Error ? failure.message : "Erreur réseau. Votre panier a été conservé."); cart.refresh(); }
    finally { locked.current = false; cart.endOrder(); }
  }
  return <div className="shop-checkout"><BackLink href="/shop/cart">Retour au panier</BackLink><header className="co-heading"><h1>Passer la commande</h1><p>Vérifiez votre sélection et vos coordonnées avant d’envoyer votre demande au magasin.</p></header>
    {!cart.hydrated ? <p role="status">Chargement du panier…</p> : !cart.items.length ? <div className="co-empty"><p>Votre panier est vide.</p><Link href="/shop#products" className="co-primary">Découvrir le catalogue</Link></div> : <div className="co-layout">
      <form onSubmit={submit} className="co-form"><fieldset disabled={cart.busy}><legend>Vos coordonnées</legend>
        <div className="co-fields">
          <label>Nom *<input name="customerName" defaultValue={customer.fullName ?? ""} required maxLength={150} autoComplete="name" /></label>
          <label>Téléphone *<input name="customerPhone" defaultValue={customer.phone ?? ""} type="tel" required minLength={6} maxLength={40} autoComplete="tel" /></label>
          <label className="co-wide">Adresse de livraison *<textarea name="deliveryAddress" defaultValue={customer.deliveryAddress ?? ""} required maxLength={500} autoComplete="street-address" rows={2} /></label>
          <label className="co-wide">Notes <span>(facultatif)</span><textarea name="notes" maxLength={2000} rows={2} /></label>
        </div>
        <p className="co-payment">Paiement à la réception</p>
        <button disabled={!valid || cart.busy} className="co-primary">{cart.busy ? "Envoi de la commande…" : "Confirmer la commande"}</button>
      </fieldset>{error && <p role="alert" className="co-error">{error}</p>}</form>
      <aside className="co-summary" aria-labelledby="summary-title"><h2 id="summary-title">Votre commande</h2><div className="co-lines">{cart.items.map(item => { const checked = cart.validation?.find(row => row.productId === item.productId), line = quote?.items.find(row => row.productId === item.productId); return <div key={item.productId} className="co-line"><div><h3><bdi>{checked?.product?.name ?? "Produit en cours de vérification"}</bdi></h3>{line && <p>{line.quantity.replace(".", ",")} {line.unitSnapshot} × {displayAmount(line.unitPrice)} TND</p>}{checked && !checked.valid && <p className="co-error">{checked.message}</p>}</div><strong>{line ? `${displayAmount(line.lineTotal)} TND` : "—"}</strong></div>; })}</div>
        <div className="co-total"><span>Total</span><strong data-checkout-total aria-live="polite">{total === null ? "—" : `${displayAmount(total)} TND`}</strong></div>
        {!valid && <p className="co-warning" role="status">Vérifiez les disponibilités du panier avant de commander.</p>}{quoted?.key === key && quoted.error && <p role="alert" className="co-error">{quoted.error}</p>}{cart.error && <p role="alert" className="co-error">{cart.error}</p>}
      </aside>
    </div>}
  </div>;
}
