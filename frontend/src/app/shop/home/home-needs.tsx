import Link from "next/link";
import { apiBase } from "@/lib/api-base";
import ProductImage from "@/components/product-image";
import type { CatalogueResponse, PublicCategory, PublicClassification } from "@/types/public-product";
import ScrollReveal from "../storefront/scroll-reveal";
import { Leaf } from "../storefront/leaf";
import { needTint } from "../objectifs/need-tints";

type Jar = PublicClassification & { count: number; photo: string | null };
type Need = PublicClassification & { imagePath?: string | null };

/**
 * Number of recipes and one photo for an objective: the photo chosen in the admin,
 * otherwise the first recipe's. Zero recipes if the API fails.
 */
async function jarOf(need: Need): Promise<Jar> {
  const chosen = need.imagePath ?? null;
  try {
    const params = new URLSearchParams({ classification: need.slug, pageSize: "1", page: "1", sort: "name_asc" });
    const response = await fetch(`${apiBase}/public/products?${params}`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { ...need, count: 0, photo: chosen };
    const result = (await response.json()) as CatalogueResponse;
    return { ...need, count: result.pagination.totalItems, photo: chosen ?? result.data[0]?.mainImagePath ?? null };
  } catch {
    return { ...need, count: 0, photo: chosen };
  }
}

/** Splits the jars into shelves of `size` (each shelf gets its own wooden board). */
function shelves<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

/**
 * "Que cherchez-vous aujourd’hui ?" as a shop shelf: each objective is a jar with a
 * recipe photo, a honey badge with the number of recipes, and its Arabic name. Jars
 * drop onto their shelf as the section comes into view. Phone: one shelf that scrolls.
 */
export default async function HomeNeeds() {
  let needs: Need[] = [];
  try {
    const response = await fetch(`${apiBase}/public/classifications?withProducts=true`, {
      next: { revalidate: 120 },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) needs = (await response.json()) as PublicCategory[];
  } catch {
    /* Section hidden if the API is unreachable. */
  }
  if (!needs.length) return null;
  const jars = await Promise.all(needs.slice(0, 12).map(jarOf));
  return (
    <section className="h-section h-needs" aria-labelledby="needs-title">
      <div className="h-heading">
        <div>
          <p className="h-eyebrow">Par objectif</p>
          <p lang="ar" dir="rtl" className="h-needs-ar">
            شنوّة تحب تداوي؟
          </p>
          <h2 id="needs-title">Que cherchez-vous aujourd’hui ?</h2>
        </div>
        <p className="h-heading-note">
          Choisissez votre objectif : nous vous montrons les recettes préparées pour lui.
        </p>
      </div>
      {shelves(jars, 6).map((row, shelfIndex) => (
        <ScrollReveal key={shelfIndex} className="h-reveal h-shelf">
          <ul className="h-shelf-row">
            {row.map((jar, index) => {
              const [bg, ink] = needTint(shelfIndex * 6 + index);
              return (
                <li key={jar.id} style={{ "--i": index, "--tile": bg, "--tile-ink": ink } as React.CSSProperties}>
                  <Link href={`/shop/objectifs/${encodeURIComponent(jar.slug)}`} className="h-jar">
                    <span className="h-jar-pot">
                      <span className="h-jar-photo">
                        {jar.photo ? (
                          <ProductImage
                            imagePath={jar.photo}
                            name=""
                            className="h-jar-image"
                            sizes="140px"
                            fallback={<span className="h-jar-image" />}
                          />
                        ) : (
                          <span className="h-jar-leaf" aria-hidden="true">
                            <Leaf color={ink} />
                          </span>
                        )}
                      </span>
                      {jar.count > 0 && (
                        <span className="h-jar-count" aria-hidden="true">
                          {jar.count}
                        </span>
                      )}
                    </span>
                    <span lang="ar" dir="rtl" className="h-jar-ar">
                      {jar.nameAr}
                    </span>
                    <span className="h-jar-fr">
                      <bdi>{jar.nameFr}</bdi>
                      <span className="sr-only">
                        , {jar.count} recette{jar.count > 1 ? "s" : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <span className="h-shelf-board" aria-hidden="true" />
        </ScrollReveal>
      ))}
    </section>
  );
}
