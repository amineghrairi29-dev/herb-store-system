"use client";
import "../../cart-toggle.css";
import { useState, type FormEvent } from "react";
import { cartQuantity, stepQuantity } from "@/lib/cart";
import { useCart } from "../../cart-provider";

/** Common quantities for herbs sold by weight or volume, in the product's sale unit. */
const presets: Record<string, [string, string][]> = {
  KG: [["0.1", "100 g"], ["0.25", "250 g"], ["0.5", "500 g"], ["1", "1 kg"]],
  G: [["100", "100 g"], ["250", "250 g"], ["500", "500 g"], ["1000", "1 kg"]],
  L: [["0.25", "25 cl"], ["0.5", "50 cl"], ["1", "1 L"]],
  ML: [["250", "25 cl"], ["500", "50 cl"], ["1000", "1 L"]],
};
const millimes = (value: string) => { const [whole, fraction = ""] = value.split("."); return Number(whole) * 1000 + Number(fraction.padEnd(3, "0").slice(0, 3)); };

export default function ProductPurchase({ productId, unavailable, unit, saleUnit, price }: { productId: number; unavailable: boolean; unit: string; saleUnit: string; price: string }) {
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
  const sizes = presets[saleUnit] ?? [];
  // Estimate only (rounded to the millime); the cart and checkout show the exact server total.
  const estimate = normalized ? Math.round((millimes(price) * Number(normalized))) / 1000 : null;
  return <form className="pd-purchase" onSubmit={submit}>
    {sizes.length > 0 && <div className="pd-sizes" role="group" aria-label="Quantités courantes">{sizes.map(([value, label]) => <button key={value} type="button" className="pd-size" aria-pressed={normalized === cartQuantity(value) || undefined} disabled={locked || inCart} onClick={() => { setQuantity(value); setMessage(""); }}>{label}</button>)}</div>}
    <label htmlFor="product-quantity">Quantité <span>({unit})</span></label>
    <div className="pd-purchase-row">
      <div className="pd-quantity">
        <button type="button" aria-label="Diminuer la quantité" disabled={locked || inCart || !lower} onClick={() => adjust(-1)}>−</button>
        <input id="product-quantity" name="quantity" inputMode="decimal" autoComplete="off" value={quantity} disabled={locked || inCart} aria-invalid={!normalized} onChange={event => { setQuantity(event.target.value); setMessage(""); }} />
        <button type="button" aria-label="Augmenter la quantité" disabled={locked || inCart || !normalized || !stepQuantity(normalized, 1)} onClick={() => adjust(1)}>+</button>
      </div>
      <button className="pd-add cart-toggle" aria-live="polite" aria-atomic="true" title={message || undefined} data-cart-state={inCart ? "remove" : "add"} type="submit" disabled={locked}>{pending ? "Vérification…" : message ? message : inCart ? "Retirer du panier" : unavailable ? "Indisponible" : "Ajouter au panier"}</button>
    </div>
    {estimate !== null && !inCart && <p className="pd-estimate">≈ {estimate.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>}
  </form>;
}
