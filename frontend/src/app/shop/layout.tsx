import type { Metadata } from "next";
import { CartProvider } from "./cart-provider";
import { CustomerAuthProvider } from "./customer-auth-provider";
import StorefrontShell from "./storefront/shell";
import "./storefront/storefront.css";
import "./storefront/homepage-layout.css";
export const metadata: Metadata = {
  title: { default: "La boutique | Herb Store", template: "%s | Herb Store" },
  description: "Des plantes et des produits naturels à découvrir au quotidien.",
  robots: { index: true, follow: true },
};
export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CustomerAuthProvider><StorefrontShell>{children}</StorefrontShell></CustomerAuthProvider>
    </CartProvider>
  );
}
