import ExpenseRecord from "../../expense-record";
export const metadata = { title: "Modifier la dépense" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ExpenseRecord key={id} id={id} edit />; }
