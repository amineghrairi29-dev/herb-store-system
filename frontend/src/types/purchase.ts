import { isPurchasePayment, type PurchasePayment, type PaymentStatus } from "./purchase-payment";
export type PurchaseStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export interface PurchaseLineInput { productId: number; quantity: string; unit: string; unitPurchasePrice: string }
export interface PurchaseInput { reference: string; supplierId: number; purchaseDate: string; notes: string | null; lines: PurchaseLineInput[] }
export interface PurchaseLine extends PurchaseLineInput {
  id: number; purchaseId: number; quantityInStorageUnit: string; lineTotal: string;
  product: { id: number; sku: string; name: string };
}
export interface Purchase extends PurchaseInput {
  id: number; status: PurchaseStatus; confirmedAt: string | null; createdAt: string; updatedAt: string;
  supplier: { id: number; code: string; name: string; isActive: boolean };
  lines: PurchaseLine[]; totalAmount: string;
  totalPaid: string; remainingAmount: string; paymentStatus: PaymentStatus; payments: PurchasePayment[];
}
export const purchaseStatusLabels: Record<PurchaseStatus, string> = { DRAFT: "Brouillon", CONFIRMED: "Confirmé", CANCELLED: "Annulé" };
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
const decimal = (value: unknown): value is string => typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
export function isPurchase(value: unknown): value is Purchase {
  if (!record(value) || !record(value.supplier) || !Array.isArray(value.lines)) return false;
  return typeof value.id === "number" && typeof value.reference === "string" && typeof value.supplierId === "number"
    && typeof value.purchaseDate === "string" && (value.notes === null || typeof value.notes === "string")
    && (value.status === "DRAFT" || value.status === "CONFIRMED" || value.status === "CANCELLED")
    && (value.confirmedAt === null || typeof value.confirmedAt === "string") && typeof value.createdAt === "string" && typeof value.updatedAt === "string"
    && typeof value.supplier.id === "number" && typeof value.supplier.code === "string" && typeof value.supplier.name === "string" && typeof value.supplier.isActive === "boolean"
    && decimal(value.totalPaid) && decimal(value.remainingAmount) && (value.paymentStatus === "NON_PAID" || value.paymentStatus === "PARTIALLY_PAID" || value.paymentStatus === "PAID")
    && Array.isArray(value.payments) && value.payments.every(isPurchasePayment)
    && decimal(value.totalAmount) && value.lines.every((line: unknown) => record(line) && typeof line.id === "number" && typeof line.purchaseId === "number" && typeof line.productId === "number"
      && typeof line.unit === "string" && decimal(line.quantity) && decimal(line.unitPurchasePrice) && decimal(line.quantityInStorageUnit) && decimal(line.lineTotal)
      && record(line.product) && typeof line.product.id === "number" && typeof line.product.sku === "string" && typeof line.product.name === "string");
}
