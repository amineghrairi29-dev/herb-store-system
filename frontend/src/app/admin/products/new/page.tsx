import type { Metadata } from "next";
import ProductForm from "../product-form";

export const metadata: Metadata = {
  title: "Ajouter un produit",
};

export default function NewProductPage() {
  return (
    <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Catalogue</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Ajouter un produit</h1>
          <p className="mt-3 text-sm text-slate-600">Renseignez les informations du produit. Les champs marqués d’un * sont obligatoires.</p>
        </header>
        <ProductForm />
      </div>
    </main>
  );
}
