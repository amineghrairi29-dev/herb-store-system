import BackLink from '../../back-link';

export default function NeedNotFound() {
  return <section className="py-10 text-center">
    <h1 className="text-3xl font-semibold text-emerald-950">Besoin introuvable</h1>
    <p className="mt-3 text-stone-600">Ce besoin n’est pas disponible dans la boutique.</p>
    <BackLink href="/shop" className="mt-6">Retour à la boutique</BackLink>
  </section>;
}
