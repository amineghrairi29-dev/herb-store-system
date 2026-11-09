import SaleDetails from "../sale-details";
export const metadata = { title: "Détail de la vente" };
export default async function SalePage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <SaleDetails key={id} id={id} />; }
