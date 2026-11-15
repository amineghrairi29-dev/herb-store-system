import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import { shopContent, yearsOfExperience } from "@/lib/shop-content";
import { SloumaStamp } from "@/components/brand/slouma-logo";
import "../info-pages.css";
import "./about.css";
import { Leaf } from "../storefront/leaf";
import ScrollReveal from "../storefront/scroll-reveal";
import OpenStatus from "../storefront/open-status";
import { JsonLd, storeJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  title: "Notre histoire",
  alternates: { canonical: "/shop/about" },
  description: `Herboristerie à Ghannouch (Gabès) depuis ${shopContent.foundedYear} : recettes traditionnelles éprouvées et conseils personnalisés pour chaque client.`,
};

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

export default async function AboutPage() {
  const store = await getStoreInfo();
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question sur une plante ou une recette.");
  const years = yearsOfExperience();
  const place = [store?.address, store?.city].filter(Boolean).join(", ");
  const map = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null;
  const values = [
    { title: "L’expérience", text: `${years} ans à préparer, conseiller et accompagner nos clients, chaque jour à la boutique.`, icon: <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" {...stroke} /><path d="M12 7.5V12l3 2" {...stroke} /></svg> },
    { title: "Des recettes éprouvées", text: "Des préparations traditionnelles, testées et ajustées avec les retours de nos clients.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16l-1.5 6.5A3 3 0 0 1 15.6 20H8.4a3 3 0 0 1-2.9-2.5L4 11Z M14 11l5-7" {...stroke} /></svg> },
    { title: "Un conseil pour chaque question", text: "Une plante, une préparation, une façon de l’utiliser : on prend le temps de répondre.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" {...stroke} /><path d="M8 9.5h8M8 12.5h5" {...stroke} /></svg> },
  ];
  return (
    <div className="ip ab">
      <JsonLd data={storeJsonLd(store)} />
      <header className="ab-hero">
        <div className="ab-hero-copy">
          <p className="ip-eyebrow ip-in" style={{ "--i": 0 } as React.CSSProperties}>{shopContent.tagline}</p>
          <p lang="ar" dir="rtl" className="ip-ar ip-in" style={{ "--i": 1 } as React.CSSProperties}>دار سلومة، من {shopContent.foundedYear}</p>
          <h1 className="ip-in" style={{ "--i": 2 } as React.CSSProperties}>{years} ans de recettes, <em>une seule boutique.</em></h1>
          <p className="ip-lead ip-in" style={{ "--i": 3 } as React.CSSProperties}>Depuis {shopContent.foundedYear}, à Ghannouch, Slouma prépare des plantes et des recettes traditionnelles, affinées au fil des années avec ses clients.</p>
          <div className="ab-stats ip-in" style={{ "--i": 4 } as React.CSSProperties}>
            <div><strong>{shopContent.foundedYear}</strong><span>ouverture à Ghannouch</span></div>
            <div><strong>{years} ans</strong><span>de conseils</span></div>
          </div>
        </div>
        <div className="ab-hero-visual" aria-hidden="true">
          <span className="ab-blob" />
          <div className="ab-arch"><Image src="/images/shop/hero/hero-main.png" alt="" fill preload sizes="(max-width: 899px) 80vw, 420px" /></div>
          <span className="ab-leaf ab-leaf-1"><Leaf color="#3E7B3A" /></span>
          <span className="ab-leaf ab-leaf-2"><Leaf color="#D99A2B" vein="rgb(31 42 26 / .35)" /></span>
          <span className="ab-stamp"><SloumaStamp size={110} /></span>
        </div>
      </header>

      <ScrollReveal className="ip-reveal">
        <section className="ab-story" aria-labelledby="story-title">
          <div>
            <p className="ip-eyebrow">Notre histoire</p>
            <h2 id="story-title">De la boutique de quartier à votre porte</h2>
            <p>Tout a commencé dans notre boutique de Ghannouch, à Gabès. Au fil des années, nous avons composé des recettes que nos clients reviennent chercher, parce qu’elles leur conviennent.</p>
            <p>Aujourd’hui, vous pouvez les commander en ligne. Le magasin vous appelle pour confirmer, puis nous livrons chez vous. Le paiement se fait à la réception.</p>
            <Link href="/shop#products" className="ip-link">Découvrir nos produits <span aria-hidden="true">→</span></Link>
          </div>
          <blockquote className="ab-quote">
            <p lang="ar" dir="rtl">الوصفة الباهية هي اللي ترجعلها</p>
            <p>« Une bonne recette, c’est celle pour laquelle on revient. »</p>
          </blockquote>
        </section>
      </ScrollReveal>

      <ScrollReveal className="ip-reveal">
        <section className="ab-values" aria-label="Ce qui nous distingue">
          {values.map((value, index) => <div key={value.title} className="ab-value" style={{ "--i": index } as React.CSSProperties}><span className="ab-value-icon">{value.icon}</span><h2>{value.title}</h2><p>{value.text}</p></div>)}
        </section>
      </ScrollReveal>

      <ScrollReveal className="ip-reveal">
        <section className="ab-line" aria-labelledby="line-title">
          <h2 id="line-title">En quelques dates</h2>
          <ol>
            <li style={{ "--i": 0 } as React.CSSProperties}><strong>{shopContent.foundedYear}</strong><span>La boutique ouvre à Ghannouch.</span></li>
            <li style={{ "--i": 1 } as React.CSSProperties}><strong>Chaque année</strong><span>Les recettes s’affinent avec les retours des clients.</span></li>
            <li style={{ "--i": 2 } as React.CSSProperties}><strong>Aujourd’hui</strong><span>Les mêmes recettes, commandées en ligne et livrées.</span></li>
          </ol>
        </section>
      </ScrollReveal>

      <section className="ab-visit" aria-labelledby="visit-title">
        <div>
          <p lang="ar" dir="rtl" className="ip-cta-ar">مرحبا بيك في الحانوت</p>
          <h2 id="visit-title">Passez nous voir</h2>
          {place && <p><bdi>{place}</bdi></p>}
          <dl>{shopContent.openingHours.map((row) => <div key={row.days}><dt>{row.days}</dt><dd>{row.hours}</dd></div>)}</dl>
          <OpenStatus />
        </div>
        <div className="ab-visit-actions">
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="ip-btn">Poser une question sur WhatsApp</a>}
          {map && <a href={map} target="_blank" rel="noopener noreferrer" className="ab-map">Voir sur la carte <span aria-hidden="true">↗</span></a>}
          <Link href="/shop/contact" className="ab-map">Toutes nos coordonnées <span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <p className="ip-note">Nos conseils s’appuient sur l’usage traditionnel des plantes et ne remplacent pas l’avis d’un médecin ou d’un pharmacien, en particulier pendant une grossesse ou un traitement.</p>
    </div>
  );
}
