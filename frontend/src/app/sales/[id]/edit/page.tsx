import SaleForm from "../../sale-form";
export const metadata = { title: "Modifier la vente" };
export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SaleForm key={id} id={id} />; }
