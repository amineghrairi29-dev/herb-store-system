import Link from "@/components/auth-link";
import SalesTable from "./sales-table";
import { buttonClass, SaleShell } from "./sale-ui";
export const metadata = { title: "Gestion des ventes" };
export default function SalesPage() { return <SaleShell title="Gestion des ventes" action={<Link href="/sales/new" className={buttonClass}>Nouvelle vente</Link>}><SalesTable /></SaleShell>; }
