# Public Product Details redesign

Review: http://localhost:3000/shop/products/2694 (existing public product).

## Files changed

- `frontend/src/app/shop/products/[id]/page.tsx`
- `frontend/src/app/shop/products/[id]/product-details.css`
- `frontend/src/app/shop/products/[id]/product-purchase.tsx`
- `frontend/src/app/shop/cart-provider.tsx`
- `frontend/src/lib/cart-api.ts`
- `frontend/scripts/verify-product-details.mjs`
- `PRODUCT-DETAILS-V1.md`

## Design

Equal desktop columns: padded cream image surface on the left; subtle category/subcategory, editorial serif name, optional existing French/scientific names, strong price with smaller unit, availability and compact purchase controls on the right. Mobile stacks below 760px. Image content height is 280–390px desktop, 260px on small screens and 220px below 480px. Existing Next Image loader retains contain fitting, alt text, responsive sizes and uploaded files. Missing images use a botanical leaf placeholder.

Quantity controls accept the existing decimal format including comma input. Step buttons use existing exact decimal helpers and have accessible names, visible focus and 44px minimum height. Add button is 46px minimum and is disabled for unavailable products, pending requests and cart initialization. Inline feedback reports success or backend validation failure.

Description appears below only when real public description data exists. Reference, origin and packaging are shown only when supplied publicly. Up to four related products come from the same public category endpoint, exclude the current product and reuse ProductCard. Optional suggestions may be omitted if their request fails or times out; product details still remain available. No fabricated ratings, claims, private fields or price calculations were introduced.

## Cart integration

The existing add action now accepts an optional decimal quantity, defaulting to the original one unit. It adds to any existing line using exact decimal helpers, then performs the same single server validation before committing. Locks, limits, storage, concurrency and backend stock/pricing authority remain unchanged.

Real testing discovered a pre-existing response-guard mismatch: the cart validator expected a category string although the API and PublicProduct type now return a category object. The frontend guard now validates the object's id/slug/names. No backend/business-rule change was needed.

## Validation

- Frontend lint and production build passed; existing public details URL returns HTTP 200.
- Browser checks at 1920, 1440, 1024, 768 and 390px: two/one-column layout, contain images, no-image fallback, available/unavailable button states, description, related cards, no overflow.
- Real cart API checks with disposable products: zero rejected locally; comma input 2.5 accepted; subsequent 1.25 adds to 3.75; quantity 1000 rejected by backend with cart unchanged; existing ProductCard default add increments to 4.75.
- Temporary test products and their test stock entry were removed. Existing product and stock row snapshots match before/after. No uploaded files, real stock, orders or users were changed.
- No runtime/hydration or new console errors. Existing signed-out auth probes return 401 warnings, recorded separately.
- Earlier browser attempts encountered stale build/stream timing and the cart category-guard mismatch. After restarting the completed build, correcting test waits and fixing the guard, the complete rerun passed.
- Evidence: `.tmp/product-details-check-067fffe1-f899-4408-aa42-3993dfbd88de/` (10 screenshots and result.json).

The current real product is unavailable and has an image; it correctly shows a disabled purchase action. Available/no-image scenarios were tested using disposable records rather than modifying it. No backend tests were needed because backend code is unchanged.

To review manually, open the URL above and resize the viewport. For an available product, enter a quantity, use Add to cart, and check the inline feedback and cart count. Test a quantity above availability to confirm server rejection leaves the cart unchanged.
