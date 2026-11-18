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
  /** BOX, BAG (sold by weight) or LIQUID; null for products created before recipes. */
  recipeFormat: 'BOX' | 'BAG' | 'LIQUID' | null;
  origin: string | null;
  description: string | null;
  availabilityStatus: Availability;
  /** Product detail only. */
  benefits?: string | null;
  usage?: string | null;
  precautions?: string | null;
  ingredients?: string | null;
  gallery?: string[];
}
export interface PublicClassification {
  id: number;
  slug: string;
  nameAr: string;
  nameFr: string;
}
