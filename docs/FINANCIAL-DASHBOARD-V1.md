# Financial Dashboard V1

Implemented 2026-09-07. Open `http://localhost:3000/finance` for the read-only Tableau de bord financier. No database schema/migration, financial transaction, stock rule, or existing document/payment/expense mutation was added.

## Endpoint and periods

`GET /finance/summary`

Examples:

- `/finance/summary` — default month to date.
- `/finance/summary?period=today`
- `/finance/summary?period=month`
- `/finance/summary?period=year`
- `/finance/summary?dateFrom=2026-09-01&dateTo=2026-09-30`

Custom dates must both be present and valid `YYYY-MM-DD` calendar dates with dateFrom ≤ dateTo. Combining a preset with explicit dates, invalid presets, repeated/nonstring values, or unknown query keys returns 400. Dates are inclusive. Month/year presets mean the first day of the current month/year through today, not the full future month/year.

Today's date and timezone come from the existing Caisse `businessDate()` helper: CASH_TIME_ZONE, default Africa/Tunis. Business date-only fields are compared lexically as normalized date strings. They are not converted to timestamps for filtering. UTC date arithmetic is used only to determine evolution-table grouping length, not monetary amounts or business-day boundaries.

## Metric definitions

| Field / label | Definition | Date field |
| --- | --- | --- |
| salesRevenue / Chiffre d’affaires | Sum of line totals of currently CONFIRMED sales in the period | Sale.saleDate |
| customerCollections / Encaissements clients | Sum of sale payments in the period, all methods | SalePayment.paymentDate |
| purchases / Achats | Sum of line totals of currently CONFIRMED purchases in the period | Purchase.purchaseDate |
| supplierPayments / Paiements fournisseurs | Sum of purchase payments in the period, all methods | PurchasePayment.paymentDate |
| expenses / Dépenses | Sum of expense amounts in the period; no supplier purchases or purchase payments added | Expense.expenseDate |
| customerReceivables / Créances clients | Confirmed sales dated through dateTo minus sale payments dated through dateTo | saleDate / paymentDate |
| supplierPayables / Dettes fournisseurs | Confirmed purchases dated through dateTo minus purchase payments dated through dateTo | purchaseDate / paymentDate |
| physicalCashBalance / Solde espèces | Existing Caisse CASH-only IN minus OUT, for movements through dateTo | CashMovement.movementDate |
| estimatedActivityResult / Solde activité estimé | Period salesRevenue − purchases − expenses | Respective period dates above |

Sales and purchases do not store an independently authoritative totalAmount column: their existing services derive it from persisted lineTotal values. This endpoint reuses `totalAmount` and the existing exact money helpers. Draft/cancelled documents never enter confirmed totals. Payment amounts affect collections/settlements and balances, not document revenue/purchase totals. Expenses are counted from Expense once; their cash links contribute only to the separate financial-flow view and cash balance.

**Balance strategy: as of the selected end date.** The dateFrom affects period flows, not balances. An empty activity period may therefore still have carried receivables, payables or cash. A date before all records yields zero flows and zero balances. Future-dated payments/movements are excluded until the selected dateTo includes them. To compare with the original all-records Caisse summary, choose an end date including every existing movement; otherwise compare Caisse's same helper applied to movements through the selected date.

As-of means the business dates of the **current saved records**. This is not a historical audit snapshot: current confirmation status is used, and Expense V1 edits can change a past period. Confirmation timestamps and creation timestamps do not override the specified sale/purchase/payment/expense dates. Backdated payments or future document dates can produce signed balances; values are not silently clamped.

Solde activité estimé is deliberately **not net profit**. Purchases are inventory acquisitions, not a modeled cost of goods sold. This simplified indicator also does not model depreciation, accrual adjustments, statutory tax accounting, or formal statements. The dashboard explains the inventory-cost limitation alongside the card.

## Read-only calculation and exactness

One `REPEATABLE READ READ ONLY` PostgreSQL transaction performs eight bulk reads (documents, lines, payments, expenses and cash movements) on the same connection/snapshot. There are no per-document queries and no writes. The fixed query count is appropriate for V1; all relevant history is still loaded into memory, so large deployments should eventually use database-side aggregation/pagination while preserving these definitions.

The backend computes every total. PostgreSQL decimal strings are parsed into the existing 36-place scaled BigInt representation and formatted with existing moneyString/signedMoney helpers. No floating-point money is used. The frontend only validates response shapes and formats decimal strings as DT using `displayAmount`.

Cash totals and method flows reuse `summarizeCash`, preserving Caisse's rule that only CASH affects physical cash. CARD, BANK_TRANSFER, CHECK and OTHER remain visible in financial history and method flows.

## Additional dashboard sections

- Nine cards, separated into period activity and explicitly dated cumulative balances.
- Flux par mode de paiement: period CashMovement inflows, outflows and net for all five methods, including manual cash movements and expense links.
- Évolution financière: a compact exact-value **table**, not a chart. Groups by day for periods of at most 62 inclusive days, otherwise by month. Includes only buckets containing confirmed sales, sale payments or expenses. No chart library installed.
- Dernières opérations financières: the latest ten period cash movements, newest movementDate/createdAt/id first, combining sale payments, supplier payments, expenses and manual movements through their single existing cash links. This avoids double-counting linked events.
- À surveiller: factual notices when receivables > 0, payables > 0, or physical cash < 0. No due-date, overdue, or unpaid-document count is invented. When none applies, a neutral message is shown.
- Today/month/year/custom controls, Appliquer/Reset, loading, API error/retry, empty tables, UTF-8, responsive card grids and horizontally scrollable tables.
- Finance navigation links added to products, cash and expenses. No transaction creation controls on this page.

## Validation

| Check | Result |
| --- | --- |
| Backend build | Passed |
| Backend TypeScript noEmit | Passed |
| Unit tests | 134 passed, 13 files |
| Finance integration tests | 4 passed |
| Complete database integration suite | 48 passed, 11 files |
| Frontend lint | Passed; diagnostic rerun completed successfully after the initial run took unusually long |
| Frontend production build | Passed, /finance included |
| `/finance` HTTP route | 200, UTF-8 HTML, correct title |
| GET summary from localhost:3000 | 200 with correct allow-origin header |
| OPTIONS summary GET/Content-Type | 204, localhost:3000 allowed |
| Presets/custom/bad ranges | Covered by API/unit tests |
| Arabic financial data | Preserved in disposable fixture response tests |
| Read-only requests | Service passes readOnly=true; actual transaction reports transaction_read_only=on; before/after database snapshots match |

Cases cover draft exclusion, confirmed totals, separate payment flows, expenses counted once, exact receivables/payables, negative cash, noncash method separation, inclusive first/last dates, future exclusion, prior balance carry-forward, zero periods, 36-place decimals, month grouping, leap-day presets and invalid ranges. The integration suite uses disposable UUID-tagged fixtures, cleans them up, and verifies unchanged documents, lines, payments, expenses, cash and stock during requests.

Final real-data snapshots match the initial snapshots: 1 product, 4 stock movements, 1 supplier, 1 purchase, 1 sale, 1 expense and 3 cash movements; embedded payments/lines also match. No existing record was modified.

Run backend checks from `C:\herb-store-system\backend`:

```powershell
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run test
$env:RUN_DATABASE_TESTS='1'
npm.cmd run test:e2e -- --no-file-parallelism
```

Run `npm.cmd run lint` and `npm.cmd run build` from frontend. Keep database integration files sequential because some suites compare global snapshots while others create their own temporary records.

## Manual testing

1. If needed, start `npm.cmd run start:dev` in backend and `npm.cmd run dev` in frontend, using separate terminals.
2. Open `http://localhost:3000/finance`. Confirm the title/subtitle, nine cards and default month-to-date period ending at the displayed business-local date. Check that flows and dated balances are separated.
3. Click **Aujourd’hui**, **Ce mois**, **Cette année**. In Network verify GET `/finance/summary?period=today|month|year`, and verify headings/values update to the returned period. No POST/PATCH/DELETE should be sent.
4. Choose **Personnalisé**, enter `2026-09-06` for both dates and click **Appliquer**. Verify that both boundaries are included. As recorded during validation, this date contains 290,000 DT confirmed sales, 200,000 DT customer collections, 11 280,000 DT purchases and supplier payments; use the current source records when comparing if business data has since changed.
5. Move dateFrom forward while retaining the same dateTo. Period flows should change where there is activity; balances should remain the same. Choose a period without activity: flows/table rows should be empty/zero while carried balances may remain. Choose an end date before all records to see zero balances too.
6. Enter a reversed date range and try Appliquer: expect a clear validation message. Use **Réinitialiser** to restore month-to-date. Quickly switch presets to verify older responses do not overwrite the final selection.
7. Compare each card against the correct source: confirmed sales versus payments, confirmed purchases versus supplier payments, and expenses separately. Confirm DRAFT amounts do not count. Compare physical cash with CashMovement entries through the displayed end date, CASH only.
8. Review method flows: card/bank/check/other rows must not be presented as physical cash. Check the simplified-result explanation, evolution grouping, recent operations and factual À surveiller notices.
9. Resize to mobile width and check readable cards, stacked custom-date controls and horizontal table scrolling. Review Arabic references if present; they must remain readable. Stop the backend temporarily and reload to verify error/retry; restart and retry afterward.
10. In DevTools check CORS GET/OPTIONS headers and confirm the dashboard only reads data. Product stock and all financial records must remain unchanged.

Interactive browser automation was unavailable. The HTTP/API filter tests passed; the actual click, responsive layout and retry interactions above remain manual verification.

## Files created or modified

Created:

- `backend/src/finance/finance-values.ts`
- `backend/src/finance/finance-values.spec.ts`
- `backend/src/finance/finance.service.ts`
- `backend/src/finance/finance.controller.ts`
- `backend/src/finance/finance.module.ts`
- `backend/test/finance.e2e-spec.ts`
- `frontend/src/types/finance.ts`
- `frontend/src/app/finance/page.tsx`
- `frontend/src/app/finance/finance-dashboard.tsx`
- `FINANCIAL-DASHBOARD-V1.md`

Modified:

- `backend/src/app.module.ts` — registers FinanceModule.
- `frontend/src/app/products/page.tsx` — Finance navigation link.
- `frontend/src/app/cash/cash-ui.tsx` — Finance navigation link.
- `frontend/src/app/expenses/expense-ui.tsx` — Finance navigation link.

Normal dist/.next/TypeScript cache files are regenerated by builds. No schema, migration, package, lockfile, or existing financial business-rule file changed.

## Warnings and limitations

No implementation blocker remains. Existing backend lint warning (`no-unsafe-finally` in stock-movements.e2e-spec.ts:81) and Vite's tsconfig-paths informational notice remain outside this change. The initial frontend lint run was unusually slow; a full diagnostic rerun passed. Windows process-command inspection was denied while investigating the delay, but it was not needed to complete validation.

The activity result is not accounting net profit. As-of balances use current records and business dates, not an immutable historical audit log. Full-history bulk aggregation is a V1 scaling limit. None of these qualifications changes the requested formulas.
