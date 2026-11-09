"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "../customer-auth-provider";
import Checkout from "./checkout";
import "./checkout.css";
export default function CustomerCheckout() {
  const auth = useCustomerAuth(),
    router = useRouter();
  useEffect(() => {
    if (!auth.loading && !auth.customer && !auth.error)
      router.replace("/shop/auth?returnTo=/shop/checkout");
  }, [auth.loading, auth.customer, auth.error, router]);
  if (auth.error)
    return (
      <div role="alert">
        <p>{auth.error}</p>
        <button className="mt-4 underline" onClick={() => void auth.refresh()}>
          Réessayer
        </button>
      </div>
    );
  if (!auth.customer)
    return <p role="status">Vérification de votre session...</p>;
  return <Checkout customer={auth.customer} />;
}
