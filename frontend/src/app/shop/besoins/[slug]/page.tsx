import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { apiBase } from "@/lib/api-base";
import { getStoreInfo, whatsappLink } from "@/lib/store-info";
import type { CatalogueResponse, PublicClassification, PublicProduct } from "@/types/public-product";
import Catalogue from "../../catalogue";
import ScrollReveal from "../../storefront/scroll-reveal";
import { needTint } from "../need-tints";
import NeedHero from "./need-hero";
import "../needs.css";

const allowed = ["q", "sort", "availability", "page", "pageSize"];

async function loadNeeds(withProducts: boolean): Promise<PublicClassification[]> {
  const response = await fetch(`${apiBase}/public/classifications${withProducts ? "?withProducts=true" : ""}`, { next: { revalidate: 120 } });
  if (!response.ok) throw new Error(`Public needs HTTP ${response.status}`);
  return response.json() as Promise<PublicClassification[]>;
}

/** First products of the need, for the photos of the banner; empty if the API fails. */
async function loadPreview(slug: string): Promise<{ products: PublicProduct[]; total: number }> {
  try {
    const params = new URLSearchParams({ classification: slug, pageSize: "12", page: "1", sort: "name_asc" });
    const response = await fetch(`${apiBase}/public/products?${params}`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { products: [], total: 0 };
    const result = await response.json() as CatalogueResponse;
    return { products: result.data, total: result.pagination.totalItems };
  } catch {
    return { products: [], total: 0 };
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const need = (await loadNeeds(false).catch(() => [])).find((item) => item.slug === slug);
  if (!need) return { title: "Besoin introuvable" };
  const description = `Plantes, mélanges et recettes de دار سلومة pour : ${need.nameFr}. Conseil gratuit, paiement à la livraison.`;
  return { title: `${need.nameFr} · ${need.nameAr}`, description, openGraph: { title: need.nameFr, description } };
}

export default async function NeedPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const [needs, shelf, preview, store] = await Promise.all([loadNeeds(false), loadNeeds(true).catch(() => []), loadPreview(slug), getStoreInfo()]);
  const need = needs.find((item) => item.slug === slug);
  if (!need) notFound();
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (!allowed.includes(key)) continue;
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const position = shelf.findIndex((item) => item.id === need.id);
  const [tint, ink] = needTint(position);
  const photos = preview.products.filter((product) => product.mainImagePath).slice(0, 3).map((product) => ({ id: product.id, name: product.name, path: product.mainImagePath as string }));
  const whatsapp = whatsappLink(store?.phone, `Bonjour, je cherche un conseil pour : ${need.nameFr}`);
  const others = shelf.filter((item) => item.id !== need.id);

  return (
    <div className="nd" style={{ "--tile": tint, "--tile-ink": ink } as React.CSSProperties}>
      <NeedHero need={need} total={preview.total} photos={photos} />

      {others.length > 0 && (
        <nav className="nd-shelf" aria-label="Autres besoins">
          <span className="nd-shelf-label">Autres besoins</span>
          <ul>
            {others.map((item) => {
              const [bg, color] = needTint(shelf.indexOf(item));
              return (
                <li key={item.id}>
                  <Link href={`/shop/besoins/${encodeURIComponent(item.slug)}`} className="nd-chip" style={{ "--chip": bg, "--chip-ink": color } as React.CSSProperties}>
                    <span lang="ar" dir="rtl">{item.nameAr}</span><bdi>{item.nameFr}</bdi>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      <Catalogue key={slug} query={query.toString()} need={need} whatsapp={whatsapp} />

      <ScrollReveal className="nd-reveal">
        <section className="nd-advice" aria-labelledby="nd-advice-title">
          <div>
            <p lang="ar" dir="rtl" className="nd-advice-ar">قلّنا على حاجتك، نعطيوك الوصفة المناسبة</p>
            <h2 id="nd-advice-title">Pas sûr de ce qui vous convient ?</h2>
            <p>Expliquez-nous votre besoin : Slouma vous indique la plante et la préparation qui marchent, gratuitement.</p>
          </div>
          {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="nd-advice-btn">Demander conseil sur WhatsApp</a> : <Link href="/shop/contact" className="nd-advice-btn">Nous contacter</Link>}
        </section>
      </ScrollReveal>
    </div>
  );
}
