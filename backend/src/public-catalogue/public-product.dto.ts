import type { Availability } from './catalogue-query.js';

/** Explicit customer-facing allowlist; never return an internal Product object. */
export interface PublicProductDto {
  id: number;
  mainImagePath: string | null;
  sku: string;
  name: string;
  nameFr: string | null;
  scientificName: string | null;
  classifications: PublicClassification[];
  category: PublicClassification;
  subcategory: PublicClassification | null;
  salePrice: string;
  saleUnit: string;
  packaging: string | null;
  origin: string | null;
  description: string | null;
  availabilityStatus: Availability;
}
export interface PublicClassification { id: number; slug: string; nameAr: string; nameFr: string }
