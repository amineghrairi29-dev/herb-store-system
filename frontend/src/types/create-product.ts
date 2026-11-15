export interface CreateProductInput {
  sku: string;
  name: string;
  productType: "VRAC" | "EMBALLE";
  salePrice: string;
  classificationIds: number[];
  measurementMode: string;
  storageUnit: string;
  saleUnit: string;
  conversionFactor: string;
  minStock?: string | null;
  maxStock?: string | null;
  location?: string | null;
  nameFr?: string;
  scientificName?: string;
  barcode?: string | null;
  origin?: string;
  packaging?: string;
  description?: string;
  benefits?: string;
  usage?: string;
  precautions?: string;
  isActive: boolean;
  isSellable: boolean;
  isVisibleOnline: boolean;
}
