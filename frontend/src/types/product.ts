export interface Product {
  id: number;
  mainImagePath: string | null;
  sku: string;
  name: string;
  nameFr: string | null;
  productType: string;
  salePrice: string | number;
  category: string;
  classificationIds: number[];
  measurementMode: string;
  categoryId: number | null;
  subcategoryId: number | null;
  storageUnit: string;
  saleUnit: string;
  isActive: boolean;
  isVisibleOnline: boolean;
}

export interface ProductDetails extends Product {
  productType: "VRAC" | "EMBALLE";
  scientificName: string | null;
  barcode: string | null;
  origin: string | null;
  packaging: string | null;
  description: string | null;
  isSellable: boolean;
  subcategory: string | null;
  conversionFactor: string;
  minStock: string | null;
  maxStock: string | null;
  location: string | null;
  /** Optional storefront texts (may be missing on older API responses). */
  benefits?: string | null;
  usage?: string | null;
  precautions?: string | null;
  gallery?: { id: number; path: string }[];
}

export function isProductDetails(value: unknown): value is ProductDetails {
  if (!isProduct(value)) return false;
  const nullableFields = ["scientificName", "barcode", "origin", "packaging", "description", "subcategory", "location"] as const;
  return (
    (value.productType === "VRAC" || value.productType === "EMBALLE") &&
    "isSellable" in value && typeof value.isSellable === "boolean" &&
    "conversionFactor" in value && typeof value.conversionFactor === "string" && /^\d+(?:\.\d+)?$/.test(value.conversionFactor) &&
    "minStock" in value && (value.minStock === null || (typeof value.minStock === "string" && /^\d+(?:\.\d+)?$/.test(value.minStock))) &&
    "maxStock" in value && (value.maxStock === null || (typeof value.maxStock === "string" && /^\d+(?:\.\d+)?$/.test(value.maxStock))) &&
    nullableFields.every((field) =>
      field in value && (Reflect.get(value, field) === null || typeof Reflect.get(value, field) === "string")
    )
  );
}

export function isProduct(value: unknown): value is Product {
  if (typeof value !== "object" || value === null) return false;

  return (
    "classificationIds" in value && Array.isArray(value.classificationIds) && value.classificationIds.every(id => typeof id === "number") &&
    "measurementMode" in value && typeof value.measurementMode === "string" &&
    "categoryId" in value && (value.categoryId === null || typeof value.categoryId === "number") &&
    "subcategoryId" in value && (value.subcategoryId === null || typeof value.subcategoryId === "number") &&
    "id" in value && typeof value.id === "number" &&
    "mainImagePath" in value && (value.mainImagePath === null || typeof value.mainImagePath === "string") &&
    "sku" in value && typeof value.sku === "string" &&
    "name" in value && typeof value.name === "string" &&
    "nameFr" in value && (value.nameFr === null || typeof value.nameFr === "string") &&
    "productType" in value && typeof value.productType === "string" &&
    "category" in value && typeof value.category === "string" &&
    "storageUnit" in value && typeof value.storageUnit === "string" &&
    "saleUnit" in value && typeof value.saleUnit === "string" &&
    "salePrice" in value &&
    (typeof value.salePrice === "number" ||
      (typeof value.salePrice === "string" && value.salePrice.trim() !== "")) &&
    Number.isFinite(Number(value.salePrice)) &&
    "isActive" in value && typeof value.isActive === "boolean" &&
    "isVisibleOnline" in value && typeof value.isVisibleOnline === "boolean"
  );
}
