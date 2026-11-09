import Link from "@/components/auth-link";
import { ExpenseShell, buttonClass } from "./expense-ui";
import ExpensesTable from "./expenses-table";
export const metadata = { title: "Gestion des dépenses" };
export default function Page() { return <ExpenseShell title="Gestion des dépenses" action={<Link href="/expenses/new" className={buttonClass}>Nouvelle dépense</Link>}><ExpensesTable /></ExpenseShell>; }
