import Link from "next/link";
import StoreName from "@/components/store-name";
export default function ContactPage() {
  return (
    <section className="sf-information-page">
      <p className="sf-eyebrow">Restons en contact</p>
      <h1>À votre écoute.</h1>
      <p className="sf-information-lead">
        Une question pour <StoreName /> ?
      </p>
      <p>
        Pour en savoir plus sur un produit, consultez sa fiche dans notre
        catalogue. Pour une commande, vous pouvez laisser une précision dans les
        notes au moment de la transmettre au magasin.
      </p>
      <div className="sf-information-note">
        <h2>Les coordonnées de la boutique</h2>
        <p>
          Les coordonnées publiques ne sont pas encore disponibles sur cette
          page.
        </p>
      </div>
      <Link href="/shop#products" className="sf-button">
        Consulter nos produits ↗
      </Link>
    </section>
  );
}
