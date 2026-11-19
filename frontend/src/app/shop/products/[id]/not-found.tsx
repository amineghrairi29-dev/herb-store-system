import Link from "next/link";
import StatePage from "../../storefront/state-page";

export default function RecipeNotFound() {
  return (
    <StatePage
      art="jar"
      ar="الوصفة هاذي ما عادش موجودة"
      title="Cette recette n’est plus en ligne"
      text="Elle a peut-être été retirée ou renommée. Choisissez une recette pour le même objectif, ou demandez-nous conseil."
    >
      <Link href="/shop#needs-title" className="sp-btn">
        Choisir par objectif
      </Link>
      <Link href="/shop#products" className="sp-btn sp-btn-line">
        Toutes les recettes
      </Link>
      <Link href="/shop/contact" className="sp-btn sp-btn-line">
        Nous contacter
      </Link>
    </StatePage>
  );
}
