import PurchaseDetails from "../purchase-details";
export const metadata = { title: "Détail de l’achat" };
export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PurchaseDetails key={id} id={id} />; }
