import { shopContent } from "@/lib/shop-content";
import { siteUrl } from "@/lib/site-url";
import type { StoreInfo } from "@/lib/store-info";

/** Renders schema.org data for search engines. `<` is escaped so the JSON cannot close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

/** The shop as a local business: name, address, phone, opening hours, founding year. */
export function storeJsonLd(store: StoreInfo | null) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${siteUrl}/shop#store`,
    name: "دار سلومة · Dar Slouma",
    alternateName: "Dar Slouma",
    description: "Herboristerie à Ghannouch (Gabès) depuis 2006 : plantes, mélanges et épices, recettes traditionnelles et conseils.",
    url: `${siteUrl}/shop`,
    logo: `${siteUrl}/icon.svg`,
    image: `${siteUrl}/images/shop/hero/hero-main.png`,
    foundingDate: String(shopContent.foundedYear),
    ...(store?.phone ? { telephone: `+216${store.phone.replace(/\D/g, "").slice(-8)}` } : {}),
    ...(store?.email ? { email: store.email } : {}),
    address: { "@type": "PostalAddress", ...(store?.address ? { streetAddress: store.address } : {}), addressLocality: store?.city || "Ghannouch", addressRegion: "Gabès", addressCountry: "TN" },
    openingHoursSpecification: shopContent.openingSlots.map(([opens, closes]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens, closes,
    })),
    paymentAccepted: "Cash",
    currenciesAccepted: "TND",
  };
}

export function breadcrumbJsonLd(items: [string, string][]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, path], index) => ({ "@type": "ListItem", position: index + 1, name, item: `${siteUrl}${path}` })),
  };
}
