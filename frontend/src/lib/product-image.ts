import { apiBase } from './api-base';
export const MAX_PRODUCT_IMAGE_BYTES = 3 * 1024 * 1024;
export function productImageUrl(path: string | null | undefined): string | null {
  return path && /^\/uploads\/products\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$/.test(path) ? `${apiBase}${path}` : null;
}
export function imageFileError(file: File): string | null {
  if (!file.size) return 'Le fichier sélectionné est vide.';
  if (file.size > MAX_PRODUCT_IMAGE_BYTES) return 'L’image ne doit pas dépasser 3 Mo.';
  const extension = file.name.split('.').pop()?.toLowerCase();
  const mime: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  if (!extension || !mime[extension] || file.type !== mime[extension]) return 'Sélectionnez une image JPG, PNG ou WebP.';
  return null;
}
