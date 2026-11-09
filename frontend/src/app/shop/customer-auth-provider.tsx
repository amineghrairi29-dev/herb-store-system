"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { apiBase } from "@/lib/api-base";
export interface Customer {
  id: number;
  email: string;
  fullName: string | null;
  phone: string | null;
  deliveryAddress: string | null;
}
interface State {
  customer: Customer | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<Customer | null>;
  logout: () => Promise<void>;
}
const Context = createContext<State | null>(null);
export function safeCustomerReturn(value: unknown) {
  return typeof value === "string" &&
    ["/shop", "/shop/checkout", "/shop/cart", "/shop/catalogue", "/shop/profile"].includes(value)
    ? value
    : "/shop";
}
export function CustomerAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [customer, setCustomer] = useState<Customer | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const pending = useRef<Promise<Customer | null> | null>(null);
  const refresh = useCallback(() => {
    if (pending.current) return pending.current;
    setLoading(true);
    setError("");
    const work = async () => {
      try {
        const response = await fetch(`${apiBase}/public/auth/me`, {
          credentials: "include",
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        });
        if (response.status === 401) {
          setCustomer(null);
          return null;
        }
        if (!response.ok)
          throw new Error("Impossible de vérifier votre session. Réessayez.");
        const value: Customer = await response.json();
        setCustomer(value);
        return value;
      } catch (failure: unknown) {
        setCustomer(null);
        setError(failure instanceof Error ? failure.message : "Erreur réseau.");
        return null;
      } finally {
        setLoading(false);
        pending.current = null;
      }
    };
    pending.current = work();
    return pending.current;
  }, []);
  // One centralized, deduplicated check also supplies the public header.
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
    };
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [pathname, refresh]);
  const logout = useCallback(async () => {
    // Finish a pending refresh before revoking, so it cannot restore stale state.
    if (pending.current) await pending.current;
    const response = await fetch(`${apiBase}/public/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Déconnexion impossible. Réessayez.");
    setCustomer(null); // The cart belongs to the browser, independently of authentication.
  }, []);
  return (
    <Context.Provider value={{ customer, loading, error, refresh, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useCustomerAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("CustomerAuthProvider missing");
  return value;
}
