import Link from "next/link";
import { apiBase } from "@/lib/api-base";
import type { PublicClassification } from "@/types/public-product";
import ScrollReveal from "../storefront/scroll-reveal";
import { needTint } from "../besoins/need-tints";


/** "Que cherchez-vous aujourd’hui ?": needs that currently have products. */
export default async function HomeNeeds() {
  let needs: PublicClassification[] = [];
  try {
    const response = await fetch(`${apiBase}/public/classifications?withProducts=true`, { next: { revalidate: 120 }, signal: AbortSignal.timeout(5000) });
    if (response.ok) needs = await response.json() as PublicClassification[];
  } catch { /* Section hidden if the API is unreachable. */ }
  if (!needs.length) return null;
  return (
    <section className="h-section h-needs" aria-labelledby="needs-title">
      <div className="h-heading">
        <div><p className="h-eyebrow">Par besoin</p><h2 id="needs-title">Que cherchez-vous aujourd’hui ?</h2></div>
        <p className="h-heading-note">Choisissez un besoin : nous vous montrons les plantes et les recettes qui y répondent.</p>
      </div>
      <ScrollReveal className="h-reveal h-needs-grid">
        {needs.slice(0, 8).map((need, index) => {
          const [bg, ink] = needTint(index); // each tile in turn, so the grid reads as a colorful shelf
          return (
            <Link key={need.id} href={`/shop/besoins/${encodeURIComponent(need.slug)}`} className="h-need" style={{ "--i": index, "--tile": bg, "--tile-ink": ink } as React.CSSProperties}>
              <span lang="ar" dir="rtl" className="h-need-ar">{need.nameAr}</span>
              <span className="h-need-fr"><bdi>{need.nameFr}</bdi></span>
              <span className="h-need-go" aria-hidden="true">→</span>
            </Link>
          );
        })}
      </ScrollReveal>
    </section>
  );
}
