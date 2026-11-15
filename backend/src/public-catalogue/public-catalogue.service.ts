import { Injectable, NotFoundException } from '@nestjs/common';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { positiveTypes } from '../stock-movements/stock-decimal.js';
import { catalogueQuery, sorts } from './catalogue-query.js';
import type { PublicProductDto } from './public-product.dto.js';
import type { PublicCategoryDto } from './public-category.dto.js';
import { stockCatalogue } from '../stock-movements/stock-read.js';

// Same signed quantityInStorageUnit ledger and movement polarity as aggregateStock.
// PostgreSQL numeric SUM/comparisons retain exact decimals. No per-product queries.
export const catalogue = stockCatalogue('public');
const activeClassifications = `(SELECT COALESCE(jsonb_agg(jsonb_build_object('id', c.id, 'slug', c.slug, 'nameAr', c."nameAr", 'nameFr', c."nameFr") ORDER BY c."sortOrder",c."nameFr",c.id), '[]'::jsonb) FROM public.classification c JOIN public."productClassification" pc ON pc."classificationId"=c.id WHERE pc."productId"=catalogue.id AND c."isActive")`;
export const fields = `id, "mainImagePath", sku, name, "nameFr", "scientificName", ${activeClassifications} AS classifications, ${activeClassifications}->0 AS category, NULL::jsonb AS subcategory, "salePrice"::text, "saleUnit", packaging, origin, description, "availabilityStatus"`;

@Injectable()
export class PublicCatalogueService {
  async list(raw: Record<string, unknown>) {
    const query = catalogueQuery(raw);
    const where = `WHERE ($2 = '' OR strpos(lower(concat_ws(' ', name, "nameFr", "scientificName", ${activeClassifications}::text)), lower($2)) > 0)
      AND ($3 = '' OR EXISTS (SELECT 1 FROM public.classification c JOIN public."productClassification" pc ON pc."classificationId"=c.id WHERE pc."productId"=catalogue.id AND c."isActive" AND (c.slug=$3 OR c.id::text=$3)))
      AND ($4 = '' OR EXISTS (SELECT 1 FROM public.classification c JOIN public."productClassification" pc ON pc."classificationId"=c.id WHERE pc."productId"=catalogue.id AND c."isActive" AND c."legacySubcategoryId"::text=$4)) AND ($5 = '' OR "availabilityStatus" = $5)`;
    const values = [positiveTypes, query.q, query.classification, query.subcategory, query.availability];
    return withPurchaseTransaction(async ({ client }) => {
      const count = await client.query<{ count: string }>(`${catalogue} SELECT count(*)::text FROM catalogue ${where}`, values);
      const totalItems = Number(count.rows[0].count);
      const result = await client.query<PublicProductDto>(`${catalogue} SELECT ${fields} FROM catalogue ${where} ORDER BY ${sorts[query.sort]} LIMIT $6 OFFSET $7`, [...values, query.pageSize, (query.page - 1) * query.pageSize]);
      return { data: result.rows, pagination: { page: query.page, pageSize: query.pageSize, totalItems, totalPages: Math.ceil(totalItems / query.pageSize) } };
    }, true);
  }

  async detail(id: string) {
    if (!/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) throw new NotFoundException('Produit introuvable.');
    return withPurchaseTransaction(async ({ client }) => {
      // Detail only: long texts and the photo gallery are not needed by catalogue cards.
      const result = await client.query<PublicProductDto>(`${catalogue} SELECT ${fields}, benefits, usage, precautions,
        (SELECT COALESCE(jsonb_agg(pi.path ORDER BY pi."sortOrder", pi.id), '[]'::jsonb) FROM public."productImage" pi WHERE pi."productId" = catalogue.id) AS gallery
        FROM catalogue WHERE id = $2`, [positiveTypes, Number(id)]);
      if (!result.rows[0]) throw new NotFoundException('Produit introuvable.');
      return result.rows[0];
    }, true);
  }

  async categories(withProducts = false) {
    return withPurchaseTransaction(async ({ client }) => {
      const result = await client.query<PublicCategoryDto>(`${withProducts ? catalogue : ''}
        SELECT c.id, c.slug, c."nameAr", c."nameFr", c."imagePath", '[]'::jsonb AS subcategories
        FROM public.classification c WHERE c."isActive"
        ${withProducts ? 'AND EXISTS (SELECT 1 FROM catalogue p JOIN public."productClassification" pc ON pc."productId"=p.id WHERE pc."classificationId"=c.id)' : ''}
        ORDER BY c."sortOrder",c."nameFr",c.id`, withProducts ? [positiveTypes] : []);
      return result.rows;
    }, true);
  }
}
