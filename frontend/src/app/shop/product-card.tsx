import Link from "next/link";
import ProductImage from "@/components/product-image";
import type { PublicProduct } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import AddToCart from "./add-to-cart";
import { productImageUrl } from "@/lib/product-image";
import { ProductImagePlaceholder } from "./storefront/visuals";
import "./product-card.css";

const units: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };
const arabic = /[؀-ۿ]/;

/**
 * Product card, "étiquette" style: white card, the photo filling its frame, the name
 * (in the Arabic font when it is written in Arabic), a dotted line like a label, then
 * the price and a small "Panier" pill.
 */
export default function ProductCard({ product }: { product: PublicProduct }) {
  const unavailable = product.availabilityStatus === "OUT_OF_STOCK";
  const low = product.availabilityStatus === "LOW_STOCK";
  const availability = unavailable ? "Épuisé" : low ? "Stock limité" : "Disponible";
  const category = product.classifications[0]?.nameFr ?? product.category.nameFr;
  const isArabic = arabic.test(product.name);
  const subtitle = isArabic && product.nameFr && product.nameFr !== product.name ? product.nameFr : null;
  const href = `/shop/products/${product.id}`;
  return (
    <article className="botanical-product-card" data-product-id={product.id} data-availability={product.availabilityStatus}>
      <Link className="bpc-image-link" href={href} tabIndex={-1} aria-hidden="true">
        <ProductImage
          imagePath={product.mainImagePath}
          name=""
          className="bpc-image"
          sizes="(max-width: 520px) 46vw, (max-width: 899px) 30vw, 280px"
          fallback={<div className="bpc-image bpc-placeholder"><ProductImagePlaceholder /></div>}
        />
      </Link>
      <div className="bpc-body">
        <p className="bpc-meta"><bdi>{category}</bdi><span aria-hidden="true">·</span><span className="bpc-availability">{availability}</span></p>
        <Link className="bpc-name-link" href={href} title={product.name}>
          <h3 className={`bpc-name${isArabic ? " bpc-name-ar" : ""}`} {...(isArabic ? { lang: "ar", dir: "rtl" } : {})}>{product.name}</h3>
        </Link>
        {subtitle && <p className="bpc-subtitle"><bdi>{subtitle}</bdi></p>}
      </div>
      <div className="bpc-foot">
        <p className="bpc-price">{displayAmount(product.salePrice)} <span>TND/{units[product.saleUnit] ?? product.saleUnit}</span></p>
        <AddToCart productId={product.id} outOfStock={unavailable} imageUrl={productImageUrl(product.mainImagePath)} compact />
      </div>
    </article>
  );
}
