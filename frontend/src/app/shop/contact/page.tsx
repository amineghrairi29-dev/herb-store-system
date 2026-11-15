import type { Metadata } from "next";
import Link from "next/link";
import { displayPhone, getStoreInfo, whatsappLink } from "@/lib/store-info";
import "./contact.css";
import { shopContent } from "@/lib/shop-content";

export const metadata: Metadata = {
  title: "Contact",
  description: "Téléphone, WhatsApp et adresse de la boutique. Une question sur un produit ou une commande ? Écrivez-nous.",
};

export default async function ContactPage() {
  const store = await getStoreInfo();
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question.");
  const place = [store?.address, store?.city].filter(Boolean).join(", ");
  const map = place ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}` : null;
  const phones = [store?.phone, store?.secondaryPhone].filter((value): value is string => !!value);
  const hasDetails = !!(phones.length || store?.email || place);
  return (
    <section className="sf-information-page">
      <p className="sf-eyebrow">Restons en contact</p>
      <h1>À votre écoute.</h1>
      <p className="sf-information-lead">
        Une question sur un produit, une commande ou une livraison ? Le plus rapide est WhatsApp.
      </p>
      {hasDetails ? (
        <div className="sf-contact-grid">
          {whatsapp && (
            <a className="sf-contact-card sf-contact-primary" href={whatsapp} target="_blank" rel="noopener noreferrer">
              <span className="sf-contact-label">WhatsApp</span>
              <strong>Écrire au magasin</strong>
              <span>Réponse rapide pendant les heures d’ouverture</span>
            </a>
          )}
          {phones.map((phone) => (
            <a key={phone} className="sf-contact-card" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
              <span className="sf-contact-label">Téléphone</span>
              <strong dir="ltr">{displayPhone(phone)}</strong>
              <span>Appel direct</span>
            </a>
          ))}
          {place && (
            <a className="sf-contact-card" href={map!} target="_blank" rel="noopener noreferrer">
              <span className="sf-contact-label">Adresse</span>
              <strong><bdi>{place}</bdi></strong>
              <span>Voir sur la carte ↗</span>
            </a>
          )}
          <div className="sf-contact-card">
            <span className="sf-contact-label">Horaires</span>
            {shopContent.openingHours.map((row) => <strong key={row.days} className="sf-contact-hours">{row.hours}</strong>)}
            <span>{shopContent.openingHours.map((row) => row.days).join(" · ")}</span>
          </div>
          {store?.email && (
            <a className="sf-contact-card" href={`mailto:${store.email}`}>
              <span className="sf-contact-label">Email</span>
              <strong>{store.email}</strong>
              <span>Pour les demandes détaillées</span>
            </a>
          )}
        </div>
      ) : (
        <div className="sf-information-note">
          <h2>Les coordonnées de la boutique</h2>
          <p>Les coordonnées seront bientôt disponibles sur cette page.</p>
        </div>
      )}
      <Link href="/shop#products" className="sf-button">
        Consulter nos produits ↗
      </Link>
    </section>
  );
}
