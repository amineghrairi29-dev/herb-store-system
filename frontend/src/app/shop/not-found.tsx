import Link from "next/link";
import StatePage from "./storefront/state-page";

export default function NotFound() {
  return (
    <StatePage
      art="jar"
      code="Erreur 404"
      ar="ما لقيناهاش"
      title="Cette page s’est égarée"
      text="Le lien est peut-être ancien ou mal recopié. Les recettes, elles, sont toujours là."
    >
      <Link href="/shop" className="sp-btn">
        Retour à l’accueil
      </Link>
      <Link href="/shop#needs-title" className="sp-btn sp-btn-line">
        Choisir par objectif
      </Link>
      <Link href="/shop/contact" className="sp-btn sp-btn-line">
        Nous contacter
      </Link>
    </StatePage>
  );
}
