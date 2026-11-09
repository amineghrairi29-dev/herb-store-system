import { normalizeDecimal } from "./decimal";
const SCALE = BigInt("1000000000000000000000000000000000000");
function amount(value: string): bigint { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * SCALE + BigInt(fraction.padEnd(36, "0")); }
function format(value: bigint): string { return `${value / SCALE}.${(value % SCALE).toString().padStart(36, "0").replace(/0+$/, "").padEnd(3, "0")}`; }
export function purchaseDecimal(value: string): string | null {
  const normalized = normalizeDecimal(value);
  return normalized && /^\d{1,60}\.\d{3,18}$/.test(normalized) && /[1-9]/.test(normalized) ? normalized : null;
}
export function previewSubtotal(quantity: string, price: string): string | null {
  const q = purchaseDecimal(quantity), p = purchaseDecimal(price);
  if (!q || !p) return null;
  return format(amount(q) * amount(p) / SCALE);
}
export function previewTotal(values: (string | null)[]): string | null {
  if (values.some((value) => value === null)) return null;
  return format(values.reduce<bigint>((sum, value) => sum + amount(value!), BigInt(0)));
}
export function paymentDecimal(value: string): string | null {
  const normalized = normalizeDecimal(value);
  return normalized && /^\d{1,130}\.\d{3,36}$/.test(normalized) && /[1-9]/.test(normalized) ? normalized : null;
}
export function displayAmount(value: string): string {
  const [whole, fraction = ""] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${fraction.padEnd(3, "0")}`;
}
