# General Back-office Dashboard V1

The authenticated home is `http://localhost:3000/`. Login redirects here, and “Tableau de bord” is the first back-office navigation item. Unauthenticated visitors go to `/login`; `/shop` remains public. The read-only backend endpoint is `GET http://localhost:3001/dashboard`.

## Response and permissions

ADMIN receives this shape (example amounts only):

```json
{
  "businessDate": "2026-09-08",
  "timeZone": "Africa/Tunis",
  "today": { "sales": "0.000", "customerCollections": "0.000", "purchases": "0.000", "expenses": "0.000" },
  "balances": { "physicalCash": "0.000", "customerReceivables": "0.000", "supplierPayables": "0.000" },
  "alerts": { "pendingOnlineOrders": 0, "outOfStockProducts": 0, "lowStockProducts": 0 },
  "recentActivity": [],
  "stockAttention": [],
  "pendingOrders": []
}
```

- `recentActivity` has at most 10 items: `id`, `type`, `occurredAt`, `reference`, `description`, `amount`, `href`, `status`. Types are SALE, CUSTOMER_PAYMENT, ONLINE_ORDER, PURCHASE, SUPPLIER_PAYMENT and EXPENSE.
- `stockAttention` has at most 5 items: `id`, `name`, `category`, `status`, `stock`, `unit`.
- `pendingOrders` has at most 5 items: `id`, `reference`, `customerName`, `createdAt`, `totalAmount`.

The session supplies the role. Unauthenticated access returns 401. Query parameters, including `role`, are rejected with 400. There is no dashboard write endpoint. Customer sessions cannot access this endpoint. The ADMIN response does not include user-management metrics. Frontend validation also checks the permitted response shape and internal activity links.

## Authoritative logic and date semantics

- `businessDate()` uses `CASH_TIME_ZONE`, defaulting to Africa/Tunis. The server returns that date and timezone; the browser does not choose the accounting date.
- Today's confirmed sales/purchases use persisted line totals and `saleDate`/`purchaseDate`. Collections use `paymentDate`, across payment methods. Expenses use `expenseDate`.
- Finance's shared `outstandingBalance` preserves its existing confirmed totals minus payments definition. Receivables and payables are cumulative through the current business date, including payments according to their own date.
- Shared `readCashSummary` aggregates cash movements before calling existing `summarizeCash`. Physical cash retains Caisse's existing all-record, CASH-only signed balance, including future-dated records if present. This intentionally differs from Finance's through-date balances.
- Shared `stockCatalogue` extracts the existing catalogue aggregation and uses authoritative `positiveTypes` and persisted `quantityInStorageUnit`. The dashboard includes all back-office products, including inactive/hidden products. No movements means zero stock. Rupture is stock <= 0; low stock is positive stock <= a defined minimum. Ruptures precede low stock, with deterministic name/id ordering.
- Pending counts and latest-five lists include only PENDING orders; cancelled orders are excluded from this section.
- Recent activity represents recent documents, confirmations and payments, not an audit log or daily financial total. Sales/purchases use confirmation time when available, otherwise creation time; orders use cancellation/confirmation/creation time; payments and expenses use creation time. Activity may include draft/cancelled documents with their status displayed.
- PostgreSQL numeric sums remain decimal strings. Existing fixed-precision money helpers preserve up to 36 fractional places. The UI only formats strings with French separators and DT; it performs no financial or stock calculations.

## Query strategy

One REPEATABLE READ, READ ONLY transaction produces a consistent snapshot. ADMIN uses five data queries, excluding authentication and transaction setup. These cover financial aggregates, Caisse aggregates, stock count/list, order count/list and activity. Queries execute sequentially because a transaction uses one PostgreSQL connection; queuing concurrent queries on it provides no database parallelism.

Aggregation stays in PostgreSQL. There is no per-product stock request or full business-table transfer into application memory. Activity limits each source to 10 candidates before combining and limiting globally; line-total subqueries operate only on those bounded candidates. Counts and totals still depend on ledger size, and recent activity timestamp sorts may scan growing tables. No new indexes, migrations, packages or caching were introduced; production-scale query plans remain a future profiling task.

## Files created

- `backend/src/cash/cash-read.ts`
- `backend/src/stock-movements/stock-read.ts`
- `backend/src/dashboard/dashboard.dto.ts`
- `backend/src/dashboard/dashboard-finance.ts`
- `backend/src/dashboard/dashboard-activity.ts`
- `backend/src/dashboard/dashboard.service.ts`
- `backend/src/dashboard/dashboard.controller.ts`
- `backend/src/dashboard/dashboard.module.ts`
- `backend/src/dashboard/dashboard.spec.ts`
- `backend/test/dashboard.e2e-spec.ts`
- `frontend/src/types/dashboard.ts`
- `frontend/src/app/dashboard.tsx`
- `frontend/scripts/verify-dashboard.mjs`
- `GENERAL-DASHBOARD-V1.md`

## Files modified

- `backend/src/app.module.ts`: register dashboard module.
- `backend/src/cash/cash.service.ts`: reuse aggregated cash read helper.
- `backend/src/finance/finance-values.ts`: extract and reuse unchanged outstanding-balance formula.
- `backend/src/public-catalogue/public-catalogue.service.ts`: reuse extracted stock CTE with original public scope.
- `frontend/src/app/page.tsx`: operational dashboard home and metadata.
- `frontend/src/app/login/page.tsx`: successful login redirects to `/`.
- `frontend/src/components/auth-provider.tsx`: first navigation item and exact root active state.
- `frontend/scripts/verify-auth.mjs`: adapt existing login/navigation assertions to the new home.

## Validation results

- Backend build and TypeScript check: passed.
- Backend unit suite: 207 passed across 20 files, including business-date boundary tests.
- Dashboard integration tests: 10 passed, covering raw RBAC responses, exact daily sums, Finance/Caisse agreement, stock thresholds, pending orders, activity filtering, fixed query counts and read-only snapshots.
- Full backend integration suite: 124 passed, 1 skipped across 18 files. The existing last-admin concurrency test skips when retained active admins exist; the manual ADMIN was deliberately left unchanged.
- Backend lint: passed with the existing `no-unsafe-finally` warning in a stock test.
- Frontend production build: passed.
- Frontend lint: passed; an unused test-script variable reported by the final run was removed and the changed script rechecked.
- Current authorization and validation: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- CORS login preflight: 204, exact localhost:3000 origin and credentials allowed. Unauthenticated dashboard: 401.
- One browser rerun encountered a temporary login connection failure; connectivity/preflight checks and the subsequent complete run passed.
- Current authorization and validation: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).

Browser evidence is locally available in `.tmp/dashboard-validation-1788865419605/`. The browser harness uses an isolated headless Chrome debugging port 9223 and both running application servers. Passwords are generated only in memory.

## Exact manual checks

1. Keep backend running on localhost:3001 and frontend on localhost:3000. Open `http://localhost:3000/` signed out: expect `/login`. Open `/shop`: it must remain public.
2. Sign in at `http://localhost:3000/login` as `admin@test.local` using the previously supplied password. Expect `/`, your name, Administrateur, ten cards and five quick actions.
3. Compare Solde espèces with `/cash`. Compare Créances clients and Dettes fournisseurs with `/finance`, setting its end date to the dashboard's displayed business date. For today's financial totals, select that same date as both start and end. Compare confirmed document totals and payments by their domain dates, not creation timestamps.
4. Open `/stock`; compare rupture/low counts using the stated thresholds across all products. Open a stock-attention link and verify its quantity and unit. Compare pending count/list with `/online-orders?status=PENDING`; verify links open the right orders.
5. Check recent activity types, references, amounts and links. Reload `/` and ensure current data loads. In browser Network tools, block the dashboard request and reload; expect an error. Unblock it and select Réessayer; expect recovery.
6. With only a customer session, internal dashboard navigation redirects to login and GET `/dashboard` returns 401.
- Current authorization and validation: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
8. As ADMIN, verify the complete dashboard; with only a customer session, GET `/dashboard` returns 401. Client role overrides are rejected.
9. Check the dashboard at desktop, tablet and mobile widths. Existing Arabic product/customer names must display correctly. No manual business mutation is needed for these checks.

## Limitations and warnings

Dashboard data reloads on mount/navigation or retry; it does not poll live. Activity is limited to ten records, stock attention and pending orders to five each. Existing business values, including negative cash balances if present, are displayed without correction. This task does not redesign the whole application or alter business rules.

Existing toolchain warnings (including Prisma/Vite warnings) remain. The previously recorded authentication production dependency audit reported 14 findings, including 9 high; dependency remediation was outside this task and that audit was not rerun here. No dashboard integration blocker remains.
