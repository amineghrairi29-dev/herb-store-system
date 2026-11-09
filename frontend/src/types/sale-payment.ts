import { isPaymentMethod, type CreatePurchasePaymentInput } from "./purchase-payment";
export type CreateSalePaymentInput = CreatePurchasePaymentInput;
export interface SalePayment extends CreateSalePaymentInput { id: number; saleId: number; createdAt: string }
export function isSalePayment(value: unknown): value is SalePayment {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && typeof row.saleId === "number" && typeof row.createdAt === "string" && typeof row.paymentDate === "string"
    && typeof row.amount === "string" && /^\d+(?:\.\d+)?$/.test(row.amount) && typeof row.paymentMethod === "string" && isPaymentMethod(row.paymentMethod)
    && (row.reference === null || typeof row.reference === "string") && (row.notes === null || typeof row.notes === "string");
}
