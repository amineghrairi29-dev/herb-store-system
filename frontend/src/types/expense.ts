import { isPaymentMethod, type PaymentMethod } from "./purchase-payment";
export const expenseCategoryLabels = { RENT: "Loyer", ELECTRICITY: "Électricité", WATER: "Eau", SALARY: "Salaires", TRANSPORT: "Transport", MAINTENANCE: "Maintenance", ADMINISTRATIVE: "Frais administratifs", TAX: "Taxes", OTHER: "Autre" } as const;
export type ExpenseCategory = keyof typeof expenseCategoryLabels;
export interface ExpenseInput { reference: string; category: ExpenseCategory; description: string; amount: string; paymentMethod: PaymentMethod; expenseDate: string; notes: string | null }
export interface Expense extends ExpenseInput { id: number; createdAt: string; updatedAt: string }
export function isExpenseCategory(value: string): value is ExpenseCategory { return Object.hasOwn(expenseCategoryLabels, value); }
export function isExpense(value: unknown): value is Expense {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "number" && Number.isSafeInteger(row.id) && row.id > 0
    && typeof row.reference === "string" && typeof row.description === "string"
    && typeof row.category === "string" && isExpenseCategory(row.category)
    && typeof row.paymentMethod === "string" && isPaymentMethod(row.paymentMethod)
    && typeof row.amount === "string" && /^\d+(?:\.\d+)?$/.test(row.amount)
    && typeof row.expenseDate === "string" && typeof row.createdAt === "string" && typeof row.updatedAt === "string"
    && (row.notes === null || typeof row.notes === "string");
}
export function readExpense(value: unknown): Expense { if (!isExpense(value)) throw new Error("Réponse dépense invalide."); return value; }
export function readExpenses(value: unknown): Expense[] { if (!Array.isArray(value) || !value.every(isExpense)) throw new Error("Liste de dépenses invalide."); return value; }
