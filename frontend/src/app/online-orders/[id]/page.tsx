import OrderDetails from "../order-details";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <OrderDetails id={id} />; }
