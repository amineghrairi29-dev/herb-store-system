import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Back-office routes and private shop steps stay out of search engines.
const privatePaths = [
  "/dashboard", "/products", "/stock", "/online-orders", "/sales", "/purchases", "/suppliers", "/cash", "/expenses",
  "/finance", "/reports", "/users", "/settings", "/audit", "/account", "/categories", "/classifications", "/login", "/auth",
  "/shop/cart", "/shop/checkout", "/shop/order-success", "/shop/profile", "/shop/auth",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/shop"], disallow: privatePaths }],
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
