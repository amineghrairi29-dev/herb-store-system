import SupplierForm from "../../supplier-form";
export const metadata = { title: "Modifier le fournisseur" };
export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupplierForm key={id} id={id} />;
}
