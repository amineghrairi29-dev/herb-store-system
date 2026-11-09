import type { Metadata } from "next";
import Link from "@/components/auth-link";
import { CashShell, secondaryClass } from "../cash-ui";
import CashHistory from "./cash-history";
export const metadata: Metadata = { title: "Historique de caisse" };
export default function Page() { return <CashShell title="Historique de caisse" action={<Link href="/cash" className={secondaryClass}>Retour à la caisse</Link>}><CashHistory /></CashShell>; }
