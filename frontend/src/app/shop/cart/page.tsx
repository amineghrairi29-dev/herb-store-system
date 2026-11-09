import type { Metadata } from "next";
import CartPage from "./cart-page";
export const metadata: Metadata = { title: "Votre panier" };
export default function Page() { return <CartPage />; }
