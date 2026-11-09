export const paymentMethodLabels = { CASH: "Espèces", BANK_TRANSFER: "Virement bancaire", CARD: "Carte", CHECK: "Chèque", OTHER: "Autre" } as const;
export type PaymentMethod = keyof typeof paymentMethodLabels;
export const paymentStatusLabels = { NON_PAID: "Non payé", PARTIALLY_PAID: "Partiellement payé", PAID: "Payé" } as const;
export type PaymentStatus = keyof typeof paymentStatusLabels;
export interface CreatePurchasePaymentInput { amount: string; paymentMethod: PaymentMethod; paymentDate: string; reference: string | null; notes: string | null }
export interface PurchasePayment extends CreatePurchasePaymentInput { id: number; purchaseId: number; createdAt: string }
export function isPaymentMethod(value: string): value is PaymentMethod { return Object.hasOwn(paymentMethodLabels, value); }
export function isPurchasePayment(value: unknown): value is PurchasePayment {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && typeof row.purchaseId === "number" && typeof row.createdAt === "string" && typeof row.paymentDate === "string"
    && typeof row.amount === "string" && /^\d+(?:\.\d+)?$/.test(row.amount) && typeof row.paymentMethod === "string" && isPaymentMethod(row.paymentMethod)
    && (row.reference === null || typeof row.reference === "string") && (row.notes === null || typeof row.notes === "string");
}
