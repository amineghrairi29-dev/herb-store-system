import type { Metadata } from "next";
import CustomerAuth from "./customer-auth";

export const metadata: Metadata = { title: "Connexion ou inscription", robots: { index: false, follow: true } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <CustomerAuth
      returnTo={typeof params.returnTo === "string" ? params.returnTo : "/shop/checkout"}
      googleError={params.error === "google"}
    />
  );
}
