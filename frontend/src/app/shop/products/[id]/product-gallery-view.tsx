"use client";
import { useState } from "react";
import ProductImage from "@/components/product-image";
import { LeafIcon } from "../../storefront/visuals";

/** Main photo + thumbnails; the selected photo fades in. */
export default function ProductGalleryView({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  const fallback = <div className="pd-image pd-placeholder" aria-label="Image du produit non disponible"><LeafIcon /><span>Image à venir</span></div>;
  return <div className="pd-gallery">
    <div className="pd-image-surface">
      <ProductImage key={current ?? "none"} imagePath={current} name={name} className="pd-image pd-image-fade" sizes="(max-width: 759px) calc(100vw - 62px), (max-width: 1279px) 38vw, 475px" fallback={fallback} />
    </div>
    {images.length > 1 && <div className="pd-thumbs" role="list" aria-label="Photos du produit">
      {images.map((path, position) => <button key={path} type="button" role="listitem" className="pd-thumb" aria-label={`Photo ${position + 1}`} aria-current={position === index || undefined} onClick={() => setIndex(position)}>
        <ProductImage imagePath={path} name="" className="pd-thumb-image" sizes="72px" fallback={<span />} />
      </button>)}
    </div>}
  </div>;
}
