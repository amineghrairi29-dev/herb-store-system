export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export interface OrderLine { productId: number; productNameSnapshot: string; unitSnapshot: string; quantity: string; unitPrice: string; lineTotal: string }
export interface OrderReceipt { reference: string; status: OrderStatus; totalAmount: string; createdAt: string }
export interface OnlineOrder extends OrderReceipt { id: number; customerName: string; customerPhone: string; customerEmail: string | null; deliveryAddress: string | null; deliveryGovernorate: string | null; deliveryCity: string | null; deliveryFee: string | null; deliveryStatus: DeliveryStatus | null; deliveryStatusAt: string | null; notes: string | null; confirmedAt: string | null; cancelledAt: string | null; items: OrderLine[]; saleId: number | null; convertedAt: string | null; fulfillmentStatus: "NOT_CONVERTED" | "CONVERTED"; sale: { id: number; reference: string; status: "DRAFT" | "CONFIRMED" | "CANCELLED" } | null }
export const orderStatusLabels: Record<OrderStatus, string> = { PENDING: "En attente", CONFIRMED: "Confirmée", CANCELLED: "Annulée" };
/** Items total + delivery fee, computed in millimes to avoid float rounding. */
export function orderGrandTotal(totalAmount: string, deliveryFee: string | null): string {
  const millimes = (value: string) => { const [whole, fraction = ""] = value.split("."); return BigInt(whole) * BigInt(1000) + BigInt(fraction.padEnd(3, "0").slice(0, 3)); };
  const sum = millimes(totalAmount) + (deliveryFee ? millimes(deliveryFee) : BigInt(0));
  return `${sum / BigInt(1000)}.${(sum % BigInt(1000)).toString().padStart(3, "0")}`;
}
export type DeliveryStatus = "PREPARING" | "SHIPPED" | "DELIVERED" | "RETURNED";
export const deliveryStatusLabels: Record<DeliveryStatus, string> = { PREPARING: "En préparation", SHIPPED: "En cours de livraison", DELIVERED: "Livrée", RETURNED: "Retournée" };
/** Same forward-only rules as the backend (delivery-status.ts). */
export const nextDeliveryStatuses: Record<DeliveryStatus | "NONE", DeliveryStatus[]> = { NONE: ["PREPARING", "SHIPPED", "DELIVERED"], PREPARING: ["SHIPPED", "DELIVERED"], SHIPPED: ["DELIVERED", "RETURNED"], DELIVERED: ["RETURNED"], RETURNED: [] };
/** One label for the customer, combining order and delivery status. */
export function customerOrderLabel(status: OrderStatus, deliveryStatus: DeliveryStatus | null): string {
  if (status === "PENDING") return "En attente de confirmation";
  if (status === "CANCELLED") return "Annulée";
  return deliveryStatus ? deliveryStatusLabels[deliveryStatus] : "Confirmée";
}
/** Progress steps shown to the customer (returned and cancelled orders show their label only). */
export const customerSteps = ["En attente de confirmation", "Confirmée", "En préparation", "En cours de livraison", "Livrée"] as const;
