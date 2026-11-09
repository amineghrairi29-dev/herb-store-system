import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import HomeSelection from "./storefront/home-selection";
import { LeafIcon } from "./storefront/visuals";
import CinematicHero from "./storefront/cinematic-hero";
export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  if (
    [
      "q",
      "classification",
      "category",
      "subcategory",
      "availability",
      "sort",
      "page",
      "pageSize",
    ].some((key) => params[key] !== undefined)
  ) {
    redirect("/shop#products");
  }
  return (
    <>
      <CinematicHero>
      <section className="sf-container sf-hero sf-hero-banner">
        <div className="sf-hero-copy">
          <p className="sf-eyebrow sf-top-enter">
            <span aria-hidden="true">✧</span> Naturellement pour votre bien-être
          </p>
          <h1 className="sf-top-enter">
            Découvrez le pouvoir des <em>plantes naturelles.</em>
          </h1>
          <p className="sf-hero-description sf-top-enter">
            Des herbes, thés et produits naturels sélectionnés avec soin pour
            votre bien-être au quotidien.
          </p>
          <div className="sf-hero-actions sf-top-enter">
            <Link href="/shop#products" className="sf-button">
              Découvrir notre catalogue <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
        <div className="sf-hero-visual">
          <Image
            src="/images/shop/hero/hero-main.png"
            alt="Mortier en pierre, herbes aromatiques et flacon d’huile sur une table claire"
            fill
            preload
            sizes="(max-width: 759px) calc(100vw - 36px), (max-width: 1599px) 60vw, 912px"
            className="sf-hero-image"
          />
        </div>
      </section>
      <div className="sf-container">
        <section
          className="sf-trust"
          aria-label="Les essentiels de notre boutique"
        >
          {[
            ["Produits naturels", "Sélection soignée", "leaf"],
            ["Paiement à la réception", "Simple et pratique", "payment"],
            ["Service client", "À votre écoute", "service"],
          ].map(([title, text, icon]) => (
            <div key={title} className="sf-top-enter">
              <span className="sf-benefit-icon" aria-hidden="true">
                {icon === "leaf" ? (
                  <LeafIcon />
                ) : icon === "payment" ? (
                  "◇"
                ) : (
                  "☏"
                )}
              </span>
              <p>
                <strong>{title}</strong>
                <span>{text}</span>
              </p>
            </div>
          ))}
        </section>
      </div>
      </CinematicHero>
      <HomeSelection />
    </>
  );
}
