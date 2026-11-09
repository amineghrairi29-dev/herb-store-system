"use client";
import "./cart-toggle.css";
import { useState } from "react";
import { useCart } from "./cart-provider";
export default function AddToCart({ productId, outOfStock }: { productId: number; outOfStock: boolean }) {
  const cart = useCart();
  const inCart = cart.items.some(item => item.productId === productId);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  return <div className="mt-4"><button disabled={pending || (outOfStock && !inCart) || !cart.hydrated || cart.busy} onClick={async () => {
    if (inCart) { cart.remove(productId); setMessage(""); return; }
    setPending(true); setMessage("");
    const error = await cart.add(productId);
    setMessage(error ?? ""); setPending(false);
  }} aria-live="polite" aria-atomic="true" title={message || undefined} data-cart-state={inCart ? "remove" : "add"} className="cart-toggle w-full rounded-lg bg-emerald-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">{pending ? "Vérification..." : message ? message : inCart ? "Retirer du panier" : outOfStock ? "Indisponible" : "Ajouter au panier"}</button></div>;
}
