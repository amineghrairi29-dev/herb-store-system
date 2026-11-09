export type OrderStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
export interface OrderLine { productId: number; productNameSnapshot: string; unitSnapshot: string; quantity: string; unitPrice: string; lineTotal: string }
export interface OrderReceipt { reference: string; status: OrderStatus; totalAmount: string; createdAt: string }
export interface OnlineOrder extends OrderReceipt { id: number; customerName: string; customerPhone: string; customerEmail: string | null; notes: string | null; confirmedAt: string | null; cancelledAt: string | null; items: OrderLine[]; saleId: number | null; convertedAt: string | null; fulfillmentStatus: "NOT_CONVERTED" | "CONVERTED"; sale: { id: number; reference: string; status: "DRAFT" | "CONFIRMED" | "CANCELLED" } | null }
export const orderStatusLabels: Record<OrderStatus, string> = { PENDING: "En attente", CONFIRMED: "Confirmée", CANCELLED: "Annulée" };
