"use client";
import { apiBase } from "@/lib/api-base";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useCart } from "../cart-provider";
import type { CartItem } from "@/lib/cart";
import { displayAmount } from "@/lib/purchase-decimal";
import type { OrderReceipt, OrderLine } from "@/types/online-order";
import type { Customer } from "../customer-auth-provider";
import { tunisianPhone } from "@/lib/phone";
import ProductImage from "@/components/product-image";
import CheckoutSteps from "./checkout-steps";
import { LeafIcon } from "../storefront/visuals";

const arabic = /[\u0600-\u06FF]/;

interface OrderQuote { items: OrderLine[]; totalAmount: string; deliveryFee: string | null; deliveryDelay: string | null; grandTotal: string }
interface DeliveryZone { governorate: string; fee: string; freeAbove: string | null; delay: string | null }
async function preview(items: CartItem[], deliveryGovernorate: string, signal?: AbortSignal): Promise<OrderQuote> {
  const response = await fetch(`${apiBase}/public/orders/preview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, deliveryGovernorate: deliveryGovernorate || null }), cache: "no-store", signal });
  if (!response.ok) throw new Error("Impossible d’actualiser la commande. Vérifiez les disponibilités du panier et réessayez.");
  return response.json() as Promise<OrderQuote>;
}

export default function Checkout({ customer }: { customer: Customer | null }) {
  const cart = useCart(), router = useRouter(), locked = useRef(false);
  const [error, setError] = useState("");
  const [quoted, setQuoted] = useState<{ key: string; data: OrderQuote | null; error: string } | null>(null);
  // Empty list = delivery prices not set up yet: the order is sent without a governorate or fee.
  const [zones, setZones] = useState<DeliveryZone[]>([]), [governorate, setGovernorate] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/delivery-zones`, { cache: "no-store", signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((value: unknown) => {
        if (!Array.isArray(value)) return;
        const list = value as DeliveryZone[];
        setZones(list);
        if (list.length === 1) setGovernorate(list[0].governorate);
      })
      .catch(() => { /* Without zones the checkout keeps working without a fee. */ });
    return () => controller.abort();
  }, []);
  // The WhatsApp button moves up above the sticky submit bar on a phone.
  useEffect(() => {
    document.documentElement.setAttribute("data-product-dock", "");
    return () => document.documentElement.removeAttribute("data-product-dock");
  }, []);
  const zone = zones.find((row) => row.governorate === governorate) ?? null;
  const key = JSON.stringify([cart.items, cart.validation, governorate]);
  const { refresh } = cart;
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!cart.items.length || !cart.validation || cart.validation.some((line) => !line.valid)) return;
    const controller = new AbortController();
    void preview(cart.items, governorate, controller.signal).then((data) => { if (!controller.signal.aborted) setQuoted({ key, data, error: "" }); }).catch((failure: unknown) => { if (!controller.signal.aborted) setQuoted({ key, data: null, error: failure instanceof Error ? failure.message : "Erreur réseau." }); });
    return () => controller.abort();
  }, [cart.items, cart.validation, governorate, key]);
  const quote = quoted?.key === key ? quoted.data : null;
  const needsGovernorate = zones.length > 0 && !governorate;
  const valid = !!cart.items.length && !!cart.validation && cart.validation.every((line) => line.valid) && quote !== null && !needsGovernorate;
  const subtotal = quote ? quote.totalAmount : null, total = valid ? quote.grandTotal : null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (locked.current || !valid || !cart.beginOrder()) return;
    const fields = new FormData(event.currentTarget), items = cart.items.map((item) => ({ ...item }));
    const customerPhone = tunisianPhone(String(fields.get("customerPhone") ?? ""));
    if (!customerPhone) { setError("Numéro de téléphone invalide : 8 chiffres attendus (ex. 98 123 456)."); cart.endOrder(); return; }
    locked.current = true; setError("");
    try {
      const checked = await preview(items, governorate);
      if (checked.items.some((line) => line.unitPrice !== quote?.items.find((previous) => previous.productId === line.productId)?.unitPrice)) throw new Error("Les prix ont changé. Vérifiez le nouveau récapitulatif avant de renvoyer votre commande.");
      const response = await fetch(`${apiBase}/public/orders`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ customerName: String(fields.get("customerName") ?? "").trim(), customerPhone, customerEmail: customer ? undefined : String(fields.get("customerEmail") ?? "").trim() || null, website: String(fields.get("website") ?? ""), deliveryAddress: String(fields.get("deliveryAddress") ?? "").trim(), deliveryGovernorate: governorate || null, deliveryCity: String(fields.get("deliveryCity") ?? "").trim() || null, notes: String(fields.get("notes") ?? "").trim() || null, items }) });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message = body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : "Impossible d’enregistrer la commande. Réessayez.";
        throw new Error(message);
      }
      const created: OrderReceipt & { grandTotal?: string } = await response.json();
      // The confirmation shows the amount to pay on delivery: items + delivery fee.
      const receipt = { reference: created.reference, status: created.status, totalAmount: created.grandTotal ?? created.totalAmount, createdAt: created.createdAt };
      cart.finishOrder(receipt); router.replace("/shop/order-success");
    } catch (failure: unknown) { console.error("Order submission failed", failure); setError(failure instanceof Error ? failure.message : "Erreur réseau. Votre panier a été conservé."); cart.refresh(); }
    finally { locked.current = false; cart.endOrder(); }
  }
  const freeAbove = zone?.freeAbove && quote && quote.deliveryFee !== "0.000" ? zone.freeAbove : null;
  const freeProgress = freeAbove && quote ? Math.min(1, Number(quote.totalAmount) / Number(freeAbove)) : 0;
  const delivery = !zone || !quote ? null : quote.deliveryFee === "0.000" ? "Gratuite" : quote.deliveryFee === null ? "—" : `${displayAmount(quote.deliveryFee)} TND`;
  return <div className="shop-checkout">
    <CheckoutSteps current={2} />
    <header className="co-heading"><p lang="ar" dir="rtl" className="co-ar">وين نوصلولك؟</p><h1>Vos coordonnées</h1><p>Trois champs suffisent. Le magasin vous appelle pour confirmer avant de livrer.</p></header>
    {!cart.hydrated ? <div className="co-loading" role="status" aria-label="Chargement du panier" /> : !cart.items.length ? <div className="co-empty"><p>Votre panier est vide.</p><Link href="/shop#products" className="co-primary">Découvrir les produits</Link></div> : <div className="co-layout">
      <form onSubmit={submit} className="co-form"><fieldset disabled={cart.busy}>
        <legend className="sr-only">Vos coordonnées et la livraison</legend>
        {!customer && <p className="co-account-hint">Pas besoin de compte. <Link href="/shop/auth?returnTo=/shop/checkout">Se connecter</Link> pour retrouver vos commandes plus tard.</p>}
        <section className="co-card" style={{ "--i": 0 } as React.CSSProperties} aria-labelledby="co-you">
          <h2 id="co-you"><span className="co-num" aria-hidden="true">1</span>Vous</h2>
          <div className="co-fields">
            <label>Nom et prénom *<input name="customerName" defaultValue={customer?.fullName ?? ""} required maxLength={150} autoComplete="name" /></label>
            <label>Téléphone *<input name="customerPhone" defaultValue={customer?.phone ?? ""} type="tel" inputMode="tel" required maxLength={40} autoComplete="tel" placeholder="98 123 456" /></label>
            {!customer && <label className="co-wide">Email <span>(facultatif, pour recevoir le récapitulatif)</span><input name="customerEmail" type="email" maxLength={254} autoComplete="email" /></label>}
          </div>
        </section>
        <section className="co-card" style={{ "--i": 1 } as React.CSSProperties} aria-labelledby="co-where">
          <h2 id="co-where"><span className="co-num" aria-hidden="true">2</span>Livraison</h2>
          <div className="co-fields">
            {zones.length > 0 && <label>Gouvernorat *<select name="deliveryGovernorate" required value={governorate} onChange={(event) => setGovernorate(event.target.value)}>
              {zones.length > 1 && <option value="">Choisir…</option>}
              {zones.map((row) => <option key={row.governorate} value={row.governorate}>{row.governorate}</option>)}
            </select></label>}
            {zones.length > 0 && <label>Ville / délégation <span>(facultatif)</span><input name="deliveryCity" maxLength={80} autoComplete="address-level2" /></label>}
            <label className="co-wide">Adresse de livraison *<textarea name="deliveryAddress" defaultValue={customer?.deliveryAddress ?? ""} required maxLength={500} autoComplete="street-address" rows={2} placeholder="Rue, numéro, repère (près de…)" /></label>
            <label className="co-wide">Une remarque ? <span>(facultatif : horaire, étage, question…)</span><textarea name="notes" maxLength={2000} rows={2} /></label>
          </div>
          <div className="co-honeypot" aria-hidden="true"><label>Site web<input name="website" tabIndex={-1} autoComplete="off" defaultValue="" /></label></div>
        </section>
        <section className="co-card co-pay" style={{ "--i": 2 } as React.CSSProperties} aria-labelledby="co-pay">
          <h2 id="co-pay"><span className="co-num" aria-hidden="true">3</span>Paiement</h2>
          <div className="co-pay-choice"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" /><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M6 9.5v5M18 9.5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg><div><strong>En espèces, à la livraison</strong><span>Vous payez seulement quand vous recevez la commande.</span></div><span className="co-check" aria-hidden="true">✓</span></div>
        </section>
        <div className="co-submit">
          <span className="co-submit-total"><small>À payer à la livraison</small><strong>{total === null ? "—" : `${displayAmount(total)} TND`}</strong></span>
          <button disabled={!valid || cart.busy} className="co-primary">{cart.busy ? <><span className="co-spinner" aria-hidden="true" />Envoi…</> : <>Confirmer la commande <span aria-hidden="true">→</span></>}</button>
        </div>
      </fieldset>{error && <p role="alert" className="co-error co-form-error">{error}</p>}</form>
      <aside className="co-summary" aria-labelledby="summary-title"><div className="co-summary-head"><h2 id="summary-title">Votre commande</h2><Link href="/shop/cart">Modifier</Link></div>
        <div className="co-lines">{cart.items.map((item) => { const checked = cart.validation?.find((row) => row.productId === item.productId), line = quote?.items.find((row) => row.productId === item.productId), name = checked?.product?.name; const isArabic = !!name && arabic.test(name); return <div key={item.productId} className="co-line">
          <ProductImage imagePath={checked?.product?.mainImagePath} name="" className="co-thumb" sizes="56px" fallback={<span className="co-thumb co-thumb-empty"><LeafIcon /></span>} />
          <div><h3 className={isArabic ? "co-name-ar" : undefined} {...(isArabic ? { lang: "ar", dir: "rtl" } : {})}>{name ?? "Produit en cours de vérification"}</h3>{line && <p>{line.quantity.replace(".", ",")} {line.unitSnapshot} × {displayAmount(line.unitPrice)} TND</p>}{checked && !checked.valid && <p className="co-error">{checked.message}</p>}</div>
          <strong>{line ? `${displayAmount(line.lineTotal)} TND` : "—"}</strong></div>; })}</div>
        {zones.length > 0 && <div className="co-subtotals">
          <div className="co-subtotal"><span>Sous-total</span><span>{subtotal === null ? "—" : `${displayAmount(subtotal)} TND`}</span></div>
          <div className="co-subtotal"><span>Livraison</span><span aria-live="polite">{delivery ?? "Choisissez le gouvernorat"}</span></div>
          {freeAbove && <div className="co-free"><p>Plus que <strong>{displayAmount(String(Math.max(0, Number(freeAbove) - Number(quote?.totalAmount ?? 0)).toFixed(3)))} TND</strong> pour la livraison gratuite.</p><span className="co-free-bar" aria-hidden="true"><i style={{ transform: `scaleX(${freeProgress})` }} /></span></div>}
          {delivery === "Gratuite" && <p className="co-free-done">Livraison offerte</p>}
        </div>}
        <div className="co-total"><span>Total</span><strong data-checkout-total aria-live="polite">{total === null ? "—" : `${displayAmount(total)} TND`}</strong></div>
        {zone?.delay && <p className="co-delay">Livraison estimée : {zone.delay}</p>}
        {cart.validation?.some((line) => !line.valid) ? <p className="co-warning" role="status">Certains produits ne sont plus disponibles : <Link href="/shop/cart">modifiez le panier</Link>.</p> : !valid && !needsGovernorate && <p className="co-warning" role="status">Calcul du total…</p>}{needsGovernorate && <p className="co-warning" role="status">Choisissez votre gouvernorat pour voir le total.</p>}{quoted?.key === key && quoted.error && <p role="alert" className="co-error">{quoted.error}</p>}{cart.error && <p role="alert" className="co-error">{cart.error}</p>}
      </aside>
    </div>}
  </div>;
}
