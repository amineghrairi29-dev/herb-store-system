> Current classification/product measurement behavior is documented in [CLASSIFICATIONS-V1.md](CLASSIFICATIONS-V1.md). Category/subcategory records below are retained for compatibility; they no longer determine product classification or measurement.

# Public Product Catalogue V1

Implemented 7 September 2026. Catalogue only: no cart, accounts, orders, checkout, reservations, payments, delivery or stock mutation. No package, database schema, Product model or existing business-rule changes.

## Files

Created:

- `backend/src/public-catalogue/catalogue-query.ts`
- `backend/src/public-catalogue/catalogue-query.spec.ts`
- `backend/src/public-catalogue/public-product.dto.ts`
- `backend/src/public-catalogue/public-catalogue.service.ts`
- `backend/src/public-catalogue/public-catalogue.controller.ts`
- `backend/src/public-catalogue/public-catalogue.module.ts`
- `backend/test/public-catalogue.e2e-spec.ts`
- `frontend/src/types/public-product.ts`
- `frontend/src/app/shop/layout.tsx`
- `frontend/src/app/shop/page.tsx`
- `frontend/src/app/shop/catalogue.tsx`
- `frontend/src/app/shop/shop-components.tsx`
- `frontend/src/app/shop/products/[id]/page.tsx`
- `frontend/src/app/shop/loading.tsx`
- `frontend/src/app/shop/error.tsx`
- `frontend/src/app/shop/not-found.tsx`
- `frontend/scripts/verify-shop.mjs`
- `PUBLIC-CATALOGUE-V1.md`

Modified: `backend/src/app.module.ts` registers PublicCatalogueModule.

Generated validation screenshots: `.tmp/shop-validation-1788780221591/1280.png`, `768.png`, `390.png`. Build outputs are generated normally.

## API contract

- `GET /public/products`
- `GET /public/products/:id`
- `GET /public/categories`: distinct `{ category, subcategory }` pairs from visible products, used for both filters.

Explicit public response allowlist: `id`, `sku`, `name`, `nameFr`, `scientificName`, `category`, `subcategory`, `salePrice`, `saleUnit`, `packaging`, `origin`, `description`, `availabilityStatus`.

Both list and detail require **isActive AND isSellable AND isVisibleOnline**. Missing, inactive, non-sellable and hidden IDs return the identical public-safe 404 response. There are no mutation endpoints in this module. SQL projections exclude exact stock, thresholds, warehouse location, timestamps, flags, movement history, supplier/cost information and internal notes.

Availability uses existing StockMovement.quantityInStorageUnit and the existing exported positiveTypes list: ENTRY, ADJUSTMENT_IN, RETURN_IN add stock; the other supported movement types subtract it. SQL numeric SUM and comparisons retain decimal precision:

- stock <= 0: OUT_OF_STOCK / Rupture de stock;
- stock > 0 and minStock is defined and stock <= minStock: LOW_STOCK / Stock limité;
- otherwise IN_STOCK / Disponible.

The positive-stock low threshold matches the back-office stock view. No independent stock storage or quantity conversions were introduced. Out-of-stock products remain visible if their three visibility flags pass.

The backend bulk-aggregates movements joined to visible products, then filters and paginates in PostgreSQL. List requests issue two bulk SELECTs (count and page), regardless of page size. Both execute in one REPEATABLE READ, READ ONLY transaction for a consistent snapshot. Detail uses one aggregate SELECT; categories one DISTINCT SELECT. There is no per-product query loop or frontend stock fetch. Aggregation is repeated for count/page and currently considers visible stock history; larger catalogues may warrant query-plan/index tuning, without introducing a separate inventory.

Queries:

- `q`: literal, case-insensitive substring search across name, French name, scientific name, category and subcategory; `%` and `_` are literal search characters.
- `category`, `subcategory`: exact values from the public category source.
- `availability`: OUT_OF_STOCK, LOW_STOCK or IN_STOCK.
- `sort`: name_asc (default), name_desc, price_asc, price_desc. Numeric prices are sorted before their text projection; ID breaks ties.
- `page`: positive integer, default 1.
- `pageSize`: positive integer, default 24, capped at 60.
- Unknown parameters, arrays, invalid enums/integers and values over 200 characters are rejected with 400. Query values are parameterized; sort fragments are allowlisted.

Response: `{ data: PublicProduct[], pagination: { page, pageSize, totalItems, totalPages } }`. Empty totals have totalPages 0. Out-of-range pages have empty data and preserve total counts.

## Storefront

`/shop` has a separate French public shell, search, category/subcategory and availability filters, sorting, responsive cards and URL-based pagination. Filter submissions reset the page. Loading, filtered-empty, global-empty and retryable error states are included. Requests are uncached; API failures remain visible in console diagnostics.

`/shop/products/[id]` fetches only the public endpoint, shows product details and a neutral future-ordering message. Missing/hidden products show the public-safe not-found view. French/Arabic names use UTF-8 and bidirectional isolation.

Price formatting reuses exact string formatting: no floating-point money conversion, no separate online price. Existing units display as kg, g, L, ml or pièce. A G sale unit is priced per g, not an invented 100 g basis.

The Product model has no images. ProductVisual is an isolated, generic inline SVG leaf placeholder with no external image URLs. Replace this component when real image support is designed. “Herb Store” is a generic project-name placeholder, with no invented company/legal details.

The existing admin shared product form already includes **Visible en ligne** mapped to isVisibleOnline, so no admin form change was needed.

## Validation results

- Backend build and TypeScript noEmit: passed.
- Backend unit suite: 165 tests passed.
- Full database integration suite, sequential files: 64 tests passed across 13 files.
- Catalogue integration cases cover all visibility exclusions, identical hidden/missing 404s, zero-stock retention, all six movement directions, low threshold equality, exact decimal price, French/Arabic search, category/subcategory, availability, both name/price sort directions, stable pagination, cap, query rejection, DTO allowlist, fixed two-query list behavior, and unchanged business/stock data.
- Frontend lint: passed without warnings after correcting the validation script.
- Frontend production build: passed, including both dynamic shop routes.
- Live `/shop`: HTTP 200; public list/categories: HTTP 200.
- CORS preflight: HTTP 204, Access-Control-Allow-Origin http://localhost:3000. Browser fetches succeeded without CORS workarounds.
- Isolated headless Chrome: live backend search, category scope, availability, exact price, price sorting, 24+3 pagination, Arabic detail page, hidden API 404, simulated 503 and retry, desktop 1280px, tablet 768px and mobile 390px with no viewport overflow. Browser API traffic was exclusively public GET requests.
- UUID-scoped database fixtures were created only for tests and removed in finally/afterAll cleanup. No existing product flags or stock were changed. Browser validation compared full product, stock movement, sale and cash snapshots before/after requests and after cleanup.

An initial integration failure identified lexicographic price sorting; qualifying the numeric source column fixed it and the complete integration suite subsequently passed.

Existing warnings: backend lint reports no-unsafe-finally at `backend/test/stock-movements.e2e-spec.ts:81`; Vitest reports the existing vite-tsconfig-paths migration notice. No implementation blocker remains.

## Exact manual steps

1. In backend run `npm.cmd run start:dev`, and in frontend run `npm.cmd run dev`, if these servers are not already running.
2. Open `http://localhost:3000/shop`. The current real dataset has no eligible public products, so the global-empty message is expected until you intentionally publish a product.
3. In a disposable development dataset, create A with Actif, Vendable and Visible en ligne enabled. Give it stock greater than its minimum via the existing stock-entry form. Use an Arabic name and a decimal sale price. Create B with all three flags enabled but no movements. Create C with Visible en ligne disabled. Optionally create D with positive stock equal to its minimum.
4. Reload `/shop`: A shows Disponible, B shows Rupture de stock, D shows Stock limité, and C is absent. A's displayed price uses its configured saleUnit. Do not change real stock merely to test this page.
5. Search A's Arabic/French/scientific name. Choose category/subcategory and each availability filter, click Rechercher, and verify results. Test all sort options. Search an unmatched term for the filtered-empty message; Réinitialiser clears filters.
6. With more than 24 visible test products, use Suivant/Précédent. Alternatively set `pageSize=1` in the shop URL for a small dataset. Verify URL page changes and no duplicates across stable pages.
7. Open A's card. Check names, category, optional details, exact price/unit, availability and Retour au catalogue. Directly request `/public/products/C_ID` and confirm 404; `/shop/products/C_ID` shows Produit introuvable. Repeat after disabling Actif or Vendable on a disposable product.
8. Stop the backend briefly, reload `/shop`, verify Impossible de charger le catalogue, restart the backend and click Réessayer.
9. Check desktop, tablet and mobile widths. Compare the back-office stock before/after catalogue browsing: viewing must never mutate it.

Repeat automated checks from backend with `npm.cmd run build`, `npm.cmd exec tsc -- --noEmit`, `npm.cmd run test`, then `$env:RUN_DATABASE_TESTS='1'; npm.cmd run test:e2e -- --no-file-parallelism`. From frontend run `npm.cmd run lint` and `npm.cmd run build`. The optional browser script requires backend/frontend running and isolated headless Chrome with remote debugging on port 9223; run `node scripts/verify-shop.mjs` from frontend. Do not run fixture-based suites concurrently with one another because they compare whole-database snapshots.

API origin defaults to localhost:3001; NEXT_PUBLIC_API_URL can configure the storefront for another environment. Production origin/CORS and real branding/image assets remain deployment configuration concerns. This V1 adds no ordering capability.
