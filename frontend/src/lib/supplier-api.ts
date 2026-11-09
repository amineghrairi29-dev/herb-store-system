import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { isSupplier, type Supplier } from "@/types/supplier";

export async function supplierRequest(path = "", init?: RequestInit): Promise<unknown> {
  const response = await authFetch(`${apiBase}/suppliers${path}`, {
    ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(15000),
    headers: { "Content-Type": "application/json; charset=utf-8", ...init?.headers },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data === "object" && data !== null && "message" in data ? data.message : null;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.filter((item: unknown) => typeof item === "string").join(" ") : "";
    throw new Error(`Échec de la requête (HTTP ${response.status}). ${message}`.trim());
  }
  return data;
}
export function readSupplier(data: unknown): Supplier {
  if (!isSupplier(data)) throw new Error("Réponse fournisseur invalide.");
  return data;
}
export function supplierError(error: unknown): string {
  if (error instanceof TypeError) return "Connexion à l’API impossible. Vérifiez le serveur et la configuration CORS.";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "Le serveur ne répond pas. Réessayez.";
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}
