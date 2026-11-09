# Expense Management V1

Implemented on 2026-09-06. Supports creating, viewing, filtering/searching, and safely editing operating expenses outside supplier purchase documents. No expense deletion, accounting dashboard, profit/loss calculation, legal journal, or accounting lock was added.

## Editing and cash integration

Expenses are editable in V1 until a future formal accounting lock exists. This is an explicit exception to Caisse V1's append-only policy, limited to the cash movement owned by an expense. There is still no generic cash movement PATCH/DELETE endpoint or UI. Existing sale payments, purchase payments, and manual cash movements retain their previous behavior.

Creation inserts the expense and exactly one OUT / EXPENSE CashMovement inside the same Prisma transaction. Its sourceId and concrete expenseId equal the expense ID. Amount, method, date, reference, description and notes are copied from the expense.

Editing locks the expense row with `FOR UPDATE`, merges a partial PATCH with the locked current data, validates the result, and updates the expense and its existing cash movement in that transaction. The cash movement ID and createdAt are preserved. Editing never creates a second cash row. A missing linked movement returns 409 and rolls back the edit rather than silently creating a replacement. A failure anywhere rolls back both records.

Database uniqueness on expense reference, `(CashMovement.sourceType, sourceId)`, and `CashMovement.expenseId` prevents duplicate references and duplicate links. Concurrent partial edits serialize; independent field edits merge with the latest committed record. Simultaneous edits to the same field use the last serialized value; there is no optimistic version conflict UI or historical revision log in V1.

Only CASH expenses reduce physical cash. CARD, BANK_TRANSFER, CHECK and OTHER appear in financial history/outflows but do not reduce physical cash. Changing an expense from CASH to a noncash method removes its previous cash impact; changing to CASH applies its current amount. Totals remain derived from movements, never an editable balance. Stock is not touched.

## Database

Expense fields: id, required unique reference, category, description, Decimal amount, paymentMethod, expenseDate, optional notes, createdAt and updatedAt.

Database checks enforce positive finite amount, controlled category and payment method. API validation additionally enforces nonblank trimmed reference/description, a real calendar date, textual notes and allowed input fields. Indexes cover expenseDate and category/expenseDate.

CashMovement gains nullable unique expenseId, a RESTRICT foreign key to Expense, and support for EXPENSE in its source check. Existing source rules are retained; expense links cannot be attached to sale, purchase or manual sources.

Migration `backend/migrations/app/20260906T1833_expenses_v1` was emitted, dry-run reviewed and applied transactionally. Nine operations add the expense table, link, indexes/uniqueness, and replace the source check. Prisma classifies dropping the old check as destructive, but this reviewed replacement deletes no data, table or column. Both constraint removal and replacement run in the same migration transaction.

Storage hash: `20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f`.

Migration hash: `7a8305cc0b5a0e7a98897b718fc5844a28de51d35b296216c546b5fe18c3d5e6`.

No backfill was needed: expenses are new. Existing cash rows receive only the new nullable link column. After fixture cleanup, `/expenses` returns `[]`; the original two cash movements and cash summary are unchanged. Snapshots also match for the original 1 product, 4 stock movements, 1 supplier, 1 purchase and 1 sale, including payments and lines. All original fields of cash movements match; their API representation adds nullable expenseId/linkedExpenseId.

## Endpoints and categories

| Endpoint | Behavior |
| --- | --- |
| POST `/expenses` | Validates and atomically creates expense + movement; 201 |
| GET `/expenses` | Lists expenses by expenseDate DESC, id DESC |
| GET `/expenses/:id` | Returns one expense; missing ID 404 |
| PATCH `/expenses/:id` | Validates partial changes and atomically updates both records; 200 |

Invalid inputs return 400, duplicate references return 409 with a French message, and missing expenses return 404. No DELETE endpoint exists. Cash history/detail endpoints now return linkedExpenseId and the expense reference for expense movements.

| Category | French label |
| --- | --- |
| RENT | Loyer |
| ELECTRICITY | Électricité |
| WATER | Eau |
| SALARY | Salaires |
| TRANSPORT | Transport |
| MAINTENANCE | Maintenance |
| ADMINISTRATIVE | Frais administratifs |
| TAX | Taxes |
| OTHER | Autre |

Payment methods reuse CASH, CARD, BANK_TRANSFER, CHECK and OTHER. JSON amounts are strings. PostgreSQL numeric and the existing scaled BigInt money helpers preserve up to 130 integer digits and 36 fractional digits. No floating-point monetary calculations are used. The frontend reuses `paymentDecimal`: `1200,5` becomes `1200.500` without rounding valid precision.

## Frontend

- `/expenses`: Gestion des dépenses, Nouvelle dépense action, required table columns, Voir/Modifier, empty/loading/error states, category/method/inclusive date filters, reference/description search, reset.
- `/expenses/new`: required fields, decimal comma support, notes, payment impact helper, disabled Enregistrement state, Annuler and fresh redirect to `/expenses` after success.
- `/expenses/[id]`: all expense fields and creation date, Impact caisse explanation, edit/back actions.
- `/expenses/[id]/edit`: the same shared form with existing values, PATCH save and API errors.
- `/cash` and `/cash/movements`: Dépense source label/filter and a link to expense details.
- Dépenses navigation links added to products and cash. The expense shell links back to Caisse and existing modules.

API reads use the existing no-store request helper. Values use UTF-8 JSON and Arabic inputs use `dir="auto"`/`bdi`. Forms stack on smaller screens; tables scroll horizontally. Strict TypeScript types and guards are used, with no new libraries.

## Validation results

| Check | Result |
| --- | --- |
| Contract emit, migration review/apply/status | Passed; database up to date |
| Backend build and TypeScript noEmit | Passed |
| Backend unit suite | 120 tests passed across 12 files |
| Full database integration suite | 44 tests passed across 10 files |
| Expense-specific integration suite | 11 tests passed |
| Frontend lint and production build | Passed; all four expense routes included |
| `/expenses`, `/expenses/new`, dynamic detail/edit route shells | HTTP 200; UTF-8 HTML |
| `/cash`, `/cash/movements` | HTTP 200 |
| GET `/expenses` from localhost:3000 origin | HTTP 200; correct allow-origin header |
| POST and PATCH preflights | HTTP 204; localhost:3000 allowed, methods and Content-Type allowed |
| UTF-8 | Arabic expense descriptions/notes preserved in API integration tests |
| Existing data and cash totals | Before/after snapshots unchanged |

Dynamic route shell checks used ID 2147483647, which intentionally does not exist. The client displays the API's clear 404 error for it; valid detail and edit API behavior was verified using disposable expense fixtures. Interactive browser automation was not available, so visual and actual form interaction checks remain the manual steps below.

Expense tests cover all methods, cash deltas, validation, exact large/36-place amounts, unique-source rejection, concurrent duplicate references, forced rollback after create/edit cash writes, editing all fields without changing the movement ID, CASH/noncash transitions, conflicting-reference rollback, concurrent partial edits, listing/detail/link behavior, missing IDs, no deletion endpoint, and unchanged stock. All test data is UUID-tagged and cleaned up.

To reproduce from backend:

```powershell
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run test
$env:RUN_DATABASE_TESTS='1'
npm.cmd run test:e2e -- --no-file-parallelism
```

Run integration files sequentially because the cash/expense tests compare global stock snapshots and balances while other suites create temporary fixtures. From frontend, run `npm.cmd run lint` and `npm.cmd run build`.

## Exact manual steps

Use a test database for recording the following sample expenses. V1 has no delete UI.

1. If needed, start `npm.cmd run start:dev` in `C:\herb-store-system\backend` and `npm.cmd run dev` in `C:\herb-store-system\frontend`, in separate terminals.
2. Open `http://localhost:3000/expenses`. On the unchanged workspace it shows `Aucune dépense enregistrée`. Note the current Solde espèces on `/cash`.
3. Click **Nouvelle dépense**. Enter a unique reference such as `EXP-TEST-0001`, category **Loyer**, description `إيجار المحل`, amount `12,5`, method **Espèces**, a valid date and optional notes. Save once. Confirm Enregistrement/disabled controls, redirect, and display of `12,500 DT`. In Network, verify the POST JSON amount is `"12.500"`.
4. Click **Voir**. Verify every value, notes, creation date and `Cette dépense diminue le solde espèces.` Open `/cash/movements`: exactly one Dépense / Sortie / Espèces row should link to the expense. Physical cash decreases by exactly 12,500 DT.
5. Click **Modifier** on that expense. Verify prefilling. Change amount to `20,25`, method to **Carte**, category to **Transport**, reference to another unique value, description/date/notes. Save. Verify the expense changes and the same cash movement ID remains, with updated amount/method/date/reference/description/notes. Physical cash returns to its value before this sample expense; financial outflows now include 20,250 DT for it. The details explain that noncash expenses do not affect physical cash.
6. Edit the same expense back to Espèces. Physical cash must now decrease by 20,250 DT, with no additional cash row. Re-save a valid edit and confirm the history row count remains unchanged.
7. Create a separate test expense using **Virement bancaire**. It must add financial outflow/history while leaving physical cash unchanged. Repeat with Chèque/Autre if desired; their cash rule is the same.
8. Try a duplicate reference, blank required fields, zero or negative amount and an invalid date. The server/form must reject them clearly without partial records. Try changing an existing expense reference to another expense's reference: neither its expense data nor its cash movement should change.
9. Exercise category/method/date filters, reference and Arabic description search, combined filters and reset. A reversed date range should show an error. Test Annuler, navigation links, and a narrow viewport.
10. Open `/expenses/2147483647` and its `/edit` route: expect a clear not-found API message and back/retry actions. For a connection failure, stop the backend temporarily and reload; restart afterward. Check an uncertain submission's expense/history before retrying.
11. Compare product stock before and after expense creation/editing: stock must not change. In DevTools verify port 3001 requests, successful OPTIONS for POST/PATCH, and localhost:3000 allow-origin headers.

## Files created or modified

Created backend source/tests:

- `backend/src/expenses/expense-validation.ts`
- `backend/src/expenses/expense-validation.spec.ts`
- `backend/src/expenses/expense-cash.ts`
- `backend/src/expenses/expenses.service.ts`
- `backend/src/expenses/expenses.controller.ts`
- `backend/src/expenses/expenses.module.ts`
- `backend/test/expenses.e2e-spec.ts`

Created migration artifacts:

- `backend/migrations/app/20260906T1833_expenses_v1/migration.ts`
- `backend/migrations/app/20260906T1833_expenses_v1/migration.json`
- `backend/migrations/app/20260906T1833_expenses_v1/ops.json`
- `backend/migrations/snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract.json`
- `backend/migrations/snapshots/20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f/contract.d.ts`

Modified backend:

- `backend/src/app.module.ts` — registers ExpensesModule.
- `backend/src/prisma/contract.prisma` — Expense model and CashMovement link/check.
- `backend/src/prisma/contract.json` — emitted contract.
- `backend/src/prisma/contract.d.ts` — emitted types.
- `backend/src/cash/cash.service.ts` — expense link/reference in cash history/detail.
- `backend/migrations/app/refs/db.json` — applied migration reference.

Created frontend:

- `frontend/src/types/expense.ts`
- `frontend/src/app/expenses/page.tsx`
- `frontend/src/app/expenses/expense-ui.tsx`
- `frontend/src/app/expenses/expenses-table.tsx`
- `frontend/src/app/expenses/expense-form.tsx`
- `frontend/src/app/expenses/expense-record.tsx`
- `frontend/src/app/expenses/new/page.tsx`
- `frontend/src/app/expenses/[id]/page.tsx`
- `frontend/src/app/expenses/[id]/edit/page.tsx`

Modified frontend:

- `frontend/src/types/cash.ts` — EXPENSE source and linkedExpenseId guard/type.
- `frontend/src/app/cash/movements-table.tsx` — expense detail link.
- `frontend/src/app/cash/cash-ui.tsx` — Dépenses navigation.
- `frontend/src/app/products/page.tsx` — Dépenses navigation.

Documentation: created `EXPENSE-MANAGEMENT-V1.md`; updated `CAISSE-V1.md` to document the expense editing exception. Build commands regenerate normal dist/.next/TypeScript cache artifacts, not additional implementation source.

## Blockers and warnings

No blocker remains. The first backend build exposed an AsyncIterableResult/Promise mismatch in list loading; it was corrected and subsequent build/type-check/tests passed.

Existing nonblocking warnings remain: Prisma bundled skills sync notice, Vite tsconfig-paths notice, and backend lint's `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:81`. No package or unrelated business logic was changed to address them.

Expenses are intentionally editable without a historical revision log or accounting lock in V1. The current expense-owned cash row reflects the latest saved values; this must be revisited when formal accounting locking/auditing is introduced.
