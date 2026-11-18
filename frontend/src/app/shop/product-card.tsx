import Link from "next/link";
import ProductImage from "@/components/product-image";
import type { PublicProduct } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import AddToCart from "./add-to-cart";
import { productImageUrl } from "@/lib/product-image";
import { productPath } from "@/lib/product-url";
import { formatLabel, priceUnit } from "@/lib/recipe";
import { ProductImagePlaceholder } from "./storefront/visuals";
import "./product-card.css";

const arabic = /[؀-ۿ]/;

/**
 * Recipe card, "étiquette" style: the photo with a "Fait main" ribbon, the objective,
 * the name (Arabic font when written in Arabic), the format, a dotted line like a label,
 * then the price and a small "Panier" pill.
 */
export default function ProductCard({ product }: { product: PublicProduct }) {
  const unavailable = product.availabilityStatus === "OUT_OF_STOCK";
  const low = product.availabilityStatus === "LOW_STOCK";
  const availability = unavailable ? "Épuisé" : low ? "Stock limité" : "Disponible";
  const goal = product.classifications[0]?.nameFr ?? product.category.nameFr;
  const format = formatLabel(product);
  const isArabic = arabic.test(product.name);
  const subtitle = isArabic && product.nameFr && product.nameFr !== product.name ? product.nameFr : null;
  const href = productPath(product);
  return (
    <article
      className="botanical-product-card"
      data-product-id={product.id}
      data-availability={product.availabilityStatus}
    >
      <Link className="bpc-image-link" href={href} tabIndex={-1} aria-hidden="true">
        <ProductImage
          imagePath={product.mainImagePath}
          name=""
          className="bpc-image"
          sizes="(max-width: 520px) 46vw, (max-width: 899px) 30vw, 280px"
          fallback={
            <div className="bpc-image bpc-placeholder">
              <ProductImagePlaceholder />
            </div>
          }
        />
        <span className="bpc-handmade">Fait main</span>
      </Link>
      <div className="bpc-body">
        <p className="bpc-meta">
          <span className="bpc-goal">
            Pour <bdi>{goal}</bdi>
          </span>
          <span aria-hidden="true">·</span>
          <span className="bpc-availability">{availability}</span>
        </p>
        <Link className="bpc-name-link" href={href} title={product.name}>
          <h3 className={`bpc-name${isArabic ? " bpc-name-ar" : ""}`} {...(isArabic ? { lang: "ar", dir: "rtl" } : {})}>
            {product.name}
          </h3>
        </Link>
        {subtitle && (
          <p className="bpc-subtitle">
            <bdi>{subtitle}</bdi>
          </p>
        )}
        {format && <p className="bpc-format">{format}</p>}
      </div>
      <div className="bpc-foot">
        <p className="bpc-price">
          {displayAmount(product.salePrice)} <span>TND/{priceUnit(product)}</span>
        </p>
        <AddToCart
          productId={product.id}
          outOfStock={unavailable}
          imageUrl={productImageUrl(product.mainImagePath)}
          compact
        />
      </div>
    </article>
  );
}
