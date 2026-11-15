import type { Metadata } from "next";
import { Aref_Ruqaa, Fraunces, Inter } from "next/font/google";
import { CartProvider } from "./cart-provider";
import { CustomerAuthProvider } from "./customer-auth-provider";
import StorefrontShell from "./storefront/shell";
import "./theme.css";
import "./storefront/storefront.css";
import "./storefront/homepage-layout.css";

// Theme "Feuille et miel": Fraunces for titles, Inter for text, Aref Ruqaa for Arabic.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const arabic = Aref_Ruqaa({ subsets: ["arabic", "latin"], weight: ["400", "700"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  title: { default: "دار سلومة · Dar Slouma, herboristerie à Gabès depuis 2006", template: "%s | دار سلومة" },
  description: "Herboristerie à Ghannouch (Gabès) depuis 2006 : plantes, mélanges et épices, conseils personnalisés, livraison et paiement à la réception.",
  robots: { index: true, follow: true },
};
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`slouma-theme ${display.variable} ${body.variable} ${arabic.variable}`}>
      <CartProvider>
        <CustomerAuthProvider><StorefrontShell>{children}</StorefrontShell></CustomerAuthProvider>
      </CartProvider>
    </div>
  );
}
