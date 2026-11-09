import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { isPurchase, type Purchase } from "@/types/purchase";
export async function purchaseRequest(path: string, init?: RequestInit): Promise<unknown> {
  const response = await authFetch(`${apiBase}${path}`, { ...init, cache: "no-store", signal: init?.signal ?? AbortSignal.timeout(20000), headers: { "Content-Type": "application/json; charset=utf-8", ...init?.headers } });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof data === "object" && data !== null && "message" in data ? data.message : null;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.filter((item: unknown) => typeof item === "string").join(" ") : "";
    throw new Error(`Échec de la requête (HTTP ${response.status}). ${message}`.trim());
  }
  return data;
}
export function readPurchase(data: unknown): Purchase { if (!isPurchase(data)) throw new Error("Réponse achat invalide."); return data; }
export function purchaseError(cause: unknown): string {
  if (cause instanceof TypeError) return "Connexion à l’API impossible. Vérifiez le serveur et la configuration CORS.";
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return "Le serveur ne répond pas. Rechargez l’achat pour vérifier son statut avant de réessayer.";
  return cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.";
}
