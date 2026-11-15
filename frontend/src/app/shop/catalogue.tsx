"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { apiBase } from "@/lib/api-base";
import type { Availability, CatalogueResponse, PublicClassification } from "@/types/public-product";
import ProductCard from "./product-card";
import { Leaf } from "./storefront/leaf";

const availabilityChoices: { value: "" | Availability; label: string }[] = [
  { value: "", label: "Tout" },
  { value: "IN_STOCK", label: "Disponible" },
  { value: "LOW_STOCK", label: "Stock limité" },
];
const sorts = [["name_asc", "Nom : A à Z"], ["name_desc", "Nom : Z à A"], ["price_asc", "Prix croissant"], ["price_desc", "Prix décroissant"]] as const;

/** Page numbers to show: first, last, and two around the current one. */
function pageList(current: number, last: number): (number | "…")[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((page) => page >= 1 && page <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, index) => (index && page - sorted[index - 1] > 1 ? ["…" as const, page] : [page]));
}

/**
 * Products of one need, with search, availability and sort. Filters change the URL
 * (so a filtered page can be shared) without reloading; the previous results stay
 * visible, dimmed, until the new ones arrive.
 */
export default function Catalogue({ query, need, whatsapp }: { query: string; need: PublicClassification; whatsapp: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const params = new URLSearchParams(query);
  const route = `/shop/besoins/${encodeURIComponent(need.slug)}`;
  const [result, setResult] = useState<CatalogueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState(params.get("q") ?? "");
  const top = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const search = new URLSearchParams(query);
    search.set("classification", need.slug);
    if (!search.get("pageSize")) search.set("pageSize", "12");
    fetch(`${apiBase}/public/products?${search}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`); return await response.json() as CatalogueResponse; })
      .then((data) => { if (!controller.signal.aborted) setResult(data); })
      .catch((failure: unknown) => { if (!controller.signal.aborted) { console.error("Catalogue request failed", failure); setError(true); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, retry, need.slug]);

  // After a filter or a page change, bring the toolbar back into view (not on first load).
  useEffect(() => {
    if (firstLoad.current) { firstLoad.current = false; return; }
    const box = top.current?.getBoundingClientRect();
    if (box && box.top < 0) top.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  }, [query]);

  function go(changes: Record<string, string | null>) {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    if (!("page" in changes)) next.delete("page");
    const text = next.toString();
    startTransition(() => router.replace(text ? `${route}?${text}` : route, { scroll: false }));
  }
  const pageHref = (page: number) => { const next = new URLSearchParams(query); if (page > 1) next.set("page", String(page)); else next.delete("page"); const text = next.toString(); return `${route}${text ? `?${text}` : ""}#nd-results`; };

  const availability = params.get("availability") ?? "";
  const sort = params.get("sort") ?? "name_asc";
  const filtered = !!(params.get("q")?.trim() || availability);
  const busy = pending || (loading && !!result);
  const total = result?.pagination.totalItems ?? 0;
  const current = result?.pagination.page ?? 1;
  const last = Math.max(1, result?.pagination.totalPages ?? 1);

  return (
    <section className="nd-catalogue" aria-labelledby="nd-results-title">
      <div ref={top} id="nd-results" className="nd-toolbar">
        <h2 id="nd-results-title" className="sr-only">Produits : {need.nameFr}</h2>
        <form role="search" className="nd-search" onSubmit={(event) => { event.preventDefault(); go({ q: search.trim() || null }); }}>
          <label htmlFor="nd-search" className="sr-only">Rechercher dans ce besoin</label>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input id="nd-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Chercher une plante…" maxLength={200} />
          <button type="submit">Chercher</button>
        </form>
        <div className="nd-filters" role="group" aria-label="Disponibilité">
          {availabilityChoices.map((choice) => (
            <button key={choice.value || "all"} type="button" className="nd-filter" aria-pressed={availability === choice.value} onClick={() => go({ availability: choice.value || null })}>{choice.label}</button>
          ))}
        </div>
        <label className="nd-sort">
          <span className="sr-only">Trier par</span>
          <select value={sort} onChange={(event) => go({ sort: event.target.value === "name_asc" ? null : event.target.value })}>
            {sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <p className="nd-count" role="status" aria-live="polite">
        {result && !error ? <>{total === 1 ? "1 produit" : `${total} produits`}{params.get("q") ? <> pour « <bdi>{params.get("q")}</bdi> »</> : null}</> : null}
        {filtered && <button type="button" className="nd-reset" onClick={() => { setSearch(""); go({ q: null, availability: null }); }}>Effacer les filtres ×</button>}
      </p>

      {error ? (
        <div role="alert" className="nd-empty">
          <p>Impossible de charger les produits pour le moment.</p>
          <button type="button" className="nd-btn" onClick={() => setRetry((value) => value + 1)}>Réessayer</button>
        </div>
      ) : !result ? (
        <div className="nd-grid" role="status" aria-label="Chargement des produits">{Array.from({ length: 8 }, (_, index) => <div key={index} className="nd-skeleton" />)}</div>
      ) : !result.data.length ? (
        <div className="nd-empty">
          <span className="nd-empty-leaf" aria-hidden="true"><Leaf color="#A9C68F" /></span>
          <p className="nd-empty-title">{filtered ? "Aucun produit ne correspond à ces filtres." : "Les produits de ce besoin arrivent bientôt."}</p>
          <p>Slouma a sûrement une recette pour vous : demandez-lui directement.</p>
          <div className="nd-empty-actions">
            {filtered && <button type="button" className="nd-btn nd-btn-line" onClick={() => { setSearch(""); go({ q: null, availability: null }); }}>Effacer les filtres</button>}
            {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="nd-btn">Demander sur WhatsApp</a> : <Link href="/shop/contact" className="nd-btn">Nous contacter</Link>}
          </div>
        </div>
      ) : (
        <>
          <div className={`nd-grid${busy ? " nd-busy" : ""}`} aria-busy={busy}>
            {result.data.map((product, index) => <div key={product.id} className="nd-card-in" style={{ "--i": index } as React.CSSProperties}><ProductCard product={product} /></div>)}
          </div>
          {last > 1 && (
            <nav className="nd-pages" aria-label="Pages">
              {current > 1 ? <Link href={pageHref(current - 1)} className="nd-page nd-page-step" scroll={false} rel="prev"><span aria-hidden="true">←</span><span className="sr-only">Page précédente</span></Link> : <span className="nd-page nd-page-step" aria-hidden="true">←</span>}
              {pageList(current, last).map((page, index) => page === "…" ? <span key={`gap${index}`} className="nd-page-gap" aria-hidden="true">…</span> : (
                <Link key={page} href={pageHref(page)} scroll={false} className="nd-page" aria-current={page === current ? "page" : undefined}><span className="sr-only">Page </span>{page}</Link>
              ))}
              {current < last ? <Link href={pageHref(current + 1)} className="nd-page nd-page-step" scroll={false} rel="next"><span aria-hidden="true">→</span><span className="sr-only">Page suivante</span></Link> : <span className="nd-page nd-page-step" aria-hidden="true">→</span>}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
