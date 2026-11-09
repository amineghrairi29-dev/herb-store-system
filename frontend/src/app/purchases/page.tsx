import Link from "@/components/auth-link";
import PurchasesTable from "./purchases-table";
import { buttonClass, PurchaseShell } from "./purchase-ui";
export const metadata = { title: "Gestion des achats" };
export default function PurchasesPage() { return <PurchaseShell title="Gestion des achats" action={<Link href="/purchases/new" className={buttonClass}>Nouvel achat</Link>}><PurchasesTable /></PurchaseShell>; }
