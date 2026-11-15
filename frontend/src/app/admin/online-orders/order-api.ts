"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { useCallback, useEffect, useState } from "react";
export const orderApi = apiBase;
export async function orderRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await authFetch(`${orderApi}${path}`, { cache: "no-store", ...init });
  if (!response.ok) { const value: unknown = await response.json().catch(() => null); throw new Error(value && typeof value === "object" && "message" in value && typeof value.message === "string" ? value.message : "Impossible de charger la commande."); }
  return response.json() as Promise<T>;
}
export function useOrderData<T>(path: string) {
  const [revision, setRevision] = useState(0), [state, setState] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const key = `${path}:${revision}`;
  useEffect(() => { const controller = new AbortController(); void orderRequest<T>(path, { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setState({ key, data, error: "" }); }).catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : "Erreur réseau." }); }); return () => controller.abort(); }, [path, key]);
  return { data: state?.key === key ? state.data : null, error: state?.key === key ? state.error : "", refresh: useCallback(() => setRevision((value) => value + 1), []) };
}
