import { isSale, type Sale } from "@/types/sale";
// The existing request helper accepts an API path and has no purchase business rules.
export { purchaseRequest as saleRequest } from "./purchase-api";
export function readSale(value: unknown): Sale { if (!isSale(value)) throw new Error("Réponse vente invalide."); return value; }
export function saleError(cause: unknown): string {
  if (cause instanceof TypeError) return "Connexion à l’API impossible. Vérifiez le serveur et la configuration CORS.";
  if (cause instanceof Error && /stock insuffisant/i.test(cause.message)) return `Stock insuffisant pour confirmer cette vente. ${cause.message}`;
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) return "Le serveur ne répond pas. Rechargez la vente pour vérifier son statut avant de réessayer.";
  return cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.";
}
