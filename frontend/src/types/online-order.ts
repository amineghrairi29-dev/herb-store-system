export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export interface OrderLine { productId: number; productNameSnapshot: string; unitSnapshot: string; quantity: string; unitPrice: string; lineTotal: string }
export interface OrderReceipt { reference: string; status: OrderStatus; totalAmount: string; createdAt: string }
export interface OnlineOrder extends OrderReceipt { id: number; customerName: string; customerPhone: string; customerEmail: string | null; deliveryAddress: string | null; deliveryGovernorate: string | null; deliveryCity: string | null; deliveryFee: string | null; notes: string | null; confirmedAt: string | null; cancelledAt: string | null; items: OrderLine[]; saleId: number | null; convertedAt: string | null; fulfillmentStatus: "NOT_CONVERTED" | "CONVERTED"; sale: { id: number; reference: string; status: "DRAFT" | "CONFIRMED" | "CANCELLED" } | null }
export const orderStatusLabels: Record<OrderStatus, string> = { PENDING: "En attente", CONFIRMED: "Confirmée", CANCELLED: "Annulée" };
/** Items total + delivery fee, computed in millimes to avoid float rounding. */
export function orderGrandTotal(totalAmount: string, deliveryFee: string | null): string {
  const millimes = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0").slice(0, 3)); };
  const sum = millimes(totalAmount) + (deliveryFee ? millimes(deliveryFee) : BigInt(0));
  return `${sum / BigInt(1000)}.${(sum % BigInt(1000)).toString().padStart(3, "0")}`;
}
