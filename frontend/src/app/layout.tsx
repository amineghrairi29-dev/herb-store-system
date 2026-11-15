import type { Metadata } from "next";
import { Aref_Ruqaa, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/auth-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Arabic name of the shop in the back-office header (the shop layout loads it too).
const arabic = Aref_Ruqaa({ variable: "--font-arabic", subsets: ["arabic"], weight: ["700"], display: "swap" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Dar Slouma", template: "%s | Dar Slouma" },
  description: "Plantes, herbes, épices et produits naturels sélectionnés avec soin.",
  // Back-office pages stay out of search engines; the shop layout opts back in.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} ${arabic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col"><AuthProvider>{children}</AuthProvider></body>
    </html>
  );
}
