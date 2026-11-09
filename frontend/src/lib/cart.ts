export const CART_KEY = "herb-store-cart-v1";
export const MAX_CART_LINES = 100;
export interface CartItem { productId: number; quantity: string }

export function cartQuantity(input: string): string | null {
  const value = input.trim().replace(",", ".");
  if (!/^\d{1,60}(?:\.\d{1,18})?$/.test(value) || !/[1-9]/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/^0+(?=\d)/, "")}.${fraction.replace(/0+$/, "").padEnd(3, "0")}`;
}
function parts(value: string) { const [whole, fraction = ""] = value.split("."); return { digits: BigInt(whole + fraction), scale: fraction.length }; }
function decimal(digits: bigint, scale: number): string {
  const text = digits.toString().padStart(scale + 1, "0");
  return scale ? `${text.slice(0, -scale)}.${text.slice(-scale).replace(/0+$/, "").padEnd(3, "0")}` : `${text}.000`;
}
export function addDecimals(a: string, b: string): string {
  const x = parts(a), y = parts(b), scale = Math.max(x.scale, y.scale);
  return decimal(x.digits * BigInt(10) ** BigInt(scale - x.scale) + y.digits * BigInt(10) ** BigInt(scale - y.scale), scale);
}
export function lineSubtotal(quantity: string, price: string): string {
  const a = parts(quantity), b = parts(price);
  return decimal(a.digits * b.digits, a.scale + b.scale);
}
export function stepQuantity(quantity: string, direction: 1 | -1): string | null {
  if (direction === 1) return cartQuantity(addDecimals(quantity, "1"));
  const { digits, scale } = parts(quantity), next = digits - BigInt(10) ** BigInt(scale);
  return next > BigInt(0) ? decimal(next, scale) : null;
}
export function readCart(raw: string | null): { items: CartItem[]; recovered: boolean } {
  if (raw === null) return { items: [], recovered: false };
  try {
    if (raw.length > 50000) return { items: [], recovered: true };
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || !("version" in data) || data.version !== 1 || !("items" in data) || !Array.isArray(data.items)) return { items: [], recovered: true };
    const items = new Map<number, CartItem>(); let recovered = false;
    for (const entry of data.items) {
      if (!entry || typeof entry !== "object" || !("productId" in entry) || typeof entry.productId !== "number" || !Number.isInteger(entry.productId) || entry.productId < 1 || entry.productId > 2147483647 || !("quantity" in entry) || typeof entry.quantity !== "string") { recovered = true; continue; }
      const quantity = cartQuantity(entry.quantity);
      if (!quantity || items.size >= MAX_CART_LINES) { recovered = true; continue; }
      if (items.has(entry.productId)) { recovered = true; continue; }
      items.set(entry.productId, { productId: entry.productId, quantity });
    }
    return { items: [...items.values()], recovered };
  } catch { return { items: [], recovered: true }; }
}
