"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { SloumaStamp } from "@/components/brand/slouma-logo";
import { apiBase } from "@/lib/api-base";
import { displayPhone, isStoreInfo, whatsappLink, type StoreInfo } from "@/lib/store-info";
import { shopContent } from "@/lib/shop-content";
import "./site-footer.css";

const shop = [["/shop#products", "Tous les produits"], ["/shop/suivi", "Suivre ma commande"], ["/shop/profile", "Mon compte"]] as const;
const help = [["/shop/faq", "Questions fréquentes"], ["/shop/livraison", "Livraison et paiement"], ["/shop/about", "Notre histoire"], ["/shop/contact", "Contact"]] as const;
const legal = [["/shop/cgv", "Conditions de vente"], ["/shop/confidentialite", "Confidentialité"]] as const;

/** Site footer: brand, links, opening hours, contact from Paramètres > Boutique. */
export default function SiteFooter() {
  const [store, setStore] = useState<StoreInfo | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/public/store-info`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => { if (isStoreInfo(value)) setStore(value); })
      .catch(() => { /* Contact block simply stays without phone. */ });
    return () => controller.abort();
  }, []);
  const whatsapp = whatsappLink(store?.phone, "Bonjour, j’ai une question.");
  const place = [store?.address, store?.city].filter(Boolean).join(", ");
  return (
    <footer className="site-footer">
      <div className="site-footer-band">
        <div className="site-footer-inner site-footer-cta">
          <p><span lang="ar" dir="rtl" className="site-footer-ask">اسأل سلومة</span> Une question sur une plante ou une recette ? Nous répondons à tout.</p>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="site-footer-button">Écrire sur WhatsApp</a> : <Link href="/shop/contact" className="site-footer-button">Nous contacter</Link>}
        </div>
      </div>
      <div className="site-footer-inner site-footer-grid">
        <div className="site-footer-brand">
          <SloumaStamp size={112} tone="cream" />
          <p>Herboristerie à Ghannouch, Gabès. {shopContent.tagline}.</p>
        </div>
        <nav aria-label="Boutique"><h2>Boutique</h2>{shop.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
        <nav aria-label="Aide"><h2>Aide</h2>{help.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
        <div>
          <h2>Nous trouver</h2>
          {store?.phone && <a href={`tel:${store.phone.replace(/[^\d+]/g, "")}`} dir="ltr" className="site-footer-phone">{displayPhone(store.phone)}</a>}
          {place && <p><bdi>{place}</bdi></p>}
          {shopContent.openingHours.map((row) => <p key={row.days}>{row.days}<br />{row.hours}</p>)}
        </div>
      </div>
      <div className="site-footer-inner site-footer-bottom">
        <span>© {new Date().getFullYear()} <span lang="ar" dir="rtl">دار سلومة</span> · Ghannouch, Gabès</span>
        <nav aria-label="Informations légales">{legal.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
      </div>
    </footer>
  );
}
