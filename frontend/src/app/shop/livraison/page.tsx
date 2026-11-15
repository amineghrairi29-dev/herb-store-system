import type { Metadata } from "next";
import Link from "next/link";
import "../info-pages.css";

export const metadata: Metadata = { title: "Livraison et paiement", description: "Comment commander, frais et délais de livraison, paiement à la réception." };

export default function DeliveryPage() {
  return <section className="sf-information-page sf-legal">
    <p className="sf-eyebrow">Livraison</p>
    <h1>Livraison et paiement</h1>
    <p className="sf-information-lead">Commandez en ligne, nous vous appelons pour confirmer, puis nous livrons chez vous. Vous payez à la réception.</p>
    <ol className="sf-steps">
      <li><strong>Vous commandez.</strong> Ajoutez vos produits au panier, puis indiquez votre gouvernorat, votre adresse et votre téléphone.</li>
      <li><strong>Nous confirmons.</strong> Le magasin vous appelle pour vérifier la commande et convenir de la livraison.</li>
      <li><strong>Nous préparons.</strong> Votre commande est pesée et emballée avec soin.</li>
      <li><strong>Vous recevez et payez.</strong> Le paiement se fait en espèces, à la livraison.</li>
    </ol>
    <h2>Frais et délais</h2>
    <p>Les frais de livraison et le délai estimé dépendent de votre gouvernorat. Ils s’affichent dans le récapitulatif de commande, avant que vous ne confirmiez. Au-delà d’un certain montant d’achat, la livraison peut être offerte : le seuil est indiqué au même endroit.</p>
    <p>Les délais sont donnés à titre indicatif et peuvent varier, notamment les jours fériés.</p>
    <h2>Suivre votre commande</h2>
    <p>Utilisez la page <Link href="/shop/suivi" className="underline">Suivre ma commande</Link> avec votre référence et votre numéro de téléphone.</p>
    <h2>Un souci avec votre commande ?</h2>
    <p>Contactez-nous dès la réception par téléphone ou WhatsApp depuis la page <Link href="/shop/contact" className="underline">Contact</Link>.</p>
  </section>;
}
