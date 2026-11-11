import type { Metadata } from "next";
import Link from "next/link";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import { shopContent } from "@/lib/shop-content";
import "../info-pages.css";

export const metadata: Metadata = { title: "Questions fréquentes", description: "Commande, livraison, paiement, conseils d’utilisation : les réponses aux questions les plus posées." };

const questions: [string, string][] = [
  ["Faut-il créer un compte pour commander ?", "Non. Vous pouvez commander avec votre nom, votre téléphone et votre adresse. Un compte permet seulement de retrouver vos informations et l’historique de vos commandes."],
  ["Comment se passe le paiement ?", "Vous payez à la livraison, en espèces. Aucun paiement n’est demandé en ligne."],
  ["Combien coûte la livraison et quel est le délai ?", "Les frais et le délai estimé dépendent de votre gouvernorat. Ils s’affichent dans le récapitulatif avant que vous confirmiez la commande. Au-delà d’un certain montant, la livraison peut être offerte."],
  ["Comment ma commande est-elle confirmée ?", "Après l’envoi, le magasin vous appelle au numéro indiqué pour vérifier la commande et organiser la livraison. Gardez votre téléphone à portée de main."],
  ["Comment suivre ma commande ?", "Sur la page « Suivre ma commande », saisissez votre référence (ex. ORD-000123) et votre numéro de téléphone. Si vous avez un compte, vos commandes apparaissent aussi dans « Mon compte »."],
  ["Je ne sais pas quelle plante choisir. Pouvez-vous m’aider ?", "Oui, c’est notre métier depuis 2006. Écrivez-nous sur WhatsApp ou appelez la boutique : nous vous conseillons la plante ou la préparation adaptée, et la façon de l’utiliser."],
  ["Les plantes remplacent-elles un traitement médical ?", "Non. Nos conseils s’appuient sur l’usage traditionnel des plantes. En cas de maladie, de grossesse, d’allaitement ou de traitement en cours, demandez l’avis de votre médecin ou de votre pharmacien."],
  ["Comment conserver les plantes ?", "Dans un bocal ou un sachet bien fermé, à l’abri de la lumière, de la chaleur et de l’humidité. Elles gardent ainsi leur parfum plus longtemps."],
  ["Puis-je acheter une petite quantité ?", "Oui. Sur chaque fiche produit, choisissez une quantité rapide (100 g, 250 g…) ou saisissez la quantité de votre choix."],
];

export default async function FaqPage() {
  const store = await getStoreInfo();
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question.");
  return <section className="sf-information-page">
    <p className="sf-eyebrow">Aide</p>
    <h1>Questions fréquentes</h1>
    <p className="sf-information-lead">Vous ne trouvez pas votre réponse ? Nous répondons à toutes vos questions.</p>
    <div className="sf-faq">{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
    <div className="sf-information-note">
      <h2>Une autre question ?</h2>
      <p>La boutique est ouverte {shopContent.openingHours.map((row) => `${row.days.toLowerCase()}, ${row.hours}`).join(" ; ")}.</p>
    </div>
    {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="sf-button">Poser ma question sur WhatsApp ↗</a> : <Link href="/shop/contact" className="sf-button">Nous contacter ↗</Link>}
  </section>;
}
