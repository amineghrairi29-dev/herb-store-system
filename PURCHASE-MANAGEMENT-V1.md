# Purchase Management V1

## Delivered

- `/purchases`: searchable list with supplier/reference search, status filter, required columns, loading/error/retry/empty states, and draft-only edit/confirm actions.
- `/purchases/new`: multi-line draft form with active suppliers, product-specific units, add/remove lines, duplicate-product prevention, exact subtotal/total previews, and validation.
- `/purchases/[id]/edit`: shared, prefilled form for drafts; confirmed/cancelled purchases show a read-only message.
- `/purchases/[id]`: purchase information, supplier, date, notes, status, confirmation timestamp, product lines, selected-unit prices, subtotals, and total.
- Shared confirmation dialog identifies reference, supplier, line count, and total. It warns that confirmation increases stock and cannot be repeated, disables actions while pending, and retains API errors.
- Saves navigate to fresh purchase details. Confirmation uses the returned authoritative purchase to refresh status and details/list. Navigating to Stock loads the updated backend stock.
- French interface, UTF-8/automatic Arabic text direction, responsive layouts, strict TypeScript, and no new dependencies.
- Supplier dashboard navigation now includes Achats.

## Database changes

Only two new tables were added. No existing Product, StockMovement, or Supplier columns or rows were changed by the migration.

### Purchase / public.purchase

| Field | Storage / rule |
| --- | --- |
| id | SERIAL primary key |
| reference | Required text, unique |
| supplierId | Required int4 FK to Supplier.id, RESTRICT on delete/update |
| status | Required text, default DRAFT; CHECK allows DRAFT, CONFIRMED, CANCELLED |
| notes | Nullable text |
| purchaseDate | Required ISO date text, YYYY-MM-DD; calendar validation in backend, no timezone conversion |
| confirmedAt | Nullable timestamptz; CHECK requires a timestamp exactly when status is CONFIRMED |
| createdAt | Required timestamptz, default now() |
| updatedAt | Required timestamptz, automatic Prisma temporal preset |

Indexes: supplierId; status + purchaseDate. No stored purchase total.

### PurchaseLine / public.purchaseLine

| Field | Storage / rule |
| --- | --- |
| id | SERIAL primary key |
| purchaseId | Required int4 FK to Purchase.id, RESTRICT on delete/update |
| productId | Required int4 FK to Product.id, RESTRICT on delete/update |
| quantity | Required numeric, positive and finite |
| unit | Required text; CHECK allows KG, G, L, ML, PIECE |
| quantityInStorageUnit | Required numeric, positive and finite, calculated by backend |
| unitPurchasePrice | Required numeric, positive and finite |
| lineTotal | Required numeric; CHECK enforces quantity * unitPurchasePrice |
| createdAt | Required timestamptz, default now() |

Unique constraint: purchaseId + productId. Indexes: productId and Prisma's generated purchaseId FK index. Relations are declared on owning sides; Prisma derives inverse relations.

The contract was emitted, the database dry-run reviewed, and additive migration `20260906T1227_purchases_v1` applied: 11 operations (two tables with checks, two unique constraints, four indexes, three FKs). The generated operations getter has an explicit return type for the full TypeScript check.

Contract storage hash: `7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6`.

Migration hash: `7f17e28241cdcf2495378fe4c2bd9bf53642a9732576ec0d85cae30ba9186076`.

## Rules and calculation strategy

New purchases are DRAFT and do not affect stock. Only DRAFT can be edited or confirmed. CONFIRMED content is immutable through the purchase API. Confirmation cannot be repeated. CANCELLED is reserved in the schema/UI labels; cancellation endpoints/UI and confirmed-purchase reversal are **not implemented** in V1. Neither payments, cash, accounting nor sales are included.

Reference is trimmed, required, and case-sensitively unique. Duplicate references produce HTTP 409, including database unique-constraint races. Suppliers must exist and be active on creation, editing, and confirmation. Later deactivation retains the purchase and its supplier relationship.

Each purchase requires at least one line. Duplicate products are rejected, backed by a database unique constraint. IDs must be positive int4 values. Each quantity and unit price must be a positive decimal **string**, with at most 60 integer digits and 18 fractional digits. Scientific notation, numeric JSON values, NaN, Infinity, negatives, zero, and unrelated units are rejected. Product existence and compatibility with storageUnit/saleUnit are checked by the backend. Unknown fields, including client totals, status, and quantityInStorageUnit, are rejected. PATCH merges supplied fields with the current draft and revalidates the whole purchase; supplied lines replace the complete line set atomically.

`unitPurchasePrice` means **DT per selected line unit**. Thus 500 G × 0.020 DT/G = 10.000 DT, and 2 KG × 18.000 DT/KG = 36.000 DT.

Arithmetic uses scaled BigInt integers, never binary floating-point amounts. Quantities/prices retain up to 18 fractional digits; products and sums retain up to 36 fractional digits with no rounding. The API derives totalAmount from persisted lineTotal values. At least three decimals are displayed, with extra precision retained. Frontend previews accept comma decimal input, use exact integer arithmetic, and are never submitted as persisted totals or conversions.

## Atomic confirmation and exactly-once design

1. Open one Prisma-managed database transaction on a dedicated PostgreSQL connection. Use its **transaction-scoped ORM**, not the root ORM inside a manual BEGIN; this prevents ORM mutation scopes from committing independently.
2. Lock the purchase row FOR UPDATE, then check DRAFT. PATCH obtains the same lock, serializing edits with confirmations.
3. Lock the supplier FOR SHARE and recheck active status. Deactivation waits for this transaction, preserving a consistent active-supplier decision.
4. Lock all product rows FOR UPDATE in ascending product-ID order. These are the same locks used by existing manual stock movements and product edits.
5. For each line, call the extracted shared `createMovementInTransaction` helper. Its conversion, stock aggregation, and negative-stock validation are the existing stock rules. It writes one ENTRY with the line's product/quantity/unit, reference = purchase.reference, reason = “Achat fournisseur”. No separate transaction is opened.
6. Retain the exact conversion used at confirmation in PurchaseLine.quantityInStorageUnit. Draft conversions are provisional because product configuration may change before confirmation.
7. Set CONFIRMED and confirmedAt only after every entry succeeds, then commit. Any exception rolls back every entry, line update, and status change.

Concurrent requests block on the same purchase lock. After the winner commits, the next request sees CONFIRMED and returns 409. This enforces exactly one successful confirmation and one movement per line through these APIs. A timeout may leave the client unsure whether a commit succeeded; reload purchase details before retrying. Retrying a committed confirmation cannot create more entries.

List/detail reads use a repeatable-read transaction so headers, lines, and derived totals form a consistent snapshot.

## Endpoints

| Endpoint | Result |
| --- | --- |
| POST /purchases | 201, new draft with lines, supplier, product details, totalAmount |
| GET /purchases | 200, purchases ordered by newest ID |
| GET /purchases/:id | 200 details; 404 if missing |
| PATCH /purchases/:id | 200 updated draft; 409 if not DRAFT |
| POST /purchases/:id/confirm | 201 confirmed purchase; 409 if already confirmed/cancelled or supplier inactive |

Malformed input returns 400; nonexistent product/supplier/purchase returns 404. Existing CORS supports POST/PATCH; no CORS change was required.

## Validation results

- Backend `npm.cmd run build`: passed.
- Backend `npm.cmd exec tsc -- --noEmit`: passed.
- Backend `npm.cmd run test`: **59 tests passed**, seven files, including purchase validation/decimal and existing regression tests.
- Backend `$env:RUN_DATABASE_TESTS='1'; npm.cmd run test:e2e -- test/purchases.e2e-spec.ts`: **four integration tests passed**.
- Integration checks cover all mandatory cases: stock-neutral drafts; draft line replacement; exact totals and Arabic strings; active supplier checks on creation/confirmation; missing supplier/product; incompatible unit; invalid decimals; duplicate lines/references; empty lines; rollback after the first stock entry when the second line fails; multi-line confirmation; repeated confirmation; two concurrent confirmation attempts yielding exactly one 201 and one 409; immutable confirmed content; supplier history after deactivation; unchanged negative-stock protection in the shared stock helper.
- Fixtures use unique UUID-scoped supplier/product/reference values. They are committed only to allow real concurrent connections to observe them, then removed in a guarded cleanup transaction. Cleanup confirmed no fixture purchases, suppliers, or products remained. Their stock movements/lines were removed with them. No real stock mutation was requested.
- Frontend `npm.cmd run lint`: passed.
- Frontend `npm.cmd run build`: passed, including all four purchase routes.
- All four page routes returned HTTP 200 on port 3000. Dynamic route shell checks used nonexistent ID 2147483647; API not-found behavior is separately covered by integration tests.
- Live GET /purchases returned HTTP 200 with an empty list after fixture cleanup.
- POST-confirm and PATCH CORS preflights returned 204, allow-origin http://localhost:3000, and allowed methods/Content-Type.
- `npm.cmd exec prisma -- db verify`: marker/schema match the contract, no schema warnings.
- Original Product, StockMovement, and Supplier API snapshots match exactly before/after implementation: one existing row in each collection.

During validation, tests exposed root-ORM transaction scopes prematurely committing work and single-row deletion leaving draft lines behind. Both were corrected using Prisma's transaction-scoped ORM and deleteAll; the same failing integration scenarios then passed. The frontend's older TypeScript target required BigInt constructor syntax instead of literals; the final build passes without changing the target.

No implementation blocker remains. Existing advisory warnings persist about unsynced Prisma agent skills and Vite's native tsconfig-path support. No unrelated tooling was changed. Browser clicks, accessibility/focus, mobile layout, and visual Arabic rendering were not automated; use the manual checks below. Exact Arabic transport/storage was tested.

## Manual test steps

1. Start backend with `npm.cmd run start:dev` in `C:\herb-store-system\backend`, and frontend with `npm.cmd run dev` in `C:\herb-store-system\frontend`, unless already running. The migration is already applied to the configured database.
2. Use disposable products and a disposable active supplier. For the two-line example, create two distinct products with storageUnit KG, saleUnit G, conversionFactor 1000. Record each initial stock from `/stock`.
3. Open http://localhost:3000/purchases. Check the empty state or list, then click “Nouvel achat”.
4. Enter a unique reference such as `PUR-MANUAL-001`, select the supplier/date, and add Arabic notes. Line 1: first product, quantity 2, KG, price 18. Line 2: second product, quantity 500, G, price 0,020. Expect subtotals 36,000 and 10,000 DT and total 46,000 DT.
5. Verify units are restricted to the selected product and the same product cannot be selected twice. Try empty/zero quantity or price, then restore valid values. Add/remove a spare line; the last line must not be removable.
6. Save. Expect details showing Brouillon with two lines and total 46,000 DT. Visit `/stock`: both original stocks must be unchanged.
7. Edit the draft, change notes/quantities or remove a line, and save. Check the updated lines/total. Restore the two-line example if testing the expected quantities below.
8. Click Confirmer on either details or the list. Verify reference/supplier/line count/total and the stock warning. Annuler must close without changing stock or status.
9. Reopen and confirm. Expect “Confirmation...”, then Confirmé and a confirmation timestamp. Modifier/Confirmer actions disappear. `/stock` should show exactly +2.000 KG for product 1 and +0.500 KG for product 2. `/stock/movements` should contain exactly one ENTRY per line with the purchase reference and reason “Achat fournisseur”.
10. Reopen `/purchases/<id>/edit`: it must be read-only. For a double-confirm check, open the same disposable draft in two tabs before confirming; the second confirmation must return a clear conflict, without additional entries. Reload its details to see Confirmé.
11. Try saving another draft with the same reference: expect a duplicate-reference error. To test inactive-supplier confirmation, create a separate draft, deactivate its disposable supplier, then confirm: expect an inactive-supplier error and no stock changes. Reactivate before further valid tests.
12. Test search and status filter, nonexistent details ID 2147483647, temporary backend unavailability, keyboard dialog cancellation, mobile horizontal table scrolling, and Arabic product/supplier/notes display. Errors must remain visible and failed saves must retain form contents.

Confirmation intentionally changes stock and has no reversal UI in this task. Keep manual tests on disposable inventory; do not attempt cancellation of a confirmed purchase.

## Complete source and migration file inventory

Modified:

- `backend/src/app.module.ts`
- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json` (generated)
- `backend/src/prisma/contract.d.ts` (generated)
- `backend/src/stock-movements/stock-movements.service.ts`
- `backend/migrations/app/refs/db.json`
- `frontend/src/app/suppliers/page.tsx`

Created backend:

- `backend/src/purchases/dto/create-purchase.dto.ts`
- `backend/src/purchases/purchase-validation.ts`
- `backend/src/purchases/purchase-validation.spec.ts`
- `backend/src/purchases/purchase-transaction.ts`
- `backend/src/purchases/purchases.controller.ts`
- `backend/src/purchases/purchases.service.ts`
- `backend/src/purchases/purchases.module.ts`
- `backend/src/stock-movements/create-movement-in-transaction.ts`
- `backend/test/purchases.e2e-spec.ts`
- `backend/migrations/app/20260906T1227_purchases_v1/migration.ts`
- `backend/migrations/app/20260906T1227_purchases_v1/migration.json`
- `backend/migrations/app/20260906T1227_purchases_v1/ops.json`
- `backend/migrations/snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract.json`
- `backend/migrations/snapshots/7438f6e8283aeebe63a0b12562b9bf3ed539fb02fd787289c7a5c7f3961987e6/contract.d.ts`

Created frontend:

- `frontend/src/types/purchase.ts`
- `frontend/src/lib/purchase-api.ts`
- `frontend/src/lib/purchase-decimal.ts`
- `frontend/src/app/purchases/purchase-ui.tsx`
- `frontend/src/app/purchases/confirm-purchase-dialog.tsx`
- `frontend/src/app/purchases/purchase-form.tsx`
- `frontend/src/app/purchases/purchases-table.tsx`
- `frontend/src/app/purchases/purchase-details.tsx`
- `frontend/src/app/purchases/page.tsx`
- `frontend/src/app/purchases/new/page.tsx`
- `frontend/src/app/purchases/[id]/page.tsx`
- `frontend/src/app/purchases/[id]/edit/page.tsx`

Created documentation: `PURCHASE-MANAGEMENT-V1.md`. Generated build outputs/caches are omitted.
