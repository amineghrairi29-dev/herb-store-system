import type { Metadata } from "next";
import EditProduct from "./edit-product";

export const metadata: Metadata = { title: "Modifier un produit" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main lang="fr" className="min-h-screen flex-1 bg-slate-50 px-4 py-8 font-sans text-slate-900 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700">Catalogue</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Modifier un produit</h1>
          <p className="mt-3 text-sm text-slate-600">Modifiez les informations du produit. Les champs marqués d’un * sont obligatoires.</p>
        </header>
        <EditProduct key={id} id={id} />
      </div>
    </main>
  );
}
