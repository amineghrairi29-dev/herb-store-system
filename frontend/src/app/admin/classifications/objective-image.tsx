"use client";
import { useState, type ChangeEvent } from "react";
import { authFetch } from "@/lib/auth";
import { imageFileError, productImageUrl } from "@/lib/product-image";
import { readClassification, type Classification } from "@/types/classification";

async function readError(response: Response, fallback: string) {
  const body: unknown = await response.json().catch(() => null);
  return body && typeof body === "object" && "message" in body && typeof body.message === "string"
    ? body.message
    : fallback;
}

/**
 * Photo of one objective, shown in its jar on the shop shelf. Without one, the shelf
 * uses the photo of the first recipe of the objective.
 */
export default function ObjectiveImage({
  objective,
  onChange,
}: {
  objective: Classification;
  onChange: (next: Classification) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const url = productImageUrl(objective.imagePath);
  async function send(init: RequestInit, fallback: string) {
    setBusy(true);
    setError("");
    try {
      const response = await authFetch(`/classifications/${objective.id}/image`, init);
      if (!response.ok) throw new Error(await readError(response, fallback));
      onChange({ ...objective, ...readClassification(await response.json()), productCount: objective.productCount });
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : fallback);
    } finally {
      setBusy(false);
    }
  }
  function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    const invalid = imageFileError(file);
    if (invalid) return setError(invalid);
    const body = new FormData();
    body.append("image", file);
    void send({ method: "POST", body }, "Envoi de la photo impossible.");
  }
  return (
    <div className="mt-5 border-t border-slate-100 pt-4 text-sm">
      <p className="font-medium">Photo de l’objectif</p>
      <p className="mt-1 text-xs text-slate-500">
        Affichée dans le bocal de l’objectif sur l’accueil. Sans photo, on prend celle de la première recette.
      </p>
      <div className="mt-3 flex items-center gap-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          ) : (
            <span className="px-2 text-center text-[11px] text-slate-400">Aucune photo</span>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <label
            className={`cursor-pointer rounded-lg border border-emerald-800 px-3 py-1.5 font-semibold text-emerald-800 hover:bg-emerald-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {busy ? "Envoi…" : url ? "Changer la photo" : "Ajouter une photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={busy}
              onChange={pick}
            />
          </label>
          {url && (
            <button
              type="button"
              disabled={busy}
              className="text-xs text-red-700 hover:underline"
              onClick={() => {
                if (window.confirm("Retirer la photo de cet objectif ?"))
                  void send({ method: "DELETE" }, "Suppression impossible.");
              }}
            >
              Retirer la photo
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
