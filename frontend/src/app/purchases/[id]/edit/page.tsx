import PurchaseForm from "../../purchase-form";
export const metadata = { title: "Modifier l’achat" };
export default async function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PurchaseForm key={id} id={id} />; }
