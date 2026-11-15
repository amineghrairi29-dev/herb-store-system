import { ExpenseShell } from "../expense-ui";
import ExpenseForm from "../expense-form";
export const metadata = { title: "Nouvelle dépense" };
export default function Page() { return <ExpenseShell title="Nouvelle dépense"><ExpenseForm /></ExpenseShell>; }
