import { ConflictException, Controller, Delete, Get, Header, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post, StreamableFile, UploadedFile, UseInterceptors, Inject } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Access } from '../auth/auth-policy.js';
import { withProductTransaction } from '../prisma/product-transaction.js';
import { audited } from '../audit/audit.service.js';
import { discardUnreferencedImage, MAX_PRODUCT_IMAGE_BYTES, normalizeProductImage, readProductImage, storeProductImage, type ProductImageUpload } from './product-image-storage.js';

@Injectable()
export class ProductImagesService {
  async replace(id: number, file?: ProductImageUpload) {
    const image = await normalizeProductImage(file);
    let nextPath: string | undefined, oldPath: string | null = null;
    try {
      const result = await withProductTransaction(id, async tx => {
        const product = await tx.orm.public.Product.first({ id });
        oldPath = product?.mainImagePath ?? null;
        nextPath = await storeProductImage(image);
        await tx.orm.public.Product.where({ id }).update({ mainImagePath: nextPath });
        return audited(tx, 'PRODUCT_UPDATE', 'PRODUCT', { id, mainImagePath: nextPath }, { changedFields: ['mainImagePath'] }, id, product?.sku);
      });
      await discardUnreferencedImage(oldPath);
      return result;
    } catch (error: unknown) {
      await discardUnreferencedImage(nextPath);
      throw error;
    }
  }
}
/** Up to 6 extra photos per product, shown after the main image. */
export const MAX_GALLERY_IMAGES = 6;
@Injectable()
export class ProductGalleryService {
  async add(id: number, file?: ProductImageUpload) {
    const image = await normalizeProductImage(file);
    let nextPath: string | undefined;
    try {
      return await withProductTransaction(id, async tx => {
        const product = await tx.orm.public.Product.first({ id });
        if (!product) throw new NotFoundException('Produit introuvable.');
        const existing = await tx.orm.public.ProductImage.where({ productId: id }).all();
        if (existing.length >= MAX_GALLERY_IMAGES) throw new ConflictException(`Maximum ${MAX_GALLERY_IMAGES} photos supplémentaires par produit.`);
        nextPath = await storeProductImage(image);
        const row = await tx.orm.public.ProductImage.create({ productId: id, path: nextPath, sortOrder: Math.max(0, ...existing.map(item => item.sortOrder)) + 1 });
        return audited(tx, 'PRODUCT_UPDATE', 'PRODUCT', { id: row.id, productId: id, path: row.path, sortOrder: row.sortOrder }, { changedFields: ['gallery'] }, id, product.sku);
      });
    } catch (error: unknown) {
      await discardUnreferencedImage(nextPath);
      throw error;
    }
  }
  async remove(id: number, imageId: number) {
    let path: string | null = null;
    const result = await withProductTransaction(id, async tx => {
      const row = await tx.orm.public.ProductImage.first({ id: imageId, productId: id });
      if (!row) throw new NotFoundException('Photo introuvable.');
      path = row.path;
      await tx.orm.public.ProductImage.where({ id: imageId }).delete();
      const product = await tx.orm.public.Product.first({ id });
      return audited(tx, 'PRODUCT_UPDATE', 'PRODUCT', { id: imageId, productId: id, path: row.path }, { changedFields: ['gallery'] }, id, product?.sku);
    });
    await discardUnreferencedImage(path);
    return result;
  }
}
@Access('PRODUCTS')
@Controller('products')
class ProductImagesController {
  constructor(@Inject(ProductImagesService) private readonly service: ProductImagesService, @Inject(ProductGalleryService) private readonly gallery: ProductGalleryService) {}
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1, fields: 0, parts: 2 } }))
  upload(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: ProductImageUpload) { return this.service.replace(id, file); }
  @Post(':id/gallery')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1, fields: 0, parts: 2 } }))
  addPhoto(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: ProductImageUpload) { return this.gallery.add(id, file); }
  @Delete(':id/gallery/:imageId')
  removePhoto(@Param('id', ParseIntPipe) id: number, @Param('imageId', ParseIntPipe) imageId: number) { return this.gallery.remove(id, imageId); }
}
// A single constrained static resource route, not a filesystem directory mount.
@Access('PUBLIC')
@Controller('uploads/products')
class ProductImageFilesController {
  @Get(':filename')
  @Header('Cross-Origin-Resource-Policy', 'cross-origin')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'public, max-age=86400, immutable')
  async image(@Param('filename') filename: string) {
    return new StreamableFile(await readProductImage(filename), { type: 'image/webp', disposition: 'inline' });
  }
}
@Module({ controllers: [ProductImagesController, ProductImageFilesController], providers: [ProductImagesService, ProductGalleryService] })
export class ProductImagesModule {}
