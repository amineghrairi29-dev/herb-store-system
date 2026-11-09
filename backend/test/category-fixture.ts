import { Client } from 'pg';
// Explicit fixture relation shared by older business regression suites.
// No defaults or compatibility bypasses are installed in application code/database.
export function categoryFixture() {
  const fixture = { id: 0, subcategoryId: 0, classificationId: 0, subClassificationId: 0, slug: `test-category-${crypto.randomUUID()}`,
    async link(client: Client, productId: number) { await client.query('INSERT INTO public."productClassification" ("productId","classificationId") VALUES ($1,$2) ON CONFLICT DO NOTHING', [productId, fixture.classificationId]); },
  };
  if (process.env.RUN_DATABASE_TESTS !== '1') return fixture;
  beforeAll(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      fixture.id = (await client.query<{ id: number }>('INSERT INTO public.category ("nameAr","nameFr",slug,"measurementMode","updatedAt") VALUES ($1,$1,$1,\'FLEXIBLE\',now()) RETURNING id', [fixture.slug])).rows[0].id;
      fixture.subcategoryId = (await client.query<{ id: number }>('INSERT INTO public.subcategory ("categoryId","nameAr","nameFr",slug,"updatedAt") VALUES ($1,\'أوراق\',\'Feuilles\',\'feuilles\',now()) RETURNING id', [fixture.id])).rows[0].id;
      fixture.classificationId = (await client.query<{ id: number }>('INSERT INTO public.classification ("nameFr",slug,"updatedAt") VALUES ($1,$1,now()) RETURNING id', [fixture.slug])).rows[0].id;
      fixture.subClassificationId = (await client.query<{ id: number }>('INSERT INTO public.classification ("nameFr",slug,"sortOrder","legacySubcategoryId","updatedAt") VALUES ($1,$2,10,$3,now()) RETURNING id', ['Feuilles', fixture.slug + '-feuilles', fixture.subcategoryId])).rows[0].id;
    } finally { await client.end(); }
  });
  afterAll(async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL }); await client.connect();
    try {
      await client.query('DELETE FROM public.classification WHERE id = ANY($1::int[])', [[fixture.classificationId, fixture.subClassificationId]]);
      await client.query('DELETE FROM public.subcategory WHERE "categoryId" = $1', [fixture.id]);
      await client.query('DELETE FROM public.category WHERE id = $1 AND slug = $2', [fixture.id, fixture.slug]);
    } finally { await client.end(); }
  });
  return fixture;
}
