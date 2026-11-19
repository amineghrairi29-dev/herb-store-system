import { notFound } from "next/navigation";

// Unknown /shop/… addresses show the shop's own "page not found", inside the shop layout.
export default function MissingShopPage() {
  notFound();
}
