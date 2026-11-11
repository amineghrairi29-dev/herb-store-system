> Current classification/product measurement behavior is documented in [CLASSIFICATIONS-V1.md](CLASSIFICATIONS-V1.md). Category/subcategory records below are retained for compatibility; they no longer determine product classification or measurement.

# Product stock-reference implementation

Implemented and verified on 2026-09-05. This change adds product reference data, not stock movements or editable stock quantities. No opening balance is created; a product has no stock movements and therefore starts conceptually at zero.

## Database changes applied

Database: `herb_store_db`. Table: `public.product`.

| Column | PostgreSQL type | Nullable | Final default |
| --- | --- | --- | --- |
| category | text | No | None |
| subcategory | text | Yes | None |
| storageUnit | text | No | None |
| saleUnit | text | No | None |
| conversionFactor | numeric | No | None |
| minStock | numeric | Yes | None |
| maxStock | numeric | Yes | None |
| location | text | Yes | None |

Four CHECK constraints enforce positive finite conversion factors, nonnegative finite optional minimum/maximum thresholds, and `maxStock >= minStock` when both are present. API validation also checks required text, supported units, decimal strings, and the threshold range for partial PATCH requests merged with existing data.

The reviewed migration strategy was temporary defaults followed by cleanup:

1. Emitted the contract and ran `prisma db update --dry-run --json`.
2. Reviewed eight additive columns and four additive constraints. Planned a formal migration, then used `prisma db migrate --show` to confirm the live database would receive only that delta.
3. Applied the migration using `prisma db migrate --advance-ref db`. Existing rows received category `À classer`, storage/sale units `PIECE`, conversion factor `1`, and null optional fields.
4. Removed the four defaults from the source contract, emitted again, and reviewed another database dry-run. Its only operations were four `ALTER COLUMN ... DROP DEFAULT` statements. These do not erase existing values or remove NOT NULL constraints.
5. Planned and applied the cleanup migration. Future creates must explicitly provide the new required fields.

Prisma generated a baseline package to record the previously unversioned contract in the migration graph. It was **not replayed against the existing database**. Both delta migrations are applied; the database marker and schema match the final contract, and there are no pending migrations.

Existing product `2` / `HERB-0002` / `زعتر` still loads. Its original timestamps remain unchanged. The placeholder category and units are deliberately neutral; review and replace them with the actual classification and units before using this product in future stock operations.

## Frontend behavior

The shared create/edit form has Informations générales, Classification, Unités et stockage, Prix, and Informations complémentaires sections, plus the existing status controls. The list now displays category and storage/sale units. Edit and delete actions remain available.

Decimal inputs use `inputMode="decimal"` to support decimal keyboards and comma input consistently across browsers. Values are validated as decimal text and normalized without floating-point rounding: `12,5` becomes `"12.500"`. Additional fractional precision is retained. Optional thresholds can be cleared to null. Thresholds are labeled as amounts in the storage unit.

## Validation results

- Backend `npm.cmd run build`: passed.
- Backend `npm.cmd exec tsc -- --noEmit`: passed, including migration and test sources.
- Frontend `npm.cmd run lint`: passed.
- Frontend `npm.cmd run build`: passed.
- Prisma contract emit, both database dry-runs, both migrations, and `prisma db verify`: passed.
- `prisma db migrate --show`: already up to date.
- Product validation unit tests: 15 passed.
- Transactional HTTP integration test: passed. It exercised actual Nest routes, product service, Prisma, and PostgreSQL for POST, GET, PATCH, invalid conversion factors, merged threshold validation, nullable-field clearing, booleans, and Arabic text.
- Frontend decimal normalization and exact comparison checks: passed, including comma input and values beyond JavaScript integer precision.
- Live GET list/detail and HTTP requests to create/edit frontend pages: passed.

The integration test created a uniquely named `TEST-STOCK-<UUID>` product **inside an explicitly rolled-back transaction**. No test product remains and no DELETE request was made. PostgreSQL sequences are not rolled back, so the test can leave a harmless gap in product IDs. There is still one persisted product.

To repeat the integration test from `backend` in PowerShell:

```powershell
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e -- test/products-stock.e2e-spec.ts
Remove-Item Env:RUN_DATABASE_TESTS
```

Without that opt-in variable, the database integration test is skipped.

## Issues and limitations

No remaining implementation blocker. Browser interactions were not automated; use the manual steps below.

The first dry-run rejected a numeric Decimal default. Using a string Decimal default fixed it before any database write. The broader TypeScript check also exposed a generated migration getter inference issue; explicit return types fixed it, and self-emitting preserved the applied migration hashes. A transient API 500 occurred while the development watcher had loaded the new contract before the matching schema was applied; live GET requests now succeed.

The installed Prisma CLI warns that its local agent-skill copies are not synced; the implementation used the skill bundled with the installed ORM version directly. Vitest also reports that the existing `vite-tsconfig-paths` plugin could be replaced by native Vite support. Neither warning blocks checks, and no unrelated configuration or dependencies were changed.

## Files created or modified

Application and test files (paths relative to the project root):

```text
backend/src/prisma/contract.prisma
backend/src/prisma/contract.json                         (generated)
backend/src/prisma/contract.d.ts                         (generated)
backend/src/products/dto/create-product.dto.ts
backend/src/products/products.service.ts
backend/src/products/product-validation.ts               (new)
backend/src/products/product-validation.spec.ts          (new)
backend/test/products-stock.e2e-spec.ts                   (new)
frontend/src/types/create-product.ts
frontend/src/types/product.ts
frontend/src/lib/decimal.ts                              (new)
frontend/src/app/products/product-form.tsx
frontend/src/app/products/products-table.tsx
PRODUCT-STOCK-REFERENCES.md                              (new)
```

`UpdateProductDto` already extends `PartialType(CreateProductDto)` and inherits the new fields without a file change.

New migration packages, each containing `migration.ts`, `migration.json`, and `ops.json`:

```text
backend/migrations/app/20260905T1710_baseline/
backend/migrations/app/20260905T1711_product_stock_references/
backend/migrations/app/20260905T1711_remove_product_stock_defaults/
```

Modified migration reference:

```text
backend/migrations/app/refs/db.json
```

New contract snapshots, each containing `contract.json` and `contract.d.ts`:

```text
backend/migrations/snapshots/157aac5039093104db450eef048832e87b4c4bf1ef9c0e9ba08ccf3211dc37ee/
backend/migrations/snapshots/d45f39e1fb1b0150d3608e234d825c1100eba4633f1c411790e4be051afd468f/
```

Standard build output and TypeScript incremental caches were regenerated by the requested checks. No packages were installed.

## Manual test steps

1. Keep the backend running at `http://localhost:3001` and frontend at `http://localhost:3000`. If needed, run `npm.cmd run start:dev` in `backend` and `npm.cmd run dev` in `frontend`.
2. Open `http://localhost:3000/products`. Confirm the existing product loads, category is `À classer`, and units are `PIECE / PIECE`.
3. Click Modifier. Confirm all original and new values are prefilled. Set category to `Herbes`, storage unit to `KG`, sale unit to `G`, factor to `1000`, minimum to `1,5`, maximum to `10`, and location to `Rayon A / Bac 03`. Save and reopen to confirm persistence.
4. Clear the optional thresholds, subcategory, and location; save and reopen to confirm they remain empty.
5. Click Ajouter un produit. Enter a unique test SKU, Arabic product name, product type, category, units, factor, and price `12,5`. Confirm the existing boolean defaults. Save and verify the new row appears.
6. In DevTools Network, inspect the POST/PATCH JSON: salePrice, conversionFactor, and entered minStock/maxStock must be strings, e.g. `"12.500"`; empty optional thresholds must be null.
7. Try a missing category/unit, zero conversion factor, negative minimum/maximum, and maximum below minimum. Submission should show a validation error without saving. Zero thresholds and equal minimum/maximum are valid.
8. Confirm Annuler returns to the list, Modifier still works, and Supprimer still asks for confirmation. Cancel deletion when checking a real product; delete only a disposable test product if you choose to test the complete delete flow.
9. Stop the backend to check fetch/save errors. Inspect the form on a narrow screen and verify Arabic names remain readable.
