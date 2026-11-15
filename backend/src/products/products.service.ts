import { productClassifications, validateLinks, replaceLinks } from '../classifications/classifications.service.js';
import { validateMeasurement } from './product-measurement.js';
import { discardUnreferencedImage } from './product-image-storage.js';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { compareDecimals, validateProductInput, validateStockRange } from './product-validation.js';
import { withProductTransaction } from '../prisma/product-transaction.js';
import { withPurchaseTransaction } from '../purchases/purchase-transaction.js';
import { audited } from '../audit/audit.service.js';
import { changedFields } from '../audit/audit-values.js';
import { isUniqueViolation } from '../suppliers/supplier-validation.js';

function productWriteError(error: unknown): never {
  if (isUniqueViolation(error)) throw new ConflictException('Ce SKU ou ce code-barres est déjà utilisé.');
  let cause = error;
  for (let depth = 0; depth < 5 && cause && typeof cause === 'object'; depth++) {
    if ('code' in cause && (cause.code === '23503' || cause.code === '23001')) throw new ConflictException('Ce produit est référencé par un document et ne peut pas être supprimé.');
    cause = 'cause' in cause ? cause.cause : undefined;
  }
  throw error;
}

@Injectable()
export class ProductsService {
  async create(createProductDto: CreateProductDto) {
    const input = validateProductInput(createProductDto, false);
    return withPurchaseTransaction(async tx => {
      const { classificationIds, ...data } = input;
      validateMeasurement(data.measurementMode, data.storageUnit, data.saleUnit);
      const classifications = await validateLinks(tx, classificationIds);
      const product = await tx.orm.public.Product.create({ ...data, category: classifications.map(c => c.nameFr).join(' · ') });
      await replaceLinks(tx, product.id, classificationIds);
      return audited(tx, 'PRODUCT_CREATE', 'PRODUCT', { ...product, classificationIds, classifications });
    }).catch(productWriteError);
  }

  async findAll() {
    return withPurchaseTransaction(async tx => {
      const products = await tx.orm.public.Product.all();
      const links = (await tx.client.query<{ productId: number; classifications: import('../classifications/classifications.service.js').ClassificationRow[] }>(`SELECT pc."productId", jsonb_agg(jsonb_build_object('id',c.id,'nameFr',c."nameFr",'nameAr',c."nameAr",'slug',c.slug,'isActive',c."isActive") ORDER BY c."sortOrder",c."nameFr",c.id) AS classifications FROM public."productClassification" pc JOIN public.classification c ON c.id=pc."classificationId" GROUP BY pc."productId"`)).rows;
      const byProduct = new Map(links.map(row => [row.productId, row.classifications]));
      return products.map(row => { const classifications = byProduct.get(row.id) ?? []; return { ...row, category: classifications.map(c => c.nameFr).join(' · '), subcategory: null, classifications, classificationIds: classifications.map(c => c.id) }; });
    }, true);
  }

  async findOne(id: number) {
    if (!Number.isInteger(id) || id <= 0 || id > 2147483647) throw new BadRequestException('Identifiant de produit invalide.');
    return withPurchaseTransaction(async tx => {
      const product = await tx.orm.public.Product.first({ id });
      if (!product) throw new NotFoundException('Produit introuvable.');
      const classifications = await productClassifications(tx, id);
      const gallery = (await tx.orm.public.ProductImage.where({ productId: id }).all()).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map(({ id: imageId, path }) => ({ id: imageId, path }));
      return { ...product, category: classifications.map(c => c.nameFr).join(' · '), subcategory: null, classifications, classificationIds: classifications.map(c => c.id), gallery };
    }, true);
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    const input = validateProductInput(updateProductDto, true);
    return withProductTransaction(id, async (tx) => {
      const existing = await tx.orm.public.Product.first({ id });
      if (!existing) throw new NotFoundException('Produit introuvable.');
      const changesUnits = (input.storageUnit !== undefined && input.storageUnit !== existing.storageUnit)
        || (input.saleUnit !== undefined && input.saleUnit !== existing.saleUnit)
        || (input.conversionFactor !== undefined && compareDecimals(input.conversionFactor, existing.conversionFactor) !== 0);
      if (changesUnits && await tx.orm.public.StockMovement.where({ productId: id }).first()) {
        throw new ConflictException('Les unités et le facteur ne peuvent plus être modifiés après un mouvement de stock.');
      }
      const oldLinks = await productClassifications(tx, id);
      const ids = input.classificationIds ?? oldLinks.map(c => c.id);
      const classifications = await validateLinks(tx, ids, oldLinks.map(c => c.id));
      validateMeasurement(input.measurementMode ?? existing.measurementMode, input.storageUnit ?? existing.storageUnit, input.saleUnit ?? existing.saleUnit);
      const { classificationIds: _ids, ...data } = input;
      await replaceLinks(tx, id, ids);
      validateStockRange(
        input.minStock === undefined ? existing.minStock : input.minStock,
        input.maxStock === undefined ? existing.maxStock : input.maxStock,
      );
      return audited(tx, 'PRODUCT_UPDATE', 'PRODUCT', { ...await tx.orm.public.Product.where({ id }).update({ ...data, category: classifications.map(c => c.nameFr).join(' · ') }), classifications, classificationIds: ids }, { changedFields: changedFields(input) });
    }).catch(productWriteError);
  }

  remove(id: number) {
    let imagePath: string | null = null, galleryPaths: string[] = [];
    return withProductTransaction(id, async (tx) => {
      if (await tx.orm.public.StockMovement.where({ productId: id }).first()) {
        throw new ConflictException('Ce produit possède des mouvements de stock et ne peut pas être supprimé.');
      }
      const product = await tx.orm.public.Product.first({ id });
      imagePath = product?.mainImagePath ?? null;
      // Gallery rows reference the product (ON DELETE RESTRICT): remove them first, files after commit.
      galleryPaths = (await tx.orm.public.ProductImage.where({ productId: id }).all()).map(row => row.path);
      await tx.client.query('DELETE FROM public."productImage" WHERE "productId" = $1', [id]);
      return audited(tx, 'PRODUCT_DELETE', 'PRODUCT', await tx.orm.public.Product.where({ id }).delete(), undefined, id, product?.sku);
    }).then(async result => { await discardUnreferencedImage(imagePath); for (const path of galleryPaths) await discardUnreferencedImage(path); return result; }).catch(productWriteError);
  }
}
