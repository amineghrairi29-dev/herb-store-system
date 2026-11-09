import type { Metadata } from "next";
import Link from "@/components/auth-link";
import { CashShell, buttonClass, secondaryClass } from "./cash-ui";
import CashDashboard from "./cash-dashboard";
export const metadata: Metadata = { title: "Caisse" };
export default function CashPage() {
  return <CashShell title="Caisse" action={<div className="flex flex-wrap gap-2"><Link className={buttonClass} href="/cash/manual-in">Entrée manuelle</Link><Link className={secondaryClass} href="/cash/manual-out">Sortie manuelle</Link><Link className={secondaryClass} href="/cash/movements">Historique</Link></div>}><CashDashboard /></CashShell>;
}
