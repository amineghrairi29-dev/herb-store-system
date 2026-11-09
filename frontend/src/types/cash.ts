import { isPaymentMethod, type PaymentMethod } from "./purchase-payment";

export const cashSourceLabels = { SALE_PAYMENT: "Paiement vente", PURCHASE_PAYMENT: "Paiement fournisseur", MANUAL_IN: "Entrée manuelle", MANUAL_OUT: "Sortie manuelle", EXPENSE: "Dépense" } as const;
export type CashSource = keyof typeof cashSourceLabels;
export interface CashMovement {
  id: number; type: "IN" | "OUT"; sourceType: CashSource; sourceId: number | null;
  amount: string; paymentMethod: PaymentMethod; movementDate: string;
  reference: string | null; description: string; notes: string | null; createdAt: string;
  linkedSaleId: number | null; linkedPurchaseId: number | null; linkedExpenseId: number | null; linkedReference: string | null;
}
export interface CashSummary {
  physicalCashBalance: string; cashInflows: string; cashOutflows: string;
  totalFinancialInflows: string; totalFinancialOutflows: string; netFinancialFlow: string;
  todayCashInflows: string; todayCashOutflows: string; businessDate: string; timeZone: string;
}
const nullableText = (value: unknown) => value === null || typeof value === "string";
const nullableId = (value: unknown) => value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0);
export function isCashMovement(value: unknown): value is CashMovement {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && row.id > 0 && (row.type === "IN" || row.type === "OUT")
    && typeof row.sourceType === "string" && Object.hasOwn(cashSourceLabels, row.sourceType) && nullableId(row.sourceId)
    && typeof row.amount === "string" && /^\d+(?:\.\d+)?$/.test(row.amount)
    && typeof row.paymentMethod === "string" && isPaymentMethod(row.paymentMethod)
    && typeof row.movementDate === "string" && typeof row.createdAt === "string" && typeof row.description === "string"
    && nullableText(row.reference) && nullableText(row.notes) && nullableText(row.linkedReference)
    && nullableId(row.linkedSaleId) && nullableId(row.linkedPurchaseId) && nullableId(row.linkedExpenseId);
}
export function readCashMovements(value: unknown): CashMovement[] {
  if (!Array.isArray(value) || !value.every(isCashMovement)) throw new Error("Réponse des mouvements invalide.");
  return value;
}
export function readCashSummary(value: unknown): CashSummary {
  if (typeof value !== "object" || value === null) throw new Error("Résumé de caisse invalide.");
  const row = value as Record<string, unknown>;
  for (const key of ["physicalCashBalance", "cashInflows", "cashOutflows", "totalFinancialInflows", "totalFinancialOutflows", "netFinancialFlow", "todayCashInflows", "todayCashOutflows"]) {
    if (typeof row[key] !== "string" || !/^-?\d+(?:\.\d+)?$/.test(row[key])) throw new Error("Montant de caisse invalide.");
  }
  if (typeof row.businessDate !== "string" || typeof row.timeZone !== "string") throw new Error("Date de caisse invalide.");
  return value as CashSummary;
}
