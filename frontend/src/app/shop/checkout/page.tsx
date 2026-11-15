import type { Metadata } from "next";
import Checkout from "./customer-checkout";
export const metadata: Metadata = { title: "Passer la commande", robots: { index: false, follow: false } };
export default function Page() {
  return <Checkout />;
}
