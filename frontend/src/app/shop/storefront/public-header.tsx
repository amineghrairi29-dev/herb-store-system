"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SloumaIcon, SloumaStamp } from "@/components/brand/slouma-logo";
import { useCart } from "../cart-provider";
import { useCustomerAuth } from "../customer-auth-provider";
import styles from "./public-header.module.css";
import NeedsDrawer from "./needs-drawer";

const links = [
  ["/shop#products", "Produits"],
  ["/shop/about", "Notre histoire"],
  ["/shop/faq", "Questions"],
  ["/shop/contact", "Contact"],
] as const;

function Icon({ kind }: { kind: "search" | "cart" | "user" | "menu" | "close" | "logout" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {kind === "search" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>
        : kind === "cart" ? <><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></>
        : kind === "user" ? <><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></>
        : kind === "logout" ? <path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" />
        : kind === "close" ? <path d="M6 6l12 12M18 6 6 18" />
        : <path d="M4 7h16M4 12h16M4 17h10" />}
    </svg>
  );
}

function Search({ id }: { id: string }) {
  return (
    <form role="search" action="/shop" method="get" className={styles.search}>
      <label htmlFor={id} className={styles.srOnly}>Rechercher un produit</label>
      <Icon kind="search" />
      <input id={id} name="q" type="search" placeholder="Menthe, verveine, henné…" autoComplete="off" />
    </form>
  );
}

export default function PublicHeader() {
  const pathname = usePathname(), cart = useCart(), auth = useCustomerAuth();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [scrolled, setScrolled] = useState(false);
  const menu = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null), account = useRef<HTMLDetailsElement>(null);
  const firstName = auth.customer?.fullName?.trim().split(/\s+/)[0] || "Mon compte";
  const count = cart.hydrated ? cart.items.length : 0;
  const active = (href: string) => pathname === href.split("#")[0] && !href.includes("#");

  // The header gets compact once the page scrolls: smaller stamp, lighter padding, a shadow.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (account.current && !account.current.contains(event.target as Node)) account.current.open = false; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; };
  }, [open]);

  async function logout() {
    if (busy) return;
    setBusy(true); setError("");
    try { await auth.logout(); setOpen(false); menu.current?.focus(); }
    catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Déconnexion impossible. Réessayez."); }
    finally { setBusy(false); }
  }
  const accountContent = <>
    <Link href="/shop/profile" className={styles.accountSummary}>
      <span className={styles.avatar}><Icon kind="user" /></span>
      <span><span className={styles.customerName}><bdi>{auth.customer?.fullName || "Mon compte"}</bdi></span><span className={styles.email}><bdi>{auth.customer?.email}</bdi></span></span>
    </Link>
    <Link href="/shop/profile" className={styles.accountRow}>Mes commandes</Link>
    <button className={`${styles.accountRow} ${styles.logoutRow}`} type="button" disabled={busy} onClick={() => void logout()}><Icon kind="logout" />{busy ? "Déconnexion…" : "Se déconnecter"}</button>
  </>;

  return (
    <header
      className={styles.header}
      data-scrolled={scrolled || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (account.current?.open) { account.current.open = false; account.current.querySelector("summary")?.focus(); }
        if (open) { setOpen(false); menu.current?.focus(); }
      }}
    >
      <div className={styles.row}>
        <div className={styles.brandGroup}>
          <NeedsDrawer />
          <Link href="/shop" className={styles.brand} aria-label="Dar Slouma, accueil">
            <SloumaStamp size={64} className={styles.stamp} />
            <SloumaIcon size={42} className={styles.icon} />
            <span className={styles.identity}>
              <span lang="ar" dir="rtl" className={styles.arabicName}>دار سلومة</span>
            </span>
          </Link>
        </div>
        <nav className={styles.desktopNav} aria-label="Boutique">
          {links.map(([href, label]) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>{label}</Link>)}
        </nav>
        <div className={styles.actions}>
          <div className={styles.desktopSearch}><Search id="shop-search" /></div>
          {auth.customer ? (
            <details ref={account} className={styles.account}>
              <summary aria-label={`Compte client : ${firstName}`}><Icon kind="user" /><bdi className={styles.accountLabel}>{firstName}</bdi></summary>
              <div className={styles.dropdown}>{accountContent}</div>
            </details>
          ) : (
            <Link href="/shop/auth" className={styles.iconButton} aria-label="Se connecter"><Icon kind="user" /></Link>
          )}
          <Link href="/shop/cart" data-cart-target className={styles.cart} aria-label={`Panier${cart.hydrated ? `, ${count} article${count > 1 ? "s" : ""}` : ""}`}>
            <Icon kind="cart" />
            <span className={styles.cartLabel}>Panier</span>
            {/* key restarts the bounce animation each time the count changes */}
            <span key={count} className={styles.badge} data-empty={count === 0 || undefined} aria-hidden="true">{cart.hydrated ? count : "·"}</span>
          </Link>
          <button ref={menu} className={styles.menuButton} type="button" aria-expanded={open} aria-controls="shop-mobile-menu" aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => { setOpen(!open); if (!open) requestAnimationFrame(() => panel.current?.querySelector("input")?.focus()); }}>
            <Icon kind={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      <div ref={panel} id="shop-mobile-menu" className={styles.mobilePanel} data-open={open || undefined} hidden={!open}
        onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>
        <Search id="shop-search-mobile" />
        <nav aria-label="Boutique mobile" className={styles.mobileNav}>
          {links.map(([href, label], index) => <Link key={href} href={href} style={{ animationDelay: `${60 + index * 50}ms` }} aria-current={active(href) ? "page" : undefined}>{label}<span aria-hidden="true">→</span></Link>)}
          <Link href="/shop/suivi" style={{ animationDelay: "260ms" }}>Suivre ma commande<span aria-hidden="true">→</span></Link>
        </nav>
        {auth.customer ? <div className={styles.mobileAccount}>{accountContent}</div> : <Link href="/shop/auth" className={styles.mobileLogin}>Se connecter</Link>}
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </header>
  );
}
