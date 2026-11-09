"use client";
import Link from "next/link";
import BackLink from "../back-link";
import { useEffect, useState } from "react";
import { useCart } from "../cart-provider";
import ProductImage from "@/components/product-image";
import { LeafIcon } from "../storefront/visuals";
import "./cart.css";
import { addDecimals, cartQuantity, lineSubtotal, stepQuantity, type CartItem } from "@/lib/cart";
import { compareDecimals } from "@/lib/decimal";
import { displayAmount } from "@/lib/purchase-decimal";
import type { ValidatedCartItem } from "@/types/cart";

function CartLine({ item, checked }: { item: CartItem; checked?: ValidatedCartItem }) {
  const cart = useCart(), [input, setInput] = useState(item.quantity.replace(".", ",")), [error, setError] = useState("");
  const product = checked?.product;
  const unavailable = !product || checked?.availabilityStatus === "OUT_OF_STOCK";
  const disabled = cart.busy || !checked;
  function update(value: string) {
    const quantity = cartQuantity(value);
    if (!quantity) { setError("Saisissez une quantité supérieure à 0 (18 décimales maximum)."); return; }
    if (unavailable && compareDecimals(quantity, item.quantity) > 0) { setError("Ce produit est indisponible. L’augmentation est désactivée."); return; }
    setError(""); cart.update(item.productId, quantity);
  }
  const lower = stepQuantity(item.quantity, -1), higher = stepQuantity(item.quantity, 1);
  return <article className="sc-line" data-cart-line={item.productId} aria-label={product?.name ?? "Produit"}>
    <ProductImage imagePath={product?.mainImagePath} name={product?.name ?? "Produit"} className="sc-image" sizes="88px" fallback={<div className="sc-image sc-placeholder" aria-label="Image indisponible"><LeafIcon /></div>} />
    <div className="sc-info"><h2>{product ? <Link href={`/shop/products/${item.productId}`}><bdi>{product.name}</bdi></Link> : checked ? "Produit indisponible" : "Vérification du produit…"}</h2>
      {product && <p className="sc-meta"><bdi>{product.classifications.map(c => c.nameFr).join(" · ")}</bdi> · {product.saleUnit}</p>}
      <p className="sc-unit-price">{product ? `${displayAmount(product.salePrice)} TND / ${product.saleUnit}` : "—"}</p>
      <p className={`sc-status${checked?.valid ? "" : " sc-warning"}`} role="status">{checked?.valid ? "Disponible" : checked?.message ?? "Vérification de la disponibilité…"}</p>
    </div>
    <form className="sc-quantity-form" onSubmit={event => { event.preventDefault(); update(input); }}>
      <label htmlFor={`quantity-${item.productId}`}>Quantité</label>
      <div className="sc-quantity">
        <button type="button" aria-label="Diminuer la quantité" disabled={disabled || !lower} onClick={() => lower && update(lower)}>−</button>
        <input id={`quantity-${item.productId}`} aria-label="Quantité" inputMode="decimal" value={input} onChange={event => setInput(event.target.value)} disabled={disabled} maxLength={80} aria-invalid={Boolean(error)} aria-describedby={error ? `error-${item.productId}` : undefined} />
        <button type="button" aria-label="Augmenter la quantité" disabled={disabled || unavailable || !higher} onClick={() => higher && update(higher)}>+</button>
      </div>
      <button className="sc-update" disabled={disabled}>Mettre à jour</button>
    </form>
    <div className="sc-line-end"><span className="sc-label">Total</span><strong>{product ? `${displayAmount(lineSubtotal(item.quantity, product.salePrice))} TND` : "—"}</strong><button disabled={cart.busy} onClick={() => cart.remove(item.productId)} className="sc-remove" aria-label={`Retirer ${product?.name ?? "ce produit"}`}>Retirer</button></div>
    {error && <p id={`error-${item.productId}`} role="alert" className="sc-line-error">{error}</p>}
  </article>;
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
  return <div className="shop-cart">
    <header className="sc-heading"><p className="sc-eyebrow">Votre sélection</p><h1>Votre panier</h1><p>Prix et disponibilité vérifiés avant la commande. Le panier ne réserve pas de stock.</p></header>
    {cart.warning && <p role="status" className="sc-notice">{cart.warning}</p>}
    {!cart.hydrated ? <p role="status" className="sc-notice">Chargement du panier…</p> : !cart.items.length ? <section className="sc-empty"><LeafIcon /><h2>Votre panier est vide</h2><p>Découvrez notre sélection et retrouvez ici vos produits préférés.</p><Link href="/shop#products" className="sc-primary">Découvrir le catalogue</Link></section> : <>
      {cart.error && <div role="alert" className="sc-notice sc-warning"><p>{cart.error}</p><button onClick={cart.refresh}>Réessayer</button></div>}
      {!cart.error && !cart.validation && <p role="status" className="sc-notice">Actualisation des prix et disponibilités…</p>}
      <div className="sc-layout"><div className="sc-items"><div className="sc-lines">{cart.items.map(item => <CartLine key={`${item.productId}:${item.quantity}`} item={item} checked={cart.validation?.find(row => row.productId === item.productId)} />)}</div>
        <div className="sc-list-actions"><BackLink href="/shop#products">Continuer mes achats</BackLink><button disabled={cart.busy} onClick={() => { if (window.confirm("Voulez-vous vider votre panier ?")) cart.clear(); }} className="sc-remove">Vider le panier</button></div>
      </div>
      <aside className="sc-summary" aria-label="Récapitulatif du panier"><h2>Récapitulatif</h2><dl><div><dt>Articles distincts</dt><dd>{cart.items.length}</dd></div><div className="sc-total"><dt>Sous-total</dt><dd data-cart-total="true" aria-live="polite">{total !== null ? `${displayAmount(total)} TND` : "—"}</dd></div></dl>
        {cart.validation && !complete && <p className="sc-warning">Corrigez les lignes indisponibles pour obtenir le total du panier.</p>}
        {complete && !cart.busy ? <Link href="/shop/checkout" className="sc-primary">Passer la commande</Link> : <button disabled className="sc-primary">Passer la commande</button>}
        <button onClick={cart.refresh} className="sc-refresh">Actualiser le panier</button>
      </aside></div>
    </>}
  </div>;
}
