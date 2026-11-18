import type { Metadata } from "next";
import { Aref_Ruqaa, Fraunces, Inter } from "next/font/google";
import { CartProvider } from "./cart-provider";
import { CustomerAuthProvider } from "./customer-auth-provider";
import StorefrontShell from "./storefront/shell";
import { siteUrl } from "@/lib/site-url";
import "./theme.css";
import "./storefront/storefront.css";
import "./storefront/homepage-layout.css";

// Theme "Feuille et miel": Fraunces for titles, Inter for text, Aref Ruqaa for Arabic.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const arabic = Aref_Ruqaa({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "دار سلومة · Dar Slouma, herboristerie à Gabès depuis 2006", template: "%s | دار سلومة" },
  description:
    "Recettes faites main à Ghannouch (Gabès) depuis 2006, chacune pour un objectif : digestion, sommeil, cheveux… Conseil gratuit, livraison et paiement à la réception.",
  robots: { index: true, follow: true },
  metadataBase: new URL(siteUrl),
  openGraph: {
    siteName: "دار سلومة · Dar Slouma",
    locale: "fr_TN",
    type: "website",
    images: [
      {
        url: "/images/shop/og.jpg",
        width: 1200,
        height: 630,
        alt: "Herbes, mortier et huile de la boutique Dar Slouma",
      },
    ],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/icon.svg" },
};
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`slouma-theme ${display.variable} ${body.variable} ${arabic.variable}`}>
      <CartProvider>
        <CustomerAuthProvider>
          <StorefrontShell>{children}</StorefrontShell>
        </CustomerAuthProvider>
      </CartProvider>
    </div>
  );
}
