# Public storefront header

Review: http://localhost:3000/shop

## Files

- Created `frontend/src/app/shop/storefront/public-header.tsx`.
- Created `frontend/src/app/shop/storefront/public-header.module.css`.
- Modified `frontend/src/app/shop/storefront/shell.tsx` to use one header in both existing storefront shells.
- Modified `frontend/src/app/shop/customer-auth-provider.tsx` to supply centralized customer checks on storefront navigation and focus, and finish pending refreshes before logout so stale state cannot restore the indicator.
- Created this report.

## Behavior

The white/cream header has an existing botanical leaf mark and dynamic StoreSettings name, centered desktop links with subtle active underlines, search, and a cart icon/count badge. It is 88px high on desktop, 80px on tablet and 76px on small mobile. The content width is capped at 1520px.

Visitors see no login CTA. Authenticated customers see a compact first-name/Mon compte disclosure containing their name/email and logout only. No profile/history route is invented. While initial identity is unresolved, the header remains usable without claiming an authenticated identity; focus refreshes retain the known indicator until the result arrives.

The existing CustomerAuthProvider owns all session requests; header components do not fetch `/public/auth/me`. Logout updates shared state and leaves cart localStorage unchanged. Back-office authentication is not used.

The cart badge uses the existing hydrated cart line count. Search retains `/shop/catalogue#catalogue-search` and existing catalogue search behavior. Catalogue is also marked active on product detail routes.

At widths up to 1100px, a keyboard-accessible disclosure menu replaces desktop navigation/account controls. It includes navigation, search and customer logout when authenticated. Opening focuses the first link; Escape closes it and restores focus to its trigger. Navigation closes the menu. The desktop account disclosure also supports Escape and outside-pointer dismissal. Focus outlines and icon labels are provided.

Only the main header sticks at `top: 0`, with z-index 40 and a translucent cream background/blur. The existing announcement bar scrolls normally. Menus overlay below the header without moving page content. All existing page bodies, hero, footer, APIs and business logic are preserved.

## Validation

- Frontend lint and production build passed.
- Production browser checks passed at 1920, 1440, 1024, 768 and 390px for visitor and customer headers.
- Verified no visitor login CTA, active navigation, cart count, search fragment routing, menu navigation/close, Escape/focus return, sticky top position, authenticated indicator and cart-preserving logout.
- Existing visitor cart → registration → checkout → order success flow also passed using UUID-owned disposable fixtures; fixtures were removed afterward.
- No horizontal overflow, runtime exceptions, hydration errors or console errors in the successful run.
- Screenshots reviewed at all five widths: `.tmp/customer-auth-1789088679775/header-customer-*.png` and matching visitor captures. Local browser harness: `.tmp/verify-header.mjs`; log: `.tmp/header-browser.log`.
- The local API/browser had stopped during the interrupted session and were restarted before the successful checks. No outstanding blocker remains.

## Manual review

1. Open http://localhost:3000/shop as a visitor. Check the header, search, active links and cart badge; scroll to check sticky behavior.
2. Add a product and complete customer login/registration through checkout. Return to `/shop` and open the account disclosure.
3. Choose **Se déconnecter** and verify that the indicator disappears while the cart remains.
4. At 390px or 768px, open the menu, navigate to About/Contact and test Escape with a keyboard. Authenticated logout is available inside this menu.
