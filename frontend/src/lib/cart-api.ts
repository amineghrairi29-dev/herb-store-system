import { apiBase } from "@/lib/api-base";
import type { CartItem } from "./cart";
import type { ValidatedCartItem } from "@/types/cart";

function isLine(value: unknown): value is ValidatedCartItem {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (typeof row.productId !== "number" || typeof row.valid !== "boolean" || typeof row.quantityAvailable !== "boolean" || !(row.message === null || typeof row.message === "string")) return false;
  if (row.product === null) return row.currentPrice === null && row.availabilityStatus === null && !row.valid;
  if (!row.product || typeof row.product !== "object" || typeof row.currentPrice !== "string" || !/^\d+(?:\.\d+)?$/.test(row.currentPrice)) return false;
  const product = row.product as Record<string, unknown>;
  if (!product.category || typeof product.category !== "object") return false;
  const category = product.category as Record<string, unknown>;
  if (typeof category.id !== "number" || !Number.isInteger(category.id) || category.id < 1 || !["slug", "nameAr", "nameFr"].every(key => typeof category[key] === "string")) return false;
  return product.id === row.productId && ["name", "sku", "saleUnit"].every((key) => typeof product[key] === "string") && product.salePrice === row.currentPrice && ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(String(row.availabilityStatus)) && product.availabilityStatus === row.availabilityStatus;
}
export async function validateCart(items: CartItem[], signal?: AbortSignal): Promise<ValidatedCartItem[]> {
  const response = await fetch(`${apiBase}/public/cart/validate`, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify({ items }), cache: "no-store", signal });
  if (!response.ok) throw new Error(`Validation du panier HTTP ${response.status}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("items" in data) || !Array.isArray(data.items) || data.items.length !== items.length || !data.items.every(isLine) || data.items.some((line, index) => line.productId !== items[index].productId)) throw new Error("Réponse de validation invalide.");
  return data.items;
}
