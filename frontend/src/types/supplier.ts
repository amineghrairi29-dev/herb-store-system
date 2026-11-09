export const supplierTextFields = ["code", "name", "contactName", "phone", "email", "address", "city", "country", "taxId", "notes"] as const;
export type SupplierTextField = typeof supplierTextFields[number];
export type CreateSupplierInput = { code: string; name: string; isActive: boolean } & Record<Exclude<SupplierTextField, "code" | "name">, string | null>;
export type Supplier = CreateSupplierInput & { id: number; createdAt: string; updatedAt: string };

export function isSupplier(value: unknown): value is Supplier {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return Number.isInteger(row.id) && typeof row.code === "string" && typeof row.name === "string" && typeof row.isActive === "boolean"
    && typeof row.createdAt === "string" && typeof row.updatedAt === "string"
    && supplierTextFields.every((key) => typeof row[key] === "string" || (key !== "code" && key !== "name" && row[key] === null));
}
