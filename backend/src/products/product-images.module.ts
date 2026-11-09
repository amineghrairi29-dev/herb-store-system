import { Controller, Get, Header, Injectable, Module, Param, ParseIntPipe, Post, StreamableFile, UploadedFile, UseInterceptors, Inject } from '@nestjs/common';
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
@Access('PRODUCTS')
@Controller('products')
class ProductImagesController {
  constructor(@Inject(ProductImagesService) private readonly service: ProductImagesService) {}
  @Post(':id/image')
  @UseInterceptors(FileInterceptor('image', { limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES, files: 1, fields: 0, parts: 2 } }))
  upload(@Param('id', ParseIntPipe) id: number, @UploadedFile() file?: ProductImageUpload) { return this.service.replace(id, file); }
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
@Module({ controllers: [ProductImagesController, ProductImageFilesController], providers: [ProductImagesService] })
export class ProductImagesModule {}
