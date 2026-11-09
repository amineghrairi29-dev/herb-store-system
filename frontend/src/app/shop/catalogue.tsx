"use client";
import { apiBase } from "@/lib/api-base";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CatalogueResponse, PublicClassification, Availability } from "@/types/public-product";
import { availabilityLabels } from "./shop-components";
import ProductCard from "./product-card";

const api = apiBase;
export default function Catalogue({ query, need }: { query: string; need: PublicClassification }) {
  const params = new URLSearchParams(query);
  const [result, setResult] = useState<CatalogueResponse | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const search = new URLSearchParams(query);
        if (need) search.set("classification", need.slug);
        const response = await fetch(`${api}/public/products?${search}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Catalogue HTTP ${response.status}`);
        const data: CatalogueResponse = await response.json();
        if (!controller.signal.aborted) setResult(data);
      } catch (failure: unknown) {
        if (!controller.signal.aborted) { console.error("Catalogue request failed", failure); setError(true); }
      }
    }
    void load();
    return () => controller.abort();
  }, [query, retry, need]);
  const field = "mt-2 w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-emerald-700";
  const route = `/shop/besoins/${encodeURIComponent(need.slug)}`;
  const pageLink = (page: number) => { const next = new URLSearchParams(query); next.set("page", String(page)); return `${route}?${next}`; };
  const filtered = ["q", "availability"].some((key) => params.get(key)?.trim());
  return <>
    <p className="mb-2 text-sm font-medium uppercase tracking-widest text-emerald-800">La boutique</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{need ? <bdi>{need.nameFr}</bdi> : "Tous les produits"}</h1><p className="mt-3 text-stone-600">Découvrez nos produits et leur disponibilité.</p>
    <form action={route} method="get" className="my-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
      <label className="min-w-0 text-sm font-medium">Rechercher<input id="catalogue-search" name="q" type="search" defaultValue={params.get("q") ?? ""} placeholder="Nom, plante, besoin…" maxLength={200} className={field} /></label>
      <label className="min-w-0 text-sm font-medium">Disponibilité<select name="availability" defaultValue={params.get("availability") ?? ""} className={field}><option value="">Toutes les disponibilités</option>{Object.entries(availabilityLabels).map(([value, label]) => <option key={value} value={value as Availability}>{label}</option>)}</select></label>
      <label className="min-w-0 text-sm font-medium">Trier par<select name="sort" defaultValue={params.get("sort") ?? "name_asc"} className={field}><option value="name_asc">Nom : A à Z</option><option value="name_desc">Nom : Z à A</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option></select></label>
      <div className="flex items-end gap-4"><button className="rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-emerald-800">Rechercher</button><Link className="py-2.5 text-sm underline" href={route}>Réinitialiser</Link></div>
    </form>
    {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6"><p>Impossible de charger le catalogue.</p><button className="mt-3 underline" onClick={() => { setError(false); setResult(null); setRetry((value) => value + 1); }}>Réessayer</button></div> : !result ? <p role="status">Chargement du catalogue...</p> : <>
      <p className="mb-5 text-sm text-stone-500" role="status">{result.pagination.totalItems} produit(s)</p>
      {!result.data.length ? <p className="rounded-xl bg-white p-8 text-center">{filtered ? "Aucun produit ne correspond à votre recherche." : result.pagination.totalItems ? "Aucun produit sur cette page." : "Aucun produit disponible dans la boutique."}</p> : <div className="botanical-product-grid">{result.data.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      <nav aria-label="Pagination du catalogue" className="mt-8 flex flex-wrap items-center justify-center gap-5">{result.pagination.page > 1 && <Link className="rounded-lg border bg-white px-4 py-2" href={pageLink(result.pagination.page - 1)}>Précédent</Link>}<span className="text-sm">Page {result.pagination.page} sur {Math.max(1, result.pagination.totalPages)}</span>{result.pagination.page < result.pagination.totalPages && <Link className="rounded-lg border bg-white px-4 py-2" href={pageLink(result.pagination.page + 1)}>Suivant</Link>}</nav>
    </>}
  </>;
}
