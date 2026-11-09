# Homepage top refinement

Only the homepage hero, trust strip and spacing/reveal of the category heading changed. The approved image is byte-for-byte unchanged. Category cards, product cards, other routes and business logic remain unchanged.

## Files

- `frontend/src/app/shop/page.tsx`: stagger-ready hero/trust classes; removed the low-value hero footnote.
- `frontend/src/app/shop/storefront/homepage-layout.css`: compact hero, trust strip, category top spacing and scoped motion.
- `frontend/src/app/shop/storefront/home-selection.tsx`: category heading uses ScrollReveal; cards untouched.
- `frontend/src/app/shop/storefront/scroll-reveal.tsx`: reusable one-time IntersectionObserver wrapper.
- `frontend/scripts/verify-home-top.mjs`: read-only browser measurements, screenshots, reduced-motion/overflow checks.
- `SHOP-TOP-REFINEMENT.md`: this report.

## Measured proportions

| Viewport | Hero before → after | Trust before → after | Category heading top before → after |
| --- | --- | --- | --- |
| 1920×1080 | 520 → 460px | 110 → 80px | 909 → 755px |
| 1440×900 | 432 → 420px | 110 → 80px | 821 → 715px |
| 1280×800 | 430 → 420px | 110 → 80px | 819 → 715px |
| 1024×900 | 430 → 400px | 110 → 80px | 811 → 687px |
| 768×1024 | 475 → 400px | 110 → 80px | 855 → 687px |
| 390×844 | 686 → 500px | 252 → 146px | 1163 → 832px |

Desktop uses a 420–460px minimum-height clamp; tablet uses 400px. Content may grow if accessibility settings require it instead of being clipped. Mobile stacks text and a controlled 180px image. The desktop text column is 42%, image 60% with the existing blend; narrow tablets retain wider text for readability.

Headline is now 44–54px desktop, 34–40px tablet, and fluid 32–42px mobile, preserving the serif and 1.05 line-height. Paragraph spacing is 14px/18px with a 390px maximum width. Desktop hero padding is 28px vertically; primary CTA is 50px high. The footnote was removed. Hero-to-trust spacing is 16px desktop/12px mobile; category top padding is 28px/24px.

Trust retains all three messages and existing icons, now 28px. Desktop is a plain three-column bar with subtle dividers; mobile uses three compact rows with inline supporting text where space permits.

## Motion

CSS fade-up: opacity and 12px translateY, 550ms ease-out. Hero eyebrow/headline/description/actions delays: 0/60/120/180ms. The image fades over 800ms with no zoom. Trust items use 180/240/300ms delays. Primary CTA hover moves only 1px; secondary CTA underlines.

Category heading uses IntersectionObserver at 10% visibility, reveals once over 550ms, then disconnects. No scroll listeners, new libraries or continuous observer work. Without JavaScript it remains visible. Focus reveals it immediately. Reduced-motion disables fades, transforms, transitions and delays and shows content immediately; changes to that preference are handled while mounted.

## Validation

- Frontend lint and production build passed; /shop returns HTTP 200.
- Browser screenshots and checks at all six listed viewports passed for height targets, no horizontal overflow, loaded approved image, one-time heading reveal and reduced-motion rendering.
- No runtime/hydration errors or new console errors. Existing logged-out `/auth/me` and `/public/auth/me` 401 resource warnings remain.
- Measured full-page layout-shift score: 0–0.0082 across runs. This is small, but not a claim of zero layout shift. Hero/image dimensions are reserved and animation uses opacity/transforms only.
- Hero image checksum matched before/after. No business data writes; no backend tests needed because backend/API code is unchanged.
- Before evidence: `.tmp/home-top-check-15316322-9166-4ddd-aedb-6285f1a4de42/`.
- Final evidence: `.tmp/home-top-check-6efa6fdc-1266-4255-ad60-9c109e6c77b4/`.

Review http://localhost:3000/shop. Reload to see the short hero/trust sequence, scroll to reveal the category heading, and enable the browser's reduced-motion emulation to confirm immediate display.
