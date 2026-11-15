import type { Metadata } from "next";
import Link from "next/link";
import "../info-pages.css";
import PageHero from "../storefront/page-hero";
import ScrollReveal from "../storefront/scroll-reveal";

export const metadata: Metadata = { title: "Livraison et paiement", description: "Comment commander, frais et délais de livraison, paiement à la réception." };

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;
const steps = [
  { title: "Vous commandez", text: "Ajoutez vos produits au panier, puis indiquez votre gouvernorat, votre adresse et votre téléphone.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Zm3 0a3 3 0 0 1 6 0" {...stroke} /></svg> },
  { title: "Nous confirmons", text: "Le magasin vous appelle pour vérifier la commande et convenir de la livraison.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z" {...stroke} /></svg> },
  { title: "Nous préparons", text: "Votre commande est pesée et emballée avec soin, à la boutique.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11h16l-1.5 6.5A3 3 0 0 1 15.6 20H8.4a3 3 0 0 1-2.9-2.5L4 11Z M14 11l5-7" {...stroke} /></svg> },
  { title: "Vous payez à la réception", text: "En espèces, au moment où vous recevez la commande. Rien n’est payé en ligne.", icon: <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2.5" y="6" width="19" height="12" rx="2" {...stroke} /><circle cx="12" cy="12" r="2.6" {...stroke} /></svg> },
];

export default function DeliveryPage() {
  return <div className="ip">
    <PageHero ar="نوصلوها لباب الدار" eyebrow="Livraison" title="Livraison et paiement" lead="Commandez en ligne, nous vous appelons pour confirmer, puis nous livrons chez vous. Vous payez à la réception." tone="honey">
      <Link href="/shop#products" className="ip-btn">Commander maintenant <span aria-hidden="true">→</span></Link>
    </PageHero>
    <ScrollReveal className="ip-reveal">
      <ol className="ip-steps">
        {steps.map((step, index) => <li key={step.title} style={{ "--i": index } as React.CSSProperties}><span className="ip-step-icon">{step.icon}</span><span className="ip-step-num" aria-hidden="true">{index + 1}</span><h2>{step.title}</h2><p>{step.text}</p></li>)}
      </ol>
    </ScrollReveal>
    <div className="ip-cards">
      <section className="ip-card" aria-labelledby="fees-title">
        <h2 id="fees-title">Frais et délais</h2>
        <p>Les frais et le délai estimé dépendent de votre gouvernorat. Ils s’affichent dans le récapitulatif, avant que vous confirmiez. Au-delà d’un certain montant d’achat, la livraison peut être offerte : le seuil est indiqué au même endroit.</p>
        <p className="ip-muted">Les délais sont indicatifs et peuvent varier, notamment les jours fériés.</p>
      </section>
      <section className="ip-card" aria-labelledby="track-title">
        <h2 id="track-title">Suivre votre commande</h2>
        <p>Avec votre référence (ORD-…) et votre numéro de téléphone, voyez où en est votre commande à tout moment.</p>
        <Link href="/shop/suivi" className="ip-link">Suivre ma commande <span aria-hidden="true">→</span></Link>
      </section>
      <section className="ip-card" aria-labelledby="issue-title">
        <h2 id="issue-title">Un souci à la réception ?</h2>
        <p>Vérifiez votre commande à la livraison et prévenez-nous tout de suite, par téléphone ou WhatsApp.</p>
        <Link href="/shop/contact" className="ip-link">Nous contacter <span aria-hidden="true">→</span></Link>
      </section>
    </div>
  </div>;
}
