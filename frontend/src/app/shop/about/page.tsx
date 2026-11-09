import Link from "next/link";
import StoreName from "@/components/store-name";
import Image from "next/image";
import "./about.css";
export default function AboutPage() {
  return (
    <div className="shop-about">
      <header className="about-intro">
        <p className="about-eyebrow">Notre univers</p>
        <h1>Le naturel, au quotidien.</h1>
        <p>Chez <StoreName />, découvrez des plantes et des produits naturels pour composer votre quotidien, à votre rythme.</p>
      </header>
      <section className="about-story" aria-labelledby="approach-title">
        <div className="about-image"><Image src="/images/shop/hero/hero-main.png" alt="Herbes aromatiques, mortier en pierre et flacon d’huile sur une table claire" fill sizes="(max-width: 759px) 90vw, 560px" /></div>
        <div className="about-story-copy">
          <p className="about-eyebrow">Découvrir, choisir, échanger</p>
          <h2 id="approach-title">Notre approche</h2>
          <p>Des catégories faciles à explorer, des informations utiles et le plaisir de choisir les produits qui vous correspondent.</p>
          <p>Préparez votre panier en ligne. Le magasin confirme ensuite votre commande et ses modalités avec vous.</p>
          <Link href="/shop#products" className="about-link">Explorer les produits <span aria-hidden="true">↗</span></Link>
        </div>
      </section>
      <section className="about-values" aria-label="Nos valeurs">
        {[
          ["01", "Sélection soignée", "Une sélection de plantes et de produits naturels à découvrir."],
          ["02", "Simplicité", "Un catalogue clair pour choisir et préparer votre panier."],
          ["03", "Proximité", "Le magasin reste votre interlocuteur pour votre commande."],
        ].map(([number, title, text]) => <div key={number}><span className="about-value-number" aria-hidden="true">{number}</span><h2>{title}</h2><p>{text}</p></div>)}
      </section>
    </div>
  );
}
