import type { Metadata } from "next";
import Link from "next/link";
import { displayPhone, getStoreInfo, whatsappLink } from "@/lib/store-info";
import { shopContent } from "@/lib/shop-content";
import "../info-pages.css";
import "./contact.css";
import PageHero from "../storefront/page-hero";
import OpenStatus from "../storefront/open-status";
import ShopMap from "../storefront/shop-map";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Téléphone, WhatsApp et adresse de la boutique. Une question sur une recette ou une commande ? Écrivez-nous.",
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export default async function ContactPage() {
  const store = await getStoreInfo();
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question.");
  const place = [store?.address, store?.city].filter(Boolean).join(", ");
  const phones = [store?.phone, store?.secondaryPhone].filter((value): value is string => !!value);
  return (
    <div className="ip">
      <PageHero
        ar="تحب تسأل؟ احنا هنا"
        eyebrow="Contact"
        title="À votre écoute"
        lead="Une question sur une recette, une commande ou une livraison ? Le plus rapide, c’est WhatsApp."
      />
      <div className="ct-grid">
        {whatsapp && (
          <a
            className="ct-card ct-whatsapp"
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            style={{ "--i": 0 } as React.CSSProperties}
          >
            <span className="ct-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"
                />
              </svg>
            </span>
            <span className="ct-label">WhatsApp</span>
            <strong>Écrire au magasin</strong>
            <span className="ct-sub">Réponse rapide pendant les heures d’ouverture</span>
            <span className="ct-go" aria-hidden="true">
              →
            </span>
          </a>
        )}
        {phones.map((phone, index) => (
          <a
            key={phone}
            className="ct-card"
            href={`tel:${phone.replace(/[^\d+]/g, "")}`}
            style={{ "--i": index + 1 } as React.CSSProperties}
          >
            <span className="ct-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"
                  {...stroke}
                />
              </svg>
            </span>
            <span className="ct-label">Téléphone</span>
            <strong dir="ltr">{displayPhone(phone)}</strong>
            <span className="ct-sub">Appel direct</span>
          </a>
        ))}
        <div className="ct-card ct-hours" style={{ "--i": 3 } as React.CSSProperties}>
          <span className="ct-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="8.5" {...stroke} />
              <path d="M12 7.5V12l3 2" {...stroke} />
            </svg>
          </span>
          <span className="ct-label">Horaires</span>
          {shopContent.openingHours.map((row) => (
            <strong key={row.days}>{row.hours}</strong>
          ))}
          <span className="ct-sub">{shopContent.openingHours.map((row) => row.days).join(" · ")}</span>
          <OpenStatus />
        </div>
        {store?.email && (
          <a className="ct-card" href={`mailto:${store.email}`} style={{ "--i": 5 } as React.CSSProperties}>
            <span className="ct-icon">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" {...stroke} />
                <path d="m4 7 8 6 8-6" {...stroke} />
              </svg>
            </span>
            <span className="ct-label">Email</span>
            <strong>{store.email}</strong>
            <span className="ct-sub">Pour les demandes détaillées</span>
          </a>
        )}
      </div>
      <ShopMap address={place} />
      <aside className="ip-cta">
        <div>
          <p lang="ar" dir="rtl" className="ip-cta-ar">
            ما عرفتش شنوّة تختار؟
          </p>
          <h2>Dites-nous ce que vous cherchez</h2>
          <p>Slouma vous conseille la recette adaptée à votre objectif, gratuitement.</p>
        </div>
        <Link href="/shop#needs-title" className="ip-btn">
          Voir les objectifs <span aria-hidden="true">→</span>
        </Link>
      </aside>
    </div>
  );
}
