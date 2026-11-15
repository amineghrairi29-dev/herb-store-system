"use client";
import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/api-base";
import type { CatalogueResponse, PublicProduct } from "@/types/public-product";
import ProductCard from "../product-card";

const PAGE_SIZE = 8;

/** Product section of the home page, with the search used by the header (/shop?q=…). */
export default function HomeProducts({ query }: { query: string }) {
  const [products, setProducts] = useState<PublicProduct[] | null>(null);
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const section = useRef<HTMLElement>(null);
  useEffect(() => { if (query) section.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [query]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE), page: String(page), sort: "name_asc" });
    if (query) params.set("q", query);
    fetch(`${apiBase}/public/products?${params}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      .then(async (response) => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json() as CatalogueResponse; })
      .then((result) => { if (controller.signal.aborted) return; setTotal(result.pagination.totalItems); setProducts((list) => (page === 1 ? result.data : [...(list ?? []), ...result.data])); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, page, attempt]);
  const remaining = products ? total - products.length : 0;
  return (
    <section ref={section} id="products" className="h-section h-products" aria-labelledby="products-title">
      <div className="h-heading">
        <div><p className="h-eyebrow">{query ? "Recherche" : "Notre sélection"}</p><h2 id="products-title">{query ? <>Résultats pour « <bdi>{query}</bdi> »</> : "Nos produits"}</h2></div>
        <form role="search" action="/shop" method="get" className="h-search">
          <label htmlFor="home-search" className="sr-only">Rechercher un produit</label>
          <input id="home-search" name="q" type="search" defaultValue={query} placeholder="Rechercher une plante…" maxLength={200} />
          <button type="submit" className="h-btn h-btn-leaf">Rechercher</button>
        </form>
      </div>
      {error ? (
        <div role="alert" className="h-empty"><p>Nos produits ne sont pas disponibles pour le moment.</p><button type="button" className="h-btn h-btn-line" onClick={() => { setPage(1); setProducts(null); setAttempt((value) => value + 1); }}>Réessayer</button></div>
      ) : !products ? (
        <div className="h-grid" role="status" aria-label="Chargement des produits">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-skeleton" />)}</div>
      ) : !products.length ? (
        <p className="h-empty">{query ? "Aucun produit ne correspond. Essayez un autre mot, ou demandez-nous conseil sur WhatsApp." : "Aucun produit disponible pour le moment."}</p>
      ) : (
        <>
          <div className="h-grid">{products.map((product, index) => <div key={product.id} className="h-card-in" style={{ "--i": index % PAGE_SIZE } as React.CSSProperties}><ProductCard product={product} /></div>)}</div>
          {remaining > 0 && <div className="h-more"><button type="button" className="h-btn h-btn-line" disabled={loading} onClick={() => setPage((value) => value + 1)}>{loading ? "Chargement…" : `Voir plus de produits (${remaining})`}</button></div>}
        </>
      )}
    </section>
  );
}
