# Audit / Traceability V1

The ADMIN journal is `http://localhost:3000/audit`; details are `/audit/[id]`. Historical actions before Audit V1 are not reconstructed. Audit starts with new actions after deployment of this version.

## Model and migration

`AuditEvent` stores: id, nullable actorUserId, actorNameSnapshot, actorEmailSnapshot, actorRoleSnapshot, action, entityType, nullable entityId/entityReference, outcome, nullable metadataJson, ipAddress, userAgent and createdAt. There is no updatedAt. Actor identity is stored as snapshots without a User foreign key, so renaming, changing roles or deleting an account does not rewrite its history.

Outcome is SUCCESS or FAILURE, enforced by a database CHECK. Action and entity codes are controlled by the central writer's allowlists. Metadata uses PostgreSQL JSON. Five composite indexes support newest-first reads and common filters: (createdAt,id), (actorUserId,createdAt), (action,createdAt), (entityType,createdAt), (outcome,createdAt).

The additive migration `20260908T1917_audit_v1` was emitted, planned, dry-run reviewed and applied. It contains one CREATE TABLE and five CREATE INDEX operations; no existing business table was altered or backfilled. Commands, from `backend`:

```powershell
npm.cmd run contract:emit
npm.cmd exec -- prisma migration plan --name audit_v1
npm.cmd exec -- prisma db update --dry-run
npm.cmd exec -- prisma db migrate --advance-ref db
```

New contract hash: `4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48`. Migration hash: `703cd50aafc3e4b352f08cd7cb7900a7419ab3f5bfe83464fddb7641a651e71c`. As with existing migrations, the generated operations getter has an explicit return type for TypeScript declaration compatibility; self-emission preserved the SQL operation content.

## Architecture and consistency

`AuditInterceptor` creates an AsyncLocalStorage scope after the existing auth/RBAC guard. The scope contains only the safe authenticated actor snapshot, direct socket IP and bounded User-Agent. It does not retain the body, cookies, authorization header or session token. Nested asynchronous work keeps that request's actor; parallel requests have separate scopes.

Service mutation paths call centralized `audited()` / `AuditService.record()` after successful domain writes and before their transaction commits. Product and supplier creation now use the existing document transaction helper. Product locking now uses Prisma's transaction-scoped ORM on the same owned PostgreSQL client; product/stock changes and audit inserts therefore commit or roll back together. Business validation/calculation formulas were not changed.

Every audited back-office business API writes its success event in the same transaction. An audit insertion failure fails the mutation and rolls back its stock, document and payment effects. There is no post-commit business success logging exception.

Auth events are deliberately different: after login/session creation or logout/session deletion, the controller calls a separate best-effort security writer. It has bounded connection/query timeouts. Failure logs only the constant operational message `Security audit write failed` and does not block the successful login/logout. No raw database error or credentials are logged by that handler. Credential rejection produces AUTH_LOGIN_FAILURE with null actor and FAILURE; attempted email is intentionally omitted for data minimization and to avoid implying account existence. Middleware rate-limit/origin rejections are not duplicated into the audit table.

Attribution is explicit: service calls outside HTTP must enter an `auditContext.run(...)` scope to produce events. Existing internal test setup/bootstrap calls without a scope remain outside this back-office audit stream; no actor is guessed. Future jobs requiring system attribution should establish a scope with actor null. Reads and public requests do not acquire events merely because a request scope exists.

## Stable action list

| Area | Codes |
| --- | --- |
| Authentication | AUTH_LOGIN_SUCCESS, AUTH_LOGIN_FAILURE, AUTH_LOGOUT |
| Users | USER_CREATE, USER_UPDATE, USER_ROLE_CHANGE, USER_ACTIVATE, USER_DEACTIVATE, USER_PASSWORD_CHANGE |
| Products | PRODUCT_CREATE, PRODUCT_UPDATE, PRODUCT_DELETE |
| Manual stock | STOCK_ENTRY_CREATE, STOCK_EXIT_CREATE, STOCK_LOSS_CREATE, STOCK_ADJUSTMENT_IN_CREATE, STOCK_ADJUSTMENT_OUT_CREATE, STOCK_RETURN_IN_CREATE |
| Suppliers | SUPPLIER_CREATE, SUPPLIER_UPDATE, SUPPLIER_ACTIVATE, SUPPLIER_DEACTIVATE |
| Purchases | PURCHASE_CREATE, PURCHASE_UPDATE, PURCHASE_CONFIRM, PURCHASE_PAYMENT_CREATE |
| Sales | SALE_CREATE, SALE_UPDATE, SALE_CONFIRM, SALE_PAYMENT_CREATE |
| Expenses | EXPENSE_CREATE, EXPENSE_UPDATE |
| Manual caisse | CASH_MANUAL_IN_CREATE, CASH_MANUAL_OUT_CREATE |
| Online orders | ONLINE_ORDER_CONFIRM, ONLINE_ORDER_CANCEL, ONLINE_ORDER_CONVERT_TO_SALE |
| Store settings | STORE_SETTINGS_UPDATE |

An update that changes a user's role and activation together records one USER_ROLE_CHANGE with both before/after pairs. Otherwise activation transitions take precedence over generic USER_UPDATE. Supplier activation transitions similarly use one activation event with update field names. Conversion records one event only when creating the order/sale link; repeated idempotent conversion calls produce none. The conversion's internally created draft sale is covered by the conversion event.

Entities: USER, PRODUCT, STOCK_MOVEMENT, SUPPLIER, PURCHASE, PURCHASE_PAYMENT, SALE, SALE_PAYMENT, EXPENSE, CASH_MOVEMENT, ONLINE_ORDER, STORE_SETTINGS, AUTH_SESSION.

## Metadata, privacy and request context

`safeMetadata()` builds a new allowlisted object, never a full object dump or arbitrary nested diff. Supported data is limited to:

- Whitelisted submitted/validated update field names under `changedFields`; these identify fields included in the update, not a complete semantic before/after diff.
- Controlled roleBefore/roleAfter and boolean activeBefore/activeAfter.
- Valid productId/saleId/purchaseId, exact decimal amount, controlled paymentMethod and movementType.

Password/passwordHash/token/cookie/header fields, unknown keys and nested objects are discarded. Password changes log the action and target user ID, without password values or hashes. Store settings log only field names; footer/contact values are not copied. Actor/reference text is bounded, control characters are removed, and React renders all text escaped. Metadata is sanitized again on audit reads.

IP comes from `request.socket.remoteAddress`. X-Forwarded-For is not trusted. User-Agent is limited to 512 characters and treated as untrusted display text. Behind a production reverse proxy this records the proxy's direct address; trusted proxy configuration and any switch to a derived client IP require an explicit deployment decision. Audit contains personal actor snapshots/IPs, so access remains ADMIN-only.

## Intentionally unaudited actions

- Catalogue/cart/report/dashboard/settings reads and normal public order creation.
- Automatic stock ENTRY/EXIT from purchase/sale confirmation and automatic cash entries from payments/expenses; the parent action already explains them.
- Ordinary validation failures, rejected business transitions, denied RBAC requests and blocked product deletion.
- Repeated conversion requests that return an already-linked sale.
- Raw bootstrap/test-setup service calls without an audit scope, and historical actions before deployment.

## Read API, filtering and immutability

`GET /audit-events` and `GET /audit-events/:id` require ADMIN. An ADMIN session is required. Customer-only or unauthenticated access returns 401. There are no POST, PATCH or DELETE audit routes and no editing/deletion UI. Audit records are append-only through normal application APIs. The database owner still has maintenance privileges; V1 does not add database triggers, cryptographic tamper evidence or external immutable storage.

List parameters: dateFrom, dateTo, actorUserId, action, entityType, outcome, search, page and pageSize. Unknown/invalid parameters return 400. Page size defaults to 25 and is capped at 100. Results are ordered by createdAt DESC, id DESC. Date boundaries are inclusive business-calendar days using `CASH_TIME_ZONE` (Africa/Tunis by default); the upper bound is the next local midnight. Search matches actor name/email or entity reference, with SQL parameters and literal escaping for LIKE wildcard characters.

Response: `{ data: AuditEvent[], pagination: { page, pageSize, totalItems, totalPages }, timeZone }`. Detail returns a single event; unknown IDs return 404. List reads use one count and one bounded data SELECT in a read-only snapshot, with no actor joins. Search and large offsets can become expensive at high volume; retention/archiving and search indexing are future work.

## Frontend

ADMIN navigation includes Journal d’audit. `/audit` provides all requested columns, French action/entity labels, filters, reset, empty/loading/error/retry states and server pagination. The actor filter accepts a numeric user ID shown alongside actor names, so historical records do not depend on a current user dropdown. `/audit/[id]` displays snapshots, stable codes, reference, result, IP, User-Agent and safely escaped metadata. List timestamps use business timezone; detail explicitly displays UTC. On narrow screens the table scrolls within its container; the detail page and filters stack without page-wide overflow.

## Files created

- `backend/src/audit/audit-values.ts`
- `backend/src/audit/audit-context.ts`
- `backend/src/audit/audit.service.ts`
- `backend/src/audit/audit.interceptor.ts`
- `backend/src/audit/audit-query.ts`
- `backend/src/audit/audit-read.service.ts`
- `backend/src/audit/audit.controller.ts`
- `backend/src/audit/audit.module.ts`
- `backend/src/audit/audit.spec.ts`
- `backend/test/audit.e2e-spec.ts`
- `backend/test/audit-isolation.ts`
- `backend/migrations/app/20260908T1917_audit_v1/migration.ts`
- `backend/migrations/app/20260908T1917_audit_v1/migration.json`
- `backend/migrations/app/20260908T1917_audit_v1/ops.json`
- `backend/migrations/snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract.json`
- `backend/migrations/snapshots/4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48/contract.d.ts`
- `frontend/src/types/audit.ts`
- `frontend/src/app/audit/page.tsx`
- `frontend/src/app/audit/[id]/page.tsx`
- `frontend/scripts/verify-audit.mjs`
- `AUDIT-V1.md`

## Files modified

- `backend/src/prisma/contract.prisma`, `contract.json`, `contract.d.ts`: model and emitted artifacts.
- `backend/migrations/app/refs/db.json`: applied migration reference.
- `backend/src/app.module.ts`: register AuditModule.
- `backend/src/prisma/product-transaction.ts`: expose the owned client and use the scoped ORM transaction.
- `backend/src/auth/auth.controller.ts`: security events.
- `backend/src/auth/users.service.ts`: user mutation events.
- `backend/src/products/products.service.ts`: product events and transactional creation.
- `backend/src/stock-movements/stock-movements.service.ts`: manual movement events.
- `backend/src/suppliers/suppliers.service.ts`: supplier events and transactional writes.
- `backend/src/purchases/purchases.service.ts`: purchase/payment events.
- `backend/src/sales/sales.service.ts`: sale/payment events.
- `backend/src/expenses/expenses.service.ts`: expense events.
- `backend/src/cash/cash.service.ts`: manual cash events.
- `backend/src/online-orders/online-orders.service.ts`: status events.
- `backend/src/online-orders/order-fulfillment.service.ts`: first conversion event.
- `backend/src/settings/store-settings.service.ts`: settings event.
- `backend/vitest.config.e2e.ts`: isolated audit/settings tables for integration checks.
- `backend/test/products-stock.e2e-spec.ts`, `backend/test/suppliers.e2e-spec.ts`: keep the new transaction entry points inside existing rollback-only test harnesses.
- `frontend/src/lib/auth.ts`, `frontend/src/components/auth-provider.tsx`: ADMIN-only audit navigation/access.
- `STORE-SETTINGS-V1.md`: link to the new settings audit behavior.

Ignored local verification artifacts include `.tmp/cleanup-audit-test-fixtures.mjs`, `.tmp/audit-http-smoke.mjs` and `.tmp/audit-validation-*` browser screenshots. They contain no saved passwords. The temporary smoke server on port 3002 was stopped.

## Validation results

- Backend production build, full TypeScript check and lint passed. Lint retains the pre-existing `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:81`.
- Unit suite: 241 passed across 22 files.
- Full integration suite: 142 passed, 1 skipped across 20 files. After adding the explicit auth-audit-outage case, the focused audit suite passed all 11 tests; this adds one passing case to the previously passing full suite.
- Audit tests cover auth success/failure/logout, safe metadata, user/security changes, all manual movement types, supplier/purchase/sale/payment/expense/cash/order/settings actions, no automatic duplicates, repeated conversion, snapshots, failed transaction rollback, API immutability/RBAC, date/filter/search/pagination behavior, safe auth outage handling and unchanged existing business data.
- Frontend lint, production build and TypeScript check passed; `/audit` returns HTTP 200 for its authenticated shell and unauthenticated `/audit-events` returns 401.
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Browser evidence: `.tmp/audit-validation-1788895998682/`.

Integration audit/settings tables are isolated copies; no synthetic historical events are inserted into the live journal. Browser tests used real actions on UUID-owned fixtures, then removed only their own events/users/business rows through test cleanup. Pre-existing business data, audit history, Slouma Store settings and retained manual accounts were verified unchanged. An initial regression run exposed old test-harness transaction/spying assumptions; these were corrected, and its one product/two supplier leftovers were removed by their exact test UUIDs before the passing rerun.

## Exact manual test

1. With backend localhost:3001 and frontend localhost:3000 running, log in at `http://localhost:3000/login` as `admin@test.local` using the previously supplied password.
2. Edit a disposable/test product. Give it a unique SKU and barcode, then change its French name. Do not use an important live product for this test.
3. Open `/stock/new-entry`, choose that test product, enter a small positive quantity and explicitly select its allowed unit. Use a recognizable test reference; save.
4. If practical, create a disposable sale from `/sales/new` for that product within available stock, then open it and confirm via the confirmation dialog. This is a real stock mutation and should be done only on the test product.
5. Open `/audit`. Expect login success, product update, manual stock entry, sale creation and confirmation. There should be no separate automatic STOCK_EXIT_CREATE for that sale confirmation.
6. Filter by your displayed user ID, date, action, entity, outcome or the test reference. Change page size, use next/previous and Réinitialiser.
7. Select Voir. Verify your actor snapshots, entity/reference, timestamp, safe metadata and direct IP/User-Agent. No password, hash, auth cookie or token should appear.
8. For additional coverage, explicitly save a harmless store-setting change and inspect STORE_SETTINGS_UPDATE: only field names should be in metadata. Restore your preferred setting afterward.
9. Verify ADMIN access and customer-only denial for internal pages/APIs. See [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md) for current checks and migration behavior.
10. Sign out and request `/audit-events`: expect 401. No audit edit/delete controls or endpoints should exist. Manual test events intentionally remain in the journal; do not attempt to remove them through the application.

## Limitations, blockers and warnings

No audit implementation blocker remains. Audit is not SIEM/debug logging, a full field diff, cryptographic proof, or a retention/archive system. Auth audit is best effort and can be absent during an audit outage. Unscoped internal scripts are not attributed automatically. Administrative database maintenance can still change the table; normal application APIs cannot.

Browser validation uncovered an existing unrelated product-form issue: blank barcode is submitted as an empty string and can violate `product_barcode_key` if another product already has an empty barcode, returning HTTP 500. It was reproduced on a disposable product. No business data or barcode rules were changed; the final browser test used a unique barcode. Fixing empty-barcode normalization and its error response remains separate work.

Existing Prisma skill-sync and Vite tsconfig-paths notices remain. No packages were installed, no secrets were written to source/docs, and no historical events were fabricated.
