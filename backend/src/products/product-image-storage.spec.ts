import sharp from 'sharp';
import { IMAGE_FILENAME, MAX_PRODUCT_IMAGE_BYTES, normalizeProductImage } from './product-image-storage.js';
describe('Product image validation', () => {
  const pixels = { create: { width: 20, height: 10, channels: 3 as const, background: '#246b45' } };
  it.each(['jpeg', 'png', 'webp'] as const)('decodes %s and produces static WebP without metadata', async format => {
    const buffer = await sharp(pixels).toFormat(format).toBuffer();
    const output = await normalizeProductImage({ buffer, size: buffer.length, originalname: `test.${format}`, mimetype: `image/${format}` });
    const meta = await sharp(output).metadata(); expect(meta.format).toBe('webp'); expect(meta.exif).toBeUndefined(); expect(meta.width).toBe(20);
  });
  it('rejects missing/oversized input and extension/MIME/content mismatches', async () => {
    const buffer = await sharp(pixels).png().toBuffer();
    const valid = { buffer, size: buffer.length, originalname: 'photo.png', mimetype: 'image/png' };
    await expect(normalizeProductImage()).rejects.toThrow();
    for (const change of [{ size: MAX_PRODUCT_IMAGE_BYTES + 1 }, { originalname: 'photo.svg' }, { mimetype: 'application/pdf' }, { originalname: 'photo.jpg', mimetype: 'image/jpeg' }, { buffer: Buffer.from('not an image') }]) await expect(normalizeProductImage({ ...valid, ...change })).rejects.toThrow();
  });
  it('recognizes only generated filenames', () => {
    expect(IMAGE_FILENAME.test(`${crypto.randomUUID()}.webp`)).toBe(true);
    for (const name of ['../.env', 'image.svg', 'photo.png', `${crypto.randomUUID()}.webp/../secret`]) expect(IMAGE_FILENAME.test(name)).toBe(false);
  });
});
