import type { ProductDetails } from "@/types/product";
import { previewSubtotal, purchaseDecimal } from "./purchase-decimal";

/** salePrice is per saleUnit. Suggestions never round or convert binary numbers. */
export function suggestedSalePrice(product: ProductDetails, unit: string): string | null {
  const price = typeof product.salePrice === "string" ? purchaseDecimal(product.salePrice) : null;
  if (!price) return null;
  if (unit === product.saleUnit) return price;
  if (unit !== product.storageUnit) return null;
  const converted = previewSubtotal(price, product.conversionFactor);
  // Keep the backend's 18-place input contract. If exact conversion exceeds it,
  // leave the input empty for an explicit manual price instead of rounding.
  return converted === null ? null : purchaseDecimal(converted);
}
