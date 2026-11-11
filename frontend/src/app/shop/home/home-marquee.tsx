const items = ["Recettes éprouvées depuis 2006", "Conseil gratuit pour chaque question", "Paiement à la réception", "Dès 100 g", "Préparé à Ghannouch, Gabès", "Livraison à domicile"];
/** Ribbon that scrolls endlessly; the list is drawn twice so the loop has no gap. */
export default function HomeMarquee() {
  return (
    <section className="h-marquee" aria-label={items.join(" · ")}>
      <div className="h-marquee-track" aria-hidden="true">
        {[0, 1].map((copy) => <div key={copy} className="h-marquee-group">{items.map((item) => <span key={item}>{item}<i>✦</i></span>)}</div>)}
      </div>
    </section>
  );
}
