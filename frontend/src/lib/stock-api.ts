import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { isProductDetails, type ProductDetails } from "@/types/product";

export interface ProductStock {
  productId: number;
  stock: string;
  unit: string;
}

export class StockApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly responseBody: unknown) {
    super(message);
    this.name = "StockApiError";
  }
}

export async function stockRequest(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await authFetch(`${apiBase}${path}`, { cache: "no-store", ...options });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    let message = `La requête a échoué (HTTP ${response.status}).`;
    if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") message = body.message;
    throw new StockApiError(message, response.status, body);
  }
  return body;
}

export async function stockProducts(signal: AbortSignal): Promise<ProductDetails[]> {
  const data = await stockRequest("/products", { signal });
  if (!Array.isArray(data) || !data.every(isProductDetails)) throw new Error("Les données des produits sont invalides.");
  return data;
}

export async function productStock(id: number, signal: AbortSignal): Promise<ProductStock> {
  const data = await stockRequest(`/products/${id}/stock`, { signal });
  if (typeof data !== "object" || data === null || !("productId" in data) || data.productId !== id ||
    !("stock" in data) || typeof data.stock !== "string" || !/^\d+(?:\.\d+)?$/.test(data.stock) ||
    !("unit" in data) || typeof data.unit !== "string") throw new Error("Le stock reçu du serveur est invalide.");
  return { productId: id, stock: data.stock, unit: data.unit };
}

export function stockError(error: unknown): string {
  if (error instanceof TypeError) return "Connexion impossible à l’API. Vérifiez le serveur et sa configuration CORS.";
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "Le serveur met trop de temps à répondre. Veuillez réessayer.";
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}
