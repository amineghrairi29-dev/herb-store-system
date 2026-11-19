"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SloumaIcon, SloumaStamp } from "@/components/brand/slouma-logo";
import { useCart } from "../cart-provider";
import { useCustomerAuth } from "../customer-auth-provider";
import styles from "./public-header.module.css";
import { apiBase } from "@/lib/api-base";
import { isStoreInfo, whatsappLink } from "@/lib/store-info";
import type { CatalogueResponse, PublicClassification } from "@/types/public-product";
import { needTint } from "../besoins/need-tints";

const links = [
  ["/shop#products", "Recettes"],
  ["/shop/about", "Notre histoire"],
  ["/shop/faq", "Questions"],
  ["/shop/contact", "Contact"],
] as const;

function Icon({ kind }: { kind: "search" | "cart" | "user" | "menu" | "close" | "logout" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
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
          <path d="M6 7h12l-1 13H7L6 7Z" />
          <path d="M9 7a3 3 0 0 1 6 0" />
        </>
      ) : kind === "user" ? (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </>
      ) : kind === "logout" ? (
        <path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" />
      ) : kind === "close" ? (
        <path d="M6 6l12 12M18 6 6 18" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h10" />
      )}
    </svg>
  );
}

function Search({ id }: { id: string }) {
  return (
    <form role="search" action="/shop" method="get" className={styles.search}>
      <label htmlFor={id} className={styles.srOnly}>
        Rechercher une recette
      </label>
      <Icon kind="search" />
      <input id={id} name="q" type="search" placeholder="Digestion, sommeil, menthe…" autoComplete="off" />
    </form>
  );
}

export default function PublicHeader() {
  const pathname = usePathname(),
    cart = useCart(),
    auth = useCustomerAuth();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [scrolled, setScrolled] = useState(false);
  // Phone menu content, loaded the first time it opens: objectives (with recipe counts) and WhatsApp.
  const [needs, setNeeds] = useState<(PublicClassification & { count: number })[] | null>(null),
    [whatsapp, setWhatsapp] = useState<string | null>(null),
    loaded = useRef(false);
  const menu = useRef<HTMLButtonElement>(null),
    panel = useRef<HTMLDivElement>(null),
    account = useRef<HTMLDetailsElement>(null);
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
    const close = (event: PointerEvent) => {
      if (account.current && !account.current.contains(event.target as Node)) account.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  function loadMenu() {
    if (loaded.current) return;
    loaded.current = true;
    fetch(`${apiBase}/public/classifications?withProducts=true`)
      .then((response) => (response.ok ? (response.json() as Promise<PublicClassification[]>) : []))
      .then((list) =>
        Promise.all(
          list.slice(0, 12).map(async (need) => {
            try {
              const params = new URLSearchParams({ classification: need.slug, pageSize: "1", page: "1" });
              const response = await fetch(`${apiBase}/public/products?${params}`);
              const result = response.ok ? ((await response.json()) as CatalogueResponse) : null;
              return { ...need, count: result?.pagination.totalItems ?? 0 };
            } catch {
              return { ...need, count: 0 };
            }
          }),
        ),
      )
      .then(setNeeds)
      .catch(() => setNeeds([]));
    fetch(`${apiBase}/public/store-info`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value: unknown) => {
        if (isStoreInfo(value))
          setWhatsapp(whatsappLink(value.phone, "Bonjour, je cherche un conseil pour une recette."));
      })
      .catch(() => {});
  }

  async function logout() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await auth.logout();
      setOpen(false);
      menu.current?.focus();
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : "Déconnexion impossible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  const accountContent = (
    <>
      <Link href="/shop/profile" className={styles.accountSummary}>
        <span className={styles.avatar}>
          <Icon kind="user" />
        </span>
        <span>
          <span className={styles.customerName}>
            <bdi>{auth.customer?.fullName || "Mon compte"}</bdi>
          </span>
          <span className={styles.email}>
            <bdi>{auth.customer?.email}</bdi>
          </span>
        </span>
      </Link>
      <Link href="/shop/profile" className={styles.accountRow}>
        Mes commandes
      </Link>
      <button
        className={`${styles.accountRow} ${styles.logoutRow}`}
        type="button"
        disabled={busy}
        onClick={() => void logout()}
      >
        <Icon kind="logout" />
        {busy ? "Déconnexion…" : "Se déconnecter"}
      </button>
    </>
  );

  return (
    <header
      className={styles.header}
      data-scrolled={scrolled || undefined}
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
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
          <Link href="/shop" className={styles.brand} aria-label="Dar Slouma, accueil">
            <SloumaStamp size={64} className={styles.stamp} />
            <SloumaIcon size={42} className={styles.icon} />
            <span className={styles.identity}>
              <span lang="ar" dir="rtl" className={styles.arabicName}>
                دار سلومة
              </span>
            </span>
          </Link>
        </div>
        <nav className={styles.desktopNav} aria-label="Boutique">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div className={styles.actions}>
          <div className={styles.desktopSearch}>
            <Search id="shop-search" />
          </div>
          {auth.customer ? (
            <details ref={account} className={styles.account}>
              <summary aria-label={`Compte client : ${firstName}`}>
                <Icon kind="user" />
                <bdi className={styles.accountLabel}>{firstName}</bdi>
              </summary>
              <div className={styles.dropdown}>{accountContent}</div>
            </details>
          ) : (
            <Link href="/shop/auth" className={styles.iconButton} aria-label="Se connecter">
              <Icon kind="user" />
            </Link>
          )}
          <Link
            href="/shop/cart"
            data-cart-target
            className={styles.cart}
            aria-label={`Panier${cart.hydrated ? `, ${count} article${count > 1 ? "s" : ""}` : ""}`}
          >
            <Icon kind="cart" />
            <span className={styles.cartLabel}>Panier</span>
            {/* key restarts the bounce animation each time the count changes */}
            <span key={count} className={styles.badge} data-empty={count === 0 || undefined} aria-hidden="true">
              {cart.hydrated ? count : "·"}
            </span>
          </Link>
          <button
            ref={menu}
            className={styles.menuButton}
            type="button"
            aria-expanded={open}
            aria-controls="shop-mobile-menu"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => {
              setOpen(!open);
              if (!open) loadMenu();
            }}
          >
            <Icon kind={open ? "close" : "menu"} />
          </button>
        </div>
      </div>
      <div
        ref={panel}
        id="shop-mobile-menu"
        className={styles.mobilePanel}
        data-open={open || undefined}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("a")) setOpen(false);
        }}
      >
        <Search id="shop-search-mobile" />
        <p lang="ar" dir="rtl" className={styles.mobileAr}>
          شنوّة تحب تداوي؟
        </p>
        <p className={styles.mobileTitle}>Nos objectifs</p>
        {needs === null ? (
          <div className={styles.mobileNeeds} aria-hidden="true">
            {[0, 1, 2, 3].map((key) => (
              <span key={key} className={styles.needSkeleton} />
            ))}
          </div>
        ) : (
          needs.length > 0 && (
            <ul className={styles.mobileNeeds}>
              {needs.map((need, index) => {
                const [bg, ink] = needTint(index);
                return (
                  <li key={need.id} style={{ animationDelay: `${40 + index * 40}ms` }}>
                    <Link
                      href={`/shop/besoins/${encodeURIComponent(need.slug)}`}
                      className={styles.needTile}
                      style={{ "--tile": bg, "--tile-ink": ink } as React.CSSProperties}
                    >
                      <span lang="ar" dir="rtl" className={styles.needAr}>
                        {need.nameAr}
                      </span>
                      <span className={styles.needFr}>
                        <bdi>{need.nameFr}</bdi>
                      </span>
                      {need.count > 0 && (
                        <span className={styles.needCount}>
                          {need.count} recette{need.count > 1 ? "s" : ""} →
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        )}
        <nav aria-label="Boutique mobile" className={styles.mobileNav}>
          {(
            [
              ["/shop#products", "Toutes les recettes"],
              ["/shop/suivi", "Suivre ma commande"],
              ["/shop/about", "Notre histoire"],
              ["/shop/faq", "Questions"],
              ["/shop/contact", "Contact"],
            ] as const
          ).map(([href, label], index) => (
            <Link
              key={href}
              href={href}
              style={{ animationDelay: `${120 + index * 50}ms` }}
              aria-current={active(href) ? "page" : undefined}
            >
              {label}
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </nav>
        {auth.customer ? (
          <div className={styles.mobileAccount}>{accountContent}</div>
        ) : (
          <Link href="/shop/auth" className={styles.mobileLogin}>
            <Icon kind="user" />
            Se connecter
          </Link>
        )}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={styles.mobileWhatsapp}>
            Demander conseil sur WhatsApp
          </a>
        )}
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </header>
  );
}
