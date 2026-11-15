import type { Metadata } from "next";
import Link from "next/link";
import { getStoreInfo } from "@/lib/store-info";
import "../info-pages.css";

export const metadata: Metadata = { title: "Politique de confidentialité", description: "Quelles données nous collectons, pourquoi, et comment exercer vos droits." };

// Draft written for the shop: have it reviewed by a legal professional before going live.
export default async function PrivacyPage() {
  const store = await getStoreInfo();
  const name = store?.storeName ?? "la boutique";
  return <section className="sf-information-page sf-legal">
    <p className="sf-eyebrow">Informations légales</p>
    <h1>Politique de confidentialité</h1>
    <p className="sf-information-lead"><bdi>{name}</bdi> collecte uniquement les informations nécessaires pour traiter et livrer vos commandes.</p>
    <h2>Données collectées</h2>
    <ul>
      <li>Lors d’une commande : nom, téléphone, adresse de livraison, gouvernorat et ville, email (facultatif), notes, produits commandés.</li>
      <li>Si vous créez un compte : email, mot de passe (enregistré de façon chiffrée, jamais en clair), nom, téléphone et adresse par défaut. Avec la connexion Google, nous recevons votre nom et votre email.</li>
    </ul>
    <h2>Utilisation</h2>
    <ul>
      <li>Confirmer votre commande par téléphone, la préparer et la livrer.</li>
      <li>Vous permettre de suivre vos commandes et de retrouver vos informations.</li>
      <li>Répondre à vos questions.</li>
    </ul>
    <p>Vos données ne sont ni vendues ni louées. Seules les informations nécessaires à la livraison (nom, téléphone, adresse) peuvent être transmises au livreur.</p>
    <h2>Cookies et stockage</h2>
    <p>Le site utilise un cookie de session pour garder votre compte connecté, et le stockage de votre navigateur pour conserver votre panier. Aucun cookie publicitaire n’est utilisé.</p>
    <h2>Conservation</h2>
    <p>Les données de commande sont conservées le temps nécessaire à la gestion de la boutique et au respect des obligations comptables.</p>
    <h2>Vos droits</h2>
    <p>Conformément à la législation tunisienne sur la protection des données personnelles (loi organique n° 2004-63 du 27 juillet 2004), vous pouvez demander l’accès à vos données, leur rectification ou leur suppression. Contactez-nous depuis la page <Link href="/shop/contact" className="underline">Contact</Link>.</p>
    <p className="sf-updated">Dernière mise à jour : novembre 2026.</p>
  </section>;
}
