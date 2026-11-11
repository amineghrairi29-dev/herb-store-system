"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import ProductImage from "@/components/product-image";
import { SloumaStamp } from "@/components/brand/slouma-logo";
import type { PublicClassification } from "@/types/public-product";
import { Leaf } from "../../storefront/leaf";

type Photo = { id: number; name: string; path: string };

/**
 * Banner of a need page: the Arabic name written large on the need's own tint, and
 * up to three product photos in natural (pebble) shapes, with leaves that drift with
 * the mouse. Without photos the leaves and the stamp fill the space.
 */
export default function NeedHero({ need, total, photos }: { need: PublicClassification; total: number; photos: Photo[] }) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, mx = 0, my = 0;
    const paint = () => { frame = 0; element.style.setProperty("--mx", mx.toFixed(3)); element.style.setProperty("--my", my.toFixed(3)); };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = element.getBoundingClientRect();
      mx = ((event.clientX - box.left) / box.width - 0.5) * 2;
      my = ((event.clientY - box.top) / box.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    element.addEventListener("pointermove", onMove);
    return () => { element.removeEventListener("pointermove", onMove); if (frame) cancelAnimationFrame(frame); };
  }, []);
  const count = total === 0 ? "Bientôt en boutique" : total === 1 ? "1 produit" : `${total} produits`;
  return (
    <section ref={root} className="nd-hero" aria-labelledby="nd-title" data-photos={photos.length}>
      <div className="nd-hero-copy">
        <nav className="nd-crumbs nd-enter" aria-label="Fil d’Ariane" style={{ "--i": 0 } as React.CSSProperties}>
          <Link href="/shop">Boutique</Link><span aria-hidden="true">›</span>
          <Link href="/shop#needs-title">Besoins</Link><span aria-hidden="true">›</span>
          <span aria-current="page"><bdi>{need.nameFr}</bdi></span>
        </nav>
        <p lang="ar" dir="rtl" className="nd-ar nd-enter" style={{ "--i": 1 } as React.CSSProperties}>{need.nameAr}</p>
        <h1 id="nd-title" className="nd-title nd-enter" style={{ "--i": 2 } as React.CSSProperties}><bdi>{need.nameFr}</bdi></h1>
        <p className="nd-lead nd-enter" style={{ "--i": 3 } as React.CSSProperties}>Les plantes et les recettes que la boutique prépare pour ce besoin, avec un conseil pour bien les utiliser.</p>
        <ul className="nd-pills nd-enter" style={{ "--i": 4 } as React.CSSProperties}>
          <li><strong>{count}</strong></li>
          <li>Conseil gratuit</li>
          <li>Paiement à la livraison</li>
        </ul>
        <a href="#nd-results" className="nd-jump nd-enter" style={{ "--i": 5 } as React.CSSProperties}>Voir les produits <span aria-hidden="true">↓</span></a>
      </div>
      <div className="nd-hero-visual" aria-hidden="true">
        <span className="nd-blob" />
        <div className="nd-layer nd-layer-back"><span className="nd-leaf nd-leaf-1"><Leaf color="#A9C68F" /></span><span className="nd-leaf nd-leaf-2"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span></div>
        <div className="nd-photos">
          {photos.map((photo, index) => (
            <Link key={photo.id} href={`/shop/products/${photo.id}`} tabIndex={-1} className={`nd-photo nd-photo-${index + 1}`}>
              <ProductImage imagePath={photo.path} name="" className="nd-photo-image" sizes={index === 0 ? "(max-width: 899px) 60vw, 340px" : "180px"} fallback={<span className="nd-photo-image" />} />
            </Link>
          ))}
        </div>
        <div className="nd-layer nd-layer-front">
          <span className="nd-leaf nd-leaf-3"><Leaf color="#3E7B3A" /></span>
          <span className="nd-stamp"><SloumaStamp size={photos.length ? 96 : 150} /></span>
        </div>
      </div>
    </section>
  );
}
