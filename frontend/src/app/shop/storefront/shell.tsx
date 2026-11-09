"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import StoreName from "@/components/store-name";
import PublicHeader from "./public-header";
import "./footer.css";
import { LeafIcon } from "./visuals";

const links = [
  ["/shop", "Accueil"],
  ["/shop/about", "À propos"],
  ["/shop/contact", "Contact"],
] as const;
export default function StorefrontShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const redesigned = links.some(([href]) => href === pathname);
  // Preserve the original visual shell for routes awaiting their design review.
  if (!redesigned)
    return (
      <div lang="fr" className="min-h-screen bg-[#fafaf7] text-stone-800">
        {pathname !== "/shop/auth" && pathname !== "/auth" && <PublicHeader key={pathname} />}
        <main className="mx-auto max-w-7xl px-5 py-8 sm:py-12">{children}</main>
        <footer className="mx-auto max-w-7xl px-5 py-8 text-sm text-stone-500">
          Notre catalogue · Commandes soumises à confirmation du magasin
        </footer>
      </div>
    );
  return (
    <div
      className={
        pathname === "/shop" ? "storefront storefront-home" : "storefront"
      }
      lang="fr"
    >
      <a className="sf-skip" href="#shop-main">
        Aller au contenu
      </a>
      <div className="sf-announcement">
        Une sélection de nature, pour chaque jour.
      </div>
      <PublicHeader key={pathname} />
      <main
        id="shop-main"
        className={pathname === "/shop" ? "" : "sf-container sf-inner-page"}
      >
        {children}
      </main>
      <footer className="sf-footer">
        <div className="sf-container sf-footer-grid">
          <div>
            <Link href="/shop" className="sf-footer-brand">
              <LeafIcon />
              <StoreName />
            </Link>
            <p>
              Des plantes et des produits naturels à découvrir, simplement, à
              votre rythme.
            </p>
          </div>
          <div>
            <h2>Liens utiles</h2>
            <nav aria-label="Pied de page">
              {links.map(([href, label]) => (
                <Link href={href} key={href}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div>
            <h2>Informations</h2>
            <p>Une question sur notre boutique ou un produit ?</p>
            <Link href="/shop/contact" className="sf-footer-contact">
              Restons en contact ↗
            </Link>
            <p className="sf-footer-note">
              Commandes soumises à confirmation du magasin.
            </p>
          </div>
        </div>
        <div className="sf-container sf-footer-bottom">
          <span>
            © {new Date().getFullYear()} <StoreName />
          </span>
          <span>Le naturel, tout simplement.</span>
        </div>
      </footer>
    </div>
  );
}
