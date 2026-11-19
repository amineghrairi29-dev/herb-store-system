import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getStoreInfo } from "@/lib/store-info";
import { JsonLd, storeJsonLd } from "@/lib/structured-data";
import HomeHero from "./home/home-hero";
import HomeNeeds from "./home/home-needs";
import HomeStory from "./home/home-story";
import HomeYears from "./home/home-years";
import HomeProducts from "./home/home-products";
import "./home/home.css";

// Searches (/shop?q=…) point to the plain shop page as the canonical address.
export const metadata: Metadata = { alternates: { canonical: "/shop" } };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  // A need filter belongs to its own page; other old catalogue filters fall back to the product list.
  const classification = typeof params.classification === "string" ? params.classification : null;
  if (classification) redirect(`/shop/besoins/${encodeURIComponent(classification)}`);
  if (["category", "subcategory", "availability", "sort", "page", "pageSize"].some((key) => params[key] !== undefined))
    redirect("/shop#products");
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 200) : "";
  const store = await getStoreInfo();
  return (
    <div className="h-home">
      <JsonLd data={storeJsonLd(store)} />
      <HomeHero />
      <HomeNeeds />
      <HomeProducts key={query} query={query} />
      <HomeStory />
      <HomeYears />
    </div>
  );
}
