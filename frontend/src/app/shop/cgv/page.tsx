import type { Metadata } from "next";
import Link from "next/link";
import { getStoreInfo } from "@/lib/store-info";
import "../info-pages.css";

export const metadata: Metadata = { title: "Conditions générales de vente", description: "Conditions applicables aux commandes passées sur la boutique en ligne." };

// Draft written for the shop: have it reviewed by a legal professional before going live.
export default async function TermsPage() {
  const store = await getStoreInfo();
  const name = store?.storeName ?? "la boutique";
  const place = [store?.address, store?.city].filter(Boolean).join(", ");
  return <section className="sf-information-page sf-legal">
    <p className="sf-eyebrow">Informations légales</p>
    <h1>Conditions générales de vente</h1>
    <h2>1. Objet</h2>
    <p>Les présentes conditions s’appliquent à toute commande passée sur la boutique en ligne de <bdi>{name}</bdi>{place && <>, située <bdi>{place}</bdi></>}. Passer une commande implique leur acceptation.</p>
    <h2>2. Produits</h2>
    <p>Les produits proposés sont des plantes, herbes, épices et préparations naturelles. Les photos sont indicatives : l’aspect des plantes peut varier d’un lot à l’autre.</p>
    <p>Les informations « Bienfaits » et « Mode d’utilisation » décrivent un usage traditionnel. Elles ne constituent ni un diagnostic ni un traitement et ne remplacent pas l’avis d’un médecin ou d’un pharmacien.</p>
    <h2>3. Prix</h2>
    <p>Les prix sont indiqués en dinars tunisiens (TND), toutes taxes comprises, à l’unité de vente affichée (kg, litre, pièce…). Les frais de livraison sont indiqués séparément dans le récapitulatif, avant la confirmation de la commande. Le prix applicable est celui affiché au moment de la commande.</p>
    <h2>4. Commande</h2>
    <p>La commande est enregistrée lorsque vous cliquez sur « Confirmer la commande ». Le magasin vous contacte ensuite par téléphone pour la confirmer. Le magasin peut refuser ou annuler une commande, notamment en cas d’indisponibilité d’un produit ou d’informations de contact erronées ; vous en êtes alors informé.</p>
    <h2>5. Paiement</h2>
    <p>Le paiement s’effectue à la livraison, en espèces. Aucun paiement n’est demandé en ligne.</p>
    <h2>6. Livraison</h2>
    <p>La livraison est proposée dans les zones affichées lors de la commande. Les délais sont indicatifs. Merci de vérifier votre commande à la réception et de nous signaler tout problème sans attendre. Voir aussi <Link href="/shop/livraison" className="underline">Livraison et paiement</Link>.</p>
    <h2>7. Données personnelles</h2>
    <p>Les informations fournies lors de la commande servent à la traiter et à la livrer. Voir la <Link href="/shop/confidentialite" className="underline">politique de confidentialité</Link>.</p>
    <h2>8. Droit applicable</h2>
    <p>Les présentes conditions sont soumises au droit tunisien. En cas de différend, une solution amiable sera recherchée en priorité.</p>
    <h2>9. Contact</h2>
    <p>Pour toute question : page <Link href="/shop/contact" className="underline">Contact</Link>.</p>
    <p className="sf-updated">Dernière mise à jour : novembre 2026.</p>
  </section>;
}
