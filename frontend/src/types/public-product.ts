export type Availability = "OUT_OF_STOCK" | "LOW_STOCK" | "IN_STOCK";
export interface PublicProduct {
  mainImagePath: string | null;
  id: number; sku: string; name: string; nameFr: string | null;
  classifications: PublicClassification[];
  scientificName: string | null; category: PublicClassification; subcategory: PublicClassification | null;
  salePrice: string; saleUnit: string; packaging: string | null;
  origin: string | null; description: string | null; availabilityStatus: Availability;
}
export interface CatalogueResponse {
  data: PublicProduct[];
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
}
export interface PublicClassification { id: number; slug: string; nameAr: string; nameFr: string }
export interface PublicCategory extends PublicClassification { imagePath: string | null; subcategories: PublicClassification[] }
