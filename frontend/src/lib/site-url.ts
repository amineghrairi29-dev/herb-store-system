/** Public address of the shop (no trailing slash), used for canonical links, sitemap and social cards.
 *  Set NEXT_PUBLIC_SITE_URL in production, e.g. https://darslouma.tn */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
