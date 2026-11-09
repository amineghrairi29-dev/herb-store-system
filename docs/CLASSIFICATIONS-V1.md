# Required product classifications / needs

## Current drawer workflow

There are no default active needs. The seven unused local starter rows were deactivated (not deleted); all product links and other business tables were preserved. The cleanup script no longer seeds or reactivates anything; its starter names/IDs identify historical rows solely for safe deactivation when unlinked.

ADMIN creates/selects reusable active needs in Product create/edit; at least one active selection is mandatory. The back-office navigation has no classification entry. The homepage has no classification section.

The public header opens an accessible right-side dialog with loading, retry and empty states, Escape/backdrop dismissal and focus restoration. `GET /public/classifications?withProducts=true` returns only active classifications linked to a product eligible for the existing public catalogue (active, sellable, visible online). Out-of-stock public products retain the existing unavailable behavior; no new stock calculation is introduced. The default active-classification endpoint remains available for dedicated-page lookup.

Drawer links open `/shop/besoins/[slug]`; Catalogue remains all public products. Both builds, frontend lint, 16 integration tests and desktop/mobile browser checks passed, including inline creation, multiple links, eligibility rules, drawer dismissal and empty state. Test fixtures were removed and original records verified unchanged. Earlier sections below are historical and superseded by this workflow.

## Need-based cleanup (15 September 2026)

The local cleanup deactivated seven active migrated type classifications and created seven active starter needs: Cheveux, Visage & peau, Digestion & estomac, Articulations, Jambes, Sommeil & détente, Respiration. All migration-provenance classifications are now inactive. Existing links remain untouched; no product needs were guessed.

Run `node scripts/cleanup-classification-needs.mjs` from `backend` to apply the same idempotent transaction elsewhere. It uses migration provenance, not display-name guesses, to identify legacy rows. It reuses matching non-legacy starter names, and verifies hashes of all other public tables before committing. It never writes products, links, stock, orders or accounts.

Product create/edit now requires at least one active classification, including partial edits that omit classification IDs. Existing inactive links may be retained alongside an active need. A product with only inactive links cannot be saved until an active need is selected. ADMIN can continue creating, editing and disabling needs.

Public options now include all active classifications, including starter needs with no products yet. Disabled classifications are excluded from options and product filtering. The management page title is “Besoins produits”. Three existing local products require manual assignment to active needs and remain hidden publicly until then.

Validation: backend/frontend builds and frontend lint passed; 22 integration tests passed covering required active links, multiple links, unused active options, disabled filters, public cart, stock and units. Original business records and links were unchanged by the cleanup.

Cleanup files: `backend/scripts/cleanup-classification-needs.mjs`, `backend/src/classifications/classifications.service.ts`, `backend/src/public-catalogue/public-catalogue.service.ts`, `backend/test/classifications.e2e-spec.ts`, `backend/test/public-catalogue.e2e-spec.ts`, `frontend/src/app/classifications/page.tsx`, `frontend/src/components/classification-picker.tsx`, and this document. The original migration report below describes the earlier migration; the active-link and public-option behavior above supersedes it.

ADMIN manages reusable classifications at `http://localhost:3000/classifications`. Product creation/editing includes a multi-select and an inline “Créer et sélectionner” action. A newly created classification is persisted immediately, selected in the form and available to future products, even if the product form is subsequently cancelled.

## Final model

- `Classification`: ID, French/display name, optional Arabic name, stable unique slug, active status, display order, optional existing image path and timestamps. Migration provenance is internal only.
- `ProductClassification`: indexed junction with unique `(productId, classificationId)` and foreign keys. Product deletion cascades only its links; classification deletion is restricted when referenced. No classification delete endpoint exists.
- `Product.measurementMode`: WEIGHT, VOLUME, WEIGHT_AND_VOLUME (existing equivalent retained) or FLEXIBLE. Allowed units derive from this field alone, never from a classification. Existing storage/sale units, conversion factors and stock-history restrictions remain authoritative.
- Every product create requires a nonempty `classificationIds` array and a measurement mode. Updates validate the resulting link set even when the array is omitted; an explicit empty array is rejected. IDs are bounded, validated and deduplicated. Product data and link replacement commit in one transaction.
- Existing inactive links may be retained during editing, but cannot be newly assigned. Disabling a classification preserves its links. Products with another active classification remain visible; products with no active classification are hidden publicly until reclassified/reactivated. Existing product visibility flags still apply.
- ADMIN-only authorization uses the existing internal guard. Customer authentication, checkout sessions and order workflows are unchanged.

## APIs and storefront

- ADMIN: `GET /classifications`, `POST /classifications`, `PATCH /classifications/:id`.
- Classification input: required `nameFr`; optional `nameAr`, `isActive`, `sortOrder`. Slugs are generated once and remain stable when names change. No measurement fields are accepted.
- Products use `classificationIds: number[]` and `measurementMode` in POST/PATCH. New writes reject archived `categoryId` and `subcategoryId` inputs.
- Public: `GET /public/classifications`, `GET /public/products?classification=<id-or-slug>`, and existing product detail/cart endpoints.
- Homepage options are loaded dynamically from active classifications with public products. The catalogue offers one simple need filter. Indexed EXISTS predicates avoid duplicate products/counts when multiple links match. Customer responses include only public classification names/IDs/slugs, never internal provenance, measurement configuration or stock balances.
- Product cards, details and cart display classification labels. Stock availability, exact decimal pricing and cart quantities retain their existing calculation paths.
- The old public categories endpoint and singular category/subcategory DTO keys remain compatibility aliases, not the classification source. The singular category is the first active classification; subcategory is null. The public UI uses the classification array and new need filter. Old category management pages redirect to `/classifications`.

## Migration / data handling

Applied locally using the existing Prisma contract/migration workflow:

`backend/migrations/app/20260914T1459_product_classifications`

1. Add classification and junction tables, indexes and foreign keys; add product measurement mode. Widen legacy product category references to nullable so new products do not need an obsolete category.
2. Copy every existing category into a classification, preserving its name, slug, image, status/order and timestamps. Internal migration categories remain inactive.
3. Copy subcategories into independent classifications with unique generated legacy slugs. Their effective active status includes the former parent's status, preserving existing visibility.
4. Link every existing product to its former category and, where present, former subcategory classifications.
5. Copy each existing category's measurement mode onto its products. Existing units and conversion factors are not changed.

Original Category/Subcategory tables, IDs, relations and historical text are retained for compatibility/history. They no longer classify public products or determine units for product writes. Their older API is not the classification management API. No business records, images or users were deleted. No example needs were automatically imposed on existing products; ADMIN can create the desired needs and reclassify them deliberately.

Before/after hashes verified all original product fields (apart from the added measurement field), business ledgers, categories, images, accounts and customer sessions remained unchanged. Every product received links, migrated measurement modes matched, and the set of visible products stayed the same.

For another environment, pause old application writers, back up the database using the existing procedure, deploy the updated contract and run from `backend`:

```powershell
.\node_modules\.bin\prisma.cmd db migrate --show
.\node_modules\.bin\prisma.cmd db migrate --advance-ref db
.\node_modules\.bin\prisma.cmd migration status
```

Restart the updated backend/frontend together. Use the API/service for product writes: the nonempty relation invariant is enforced transactionally by ProductsService, not by a cross-table PostgreSQL CHECK. Direct SQL import tooling must supply junction links explicitly; regression fixtures now do so.

## Manual verification

1. Sign in as ADMIN at `/login`. Open `/classifications`, create Cheveux and Visage, rename a classification and verify its slug/navigation remains stable.
2. Open `/products/new`. Fill the existing required fields and image, leave classifications empty and submit: saving must be blocked. Select both needs and create another need inline; verify changing needs does not change measurement mode or units.
3. Save and reopen the product. All selected classifications must remain selected. Try removing every classification on edit: saving must be rejected. Existing image/price/unit fields must remain unchanged unless explicitly edited.
4. Make the disposable product public using the existing visibility flags. Open `/shop` and each corresponding `/shop/catalogue?classification=<slug>` link. The product should appear once in each matching list, with the current classification names.
5. Disable one linked classification. Its links remain in ADMIN editing and disappear publicly; another active classification keeps the product visible. Disabling all of its classifications hides it publicly. Reactivation restores the normal visibility behavior.
6. Use disposable stock only to verify the normal conversion/negative-stock rules. Classification changes must not change the ledger, unit conversion, price or stock quantity.

## Files created / modified

Backend implementation:

- `backend/src/app.module.ts`
- `backend/src/classifications/classifications.module.ts` (new)
- `backend/src/classifications/classifications.service.ts` (new)
- `backend/src/products/product-measurement.ts` (new)
- `backend/src/products/dto/create-product.dto.ts`
- `backend/src/products/product-validation.ts`
- `backend/src/products/products.service.ts`
- `backend/src/categories/category-validation.ts`
- `backend/src/public-catalogue/catalogue-query.ts`
- `backend/src/public-catalogue/public-product.dto.ts`
- `backend/src/public-catalogue/public-catalogue.controller.ts`
- `backend/src/public-catalogue/public-catalogue.service.ts`
- `backend/src/stock-movements/stock-read.ts` (public eligibility only; stock arithmetic unchanged)
- `backend/src/audit/audit-values.ts`

Schema/generated artifacts:

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/migrations/app/20260914T1459_product_classifications/migration.ts` (new)
- `backend/migrations/app/20260914T1459_product_classifications/migration.json` (new)
- `backend/migrations/app/20260914T1459_product_classifications/ops.json` (new)
- `backend/migrations/app/refs/db.json`
- `backend/migrations/snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract.json` (new)
- `backend/migrations/snapshots/7d9773f7979953668848d3d7fcd89e8b5ea1e096ad1a1338b3982dfa4878aabf/contract.d.ts` (new)

Frontend:

- `frontend/src/types/classification.ts` (new)
- `frontend/src/components/classification-picker.tsx` (new)
- `frontend/src/app/classifications/page.tsx` (new)
- `frontend/src/components/auth-provider.tsx`
- `frontend/src/app/products/product-form.tsx`
- `frontend/src/types/create-product.ts`
- `frontend/src/types/product.ts`
- `frontend/src/types/public-product.ts`
- `frontend/src/types/audit.ts`
- `frontend/src/app/categories/page.tsx`
- `frontend/src/app/categories/new/page.tsx`
- `frontend/src/app/categories/[id]/edit/page.tsx`
- `frontend/src/app/categories/[id]/subcategories/page.tsx`
- `frontend/src/app/shop/page.tsx`
- `frontend/src/app/shop/catalogue.tsx`
- `frontend/src/app/shop/storefront/home-selection.tsx`
- `frontend/src/app/shop/product-card.tsx`
- `frontend/src/app/shop/cart/cart-page.tsx`
- `frontend/src/app/shop/products/[id]/page.tsx`

Tests and fixtures:

- `backend/src/products/product-validation.spec.ts`
- `backend/src/products/product-measurement.spec.ts` (new)
- `backend/test/classifications.e2e-spec.ts` (new)
- `backend/test/category-fixture.ts`
- `backend/test/categories.e2e-spec.ts`
- `backend/test/auth.e2e-spec.ts`
- `backend/test/customer-auth.e2e-spec.ts`
- `backend/test/audit.e2e-spec.ts`
- `backend/test/product-images.e2e-spec.ts`
- `backend/test/products-stock.e2e-spec.ts`
- `backend/test/product-qa.e2e-spec.ts`
- `backend/test/stock-movements.e2e-spec.ts`
- `backend/test/public-catalogue.e2e-spec.ts`
- `backend/test/public-cart.e2e-spec.ts`
- `backend/test/dashboard.e2e-spec.ts`
- `backend/test/finance.e2e-spec.ts`
- `backend/test/reports.e2e-spec.ts`
- `backend/test/online-orders.e2e-spec.ts`
- `backend/test/order-fulfillment.e2e-spec.ts`
- `backend/test/purchases.e2e-spec.ts`
- `backend/test/purchase-payments.e2e-spec.ts`
- `backend/test/sales.e2e-spec.ts`
- `backend/test/sale-payments.e2e-spec.ts`
- `frontend/scripts/verify-admin-policy.mjs`
- `frontend/scripts/verify-classifications.mjs` (new)

Documentation: this file (new), `CATEGORY-MANAGEMENT-V1.md`, `PRODUCT-STOCK-REFERENCES.md`, `PUBLIC-CATALOGUE-V1.md`.

Local `.tmp` contains ignored migration hash snapshots, edit helpers and browser artifacts. Temporary test passwords were generated in memory, not committed or added to application configuration.

## Final validation

- Backend production build: passed.
- Frontend lint and production build: passed.
- Backend unit tests: 29 files, 308 tests passed.
- Backend integration tests: 25 files, 187 tests passed, 1 existing last-active-admin concurrency test skipped to avoid rearranging real active users.
- Backend lint: no errors; existing `no-unsafe-finally` warning at `backend/test/stock-movements.e2e-spec.ts:83` remains.
- Frontend ADMIN navigation policy verification: passed.
- Real browser verification at 1440, 768 and 390 pixels: required selection rejection, inline creation, multiple classification save/reload, management rename, public filtering, homepage links and product details passed. No horizontal overflow, hydration errors or runtime exceptions were observed.
- Product measurement mode, storage/sale units and price remained unchanged when changing classifications. Stock, cart, order, purchase, sale and finance regression suites passed.
- Migration before/after snapshots verified preservation of existing business records, classification coverage for every product and copied measurement modes. Browser fixtures were removed after verification and original-record snapshots matched; security audit entries were retained.

No unresolved implementation blocker. Legacy Category/Subcategory records and compatibility endpoints remain intentionally available as described above; new product and public storefront flows use classifications.
