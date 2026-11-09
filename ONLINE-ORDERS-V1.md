# Online Orders V1

Implemented 7 September 2026. OnlineOrder records customer intent independently of Sale. Creation, confirmation and cancellation never create Sales, StockMovements, payments, cash entries or reservations. No authentication, customer accounts, online payment or delivery tracking was added.

## Files created

- `backend/src/online-orders/order-input.ts`
- `backend/src/online-orders/order-input.spec.ts`
- `backend/src/online-orders/online-orders.service.ts`
- `backend/src/online-orders/online-orders.controller.ts`
- `backend/src/online-orders/online-orders.module.ts`
- `backend/test/online-orders.e2e-spec.ts`
- `backend/migrations/app/20260907T1219_online_orders_v1/migration.ts`
- `backend/migrations/app/20260907T1219_online_orders_v1/migration.json`
- `backend/migrations/app/20260907T1219_online_orders_v1/ops.json`
- `backend/migrations/snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract.json`
- `backend/migrations/snapshots/cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19/contract.d.ts`
- `frontend/src/types/online-order.ts`
- `frontend/src/app/shop/checkout/page.tsx`
- `frontend/src/app/shop/checkout/checkout.tsx`
- `frontend/src/app/shop/order-success/page.tsx`
- `frontend/src/app/online-orders/layout.tsx`
- `frontend/src/app/online-orders/page.tsx`
- `frontend/src/app/online-orders/order-api.ts`
- `frontend/src/app/online-orders/order-list.tsx`
- `frontend/src/app/online-orders/order-details.tsx`
- `frontend/src/app/online-orders/[id]/page.tsx`
- `frontend/scripts/verify-online-orders.mjs`
- `ONLINE-ORDERS-V1.md`

## Files modified

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json` (generated)
- `backend/src/prisma/contract.d.ts` (generated)
- `backend/migrations/app/refs/db.json` (advanced by migration command)
- `backend/src/app.module.ts`
- `backend/src/public-catalogue/public-cart.service.ts` (exports transaction-scoped validation for reuse)
- `frontend/src/app/shop/cart-provider.tsx` (submission lock, successful-order clearing, minimal receipt)
- `frontend/src/app/shop/cart/cart-page.tsx` (enabled checkout link only for validated carts)
- `frontend/src/app/shop/layout.tsx` (removes obsolete “bientôt disponible” ordering message)
- `frontend/src/app/shop/products/[id]/page.tsx` (updated ordering helper text)
- `frontend/src/app/products/page.tsx` (Commandes en ligne navigation link)

Generated browser screenshots: `.tmp/online-orders-validation-1788799012525/checkout-1280.png`, `checkout-768.png`, `checkout-390.png`, `admin-mobile.png`. Earlier browser-run artifacts also remain under `.tmp/online-orders-validation-*`. Build files are normal generated outputs.

## Database and reference generation

The applied additive migration creates OnlineOrder and OnlineOrderLine, with foreign keys, unique constraints, indexes and numeric/status checks. No existing table data was migrated or rewritten.

OnlineOrder stores id, unique reference, status, customer name/phone/email, notes, exact totalAmount, createdAt, updatedAt, confirmedAt and cancelledAt. OnlineOrderLine stores orderId/productId links, productNameSnapshot, unitSnapshot, quantity, unitPrice, lineTotal and createdAt. A product can occur only once per order. Foreign keys restrict deletion of referenced records.

Reference generation uses the database-generated serial ID via `nextval(pg_get_serial_sequence(...))` in the INSERT itself. The reference is ORD- plus the ID padded to at least six digits. It never uses max+1, a frontend reference, or truncation after six digits. Concurrent requests obtain unique references. Rollbacks and cleaned-up tests consume sequence values, so gaps are expected; sequences were not reset.

Migration applied: `20260907T1219_online_orders_v1`, nine additive operations. Storage hash advanced from `20484966df6c4dc5956f3bd526cbeec7e4993092d8a9bbcc0ab9be6791aae45f` to `cd3176b5ad76de613ab6a9187cb0e7b6b506eb6b4313c90454dcc71061a1fb19`. Migration hash: `227953eb2af7b645948cdb9d808ab26ba69fbd31a875fe6f3bfc67e2c0590749`.

The generated migration initially needed an explicit operations getter type for TypeScript declaration portability (TS2883). The same annotation pattern used by existing migrations was applied and the migration self-emitted. The operation hash stayed unchanged; backend build and noEmit type-check then passed.

## Public endpoints

- `POST /public/orders`: creates a PENDING order and its lines atomically.
- `POST /public/orders/preview`: read-only, exact backend-calculated checkout summary. Accepts `{ items }`, requires a non-empty valid cart, and returns `{ items, totalAmount }`. It uses the same pricing/stock preparation function as creation and never creates an order.
- `GET /public/orders/:reference?phone=...`: requires an exact matching trimmed phone. Missing, malformed, wrong-phone and unknown-reference requests receive the same public-safe 404. No reference-only lookup is available.

Creation input:

```json
{
  "customerName": "Amine",
  "customerPhone": "20123456",
  "customerEmail": "example@email.com",
  "notes": "Appeler avant confirmation",
  "items": [{ "productId": 123, "quantity": "2.500" }]
}
```

IDs are numeric int32 values, consistent with the existing cart API. Required customer strings are trimmed. Limits: name 150 characters, phone 40 with at least six digits and conventional phone punctuation, email 254 with basic email validation, notes 2000. Email and notes are optional. Items must be non-empty, at most 100 distinct products, and quantities must be positive exact decimal strings. Duplicate IDs, malformed decimals and client-controlled fields such as reference, total or price are rejected.

Creation response contains reference, status, customerName, totalAmount, createdAt and public line snapshots. Lookup omits all customer/contact data and notes: only reference, status, totalAmount, createdAt and item snapshots are returned. Both responses use Cache-Control: no-store. Neither public endpoint exposes exact stock, costs, suppliers, internal flags, warehouse details or cash information.

Matching phone is the requested simple V1 lookup secret, not authentication. Phone-in-query lookup can appear in URL logs and should not be treated as a strong account boundary. The back-office endpoints retain the project's existing unauthenticated setup, as requested; a separate route namespace is not access control. Deployment must preserve whatever external access restrictions protect the back office.

## Admin endpoints and status rules

- `GET /online-orders`: newest first, with q (reference/name/phone), status, dateFrom, dateTo and page. Dates are inclusive calendar dates in Africa/Tunis, page size 25.
- `GET /online-orders/:id`: immutable customer data, commercial snapshots and status timestamps.
- `PATCH /online-orders/:id/status`: accepts only `{ "status": "CONFIRMED" }` or `{ "status": "CANCELLED" }`.

Only PENDING -> CONFIRMED and PENDING -> CANCELLED are allowed. Confirmation sets confirmedAt; cancellation sets cancelledAt. A row lock serializes competing transitions; the first wins and a subsequent transition receives 409. Invalid target statuses return 400. There is no customer, quantity, price, total or line editing API and no delete API.

**Even CONFIRMED online orders do not change stock or create Sales in V1.** The UI states this before confirmation. Cancellation also has no stock effect. A later phase must explicitly design order-to-Sale conversion.

## Prices, quantities and stock

Quantities match Cart V1: decimal strings, up to 60 integer digits and 18 fractional digits, expressed in the existing Product.saleUnit. Manual comma input is normalized by the cart. Backend validation reuses the existing exact convertQuantity rules and the same signed quantityInStorageUnit ledger as the public catalogue/cart. There is no separate online inventory.

Order creation revalidates all lines in one bulk product/stock query within the same REPEATABLE READ transaction that writes the order and lines. Every product must exist, be active, sellable and visible online, and have sufficient currently derived stock for its converted quantity. A failure rejects the entire order. A test injects failure after order/line insertion and verifies both roll back.

Current Product.salePrice is always reloaded. Dynamic-scale BigInt decimal arithmetic calculates line totals and the order total exactly, including prices beyond 18 fractional places. PostgreSQL numeric stores the values and lineTotal is constrained to quantity × unitPrice. No floating point, rounding, tax, shipping or discount is introduced.

Checkout renders backend preview amounts without calculating order money in the browser. It refreshes that preview again immediately before submitting; detected price changes require reviewing the refreshed summary. Creation independently revalidates again, so frontend prices are never authoritative. Confirmation and admin details render stored backend snapshots even after Product name/price changes.

**Stock availability is validated at order creation, but not reserved.** Concurrent customers can place orders against the same stock. This accepted V1 oversubscription limitation applies even after staff confirmation; it must not be described as guaranteed availability.

## Frontend flow

Validated non-empty carts link to `/shop/checkout`. Invalid/unavailable carts cannot proceed. Checkout collects customer details, shows the server-calculated summary, validates required/email fields, locks submission synchronously against repeated clicks, disables controls and shows Envoi de la commande.... Failures preserve cart contents, show a clear message and refresh validation.

Only a successful backend response clears the cart. `/shop/order-success` displays Commande enregistrée, reference, total, status at submission and the next-step message. A minimal receipt (reference/status/total/date, no phone/customer/notes) is kept in memory and sessionStorage for same-tab refresh. It is an informational receipt, not an authoritative live status lookup; loading or refreshing the page never creates an order. If storage is blocked, in-memory navigation still works.

`/online-orders` provides list/filter/pagination controls, and `/online-orders/[id]` shows snapshots and contact information. Confirmer/Annuler are available only while pending and require native confirmation dialogs. The admin product navigation now includes Commandes en ligne; no navigation redesign was performed.

The client blocks immediate duplicate submissions. Server-side idempotency/recovery for an ambiguous network failure after commit is not part of this V1: manually retrying after a lost success response may create another order. No payment is involved.

## Validation results

- Backend build and TypeScript noEmit passed after the generated migration annotation fix.
- Backend unit suite: 200 passed.
- Online-order integration suite: 11 passed, including the read-only preview.
- Full integration regression suite: 81 passed across 15 files (49.08 seconds). The focused 11-test order suite also passed after the final date-validation/lint cleanup.
- Coverage includes current prices, exact line/order totals, historical snapshots, visibility exclusions, zero/excess stock, malformed input/duplicates/email/phone, safe unique concurrent references, rollback, both controlled transitions, competing transitions, immutable lines, phone-protected lookup/allowlist and unchanged stock/Sales/cash.
- Frontend lint and production build passed with all new routes.
- `/shop/checkout`, `/shop/order-success`, `/online-orders`: HTTP 200. Valid product/admin detail routes were exercised in-browser.
- POST CORS preflight: HTTP 204, allowed http://localhost:3000 and Content-Type. No CORS changes were necessary.
- Browser suite passed cart -> checkout, form validation, failed submission/cart retention, repeated submit guard (one create POST), success/receipt/cart clearing, admin list/details, confirmation/cancellation dialogs, Arabic customer/product names, UTF-8, and no hydration errors.
- Desktop 1280px, tablet 768px and mobile 390px passed viewport overflow checks. Mobile checkout screenshot was inspected; admin mobile screenshot generated.
- Browser orders ORD-000039 and ORD-000040 were disposable fixtures and removed. Existing product, stock, Sale and cash snapshots stayed unchanged. Order/line tables also matched their pre-test contents after cleanup.

An initial browser run timed out on the first product-page navigation; the complete rerun passed, and the final browser run with backend preview also passed. An intermediate frontend build caught an incomplete preview-template replacement; it was corrected and the final lint/build passed. No known implementation blocker remains.

Existing warnings remain: backend stock integration test no-unsafe-finally at `test/stock-movements.e2e-spec.ts:81`; Vitest's vite-tsconfig-paths notice; Prisma's existing skills-sync notice. No unrelated configuration was changed to silence them.

## Exact manual scenario

1. Start backend on localhost:3001 and frontend on localhost:3000 if not already running. The migration is already applied locally; another database must run the checked-in migration before using these routes.
2. Use a disposable development product with active, sellable and visible-online flags, a configured sale unit, a price and sufficient stock. Do not change real stock solely for testing.
3. Open `/shop`, add the product, open `/shop/cart` and click Passer la commande.
4. Enter Nom and Téléphone (for example 20123456). Optionally enter Email/Notes. Check the server-calculated quantities, prices and total.
5. Submit. Verify Envoi de la commande..., then Commande enregistrée, an ORD reference, En attente and the exact total. Verify the cart is empty.
6. Open `/online-orders`, search the reference, open Voir and verify customer details and immutable line snapshots.
7. Click Confirmer, cancel the dialog once, then confirm. Verify Confirmée and confirmedAt. Check stock, Sales and cash: all must be unchanged.
8. Create a second disposable order, open its admin details, click Annuler and confirm. Verify Annulée and cancelledAt, again without stock effects.
9. Request `/public/orders/ORD_REFERENCE?phone=20123456` using the exact submitted trimmed phone. Verify only public summary fields. Omit/change the phone and verify 404.
10. Test an invalid email/missing phone, then temporarily make a disposable cart product unavailable or stop the backend: submission must fail or be disabled, with cart contents retained. Restore the test condition and retry.
11. Rename/reprice a disposable Product after creating an order: existing order snapshots must remain unchanged; a subsequent order must use current data. Check mobile/tablet layouts and Arabic names.

Repeat automated checks from backend: `npm.cmd run build`, `npm.cmd exec tsc -- --noEmit`, `npm.cmd run test`, then `$env:RUN_DATABASE_TESTS='1'; npm.cmd run test:e2e -- --no-file-parallelism --testTimeout=20000`. From frontend: `npm.cmd run lint`, `npm.cmd run build`. With both servers and isolated headless Chrome on localhost:9223, run `node scripts/verify-online-orders.mjs` from frontend. Do not run fixture suites concurrently because they compare whole-database snapshots.
