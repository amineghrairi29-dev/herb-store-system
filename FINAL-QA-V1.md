# Final QA / Bug Fixing V1

Date: 2026-09-09. Environment: local Windows, PostgreSQL 18, NestJS API on port 3001 and Next.js production frontend on port 3000.

## Executive summary and decision

**READY FOR DEPLOYMENT PREPARATION**

No unresolved P0/P1 application defect was found in the executed checks. Four product/API defects and one integration-runner isolation defect were fixed without changing stock, payment, accounting, or order business rules. The full regression, representative browser workflows, database integrity review, and disposable backup restore passed.

This is a readiness assessment for the next deployment-preparation phase, not a claim of universal production security. Production HTTPS, origins, secrets, proxy configuration, database access, operational monitoring, and off-host backup arrangements still require deployment-specific validation.

The working tree was inspected before changes; most project files were already untracked. Existing work was preserved. An internal checklist was written to `.tmp/final-qa-checklist.md` before applying fixes. No dependency upgrade, schema change, migration rewrite, database reset, or manual-user password change was performed.

## Findings and fixes

| Priority | Confirmed defect | Resolution and evidence |
| --- | --- | --- |
| P2 | Empty/whitespace barcodes were treated as real unique values; clearing an existing barcode was not reliably represented by the frontend payload. | Backend create/update normalizes blank strings to SQL null. DTO/input types accept null. Shared product form sends null when the barcode is cleared. Multiple absent barcodes and clearing/reusing a former barcode pass HTTP regression tests. |
| P2 | Duplicate SKU or non-empty barcode surfaced as HTTP 500. | Existing database uniqueness remains authoritative; recognized unique violations become a clear HTTP 409. Create and update conflicts are tested. |
| P2 | Product GET accepted invalid IDs or returned 200/null for missing products. | Invalid/nonpositive/out-of-range integer IDs return 400; valid missing IDs return 404. Five invalid-ID cases and missing-product checks pass. |
| P2 | Deleting a product referenced by a draft document surfaced as HTTP 500. | PostgreSQL foreign-key/restrict SQLSTATE 23503 and 23001 become a clear 409. Browser reproduction involved a draft purchase; regression coverage uses a draft sale and verifies neither record is deleted. Stock-history deletion protection remains unchanged. |
| P2, test tooling | Default parallel integration files interfered with each other's shared-database aggregate assertions. | Set `fileParallelism: false` in the integration configuration. Individual concurrent confirmation/payment/conversion tests still run their concurrent requests. Full serial suite passes. |

No P0 or P1 finding remains. No cosmetic redesign was necessary.

### Blank-barcode root cause

PostgreSQL uniqueness distinguishes null from an empty string: several null values are allowed, but repeated empty strings conflict. Input validation previously kept empty strings, and the frontend omitted an empty optional field instead of explicitly clearing its value. Normalization now occurs at the API boundary on both create and update. A PATCH that omits barcode still preserves it; explicit null/blank clears it. Non-empty strings are trimmed and remain unique.

Existing business rows were not bulk-normalized. Any previously stored empty barcode is normalized when that product is subsequently saved through the corrected flow. The database unique constraint was not weakened.

## Modules reviewed and validation coverage

Coverage below combines source inspection, the executed unit/integration suites, and the browser scenario. It does not imply that every combination was clicked manually in a browser.

| Area | Executed coverage |
| --- | --- |
| Products | Create/edit/delete rules; optional barcode null handling; real SKU/barcode conflicts; Arabic/French/scientific names; category, stock units/factor and range validation; history restrictions; 400/404/409 behavior. Browser create/edit/clear barcode. |
| Stock | All six movement types, exact conversion and signs, protected negative movements, concurrent exits, derived stock, thresholds/statuses and read views. No frontend stock calculation was added. |
| Suppliers/purchases | Supplier lifecycle, draft editing, confirmation, one ENTRY per line, repeat/concurrent confirmation, rollback, historical totals and confirmed-document restrictions. |
| Sales | Draft editing, one EXIT per line, insufficient-stock rollback, concurrent confirmation, confirmed immutability and converted-order sales. |
| Payments | Customer/supplier payment summaries, exact settlement, overpayment and concurrent-payment protection, no stock effects. |
| Cash/expenses | Manual and linked flows, one linked movement, CASH-only physical balance, non-CASH history, expense categories/updates and unchanged stock. Browser scenario changes an expense payment method and restores it without duplicating the cash row. |
| Finance/dashboard | Confirmed revenue/purchases, payments, expenses, receivables/payables, CASH balance and documented estimated activity result. Date boundaries and role projections are tested. Live finance/report summary comparison passes for the same dates. |
| Reports | All seven reports: sales, purchases, expenses, customer collections, supplier payments, cash and financial summary. Integration tests cover filtering, sorting, pagination, full-filter summaries, boundaries and empty output. Live CSV downloads and browser PDF generation pass for all seven. |
| Public catalogue | Three-flag visibility, hidden-product 404, visible out-of-stock products, safe public projection, search/filter/sort/pagination and stock statuses. |
| Cart | Batch validation, current prices, exact totals, duplicate merging, decimal/comma quantities, persistence, malformed storage, unavailable products, removal/clear, overstock rejection and simulated API failure/retry. |
| Orders/fulfillment | Required inputs, authoritative price, reference/phone lookup privacy, transitions, no reservation, conversion idempotency/concurrency, snapshot prices and no automatic payment. Full stock lifecycle described below passed. |
| Authentication/users | Login/logout/me, cookies, session persistence/revocation, inactive users, wrong credentials, login throttling and safe user projection. Dedicated disposable role accounts used; manual accounts untouched. |
| Settings/audit | Isolated settings singleton/TND/UTF-8/permissions; branding and safe public projection. ADMIN-only append-only audit endpoints, actor snapshots, metadata safety, transactional success events and best-effort authentication events. Real browser actions were retained in audit history. |
| Security | Existing automated header, CORS/origin, CSRF, cookie, production-environment/secret, input-bound and safe-error tests rerun. No unsafe HTML rendering found during source search. Existing controls preserved. |

## Automated results

| Validation | Result |
| --- | --- |
| Backend `npm run build` | Passed |
| Backend `npx tsc --noEmit` | Passed, including final test-runner configuration |
| Backend `npm run lint` | Passed with one pre-existing warning described below |
| Backend full unit suite | **255 passed, 23 files** |
| Backend full database integration suite | **151 passed, 1 skipped, 21 files**; 92.99 seconds |
| New product HTTP QA | **7 passed**, included above |
| Frontend `npm run lint` | Passed |
| Frontend production build | Passed with `NEXT_PUBLIC_API_URL=http://localhost:3001` |
| Frontend cart arithmetic tests | **3 passed** |
| Additional compiled decimal assertions | All six requested representative values and gram conversion passed |

Database tests require a session-only setting before running from `backend`:

```powershell
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e
```

The final full run used `--no-file-parallelism`, which now matches the committed configuration's default behavior. The skipped test attempts to arrange a last-active-ADMIN scenario; it deliberately skips when another active manual ADMIN exists. That account was not disabled to force coverage. Other auth/RBAC tests passed. Without `RUN_DATABASE_TESTS=1`, the database suites are skipped; an initial invocation without that flag was not counted as database verification.

Recorded failures were not discarded: initial product regressions reproduced the API defects; a later browser run identified SQLSTATE 23001 specifically. A parallel integration invocation failed from shared-fixture interference (log retained as `.tmp/final-qa-integration-parallel-failure.log`), followed by the passing serial run. Browser harness setup also encountered unavailable local servers and an unsigned parser assumption about an already-negative cash balance; servers were restarted and the harness parser corrected. Negative existing cash was not treated as corrupted business data. The integrity helper initially used the wrong purchase reason label; correcting it to the application's `Achat fournisseur` resolved that false finding.

## Browser, navigation and RBAC results

`frontend/scripts/verify-final-qa.mjs` passed against the running applications:

- 66 layout checks across desktop 1440 px, tablet 768 px and mobile 390 px; no document-wide overflow.
- Representative login, dashboard, products, stock, purchases, sales, cash, finance, reports, shop, cart, checkout, online orders, users, settings and audit pages.
- 86 collected navigation links returned HTTP 200. API permission checks were performed separately: a frontend route returning an HTML shell is not proof of authorization.
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Successful run recorded no uncaught runtime exceptions, hydration/key warnings or API 500 responses. Navigation-aborted requests were recognized as navigation cancellations.
- Seven live CSV files with UTF-8 BOM and seven browser-generated report PDFs. This verifies browser export generation, not physical printer output or every printer configuration.

Mobile products, stock, reports and catalogue screenshots were visually reviewed. Wide management tables stay within their horizontal scrolling containers; controls and Arabic text remain readable. No redesign was applied.

The separate existing `verify-cart.mjs` browser regression also passed at 1280/768/390 px, including current-price revalidation, hidden/unavailable products, removal, clear confirmation/cancellation, refresh persistence and a simulated 503 followed by successful retry. No cart request changed business data.

Artifacts:

- `.tmp/final-qa-1788958305059/`: results, mobile screenshots, seven CSV and seven PDF files.
- `.tmp/cart-validation-1788958822843/`: additional cart screenshots.
- `.tmp/final-qa-browser.log`, `.tmp/final-qa-cart-browser.log`, `.tmp/final-qa-unit.log`, `.tmp/final-qa-integration.log` and build/lint logs.

## Full disposable business scenario

1. Created an Arabic/French product through the browser with a blank barcode; edited it to a real barcode, then cleared it and verified null.
2. Created a supplier and confirmed a purchase of 12 KG at 0.1: total 1.2, stock 12.
3. Confirmed a sale of 2 KG at 0.3: total 0.6, stock 10.
4. Recorded a customer CASH payment of 0.3, supplier CASH payment of 0.2 and CASH expense of 0.1. Net physical cash change was exactly zero; payments did not change stock.
5. Changed the expense to CARD, then back to CASH: physical cash adjusted correctly and the same linked movement was updated.
6. Published the disposable product at 12.500; public cart merged two additions into quantity 2 and total 25.000. Real checkout created a PENDING order; reference plus phone lookup worked and a wrong phone returned 404.
7. Order creation: stock **10**. Order confirmation: **10**. Conversion: one DRAFT sale, stock **10**. Repeated conversion returned the same sale. Sale confirmation: stock **8**, exactly one EXIT and no automatic SalePayment.
8. Compared live finance/report figures and exported all reports. Verified expected sensitive actions in audit history without password metadata.

Scenario result: **passed**. Disposable business records and temporary role users were cleaned up; real application audit events were retained.

## Data integrity and preservation

Read-only repeatable-read queries checked all **15 public foreign-key relationships**: zero orphans. Nine additional checks found zero duplicate cash sources, duplicate order-sale links, inconsistent conversions, missing payment/expense cash links, cash amount/method mismatches, or wrong confirmed-document movement cardinality.

The cardinality review matches the existing document reference, product and generated reason convention; it complements database foreign keys and concurrent-operation tests rather than replacing them with a new linkage model.

Final data counts include 3 users, 3 sessions, 1 product, 4 stock movements, 1 supplier, 1 purchase/line/payment, 1 sale/line/payment, 1 expense, 3 cash movements, 1 order/line, 1 settings row and 38 audit events. No fixture tables remained.

The business browser harness compared exact snapshots of pre-existing rows before/after cleanup, including users, sessions, settings and earlier audit entries. Cart cleanup separately compared original product/stock/sale/cash rows. Pre-existing manual user credentials and business data were preserved. Successful browser QA retained 25 audit events; earlier failed attempts retained another 7, for **32 new QA audit events**. None were removed to hide test actions. Integration suites use their existing disposable audit/settings tables and do not rewrite real history. Disposable inserts can advance identity sequences; gaps are expected and were not reset.

## Decimal and UTF-8 review

Authoritative quantities/money continue to use decimal strings and integer-based arithmetic. Tests cover 0.1 + 0.2 = 0.300, exact settlements, conversions beyond JavaScript's safe integer range and rejection of inexact conversions. Additional compiled-code assertions checked **0.1, 0.2, 0.3, 2.5, 12.500 and 1000.001**; 1000.001 G converted exactly to 1.000001 KG at factor 1000.

The existing maximum of 18 input decimal places remains. Line multiplication can preserve up to 36 result decimal places; this was not replaced by floating-point rounding. Display formatting is distinct from authoritative arithmetic.

Arabic/French values were verified through API/database/browser and CSV tests, including products, supplier/customer text, expenses, audit and isolated store settings. Backup comparison also confirmed exact Arabic/accented text and decimals. Windows console encoding artifacts were not mistaken for application encoding defects.

## Dependencies, migrations and backup

Dependency audits rerun without upgrades:

| Scope | Findings |
| --- | --- |
| Backend production | 0 |
| Frontend production | 0 |
| Frontend full tree | 0 |
| Backend full tree | 18: 10 high, 6 moderate, 2 low; development tooling, unchanged from Security V1 |

The pinned Prisma/Nest tooling tree still needs dependency review before use in a deployment pipeline. Do not use force upgrades or deploy the development/composer dependency tree unreviewed. Runtime audit results are a point-in-time result, not a security guarantee.

`prisma migration status`: up to date, no pending migration. `prisma db verify`: contract marker and introspected schema match, no drift warnings/unclaimed objects. Current storage hash:

`4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48`

A fresh contract emit into `.tmp/final-qa-contract` produced matching contract JSON/hash. The RC emitter's declaration output still references unpublished `@internal/*` imports; the working declaration uses the existing public `@prisma/orm-postgres/*` compatibility imports. The declaration difference is imports/formatting, not a model change. Generated working files were not blindly overwritten. This is a known tooling limitation to revisit when the pinned toolchain is updated.

Backup regression used the existing scripts: a non-empty custom archive was restored into a separate disposable database. All 20 application/Prisma table counts and exact text/decimal contents matched the snapshot; unsafe targets were rejected, source data remained unchanged, and only the disposable restore database was dropped.

Archive retained locally, ignored by Git:

`backups/herb_store_db_2026-09-09_135711_142_7e2a0fdcca7b43b8a770a5632824ce3a.dump` (133,978 bytes).

Evidence: `.tmp/security-backup-validation.json` and `.tmp/final-qa-integrity.json`. The dump contains application data, including authentication records, and must be handled as a private local backup.

## Remaining warnings and limits

- P3: existing `no-unsafe-finally` lint warning at `backend/test/stock-movements.e2e-spec.ts:81`; lint exits successfully.
- P3/tooling: Vite reports the existing tsconfig-paths plugin deprecation; Prisma reports skills/emitter compatibility warnings. Builds/type checks pass with current files.
- Development dependency advisories above remain open; production dependency audits are clean. No breaking dependency changes were attempted.
- Last-active-ADMIN concurrency test deliberately skipped to preserve the manual ADMIN. Re-run it against an isolated empty QA database during deployment preparation.
- Browser testing used Chromium emulation, not physical iOS/Android devices, Firefox/Safari, accessibility certification, load testing or a penetration test. PDFs were generated; physical printing remains manual.
- Deployment HTTPS, persistent secrets, cookie/origin behavior behind the chosen proxy, TLS/private database access, shared throttling if scaled, and protected off-host backup retention remain next-phase configuration work.

## Exact manual checks still recommended

Use clearly tagged disposable records; do not alter existing business rows to arrange these checks. Retain audit history for any manual test actions.

1. Log in at `http://localhost:3000/login` as ADMIN and verify all internal menus. Customer-only sessions must be denied internal API access. Do not reset manual passwords for QA.
2. At `/products/new`, create two uniquely named test products with empty barcode fields. Edit one, enter a unique barcode, save, clear it and save again. Assign that freed barcode to the other product; a simultaneous real duplicate should show a clear conflict. Use Arabic/French names and confirm table/form display.
3. On disposable stock only, test each of `/stock/new-entry`, `/stock/new-exit`, `/stock/new-loss`, `/stock/new-adjustment-in`, `/stock/new-adjustment-out`, `/stock/new-return`. Check allowed units/current stock and try an excessive negative quantity. Expect a clear insufficient-stock error and no stock change. Never perform this against real stock.
4. Repeat the documented purchase/sale/payment/expense scenario with small tagged amounts. Confirm a document twice and verify no extra stock movement. Try an overpayment. Verify CASH versus CARD effects and finance/report equality with identical dates.
5. In a private browser, open `/shop`, add a tagged available product twice, reload `/shop/cart`, remove/clear and test decimal quantity entry. Complete `/shop/checkout`; confirm and convert that order as an authorized user. Check stock stays 10 through order/confirmation/conversion and becomes 8 only on sale confirmation.
6. At `/reports`, open each of the seven reports. Choose a date range with no rows, then one with tagged records; verify filters, page totals/full summaries and CSV Arabic/French text in your spreadsheet application. Use Print/PDF on the actual browser/printer you intend to support.
7. At 390 px/mobile and on an actual phone, inspect dashboard/forms/tables/public checkout; swipe wide tables to reach actions. Check keyboard focus, long names and back/cancel controls. Repeat representative flows in Safari/Firefox if those are supported browsers.
8. Temporarily block the API in browser developer tools (do not change backend data), reload a list/cart, verify error/retry, then unblock and retry. Try an unknown product URL and an unauthorized page.
9. Verify ADMIN access and customer-only denial for internal pages/APIs. See [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md) for current checks and migration behavior.
10. In deployment preparation, repeat production startup/cookie/origin checks over real HTTPS and restore a private backup to a separate empty recovery database. Never target the main database for the restore drill.

## Files created or modified in this task

Modified:

- `backend/src/products/dto/create-product.dto.ts` — nullable barcode input.
- `backend/src/products/product-validation.ts` — normalize blank/null barcode consistently.
- `backend/src/products/product-validation.spec.ts` — barcode regression assertions.
- `backend/src/products/products.service.ts` — product conflict/error mapping and GET ID/not-found handling.
- `backend/vitest.config.e2e.ts` — sequential integration files for shared-database isolation.
- `frontend/src/types/create-product.ts` — nullable barcode input type.
- `frontend/src/app/products/product-form.tsx` — explicitly send null when clearing barcode.

Created:

- `backend/test/product-qa.e2e-spec.ts` — disposable product API regressions.
- `frontend/scripts/verify-final-qa.mjs` — browser/business/RBAC/responsive harness with audit-preserving cleanup.
- `scripts/verify-integrity.mjs` — read-only orphan and side-effect consistency checks.
- `FINAL-QA-V1.md` — this report.

Ignored local outputs: checklist, emitted comparison contract, logs, screenshots, CSV/PDF artifacts, build output and the backup archive described above. No credentials were added to source, documentation, examples or Git. No business model or migration file was modified.
