"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import StoreName from "@/components/store-name";
import { useCart } from "../cart-provider";
import { useCustomerAuth } from "../customer-auth-provider";
import { LeafIcon } from "./visuals";
import styles from "./public-header.module.css";
import NeedsDrawer from './needs-drawer';

const links = [
  ["/shop", "Accueil"],
  ["/shop/about", "À propos"],
  ["/shop/contact", "Contact"],
] as const;
function Icon({ kind }: { kind: "search" | "cart" | "user" | "menu" | "logout" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "search" ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 5 5" />
        </>
      ) : kind === "cart" ? (
        <>
          <path d="M3 3h2l2.5 12h11l2-8H6" />
          <circle cx="9" cy="20" r="1" />
          <circle cx="18" cy="20" r="1" />
        </>
      ) : kind === "user" ? (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      ) : kind === "logout" ? (
        <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>
      ) : (
        <path d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}
export default function PublicHeader() {
  const pathname = usePathname(),
    cart = useCart(),
    auth = useCustomerAuth();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const menu = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLElement>(null),
    account = useRef<HTMLDetailsElement>(null);
  const firstName =
    auth.customer?.fullName?.trim().split(/\s+/)[0] || "Mon compte";
  const active = (href: string) =>
    pathname === href;
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (account.current && !account.current.contains(e.target as Node))
        account.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await auth.logout();
      setOpen(false);
      menu.current?.focus();
    } catch (failure: unknown) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Déconnexion impossible. Réessayez.",
      );
    } finally {
      setBusy(false);
    }
  }
  const signOut = (
    <button className={`${styles.accountRow} ${styles.logoutRow}`} type="button" disabled={busy} onClick={() => void logout()}>
      <Icon kind="logout" />
      {busy ? "Déconnexion..." : "Se déconnecter"}
    </button>
  );
  const accountContent = <>
    <Link href="/shop/profile" className={styles.accountSummary}>
      <span className={styles.avatar}><Icon kind="user" /></span>
      <div><p className={styles.customerName}><bdi>{auth.customer?.fullName || "Mon compte"}</bdi></p><p className={styles.email}><bdi>{auth.customer?.email}</bdi></p></div>
    </Link>
    <div className={styles.accountRows}>
      {signOut}
    </div>
  </>;
  return (
    <header
      className={styles.header}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        if (account.current?.open) {
          account.current.open = false;
          account.current.querySelector("summary")?.focus();
        }
        if (open) {
          setOpen(false);
          menu.current?.focus();
        }
      }}
    >
      <div className={styles.row}>
        <div className={styles.brandGroup}>
          <NeedsDrawer />
        <Link href="/shop" className={styles.brand}>
          <span className={styles.logo}>
            <LeafIcon />
          </span>
          <span className={styles.identity}>
            <strong>
              <StoreName />
            </strong>
            <small>La nature au quotidien</small>
          </span>
        </Link>
        </div>
        <nav className={styles.desktopNav} aria-label="Boutique">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <Link
            href="/shop/cart"
            className={styles.cart}
            aria-label={`Panier${cart.hydrated ? ` (${cart.items.length})` : ""}`}
          >
            <Icon kind="cart" />
            <span className={styles.cartLabel}>Panier</span>
            <span className={styles.badge} aria-hidden="true">
              {cart.hydrated ? cart.items.length : "…"}
            </span>
          </Link>
          {auth.customer && (
            <details ref={account} className={styles.account}>
              <summary aria-label={`Compte client : ${firstName}`}>
                <Icon kind="user" />
                <bdi>{firstName}</bdi>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className={styles.dropdown}>{accountContent}</div>
            </details>
          )}
          <button
            ref={menu}
            className={styles.menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="shop-mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => {
              setOpen(!open);
              if (!open)
                requestAnimationFrame(() =>
                  panel.current?.querySelector("a")?.focus(),
                );
            }}
          >
            <Icon kind="menu" />
          </button>
        </div>
      </div>
      <nav
        ref={panel}
        id="shop-mobile-menu"
        className={styles.mobileNav}
        hidden={!open}
        aria-label="Boutique mobile"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
        {auth.customer && (
          <div className={styles.mobileAccount}>{accountContent}</div>
        )}
      </nav>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </header>
  );
}
