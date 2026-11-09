"use client";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/api-base";
import type { CatalogueResponse } from "@/types/public-product";
import ProductCard from "../product-card";

export default function HomeSelection() {
  const [data, setData] = useState<{
    products: CatalogueResponse["data"];
  } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const options = {
          cache: "no-store" as const,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15000),
          ]),
        };
        const p = await fetch(`${apiBase}/public/products?pageSize=6&sort=name_asc`, options);
        if (!p.ok) throw new Error("Public catalogue unavailable");
        const products: CatalogueResponse = await p.json();
        if (!controller.signal.aborted)
          setData({
            products: products.data,
          });
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);
  const state = error ? (
    <div role="alert" className="sf-empty">
      <p>Notre sélection n’est pas disponible pour le moment.</p>
      <button
        className="sf-text-link"
        onClick={() => {
          setError(false);
          setData(null);
          setAttempt(attempt + 1);
        }}
      >
        Réessayer
      </button>
    </div>
  ) : !data ? (
    <div className="sf-loading" role="status">
      Chargement de notre sélection…
    </div>
  ) : null;
  return (
    <>
      <section id="products" className="sf-products-section" aria-labelledby="products-title">
        <div className="sf-container sf-section">
          <div className="sf-section-heading">
            <div>
              <p className="sf-eyebrow">
                NOTRE SÉLECTION
              </p>
              <h2 id="products-title">Nos produits</h2>
              <p>Découvrez une sélection de notre catalogue</p>
            </div>
          </div>
          {state ??
            (data?.products.length ? (
              <div className="botanical-product-grid">
                {data.products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p className="sf-empty">
                Aucun produit disponible dans la boutique pour le moment.
              </p>
            ))}
        </div>
      </section>
    </>
  );
}
