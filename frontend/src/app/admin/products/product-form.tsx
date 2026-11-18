"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";

import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ClassificationPicker from "@/components/classification-picker";
import type { CreateProductInput, RecipeFormat } from "@/types/create-product";
import type { ProductDetails } from "@/types/product";
import { compareDecimals, normalizeDecimal } from "@/lib/decimal";
import Image from "next/image";
import ProductImage from "@/components/product-image";
import { imageFileError } from "@/lib/product-image";

const inputClass =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-2 focus:outline-emerald-700";
/** The three ways a recipe is sold, and the stock/price units each one implies. */
const formats: Record<RecipeFormat, { title: string; titleAr: string; hint: string; price: string; content: string | null }> = {
  BOX: { title: "Boîte", titleAr: "علبة", hint: "Prix fixe pour une boîte", price: "Prix d’une boîte", content: "g" },
  BAG: { title: "Sachet au poids", titleAr: "كيس بالميزان", hint: "Le client choisit la quantité", price: "Prix du kilo", content: null },
  LIQUID: { title: "Flacon (liquide)", titleAr: "قارورة", hint: "Prix fixe pour un flacon", price: "Prix d’un flacon", content: "ml" },
};

/** Format of an existing product: the saved one, or guessed from its sale unit for older products. */
function initialFormat(product?: ProductDetails): RecipeFormat {
  if (product?.recipeFormat) return product.recipeFormat;
  if (!product) return "BOX";
  if (product.saleUnit === "KG" || product.saleUnit === "G") return "BAG";
  if (product.saleUnit === "ML" || product.saleUnit === "L") return "LIQUID";
  return "BOX";
}

/** "Boîte 100 g" -> "100". */
function contentAmount(packaging: string | null | undefined): string {
  const match = /(\d+(?:[.,]\d+)?)\s*(?:g|ml)\b/i.exec(packaging ?? "");
  return match ? match[1].replace(".", ",") : "";
}

export default function ProductForm({ product }: { product?: ProductDetails }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [savedId, setSavedId] = useState<number | undefined>(product?.id);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePending, setImagePending] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function chooseImage(file: File | undefined) {
    setImageFile(file ?? null);
    const message = file ? imageFileError(file) : null;
    setImageError(message ?? "");
    setPreview(file && !message ? URL.createObjectURL(file) : null);
  }
  const [selectedClassifications, setSelectedClassifications] = useState<number[]>(product?.classificationIds ?? []);
  const [hasActiveNeed, setHasActiveNeed] = useState(false);
  const [format, setFormat] = useState<RecipeFormat>(() => initialFormat(product));
  // One recipe = one objective: picking another need replaces the previous one.
  const pickNeed = (ids: number[]) => setSelectedClassifications(ids.length > 1 ? [ids[ids.length - 1]] : ids);
  const [sku] = useState(() => product?.sku ?? `REC-${Date.now().toString(36).toUpperCase()}`);

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    if (!hasActiveNeed) {
      showError("Choisissez l’objectif de la recette.");
      return;
    }
    if ((!product && !imageFile) || imageError || (imageFile && imageFileError(imageFile))) {
      showError(
        imageError ||
          (imageFile ? imageFileError(imageFile) : null) ||
          "Ajoutez une photo de la recette.",
      );
      return;
    }
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const name = text("name");
    if (!name) {
      showError("Donnez un nom à la recette.");
      return;
    }
    const salePrice = normalizeDecimal(text("salePrice"));
    if (salePrice === null || compareDecimals(salePrice, "0.000") <= 0) {
      showError("Le prix doit être un nombre supérieur à 0 (exemple : 12,500).");
      return;
    }
    const spec = formats[format];
    let packaging = "Sachet alimentaire";
    if (spec.content) {
      const amount = normalizeDecimal(text("contentAmount"));
      if (amount === null || compareDecimals(amount, "0.000") <= 0) {
        showError(`Indiquez la contenance (${spec.content}) : par exemple ${format === "BOX" ? "100" : "250"}.`);
        return;
      }
      packaging = `${spec.title.split(" ")[0]} ${amount.replace(/\.?0+$/, "").replace(".", ",")} ${spec.content}`;
    }
    const minStock = text("minStock") ? normalizeDecimal(text("minStock")) : null;
    if (text("minStock") && minStock === null) {
      showError("Le seuil d’alerte doit être un nombre supérieur ou égal à 0.");
      return;
    }
    const byWeight = format === "BAG";
    const payload: CreateProductInput = {
      sku,
      name,
      productType: byWeight ? "VRAC" : "EMBALLE",
      salePrice,
      classificationIds: selectedClassifications,
      // Bag: stock and price per kilo. Box and bottle: counted and priced per unit.
      measurementMode: byWeight ? "WEIGHT" : "FLEXIBLE",
      storageUnit: byWeight ? "KG" : "PIECE",
      saleUnit: byWeight ? "KG" : "PIECE",
      conversionFactor: "1",
      minStock,
      maxStock: null,
      recipeFormat: format,
      packaging,
      isActive: form.has("isActive"),
      isSellable: product?.isSellable ?? true,
      isVisibleOnline: form.has("isVisibleOnline"),
    };
    for (const field of ["nameFr", "description", "ingredients", "benefits", "usage", "precautions"] as const) {
      const value = text(field);
      if (value || savedId) payload[field] = value;
    }

    pending.current = true;
    setSubmitting(true);
    let fieldsSaved = false;
    try {
      const response = await authFetch(`${apiBase}/products${savedId ? `/${savedId}` : ""}`, {
        method: savedId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        let message = `Impossible d’enregistrer la recette (HTTP ${response.status}).`;
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
      let id = savedId;
      if (!id) {
        const created: unknown = await response.json();
        if (
          !created ||
          typeof created !== "object" ||
          !("id" in created) ||
          typeof created.id !== "number" ||
          !Number.isInteger(created.id)
        )
          throw new Error("Réponse de création invalide. Vérifiez la liste des produits avant de réessayer.");
        id = created.id;
        setSavedId(id);
      }
      fieldsSaved = true;
      if (imageFile) {
        setImagePending(true);
        const upload = new FormData();
        upload.append("image", imageFile);
        // The browser supplies the multipart boundary; authFetch retains cookies.
        const uploaded = await authFetch(`${apiBase}/products/${id}/image`, { method: "POST", body: upload });
        if (!uploaded.ok) {
          const details: unknown = await uploaded.json().catch(() => null);
          const message =
            details && typeof details === "object" && "message" in details && typeof details.message === "string"
              ? details.message
              : "Téléversement impossible.";
          throw new Error(`Image non enregistrée (HTTP ${uploaded.status}). ${message}`);
        }
      }
      // A fresh navigation guarantees the catalogue performs GET again after saving.
      window.location.replace("/admin/products");
    } catch (cause: unknown) {
      const message =
        cause instanceof TypeError
          ? "Connexion impossible au serveur. Vérifiez votre connexion et la disponibilité de l’API."
          : cause instanceof Error
            ? cause.message
            : "Une erreur inattendue est survenue.";
      showError(
        fieldsSaved
          ? `Les informations de la recette sont enregistrées, mais l’image n’a pas pu être confirmée. ${product?.mainImagePath ? "L’image précédente est conservée si le remplacement a échoué. " : ""}Réessayez : la même recette sera utilisée. ${message}`
          : message,
      );
      pending.current = false;
      setSubmitting(false);
      setImagePending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {error && (
        <div
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-2 focus:outline-red-700"
        >
          {error}
        </div>
      )}
      {error && savedId && !product && (
        <p className="mx-6 mt-3 text-sm text-emerald-800">
          <Link href={`/admin/products/${savedId}/edit`} className="underline">
            Reprendre la modification de cette recette
          </Link>
        </p>
      )}
      <fieldset disabled={submitting} className="space-y-8 p-6 sm:p-8 disabled:opacity-70">
        <legend className="sr-only">Informations de la recette</legend>
        <section aria-labelledby="image-heading">
          <h2 id="image-heading" className="font-semibold">
            Photo de la recette{!product ? " *" : ""}
          </h2>
          <p id="image-help" className="mt-2 text-sm text-slate-500">
            JPG, PNG ou WebP · 3 Mo maximum · image fixe, 25 mégapixels maximum.{" "}
            {product
              ? "Sans nouveau fichier, l’image actuelle est conservée."
              : "Une photo est requise pour créer une recette."}
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {preview ? (
              <Image
                src={preview}
                alt="Aperçu de l’image sélectionnée"
                unoptimized
                width={240}
                height={180}
                className="h-40 w-48 rounded-lg bg-stone-100 object-contain"
                onError={() => setImageError("Cette image ne peut pas être affichée. Sélectionnez un autre fichier.")}
              />
            ) : (
              <ProductImage
                imagePath={product?.mainImagePath}
                name={product?.name ?? ""}
                sizes="192px"
                className="h-40 w-48 shrink-0 rounded-lg bg-stone-100"
                fallback={
                  <div className="flex h-40 w-48 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-500">
                    Aucune image
                  </div>
                }
              />
            )}
            <label className="min-w-0 text-sm font-medium">
              {product ? "Remplacer l’image" : "Choisir une image"}
              <input
                type="file"
                name="image"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                required={!product}
                aria-describedby="image-help"
                aria-invalid={!!imageError}
                onChange={(event) => chooseImage(event.target.files?.[0])}
                className={`${inputClass} max-w-full file:mr-3 file:rounded file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-900`}
              />
            </label>
          </div>
          {imageError && (
            <p role="alert" className="mt-3 text-sm text-red-800">
              {imageError}
            </p>
          )}
        </section>
        <section aria-labelledby="required-heading">
          <h2 id="required-heading" className="font-semibold">
            La recette
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Nom de la recette *
              <input
                name="name"
                defaultValue={product?.name ?? ""}
                required
                dir="auto"
                placeholder="خلطة الهضم"
                className={inputClass}
              />
            </label>
            <label className="text-sm font-medium">
              Nom en français
              <input
                name="nameFr"
                defaultValue={product?.nameFr ?? ""}
                dir="auto"
                placeholder="Mélange digestion"
                className={inputClass}
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Référence interne : <span className="font-mono">{sku}</span>
          </p>
        </section>
        <section aria-labelledby="classification-heading" className="border-t border-slate-100 pt-6">
          <h2 id="classification-heading" className="font-semibold">
            Objectif de la recette *
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Une recette répond à un seul besoin. Choisir un autre besoin remplace le précédent.
          </p>
          <ClassificationPicker
            selected={selectedClassifications}
            onChange={pickNeed}
            onValidityChange={setHasActiveNeed}
          />
        </section>
        <section aria-labelledby="format-heading" className="border-t border-slate-100 pt-6">
          <h2 id="format-heading" className="font-semibold">
            Format et prix *
          </h2>
          <div role="radiogroup" aria-labelledby="format-heading" className="mt-4 grid gap-3 sm:grid-cols-3">
            {(Object.keys(formats) as RecipeFormat[]).map((key) => {
              const item = formats[key];
              const active = format === key;
              return (
                <label
                  key={key}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-4 transition ${active ? "border-emerald-700 bg-emerald-50" : "border-slate-200 bg-white hover:border-emerald-300"}`}
                >
                  <input
                    type="radio"
                    name="recipeFormat"
                    value={key}
                    checked={active}
                    onChange={() => setFormat(key)}
                    className="sr-only"
                  />
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-slate-900">{item.title}</span>
                    <span lang="ar" dir="rtl" className="text-lg text-emerald-800">
                      {item.titleAr}
                    </span>
                  </span>
                  <span className="text-xs text-slate-500">{item.hint}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              {formats[format].price} (DT) *
              <input
                name="salePrice"
                defaultValue={product?.salePrice ?? ""}
                required
                inputMode="decimal"
                placeholder={format === "BAG" ? "45,000" : "18,500"}
                className={inputClass}
              />
              {format === "BAG" && (
                <span className="mt-2 block text-xs font-normal text-slate-500">
                  Le site calcule le prix selon le poids choisi par le client.
                </span>
              )}
            </label>
            {formats[format].content && (
              <label className="text-sm font-medium">
                Contenance ({formats[format].content}) *
                <input
                  key={format}
                  name="contentAmount"
                  defaultValue={product?.recipeFormat === format || !product?.recipeFormat ? contentAmount(product?.packaging) : ""}
                  required
                  inputMode="decimal"
                  placeholder={format === "BOX" ? "100" : "250"}
                  className={inputClass}
                />
              </label>
            )}
          </div>
        </section>
        <section aria-labelledby="content-heading" className="border-t border-slate-100 pt-6">
          <h2 id="content-heading" className="font-semibold">
            Ce que voit le client
          </h2>
          <div className="mt-5 grid gap-5">
            {(
              [
                [
                  "ingredients",
                  "Ingrédients principaux",
                  "Un par ligne, sans les quantités. Ex. :\nCamomille\nFenouil\nMenthe",
                  4,
                ],
                ["benefits", "Bienfaits", "Ex. : Aide à la digestion, apaise après le repas.", 3],
                ["usage", "Mode d’utilisation", "Ex. : 1 cuillère à café dans une tasse d’eau chaude, 5 minutes.", 3],
                [
                  "precautions",
                  "Précautions",
                  "Ex. : Déconseillé aux femmes enceintes. Avis médical en cas de traitement.",
                  3,
                ],
                ["description", "L’histoire de la recette", "Facultatif : d’où vient-elle, pour qui l’avez-vous créée…", 3],
              ] as const
            ).map(([field, label, hint, rows]) => (
              <label key={field} className="text-sm font-medium">
                {label}
                <textarea
                  name={field}
                  defaultValue={product?.[field] ?? ""}
                  dir="auto"
                  rows={rows}
                  maxLength={4000}
                  placeholder={hint}
                  className={`${inputClass} resize-y`}
                />
              </label>
            ))}
          </div>
        </section>
        <section aria-labelledby="visibility-heading" className="border-t border-slate-100 pt-6">
          <h2 id="visibility-heading" className="font-semibold">
            Stock et visibilité
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Alerte stock bas ({format === "BAG" ? "kg" : format === "BOX" ? "boîtes" : "flacons"})
              <input
                name="minStock"
                inputMode="decimal"
                defaultValue={product?.minStock ?? ""}
                placeholder={format === "BAG" ? "1" : "5"}
                className={inputClass}
              />
              <span className="mt-2 block text-xs font-normal text-slate-500">
                En dessous, la recette s’affiche « Stock limité ». Le stock lui-même se saisit dans Stock.
              </span>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            {[
              { name: "isVisibleOnline", label: "Visible sur le site", checked: product?.isVisibleOnline ?? true },
              { name: "isActive", label: "Active", checked: product?.isActive ?? true },
            ].map((field) => (
              <label key={field.name} className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name={field.name}
                  defaultChecked={field.checked}
                  className="h-4 w-4 accent-emerald-800"
                />
                {field.label}
              </label>
            ))}
          </div>
        </section>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        {submitting ? (
          <button
            type="button"
            disabled
            className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-400"
          >
            Annuler
          </button>
        ) : (
          <Link
            href="/admin/products"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700"
          >
            Annuler
          </Link>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70"
        >
          {submitting ? (imagePending ? "Envoi de l’image..." : "Enregistrement...") : "Enregistrer la recette"}
        </button>
        <span role="status" className="sr-only">
          {submitting ? "Enregistrement..." : ""}
        </span>
      </div>
    </form>
  );
}
