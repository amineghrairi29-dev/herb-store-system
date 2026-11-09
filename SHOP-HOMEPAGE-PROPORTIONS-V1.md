# Public shop homepage proportion refinement

Manual review: http://localhost:3000/shop

## Files

- Created `frontend/src/app/shop/storefront/homepage-layout.css`: homepage-scoped proportions and responsive rules.
- Modified `frontend/src/app/shop/layout.tsx`: imports the new stylesheet.
- Modified `frontend/src/app/shop/storefront/shell.tsx`: applies `storefront-home` only on `/shop`.
- Modified `frontend/src/app/shop/storefront/home-selection.tsx`: requests up to six featured products using the existing public API and stable name sorting.
- Modified `frontend/scripts/verify-homepage.mjs`: extends browser checks to five viewport widths and full grids with browser-only fixtures.
- Created this report.

## Layout

- Centered container: maximum 1520px; desktop side gutters 40px, tablet 24px, mobile 18px.
- Header: 116px desktop and 90px mobile, with larger identity, navigation and cart controls.
- Hero: approximately 44/56 text/visual split after the gap; minimum height 660px desktop, 720px on large screens. Heading grows to 82px. Landscape placeholder ratio 1.42; mobile stacks the columns with ratio 1.45.
- Benefit strip: larger icons, type and padding.
- Categories: four desktop columns, five on wide screens when at least five categories exist; three tablet, two smaller screens, one below 520px. Card target aspect ratio 1.42 with content allowed to grow. Fixed grid tracks prevent sparse data stretching across the row.
- Products: six columns from 1680px, five from 1280px, four from 1024px, three from 760px, two from 520px, one below 520px. Desktop widths were verified within 220–270px at 1440px and 1920px. Placeholder ratio 1.2, or 1.35 on narrow mobile. Consistent body padding, price and full-width cart button.
- Section padding: 64px desktop and 44px mobile; tighter heading and catalogue-button gaps. Services use four balanced desktop columns including the introduction, then stack progressively. Footer uses three desktop columns and two mobile columns beneath the identity.
- All existing visual placeholders remain. Catalogue, detail, cart, API contracts, price formatting, availability and business logic are unchanged.

## Validation

- Frontend lint: passed.
- Frontend production build: passed.
- Production browser checks: `/shop`, `/shop/catalogue`, `/shop/about`, `/shop/contact` return HTTP 200 and have no horizontal overflow at 1920, 1440, 1024, 768 and 390px.
- Five additional full-grid checks passed with six products and five categories intercepted only in the browser. No database fixtures were created.
- Live product names, French text, category navigation, catalogue search/filter/sort, product detail navigation, add-to-cart and cart count passed.
- Empty, unavailable-product and API-error states plus retry passed using browser interception.
- Mobile menu and old filtered homepage URL redirection passed.
- No recorded runtime exceptions, console errors or hydration errors.
- Screenshots reviewed at 1920px, 1440px, 768px and 390px. Results and screenshots: `.tmp/shop-homepage-1789004508528/`.
- No business records were changed. The only API POST during validation was the existing read-only public cart validation endpoint.

## Manual review

1. Open http://localhost:3000/shop at 1920px and 1440px. Check the header, hero, benefit strip, card widths, spacing and footer.
2. Resize to 1024px, 768px and 390px. Check grid transitions, stacked hero, mobile menu and absence of horizontal scrolling.
3. Click a category and verify the catalogue filter. Open a product, return to the homepage, add an available product to the cart and check the count.

No implementation blockers. The live catalogue currently has sparse visible data; full-row density was verified with browser-only fixtures. No real images or new packages were added.
