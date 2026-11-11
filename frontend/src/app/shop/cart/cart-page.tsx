"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../cart-provider";
import ProductImage from "@/components/product-image";
import { LeafIcon } from "../storefront/visuals";
import { Leaf } from "../storefront/leaf";
import CheckoutSteps from "../checkout/checkout-steps";
import "./cart.css";
import { addDecimals, cartQuantity, lineSubtotal, stepQuantity, type CartItem } from "@/lib/cart";
import { compareDecimals } from "@/lib/decimal";
import { displayAmount } from "@/lib/purchase-decimal";
import type { ValidatedCartItem } from "@/types/cart";

const units: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };
const arabic = /[؀-ۿ]/;
const trash = <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function CartLine({ item, checked, index }: { item: CartItem; checked?: ValidatedCartItem; index: number }) {
  const cart = useCart(), [input, setInput] = useState(item.quantity.replace(".", ",")), [error, setError] = useState("");
  const product = checked?.product;
  const unavailable = !product || checked?.availabilityStatus === "OUT_OF_STOCK";
  const disabled = cart.busy || !checked;
  function update(value: string) {
    const quantity = cartQuantity(value);
    if (!quantity) { setError("Saisissez une quantité supérieure à 0 (18 décimales maximum)."); return; }
    if (unavailable && compareDecimals(quantity, item.quantity) > 0) { setError("Ce produit est indisponible. L’augmentation est désactivée."); return; }
    setError("");
    if (quantity !== item.quantity) cart.update(item.productId, quantity);
  }
  const lower = stepQuantity(item.quantity, -1), higher = stepQuantity(item.quantity, 1);
  const unit = product ? units[product.saleUnit] ?? product.saleUnit : "";
  const name = product?.name;
  const isArabic = !!name && arabic.test(name);
  const status = checked?.valid ? (checked.availabilityStatus === "LOW_STOCK" ? "Stock limité" : "Disponible") : checked?.message ?? "Vérification de la disponibilité…";
  return (
    <article className="sc-line" data-cart-line={item.productId} data-valid={checked ? String(checked.valid) : undefined} aria-label={name ?? "Produit"} style={{ "--i": index } as React.CSSProperties}>
      <Link href={`/shop/products/${item.productId}`} className="sc-image-link" tabIndex={-1} aria-hidden="true">
        <ProductImage imagePath={product?.mainImagePath} name="" className="sc-image" sizes="96px" fallback={<div className="sc-image sc-placeholder"><LeafIcon /></div>} />
      </Link>
      <div className="sc-info">
        <p className="sc-meta">{product ? <><bdi>{product.classifications[0]?.nameFr ?? product.category.nameFr}</bdi> · {displayAmount(product.salePrice)} TND/{unit}</> : " "}</p>
        <h2 className={isArabic ? "sc-name-ar" : undefined} {...(isArabic ? { lang: "ar", dir: "rtl" } : {})}>{product ? <Link href={`/shop/products/${item.productId}`}>{name}</Link> : checked ? "Produit indisponible" : "Vérification du produit…"}</h2>
        <p className={`sc-status${checked && !checked.valid ? " sc-warning" : ""}`} role="status"><span aria-hidden="true" />{status}</p>
      </div>
      <form className="sc-quantity-form" onSubmit={(event) => { event.preventDefault(); update(input); }}>
        <label htmlFor={`quantity-${item.productId}`} className="sr-only">Quantité {unit && `(${unit})`}</label>
        <div className="sc-quantity">
          <button type="button" aria-label="Diminuer la quantité" disabled={disabled || !lower} onClick={() => lower && update(lower)}>−</button>
          <input id={`quantity-${item.productId}`} inputMode="decimal" value={input} onChange={(event) => setInput(event.target.value)} onBlur={() => { if (input !== item.quantity.replace(".", ",")) update(input); }} disabled={disabled} maxLength={80} aria-invalid={Boolean(error)} aria-describedby={error ? `error-${item.productId}` : undefined} />
          <button type="button" aria-label="Augmenter la quantité" disabled={disabled || unavailable || !higher} onClick={() => higher && update(higher)}>+</button>
        </div>
        {unit && <span className="sc-unit" aria-hidden="true">{unit}</span>}
      </form>
      <div className="sc-line-end">
        <strong>{product ? <>{displayAmount(lineSubtotal(item.quantity, product.salePrice))} <span>TND</span></> : "—"}</strong>
        <button type="button" disabled={cart.busy} onClick={() => cart.remove(item.productId)} className="sc-remove" aria-label={`Retirer ${name ?? "ce produit"} du panier`} title="Retirer">{trash}</button>
      </div>
      {error && <p id={`error-${item.productId}`} role="alert" className="sc-line-error">{error}</p>}
    </article>
  );
}

/** "Vider le panier" asks for a second click instead of a browser dialog. */
function ClearCart() {
  const cart = useCart(), [asking, setAsking] = useState(false), timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  if (!asking) return <button type="button" disabled={cart.busy} className="sc-link" onClick={() => { setAsking(true); timer.current = window.setTimeout(() => setAsking(false), 5000); }}>Vider le panier</button>;
  return <span className="sc-confirm" role="group" aria-label="Confirmer"><span>Tout retirer ?</span><button type="button" className="sc-confirm-yes" onClick={() => { setAsking(false); cart.clear(); }}>Oui, vider</button><button type="button" className="sc-link" onClick={() => setAsking(false)}>Annuler</button></span>;
}

export default function CartPage() {
  const cart = useCart();
  const { refresh } = cart;
  useEffect(() => { refresh(); }, [refresh]);
  const complete = cart.validation !== null && cart.validation.every((item) => item.valid);
  const total = complete ? cart.items.reduce((sum, item) => {
    const price = cart.validation?.find((row) => row.productId === item.productId)?.currentPrice;
    return price ? addDecimals(sum, lineSubtotal(item.quantity, price)) : sum;
  }, "0.000") : null;
  const count = cart.items.length;
  // The WhatsApp button moves up above the phone dock while the cart has products.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-product-dock", count > 0);
    return () => document.documentElement.removeAttribute("data-product-dock");
  }, [count]);
  return (
    <div className="shop-cart">
      <CheckoutSteps current={1} />
      <header className="sc-heading">
        <p lang="ar" dir="rtl" className="sc-ar">قفّتك</p>
        <h1>Votre panier{cart.hydrated && count > 0 && <span className="sc-count">{count === 1 ? "1 produit" : `${count} produits`}</span>}</h1>
        <p>Prix et disponibilités vérifiés à l’instant. Rien n’est payé avant la livraison.</p>
      </header>
      {cart.warning && <p role="status" className="sc-notice">{cart.warning}</p>}
      {!cart.hydrated ? (
        <div className="sc-layout" role="status" aria-label="Chargement du panier"><div className="sc-lines">{[0, 1].map((key) => <div key={key} className="sc-skeleton" />)}</div><div className="sc-skeleton sc-skeleton-summary" /></div>
      ) : !count ? (
        <section className="sc-empty" aria-labelledby="sc-empty-title">
          <div className="sc-empty-art" aria-hidden="true">
            <span className="sc-empty-leaf sc-empty-leaf-1"><Leaf color="#A9C68F" /></span>
            <span className="sc-empty-leaf sc-empty-leaf-2"><Leaf color="#3E7B3A" /></span>
            <span className="sc-empty-leaf sc-empty-leaf-3"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span>
            <svg className="sc-empty-basket" viewBox="0 0 120 90"><path d="M14 34h92l-10 46H24L14 34Z" fill="#fff" stroke="#3E7B3A" strokeWidth="3" strokeLinejoin="round" /><path d="M38 34 54 10M82 34 66 10" stroke="#3E7B3A" strokeWidth="3" strokeLinecap="round" /><path d="M36 48v20M60 48v20M84 48v20" stroke="#A9C68F" strokeWidth="3" strokeLinecap="round" /></svg>
          </div>
          <p lang="ar" dir="rtl" className="sc-ar">القفّة فارغة</p>
          <h2 id="sc-empty-title">Votre panier attend ses premières plantes</h2>
          <p>Parcourez les produits par besoin, ou demandez conseil : on vous dira quoi prendre.</p>
          <div className="sc-empty-actions"><Link href="/shop#products" className="sc-primary">Découvrir les produits <span aria-hidden="true">→</span></Link><Link href="/shop#needs-title" className="sc-secondary">Choisir par besoin</Link></div>
        </section>
      ) : (
        <>
          {cart.error && <div role="alert" className="sc-notice sc-warning"><p>{cart.error}</p><button type="button" className="sc-link" onClick={cart.refresh}>Réessayer</button></div>}
          <div className="sc-layout">
            <div className="sc-items">
              <div className="sc-lines">{cart.items.map((item, index) => <CartLine key={`${item.productId}:${item.quantity}`} item={item} index={index} checked={cart.validation?.find((row) => row.productId === item.productId)} />)}</div>
              <div className="sc-list-actions"><Link href="/shop#products" className="sc-link sc-back"><span aria-hidden="true">←</span> Continuer mes achats</Link><ClearCart /></div>
            </div>
            <aside className="sc-summary" aria-label="Récapitulatif du panier">
              <h2>Récapitulatif</h2>
              <dl>
                <div><dt>Produits</dt><dd>{count}</dd></div>
                <div><dt>Livraison</dt><dd className="sc-muted">à l’étape suivante</dd></div>
                <div className="sc-total"><dt>Sous-total</dt><dd data-cart-total="true" aria-live="polite">{total !== null ? <>{displayAmount(total)} <span>TND</span></> : cart.validation ? "—" : <span className="sc-dots" aria-label="Calcul en cours"><i /><i /><i /></span>}</dd></div>
              </dl>
              {cart.validation && !complete && <p className="sc-warning sc-summary-note">Retirez ou corrigez les produits indisponibles pour continuer.</p>}
              {complete && !cart.busy ? <Link href="/shop/checkout" className="sc-primary sc-go">Passer la commande <span aria-hidden="true">→</span></Link> : <button type="button" disabled className="sc-primary sc-go">Passer la commande</button>}
              <ul className="sc-promises">
                <li><span aria-hidden="true">✓</span>Paiement en espèces à la livraison</li>
                <li><span aria-hidden="true">✓</span>Pas besoin de compte pour commander</li>
                <li><span aria-hidden="true">✓</span>Conseil gratuit sur WhatsApp</li>
              </ul>
              <button type="button" onClick={cart.refresh} className="sc-link sc-refresh">Actualiser les prix</button>
            </aside>
          </div>
          {/* Phone: total and button stay at the bottom of the screen. */}
          <div className="sc-dock" aria-hidden="true">
            <span><small>Sous-total</small><strong>{total !== null ? `${displayAmount(total)} TND` : "—"}</strong></span>
            {complete && !cart.busy ? <Link href="/shop/checkout" className="sc-primary" tabIndex={-1}>Commander <span aria-hidden="true">→</span></Link> : <button type="button" disabled className="sc-primary" tabIndex={-1}>Commander</button>}
          </div>
        </>
      )}
    </div>
  );
}
