# Reporting V1

Implemented 2026-09-07. Start at `http://localhost:3000/reports` (Rapports — Analyse et export des données de gestion). All reporting APIs are GET-only and run their data reads in a repeatable-read, read-only transaction. No schema, index, package, financial record, or stock business rule was changed.

## Pages and endpoints

The common dynamic App Router page validates its kind against seven supported reports. Every report below has a JSON endpoint and an export endpoint:

| Page / JSON API | Title | CSV endpoint |
| --- | --- | --- |
| `/reports/sales` | Rapport des ventes | `/reports/sales/export.csv` |
| `/reports/purchases` | Rapport des achats | `/reports/purchases/export.csv` |
| `/reports/expenses` | Rapport des dépenses | `/reports/expenses/export.csv` |
| `/reports/customer-collections` | Encaissements clients | `/reports/customer-collections/export.csv` |
| `/reports/supplier-payments` | Paiements fournisseurs | `/reports/supplier-payments/export.csv` |
| `/reports/cash` | Rapport de caisse | `/reports/cash/export.csv` |
| `/reports/financial-summary` | Synthèse financière | `/reports/financial-summary/export.csv` |

Frontend URLs use port 3000; backend endpoints use port 3001. `/reports` is the frontend index. Unknown report kinds return 404.

JSON contains `data`, `pagination`, `summary`, `summaryFields`, `columns`, `title`, `note`, `period`, `filters`, `generatedAt`, and `complete`. The typed frontend uses the column/summary metadata to render consistent tables and cards.

## Periods and filters

Every report accepts either `period=today|month|year` or both `dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD`. Default is month-to-date. The business-local date/timezone reuses Finance/Caisse: CASH_TIME_ZONE, default Africa/Tunis. Month/year presets run from the first day through today. Date-only comparisons include both endpoints; no conversion to UTC timestamps is used to filter business dates.

All pages provide Aujourd’hui, Ce mois, Cette année and Personnalisé, plus Appliquer/Réinitialiser. Other filters apply when submitted. Exports and printing always use the last **applied** query, not unapplied input changes.

| Report | Business date | Additional filters |
| --- | --- | --- |
| Sales | saleDate | status, paymentStatus, reference/customer search |
| Purchases | purchaseDate | supplierId, status, paymentStatus, reference search |
| Expenses | expenseDate | category, paymentMethod, reference/description search |
| Customer collections | paymentDate | paymentMethod, sale-reference/customer search |
| Supplier payments | paymentDate | supplierId, paymentMethod, purchase-reference search |
| Cash | movementDate | type, sourceType, paymentMethod |
| Financial summary | Same per-metric dates as Finance | Period only |

Document status defaults to CONFIRMED. `status=ALL` explicitly displays other statuses; DRAFT and CANCELLED never enter confirmed revenue/purchase summaries or generated receivables/payables. Payment status supports NON_PAID, PARTIALLY_PAID and PAID. Category/method/source options reuse the current controlled values.

Query validation rejects malformed/reversed dates, unknown keys, repeated/nonstring inputs, invalid enum values, nonpositive/noninteger pages/sizes, invalid supplier IDs, unsupported sort fields/directions and searches over 200 characters. Page sizes above 100 are capped at 100; impossible numeric inputs are rejected. Query values are parameterized, never interpolated as SQL identifiers.

## Definitions and reuse

**Sales and purchases:** totals reuse the existing `totalAmount(lineTotal[])`; attached payments/status/remaining reuse the same `paymentSummary` used by the document services. Rows contain reference, document date, customer/supplier, status, total, paid, remaining and payment status. Summaries include the selected row count, confirmed document total, payments attached to the selected documents and confirmed remaining amount.

Document reports filter by **document date** and show **current attached payments from all dates**, matching their existing document pages. Thus `Total encaissé` in the sales report is not the amount received during the period. The customer collections report supplies that separate payment-date metric. The same distinction applies to purchase reports versus supplier payments. A payment after a report's end date can change the paid/remaining values of a document report; the header explicitly documents this.

**Expenses:** count and sum Expense exactly once. Neither purchases nor supplier payments are added to operating expenses.

**Collections and supplier payments:** count and sum original SalePayment/PurchasePayment rows dated in the period. Joins supply document reference and customer/supplier; these reports do not use document totals as money received/paid.

**Cash:** reuses `summarizeCash` on the fully filtered period movements. Summary cards show CASH inflows, CASH outflows, **Solde espèces sur période**, and all-method net financial flow. The cash report deliberately reports the period change, not an accumulated balance. Its method/type/source filters affect both rows and all summaries. Impact espèces per row is signed amount for CASH and zero for other methods.

**Financial summary:** calls `FinanceService.summary` directly. The nine summary values match `/finance/summary` for identical dates. Activity metrics cover the period; receivables, payables and physical cash are cumulative through the inclusive end date. The reported result remains **Solde activité estimé**, not net profit: purchases are inventory acquisitions rather than modeled cost of goods sold. Current records/statuses are used; these are not immutable historical or statutory statements.

All monetary arithmetic uses existing numeric-string/36-place BigInt helpers. Sorting money also compares BigInt values. The frontend formats strings only; CSV never converts money to floating point or scientific notation.

## Pagination, sorting and performance

`page=1&pageSize=25` defaults; selectable sizes 25/50/100. Pagination reports page, pageSize, totalItems and totalPages. Zero rows produce totalPages=0; the UI displays an empty state and disables next-page navigation.

Summaries always cover the **complete filtered dataset** before page slicing. Sorting is backend-side with a whitelist: date, reference, amount; asc/desc, default date descending with descending ID tie-break. Financial-summary metric rows retain their defined order.

Date filtering is applied in parameterized SQL. Sales/purchase reports additionally constrain status in SQL, bulk-fetch lines/payments by selected IDs, group them once, and use their existing summary helpers. They perform three bulk SELECTs independent of document count. Expenses/cash and joined payment reports use one SELECT. Financial summary retains Finance's eight bulk reads. Supplier dropdown options use the existing suppliers GET endpoint. No N+1 query path was introduced; integration tests assert the three-query sales path with 27 selected documents.

V1 pagination is performed in the backend after loading the date/status candidates and applying remaining filters/calculated payment status. It is not database LIMIT/OFFSET pagination. Exports/print also buffer the full filtered result. For very large reporting periods, database aggregates/window queries and streamed CSV would reduce memory use; no silent row truncation is implemented. No indexes were added: the task uses existing date/status/document-link fields and indexes where applicable.

## CSV export

CSV endpoints ignore the page slice and export **all** filtered rows using the same service and summaries. Whitelisted sorting is preserved. Content-Disposition makes the result downloadable; the frontend saves a filename containing report kind and inclusive date range. Duplicate clicks are guarded with a synchronous pending ref and disabled controls.

Output uses UTF-8 BOM, semicolon separators, quoted cells, escaped double quotes, and CRLF record separators. Embedded newlines and Arabic/French text are preserved. Metadata includes title, period, UTC generation time, applied filters, definitions and full summary totals before column headers/data.

Numeric values remain exact plain decimal strings using a dot, without scientific notation. Excel may still auto-convert/round very long numbers when opening a CSV; import monetary columns as text when retaining more precision than Excel supports. The file itself preserves every digit. Text starting with spreadsheet formula markers after whitespace/control bytes receives an apostrophe prefix; trusted numeric negative amounts remain numeric strings.

Empty exports contain valid metadata, zero-capable summary rows and column headers. Financial summary always contains its nine indicator rows even when their values are zero.

## Print / PDF

**Imprimer / PDF** requests the active report with `view=print`, which returns all filtered rows independent of page number. After the full result renders in a dedicated print view, it calls `window.print()`. Print CSS hides screen navigation, filters, export buttons and pagination; it retains report title, selected period, filters, generation time, summary and full table. It uses landscape pages, repeating table headers and compact typography. Browser Save as PDF is the supported PDF strategy; no PDF library/server endpoint was installed.

The afterprint event restores normal controls after closing/cancelling the dialog. Use the report button for the complete dataset. A direct browser Ctrl+P before preparing the full report can only print the current displayed page, which is explicitly identified in the screen content.

## Validation results

| Check | Result |
| --- | --- |
| Backend build/type-check | Passed |
| Backend unit suite | 153 passed, 15 files |
| Reporting integration tests | 8 passed |
| Full database integration suite | 56 passed, 12 files |
| CSV tests after final formula-protection cleanup | 3 passed |
| Backend lint | Exit 0; only pre-existing stock-test warning |
| Frontend lint/production build | Passed |
| Reporting index and seven report HTTP routes | 200 |
| Seven JSON endpoints with localhost:3000 origin | 200, correct CORS header |
| Reporting GET preflight | 204, correct CORS header |
| CSV exports | Filtered/all-page/empty/BOM/escaping/decimal checks passed |
| Finance equality | Every financial-summary metric matches Finance for identical dates |
| Real-data snapshots | Unchanged before/after |

Integration fixtures cover 27 confirmed sales plus a draft, confirmed/draft purchases, current payments outside the document period, both date boundaries, supplier/category/method/status/search filters, exact decimal totals, CASH versus CARD, invalid queries, pagination, full summaries/print/export, no write endpoints and unchanged stock/data.

Headless Chrome validation additionally passed:

- Loaded all seven live report pages and their API-backed content.
- Used Today/custom/reversed dates, status filter and reset.
- Downloaded a live filtered CSV and checked its BOM and period.
- Tested 25 + 2 paginated rows with browser-only mocked responses, preserving the full summary.
- Prepared all 27 mocked rows from page 2, called print once, generated a PDF and restored controls on afterprint.
- Checked 390px mobile width with no viewport overflow and captured a screenshot.
- Confirmed all application backend requests were GET-only.

The browser-only pagination fixtures do not enter the database. Actual backend pagination/export behavior was independently tested with disposable database fixtures. Chrome needed the approved run outside the sandbox; its isolated profile was then closed and removed. The first browser mock lacked preflight headers; the test harness was fixed and the final browser run passed.

Generated validation artifacts are under `.tmp/reports-validation-1788739200353/`: `report.pdf`, `mobile.png`, and `sales-2026-09-01-2026-09-30.csv`. The PDF/screenshot use synthetic UI data, not an official business report. Earlier temporary validation output may also remain under `.tmp/reports-validation-*`.

Original snapshot counts remain 1 product, 4 stock movements, 1 supplier, 1 purchase, 1 sale, 1 expense and 3 cash movements. Embedded payment/line data matches. Disposable integration fixtures were removed.

## Reproduce checks

From backend:

```powershell
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run test
$env:RUN_DATABASE_TESTS='1'
npm.cmd run test:e2e -- --no-file-parallelism
```

From frontend: `npm.cmd run lint` and `npm.cmd run build`. Integration files run sequentially because some compare global snapshots while others create temporary fixtures.

For browser validation, start an isolated headless Chrome with remote debugging on port 9223 and a disposable user-data-dir (never your regular browser profile), then run `node scripts/verify-reports.mjs` from frontend. The script uses Node's built-in WebSocket/CDP support, writes artifacts under the workspace `.tmp`, makes GET-only live requests, and closes that isolated browser. It requires the backend/frontend already running.

## Manual checks

Start `npm.cmd run start:dev` from backend and `npm.cmd run dev` from frontend if needed.

1. Open `http://localhost:3000/reports`. Verify the seven cards and Rapports navigation link.
2. **Sales:** open `/reports/sales`, choose Personnalisé, enter dates containing an existing confirmed sale (for example 2026-09-01 through 2026-09-30), and apply. Compare total/paid/remaining with the sale details. Switch status to Tous/Brouillon: confirmed revenue must still exclude draft totals. Exercise payment status and reference/customer search. Use Exporter CSV and verify the title, period, summaries and rows. Use Imprimer / PDF and verify the complete filtered table before saving as PDF.
3. **Purchases:** open `/reports/purchases` for the purchase dates, choose a supplier and apply. Compare confirmed totals and attached current payments with purchase details. Supplier payments must not be counted again as purchase totals. Export/print with the supplier filter active.
4. **Expenses:** open `/reports/expenses` using the existing expense's actual expenseDate. Check category/method/search filters and exact amount; compare to expense details. Verify French/Arabic text in CSV and print.
5. **Collections and supplier payments:** choose payment dates, not document dates. Compare each row to the original payment history. A payment dated outside the selected range must disappear here even if it appears in a document report's current paid total.
6. **Cash:** open `/reports/cash`. Compare CASH-only inflows/outflows/period change, then filter Carte or Virement. Noncash rows must have zero Impact espèces and zero physical period change. The all-method net remains separate. Test source and direction filters, CSV and print.
7. **Financial summary:** open `/reports/financial-summary` and `/finance` with identical custom dates. All nine values must match exactly. Change only the start date: period flows may change, while end-date balances remain unchanged. Review the Solde activité estimé limitation.
8. With more than 25 test records, go to page 2 and confirm summaries stay unchanged. Export/print from page 2: output must still contain all filtered rows. Change filters and apply: pagination resets to page 1.
9. Choose a period with no records. Expect `Aucune donnée pour cette période.` and correct zero summaries (financial end-date balances may carry prior amounts). Export remains valid. Try reversed dates; expect a clear error. Reset restores month-to-date.
10. Check loading/error/retry, narrow layout, and rapid repeated export clicks. Edit a filter without applying it and verify export still uses the displayed applied filters. In DevTools confirm GET-only requests and correct CORS headers.

## Files created or modified

Created backend:

- `backend/src/reports/report-definition.ts`
- `backend/src/reports/report-query.ts`
- `backend/src/reports/report-query.spec.ts`
- `backend/src/reports/reports.service.ts`
- `backend/src/reports/report-csv.ts`
- `backend/src/reports/report-csv.spec.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/src/reports/reports.module.ts`
- `backend/test/reports.e2e-spec.ts`

Created frontend:

- `frontend/src/types/report.ts`
- `frontend/src/app/reports/page.tsx`
- `frontend/src/app/reports/[kind]/page.tsx`
- `frontend/src/app/reports/report-content.tsx`
- `frontend/src/app/reports/report-page.tsx`
- `frontend/src/app/reports/reports.css`
- `frontend/scripts/verify-reports.mjs`

Modified:

- `backend/src/app.module.ts` — registers ReportsModule.
- `frontend/src/app/products/page.tsx` — Rapports link.
- `frontend/src/app/finance/page.tsx` — Rapports link.

Created documentation: `REPORTING-V1.md`. Normal build caches/dist/.next and the `.tmp` browser-validation artifacts are generated output, not additional source changes.

## Warnings and limits

No blocker remains. An initial TypeScript filter-map inference error was corrected. A CSV control-character regex lint warning was removed while retaining spreadsheet-injection protection and passing its tests. The existing stock-test `no-unsafe-finally` warning and Vite tsconfig-paths notice remain outside this change.

Reporting is operational/financial V1, not statutory accounting. Document reports use current attached payments; Finance uses its documented as-of strategy. Exports/print are full-dataset buffered operations, not streaming, and current-record edits can change past reports. No fake company/legal information is included.
