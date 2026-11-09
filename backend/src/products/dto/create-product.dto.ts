export class CreateProductDto {
  sku: string;
  name: string;
  nameFr?: string;
  scientificName?: string;
  barcode?: string | null;
  productType: string;
  salePrice: string;
  classificationIds: number[];
  measurementMode: string;
  storageUnit: string;
  saleUnit: string;
  conversionFactor: string;
  minStock?: string | null;
  maxStock?: string | null;
  location?: string | null;
  origin?: string;
  packaging?: string;
  description?: string;
  isActive?: boolean;
  isSellable?: boolean;
  isVisibleOnline?: boolean;
}
