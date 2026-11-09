import { compareDecimals, normalizeDecimal } from "./decimal";
import type { ProductDetails } from "../types/product";
import type { ProductStock } from "./stock-api";
import type { MovementType } from "../app/stock/movement-config";

export interface StockMovement {
  id: number; productId: number; type: MovementType; quantity: string; unit: string;
  quantityInStorageUnit: string; reason: string | null; reference: string | null;
  notes: string | null; createdAt: string;
}
export type StockStatus = "Rupture" | "Stock faible" | "Normal";
export interface StockRow { product: ProductDetails; balance: ProductStock }
export interface MovementFilters { productId: string; type: string; from: string; to: string }
export const emptyMovementFilters: MovementFilters = { productId: "", type: "", from: "", to: "" };
export const movementLabels: Record<MovementType, string> = {
  ENTRY: "Entrée", EXIT: "Sortie", LOSS: "Perte", ADJUSTMENT_IN: "Ajustement +", ADJUSTMENT_OUT: "Ajustement -", RETURN_IN: "Retour",
};

export function stockStatus(stock: string, minimum: string | null): StockStatus {
  const current = normalizeDecimal(stock);
  const min = minimum === null ? null : normalizeDecimal(minimum);
  if (current === null || (minimum !== null && min === null)) throw new Error("Valeur de stock invalide.");
  if (compareDecimals(current, "0.000") === 0) return "Rupture";
  return min !== null && compareDecimals(current, min) <= 0 ? "Stock faible" : "Normal";
}

export function movementTime(value: string): number {
  // PostgreSQL timestamps may use a space and a short timezone offset (+00).
  return Date.parse(value.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00"));
}

export function filterMovements(movements: StockMovement[], filters: MovementFilters): StockMovement[] {
  const start = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : -Infinity;
  const endDate = filters.to ? new Date(`${filters.to}T00:00:00`) : null;
  if (endDate) endDate.setDate(endDate.getDate() + 1);
  const end = endDate?.getTime() ?? Infinity;
  return movements.filter((movement) =>
    (!filters.productId || String(movement.productId) === filters.productId) &&
    (!filters.type || movement.type === filters.type) &&
    movementTime(movement.createdAt) >= start && movementTime(movement.createdAt) < end
  ).sort((a, b) => movementTime(b.createdAt) - movementTime(a.createdAt) || b.id - a.id);
}

export function filterStock(rows: StockRow[], search: string, status: string): StockRow[] {
  const term = search.trim().normalize("NFKC").toLocaleLowerCase("fr");
  const rank: Record<StockStatus, number> = { Rupture: 0, "Stock faible": 1, Normal: 2 };
  const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });
  return rows.filter(({ product, balance }) =>
    (!status || stockStatus(balance.stock, product.minStock) === status) &&
    [product.name, product.nameFr ?? "", product.sku].some((value) => value.normalize("NFKC").toLocaleLowerCase("fr").includes(term))
  ).sort((a, b) => rank[stockStatus(a.balance.stock, a.product.minStock)] - rank[stockStatus(b.balance.stock, b.product.minStock)]
    || collator.compare(a.product.name, b.product.name) || collator.compare(a.product.sku, b.product.sku));
}

export function stockSummary(rows: StockRow[], movements: StockMovement[], asOf: number) {
  return {
    total: rows.length,
    low: rows.filter((row) => stockStatus(row.balance.stock, row.product.minStock) === "Stock faible").length,
    empty: rows.filter((row) => stockStatus(row.balance.stock, row.product.minStock) === "Rupture").length,
    recent: movements.filter((movement) => {
      const time = movementTime(movement.createdAt);
      return time >= asOf - 7 * 24 * 60 * 60 * 1000 && time <= asOf;
    }).length,
  };
}
