"use client";
import "../../cart-toggle.css";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { cartQuantity, stepQuantity } from "@/lib/cart";
import { flyToCart } from "@/lib/fly-to-cart";
import { useCart } from "../../cart-provider";

/** Common quantities for herbs sold by weight or volume, in the product's sale unit. */
const presets: Record<string, [string, string][]> = {
  KG: [["0.1", "100 g"], ["0.25", "250 g"], ["0.5", "500 g"], ["1", "1 kg"]],
  G: [["100", "100 g"], ["250", "250 g"], ["500", "500 g"], ["1000", "1 kg"]],
  L: [["0.25", "25 cl"], ["0.5", "50 cl"], ["1", "1 L"]],
  ML: [["250", "25 cl"], ["500", "50 cl"], ["1000", "1 L"]],
};
const millimes = (value: string) => { const [whole, fraction = ""] = value.split("."); return Number(whole) * 1000 + Number(fraction.padEnd(3, "0").slice(0, 3)); };
const money = (value: number) => value.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export default function ProductPurchase({ productId, unavailable, unit, saleUnit, price, name, imageUrl }: {
  productId: number; unavailable: boolean; unit: string; saleUnit: string; price: string; name: string; imageUrl: string | null;
}) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(saleUnit === "KG" ? "0.25" : "1");
  const [message, setMessage] = useState(""), [pending, setPending] = useState(false), [docked, setDocked] = useState(false);
  const form = useRef<HTMLFormElement>(null), button = useRef<HTMLButtonElement>(null);
  const inCart = cart.items.some((item) => item.productId === productId);
  const normalized = cartQuantity(quantity);
  const locked = pending || cart.busy || (unavailable && !inCart) || !cart.hydrated;
  const lower = normalized ? stepQuantity(normalized, -1) : null;
  const sizes = presets[saleUnit] ?? [];
  // Estimate only (rounded to the millime); the cart and checkout show the exact server total.
  const estimate = normalized ? Math.round(millimes(price) * Number(normalized)) / 1000 : null;
  const label = pending ? "Vérification…" : message ? message : inCart ? "Retirer du panier" : unavailable ? "Indisponible" : "Ajouter au panier";

  // Phone: once the main button scrolls out of view, a bar with the price and the button sticks to the bottom.
  useEffect(() => {
    const element = form.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => setDocked(!entry.isIntersecting && entry.boundingClientRect.top < 0), { threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // Lets the floating WhatsApp button move up so it does not cover the bar.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-product-dock", docked);
    return () => document.documentElement.removeAttribute("data-product-dock");
  }, [docked]);

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
      if (!failure) flyToCart(button.current, imageUrl);
      setMessage(failure ?? "");
    } finally { setPending(false); }
  }
  return (
    <>
      <form ref={form} className="pp-purchase" onSubmit={submit}>
        {sizes.length > 0 && (
          <fieldset className="pp-sizes">
            <legend>Quantité</legend>
            <div>{sizes.map(([value, text]) => <button key={value} type="button" className="pp-size" aria-pressed={normalized === cartQuantity(value)} disabled={locked || inCart} onClick={() => { setQuantity(value); setMessage(""); }}>{text}</button>)}</div>
          </fieldset>
        )}
        <div className="pp-row">
          <label htmlFor="product-quantity" className="sr-only">Quantité ({unit})</label>
          <div className="pp-stepper">
            <button type="button" aria-label="Diminuer la quantité" disabled={locked || inCart || !lower} onClick={() => adjust(-1)}>−</button>
            <input id="product-quantity" name="quantity" inputMode="decimal" autoComplete="off" value={quantity} disabled={locked || inCart} aria-invalid={!normalized} onChange={(event) => { setQuantity(event.target.value); setMessage(""); }} />
            <span className="pp-unit" aria-hidden="true">{unit}</span>
            <button type="button" aria-label="Augmenter la quantité" disabled={locked || inCart || !normalized || !stepQuantity(normalized, 1)} onClick={() => adjust(1)}>+</button>
          </div>
          <p className="pp-estimate" aria-live="polite">{estimate !== null && !inCart ? <>≈ <strong>{money(estimate)}</strong> TND</> : null}</p>
        </div>
        <button ref={button} className="pp-add cart-toggle" type="submit" disabled={locked} aria-live="polite" aria-atomic="true" title={message || undefined} data-cart-state={inCart ? "remove" : "add"}>{label}</button>
      </form>
      <div className="pp-dock" data-visible={docked || undefined} aria-hidden={!docked}>
        <div className="pp-dock-text"><span><bdi>{name}</bdi></span><strong>{estimate !== null && !inCart ? `${money(estimate)} TND` : inCart ? "Dans le panier" : ""}</strong></div>
        <button type="button" className="pp-add pp-dock-add" tabIndex={docked ? 0 : -1} disabled={locked} onClick={() => form.current?.requestSubmit()}>{inCart ? "Retirer" : unavailable ? "Indisponible" : "Ajouter"}</button>
      </div>
    </>
  );
}
