import { apiBase } from "@/lib/api-base";
import Link from "next/link";
import BackLink from "../../back-link";
import { notFound } from "next/navigation";
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
  const facts = ([["Origine", product.origin], ["Conditionnement", product.packaging], ["Nom scientifique", product.scientificName]] as const).filter(([, value]) => !!value);
  const imageUrl = productImageUrl(product.mainImagePath);
  return <div className="pp">
    <nav className="pp-breadcrumb" aria-label="Fil d’Ariane"><Link href="/shop">Boutique</Link><span aria-hidden="true">›</span><Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}><bdi>{product.category.nameFr}</bdi></Link><span aria-hidden="true">›</span><span aria-current="page"><bdi>{product.name}</bdi></span></nav>
    <article className="pp-overview" aria-labelledby="product-title">
      <div className="pp-enter" style={{ "--i": 0 } as React.CSSProperties}><ProductGalleryView images={images} name={product.name} /></div>
      <div className="pp-summary">
        <div className="pp-chips pp-enter" style={{ "--i": 1 } as React.CSSProperties}>
          {product.classifications.map((c) => <Link key={c.id} href={`/shop/besoins/${encodeURIComponent(c.slug)}`} className="pp-chip"><bdi>{c.nameFr}</bdi></Link>)}
          <span className={`pp-stock${unavailable ? " pp-stock-out" : product.availabilityStatus === "LOW_STOCK" ? " pp-stock-low" : ""}`}><span aria-hidden="true" />{unavailable ? "Indisponible" : product.availabilityStatus === "LOW_STOCK" ? "Stock limité" : "Disponible"}</span>
        </div>
        <h1 id="product-title" className="pp-title pp-enter" style={{ "--i": 2 } as React.CSSProperties}><bdi>{product.name}</bdi></h1>
        {product.nameFr && product.nameFr !== product.name && <p className="pp-subtitle pp-enter" style={{ "--i": 3 } as React.CSSProperties}><bdi>{product.nameFr}</bdi></p>}
        <p className="pp-price pp-enter" style={{ "--i": 4 } as React.CSSProperties}>{displayAmount(product.salePrice)} <span>TND</span> <small>/ {unit}</small></p>
        {product.description && <p className="pp-lead pp-enter" style={{ "--i": 5 } as React.CSSProperties} dir="auto">{product.description}</p>}
        <div className="pp-enter" style={{ "--i": 6 } as React.CSSProperties}>
          <ProductPurchase productId={product.id} unavailable={unavailable} unit={unit} saleUnit={product.saleUnit} price={product.salePrice} name={product.name} imageUrl={imageUrl} />
          {whatsapp && <a className="pp-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" /></svg>Commander ou demander conseil sur WhatsApp</a>}
        </div>
        <ul className="pp-promises pp-enter" style={{ "--i": 7 } as React.CSSProperties} aria-label="Nos engagements">
          <li><span aria-hidden="true">◎</span>Paiement à la réception</li>
          <li><span aria-hidden="true">⇢</span>Livraison à domicile</li>
          <li><span aria-hidden="true">✦</span>Conseil gratuit</li>
        </ul>
        {facts.length > 0 && <dl className="pp-facts pp-enter" style={{ "--i": 8 } as React.CSSProperties}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd><bdi>{value}</bdi></dd></div>)}</dl>}
      </div>
    </article>
    {details.length > 0 && <ScrollReveal className="pp-reveal pp-details">{details.map(([title, text], index) => <article key={title} style={{ "--i": index } as React.CSSProperties} className={`pp-detail${title === "Précautions" ? " pp-detail-warning" : ""}`}><span className="pp-detail-icon" aria-hidden="true">{title === "Bienfaits" ? "❀" : title === "Précautions" ? "!" : "☕"}</span><h2>{title}</h2><p dir="auto">{text}</p>{title === "Précautions" && <p className="pp-detail-note">Ces informations ne remplacent pas l’avis d’un médecin ou d’un pharmacien.</p>}</article>)}</ScrollReveal>}
    <section className="pp-advice" aria-labelledby="advice-title">
      <div><p lang="ar" dir="rtl" className="pp-advice-ar">ما عرفتش شنوّة تختار؟</p><h2 id="advice-title">Vous hésitez entre deux plantes ?</h2><p>Dites-nous ce que vous cherchez : nous vous conseillons la préparation adaptée, gratuitement.</p></div>
      {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="pp-advice-btn">Poser ma question</a> : <Link href="/shop/contact" className="pp-advice-btn">Nous contacter</Link>}
    </section>
    {related.length > 0 && <section className="pp-related" aria-labelledby="related-title"><div className="pp-related-heading"><h2 id="related-title">Pour les mêmes besoins</h2><Link href={`/shop/besoins/${encodeURIComponent(product.category.slug)}`}>Tout voir <span aria-hidden="true">→</span></Link></div><ScrollReveal className="pp-reveal pp-related-grid">{related.map((item, index) => <div key={item.id} style={{ "--i": index } as React.CSSProperties}><ProductCard product={item} /></div>)}</ScrollReveal></section>}
    <BackLink href="/shop#products" className="mt-7">Retour à la boutique</BackLink>
  </div>;
}
