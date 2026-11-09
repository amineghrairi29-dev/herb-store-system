# Order Fulfillment / Conversion to Sale V1

Implemented and validated on 2026-09-07.

## Behavior

`OnlineOrder PENDING → CONFIRMED → linked Sale DRAFT → Sale CONFIRMED`

Order confirmation and conversion have no stock, reservation, payment, or cash effect. Staff review the draft and use the existing Sales confirmation action; that remains the only stock deduction mechanism in this lifecycle. Existing manual sales and Sales stock/payment business rules are unchanged.

### Durable relation and migration

OnlineOrder now has nullable, unique `saleId`, a foreign key to Sale with `ON DELETE RESTRICT` and `ON UPDATE RESTRICT`, plus nullable `convertedAt`. A database check requires both fields to be null together, or both populated on a CONFIRMED order. This represents a one-to-one relationship without a redundant second foreign key. Sale details retrieve the source order through this indexed relation, rather than interpreting reference text.

Existing records retain null linkage. Contract emission, migration planning, dry-run review and application completed. Migration `20260907T1721_order_fulfillment_v1` contains only five additive operations: two columns, a check, a unique constraint and a foreign key. No data migration, destructive schema operation or existing business-row update was required. The generated migration getter has the explicit type annotation used by this repository for TypeScript compatibility.

### Conversion endpoint

`POST http://localhost:3001/online-orders/:id/convert-to-sale`

No request body is needed. A successful first or repeated request returns HTTP 200 with:

```text
orderId, orderReference, saleId, saleReference, saleStatus, convertedAt
```

PENDING/CANCELLED orders return 409; a missing order returns 404. Invalid IDs fail validation. A repeated conversion returns the already linked sale, including its current status, even if staff have since edited or confirmed it.

The transaction locks the order row with `FOR UPDATE` before checking its link. Concurrent callers serialize on that row; only the first creates a sale. Sale, SaleLines and the order link commit together or roll back together. Database uniqueness independently enforces one order per sale. The existing draft-creation validation is reused inside the same transaction.

### Snapshot mapping

Each OnlineOrderLine supplies `productId`, `quantity`, `unitSnapshot → unit` and `unitPrice → unitSalePrice`. Product price changes do not reprice the order. Exact decimal helpers verify every line total and the complete sale total against the order snapshots; no floating-point calculation is used.

Customer name, phone and notes come from the order. Sale date is the current business date using the existing timezone helper. The current Sales module requires a unique staff-provided reference and has no reference generator. Conversion supplies deterministic `WEB-${order.reference}` (for example `WEB-ORD-000100`) through that same validation and database uniqueness logic. An existing manual sale with that reference causes a clean conflict and full rollback.

Products must satisfy existing internal draft rules: present, active, sellable and compatible with the snapshot unit. Online visibility is not required. Draft creation does not check sufficient stock. Storage-unit conversion continues to use existing Sales code and current product configuration; the frontend does not calculate stock or storage quantities.

### Admin UI and restrictions

- `/online-orders/[id]`: a confirmed, unconverted order shows “Créer la vente” with a native confirmation dialog explaining that it creates a draft. Submitting is locked, loading is visible and errors are displayed.
- After conversion, the refreshed page shows “Vente créée”, current sale reference/status and “Voir la vente”. It does not automatically confirm the sale.
- `/online-orders`: the new “Traitement” column shows “Non convertie” or “Vente créée” with a sale link.
- `/sales/[id]`: linked sales show “Origine : Commande en ligne” and a backlink to the order.
- Order status remains CONFIRMED. `fulfillmentStatus` is derived as NOT_CONVERTED/CONVERTED from `saleId`.
- Converted orders cannot change status or be cancelled. Draft edits never update historical order snapshots.
- Sales currently has no deletion endpoint; none was added. The foreign key also prevents deletion of a linked sale.
- Public order creation, preview and lookup responses do not expose the private sale relationship.

## Files created

- `backend/src/online-orders/order-fulfillment.controller.ts`
- `backend/src/online-orders/order-fulfillment.service.ts`
- `backend/test/order-fulfillment.e2e-spec.ts`
- `backend/migrations/app/20260907T1721_order_fulfillment_v1/migration.ts`
- `backend/migrations/app/20260907T1721_order_fulfillment_v1/migration.json`
- `backend/migrations/app/20260907T1721_order_fulfillment_v1/ops.json`
- `backend/migrations/snapshots/7630f0b72af96e2ad04395339d81b6f9db8f1468475677df14a2fd9147ab324f/contract.json`
- `backend/migrations/snapshots/7630f0b72af96e2ad04395339d81b6f9db8f1468475677df14a2fd9147ab324f/contract.d.ts`
- `frontend/src/app/online-orders/order-fulfillment.tsx`
- `frontend/scripts/verify-order-fulfillment.mjs`
- `ORDER-FULFILLMENT-V1.md`

## Files modified

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/migrations/app/refs/db.json`
- `backend/src/online-orders/online-orders.module.ts`
- `backend/src/online-orders/online-orders.service.ts`
- `backend/src/sales/sales.module.ts`
- `backend/src/sales/sales.service.ts`
- `frontend/src/types/online-order.ts`
- `frontend/src/types/sale.ts`
- `frontend/src/app/online-orders/order-details.tsx`
- `frontend/src/app/online-orders/order-list.tsx`
- `frontend/src/app/sales/sale-details.tsx`

Temporary browser profile/screenshots are under `.tmp/`. Validated screenshots: `.tmp/fulfillment-validation-1788802420198/order-{1280,768,390}.png`.

## Validation results

| Check | Result |
| --- | --- |
| Backend build | Passed |
| Backend TypeScript `tsc --noEmit` | Passed |
| Backend unit suite | 200 passed |
| Backend lint | Passed with one pre-existing warning noted below |
| Database integration suite, sequential | 89 passed across 16 files, including 8 new fulfillment tests |
| Frontend lint | Passed, including new browser script |
| Frontend production build | Passed |
| Browser order confirmation and cancelled/accepted conversion dialogs | Passed |
| Browser linked draft, Sale source/backlink, refreshed list and unavailable repeat/cancel actions | Passed |
| Desktop 1280px, tablet 768px, mobile 390px | Passed; no horizontal page overflow; mobile screenshot inspected |
| Arabic UTF-8 and hydration/runtime checks | Passed |
| Conversion POST CORS preflight from localhost:3000 | Passed |
| Stock lifecycle | 10 after order creation, 10 after order confirmation, 10 after conversion, 8 after Sale confirmation; one EXIT |
| Real business data preservation | Full row snapshots equal after fixture cleanup |

Integration tests cover status eligibility, exact historical decimal mapping and totals, changed product prices/visibility, both link directions, unchanged order snapshots after draft edits, repeated conversion, five concurrent conversions, rollback injected after linking, manual sales, insufficient stock at Sale confirmation, inactive/non-sellable products, unsupported precision, cancellation rejection, unique/FK protection and absence of a Sale DELETE endpoint. Repeated Sale confirmation produces no second movement. No payment/cash row is created.

An initial test expected PostgreSQL foreign-key error `23503` for deletion; `RESTRICT` correctly returns `23001`. The assertion was corrected and the full database suite passed. An initial integration invocation without the database opt-in skipped the database tests; the reported 89-pass run explicitly enabled them.

Reproduce checks in PowerShell:

```powershell
cd C:\herb-store-system\backend
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd test
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e -- --no-file-parallelism --testTimeout=20000

cd C:\herb-store-system\frontend
npm.cmd run lint
npm.cmd run build
```

The browser script requires both app servers and a separate Chrome debugging session on port 9223. Run `node scripts/verify-order-fulfillment.mjs` from frontend. It creates UUID-owned fixtures, confirms only its own fixture sale, removes those fixtures in `finally`, compares all relevant pre/post table rows, and closes the isolated browser. Run database integration and browser tests sequentially so fixture snapshot checks do not overlap.

## Exact manual test

1. Run backend on `http://localhost:3001` and frontend on `http://localhost:3000`, with the migration applied.
2. Create a disposable active, sellable, online-visible product with storage/sale unit KG, conversion factor 1 and a known price. Add ENTRY 10 through the stock UI.
3. At `/shop`, add quantity 2 of that product and submit checkout. Note the order reference.
4. Open `/online-orders`, open that order and click “Confirmer”. Verify stock remains 10.
5. Click “Créer la vente” and cancel the dialog. Verify no sale appears. Click again and accept.
6. Verify “Vente créée”, a WEB-ORD reference and Brouillon; order status stays Confirmée. Verify stock remains 10.
7. Click “Voir la vente”. Verify quantity, unit, historical price, line total and total equal the order. Verify the source/backlink.
8. Review and use the existing sale “Confirmer” action, then “Confirmer la vente”. Verify Sale is confirmed, stock is 8, and stock history contains exactly one EXIT for this sale reference.
9. Return to the order. Verify the linked sale is now confirmed, “Créer la vente” and order cancellation are unavailable, and the list shows “Vente créée”. Reload to verify persistence.
10. Optional idempotency check: POST the conversion endpoint again for that same order. It returns the same sale ID and creates no sale or movement.
11. Insufficient-stock case using another disposable product: start with 10 and submit/confirm order quantity 2. Use a separate normal sale of 9 to leave stock 1. Convert the order: a draft is allowed. Attempt to confirm it: the existing insufficient-stock error must appear. Stock stays 1, draft/link remain, order stays confirmed, and no partial EXIT is added.
12. On another linked draft, edit quantity or price through normal Sales editing. Reopen the order and verify its snapshots remain unchanged. Do not use real customer records for these tests.

## Limitations and warnings

- No implementation blocker remains. Existing tooling warnings remain: stock integration test `no-unsafe-finally` at line 81, Vite's existing `vite-tsconfig-paths` advisory, and Prisma skills-sync warning. No package was installed or upgraded.
- Existing Sales quantity/price validation supports at most 18 decimal places. Historical online-order prices beyond that precision fail conversion with a clear 409, preserving the order and creating nothing; they are never silently rounded. Incompatible current product units/configuration likewise fail existing Sales validation. These cases require a separate business decision before widening Sales rules.
- There is no cancellation/reversal workflow for a converted order in V1 and no sale deletion UI/API. A linked draft remains editable under existing Sales rules.
- This task adds no authentication; the existing admin namespace is not access control. Existing deployment access restrictions still apply.
- Fixture tests leave normal database sequence gaps; existing business rows are unchanged.
