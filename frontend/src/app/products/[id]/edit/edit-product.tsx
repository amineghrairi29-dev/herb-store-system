"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";

import Link from "@/components/auth-link";
import { useEffect, useState } from "react";
import { isProductDetails, type ProductDetails } from "@/types/product";
import ProductForm from "../../product-form";

type LoadState =
  | { status: "loading" }
  | { status: "success"; product: ProductDetails }
  | { status: "error"; message: string };

export default function EditProduct({ id }: { id: string }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);

    async function loadProduct() {
      try {
        if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) {
          throw new Error("Identifiant de produit invalide.");
        }
        const response = await authFetch(`${apiBase}/products/${encodeURIComponent(id)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 404) throw new Error("Produit introuvable.");
        if (!response.ok) throw new Error(`Impossible de charger le produit (HTTP ${response.status}).`);
        const body = await response.text();
        if (!body.trim()) throw new Error("Produit introuvable.");
        const data: unknown = JSON.parse(body);
        if (data === null) throw new Error("Produit introuvable.");
        if (!isProductDetails(data) || data.id !== Number(id)) {
          throw new Error("Les données du produit reçues du serveur sont invalides.");
        }
        if (!controller.signal.aborted) setState({ status: "success", product: data });
      } catch (error: unknown) {
        if (controller.signal.aborted && !timedOut) return;
        setState({
          status: "error",
          message: timedOut
            ? "Le serveur met trop de temps à répondre. Veuillez réessayer."
            : error instanceof TypeError
              ? "Connexion impossible à l’API. Vérifiez le serveur et sa configuration CORS."
              : error instanceof SyntaxError
                ? "La réponse du serveur est invalide."
                : error instanceof Error ? error.message : "Une erreur inattendue est survenue.",
        });
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadProduct();
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [id, attempt]);

  if (state.status === "success") return <ProductForm product={state.product} />;

  return (
    <section aria-label="Chargement du produit" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {state.status === "loading" ? (
        <p role="status" className="py-10 text-center text-sm text-slate-600">Chargement du produit…</p>
      ) : (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Impossible de charger le produit</p>
          <p className="mt-2">{state.message}</p>
          <button type="button" onClick={() => {
            setState({ status: "loading" });
            setAttempt((current) => current + 1);
          }} className="mt-4 rounded-md border border-red-300 bg-white px-4 py-2 font-semibold hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700">Réessayer</button>
        </div>
      )}
      <Link href="/products" className="mt-5 inline-block rounded-md px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-700">Annuler</Link>
    </section>
  );
}
