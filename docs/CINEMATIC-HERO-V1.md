# Cinematic Hero Animation V1

Only the hero and immediate trust bar motion changed. The approved text, image, dimensions and layout remain unchanged. No dependencies were installed.

## Files created/modified

- `frontend/src/app/shop/page.tsx`: wraps the existing hero and trust markup in CinematicHero.
- `frontend/src/app/shop/storefront/cinematic-hero.tsx`: client-side timeline, actual-line masks, cleanup and desktop depth.
- `frontend/src/app/shop/storefront/cinematic-hero.css`: isolated mask/divider styles and CTA arrow hover; overrides the earlier hero/trust fade animations only.
- `frontend/scripts/verify-cinematic-hero.mjs`: staged screenshots, dimensions, reduced-motion, focus and depth verification.
- `CINEMATIC-HERO-V1.md`: this report.

## Orchestration

Dependency inspection found only Next.js, React and React DOM. Native Web Animations API provides the required timeline control without adding Motion/GSAP. One component uses shared easing `cubic-bezier(.22,1,.36,1)` and a common mobile time multiplier. CSS defines masks and hover states; IntersectionObserver and requestAnimationFrame handle low-amplitude desktop depth.

Desktop/tablet timeline (milliseconds from initialization):

| Element | Start | Duration | Technique |
| --- | ---: | ---: | --- |
| Surface | 0 | 600 | Opacity .96 → 1 |
| Image reveal | 0 | 1100 | clip-path inset left 100% → 0%, exposing right to left |
| Image depth settle | 0 | 1200 | translateX 8px / scale 1.04 → neutral |
| Eyebrow | 140 | 500 | Horizontal clip wipe |
| Headline line 1 | 280 | 780 | Overflow mask, text travels 112% of line height |
| Headline line 2 | 410 | 780 | Same mask, 130ms stagger |
| Description | 900 | 480 | Opacity and 8px upward settle |
| Primary CTA | 1040 | 450 | Opacity .45 → 1, translateX -14px, scale .98 → 1 |
| Secondary CTA | 1140 | 450 | Same entrance with 100ms stagger |
| Trust dividers | 1120 | 600 | Center-origin scaleX 0 → 1 |
| Trust items | 1300 / 1380 / 1460 | 440 | Opacity and 9px upward settle |
| Trust icons | 1380 / 1460 / 1540 | 360 | 3px vertical settle |

Total: 1900ms for the tested two-line headings. If accessibility settings create further lines, their reveals retain the same 130ms stagger. The original semantic heading remains in the DOM; aria-hidden mask copies use its measured width and line height, preserving natural wrapping and italic styling. Copies are removed at completion. No individual-letter animation or forced line breaks.

## Interaction, accessibility and performance

- CTAs stay clickable throughout; focusing anywhere in the hero/trust completes the intro immediately. Hover retains the 1px lift and adds a 3px arrow shift over 220ms.
- The intro plays once per mount. Resize ends it safely, restoring the naturally wrapped heading instead of replaying or leaving stale masks.
- After completion, fine-pointer desktops wider than 1100px receive at most 8px image translateY. A passive scroll handler schedules at most one requestAnimationFrame; elements are cached. IntersectionObserver avoids work while the hero is offscreen. No continuous animation loop or width/height animation.
- Depth is disabled for mobile/tablet, reduced motion, Save-Data connections and hidden documents. There is no universal browser low-power signal; Save-Data is the available conservative check.
- Mobile below 760px uses 65% timing (1235ms total), scale 1.02 without horizontal image travel, and no parallax.
- Reduced motion skips the timeline entirely and resets active motion when the preference changes. Without animation support/JavaScript, the original content remains readable. No content or reading order depends on the mask copies.

## Validation

- Frontend lint and production build passed.
- /shop returns HTTP 200. Approved hero image checksum is unchanged.
- Staged screenshots checked at 1920×1080, 1440×900, 768×1024 and 390×844. Intro timings verified; each heading retained two lines and all temporary masks were removed after completion.
- Hero/trust dimensions remain exactly 460/80, 420/80, 400/80 and 500/146px at those respective viewports.
- Desktop depth measured about 3.6–3.9px at the test scroll position, within its 8px cap; tablet/mobile reported no depth transform.
- Reduced-motion and focus-to-complete checks passed. No horizontal overflow, hydration exceptions or new console errors.
- Existing signed-out auth probes still log 401 resource warnings. Full-page layout-shift measurements remain 0–0.0082, matching the previous refinement measurements; zero overall CLS is not claimed.
- Final evidence: `.tmp/cinematic-check-448f8756-fafd-4d8a-9425-121daef9606f/` with screenshots at 450/950/1450ms and settled views. Natural playback also completed once and did not replay on scroll. Timing checks do not constitute a hardware-independent 60fps guarantee.
- One rerun timed out because the local servers had stopped between sessions. Both were restarted; the complete rerun passed.
- No backend changes or business-data writes.

Review **http://localhost:3000/shop**. Reload to watch the sequence; scroll gently on desktop after it finishes. Enable reduced-motion emulation to check immediate rendering.
