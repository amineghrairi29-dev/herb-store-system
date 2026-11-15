"use client";
import "./cart-toggle.css";
import { useState } from "react";
import { useCart } from "./cart-provider";
import { flyToCart } from "@/lib/fly-to-cart";
const bag = <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 0 1 6 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>;
const check = <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/** compact: short pill for product cards ("Panier" / "Ajouté"), full labels kept for screen readers. */
export default function AddToCart({ productId, outOfStock, imageUrl, compact = false }: { productId: number; outOfStock: boolean; imageUrl?: string | null; compact?: boolean }) {
  const cart = useCart();
  const inCart = cart.items.some(item => item.productId === productId);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const label = pending ? "Vérification..." : message ? message : inCart ? "Retirer du panier" : outOfStock ? "Indisponible" : "Ajouter au panier";
  const disabled = pending || (outOfStock && !inCart) || !cart.hydrated || cart.busy;
  async function toggle(button: HTMLButtonElement) {
    if (inCart) { cart.remove(productId); setMessage(""); return; }
    setPending(true); setMessage("");
    const error = await cart.add(productId);
    if (!error) flyToCart(button, imageUrl);
    setMessage(error ?? ""); setPending(false);
  }
  if (compact) {
    const short = pending ? "…" : message ? "Erreur" : inCart ? "Ajouté" : outOfStock ? "Épuisé" : "Panier";
    return <button type="button" disabled={disabled} onClick={(event) => void toggle(event.currentTarget)} aria-label={label} title={message || (inCart ? "Retirer du panier" : undefined)} data-cart-state={inCart ? "remove" : "add"} className="cart-pill">{inCart ? check : bag}<span aria-hidden="true">{short}</span><span className="cart-pill-live" aria-live="polite">{message}</span></button>;
  }
  return <div className="mt-4"><button disabled={disabled} onClick={(event) => void toggle(event.currentTarget)} aria-live="polite" aria-atomic="true" title={message || undefined} data-cart-state={inCart ? "remove" : "add"} className="cart-toggle w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">{label}</button></div>;
}
