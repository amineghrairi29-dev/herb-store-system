"use client";
import { usePathname } from "next/navigation";
import PublicHeader from "./public-header";
import SiteFooter from "./site-footer";
import WhatsAppButton from "./whatsapp-button";
import "./announcement.css";

// Pages already restyled on the new storefront layout; the others keep their own container until their turn.
const redesignedPages = ["/shop", "/shop/about", "/shop/contact", "/shop/suivi", "/shop/faq", "/shop/livraison", "/shop/cgv", "/shop/confidentialite"];
const messages = ["Livraison à domicile", "Paiement à la réception", "Conseil gratuit sur WhatsApp"];

function Announcement() {
  return (
    <div className="sf-announce" role="note" aria-label={messages.join(" · ")}>
      {/* Desktop: all three in a row. Phone: they take turns (CSS animation). */}
      <div className="sf-announce-track" aria-hidden="true">
        {messages.map((message) => <span key={message}>{message}</span>)}
      </div>
    </div>
  );
}

export default function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authPage = pathname === "/shop/auth" || pathname === "/auth";
  const redesigned = redesignedPages.includes(pathname);
  return (
    <div className={redesigned ? (pathname === "/shop" ? "storefront storefront-home" : "storefront") : "sf-legacy"} lang="fr">
      <a className="sf-skip" href="#shop-main">Aller au contenu</a>
      {!authPage && <Announcement />}
      {!authPage && <PublicHeader key={pathname} />}
      <main id="shop-main" className={redesigned ? (pathname === "/shop" ? "" : "sf-container sf-inner-page") : "sf-legacy-main"}>
        {children}
      </main>
      {!authPage && <SiteFooter />}
      {!authPage && <WhatsAppButton />}
    </div>
  );
}
