import type { Metadata } from "next";
import TrackOrder from "./track-order";
export const metadata: Metadata = { title: "Suivre ma commande", description: "Suivez votre commande avec sa référence et votre numéro de téléphone." };
export default function Page() { return <TrackOrder />; }
