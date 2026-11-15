/**
 * Readable product addresses: /shop/products/12-menthe-sechee. The number keeps the link
 * working when a product is renamed (the page redirects to the current name); the words
 * help customers and search engines. Arabic names keep their Arabic letters.
 */
export function productSlug(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")       // é -> e
    .replace(/[ً-ٰٟـ]/g, "")            // Arabic diacritics and tatweel
    .toLowerCase()
    .replace(/œ/g, "oe").replace(/æ/g, "ae")
    .replace(/[^a-z0-9ء-ي]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Path segment for a product: "12-menthe-sechee", or "12" when the name gives no letters. */
export function productSegment(product: { id: number; name: string; nameFr?: string | null }): string {
  const slug = productSlug(product.nameFr?.trim() || product.name);
  return slug ? `${product.id}-${slug}` : String(product.id);
}

export function productPath(product: { id: number; name: string; nameFr?: string | null }): string {
  return `/shop/products/${encodeURIComponent(productSegment(product))}`;
}

/** Product id at the start of a segment ("12-menthe" -> "12"), or null. */
export function productIdFromSegment(segment: string): string | null {
  const match = /^([1-9]\d{0,9})(?:-|$)/.exec(segment);
  return match ? match[1] : null;
}
