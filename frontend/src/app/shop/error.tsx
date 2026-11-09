"use client";
import BackLink from "./back-link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-xl bg-red-50 p-6"><p>Impossible de charger le catalogue.</p><button onClick={reset} className="mt-4 mr-5 underline">Réessayer</button><BackLink href="/shop">Retour ? la boutique</BackLink></div>;
}
