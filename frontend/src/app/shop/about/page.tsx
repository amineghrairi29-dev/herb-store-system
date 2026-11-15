import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import { shopContent, yearsOfExperience } from "@/lib/shop-content";
import "./about.css";

export const metadata: Metadata = {
  title: "À propos",
  description: `Herboristerie à Ghannouch (Gabès) depuis ${shopContent.foundedYear} : recettes traditionnelles éprouvées et conseils personnalisés pour chaque client.`,
};

export default async function AboutPage() {
  const store = await getStoreInfo();
  const name = store?.storeName ?? "notre herboristerie";
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question sur une plante ou une recette.");
  const years = yearsOfExperience();
  return (
    <div className="shop-about">
      <header className="about-intro">
        <p className="about-eyebrow">{shopContent.tagline}</p>
        <h1>{years} ans de savoir-faire, une recette à la fois.</h1>
        <p>Depuis {shopContent.foundedYear}, <bdi>{name}</bdi> prépare des plantes et des recettes traditionnelles, transmises et affinées au fil des années avec nos clients.</p>
      </header>
      <section className="about-story" aria-labelledby="approach-title">
        <div className="about-image"><Image src="/images/shop/hero/hero-main.png" alt="Herbes aromatiques, mortier en pierre et flacon d’huile sur une table claire" fill sizes="(max-width: 759px) 90vw, 560px" /></div>
        <div className="about-story-copy">
          <p className="about-eyebrow">Notre histoire</p>
          <h2 id="approach-title">De l’herboristerie à votre porte</h2>
          <p>Tout a commencé dans notre boutique de Ghannouch, à Gabès. Au fil des années, nous avons composé des recettes que nos clients reviennent chercher, parce qu’elles leur conviennent.</p>
          <p>Aujourd’hui, vous pouvez les commander en ligne. Le magasin vous appelle pour confirmer, puis nous livrons chez vous. Le paiement se fait à la réception.</p>
          <Link href="/shop#products" className="about-link">Découvrir nos produits <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
      <section className="about-values" aria-label="Ce qui nous distingue">
        {[
          ["01", "L’expérience", `Plus de ${years} ans à préparer, conseiller et accompagner nos clients au quotidien.`],
          ["02", "Des recettes éprouvées", "Des préparations traditionnelles, testées et ajustées avec les retours de nos clients."],
          ["03", "Un conseil pour chaque question", "Une plante, une préparation, une façon de l’utiliser : posez-nous votre question, nous prenons le temps de répondre."],
        ].map(([number, title, text]) => <div key={number}><span className="about-value-number" aria-hidden="true">{number}</span><h2>{title}</h2><p>{text}</p></div>)}
      </section>
      <section className="about-visit" aria-labelledby="visit-title">
        <div>
          <h2 id="visit-title">Passez nous voir</h2>
          {[store?.address, store?.city].filter(Boolean).length > 0 && <p><bdi>{[store?.address, store?.city].filter(Boolean).join(", ")}</bdi></p>}
          <dl>{shopContent.openingHours.map((row) => <div key={row.days}><dt>{row.days}</dt><dd>{row.hours}</dd></div>)}</dl>
        </div>
        <div className="about-visit-actions">
          {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="about-whatsapp">Posez votre question sur WhatsApp</a>}
          <Link href="/shop/contact" className="about-link">Toutes nos coordonnées <span aria-hidden="true">↗</span></Link>
        </div>
        <p className="about-note">Nos conseils s’appuient sur l’usage traditionnel des plantes et ne remplacent pas l’avis d’un médecin ou d’un pharmacien, en particulier pendant une grossesse ou un traitement.</p>
      </section>
    </div>
  );
}
