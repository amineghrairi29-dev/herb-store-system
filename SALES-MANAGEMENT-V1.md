# Sales Management V1

## Delivered

- `/sales`: Gestion des ventes, reference/customer search, status filter, required columns, draft-only edit/confirm actions, loading/errors/retry, and “Aucune vente disponible”.
- `/sales/new`: multi-line draft form with optional customer name/phone, date, notes, product-specific units, exact suggested prices, editable unit prices, subtotal/total previews, add/remove lines and duplicate-product prevention.
- `/sales/[id]/edit`: shared prefilled form for DRAFT; other statuses display a read-only message.
- `/sales/[id]`: reference, customer details, date, notes, status, confirmation timestamp, product lines and exact totals.
- Shared confirmation dialog shows reference, line count, total, and the stock deduction warning. Requests disable controls and guard double-clicks; API failures remain visible, including “Stock insuffisant pour confirmer cette vente.” and backend details.
- Each selected product displays read-only current stock from GET /products/:id/stock, with independent loading/error/retry handling. No frontend stock calculation is performed.
- Save redirects to fresh details. Confirmation updates the visible document/list from the returned backend result. Navigating to Stock loads the changed stock.
- UTF-8 and automatic Arabic text direction, responsive forms/tables, strict TypeScript, grouped DT amounts, no new dependencies. Products navigation links to Ventes.

## Database changes

Only two new tables were added. Existing Product, StockMovement, Supplier, Purchase, PurchaseLine, and PurchasePayment fields/data were not modified.

### public.sale

| Field | Storage / rule |
| --- | --- |
| id | SERIAL primary key |
| reference | Required text, unique |
| status | Required text, default DRAFT; CHECK DRAFT / CONFIRMED / CANCELLED |
| customerName, customerPhone, notes | Nullable text |
| saleDate | Required YYYY-MM-DD text; backend calendar validation |
| confirmedAt | Nullable timestamptz; CHECK requires it exactly when status is CONFIRMED |
| createdAt | Required timestamptz, default now() |
| updatedAt | Required timestamptz, automatic Prisma temporal preset |

Index: status + saleDate. No stored independent sale total and no customer account relation.

### public.saleLine

| Field | Storage / rule |
| --- | --- |
| id | SERIAL primary key |
| saleId | Required int4 FK to Sale.id, RESTRICT on delete/update |
| productId | Required int4 FK to Product.id, RESTRICT on delete/update |
| quantity | Required numeric; CHECK positive and finite |
| unit | Required text; CHECK KG / G / L / ML / PIECE |
| quantityInStorageUnit | Required numeric; CHECK positive and finite; backend calculation |
| unitSalePrice | Required numeric; CHECK positive and finite |
| lineTotal | Required numeric; CHECK equals quantity * unitSalePrice |
| createdAt | Required timestamptz, default now() |

Unique constraint: saleId + productId. Indexes: productId and Prisma-generated saleId FK index. Owning-side relation declarations generate inverse relations.

Contract emit and database dry-run completed. Reviewed migration `20260906T1356_sales_v1` applied safely: nine additive operations (two tables including checks, two unique constraints, three indexes, two FKs). The generated migration getter uses the project's explicit return type for full TypeScript checking.

Contract hash: `77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7`.

Migration hash: `fdfbed8d26760e1a0b4e1814cddb8e03f233a8e0c3e573cdbffaecc6794423c8`.

## API and validation

| Endpoint | Result |
| --- | --- |
| POST /sales | 201, DRAFT sale with lines/product details/totalAmount |
| GET /sales | 200, newest sale IDs first |
| GET /sales/:id | 200 details, 404 if missing |
| PATCH /sales/:id | 200 updated DRAFT; 409 for CONFIRMED/CANCELLED |
| POST /sales/:id/confirm | 201 confirmed document; 409 for insufficient stock, unavailable products, or non-DRAFT status |

Reference is required, trimmed and case-sensitively unique. Duplicates return a clear 409, including unique-constraint violations. Customer fields are optional: empty values become null and do not block walk-in sales. Dates must be real YYYY-MM-DD dates. IDs must be positive int4 values.

At least one line is required; duplicate product lines are rejected and prevented by the database constraint. Products must exist and be active and sellable on create/edit and again on confirmation. Unit must match the selected product's storageUnit or saleUnit. Quantity/unit price must be positive decimal strings, at most 60 integer digits and 18 fractional digits. Numeric JSON amounts, scientific notation, NaN/Infinity, zero/negative values, and incompatible units are rejected. Unknown fields, including totalAmount, lineTotal, quantityInStorageUnit, and client status, are rejected. PATCH merges fields and revalidates the whole draft; supplied lines replace all previous lines atomically.

Only DRAFT can be edited/confirmed. CONFIRMED content is immutable through the sales API. CANCELLED is reserved in the schema and labels; cancellation endpoint/UI is **not implemented**. There is no reversal of confirmed sales. Sale payments, receipts/caisse, accounting, and ecommerce checkout are not included.

## Default price and decimal strategy

`Product.salePrice` is interpreted as the reference price **per Product.saleUnit**. Selecting a product chooses saleUnit and suggests that exact price. Selecting a different storageUnit suggests salePrice × conversionFactor. For example 0.030 DT/G × 1000 = 30.000 DT/KG; selling 500 G at 0.030 DT/G totals 15.000 DT.

Unit changes explicitly replace the current price with the catalog-based suggestion; the form explains this behavior. Users may override the suggested price. The backend accepts the submitted exact, positive selected-unit price and calculates the line total; it does not force the current catalog price onto the sale.

Suggestions never round. If a storage-unit conversion cannot be represented exactly within the backend's 18-place input limit, the price input is cleared with an explanatory message for explicit manual entry. A product price received as a JSON number is not silently converted from floating point; it also requires manual entry. Normal backend numeric fields are decimal strings.

The existing decimal helpers are reused: scaled BigInt arithmetic preserves up to 18 places in each input and all 36 places in multiplied totals, with no binary floating-point calculations. totalAmount is derived from stored lineTotal values. Frontend previews and grouped DT display reuse existing helpers, accept comma input, and never send computed totals/conversions. Draft conversion is provisional; confirmation records the exact conversion used by the stock service at that time.

## Stock transaction and concurrency

Sales reuse the existing dedicated-connection Prisma transaction helper from purchases under a local document-transaction alias. That helper contains transaction infrastructure, not purchase rules; its implementation and purchase/payment behavior are unchanged.

1. Begin one Prisma-managed transaction with its transaction-scoped ORM.
2. Lock the sale row FOR UPDATE and check DRAFT. Editing acquires the same sale lock.
3. Lock every involved product row FOR UPDATE in ascending product-ID order, independent of the submitted line order. These are the same product rows locked by manual movements and purchases.
4. Recheck active/sellable status under the locks. For every line call the existing `createMovementInTransaction` helper with type EXIT, reference = sale.reference, reason = “Vente”, and the line's product/quantity/unit.
5. The shared helper performs the authoritative conversion, stock aggregation, and insufficient-stock validation. Retain its quantityInStorageUnit on the line.
6. Set CONFIRMED and confirmedAt only after every exit succeeds; commit everything together. Any error rolls back all exits, line updates, and status changes.

Same-sale confirmation requests serialize on the sale row: after the winner commits, the other sees CONFIRMED and returns 409. Different sales competing for stock serialize on shared product rows and check stock after obtaining the lock, preventing overselling. The deterministic multi-product lock order prevents opposing line orders from forming a product-lock cycle. List/details read through repeatable-read transactions for consistent document snapshots.

## Validation results

- Backend `npm.cmd run build`: passed.
- Backend `npm.cmd exec tsc -- --noEmit`: passed.
- Backend `npm.cmd run test`: **83 unit tests passed**, nine files.
- Backend `$env:RUN_DATABASE_TESTS='1'; npm.cmd run test:e2e -- test/sales.e2e-spec.ts test/purchases.e2e-spec.ts test/purchase-payments.e2e-spec.ts`: **15 integration tests passed**, including six new sale scenarios and nine purchase/payment regressions.
- Mandatory coverage includes stock-neutral drafts, draft line replacement, exact totals, missing/inactive/non-sellable products, confirmation-time sellability, incompatible units, duplicate references/products, client-total rejection, Arabic text, multi-line success, rollback after a first EXIT when a second line lacks stock, failed-sale DRAFT status, exactly one confirmation under simultaneous same-sale requests, immutable confirmed content, traceable EXIT fields/conversion, and two different sales of 4 against stock 5 yielding exactly one success and stock 1.
- Fixtures use UUID-scoped products and sales; initial stock is created only for those disposable products. Setup and guarded cleanup use transactions. Separate committed fixtures allow actual competing database connections. Fixture sales, lines, stock entries and products were removed and absence checks passed.
- Frontend `npm.cmd run lint`: passed.
- Frontend `npm.cmd run build`: passed, all four sale routes included.
- Seven read-only frontend helper assertions passed using installed TypeScript/Node: per-saleUnit default, exact storageUnit conversion, 500 G subtotal, unrelated-unit rejection, numeric-price rejection, too-precise conversion fallback, and grouped DT display.
- All four sale page routes returned HTTP 200 on port 3000. Dynamic shell checks used ID 2147483647; backend 404 behavior is covered separately.
- POST-confirm/PATCH OPTIONS preflights returned 204 with origin http://localhost:3000 and required methods/headers. Existing CORS needed no change.
- Current-stock GET returned HTTP 200. Live GET /sales returned an empty array after fixture cleanup.
- `npm.cmd exec prisma -- db verify`: database schema/marker match the contract, no schema warnings.
- Before/after API snapshots match exactly: **one existing product, three stock movements, one supplier, one purchase and its one payment**. No real stock or purchase/payment balance changed.

No implementation blocker remains. Existing Prisma skill-sync and Vite tsconfig-path advisory warnings remain; they do not block tests/builds. Browser visual/mobile/keyboard tests were not automated. Arabic transport/storage is tested, but visual rendering should be checked manually. Cancellation and sale payments are intentionally deferred.

## Exact manual test steps

1. Start backend with `npm.cmd run start:dev` in `C:\herb-store-system\backend` and frontend with `npm.cmd run dev` in `C:\herb-store-system\frontend`, unless already running. The migration is applied.
2. Use two disposable active/sellable products, A and B. Configure storageUnit KG, saleUnit G, conversionFactor 1000, and salePrice 0.030. Add initial stock only to these test products: A = 10 KG, B = 1 KG.
3. Open http://localhost:3000/sales and click “Nouvelle vente”. Use a unique reference such as `SAL-MANUAL-001`, a date, and optional Arabic customer/notes. Blank customer information must be accepted.
4. Select A: expect default unit G and price 0,030 DT/G. Enter quantity 500: subtotal 15,000 DT. Change unit to KG: expect suggested price 30,000 DT/KG. Verify manual price override works. Current stock should display 10,000 KG; it is informational.
5. Add B on a second line. Check allowed units, duplicate-product prevention, add/remove behavior, required fields, and positive quantity/price validation. Set A = 2 KG at 30 DT/KG and B = 2 KG at 30 DT/KG. Save the draft; stock must remain A 10 KG and B 1 KG.
6. Edit the draft, change notes or a price and save. Reopen details to check persistence. Try creating another sale with the same reference to verify the duplicate error.
7. Click Confirmer, inspect reference/line count/total and stock warning, then Annuler: stock/status must remain unchanged. Reopen and confirm the 2 KG + 2 KG example: expect an insufficient-stock error, sale remains Brouillon, A still 10 KG and B still 1 KG.
8. Cancel the dialog, edit B to 500 G at 0.030 DT/G, and save. Confirm again: expect Confirmée, timestamp, total 75,000 DT, A stock 8 KG and B stock 0.500 KG. Check `/stock/movements`: exactly one EXIT per line with the sale reference and reason Vente.
9. Open `/sales/<id>/edit` for that confirmed sale: no editable form. A second confirmation from another tab must return conflict and create no additional EXITs.
10. For overselling, use a separate disposable product with stock 5 and create two draft sales for quantity 4. Open both in separate tabs and confirm. Exactly one succeeds; the other remains draft and stock finishes at 1.
11. Test search/status filters, nonexistent ID 2147483647, backend unavailability, keyboard dialog cancellation/focus, narrow-screen table scrolling, and Arabic product/customer/notes display. Failed requests should preserve form contents and show errors.

Manual confirmations intentionally reduce inventory. Keep these checks on disposable stock; this V1 has no reversal or payment UI.

## Complete source/migration inventory

Modified:

- `backend/src/app.module.ts`
- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json` (generated)
- `backend/src/prisma/contract.d.ts` (generated)
- `backend/migrations/app/refs/db.json`
- `frontend/src/app/products/page.tsx`

Created backend:

- `backend/src/sales/dto/create-sale.dto.ts`
- `backend/src/sales/sale-validation.ts`
- `backend/src/sales/sale-validation.spec.ts`
- `backend/src/sales/sales.controller.ts`
- `backend/src/sales/sales.service.ts`
- `backend/src/sales/sales.module.ts`
- `backend/test/sales.e2e-spec.ts`
- `backend/migrations/app/20260906T1356_sales_v1/migration.ts`
- `backend/migrations/app/20260906T1356_sales_v1/migration.json`
- `backend/migrations/app/20260906T1356_sales_v1/ops.json`
- `backend/migrations/snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract.json`
- `backend/migrations/snapshots/77e62ec5d7931bc7fedcbc9a5d0af901d1e8ce4bc2d0796662f15215d05fe5d7/contract.d.ts`

Created frontend:

- `frontend/src/types/sale.ts`
- `frontend/src/lib/sale-api.ts`
- `frontend/src/lib/sale-price.ts`
- `frontend/src/app/sales/sale-ui.tsx`
- `frontend/src/app/sales/product-stock.tsx`
- `frontend/src/app/sales/confirm-sale-dialog.tsx`
- `frontend/src/app/sales/sale-form.tsx`
- `frontend/src/app/sales/sales-table.tsx`
- `frontend/src/app/sales/sale-details.tsx`
- `frontend/src/app/sales/page.tsx`
- `frontend/src/app/sales/new/page.tsx`
- `frontend/src/app/sales/[id]/page.tsx`
- `frontend/src/app/sales/[id]/edit/page.tsx`

Created documentation: `SALES-MANAGEMENT-V1.md`. Generated build outputs/caches are omitted.
