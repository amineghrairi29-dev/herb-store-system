"use client";
import { useState, type PointerEvent } from "react";
import ProductImage from "@/components/product-image";
import { LeafIcon } from "../../storefront/visuals";

/**
 * Main photo + thumbnails. The selected photo fades in; on a computer the photo
 * zooms in under the mouse (loupe) so the texture of the herbs can be seen.
 */
export default function ProductGalleryView({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? null;
  function follow(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--zx", `${((event.clientX - box.left) / box.width) * 100}%`);
    event.currentTarget.style.setProperty("--zy", `${((event.clientY - box.top) / box.height) * 100}%`);
  }
  const fallback = <div className="pp-main-image pp-placeholder" aria-label="Image du produit non disponible"><LeafIcon /><span>Photo à venir</span></div>;
  return (
    <div className="pp-gallery">
      <div className="pp-main" onPointerMove={follow} data-zoom={current ? true : undefined}>
        <ProductImage key={current ?? "none"} imagePath={current} name={name} className="pp-main-image" sizes="(max-width: 899px) calc(100vw - 32px), 560px" fallback={fallback} />
      </div>
      {images.length > 1 && (
        <div className="pp-thumbs" role="group" aria-label="Photos du produit">
          {images.map((path, position) => (
            <button key={path} type="button" className="pp-thumb" aria-label={`Photo ${position + 1} sur ${images.length}`} aria-pressed={position === index} onClick={() => setIndex(position)}>
              <ProductImage imagePath={path} name="" className="pp-thumb-image" sizes="76px" fallback={<span />} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
