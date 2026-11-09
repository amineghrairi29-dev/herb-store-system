> Current classification/product measurement behavior is documented in [CLASSIFICATIONS-V1.md](CLASSIFICATIONS-V1.md). Category/subcategory records below are retained for compatibility; they no longer determine product classification or measurement.

# Category & Subcategory Management V1

Implemented on 2026-09-11. Review at http://localhost:3000/categories (ADMIN), http://localhost:3000/products/new, and http://localhost:3000/shop.

## Classification and measurement

Category stores `id`, required `nameAr`/`nameFr`, globally unique `slug`, `measurementMode`, `isActive` (default true), `sortOrder` (default 0), timestamps, and the protected `isInternal` migration flag. Measurement modes use a database CHECK constraint, consistent with the project's existing controlled string values. Normal category editors cannot set `isInternal`; the migration category cannot be edited or activated.

Subcategory stores `id`, required `categoryId`, `nameAr`, `nameFr`, `slug`, `isActive`, `sortOrder`, and timestamps. Slugs are unique within their parent. Product now requires `categoryId` and accepts nullable `subcategoryId`. A composite foreign key `(categoryId, subcategoryId)` enforces subcategory membership in the database, including for direct SQL writes.

The sole compatibility mapping is `backend/src/categories/category-validation.ts`. Protected category responses expose `allowedUnits`; the product form consumes that array rather than maintaining its own measurement mapping.

| Mode | Allowed storage and sale units | Initial categories |
| --- | --- | --- |
| WEIGHT | G, KG | أعشاب / Herbes; بهارات / Épices |
| VOLUME | ML, L | زيوت وسوائل طبيعية / Huiles et liquides naturels |
| WEIGHT_AND_VOLUME | G, KG, ML, L | عطورات / Parfums |
| FLEXIBLE | G, KG, ML, L, PIECE | الخلطات الخاصة / Mélanges spéciaux |

PIECE is deliberately not enabled for VOLUME. This task does not introduce bottled-item packaging rules. Existing quantity conversion and stock arithmetic are unchanged.

Only Huiles et liquides naturels initially has subcategories: زيوت طبيعية / Huiles naturelles and مياه طبيعية / Eaux naturelles. These are seed data, not frontend constants. Editors can add more categories/subcategories or change their names, modes, order, and active status.

## Applied migration and preservation

Formal Prisma 8 migration: `backend/migrations/app/20260911T0137_category_management_v1`.

The supported sequence was contract emit, migration plan, fill/self-emit the generated data transforms, `prisma db migrate --show`, `prisma db migrate --advance-ref db`, and migration status. The read-only preview contained exactly this one migration; it was applied successfully. Status is up to date at contract hash `6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d`.

The migration creates tables, adds initially nullable product columns, seeds data, backfills relations, then applies NOT NULL, unique constraints, indexes, and foreign keys. The NOT NULL operation is classified as destructive by the planner, but occurs only after every product has a valid category. No table, column, product, stock row, or document was removed.

Exact case-sensitive Arabic/French category-name matches are mapped only when both existing units are compatible. Exact subcategory-name matches are mapped only inside the matched parent. There is no fuzzy matching. Unmatched category names or incompatible units go to inactive `internal-unclassified`, named `À classer (migration)` / `غير مصنف`, with FLEXIBLE units. It can never be exposed publicly or selected for a new assignment. Staff must reclassify these products manually.

Legacy `category`/`subcategory` columns are retained to preserve migration data. They are no longer accepted as product write input or used for public filtering. Staff product display labels are resolved from relations, so category renames appear automatically. Product writes maintain those legacy columns as compatibility labels; they should not be used by new integrations.

Local migration results:

| Item | Count |
| --- | ---: |
| Initial business categories created | 5 |
| Internal inactive migration category | 1 |
| Initial subcategories created | 2 |
| Existing products | 1 |
| Products auto-mapped | 0 |
| Products requiring manual classification | 1 |

`backend/scripts/verify-category-preservation.mjs` saved counts and SHA-256 hashes of existing public-table records before migration and compared them afterward, excluding only the two newly added product relation fields and new classification tables. All compared data remained identical, including existing product fields, users, sessions, stock, purchase/sale history, and audit history. Disposable test fixtures were removed and the check passed again.

The local shop is currently empty because its one existing product requires classification. No business flags or stock were changed to force it to appear. Reclassify it only after deciding its correct business category.

## APIs, roles, and audit

| Endpoint | Access/behavior |
| --- | --- |
| GET /categories | Staff; includes allowedUnits and nested subcategories |
| POST /categories | ADMIN create |
| GET /categories/:id | Staff detail |
| PATCH /categories/:id | ADMIN update or activate/deactivate |
| GET /categories/:id/subcategories | Staff read |
| POST /categories/:id/subcategories | ADMIN create under active parent |
| PATCH /subcategories/:id | ADMIN update or activate/deactivate |
| GET /public/categories | Public, active categories containing eligible products; nested active, nonempty subcategories |

Category API reads and writes and category management pages are ADMIN-only. Existing Origin checks and audit context apply. There are no deletion endpoints.

Audit actions: CATEGORY_CREATE, CATEGORY_UPDATE, CATEGORY_ACTIVATE, CATEGORY_DEACTIVATE, SUBCATEGORY_CREATE, SUBCATEGORY_UPDATE, SUBCATEGORY_ACTIVATE, SUBCATEGORY_DEACTIVATE. A status change records both UPDATE and the explicit activation/deactivation action within the same transaction. Metadata contains allowed changed-field names and before/after active flags, not complete request bodies. Existing actor snapshots are retained. The audit UI recognizes and filters the new action/entity types.

Product creation/update locks the selected category before checking active status and compatible units. Category mode edits use the same lock and reject any mode incompatible with attached products. Subcategory edits also serialize on the parent. Existing product-row locking and the prohibition on unit/conversion changes after stock movements remain. Changing categories cannot bypass stock history restrictions. Category editors do not acquire product locks, avoiding an inverse lock order.

Unit compatibility is enforced at the application transaction boundary. Direct database writers must use the services or enforce the same compatibility rules; the database separately enforces mode values and relationship membership.

## Frontend and public behavior

- `/categories`: order, Arabic/French names, mode, status, subcategory count, edit, activate/deactivate, subcategory management.
- `/categories/new`: create category.
- `/categories/[id]/edit`: edit category.
- `/categories/[id]/subcategories`: create/edit/activate/deactivate subcategories without changing their parent.
- Product create/edit: active category selection, dependent subcategories, backend-supplied unit options. Incompatible unit selections clear on category change. Existing inactive relations remain visible as disabled retained options and are preserved until explicitly changed; an inactive-category warning explains public invisibility.
- All forms retain loading, error, pending/disabled states and cancellation. French labels and Arabic values are preserved as UTF-8. Tables scroll within their container on narrow screens.
- Homepage category cards come from the API with no fixed count cap. Existing visual placeholders and styles remain unchanged.
- Public category ordering is sortOrder, nameFr, id. Public category DTOs expose only id, slug, nameAr, nameFr and nested safe subcategories. Public product category/subcategory fields are safe objects; inactive subcategories become null.
- Catalogue category filters accept relation slugs or IDs; dependent subcategory filters use IDs. Search, availability, ordering, and pagination remain supported. Legacy free-text category URLs no longer define filters.
- An inactive parent hides its products from list, detail, category cards, filters, and the shared public cart/order eligibility query, regardless of product visibility flags. An inactive subcategory does not hide an otherwise eligible product under an active parent.

## Validation

- Backend production build and `tsc --noEmit -p tsconfig.build.json`: passed.
- Existing backend unit suite: 280 passed. New category unit suite: 6 passed.
- Existing database integration suite: 157 passed, 1 existing skip. New category integration suite: 9 passed.
- Focused rerun after staff-label/inactive-relation improvements: category, transactional product, and product-QA suites, 17 passed.
- Frontend lint and production build: passed, including all four category routes.
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Browser widths: 1920, 1440, 1024, 768, 390. No document horizontal overflow, captured console errors, or hydration errors. Narrow tables intentionally scroll internally.
- Browser evidence: `.tmp/categories-1789091902178/` (35 screenshots and result.json). Harness: `frontend/scripts/verify-categories.mjs`.
- Tests use UUID-owned fixtures, never destructive movements on pre-existing stock. Generated test credentials are kept in memory; fixture users, sessions, products, categories, and test-owned audit events are removed afterward.
- Migration status and business-data preservation: passed.

The frontend production configuration requires `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` in the local shell for build/start. The first build attempt without it correctly failed; rebuilding with the existing required configuration passed. Chrome initially failed because its sandboxed GPU process could not start; an approved headless session outside the sandbox completed the checks. Existing tooling warnings remain: Vitest's tsconfig-paths deprecation, Prisma's skill-sync notice, and the pre-existing no-unsafe-finally warning in the stock movement test. No packages were installed.

## Exact manual verification

1. Keep the backend on http://localhost:3001 and frontend on http://localhost:3000. Log into http://localhost:3000/login with an existing ADMIN.
2. Open http://localhost:3000/categories. Confirm the five bilingual business categories, their modes, the two oil subcategories, and the inactive internal migration row.
3. Click Ajouter une catégorie. Use a disposable name and unique lowercase slug, select a mode/order, save, then Modifier. Confirm names/order update. Open Gérer sous-catégories, create a disposable subcategory, edit its names/order, deactivate, and reactivate it.
4. Open http://localhost:3000/products/new. Select Herbes or Épices: only G/KG. Select Huiles et liquides naturels: only ML/L and the two initial subcategories. Select Parfums: G/KG/ML/L. Select Mélanges spéciaux: those plus PIECE. Select a unit then change to an incompatible category: the unit must clear and prevent submission until selected again.
5. Create a disposable product under your disposable category/subcategory, using compatible units, a positive decimal price/factor, and active/sellable/visible flags. Zero-stock products are eligible for browsing and display unavailable; no stock movement is needed for this check. Edit it and verify category/subcategory selections are prefilled.
6. Open http://localhost:3000/shop. The eligible category card appears. Click it: http://localhost:3000/shop/catalogue filters by slug. Choose the dependent subcategory and submit. Verify search, availability, sort, and pagination still work.
7. Deactivate the disposable subcategory. Its filter disappears, but its product remains public under the active parent. Edit/save another product field; the existing inactive subcategory relation remains unless explicitly cleared.
8. Deactivate the disposable parent category. Its card and products disappear publicly; a direct product URL returns unavailable. Reactivate it: eligible products and the card return. Empty categories do not appear publicly.
9. With a disposable product that has stock history, try switching to an incompatible category or changing its units/factor: the backend rejects it. Do not alter real stock for this check. Try changing a category's mode while attached products use incompatible units: it is rejected.
10. Verify ADMIN access and customer-only denial for internal pages/APIs. See [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md) for current checks and migration behavior.
11. Inspect at desktop/tablet/mobile widths. Check the console and use the horizontal table scroll on mobile. Only manually reclassify the existing real product after confirming its correct category.

## Files created or modified

Backend implementation:

- `backend/src/categories/category-validation.ts` (new)
- `backend/src/categories/categories.service.ts` (new)
- `backend/src/categories/categories.module.ts` (new)
- `backend/src/app.module.ts`
- `backend/src/auth/auth-policy.ts`
- `backend/src/audit/audit-values.ts`
- `backend/src/products/dto/create-product.dto.ts`
- `backend/src/products/product-validation.ts`
- `backend/src/products/products.service.ts`
- `backend/src/public-catalogue/public-product.dto.ts`
- `backend/src/public-catalogue/public-catalogue.service.ts`
- `backend/src/stock-movements/stock-read.ts` (public eligibility only)

Schema/generated migration artifacts:

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/migrations/app/20260911T0137_category_management_v1/migration.ts` (new)
- `backend/migrations/app/20260911T0137_category_management_v1/migration.json` (new)
- `backend/migrations/app/20260911T0137_category_management_v1/ops.json` (new)
- `backend/migrations/snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract.json` (new)
- `backend/migrations/snapshots/6e91f5c26553331f9da6118b3140914d7e98e4444c51335eee893671a40e3b6d/contract.d.ts` (new)
- `backend/migrations/app/refs/db.json`

Frontend implementation:

- `frontend/src/types/category.ts` (new)
- `frontend/src/app/categories/category-workspace.tsx` (new shared management forms/table)
- `frontend/src/app/categories/page.tsx` (new)
- `frontend/src/app/categories/new/page.tsx` (new)
- `frontend/src/app/categories/[id]/edit/page.tsx` (new)
- `frontend/src/app/categories/[id]/subcategories/page.tsx` (new)
- `frontend/src/components/auth-provider.tsx`
- `frontend/src/types/audit.ts`
- `frontend/src/types/product.ts`
- `frontend/src/types/create-product.ts`
- `frontend/src/types/public-product.ts`
- `frontend/src/app/products/product-form.tsx`
- `frontend/src/app/shop/storefront/home-selection.tsx`
- `frontend/src/app/shop/catalogue.tsx`
- `frontend/src/app/shop/products/[id]/page.tsx`
- `frontend/src/app/shop/cart/cart-page.tsx` (safe category-name rendering only)

Tests and verification:

- `backend/src/categories/category-validation.spec.ts` (new)
- `backend/src/products/product-validation.spec.ts`
- `backend/test/category-fixture.ts` (new explicit disposable classification fixture)
- `backend/test/categories.e2e-spec.ts` (new)
- `backend/test/audit.e2e-spec.ts`
- `backend/test/auth.e2e-spec.ts`
- `backend/test/cash.e2e-spec.ts`
- `backend/test/customer-auth.e2e-spec.ts`
- `backend/test/dashboard.e2e-spec.ts`
- `backend/test/finance.e2e-spec.ts`
- `backend/test/online-orders.e2e-spec.ts`
- `backend/test/order-fulfillment.e2e-spec.ts`
- `backend/test/product-qa.e2e-spec.ts`
- `backend/test/products-stock.e2e-spec.ts`
- `backend/test/public-cart.e2e-spec.ts`
- `backend/test/public-catalogue.e2e-spec.ts`
- `backend/test/purchase-payments.e2e-spec.ts`
- `backend/test/purchases.e2e-spec.ts`
- `backend/test/reports.e2e-spec.ts`
- `backend/test/sale-payments.e2e-spec.ts`
- `backend/test/sales.e2e-spec.ts`
- `backend/test/stock-movements.e2e-spec.ts`
- `backend/scripts/verify-category-preservation.mjs` (new)
- `frontend/scripts/verify-categories.mjs` (new)
- `CATEGORY-MANAGEMENT-V1.md` (new)

Existing business test fixture changes supply explicit category relations; they do not weaken application validation. Local `.tmp` artifacts include only hashes, screenshots, browser profiles, and verification output and are Git-ignored. No images, packaging redesign, promotional pages, or stock calculations were added.
