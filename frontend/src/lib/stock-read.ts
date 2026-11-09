import { isProductDetails } from "../types/product";
import { productStock, stockProducts, stockRequest } from "./stock-api";
import { movementLabels, movementTime, type StockMovement, type StockRow } from "./stock-view";

function isMovement(value: unknown): value is StockMovement {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "number" && typeof record.productId === "number" &&
    typeof record.type === "string" && Object.hasOwn(movementLabels, record.type) &&
    typeof record.unit === "string" && typeof record.createdAt === "string" && Number.isFinite(movementTime(record.createdAt)) &&
    ["quantity", "quantityInStorageUnit"].every((key) => typeof record[key] === "string" && /^\d+(?:\.\d+)?$/.test(record[key])) &&
    ["reason", "reference", "notes"].every((key) => record[key] === null || typeof record[key] === "string");
}

export async function loadMovements(signal: AbortSignal): Promise<StockMovement[]> {
  const data = await stockRequest("/stock-movements", { signal });
  if (!Array.isArray(data) || !data.every(isMovement)) throw new Error("Les mouvements reçus du serveur sont invalides.");
  return data;
}

export async function loadHistory(signal: AbortSignal) {
  const [products, movements] = await Promise.all([stockProducts(signal), loadMovements(signal)]);
  return { products, movements };
}

export async function loadOverview(signal: AbortSignal) {
  const { products, movements } = await loadHistory(signal);
  const rows: StockRow[] = [];
  for (let start = 0; start < products.length; start += 6) {
    rows.push(...await Promise.all(products.slice(start, start + 6).map(async (product) => ({
      product, balance: await productStock(product.id, signal),
    }))));
  }
  return { rows, movements, asOf: Date.now() };
}

export async function loadStockDetails(id: string, signal: AbortSignal) {
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) throw new Error("Identifiant de produit invalide.");
  const [product, balance, movements] = await Promise.all([
    stockRequest(`/products/${id}`, { signal }), productStock(Number(id), signal), loadMovements(signal),
  ]);
  if (!isProductDetails(product) || product.id !== Number(id)) throw new Error("Produit introuvable ou données invalides.");
  return { product, balance, movements: movements.filter((movement) => movement.productId === product.id) };
}
