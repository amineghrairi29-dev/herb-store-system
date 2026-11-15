import type { Metadata } from "next";
import { CashShell } from "../cash-ui";
import ManualForm from "../manual-form";
export const metadata: Metadata = { title: "Sortie manuelle — Caisse" };
export default function Page() { return <CashShell title="Sortie manuelle"><ManualForm direction="out" /></CashShell>; }
