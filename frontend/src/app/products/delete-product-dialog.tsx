"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";

import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types/product";

interface DeleteProductDialogProps {
  product: Product;
  onCancel: () => void;
  onDeleted: () => void;
}

export default function DeleteProductDialog({ product, onCancel, onDeleted }: DeleteProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  async function deleteProduct() {
    if (pending.current) return;
    pending.current = true;
    setDeleting(true);
    setError(null);

    try {
      const response = await authFetch(`${apiBase}/products/${product.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = `Impossible de supprimer le produit (HTTP ${response.status}).`;
        const details: unknown = await response.json().catch(() => null);
        if (typeof details === "object" && details !== null && "message" in details) {
          if (typeof details.message === "string" && details.message.trim()) {
            message += ` ${details.message}`;
          } else if (Array.isArray(details.message)) {
            message += ` ${details.message.filter((item: unknown): item is string => typeof item === "string").join(" ")}`;
          }
        }
        throw new Error(message);
      }
      dialogRef.current?.close();
      onDeleted();
    } catch (cause: unknown) {
      setError(cause instanceof TypeError
        ? "Connexion impossible à l’API. Vérifiez la disponibilité du serveur et sa configuration CORS."
        : cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.");
      pending.current = false;
      setDeleting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="delete-product-title"
      aria-describedby="delete-product-description delete-product-identity"
      aria-busy={deleting}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending.current) onCancel();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <div className="p-6 sm:p-8">
        <h2 id="delete-product-title" className="text-xl font-semibold">Supprimer le produit</h2>
        <div id="delete-product-description" className="mt-3 text-sm">
          <p className="text-slate-600">Êtes-vous sûr de vouloir supprimer ce produit ?</p>
          <p className="mt-2 font-semibold text-red-700">Cette action est irréversible.</p>
        </div>
        <dl id="delete-product-identity" className="mt-5 space-y-3 rounded-lg bg-slate-50 p-4 text-sm">
          <div>
            <dt className="text-slate-500">Nom du produit</dt>
            <dd className="mt-1 break-words font-semibold"><bdi dir="auto">{product.name}</bdi></dd>
          </div>
          <div>
            <dt className="text-slate-500">SKU</dt>
            <dd className="mt-1 break-words font-mono"><bdi>{product.sku}</bdi></dd>
          </div>
        </dl>
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{error}</p>}
        <p role="status" className="sr-only">{deleting ? "Suppression..." : ""}</p>
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        <button ref={cancelRef} type="button" disabled={deleting} onClick={() => { if (!pending.current) onCancel(); }} className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50">Annuler</button>
        <button type="button" disabled={deleting} onClick={() => void deleteProduct()} className="rounded-lg bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:cursor-wait disabled:opacity-70">
          {deleting ? "Suppression..." : "Supprimer"}
        </button>
      </div>
    </dialog>
  );
}
