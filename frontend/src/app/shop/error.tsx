"use client";
import Link from "next/link";
import StatePage from "./storefront/state-page";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <StatePage
      art="mortar"
      role="alert"
      ar="صار مشكل صغير"
      title="Un souci de notre côté"
      text="La page n’a pas pu s’afficher. Réessayez dans un instant ; si cela continue, appelez-nous ou écrivez-nous sur WhatsApp."
    >
      <button type="button" onClick={reset} className="sp-btn sp-btn-honey">
        Réessayer
      </button>
      <Link href="/shop" className="sp-btn sp-btn-line">
        Retour à l’accueil
      </Link>
      <Link href="/shop/contact" className="sp-btn sp-btn-line">
        Nous contacter
      </Link>
    </StatePage>
  );
}
