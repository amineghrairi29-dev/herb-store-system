import type { MetadataRoute } from "next";
import { apiBase } from "@/lib/api-base";
import { siteUrl } from "@/lib/site-url";
import { productPath } from "@/lib/product-url";
import type { CatalogueResponse, PublicClassification, PublicProduct } from "@/types/public-product";

export const revalidate = 3600;

/** All products, page by page (the API serves at most 60 per page). Empty if the API is down. */
async function allProducts(): Promise<PublicProduct[]> {
  const products: PublicProduct[] = [];
  for (let page = 1; page <= 50; page++) {
    try {
      const response = await fetch(`${apiBase}/public/products?pageSize=60&page=${page}&sort=name_asc`, {
        next: { revalidate },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) break;
      const result = (await response.json()) as CatalogueResponse;
      products.push(...result.data);
      if (page >= result.pagination.totalPages) break;
    } catch {
      break;
    }
  }
  return products;
}

async function needs(): Promise<PublicClassification[]> {
  try {
    const response = await fetch(`${apiBase}/public/classifications?withProducts=true`, {
      next: { revalidate },
      signal: AbortSignal.timeout(8000),
    });
    return response.ok ? ((await response.json()) as PublicClassification[]) : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, classifications] = await Promise.all([allProducts(), needs()]);
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/shop", 1, "daily"],
    ["/shop/about", 0.6, "monthly"],
    ["/shop/contact", 0.6, "monthly"],
    ["/shop/faq", 0.5, "monthly"],
    ["/shop/livraison", 0.5, "monthly"],
    ["/shop/suivi", 0.3, "yearly"],
    ["/shop/cgv", 0.2, "yearly"],
    ["/shop/confidentialite", 0.2, "yearly"],
  ];
  return [
    ...pages.map(([path, priority, changeFrequency]) => ({ url: `${siteUrl}${path}`, priority, changeFrequency })),
    ...classifications.map((need) => ({
      url: `${siteUrl}/shop/besoins/${encodeURIComponent(need.slug)}`,
      priority: 0.8,
      changeFrequency: "weekly" as const,
    })),
    ...products.map((product) => ({
      url: `${siteUrl}${productPath(product)}`,
      priority: 0.7,
      changeFrequency: "weekly" as const,
    })),
  ];
}
