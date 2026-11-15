"use client";
import { useState, type ChangeEvent } from "react";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";
import { imageFileError, productImageUrl } from "@/lib/product-image";

const MAX = 6;
type Photo = { id: number; path: string };

/** Extra photos shown after the main image on the product page. */
export default function ProductGallery({ productId, initial }: { productId: number; initial: Photo[] }) {
  const [photos, setPhotos] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function readError(response: Response, fallback: string) {
    const body: unknown = await response.json().catch(() => null);
    return body && typeof body === "object" && "message" in body && typeof body.message === "string" ? body.message : fallback;
  }
  async function add(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || busy) return;
    const invalid = imageFileError(file); if (invalid) { setError(invalid); return; }
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("image", file);
      const response = await authFetch(`${apiBase}/products/${productId}/gallery`, { method: "POST", body });
      if (!response.ok) throw new Error(await readError(response, "Envoi de la photo impossible."));
      const saved = await response.json() as Photo;
      setPhotos((list) => [...list, { id: saved.id, path: saved.path }]);
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Envoi de la photo impossible."); }
    finally { setBusy(false); }
  }
  async function remove(photo: Photo) {
    if (busy || !window.confirm("Supprimer cette photo ?")) return;
    setBusy(true); setError("");
    try {
      const response = await authFetch(`${apiBase}/products/${productId}/gallery/${photo.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await readError(response, "Suppression impossible."));
      setPhotos((list) => list.filter((item) => item.id !== photo.id));
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : "Suppression impossible."); }
    finally { setBusy(false); }
  }
  return <section aria-labelledby="gallery-heading" className="mx-auto mt-6 max-w-4xl rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <h2 id="gallery-heading" className="font-semibold">Photos supplémentaires</h2>
    <p className="mt-1 text-sm text-slate-600">Jusqu’à {MAX} photos (JPEG, PNG ou WebP, 3 Mo max), affichées après la photo principale sur la fiche produit.</p>
    <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
      {photos.map((photo) => { const src = productImageUrl(photo.path); return <figure key={photo.id} className="relative aspect-square overflow-hidden rounded-lg border bg-slate-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt="" className="h-full w-full object-cover" />}
        <button type="button" disabled={busy} onClick={() => void remove(photo)} aria-label="Supprimer la photo" className="absolute right-1 top-1 rounded-full bg-white/90 px-2 text-sm text-red-700 shadow disabled:opacity-50">✕</button>
      </figure>; })}
      {photos.length < MAX && <label className={`flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-center text-sm text-slate-600 hover:border-emerald-700 ${busy ? "opacity-50" : ""}`}>
        {busy ? "Envoi…" : "+ Ajouter"}
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => void add(event)} />
      </label>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
