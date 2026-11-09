"use client";
import "../../cart-toggle.css";
import { useState, type FormEvent } from "react";
import { cartQuantity, stepQuantity } from "@/lib/cart";
import { useCart } from "../../cart-provider";

export default function ProductPurchase({ productId, unavailable, unit }: { productId: number; unavailable: boolean; unit: string }) {
  const cart = useCart();
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const inCart = cart.items.some(item => item.productId === productId);
  const normalized = cartQuantity(quantity);
  const locked = pending || cart.busy || (unavailable && !inCart) || !cart.hydrated;
  const lower = normalized ? stepQuantity(normalized, -1) : null;
  function adjust(direction: 1 | -1) {
    if (!normalized) return;
    const next = stepQuantity(normalized, direction);
    if (next) { setQuantity(next); setMessage(""); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    if (inCart) { cart.remove(productId); setMessage(""); return; }
    if (!normalized) { setMessage("Saisissez une quantité supérieure à zéro."); return; }
    setPending(true); setMessage("");
    try {
      const failure = await cart.add(productId, normalized);
      setMessage(failure ?? "");
    } finally { setPending(false); }
  }
  return <form className="pd-purchase" onSubmit={submit}>
    <label htmlFor="product-quantity">Quantité <span>({unit})</span></label>
    <div className="pd-purchase-row">
      <div className="pd-quantity">
        <button type="button" aria-label="Diminuer la quantité" disabled={locked || inCart || !lower} onClick={() => adjust(-1)}>−</button>
        <input id="product-quantity" name="quantity" inputMode="decimal" autoComplete="off" value={quantity} disabled={locked || inCart} aria-invalid={!normalized} onChange={event => { setQuantity(event.target.value); setMessage(""); }} />
        <button type="button" aria-label="Augmenter la quantité" disabled={locked || inCart || !normalized || !stepQuantity(normalized, 1)} onClick={() => adjust(1)}>+</button>
      </div>
      <button className="pd-add cart-toggle" aria-live="polite" aria-atomic="true" title={message || undefined} data-cart-state={inCart ? "remove" : "add"} type="submit" disabled={locked}>{pending ? "Vérification…" : message ? message : inCart ? "Retirer du panier" : unavailable ? "Indisponible" : "Ajouter au panier"}</button>
    </div>
  </form>;
}
