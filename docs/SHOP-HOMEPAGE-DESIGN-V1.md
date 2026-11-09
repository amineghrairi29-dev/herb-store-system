# Public shop homepage redesign V1

Completed 2026-09-10. Scope: `/shop`, the relocated catalogue, minimal About/Contact pages, and their public visual shell. No final image integration or backend change.

## Structure

`/shop` now contains:

1. Slim botanical announcement, StoreSettings store name/logo placeholder, active navigation, search access and existing cart count.
2. Split hero with the requested French copy, catalogue CTA, category anchor and CSS botanical placeholder.
3. Natural products, payment-at-reception and customer-service benefit strip, with no certification or delivery guarantees.
4. Up to six distinct categories returned by the existing visible-category API, linked to filtered catalogue results.
5. Up to four visible products from the existing public API, ordered by its stable `name_asc` sort. No popularity ranking was invented. Cards reuse exact price formatting, availability badges and AddToCart behavior.
6. Secondary service explanation and full-catalogue CTA.
7. Dark botanical footer with store identity and useful links.

The full browsing component is reused at `/shop/catalogue`. Search, category/subcategory, availability, sort and pagination handling remain in that component; form actions, pagination/reset links now use the new path. Its search input has an anchor target for header search access. Old `/shop` URLs containing catalogue query parameters redirect to `/shop/catalogue` with the parameters preserved. Next.js may perform this as a streamed browser redirect rather than a standalone HTTP 307.

`/shop/about` contains neutral store identity and ordering information without invented history. `/shop/contact` explains current contact availability without a new contact form or API.

## Components and visual scope

- `storefront/shell.tsx`: new header/footer, mobile navigation, active links and skip link. It selects the new shell only for `/shop`, `/shop/catalogue`, `/shop/about`, `/shop/contact`.
- `storefront/home-selection.tsx`: public product/category loading, stable selection, cards, empty/error/retry states. It calls the existing API through `apiBase`.
- `storefront/visuals.tsx`: `LeafIcon`, `HeroVisualPlaceholder`, `CategoryImagePlaceholder`, `ProductImagePlaceholder`.
- `storefront/storefront.css`: scoped design tokens and responsive styles.
- Existing `StoreName`, `CartProvider`, `CartIndicator`, `AddToCart`, `ProductPrice` and `AvailabilityBadge` are reused.

The original visual shell remains on product details, cart, checkout and order-result routes. Only its header's Catalogue link now points directly to `/shop/catalogue`. Their page implementations were not redesigned. Back-office and login were untouched.

### Tokens and placeholders

| Token | Value / use |
| --- | --- |
| `--sf-ink` | `#173f32`, dark botanical text, primary CTA and footer |
| `--sf-green` | `#2e6149`, secondary green and focus |
| `--sf-sage` | `#edf3e9`, soft accent surfaces |
| `--sf-cream` | `#fafbf7`, product section background |
| `--sf-white` | `#ffffff`, cards/header |
| `--sf-muted` | `#637268`, supporting text |
| `--sf-line` | `#dce5da`, borders |
| `--sf-radius` | `20px`, cards and surfaces |

Native Arial/system sans text and Georgia serif headings require no external font. Gradients and simple inline leaf outlines are placeholders, not final product artwork. Placeholder areas have stable aspect ratios and `aria-hidden`; their internal `data-placeholder` labels identify later image replacement slots, including `HERO IMAGE PLACEHOLDER`. No stock photos, external image URLs, generated assets, uploads or image packages were added.

Desktop uses a split hero and four-column card grids. Tablet reduces card grids to two columns and uses the compact menu. Mobile stacks the hero, benefits and products; categories use two compact columns, the footer wraps, and the cart remains accessible. Visible focus styles, semantic headings, labels, active-page indicators and a skip link are included; reduced-motion preferences disable transitions.

## Preserved business behavior and limitations

- Visibility filtering, public DTO boundaries, stock calculations, exact decimal prices, cart validation, order APIs and checkout logic were not changed.
- Out-of-stock items show “Rupture de stock” and reuse the existing disabled cart action.
- Categories and products come only from public API results. The local catalogue currently has one visible product/category; empty grid capacity is not filled with fake business data.
- The public `/public/store-info` endpoint currently returns **storeName only**. Phone, email and city are not publicly exposed. The footer omits them and Contact states that public coordinates are unavailable. Protected StoreSettings endpoints were not queried or expanded to bypass this boundary. Public contact fields can be considered separately when explicitly approved.
- No claim of certification, automated delivery/tracking or online payment was added. The requested payment-at-reception copy does not change payment processing; order modalities remain subject to store confirmation.
- Cross-browser/device certification is not implied by Chromium viewport checks.

## Validation

- Frontend lint: passed.
- Frontend production build with local API base: passed.
- Backend: untouched; backend tests were not rerun for this visual-only task.
- Homepage browser harness: passed logged-out homepage, actual category navigation, actual featured AddToCart/count update, search/category/availability/sort, existing product-detail links/shell, About and Contact, mobile menu, and legacy filtered URL redirects.
- Twelve page/viewport combinations passed at 1440, 768 and 390 px across homepage, catalogue, About and Contact, with no document-wide horizontal overflow.
- Mocked responses verified empty categories/products, Arabic out-of-stock product with disabled button, API failure and retry to live data. These mocks created no database records.
- French hero accents and live Arabic product names verified; no runtime console errors or hydration warnings in the successful homepage run.
- Existing cart browser regression passed after changing its catalogue route: add from card/detail, merging, decimal/comma quantities, persistence, removal, clear confirmation, current-price revalidation, hidden/unavailable products, corrupted storage, stock limits and error/retry; desktop/tablet/mobile.
- That existing cart test used its own UUID-tagged product/stock fixtures, removed them afterward and confirmed original product/stock/sale/cash rows unchanged. It did not submit an order or alter real stock.
- Desktop/mobile screenshots were inspected. This caught damaged accents introduced by a Windows shell write in the initial hero source; the source was corrected and the production build/browser checks repeated successfully.
- Initial harness assertions needed to wait for catalogue options and accept the framework's streamed redirect. These test assumptions were corrected before reporting a pass.

Evidence:

- `.tmp/shop-design-lint.log`, `.tmp/shop-design-build.log`
- `.tmp/shop-homepage-browser.log`
- `.tmp/shop-homepage-1789002787666/` — successful results and page screenshots
- `.tmp/shop-cart-regression.log`
- `.tmp/cart-validation-1789002823163/` — cart screenshots

## Manual review

Open these while the existing local backend/frontend are running:

- `http://localhost:3000/shop`
- `http://localhost:3000/shop/catalogue`
- `http://localhost:3000/shop/about`
- `http://localhost:3000/shop/contact`

1. Review the homepage at desktop width and 390 px. Open/close the mobile menu and check the cart remains accessible.
2. Click a real category card; verify the catalogue category is selected. Search and exercise category/subcategory, availability and sort filters; use pagination where the data provides more than one page.
3. Add an available homepage product and check the count; follow its detail link and open `/shop/cart`. Adding to the cart alone does not reserve/deduct stock.
4. Check the catalogue CTA and About/Contact links. Test `http://localhost:3000/shop?sort=price_desc` and confirm it reaches the sorted catalogue.
5. Navigate with Tab to inspect focus indicators and the skip link. Confirm French accents and Arabic names render correctly.
6. Review the placeholder dimensions only; final images are intentionally deferred. No order submission is needed for this design review.

## Files created/modified

Created:

- `frontend/src/app/shop/catalogue/page.tsx`
- `frontend/src/app/shop/about/page.tsx`
- `frontend/src/app/shop/contact/page.tsx`
- `frontend/src/app/shop/storefront/shell.tsx`
- `frontend/src/app/shop/storefront/home-selection.tsx`
- `frontend/src/app/shop/storefront/visuals.tsx`
- `frontend/src/app/shop/storefront/storefront.css`
- `frontend/scripts/verify-homepage.mjs`
- `SHOP-HOMEPAGE-DESIGN-V1.md`

Modified:

- `frontend/src/app/shop/page.tsx` — homepage and legacy query redirect
- `frontend/src/app/shop/layout.tsx` — route-scoped public shell and CSS
- `frontend/src/app/shop/catalogue.tsx` — new catalogue URLs and search anchor
- `frontend/scripts/verify-cart.mjs` — existing regression's catalogue URL only

No backend file, dependency manifest, lockfile, private setting, product model or final image asset was changed.
