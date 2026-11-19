"use client";
import ProductImage from "@/components/product-image";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";

import { useEffect, useRef, useState } from "react";
import Link from "@/components/auth-link";
import { CanManageInventory } from "@/components/auth-link";
import { isProduct, type Product } from "@/types/product";
import DeleteProductDialog from "./delete-product-dialog";

type ProductsState =
  { status: "loading" } | { status: "success"; products: Product[] } | { status: "error"; message: string };

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

/** "Boîte 100 g", "Sachet au poids", "Flacon 250 ml"; older products fall back to their packaging. */
function formatLabel(product: Product): string {
  if (product.recipeFormat === "BAG") return "Sachet au poids";
  if (product.recipeFormat) return product.packaging || (product.recipeFormat === "BOX" ? "Boîte" : "Flacon");
  return product.packaging || (product.saleUnit === "KG" || product.saleUnit === "G" ? "Au poids" : "—");
}

export default function ProductsTable() {
  const [state, setState] = useState<ProductsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    async function loadProducts() {
      try {
        const response = await authFetch(`${apiBase}/products`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`Le serveur a renvoyé une erreur (HTTP ${response.status}).`);
        }
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.every(isProduct)) {
          throw new Error("La liste des recettes reçue du serveur est invalide.");
        }
        if (!controller.signal.aborted) {
          setState({ status: "success", products: data });
        }
      } catch (error: unknown) {
        if (controller.signal.aborted && !timedOut) return;
        setState({
          status: "error",
          message: timedOut
            ? "Le serveur met trop de temps à répondre. Veuillez réessayer."
            : error instanceof TypeError
              ? "Connexion impossible à l’API. Vérifiez que le serveur est disponible et que sa configuration CORS autorise http://localhost:3000."
              : error instanceof Error
                ? error.message
                : "Une erreur inattendue est survenue.",
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadProducts();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);

  return (
    <section
      aria-label="Liste des recettes"
      aria-busy={state.status === "loading"}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <h2 ref={headingRef} tabIndex={-1} className="font-semibold">
          Toutes les recettes
        </h2>
        {state.status === "success" && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            {state.products.length} recette{state.products.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {state.status === "loading" && (
        <div role="status" className="flex items-center justify-center gap-3 px-6 py-20 text-sm text-slate-600">
          <span
            aria-hidden="true"
            className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-emerald-700 motion-safe:animate-spin"
          />
          Chargement des recettes…
        </div>
      )}

      {state.status === "error" && (
        <div role="alert" className="m-6 rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="font-semibold text-red-900">Impossible de charger les recettes</p>
          <p className="mt-2 text-sm text-red-800">{state.message}</p>
          <button
            type="button"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((current) => current + 1);
            }}
            className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            Réessayer
          </button>
        </div>
      )}

      {state.status === "success" && state.products.length === 0 && (
        <p role="status" className="px-6 py-20 text-center text-sm text-slate-600">
          Aucune recette pour le moment
        </p>
      )}

      {state.status === "success" && state.products.some((product) => !product.recipeFormat) && (
        <p
          role="note"
          className="mx-6 mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {(() => {
            const missing = state.products.filter((product) => !product.recipeFormat).length;
            return missing === 1 ? "1 recette n’a pas de format" : `${missing} recettes n’ont pas de format`;
          })()}{" "}
          (Boîte, Sachet ou Flacon). Sur le site, elles n’apparaissent dans aucun filtre de format : ouvrez-les avec «
          Format manquant » pour le choisir.
        </p>
      )}

      {state.status === "success" && state.products.length > 0 && (
        <div
          role="region"
          aria-label="Tableau des recettes, défilement horizontal disponible"
          tabIndex={0}
          className="overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700"
        >
          <table className="w-full min-w-[900px] text-left text-sm">
            <caption className="sr-only">Recettes : objectif, format, prix, statut et visibilité sur le site</caption>
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                {["Recette", "Nom français", "Objectif", "Format", "Prix", "Statut", "Sur le site", "Actions"].map(
                  (heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className={`whitespace-nowrap px-5 py-4 font-semibold ${heading === "Prix" ? "text-right" : ""}`}
                    >
                      {heading}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.products.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/80">
                  <th scope="row" className="min-w-40 max-w-64 break-words px-5 py-5 font-semibold">
                    <div className="flex items-center gap-3">
                      <ProductImage
                        imagePath={product.mainImagePath}
                        name={product.name}
                        sizes="48px"
                        className="h-12 w-12 shrink-0 rounded-lg bg-stone-100"
                        fallback={
                          <span
                            aria-hidden="true"
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-emerald-700"
                          >
                            ✦
                          </span>
                        }
                      />
                      <bdi dir="auto">{product.name}</bdi>
                    </div>
                  </th>
                  <td className="min-w-36 max-w-64 break-words px-5 py-5 text-slate-600">
                    <bdi dir="auto">{product.nameFr || "—"}</bdi>
                  </td>
                  <td className="min-w-32 max-w-56 break-words px-5 py-5 text-slate-600">
                    <bdi dir="auto">{product.category}</bdi>
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-slate-600">
                    {product.recipeFormat ? (
                      formatLabel(product)
                    ) : (
                      <Link
                        href={`/admin/products/${product.id}/edit`}
                        title="Choisissez Boîte, Sachet ou Flacon pour cette recette"
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 hover:bg-amber-100"
                      >
                        <span aria-hidden="true">!</span> Format manquant
                      </Link>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-5 text-right font-medium tabular-nums">
                    {priceFormatter.format(Number(product.salePrice))}
                    {product.saleUnit === "KG" && <span className="font-normal text-slate-500"> / kg</span>}
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${product.isActive ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
                      {product.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${product.isVisibleOnline ? "bg-blue-50 text-blue-800" : "bg-slate-100 text-slate-600"}`}
                    >
                      {product.isVisibleOnline ? "Visible" : "Masquée"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-5">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      aria-label={`Modifier ${product.name}`}
                      className="rounded-md px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700"
                    >
                      Modifier
                    </Link>
                    <CanManageInventory>
                      <button
                        type="button"
                        onClick={() => setProductToDelete(product)}
                        aria-label={`Supprimer ${product.name}`}
                        className="ml-2 rounded-md px-3 py-2 font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700"
                      >
                        Supprimer
                      </button>
                    </CanManageInventory>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {productToDelete && (
        <DeleteProductDialog
          product={productToDelete}
          onCancel={() => setProductToDelete(null)}
          onDeleted={() => {
            setProductToDelete(null);
            setState({ status: "loading" });
            setAttempt((current) => current + 1);
            headingRef.current?.focus();
          }}
        />
      )}
    </section>
  );
}
