"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { SloumaStamp } from "@/components/brand/slouma-logo";
import { apiBase } from "@/lib/api-base";
import { isStoreInfo, whatsappLink } from "@/lib/store-info";
import { yearsOfExperience } from "@/lib/shop-content";
import { Leaf } from "../storefront/leaf";

const title = ["Les", "recettes", "de", "Slouma,"], accent = ["tout", "droit", "de", "la", "nature."];

/**
 * Home hero: words rise one by one, the photo sits in an arch, leaves drift in three
 * depths with the mouse (desktop) and with the scroll. All motion is off when the
 * device asks for less of it.
 */
export default function HomeHero() {
  const root = useRef<HTMLElement>(null);
  const [whatsapp, setWhatsapp] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/store-info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => { if (isStoreInfo(value)) setWhatsapp(whatsappLink(value.phone, "Bonjour, j’aimerais un conseil.")); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const element = root.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, mx = 0, my = 0;
    const paint = () => {
      frame = 0;
      const progress = Math.min(1, Math.max(0, window.scrollY / Math.max(1, element.offsetHeight)));
      element.style.setProperty("--mx", mx.toFixed(3));
      element.style.setProperty("--my", my.toFixed(3));
      element.style.setProperty("--sy", progress.toFixed(3));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(paint); };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = element.getBoundingClientRect();
      mx = ((event.clientX - box.left) / box.width - 0.5) * 2;
      my = ((event.clientY - box.top) / box.height - 0.5) * 2;
      schedule();
    };
    element.addEventListener("pointermove", onMove);
    window.addEventListener("scroll", schedule, { passive: true });
    paint();
    return () => { element.removeEventListener("pointermove", onMove); window.removeEventListener("scroll", schedule); if (frame) cancelAnimationFrame(frame); };
  }, []);
  let word = 0;
  return (
    <section ref={root} className="h-hero" aria-labelledby="home-title">
      <div className="h-hero-inner">
        <div className="h-hero-copy">
          <p className="h-badge h-enter" style={{ "--i": 0 } as React.CSSProperties}><span aria-hidden="true" />100 % naturel · depuis 2006</p>
          <p lang="ar" dir="rtl" className="h-hero-arabic h-enter" style={{ "--i": 1 } as React.CSSProperties}>وصفات سلومة المجرّبة</p>
          <h1 id="home-title" className="h-title">
            {title.map((text) => <span key={`a${text}`}><span className="h-word" style={{ "--i": word++ } as React.CSSProperties}>{text}</span>{" "}</span>)}
            <span className="h-title-accent">{accent.map((text, index) => <span key={`b${index}`}><span className="h-word" style={{ "--i": word++ } as React.CSSProperties}>{text}</span>{" "}</span>)}</span>
          </h1>
          <p className="h-hero-text h-enter" style={{ "--i": 6 } as React.CSSProperties}>Plantes, mélanges et épices préparés à la boutique de Ghannouch, avec un conseil pour chaque question. Commandez en ligne, payez à la livraison.</p>
          <div className="h-actions h-enter" style={{ "--i": 7 } as React.CSSProperties}>
            <Link href="/shop#products" className="h-btn h-btn-honey">Découvrir les produits <span aria-hidden="true">→</span></Link>
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="h-btn h-btn-line">Demander conseil sur WhatsApp</a> : <Link href="/shop/contact" className="h-btn h-btn-line">Demander conseil</Link>}
          </div>
          <dl className="h-facts h-enter" style={{ "--i": 8 } as React.CSSProperties}>
            <div><dt>{yearsOfExperience()} ans</dt><dd>de recettes</dd></div>
            <div><dt>Gratuit</dt><dd>le conseil</dd></div>
            <div><dt>À la livraison</dt><dd>le paiement</dd></div>
          </dl>
        </div>
        <div className="h-hero-visual" aria-hidden="true">
          <div className="h-layer h-layer-back"><span className="h-leaf h-leaf-1"><Leaf color="#A9C68F" /></span><span className="h-leaf h-leaf-2"><Leaf color="#C9DDB4" /></span></div>
          <div className="h-arch">
            <Image src="/images/shop/hero/hero-main.png" alt="" fill preload sizes="(max-width: 899px) 80vw, 480px" className="h-arch-image" />
          </div>
          <div className="h-layer h-layer-mid"><span className="h-leaf h-leaf-3"><Leaf color="#3E7B3A" /></span><span className="h-leaf h-leaf-4"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span></div>
          <div className="h-layer h-layer-front">
            <span className="h-leaf h-leaf-5"><Leaf color="#2E5E2B" /></span>
            <span className="h-stamp"><SloumaStamp size={118} /></span>
            <span className="h-card"><strong>Recettes maison</strong><span>préparées à la boutique</span></span>
          </div>
        </div>
      </div>
    </section>
  );
}
