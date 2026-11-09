# Shopping Cart V1

Implemented 7 September 2026. This is a browser-local cart only. No accounts, checkout, orders, payments, delivery, promotions, reservations, schema changes or new dependencies were added. Existing stock and sale business rules are unchanged.

## Files created

- `backend/src/public-catalogue/cart-validation.ts`
- `backend/src/public-catalogue/cart-validation.spec.ts`
- `backend/src/public-catalogue/public-cart.service.ts`
- `backend/src/public-catalogue/public-cart.controller.ts`
- `backend/test/public-cart.e2e-spec.ts`
- `frontend/src/lib/cart.ts`
- `frontend/src/lib/cart-api.ts`
- `frontend/src/types/cart.ts`
- `frontend/src/app/shop/cart-provider.tsx`
- `frontend/src/app/shop/add-to-cart.tsx`
- `frontend/src/app/shop/cart/page.tsx`
- `frontend/src/app/shop/cart/cart-page.tsx`
- `frontend/scripts/cart-unit.test.mjs`
- `frontend/scripts/verify-cart.mjs`
- `SHOPPING-CART-V1.md`

## Files modified

- `backend/src/public-catalogue/public-catalogue.service.ts`: shares its bulk ledger query/projection and adds an internal derived-stock column, never included in public product responses.
- `backend/src/public-catalogue/public-catalogue.module.ts`: registers the cart controller/service.
- `frontend/src/app/shop/layout.tsx`: scopes CartProvider to the storefront and adds the cart indicator.
- `frontend/src/app/shop/catalogue.tsx`: adds cart buttons outside product links (no nested interactive controls).
- `frontend/src/app/shop/products/[id]/page.tsx`: adds the detail-page cart action.
- `frontend/scripts/verify-shop.mjs`: allows the new read-only cart validation POST in the catalogue browser regression check.

Generated screenshots: `.tmp/cart-validation-1788782707105/1280.png`, `768.png`, `390.png`. Normal build outputs are generated artifacts.

## Persistence and hydration

The versioned localStorage key is `herb-store-cart-v1`. Its only stored payload is:

```json
{"version":1,"items":[{"productId":123,"quantity":"1.000"}]}
```

Product names, prices, internal flags and stock are never persisted. React context provides shared cart state to the header, cards, details and cart page. Server rendering starts with an unhydrated empty state; storage is read after client mount. The initial indicator shows an ellipsis and the cart page shows a loading message until hydration completes. No localStorage access occurs during SSR.

Malformed JSON, unsupported versions, oversized payloads, invalid IDs/quantities, duplicates and excess lines are ignored with a recovery message. Valid lines are retained, unknown product fields discarded, and the next mutation writes a clean payload. The limit is 100 distinct lines. Storage failures preserve the in-memory cart and explain that refresh persistence is unavailable. Storage events synchronize changes from other tabs; concurrent edits use last-write-wins semantics rather than a server session.

## Quantity and price rules

The existing Sales module accepts positive decimal quantities and uses `convertQuantity` for exact storage-unit conversion. The cart therefore permits decimal quantities in **Product.saleUnit**, including fractional quantities; it does not impose an integer-only rule even on PIECE because the existing Sales validator does not impose one.

Quantity input accepts a comma or decimal point, normalizes to a string, and allows at most 60 integer digits and 18 fractional digits, matching the existing inventory utility. Add defaults to 1; repeated add increments the same line by 1. Plus/minus step by 1. Minus is disabled if that would reach zero or become negative; a smaller positive fraction can be entered manually. Quantities are not converted in the browser. The header shows the number of distinct lines, not the sum of decimal quantities.

Money uses exact decimal strings and BigInt multiplication/addition with dynamically aligned scales. No floating-point money conversion, rounding, tax, shipping or discount is introduced. Prices always come from the latest validation response, not storage. Unit display uses the existing sale unit: G means per gram, not an invented 100 g price. Line subtotals show current price × requested quantity. The summary total is withheld while validation is pending/failed or any line is invalid, avoiding a misleading partial or stale total.

## Read-only validation API

`POST /public/cart/validate`, returning HTTP 200 for a well-formed batch:

```json
{"items":[{"productId":123,"quantity":"2.500"}]}
```

IDs are positive numeric int32 values, consistent with the existing API. Quantity must be a positive decimal string. Empty carts are accepted. Invalid structures, unknown fields, non-positive/invalid quantities, duplicate IDs and more than 100 lines return 400.

Each returned item contains:

- `productId`
- `valid`
- `quantityAvailable`
- `availabilityStatus` (null for unavailable/hidden/missing products)
- `currentPrice` (exact string, or null)
- `product` (the explicit existing PublicProductDto, or null)
- `message` (user-facing reason, or null)

Visibility requires isActive AND isSellable AND isVisibleOnline. Hidden, inactive, non-sellable and missing products receive identical unavailable results with no product details. Visible zero-stock products remain identifiable but invalid. Requested quantities exceeding stock are invalid. Inexact/incompatible conversions are rejected using the existing `convertQuantity` utility rather than new unit rules.

All products and current stock are read in **one bulk SELECT**, within a REPEATABLE READ, READ ONLY transaction. Stock uses the same signed quantityInStorageUnit ledger and exported positive movement types as the catalogue and stock module. The backend compares exact converted quantities against derived stock. Responses never include exact stock, storage unit, conversion factor, thresholds, supplier/cost data, locations, timestamps or internal flags. This endpoint creates no movements, sales, orders or reservations.

The frontend validates all lines together after hydration/changes and when opening or refreshing the cart. Window focus also refreshes validation. Add validates the proposed cart before committing the target line; all local changes subsequently trigger the shared batch refresh. Thus an add can make two batch validation calls, but there is never one API call per cart line. Aborted/stale responses cannot replace validation for a newer cart.

## UX

- `/shop` cards and detail pages have Ajouter au panier; OUT_OF_STOCK buttons are disabled. Backend validation catches visibility, stock or conversion changes after catalogue loading.
- `/shop/cart` displays names, category, actual sale unit, current price, decimal quantity controls, subtotal and availability.
- Hidden/deleted products remain visible as Produit indisponible with their product reference; zero-stock items remain marked Indisponible. Removal remains available. Quantity increases are disabled for hidden/out-of-stock items.
- Above-stock quantities remain visible with a reduction message; they are not silently removed.
- Retirer removes one line. Vider le panier requires confirmation.
- Empty cart: Votre panier est vide and Voir le catalogue.
- Validation/network failure: explicit error and Réessayer; stale totals are withheld.
- Checkout remains a disabled Passer la commande — bientôt disponible button. The page states that cart contents do not reserve stock.

## Validation

- Backend build and TypeScript noEmit passed.
- Backend unit suite: 185 tests passed, including cart schema/decimal validation.
- New cart integration cases passed: visible and fractional quantities, all visibility exclusions, zero/excess stock, exact boundary, incompatible conversion, exact current prices, response allowlist, invalid quantity and duplicates, one-query batch behavior, unchanged stock/business data.
- Full integration suite: 70 tests passed across 14 files with `--testTimeout=20000` (126.46 seconds).
- Frontend lint and production build passed; `/shop/cart` returns HTTP 200.
- Three frontend unit tests passed for exact totals/large decimals, quantity parsing and storage recovery.
- POST CORS preflight returned 204 and allowed origin http://localhost:3000, POST and Content-Type. No CORS changes/workarounds were necessary.
- Isolated Chrome browser suite passed all 15 requested cases: add (card/detail), repeat-add consolidation, refresh persistence, quantity changes, removal, clear confirmation, exact totals, unavailable items, price changes, malformed storage, empty state, count, mobile layout, Arabic names and no hydration errors. Also tested comma quantities, stock overrun and endpoint error/retry.
- Responsive checks: desktop 1280px, tablet 768px, mobile 390px, no horizontal overflow. Screenshots were generated and the mobile screenshot inspected.
- Test fixtures use UUID-tagged disposable products only and are cleaned in finally/afterAll. Browser price/visibility changes touched only those fixtures and were restored before the read-only snapshot comparison. Whole product/stock/sale/cash snapshots matched before and after cleanup. No existing stock or product flags were altered.

The first full integration run had three five-second timeouts in existing cash/payment tests (67/70 passed); the new cart tests passed. The suite was rerun with a 20-second CLI test timeout, without changing application behavior. An initial browser-script navigation race was corrected and the complete browser suite then passed.

Existing backend lint warning: `test/stock-movements.e2e-spec.ts:81` no-unsafe-finally. Vitest emits the existing vite-tsconfig-paths notice. Running the frontend TypeScript utility tests directly with Node emits a harmless MODULE_TYPELESS_PACKAGE_JSON warning; no package-module setting was changed merely to suppress it.

## Repeat automated checks

Backend:

```powershell
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run test
$env:RUN_DATABASE_TESTS='1'
npm.cmd run test:e2e -- --no-file-parallelism --testTimeout=20000
```

Frontend:

```powershell
npm.cmd run lint
npm.cmd run build
node --experimental-strip-types --test scripts/cart-unit.test.mjs
```

With both servers running and an isolated headless Chrome instance listening on localhost:9223, run `node scripts/verify-cart.mjs` from frontend. It closes its browser and removes its own fixtures. Do not run fixture-based suites concurrently, as they compare complete database snapshots.

## Exact manual test

1. Start backend on localhost:3001 and frontend on localhost:3000 if not already running.
2. In a disposable development dataset, create A with active, sellable and online-visible enabled. Use an Arabic name, saleUnit KG, storageUnit KG, conversionFactor 1, price `0.100`, and add 10 KG through the existing stock-entry form. Create B with the same flags but zero stock. Do not alter real stock solely for testing.
3. Open `/shop`, locate A and click Ajouter au panier. Verify Panier (1). Add A again: count remains 1 because the same line now has quantity 2. B's button must be disabled.
4. Open `/shop/cart`: quantity 2, total 0,200 DT. Increase to 3 and refresh the page; quantity persists. Enter `2,5`, click Mettre à jour and verify 0,250 DT. Decrease to 1,5 and verify 0,150 DT. Enter 0 and check the validation message.
5. Enter 11 KG: the backend rejects availability without changing stock; the line remains and the summary total is withheld. Restore a valid quantity.
6. Remove A and verify the empty state. Add it again, click Vider le panier, cancel once, then confirm. Check the header count and empty state.
7. Add A, change only this disposable product's price in admin, and refresh the cart: current price and total must update. Disable its online visibility in admin and refresh: Produit indisponible, increase disabled, removal allowed. Restore test flags if retaining the fixture.
8. In DevTools Application/Local Storage, set herb-store-cart-v1 to malformed JSON and reload. Verify recovery warning and an empty cart without a crash.
9. Briefly stop the backend while a cart contains A. Refresh the cart, verify the failure message and withheld total, restart the backend and click Réessayer.
10. Check mobile/tablet/desktop widths and compare stock before/after all cart actions. Cart actions must never change it. Clean up only disposable test data afterward.

## Limits

Same-browser persistence only; no cross-device/account synchronization. Availability is a point-in-time check and is never a reservation. Default add requests 1 sale unit, so it can be rejected if less than 1 sale unit is currently available; manual decimal controls apply to existing cart lines. Conversion compatibility remains the backend's decision. The validation query currently aggregates visible ledger history; larger deployments may need query-plan/index tuning while preserving one inventory source of truth. Current real products are not automatically published for testing.
