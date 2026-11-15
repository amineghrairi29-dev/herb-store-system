import { apiBase } from "@/lib/api-base";
import { tunisianPhone } from "@/lib/phone";

/** Public storefront contact details, edited in Paramètres > Boutique. */
export interface StoreInfo {
  storeName: string;
  phone: string | null;
  secondaryPhone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
}

export function isStoreInfo(value: unknown): value is StoreInfo {
  return !!value && typeof value === "object" && "storeName" in value && typeof value.storeName === "string";
}

/** Server-side read, cached 5 minutes; null when the API is unreachable. */
export async function getStoreInfo(): Promise<StoreInfo | null> {
  try {
    const response = await fetch(`${apiBase}/public/store-info`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    return isStoreInfo(value) ? value : null;
  } catch {
    return null;
  }
}

/** "98231746" -> "98 231 746"; other formats are shown as typed. */
export function displayPhone(phone: string): string {
  const digits = tunisianPhone(phone);
  return digits ? `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}` : phone;
}

/** wa.me link for a Tunisian number, with an optional pre-filled message. */
export function whatsappLink(phone: string | null | undefined, message?: string): string | null {
  const digits = phone ? tunisianPhone(phone) : null;
  if (!digits) return null;
  return `https://wa.me/216${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
