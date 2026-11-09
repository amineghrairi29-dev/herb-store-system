# Public product cards

## Compact proportion refinement

The compact refinement supersedes the original square-image dimensions below. Modified files: `frontend/src/app/shop/product-card.tsx`, `frontend/src/app/shop/product-card.css`, `frontend/scripts/verify-product-cards.mjs`, and this report.

- Fixed image content height: 130px desktop, 120px at widths up to 1099px. With 8px vertical padding, total image areas are 146px and 136px. Next.js Image, contain fitting, horizontal padding and fallback are retained.
- Measured standard card height: 357px desktop, 347px tablet, 345px mobile. Image share is approximately 39–41%, within the requested 34–42% range. Content can still grow for exceptional prices or cart messages; no fixed overall height clips content.
- Removed the standalone “Vendu par …” row. The same selling unit now appears beside the price in smaller muted text. Prices and their formatting are unchanged.
- Body padding reduced from 13/16/16px to 12/16/14px. Two-line 44px name regions, subtle category/availability lines and 42px cart buttons remain readable and aligned. Existing grid breakpoints remain unchanged.
- Frontend lint and production build passed. Browser checks passed on both pages at 1920, 1440, 1024, 768, 600 and 390px: compact dimensions, full contain images, aligned heights/buttons, no overflow, keyboard focus, disabled unavailable state, details links, filters, search and existing cart feedback.
- Browser interactions use isolated response fixtures; no backend or business data changes. No runtime/hydration errors; existing guest authentication 401 warnings remain. The initial browser run hit a lazy-image timing assertion; the test now waits for image completion and the rerun passed.
- Final screenshots and measured dimensions: `.tmp/product-card-check-9351035a-297c-4d1d-9a12-8f759fb7b950/`.
- Review: http://localhost:3000/shop and http://localhost:3000/shop/catalogue.

The homepage and catalogue now share `ProductCard`. Only their product card markup and product grids changed. The header, hero, category cards, details, cart implementation, backend, upload system and visibility rules were left unchanged.

## Files

- `frontend/src/app/shop/product-card.tsx` — shared presentation using PublicProduct only.
- `frontend/src/app/shop/product-card.css` — scoped card and product-grid styling.
- `frontend/src/app/shop/storefront/home-selection.tsx` — replaces duplicated card markup.
- `frontend/src/app/shop/catalogue.tsx` — uses the same component; retains filter/search/pagination code.
- `frontend/scripts/verify-product-cards.mjs` — browser validation with intercepted test responses; no database writes.
- `PRODUCT-CARDS-V1.md` — this report.

## Presentation and interaction

- Square image surface, 12px inset from the card edges, neutral background, 16px outer radius. Existing Next.js ProductImage uses `contain`; no source image edits or cropping.
- Responsive sizes: 90vw below 480px, 44vw below 760px, 29vw below 1100px, 22vw below 1440px, 270px above. The existing upload image loader remains unoptimized and serves its normalized WebP (bounded to 1600px); responsive variants were not introduced. Thus sizes documents expected layout but does not reduce downloaded bytes with that existing loader.
- Five columns at 1440px+, four at 1100–1439px, three at 760–1099px, two at 480–759px, one below 480px. Gaps: 22/18/16px. Card width follows the existing container: approximately 230px in the catalogue and up to 286px on the widest homepage.
- Height is image width plus the compact text/action body, rather than a fixed pixel height. Grid stretch and a flex body align cards and bottom actions. The name region always reserves 44px: two lines at 16px/22px, semibold, dark green.
- Small category/subcategory line; unit shown as “Vendu par …” using only saleUnit. No invented package sizes or extra description clutter.
- Existing decimal formatter renders the exact sale price, with TND shown in smaller type. No price conversions, discounts or stock computations.
- Existing availability states map to Disponible, Stock limité and Indisponible. No exact stock quantities. Out-of-stock disables the existing AddToCart button.
- Image/name links navigate to details. The separate cart button calls the unchanged cart action, retains server validation and existing inline success/error feedback and cart count updates.
- Hover uses 1.03 image scale and a restrained shadow/border change. Keyboard focus is visible; reduced-motion settings disable transitions. No hover dependency on mobile.

## Validation

- Frontend lint and production build passed.
- Both review routes return HTTP 200.
- No backend/API changes, so backend tests were not rerun.
- Read-only live-product rendering checked first. Browser-only fixtures then covered five cards, wide uploaded image, absent image, short/long/Arabic names, weight/volume/piece units, available/low/unavailable states.
- Homepage and catalogue checked at 1920, 1440, 1024, 768, 600 and 390px. Equal row heights, aligned buttons, two-line names, contain images, no horizontal overflow.
- Keyboard focus, unavailable disabled action, cart feedback without navigation, detail link navigation, category filtering and search passed using browser-intercepted fixture API responses. This checks UI integration, not a new real-stock/cart backend test.
- No runtime, hydration or product-card errors. Existing guest auth probes `/auth/me` and `/public/auth/me` log 401 resource warnings; recorded separately and not modified.
- No portrait-bottle or transparent uploaded image sample was available. Those specific photographs remain a manual check; contain sizing preserves the full image for either orientation.
- Evidence: `.tmp/product-card-check-4d98cd9b-be13-42b1-ae2f-65d21850f3a7/` contains 12 screenshots and result.json. Test browser cart storage was cleared. No users, products, stock, images or orders were written.

## Manual review

1. Open http://localhost:3000/shop and scroll to Nos produits.
2. Open http://localhost:3000/shop/catalogue and try existing search and category/subcategory filters.
3. Check at desktop, tablet and mobile sizes. Image/name links should open the existing details page.
4. With a genuinely available product, use Ajouter au panier: stay on the page and see existing cart feedback/count. Unavailable products must remain disabled.
5. When portrait/transparent product uploads are available, check the full bottle/package remains visible inside the padded image area.

The live dataset remains unchanged; all simulated products exist only in the isolated browser test responses.
