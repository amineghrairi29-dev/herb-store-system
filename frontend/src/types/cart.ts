import type { PublicProduct, Availability } from "./public-product";
export interface ValidatedCartItem {
  productId: number; valid: boolean; quantityAvailable: boolean;
  availabilityStatus: Availability | null; currentPrice: string | null;
  product: PublicProduct | null; message: string | null;
}
