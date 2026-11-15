import { apiBase } from "@/lib/api-base";
import Link from "next/link";
import BackLink from "../../back-link";
import { notFound } from "next/navigation";
import type { PublicProduct, CatalogueResponse } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import ProductCard from "../../product-card";
import "./product-details.css";
import ProductPurchase from "./product-purchase";
import ProductGalleryView from "./product-gallery-view";
import type { Metadata } from "next";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import { productImageUrl } from "@/lib/product-image";

async function loadProduct(id: string): Promise<PublicProduct | null> {
  if (!/^[1-9]\d*$/.test(id)) return null;
  const response = await fetch(`${apiBase}/public/products/${encodeURIComponent(id)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public product HTTP ${response.status}`);
  return response.json() as Promise<PublicProduct>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const product = await loadProduct((await params).id).catch(() => null);
  if (!product) return { title: "Produit introuvable" };
  const description = (product.description ?? product.benefits ?? `${product.name} — ${product.classifications.map((c) => c.nameFr).join(", ")}`).slice(0, 160);
  const image = productImageUrl(product.mainImagePath);
  return { title: product.name, description, openGraph: { title: product.name, description, ...(image ? { images: [image] } : {}) } };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, store] = await Promise.all([loadProduct(id), getStoreInfo()]);
  if (!product) notFound();
  const whatsapp = whatsappLink(store?.phone, `Bonjour, je souhaite commander : ${product.name}`);
  const images = [product.mainImagePath, ...(product.gallery ?? [])].filter((path): path is string => !!path);
  const details = ([["Bienfaits", product.benefits], ["Mode d’utilisation", product.usage], ["Précautions", product.precautions]] as const).filter(([, text]) => !!text);
  const units: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };
  const unit = units[product.saleUnit] ?? product.saleUnit;
  const unavailable = product.availabilityStatus === "OUT_OF_STOCK";
  let related: PublicProduct[] = [];
  try {
    const query = new URLSearchParams({ classification: product.category.slug, pageSize: "5", sort: "name_asc" });
    const result = await fetch(`${apiBase}/public/products?${query}`, { cache: "no-store", signal: AbortSignal.timeout(3000) });
    if (result.ok) { const list: CatalogueResponse = await result.json(); related = list.data.filter(item => item.id !== product.id).slice(0, 4); }
  } catch { /* Optional suggestions must not block an otherwise available product. */ }
  return <div className="product-details">
    <nav className="pd-breadcrumb" aria-label="Fil d’Ariane"><Link href="/shop">Boutique</Link><span aria-hidden="true">/</span><Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}><bdi>{product.category.nameFr}</bdi></Link><span aria-hidden="true">/</span><span aria-current="page"><bdi>{product.name}</bdi></span></nav>
    <article className="pd-overview" aria-labelledby="product-title">
      <ProductGalleryView images={images} name={product.name} />
      <div className="pd-summary">
        <p className="pd-category"><bdi>{product.classifications.map(c => c.nameFr).join(" · ")}</bdi></p>
        <h1 id="product-title"><bdi>{product.name}</bdi></h1>
        {product.nameFr && product.nameFr !== product.name && <p className="pd-secondary-name"><bdi>{product.nameFr}</bdi></p>}
        {product.scientificName && <p className="pd-scientific"><bdi>{product.scientificName}</bdi></p>}
        <p className="pd-price">{displayAmount(product.salePrice)} <span>TND</span> <small>/ {unit}</small></p>
        <p className={`pd-availability${unavailable ? " pd-unavailable" : ""}`}><span aria-hidden="true" />{unavailable ? "Indisponible" : product.availabilityStatus === "LOW_STOCK" ? "Stock limité" : "Disponible"}</p>
        <ProductPurchase productId={product.id} unavailable={unavailable} unit={unit} saleUnit={product.saleUnit} price={product.salePrice} />
        {whatsapp && <a className="pd-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer">Commander sur WhatsApp</a>}
        {(product.origin || product.packaging) && <dl className="pd-facts">{[["Origine", product.origin], ["Conditionnement", product.packaging]].map(([label, value]) => value && <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>}
      </div>
    </article>
    {product.description && <section className="pd-description" aria-labelledby="description-title"><h2 id="description-title">À propos de ce produit</h2><p dir="auto">{product.description}</p></section>}
    {details.length > 0 && <section className="pd-details-grid" aria-label="Informations d’utilisation">{details.map(([title, text]) => <article key={title} className={`pd-detail${title === "Précautions" ? " pd-detail-warning" : ""}`}><h2>{title}</h2><p dir="auto">{text}</p>{title === "Précautions" && <p className="pd-detail-note">Ces informations ne remplacent pas l’avis d’un médecin ou d’un pharmacien.</p>}</article>)}</section>}
    {related.length > 0 && <section className="pd-related" aria-labelledby="related-title"><div className="pd-related-heading"><h2 id="related-title">Pour les mêmes besoins</h2><Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}>Voir les produits ↗</Link></div><div className="botanical-product-grid pd-related-grid">{related.map(item => <ProductCard key={item.id} product={item} />)}</div></section>}
    <BackLink href="/shop#products" className="mt-7">Retour à la boutique</BackLink>
  </div>;
}
