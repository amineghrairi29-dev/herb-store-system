import type { Metadata } from "next";
import { CashShell } from "../cash-ui";
import ManualForm from "../manual-form";
export const metadata: Metadata = { title: "Entrée manuelle — Caisse" };
export default function Page() { return <CashShell title="Entrée manuelle"><ManualForm direction="in" /></CashShell>; }
