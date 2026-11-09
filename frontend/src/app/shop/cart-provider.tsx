"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CART_KEY, MAX_CART_LINES, addDecimals, cartQuantity, readCart, type CartItem } from "@/lib/cart";
import { validateCart } from "@/lib/cart-api";
import type { ValidatedCartItem } from "@/types/cart";
import type { OrderReceipt } from "@/types/online-order";

interface CartContextValue {
  items: CartItem[]; hydrated: boolean; busy: boolean; warning: string;
  validation: ValidatedCartItem[] | null; error: string;
  add: (id: number, quantity?: string) => Promise<string | null>;
  update: (id: number, quantity: string) => void;
  remove: (id: number) => void; clear: () => void; refresh: () => void;
  receipt: OrderReceipt | null; beginOrder: () => boolean; endOrder: () => void; finishOrder: (receipt: OrderReceipt) => void;
}
const CartContext = createContext<CartContextValue | null>(null);
export function useCart() { const context = useContext(CartContext); if (!context) throw new Error("CartProvider requis"); return context; }
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]), itemsRef = useRef<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false), [busy, setBusy] = useState(false), lock = useRef(false);
  const [warning, setWarning] = useState("");
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: ValidatedCartItem[]; error: string } | null>(null);
  const key = `${revision}:${JSON.stringify(items)}`;
  const commit = useCallback((next: CartItem[]) => {
    itemsRef.current = next; setItems(next);
    try { localStorage.setItem(CART_KEY, JSON.stringify({ version: 1, items: next })); }
    catch { setWarning("Le navigateur ne permet pas d’enregistrer le panier. Il restera disponible dans cette page uniquement."); }
  }, []);
  useEffect(() => {
    function load() {
      try {
        const recovered = readCart(localStorage.getItem(CART_KEY));
        itemsRef.current = recovered.items; setItems(recovered.items);
        if (recovered.recovered) setWarning("Certaines données du panier étaient invalides et ont été ignorées.");
      } catch { setWarning("Le stockage du navigateur est indisponible. Le panier ne sera pas conservé après actualisation."); }
      setHydrated(true);
    }
    queueMicrotask(load);
    const sync = (event: StorageEvent) => { if (event.key === CART_KEY || event.key === null) load(); };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    void validateCart(items, controller.signal).then((data) => {
      if (!controller.signal.aborted) setResult({ key, data, error: "" });
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) { console.error("Cart validation failed", failure); setResult({ key, data: [], error: "Impossible de vérifier le panier et d’actualiser les prix. Réessayez." }); }
    });
    return () => controller.abort();
  }, [items, hydrated, key]);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => { window.addEventListener("focus", refresh); return () => window.removeEventListener("focus", refresh); }, [refresh]);
  async function add(id: number, input = "1.000") {
    const amount = cartQuantity(input);
    if (!amount) return "Saisissez une quantité supérieure à zéro.";
    if (lock.current || !hydrated) return "Veuillez patienter.";
    lock.current = true; setBusy(true);
    try {
      const previous = itemsRef.current;
      const existing = previous.find((item) => item.productId === id);
      if (!existing && previous.length >= MAX_CART_LINES) return "Le panier est limité à 100 lignes.";
      const quantity = existing ? cartQuantity(addDecimals(existing.quantity, amount)) : amount;
      if (!quantity) return "Quantité trop importante.";
      const next = existing ? previous.map((item) => item.productId === id ? { productId: id, quantity } : item) : [...previous, { productId: id, quantity }];
      const checked = await validateCart(next);
      const target = checked.find((item) => item.productId === id);
      if (!target?.valid) return target?.message ?? "Produit indisponible";
      if (itemsRef.current !== previous) return "Le panier a changé dans un autre onglet. Réessayez.";
      commit(next); return null;
    } catch (failure: unknown) { console.error("Add to cart failed", failure); return "Impossible de vérifier le produit. Réessayez."; }
    finally { lock.current = false; setBusy(false); }
  }
  const validation = result?.key === key && !result.error ? result.data : null;
  const error = result?.key === key ? result.error : "";
  return <CartContext.Provider value={{ items, hydrated, busy, warning, validation, error, add,
    receipt, beginOrder: () => { if (lock.current) return false; lock.current = true; setBusy(true); return true; },
    endOrder: () => { lock.current = false; setBusy(false); },
    finishOrder: (value) => { setReceipt(value); try { sessionStorage.setItem("herb-store-order-receipt-v1", JSON.stringify(value)); } catch { /* In-memory receipt still supports navigation when storage is blocked. */ } commit([]); },
    update: (id, input) => { const quantity = cartQuantity(input); if (quantity && !lock.current) commit(itemsRef.current.map((item) => item.productId === id ? { ...item, quantity } : item)); },
    remove: (id) => {
      if (lock.current) return;
      const next = itemsRef.current.filter(item => item.productId !== id);
      // Retain already validated prices for remaining lines while refreshing.
      if (result?.key === key && !result.error) {
        setResult({ key: `${revision}:${JSON.stringify(next)}`, data: result.data.filter(item => item.productId !== id), error: "" });
      }
      commit(next);
    },
    clear: () => { if (!lock.current) commit([]); }, refresh,
  }}>{children}</CartContext.Provider>;
}
export function CartIndicator() {
  const { items, hydrated } = useCart();
  return <Link href="/shop/cart" className="text-sm font-medium hover:underline">Panier ({hydrated ? items.length : "…"})</Link>;
}
