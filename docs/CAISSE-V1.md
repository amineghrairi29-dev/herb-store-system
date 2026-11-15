# Caisse V1

Implemented on 2026-09-06. Caisse consolidates customer/supplier payments and manual cash movements. It does not implement accounting, profit/loss, bank reconciliation, payment gateways, or stock changes.

Expense Management V1 adds the `EXPENSE` source and a restricted editing exception: editing an expense atomically updates its single linked cash movement. Other source types remain append-only, and no generic cash edit/delete API exists. See [Expense Management V1](EXPENSE-MANAGEMENT-V1.md) for the current schema extension and editable-expense policy; the remaining text below records the original Caisse V1 implementation.

## Database and payment integrity

`CashMovement` stores `id`, `type`, `sourceType`, `sourceId`, `amount`, `paymentMethod`, `movementDate`, `reference`, `description`, `notes`, and `createdAt`. Additional nullable `salePaymentId` / `purchasePaymentId` foreign keys provide concrete links to the original payment records with RESTRICT on update/delete.

- PostgreSQL `numeric` stores amounts exactly. Existing money validation accepts decimal strings with up to 130 integer digits and 36 fractional digits; arithmetic uses scaled BigInt, never floating-point money.
- Database checks require a positive finite amount, a supported method, and a valid source/direction/link combination. Manual rows must be CASH and have null payment links. Sale payments must be IN; purchase payments must be OUT.
- Unique `(sourceType, sourceId)` and individual payment-link uniqueness prevent duplicate ledger entries. Null manual source IDs permit multiple independent manual movements.
- Indexes cover movement date and payment method/date.
- There is no balance column and no movement update/delete endpoint or UI. Immutability is enforced by the application's append-only API; privileged database maintenance is outside that API.

Both existing `addPayment` services retain their parent-document `FOR UPDATE` lock and remaining-amount validation. They insert the payment and call `recordPaymentMovement` inside the same Prisma transaction. A failed cash insertion rolls back the payment; a later failure also rolls back both inserts. Payment responses and stock logic are unchanged.

The shared recorder uses the original payment amount, method, date, notes, and payment reference (falling back to the document reference), with description `Paiement vente` or `Paiement fournisseur`. Re-linking the same payment under its parent lock returns the existing movement. Database uniqueness remains the final safeguard.

Idempotency is **per payment ID**. The existing payment APIs do not have a request idempotency key: submitting two independent HTTP payment requests can create two payment records if the remaining amount permits. Each has exactly one cash movement. References are informational, not deduplication keys. Manual submissions likewise represent separate movements; after a connection timeout, check history before resubmitting.

## Migration and existing-payment backfill

The emitted contract and reviewed migration contain eight additive operations: the new table, three unique constraints, two indexes, and two foreign keys. No existing table columns or stock rules changed.

Applied migration: `backend/migrations/app/20260906T1806_caisse_v1`.

Storage contract: `7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452`.

Migration hash: `97ea481c7d1179c90723352131c8209443470cca53e8d54ab09447a00bcee437`.

Run these commands from `C:\herb-store-system\backend` when deploying this committed migration to another environment with its DATABASE_URL configured:

```powershell
npm.cmd exec prisma -- db migrate --advance-ref db
node scripts/backfill-cash.mjs --dry-run
node scripts/backfill-cash.mjs --apply
node scripts/backfill-cash.mjs --dry-run
npm.cmd exec prisma -- migration status
```

Review the dry-run before applying. The backfill does not execute as part of application startup. Apply runs in one database transaction and locks the two payment tables while copying missing rows. It retains exact amounts, methods, dates, notes, references/fallbacks and original payment creation timestamps. Existing links with inconsistent financial data cause a failure. Unique source linkage plus `ON CONFLICT DO NOTHING` makes reruns safe. No source payment is updated.

Observed counts in this workspace:

| Source | Existing payments | Initial missing | Inserted | Inserted on second apply | Final missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| SalePayment | 1 | 1 | 1 | 0 | 0 |
| PurchasePayment | 1 | 1 | 1 | 0 | 0 |

After automated fixture cleanup, the database contains exactly these two intended cash movements. Before/after API snapshots match for 1 product, 4 stock movements, 1 supplier, 1 purchase and 1 sale, including their lines and payments. Test fixtures were removed; existing data was not modified.

## API and formulas

| Endpoint | Behavior |
| --- | --- |
| GET `/cash/summary` | Derived exact decimal-string totals |
| GET `/cash/movements` | All financial movements, with linked sale/purchase IDs and reference |
| GET `/cash/movements/:id` | One linked movement, or 404 |
| POST `/cash/manual-in` | Creates MANUAL_IN / IN / CASH |
| POST `/cash/manual-out` | Creates MANUAL_OUT / OUT / CASH |

Manual JSON input: `{ "amount": "12.500", "movementDate": "2026-09-06", "description": "Apport caisse", "reference": null, "notes": null }`. Amount, valid calendar date, and nonblank description are required. Other properties such as type, payment method, source ID, or balance are rejected. The server fixes source/direction/method from the endpoint.

| Summary field | Formula |
| --- | --- |
| `cashInflows` | Sum of IN amounts with method CASH |
| `cashOutflows` | Sum of OUT amounts with method CASH |
| `physicalCashBalance` | cashInflows − cashOutflows |
| `totalFinancialInflows` | Sum of all IN amounts, every method |
| `totalFinancialOutflows` | Sum of all OUT amounts, every method |
| `netFinancialFlow` | totalFinancialInflows − totalFinancialOutflows |
| `todayCashInflows` | CASH IN amounts whose movementDate is today's business date |
| `todayCashOutflows` | CASH OUT amounts whose movementDate is today's business date |

CARD, BANK_TRANSFER, CHECK, and OTHER stay in financial history and financial totals; they never affect physical cash. Each summary uses a repeatable-read snapshot. There is no mutable balance row to lose concurrent updates.

`businessDate` and `timeZone` are also returned. `CASH_TIME_ZONE` defaults to `Africa/Tunis`, consistent with the existing DT interface; set it to the store's intended IANA timezone before starting the backend if different. Today's figures use the entered payment/movement date, not insertion time.

History order is movementDate DESC, createdAt DESC, id DESC. The creation timestamp preserves correct ordering within a date for historical backfilled payments. V1 fetches the complete list and filters it in the browser by direction, source, method and inclusive date range. Summary aggregation and linked-history loading suit the present small dataset; pagination/batched joins would be appropriate at larger volumes.

## Frontend

- `/cash`: four required cards, clear physical-cash versus global-financial descriptions, today's cash figures, last ten movements and all three actions.
- `/cash/manual-in` and `/cash/manual-out`: one shared configurable form, fixed Espèces method, exact decimal normalization, required fields, disabled submitting controls, UTF-8 inputs, API errors, and Annuler. Success performs a fresh navigation to `/cash`; reads use `cache: no-store`.
- `/cash/movements`: shared table, French labels, distinct entry/exit badges, all filters with reset, notes disclosure, and links to source sales/purchases.
- Caisse links added to product, sales and purchase navigation. No full navigation redesign or new libraries.

## Validation results

| Check | Result |
| --- | --- |
| Contract emit, migration dry-run/review/apply | Passed; additive only |
| Migration status | Up to date |
| Backend `npm.cmd run build` | Passed |
| Backend `npm.cmd exec tsc -- --noEmit` | Passed |
| Backend `npm.cmd run test` | 96 tests passed, 11 files |
| Backend database integration suite | 33 tests passed, 9 files |
| Cash-specific integration tests | 9 passed, including final history-order change |
| Backend lint | Exit 0; existing stock-test warning noted below |
| Frontend lint | Passed |
| Frontend production build | Passed; all four routes generated |
| Four frontend routes on localhost:3000 | HTTP 200, text/html; charset=utf-8 |
| GET cash summary/history | Working; exact values and linked documents |
| OPTIONS manual-in/manual-out | HTTP 204; origin localhost:3000, POST allowed, Content-Type allowed |
| UTF-8 | Arabic description, notes and payment reference preserved in integration tests |
| Existing data | Before/after snapshots unchanged; only intended two backfill movements remain |

Reproduce database tests from `backend` with:

```powershell
$env:RUN_DATABASE_TESTS='1'
npm.cmd run test:e2e -- --no-file-parallelism
```

Use sequential files because cash tests compare the full stock snapshot and global summary before/after while other suites create temporary stock fixtures. Tests only create/use/delete their own UUID-tagged data. Cash tests cover all five methods for both payment sources, exact decimal deltas, forced rollback after ledger insertion, database duplicate rejection, simultaneous payment requests, repeated linking, scoped legacy backfill, manual validation, no edit/delete API, history/detail links, and unchanged stock.

## Manual verification

Run the backend in one terminal and frontend in another if they are not already running:

```powershell
cd C:\herb-store-system\backend
npm.cmd run start:dev
```

```powershell
cd C:\herb-store-system\frontend
npm.cmd run dev
```

Use a test database or deliberately chosen disposable documents for the steps that record money; V1 intentionally has no delete/edit UI for those records.

1. Open `http://localhost:3000/cash`. Verify the four cards, today's values, and two existing linked payment movements. The current recorded physical balance is **−11 080,000 DT**, from 200,000 DT cash inflows minus 11 280,000 DT cash outflows. No opening balance was invented.
2. Click **Entrée manuelle**. Enter amount `0,100`, today's date, description `إيداع اختبار`, and a unique test reference. Submit once. Confirm the disabled Enregistrement state, redirect to `/cash`, one new Entrée manuelle row, and a cash balance increase of exactly 0,100 DT.
3. Click **Sortie manuelle**. Enter `0,200`, a date, a description and another unique reference. Confirm the redirect, one Sortie manuelle row, and a decrease of exactly 0,200 DT. Nonpositive amounts or missing dates/descriptions must be rejected. Annuler must return without creating a row.
4. On a disposable confirmed sale with sufficient remaining balance, open its **Ajouter un paiement** form, record `1,000` in Espèces, and check its payment history and `/cash/movements`. There must be exactly one Paiement vente / Entrée movement with a working sale link, and cash must increase by 1,000 DT.
5. Record a separate CARD payment on a disposable sale. Financial inflows/net flow increase, while physical cash stays unchanged. Check the Carte history row and source link.
6. On a disposable confirmed purchase with sufficient remaining balance, record a CASH payment. It must create one Paiement fournisseur / Sortie row and decrease physical cash. A separate BANK_TRANSFER payment must increase financial outflows without decreasing physical cash. CHECK and OTHER must also appear in history without changing physical cash.
7. Open `http://localhost:3000/cash/movements`. Exercise each filter and combined filters, inclusive dates, an invalid reversed date range, reset, notes, and linked source documents. Confirm French text and Arabic references remain readable. Resize to mobile width; forms stack and the table scrolls horizontally.
8. In browser DevTools Network, verify cash requests target port 3001. OPTIONS should return the localhost:3000 allow-origin header and permit POST/Content-Type. GETs should return 200. Stop the backend temporarily and reload to verify a clear error and retry action; restart it afterward. For a submission timeout, inspect history before retrying to avoid recording a separate manual movement.
9. Compare stock before/after payment and cash operations: neither should create or change stock movements. Do not confuse the stock effects of confirming the original sale/purchase with payment/cash operations.

## Warnings and limits

No implementation blocker remains. No interactive browser automation was available; route/CORS checks and UTF-8 API tests passed, while the visual/form steps above remain manual verification.

The negative current physical balance reflects existing recorded payments. V1 does not prevent a manual cash exit that makes that derived balance negative and does not create an opening balance automatically; no such rule was requested.

Existing tooling warnings: Prisma reports unsynced bundled agent skills; Vite suggests its native tsconfig-paths option; backend lint reports `no-unsafe-finally` in the existing `test/stock-movements.e2e-spec.ts:81`. These did not fail validation and were left outside this change.

## Files created or modified

Created backend files:

- `backend/src/cash/cash.module.ts`
- `backend/src/cash/cash.controller.ts`
- `backend/src/cash/cash.service.ts`
- `backend/src/cash/cash-values.ts`
- `backend/src/cash/cash-values.spec.ts`
- `backend/src/cash/cash-payment.ts`
- `backend/src/cash/cash-backfill.ts`
- `backend/scripts/backfill-cash.mjs`
- `backend/test/cash.e2e-spec.ts`
- `backend/migrations/app/20260906T1806_caisse_v1/migration.ts`
- `backend/migrations/app/20260906T1806_caisse_v1/migration.json`
- `backend/migrations/app/20260906T1806_caisse_v1/ops.json`
- `backend/migrations/snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract.json`
- `backend/migrations/snapshots/7dc5d7494b58ebfccdcf18537e9263e8708b56d3401f48b770b662bd4f138452/contract.d.ts`

Modified backend files:

- `backend/src/app.module.ts` — registers CashModule.
- `backend/src/prisma/contract.prisma` — CashMovement model and constraints.
- `backend/src/prisma/contract.json` — emitted contract.
- `backend/src/prisma/contract.d.ts` — emitted types.
- `backend/migrations/app/refs/db.json` — advances the database migration reference to the applied cash contract.
- `backend/src/sales/sales.service.ts` — atomic payment/cash integration.
- `backend/src/purchases/purchases.service.ts` — atomic payment/cash integration.
- `backend/test/sale-payments.e2e-spec.ts` — cleans only fixture-linked cash records before fixture payments.
- `backend/test/purchase-payments.e2e-spec.ts` — same fixture cleanup ordering.

Created frontend files:

- `frontend/src/types/cash.ts`
- `frontend/src/app/cash/page.tsx`
- `frontend/src/app/cash/cash-ui.tsx`
- `frontend/src/app/cash/cash-dashboard.tsx`
- `frontend/src/app/cash/movements-table.tsx`
- `frontend/src/app/cash/manual-form.tsx`
- `frontend/src/app/cash/manual-in/page.tsx`
- `frontend/src/app/cash/manual-out/page.tsx`
- `frontend/src/app/cash/movements/page.tsx`
- `frontend/src/app/cash/movements/cash-history.tsx`

Modified frontend files:

- `frontend/src/app/products/page.tsx` — Caisse navigation link.
- `frontend/src/app/purchases/purchase-ui.tsx` — Caisse navigation link.
- `frontend/src/app/sales/sale-ui.tsx` — Caisse navigation link.

Created report: `CAISSE-V1.md`. Builds also regenerate normal `backend/dist`, TypeScript build cache, and `frontend/.next` artifacts; these are not implementation source changes.
