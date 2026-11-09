import type { Metadata } from "next";
import Checkout from "./customer-checkout";
export const metadata: Metadata = { title: "Passer la commande" };
export default function Page() { return <Checkout />; }
