import { apiBase } from "@/lib/api-base";
import Link from "next/link";
import BackLink from "../../back-link";
import { notFound, permanentRedirect } from "next/navigation";
import type { PublicProduct, CatalogueResponse } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import ProductCard from "../../product-card";
import "./product-page.css";
import ProductPurchase from "./product-purchase";
import ProductGalleryView from "./product-gallery-view";
import type { Metadata } from "next";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import { productImageUrl } from "@/lib/product-image";
import ScrollReveal from "../../storefront/scroll-reveal";
import { JsonLd, breadcrumbJsonLd } from "@/lib/structured-data";
import { siteUrl } from "@/lib/site-url";
import { productIdFromSegment, productPath, productSegment } from "@/lib/product-url";
import { formatLabel, ingredientList, priceUnit } from "@/lib/recipe";
import { Leaf } from "../../storefront/leaf";

/** The segment is "12-menthe-sechee" (or an old "12" link): only the number is read. */
async function loadProduct(segment: string): Promise<PublicProduct | null> {
  const id = productIdFromSegment(decodeSegment(segment));
  if (!id) return null;
  // Cached one minute: the cart and the checkout check price and stock again anyway.
  const response = await fetch(`${apiBase}/public/products/${id}`, { next: { revalidate: 60 } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public product HTTP ${response.status}`);
  return response.json() as Promise<PublicProduct>;
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const product = await loadProduct((await params).id).catch(() => null);
  if (!product) return { title: "Recette introuvable" };
  const description = (
    product.description ??
    product.benefits ??
    `${product.name} — ${product.classifications.map((c) => c.nameFr).join(", ")}`
  ).slice(0, 160);
  const image = productImageUrl(product.mainImagePath);
  return {
    title: product.name,
    description,
    alternates: { canonical: productPath(product) },
    openGraph: { title: product.name, description, type: "website", ...(image ? { images: [image] } : {}) },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, store] = await Promise.all([loadProduct(id), getStoreInfo()]);
  if (!product) notFound();
  // Old links (/shop/products/12) and renamed products go to the current address.
  if (decodeSegment(id) !== productSegment(product)) permanentRedirect(productPath(product));
  const whatsapp = whatsappLink(store?.phone, `Bonjour, je souhaite commander la recette : ${product.name}`);
  const images = [product.mainImagePath, ...(product.gallery ?? [])].filter((path): path is string => !!path);
  const details = (
    [
      ["Bienfaits", product.benefits],
      ["Mode d’utilisation", product.usage],
      ["Précautions", product.precautions],
    ] as const
  ).filter(([, text]) => !!text);
  const unit = priceUnit(product);
  const ingredients = ingredientList(product.ingredients);
  const unavailable = product.availabilityStatus === "OUT_OF_STOCK";
  let related: PublicProduct[] = [];
  try {
    const query = new URLSearchParams({ classification: product.category.slug, pageSize: "5", sort: "name_asc" });
    const result = await fetch(`${apiBase}/public/products?${query}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(3000),
    });
    if (result.ok) {
      const list: CatalogueResponse = await result.json();
      related = list.data.filter((item) => item.id !== product.id).slice(0, 4);
    }
  } catch {
    /* Optional suggestions must not block an otherwise available product. */
  }
  const facts = (
    [
      ["Format", formatLabel(product)],
      ["Préparation", "Faite à la main, à Ghannouch"],
      ["Origine", product.origin],
    ] as const
  ).filter(([, value]) => !!value);
  const imageUrl = productImageUrl(product.mainImagePath);
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.nameFr && product.nameFr !== product.name ? { alternateName: product.nameFr } : {}),
    ...(product.description ? { description: product.description } : {}),
    sku: product.sku,
    category: product.category.nameFr,
    image: [imageUrl, ...(product.gallery ?? []).map(productImageUrl)].filter(Boolean),
    brand: { "@type": "Brand", name: "Dar Slouma" },
    offers: {
      "@type": "Offer",
      url: `${siteUrl}${productPath(product)}`,
      priceCurrency: "TND",
      price: product.salePrice,
      unitText: unit,
      availability: unavailable
        ? "https://schema.org/OutOfStock"
        : product.availabilityStatus === "LOW_STOCK"
          ? "https://schema.org/LimitedAvailability"
          : "https://schema.org/InStock",
      seller: { "@id": `${siteUrl}/shop#store` },
    },
  };
  return (
    <div className="pp">
      <JsonLd data={productLd} />
      <JsonLd
        data={breadcrumbJsonLd([
          ["Boutique", "/shop"],
          [product.category.nameFr, `/shop/besoins/${encodeURIComponent(product.category.slug)}`],
          [product.name, productPath(product)],
        ])}
      />
      <nav className="pp-breadcrumb" aria-label="Fil d’Ariane">
        <Link href="/shop">Boutique</Link>
        <span aria-hidden="true">›</span>
        <Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}>
          <bdi>{product.category.nameFr}</bdi>
        </Link>
        <span aria-hidden="true">›</span>
        <span aria-current="page">
          <bdi>{product.name}</bdi>
        </span>
      </nav>
      <article className="pp-overview" aria-labelledby="product-title">
        <div className="pp-enter" style={{ "--i": 0 } as React.CSSProperties}>
          <ProductGalleryView images={images} name={product.name} />
        </div>
        <div className="pp-summary">
          <div className="pp-chips pp-enter" style={{ "--i": 1 } as React.CSSProperties}>
            {product.classifications.map((c) => (
              <Link key={c.id} href={`/shop/besoins/${encodeURIComponent(c.slug)}`} className="pp-chip pp-goal">
                <span className="pp-goal-label">Pour</span>
                <bdi>{c.nameFr}</bdi>
                <span lang="ar" dir="rtl">
                  {c.nameAr}
                </span>
              </Link>
            ))}
            <span className="pp-chip pp-handmade">Fait main</span>
            <span
              className={`pp-stock${unavailable ? " pp-stock-out" : product.availabilityStatus === "LOW_STOCK" ? " pp-stock-low" : ""}`}
            >
              <span aria-hidden="true" />
              {unavailable
                ? "Indisponible"
                : product.availabilityStatus === "LOW_STOCK"
                  ? "Stock limité"
                  : "Disponible"}
            </span>
          </div>
          <h1 id="product-title" className="pp-title pp-enter" style={{ "--i": 2 } as React.CSSProperties}>
            <bdi>{product.name}</bdi>
          </h1>
          {product.nameFr && product.nameFr !== product.name && (
            <p className="pp-subtitle pp-enter" style={{ "--i": 3 } as React.CSSProperties}>
              <bdi>{product.nameFr}</bdi>
            </p>
          )}
          <p className="pp-price pp-enter" style={{ "--i": 4 } as React.CSSProperties}>
            {displayAmount(product.salePrice)} <span>TND</span> <small>/ {unit}</small>
          </p>
          {product.description && (
            <p className="pp-lead pp-enter" style={{ "--i": 5 } as React.CSSProperties} dir="auto">
              {product.description}
            </p>
          )}
          <div className="pp-enter" style={{ "--i": 6 } as React.CSSProperties}>
            <ProductPurchase
              productId={product.id}
              unavailable={unavailable}
              unit={unit}
              saleUnit={product.saleUnit}
              price={product.salePrice}
              name={product.name}
              imageUrl={imageUrl}
            />
            {whatsapp && (
              <a className="pp-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"
                  />
                </svg>
                Commander ou demander conseil sur WhatsApp
              </a>
            )}
          </div>
          <ul className="pp-promises pp-enter" style={{ "--i": 7 } as React.CSSProperties} aria-label="Nos engagements">
            <li>
              <span aria-hidden="true">◎</span>Paiement à la réception
            </li>
            <li>
              <span aria-hidden="true">⇢</span>Livraison à domicile
            </li>
            <li>
              <span aria-hidden="true">✦</span>Conseil gratuit
            </li>
          </ul>
          {facts.length > 0 && (
            <dl className="pp-facts pp-enter" style={{ "--i": 8 } as React.CSSProperties}>
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    <bdi>{value}</bdi>
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </article>
      {ingredients.length > 0 && (
        <ScrollReveal className="pp-reveal">
          <section className="pp-ingredients" aria-labelledby="ingredients-title">
            <div>
              <p lang="ar" dir="rtl" className="pp-ingredients-ar">
                شنوّة فيها؟
              </p>
              <h2 id="ingredients-title">Ce qu’elle contient</h2>
              <p>Les plantes principales de la recette. Les dosages restent le savoir-faire de la maison.</p>
            </div>
            <ul>
              {ingredients.map((item, index) => (
                <li key={`${item}-${index}`} style={{ "--i": index } as React.CSSProperties}>
                  <span className="pp-ingredient-leaf" aria-hidden="true">
                    <Leaf color={index % 3 === 1 ? "#D99A2B" : index % 3 === 2 ? "#A9C68F" : "#3E7B3A"} />
                  </span>
                  <bdi dir="auto">{item}</bdi>
                </li>
              ))}
            </ul>
          </section>
        </ScrollReveal>
      )}
      {details.length > 0 && (
        <ScrollReveal className="pp-reveal pp-details">
          {details.map(([title, text], index) => (
            <article
              key={title}
              style={{ "--i": index } as React.CSSProperties}
              className={`pp-detail${title === "Précautions" ? " pp-detail-warning" : ""}`}
            >
              <span className="pp-detail-icon" aria-hidden="true">
                {title === "Bienfaits" ? "❀" : title === "Précautions" ? "!" : "☕"}
              </span>
              <h2>{title}</h2>
              <p dir="auto">{text}</p>
              {title === "Précautions" && (
                <p className="pp-detail-note">
                  Ces informations ne remplacent pas l’avis d’un médecin ou d’un pharmacien.
                </p>
              )}
            </article>
          ))}
        </ScrollReveal>
      )}
      <section className="pp-advice" aria-labelledby="advice-title">
        <div>
          <p lang="ar" dir="rtl" className="pp-advice-ar">
            ما عرفتش شنوّة تختار؟
          </p>
          <h2 id="advice-title">Vous hésitez entre deux recettes ?</h2>
          <p>Dites-nous ce que vous cherchez : Slouma vous indique la recette adaptée, gratuitement.</p>
        </div>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="pp-advice-btn">
            Poser ma question
          </a>
        ) : (
          <Link href="/shop/contact" className="pp-advice-btn">
            Nous contacter
          </Link>
        )}
      </section>
      {related.length > 0 && (
        <section className="pp-related" aria-labelledby="related-title">
          <div className="pp-related-heading">
            <h2 id="related-title">Pour le même objectif</h2>
            <Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}>
              Tout voir <span aria-hidden="true">→</span>
            </Link>
          </div>
          <ScrollReveal className="pp-reveal pp-related-grid">
            {related.map((item, index) => (
              <div key={item.id} style={{ "--i": index } as React.CSSProperties}>
                <ProductCard product={item} />
              </div>
            ))}
          </ScrollReveal>
        </section>
      )}
      <BackLink href="/shop#products" className="mt-7">
        Toutes les recettes
      </BackLink>
    </div>
  );
}
