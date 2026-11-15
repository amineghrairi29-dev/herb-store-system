# Stock Movements V1

Implemented `/stock` and `/stock/new-entry`. The frontend creates ENTRY movements only. The backend accepts ENTRY, EXIT, ADJUSTMENT_IN, ADJUSTMENT_OUT, LOSS, and RETURN_IN. No editable current-stock field exists.

## Database

Applied migration `backend/migrations/app/20260905T1728_stock_movements_v1` after contract emit, a database dry-run, and review of the planned SQL. All four operations were additive: a table, two indexes, and a foreign key.

`public."stockMovement"` contains:

- `id`: serial primary key.
- `productId`: required integer referencing `public.product.id`, with ON DELETE RESTRICT and ON UPDATE RESTRICT.
- `type`: required text checked against the six V1 types.
- `quantity`: required positive finite numeric.
- `unit`: required text checked against KG, G, L, ML, PIECE.
- `quantityInStorageUnit`: required positive finite numeric, calculated by the backend.
- `reason`, `reference`, `notes`: nullable text.
- `createdAt`: required timestamptz, default now().

Indexes cover productId and (productId, createdAt). Existing product data was preserved. The movement table starts empty, so existing products have zero stock.

## API and rules

| Endpoint | Behavior |
| --- | --- |
| POST /stock-movements | Validate and record a movement; returns 201. |
| GET /stock-movements | List movements, newest ID first. |
| GET /stock-movements/:id | Return a movement or 404. |
| GET /products/:id/stock | Return productId, stock as a decimal string, and storage unit. |

ENTRY, ADJUSTMENT_IN, and RETURN_IN add stock. EXIT, ADJUSTMENT_OUT, and LOSS subtract stock. Only a product's configured storage/sale units are accepted. Storage-unit quantities are used directly; sale-unit quantities are divided by conversionFactor. Identical units require factor 1.

The backend rejects client-supplied quantityInStorageUnit. Quantity must be a positive decimal string. Fixed-point BigInt arithmetic preserves up to 18 fractional digits without binary floating-point rounding. Nonexact division at that precision is rejected with an instruction to enter storage units. Quantity input supports up to 60 integer digits.

Transactions use READ COMMITTED and SELECT ... FOR UPDATE on the product before reading its movement total and inserting. Product edits and deletion checks use the same lock. Products with movement history cannot be deleted or have their storage unit, sale unit, or conversion factor changed; other editable fields remain available. There are no movement edit/delete endpoints.

## Files created or modified

Paths relative to `C:\herb-store-system`:

```text
backend/src/prisma/contract.prisma
backend/src/prisma/contract.json (generated)
backend/src/prisma/contract.d.ts (generated)
backend/src/prisma/product-transaction.ts (new)
backend/src/app.module.ts
backend/src/products/products.service.ts
backend/src/stock-movements/dto/create-stock-movement.dto.ts (new)
backend/src/stock-movements/stock-decimal.ts (new)
backend/src/stock-movements/stock-decimal.spec.ts (new)
backend/src/stock-movements/stock-movements.service.ts (new)
backend/src/stock-movements/stock-movements.controller.ts (new)
backend/src/stock-movements/stock-movements.module.ts (new)
backend/test/stock-movements.e2e-spec.ts (new)
backend/test/products-stock.e2e-spec.ts
backend/migrations/app/20260905T1728_stock_movements_v1/migration.ts (new)
backend/migrations/app/20260905T1728_stock_movements_v1/migration.json (new)
backend/migrations/app/20260905T1728_stock_movements_v1/ops.json (new)
backend/migrations/app/refs/db.json
backend/migrations/snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract.json (new)
backend/migrations/snapshots/4013e4004c1770500f65bdd3e643cfe222002a28b63bec4db17a4a3696a60696/contract.d.ts (new)
frontend/src/lib/stock-api.ts (new)
frontend/src/app/products/page.tsx
frontend/src/app/stock/page.tsx (new)
frontend/src/app/stock/stock-table.tsx (new)
frontend/src/app/stock/new-entry/page.tsx (new)
frontend/src/app/stock/new-entry/entry-form.tsx (new)
STOCK-MOVEMENTS-V1.md (new)
```

Standard build outputs and incremental caches were regenerated. No packages were installed.

## Validation

- Backend build and full TypeScript check passed.
- Frontend lint passed without warnings; production build passed.
- Prisma contract emit, database dry-run, migration apply, and final database verification passed.
- 34 unit tests passed: product validation, conversion, exact decimal arithmetic, movement signs, aggregation, incompatible units, invalid quantities, and rejection of client-calculated fields.
- Two database integration tests passed, covering existing product create/edit behavior and movement HTTP endpoints.
- With 10 KG available, two simultaneous 7 KG exits returned one 201 and one 409, leaving exactly 3 KG.
- Example ENTRY 10, EXIT 0.5, LOSS 0.2 produced 9.300 KG.
- Live stock and entry pages returned HTTP 200. The existing product (ID 2) returned stock 0.000 PIECE.
- Final cleanup verification found one existing product and zero movements.

Movement tests used uniquely named disposable TEST-MOVEMENTS products. Cleanup matched the exact test SKU and ID, then removed only their movements and product. An initial failed run's fixture was also cleaned up. The product-reference integration test rolled its fixture back. No pre-existing products or movements were deleted. Sequence numbers can have gaps after tests.

To rerun tests from `backend` in PowerShell:

```powershell
npm.cmd test -- src/stock-movements/stock-decimal.spec.ts src/products/product-validation.spec.ts
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e -- test/stock-movements.e2e-spec.ts test/products-stock.e2e-spec.ts
Remove-Item Env:RUN_DATABASE_TESTS
```

## Warnings and limitations

No remaining blocker. Interactive browser behavior was not automated.

Testing exposed Prisma releasing a supplied pooled client prematurely. The final implementation uses an explicitly owned PostgreSQL Client for each product transaction and closes it afterward. Concurrency tests pass with this implementation. The driver was already installed with Prisma.

V1 reads each product's movement history to calculate stock, and the dashboard requests balances in batches of six products. Larger catalogs/history would benefit from a bulk aggregate endpoint and further connection optimization.

Prisma reports unsynced local agent skills, and Vitest reports that the existing vite-tsconfig-paths plugin can be replaced by native Vite support. These pre-existing tooling warnings do not block validation. The bundled installed-version Prisma skill was used directly.

## Manual testing

1. Start the backend on port 3001 and frontend on port 3000 if needed (`npm.cmd run start:dev` in backend; `npm.cmd run dev` in frontend).
2. Open http://localhost:3000/stock. A product without movements should show 0,000 and Rupture.
3. Before recording its first movement, configure a suitable product with storageUnit KG, saleUnit G, conversionFactor 1000, and minStock 1. Alternatively create a dedicated test product with these values.
4. Click Nouvelle entrée. Select the product. Confirm the unit dropdown contains only KG and G.
5. Enter quantity 500, unit G, and optional reason/reference/Arabic notes. Save. The page should return to /stock and show 0,500 KG and Stock faible.
6. Record another ENTRY of 2 KG. Stock should become 2,500 KG and Normal.
7. Try zero/negative quantities, cancel navigation, loading with network throttling, and save/fetch errors with the backend unavailable. Verify responsive layout and Arabic names.
8. Inspect POST JSON in DevTools: type is ENTRY, quantity is a decimal string, and quantityInStorageUnit is absent.
9. For backend-only checks, use the automated disposable integration test above. It covers exits, losses, adjustments, returns, negative-stock prevention, and simultaneous exits without changing real product stock.
10. After a product has movement history, attempting to change its units/factor or delete it should show a clear error. Frontend EXIT/LOSS/adjustment controls are intentionally absent.
