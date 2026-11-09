import { isSalePayment, type SalePayment } from "./sale-payment";
import type { PaymentStatus } from "./purchase-payment";
export type SaleStatus = "DRAFT" | "CONFIRMED" | "CANCELLED";
export const saleStatusLabels: Record<SaleStatus, string> = { DRAFT: "Brouillon", CONFIRMED: "Confirmée", CANCELLED: "Annulée" };
export interface SaleLineInput { productId: number; quantity: string; unit: string; unitSalePrice: string }
export interface SaleInput { reference: string; saleDate: string; customerName: string | null; customerPhone: string | null; notes: string | null; lines: SaleLineInput[] }
export interface SaleLine extends SaleLineInput { id: number; saleId: number; quantityInStorageUnit: string; lineTotal: string; product: { id: number; sku: string; name: string } }
export interface Sale extends SaleInput { id: number; status: SaleStatus; confirmedAt: string | null; createdAt: string; updatedAt: string; lines: SaleLine[]; totalAmount: string; totalPaid: string; remainingAmount: string; paymentStatus: PaymentStatus; payments: SalePayment[]; onlineOrder?: { id: number; reference: string } | null }
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
const decimal = (value: unknown): value is string => typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value);
export function isSale(value: unknown): value is Sale {
  return record(value) && typeof value.id === "number" && typeof value.reference === "string" && typeof value.saleDate === "string"
    && (value.status === "DRAFT" || value.status === "CONFIRMED" || value.status === "CANCELLED")
    && [value.customerName, value.customerPhone, value.notes, value.confirmedAt].every((item) => item === null || typeof item === "string")
    && typeof value.createdAt === "string" && typeof value.updatedAt === "string" && decimal(value.totalAmount)
    && (value.onlineOrder == null || (record(value.onlineOrder) && typeof value.onlineOrder.id === "number" && typeof value.onlineOrder.reference === "string"))
    && decimal(value.totalPaid) && decimal(value.remainingAmount) && (value.paymentStatus === "NON_PAID" || value.paymentStatus === "PARTIALLY_PAID" || value.paymentStatus === "PAID")
    && Array.isArray(value.payments) && value.payments.every(isSalePayment)
    && Array.isArray(value.lines) && value.lines.every((line: unknown) => record(line) && typeof line.id === "number" && typeof line.saleId === "number" && typeof line.productId === "number"
      && typeof line.unit === "string" && decimal(line.quantity) && decimal(line.unitSalePrice) && decimal(line.quantityInStorageUnit) && decimal(line.lineTotal)
      && record(line.product) && typeof line.product.id === "number" && typeof line.product.sku === "string" && typeof line.product.name === "string");
}
