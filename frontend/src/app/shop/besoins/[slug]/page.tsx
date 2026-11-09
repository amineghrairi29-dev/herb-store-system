import { notFound } from 'next/navigation';
import { apiBase } from '@/lib/api-base';
import type { PublicClassification } from '@/types/public-product';
import Catalogue from '../../catalogue';
import BackLink from '../../back-link';

export default async function NeedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const response = await fetch(`${apiBase}/public/classifications`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Public needs HTTP ${response.status}`);
  const needs: PublicClassification[] = await response.json();
  const need = needs.find(item => item.slug === slug);
  if (!need) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (!['q', 'sort', 'availability', 'page', 'pageSize'].includes(key)) continue;
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  return <>
    <BackLink href="/shop" className="mb-5">Retour à la boutique</BackLink>
    <Catalogue key={`${slug}?${query}`} query={query.toString()} need={need} />
  </>;
}
