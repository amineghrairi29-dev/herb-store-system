import PaymentForm from "../../../payment-form";
export const metadata = { title: "Ajouter un paiement" };
export default async function NewSalePaymentPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <PaymentForm key={id} id={id} />; }
