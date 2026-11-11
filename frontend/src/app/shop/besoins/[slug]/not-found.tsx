import Link from "next/link";
import "../needs.css";

export default function NeedNotFound() {
  return (
    <div className="nd">
      <section className="nd-missing" aria-labelledby="nd-missing-title">
        <p lang="ar" dir="rtl" className="nd-ar">ما لقيناهاش</p>
        <h1 id="nd-missing-title">Ce besoin n’existe pas (ou plus)</h1>
        <p>Le lien est peut-être ancien. Choisissez un besoin depuis l’accueil, ou cherchez directement une plante.</p>
        <div className="nd-empty-actions">
          <Link href="/shop#needs-title" className="nd-btn">Voir les besoins</Link>
          <Link href="/shop#products" className="nd-btn nd-btn-line">Tous les produits</Link>
        </div>
      </section>
    </div>
  );
}
