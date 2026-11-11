"use client";
import { apiBase } from "@/lib/api-base";
import { authFetch } from "@/lib/auth";

import Link from "@/components/auth-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import ClassificationPicker from '@/components/classification-picker';
import type { CreateProductInput } from "@/types/create-product";
import type { ProductDetails } from "@/types/product";
import { compareDecimals, normalizeDecimal } from "@/lib/decimal";
import Image from 'next/image';
import ProductImage from '@/components/product-image';
import { imageFileError } from '@/lib/product-image';

const inputClass = "mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-emerald-700 focus:outline-2 focus:outline-emerald-700";
const optionalFields = [
  { name: "nameFr", label: "Nom français" },
  { name: "scientificName", label: "Nom scientifique" },
  { name: "barcode", label: "Code-barres" },
  { name: "origin", label: "Origine" },
  { name: "packaging", label: "Conditionnement" },
] as const;

export default function ProductForm({ product }: { product?: ProductDetails }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const [savedId, setSavedId] = useState<number | undefined>(product?.id);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [imagePending, setImagePending] = useState(false);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function chooseImage(file: File | undefined) {
    setImageFile(file ?? null);
    const message = file ? imageFileError(file) : null;
    setImageError(message ?? '');
    setPreview(file && !message ? URL.createObjectURL(file) : null);
  }
  const [selectedClassifications, setSelectedClassifications] = useState<number[]>(product?.classificationIds ?? []);
  const [hasActiveNeed, setHasActiveNeed] = useState(false);
  const [mode, setMode] = useState(product?.measurementMode ?? 'FLEXIBLE');
  const [storage, setStorage] = useState(product?.storageUnit ?? '');
  const [sale, setSale] = useState(product?.saleUnit ?? '');
  const choices: Record<string, string[]> = { WEIGHT: ['G', 'KG'], VOLUME: ['ML', 'L'], WEIGHT_AND_VOLUME: ['G', 'KG', 'ML', 'L'], FLEXIBLE: ['G', 'KG', 'ML', 'L', 'PIECE'] };
  const units = choices[mode] ?? [];

  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    setError(null);
    if (!hasActiveNeed) { showError('Sélectionnez au moins un besoin actif.'); return; }
    if ((!product && !imageFile) || imageError || (imageFile && imageFileError(imageFile))) {
      showError(imageError || (imageFile ? imageFileError(imageFile) : null) || 'Sélectionnez une image principale pour ce nouveau produit.');
      return;
    }
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const sku = text("sku");
    const name = text("name");
    const productType = text("productType");
    const rawPrice = text("salePrice");
    const storageUnit = text("storageUnit");
    const saleUnit = text("saleUnit");

    if (!sku || !name || !productType || !rawPrice || !selectedClassifications.length || !storageUnit || !saleUnit || !text("conversionFactor")) {
      showError("Veuillez renseigner tous les champs obligatoires : SKU, nom, type, classification, unités, facteur de conversion et prix.");
      return;
    }
    if (productType !== "VRAC" && productType !== "EMBALLE") {
      showError("Veuillez sélectionner un type de produit valide.");
      return;
    }
    const salePrice = normalizeDecimal(rawPrice);
    if (salePrice === null || compareDecimals(salePrice, "0.000") <= 0) {
      showError("Le prix de vente doit être un nombre décimal supérieur à 0 (exemple : 12,500).");
      return;
    }

    if (!units.includes(storageUnit) || !units.includes(saleUnit)) {
      showError("Veuillez sélectionner des unités valides.");
      return;
    }
    const conversionFactor = normalizeDecimal(text("conversionFactor"));
    if (conversionFactor === null || compareDecimals(conversionFactor, "0.000") <= 0) {
      showError("Le facteur de conversion doit être un nombre décimal supérieur à 0.");
      return;
    }
    const minStock = text("minStock") ? normalizeDecimal(text("minStock")) : null;
    const maxStock = text("maxStock") ? normalizeDecimal(text("maxStock")) : null;
    if ((text("minStock") && minStock === null) || (text("maxStock") && maxStock === null)) {
      showError("Les stocks minimum et maximum doivent être des nombres décimaux supérieurs ou égaux à 0.");
      return;
    }
    if (minStock !== null && maxStock !== null && compareDecimals(maxStock, minStock) < 0) {
      showError("Le stock maximum doit être supérieur ou égal au stock minimum.");
      return;
    }
    const payload: CreateProductInput = {
      sku,
      name,
      productType,
      salePrice,
      classificationIds: selectedClassifications,
      measurementMode: mode,
      storageUnit,
      saleUnit,
      conversionFactor,
      minStock,
      maxStock,
      location: text("location") || null,
      isActive: form.has("isActive"),
      isSellable: form.has("isSellable"),
      isVisibleOnline: form.has("isVisibleOnline"),
    };
    for (const field of optionalFields) {
      const value = text(field.name);
      if (field.name === 'barcode') payload.barcode = value || null;
      else if (value || savedId) payload[field.name] = value;
    }
    const description = text("description");
    if (description || savedId) payload.description = description;
    for (const name of ["benefits", "usage", "precautions"] as const) {
      const value = text(name);
      if (value || savedId) payload[name] = value;
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
        let message = `Impossible d’enregistrer le produit (HTTP ${response.status}).`;
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
        if (!created || typeof created !== 'object' || !('id' in created) || typeof created.id !== 'number' || !Number.isInteger(created.id)) throw new Error('Réponse de création invalide. Vérifiez la liste des produits avant de réessayer.');
        id = created.id;
        setSavedId(id);
      }
      fieldsSaved = true;
      if (imageFile) {
        setImagePending(true);
        const upload = new FormData(); upload.append('image', imageFile);
        // The browser supplies the multipart boundary; authFetch retains cookies.
        const uploaded = await authFetch(`${apiBase}/products/${id}/image`, { method: 'POST', body: upload });
        if (!uploaded.ok) {
          const details: unknown = await uploaded.json().catch(() => null);
          const message = details && typeof details === 'object' && 'message' in details && typeof details.message === 'string' ? details.message : 'Téléversement impossible.';
          throw new Error(`Image non enregistrée (HTTP ${uploaded.status}). ${message}`);
        }
      }
      // A fresh navigation guarantees the catalogue performs GET again after saving.
      window.location.replace("/products");
    } catch (cause: unknown) {
      const message = cause instanceof TypeError
        ? "Connexion impossible au serveur. Vérifiez votre connexion et la disponibilité de l’API."
        : cause instanceof Error ? cause.message : "Une erreur inattendue est survenue.";
      showError(fieldsSaved
        ? `Les informations du produit sont enregistrées, mais l’image n’a pas pu être confirmée. ${product?.mainImagePath ? 'L’image précédente est conservée si le remplacement a échoué. ' : ''}Réessayez : le même produit sera utilisé. ${message}`
        : message);
      pending.current = false;
      setSubmitting(false);
      setImagePending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="mx-6 mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 focus:outline-2 focus:outline-red-700">{error}</div>
      )}
      {error && savedId && !product && <p className="mx-6 mt-3 text-sm text-emerald-800"><Link href={`/products/${savedId}/edit`} className="underline">Reprendre la modification de ce produit</Link></p>}
      <fieldset disabled={submitting} className="space-y-8 p-6 sm:p-8 disabled:opacity-70">
        <legend className="sr-only">Informations du produit</legend>
        <section aria-labelledby="image-heading">
          <h2 id="image-heading" className="font-semibold">Image principale{!product ? ' *' : ''}</h2>
          <p id="image-help" className="mt-2 text-sm text-slate-500">JPG, PNG ou WebP · 3 Mo maximum · image fixe, 25 mégapixels maximum. {product ? 'Sans nouveau fichier, l’image actuelle est conservée.' : 'Une image est requise pour créer un produit depuis ce formulaire.'}</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            {preview ? <Image src={preview} alt="Aperçu de l’image sélectionnée" unoptimized width={240} height={180} className="h-40 w-48 rounded-lg bg-stone-100 object-contain" onError={() => setImageError('Cette image ne peut pas être affichée. Sélectionnez un autre fichier.')} /> : <ProductImage imagePath={product?.mainImagePath} name={product?.name ?? ''} sizes="192px" className="h-40 w-48 shrink-0 rounded-lg bg-stone-100" fallback={<div className="flex h-40 w-48 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-sm text-stone-500">Aucune image</div>} />}
            <label className="min-w-0 text-sm font-medium">{product ? 'Remplacer l’image' : 'Choisir une image'}<input type="file" name="image" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required={!product} aria-describedby="image-help" aria-invalid={!!imageError} onChange={event => chooseImage(event.target.files?.[0])} className={`${inputClass} max-w-full file:mr-3 file:rounded file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-emerald-900`} /></label>
          </div>
          {imageError && <p role="alert" className="mt-3 text-sm text-red-800">{imageError}</p>}
        </section>
        <section aria-labelledby="required-heading">
          <h2 id="required-heading" className="font-semibold">Informations générales</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">SKU *
              <input name="sku" defaultValue={product?.sku ?? ""} required dir="auto" autoComplete="off" className={inputClass} />
            </label>
            <label className="text-sm font-medium">Nom du produit *
              <input name="name" defaultValue={product?.name ?? ""} required dir="auto" className={inputClass} />
            </label>
            <label className="text-sm font-medium">Type de produit *
              <select name="productType" required defaultValue={product?.productType ?? ""} className={inputClass}>
                <option value="" disabled>Sélectionner un type</option>
                <option value="VRAC">VRAC</option>
                <option value="EMBALLE">EMBALLE</option>
              </select>
            </label>
          </div>
        </section>
        <section aria-labelledby="classification-heading" className="border-t border-slate-100 pt-6">
          <h2 id="classification-heading" className="font-semibold">Classifications / besoins *</h2>
          <ClassificationPicker selected={selectedClassifications} onChange={setSelectedClassifications} onValidityChange={setHasActiveNeed} />
        </section>
        <section aria-labelledby="storage-heading" className="border-t border-slate-100 pt-6">
          <h2 id="storage-heading" className="font-semibold">Unités et stockage</h2>
          <label className="mt-4 block text-sm font-medium">Mode de mesure du produit *<select name="measurementMode" value={mode} onChange={e => setMode(e.target.value)} required className={inputClass}><option value="WEIGHT">Poids</option><option value="VOLUME">Volume</option><option value="FLEXIBLE">Flexible</option><option value="WEIGHT_AND_VOLUME">Poids et volume</option></select></label>
          <p className="mt-2 text-xs text-slate-500">Le facteur indique le nombre d’unités de vente dans une unité de stockage (exemple : 1 KG = 1000 G). Les seuils sont exprimés en unité de stockage.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {[
              { name: "storageUnit", label: "Unité de stockage" },
              { name: "saleUnit", label: "Unité de vente" },
            ].map((field) => (
              <label key={field.name} className="text-sm font-medium">{field.label} *
                <select name={field.name} required value={field.name === "storageUnit" ? storage : sale} onChange={event => field.name === "storageUnit" ? setStorage(event.target.value) : setSale(event.target.value)} className={inputClass}>
                  <option value="" disabled>Sélectionner une unité</option>
                  {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
            ))}
            <label className="text-sm font-medium">Facteur de conversion *
              <input name="conversionFactor" required inputMode="decimal" defaultValue={product?.conversionFactor ?? ""} placeholder="1000" className={inputClass} />
            </label>
            <label className="text-sm font-medium">Emplacement
              <input name="location" dir="auto" defaultValue={product?.location ?? ""} placeholder="Rayon A / Bac 03" className={inputClass} />
            </label>
            <label className="text-sm font-medium">Stock minimum
              <input name="minStock" inputMode="decimal" defaultValue={product?.minStock ?? ""} placeholder="0" className={inputClass} />
            </label>
            <label className="text-sm font-medium">Stock maximum
              <input name="maxStock" inputMode="decimal" defaultValue={product?.maxStock ?? ""} placeholder="10" className={inputClass} />
            </label>
          </div>
        </section>
        <section aria-labelledby="price-heading" className="border-t border-slate-100 pt-6">
          <h2 id="price-heading" className="font-semibold">Prix</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-medium">Prix de vente *
              <input name="salePrice" defaultValue={product?.salePrice ?? ""} required inputMode="decimal" placeholder="12,500" aria-describedby="price-help" className={inputClass} />
              <span id="price-help" className="mt-2 block text-xs font-normal text-slate-500">Prix supérieur à 0. Virgule ou point accepté pour les valeurs décimales.</span>
            </label>
          </div>
        </section>
        <section aria-labelledby="optional-heading" className="border-t border-slate-100 pt-6">
          <h2 id="optional-heading" className="font-semibold">Informations complémentaires</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {optionalFields.map((field) => (
              <label key={field.name} className="text-sm font-medium">{field.label}
                <input name={field.name} defaultValue={product?.[field.name] ?? ""} dir="auto" className={inputClass} />
              </label>
            ))}
            <label className="text-sm font-medium sm:col-span-2">Description
              <textarea name="description" defaultValue={product?.description ?? ""} dir="auto" rows={4} className={`${inputClass} resize-y`} />
            </label>
            {([["benefits", "Bienfaits", "Ex. : Aide à la digestion, apaise après le repas."], ["usage", "Mode d’utilisation", "Ex. : 1 cuillère à café pour une tasse d’eau chaude, infuser 5 minutes."], ["precautions", "Précautions", "Ex. : Déconseillé aux femmes enceintes. Demandez l’avis d’un médecin en cas de traitement."]] as const).map(([name, label, hint]) => (
              <label key={name} className="text-sm font-medium sm:col-span-2">{label} <span className="font-normal text-slate-500">(affiché sur la fiche produit si rempli)</span>
                <textarea name={name} defaultValue={product?.[name] ?? ""} dir="auto" rows={3} maxLength={4000} placeholder={hint} className={`${inputClass} resize-y`} />
              </label>
            ))}
          </div>
        </section>
        <section aria-labelledby="visibility-heading" className="border-t border-slate-100 pt-6">
          <h2 id="visibility-heading" className="font-semibold">Statut et visibilité</h2>
          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-4">
            {[
              { name: "isActive", label: "Actif", checked: product?.isActive ?? true },
              { name: "isSellable", label: "Vendable", checked: product?.isSellable ?? true },
              { name: "isVisibleOnline", label: "Visible en ligne", checked: product?.isVisibleOnline ?? false },
            ].map((field) => (
              <label key={field.name} className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name={field.name} defaultChecked={field.checked} className="h-4 w-4 accent-emerald-800" />
                {field.label}
              </label>
            ))}
          </div>
        </section>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
        {submitting ? (
          <button type="button" disabled className="rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-400">Annuler</button>
        ) : (
          <Link href="/products" className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-700">Annuler</Link>
        )}
        <button type="submit" disabled={submitting} className="rounded-lg bg-emerald-800 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-70">
          {submitting ? (imagePending ? "Envoi de l’image..." : "Enregistrement...") : "Enregistrer le produit"}
        </button>
        <span role="status" className="sr-only">{submitting ? "Enregistrement..." : ""}</span>
      </div>
    </form>
  );
}
