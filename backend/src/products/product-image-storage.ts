import { BadRequestException, Logger, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../prisma/db.js';

export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_FILENAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/;
export const IMAGE_PREFIX = '/uploads/products/';
export interface ProductImageUpload { originalname: string; mimetype: string; size: number; buffer: Buffer }
export function imageDirectory() {
  return process.env.PRODUCT_IMAGE_DIR ? resolve(process.env.PRODUCT_IMAGE_DIR) : fileURLToPath(new URL('../../uploads/products/', import.meta.url));
}
export async function normalizeProductImage(file?: ProductImageUpload): Promise<Buffer> {
  if (!file?.buffer?.length) throw new BadRequestException('Sélectionnez une image JPG, PNG ou WebP.');
  if (file.size > MAX_PRODUCT_IMAGE_BYTES || file.buffer.length > MAX_PRODUCT_IMAGE_BYTES) throw new PayloadTooLargeException('L’image ne doit pas dépasser 3 Mo.');
  const extension = extname(file.originalname).toLowerCase();
  const formats: Record<string, { mime: string; format: string }> = {
    '.jpg': { mime: 'image/jpeg', format: 'jpeg' }, '.jpeg': { mime: 'image/jpeg', format: 'jpeg' },
    '.png': { mime: 'image/png', format: 'png' }, '.webp': { mime: 'image/webp', format: 'webp' },
  };
  const expected = formats[extension];
  if (!expected || file.mimetype !== expected.mime) throw new BadRequestException('Format non autorisé. Utilisez une image JPG, PNG ou WebP.');
  try {
    const pipeline = sharp(file.buffer, { limitInputPixels: 25_000_000, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (metadata.format !== expected.format || (metadata.pages ?? 1) !== 1) throw new Error('Invalid image format');
    // Decode/re-encode: no original filename, EXIF, SVG, appended payload, or
    // animation is copied into the served file. EXIF orientation is applied.
    const image = await pipeline.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    if (image.length > MAX_PRODUCT_IMAGE_BYTES) throw new Error('Output too large');
    return image;
  } catch {
    throw new BadRequestException('Image invalide, endommagée ou trop grande. Utilisez une image fixe JPG, PNG ou WebP de 25 mégapixels maximum.');
  }
}
export async function storeProductImage(buffer: Buffer): Promise<string> {
  const directory = imageDirectory();
  await mkdir(directory, { recursive: true });
  const filename = `${randomUUID()}.webp`;
  await writeFile(join(directory, filename), buffer, { flag: 'wx', mode: 0o600 });
  return IMAGE_PREFIX + filename;
}
export async function discardUnreferencedImage(path: string | null | undefined): Promise<void> {
  if (!path?.startsWith(IMAGE_PREFIX)) return;
  const filename = path.slice(IMAGE_PREFIX.length);
  if (!IMAGE_FILENAME.test(filename)) return;
  try {
    // Also handles ambiguous commit failures: never remove a referenced image.
    if (await db.orm.public.Product.first({ mainImagePath: path })) return;
    if (await db.orm.public.ProductImage.first({ path })) return;
    const target = join(imageDirectory(), filename);
    const stat = await lstat(target);
    if (stat.isFile() && !stat.isSymbolicLink()) await unlink(target);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return;
    Logger.warn('An unreferenced product image could not be cleaned up.', 'ProductImages');
  }
}
export async function readProductImage(filename: string): Promise<Buffer> {
  if (!IMAGE_FILENAME.test(filename)) throw new NotFoundException('Image introuvable.');
  try {
    const target = join(imageDirectory(), filename);
    const stat = await lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_PRODUCT_IMAGE_BYTES) throw new Error('Invalid file');
    return await readFile(target);
  } catch { throw new NotFoundException('Image introuvable.'); }
}
