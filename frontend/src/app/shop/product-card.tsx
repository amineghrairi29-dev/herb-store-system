import Link from "next/link";
import ProductImage from "@/components/product-image";
import type { PublicProduct } from "@/types/public-product";
import { displayAmount } from "@/lib/purchase-decimal";
import AddToCart from "./add-to-cart";
import { ProductImagePlaceholder } from "./storefront/visuals";
import "./product-card.css";

const units: Record<string, string> = { KG: "kg", G: "g", L: "L", ML: "ml", PIECE: "pièce" };

export default function ProductCard({ product }: { product: PublicProduct }) {
  const unavailable = product.availabilityStatus === "OUT_OF_STOCK";
  const availability = unavailable ? "Indisponible" : product.availabilityStatus === "LOW_STOCK" ? "Stock limité" : "Disponible";
  const category = product.classifications.map(c => c.nameFr).join(" · ");
  return (
    <article className="botanical-product-card" data-product-id={product.id}>
      <Link className="bpc-image-link" href={`/shop/products/${product.id}`} aria-label={`Découvrir ${product.name}`}>
        <ProductImage
          imagePath={product.mainImagePath}
          name={product.name}
          className="bpc-image"
          sizes="(max-width: 479px) 90vw, (max-width: 759px) 44vw, (max-width: 1099px) 29vw, (max-width: 1439px) 22vw, 270px"
          fallback={<div className="bpc-image bpc-placeholder"><ProductImagePlaceholder /></div>}
        />
      </Link>
      <div className="bpc-body">
        <p className="bpc-category" title={category}><bdi>{category}</bdi></p>
        <Link className="bpc-name-link" href={`/shop/products/${product.id}`} title={product.name}>
          <h3 className="bpc-name"><bdi>{product.name}</bdi></h3>
        </Link>
        <p className="bpc-price">{displayAmount(product.salePrice)} <span>TND</span> <span className="bpc-unit">/ {units[product.saleUnit] ?? product.saleUnit}</span></p>
        <p className={`bpc-availability${unavailable ? " bpc-unavailable" : ""}`}><span aria-hidden="true" />{availability}</p>
        <div className="bpc-cart"><AddToCart productId={product.id} outOfStock={unavailable} /></div>
      </div>
    </article>
  );
}
