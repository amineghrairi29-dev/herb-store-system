"use client";
import { useCustomerAuth } from "../customer-auth-provider";
import Checkout from "./checkout";
import "./checkout.css";
/** Guest checkout: an account only pre-fills the form and links the order to the customer. */
export default function CustomerCheckout() {
  const auth = useCustomerAuth();
  if (auth.loading) return <p role="status">Chargement…</p>;
  return <Checkout customer={auth.customer ?? null} />;
}
