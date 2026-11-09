# Category images V1

The public homepage renders curated local category images from `Category.imagePath`. Existing category eligibility, navigation, product images and business logic are unchanged.

## Schema and assignment

Added nullable `Category.imagePath` with migration `20260911T1518_category_images_v1`, applied locally. Its data transform updates only null image paths on existing categories matched by slug. It does not insert categories or update names, IDs, slugs or timestamps. Repeating migration checks reports nothing pending.

| Slug | Image path |
| --- | --- |
| herbes | /images/categories/herbes.png |
| huiles-et-liquides-naturels | /images/categories/huiles-liquides.png |
| epices | /images/categories/epices.png |
| parfums | /images/categories/parfums.png |
| melanges-speciaux | /images/categories/melanges-speciaux.png |

All five assignments were verified against the database. No upload UI was added; the field remains internal/read-only through current category management inputs.

## Public display

`GET /public/categories` now returns the nullable `imagePath` alongside its existing public fields. The explicit DTO includes no internal category metadata. Product category objects and catalogue text filters are unchanged.

The shared category image component uses Next.js Image with `fill`, responsive `sizes`, meaningful category-name alt text, `object-fit: cover` and centered positioning. No per-category crop overrides were needed. It restricts sources to local category asset paths and uses the existing CategoryImagePlaceholder for null, invalid or failed image paths.

The visual area reserves a 2.5:1 ratio with a 90px minimum height. Existing outer card rounding clips the image. The text row can grow so long labels do not hide the navigation caption. Existing grid breakpoints remain: five columns at 1440px+, three at tablet widths, two at smaller widths, one below 520px. No other homepage sections were redesigned.

## Validation

- Frontend lint and production build passed after the final CSS change.
- Backend build passed; 291 unit tests passed.
- Database integration suite: 177 passed, one existing skipped test.
- Added coverage for null/populated category image paths and the public field allowlist.
- Migration status: up to date; subsequent preview: nothing to run.
- Browser screenshots and checks passed at 1920, 1440, 1024, 768 and 390px: five loaded images, all five links and category filters, no-image fallback, readable unclipped captions and no horizontal overflow.
- No runtime exceptions, hydration errors or category/image errors. Existing guest probes to `/auth/me` and `/public/auth/me` produce browser 401 resource warnings; these were recorded separately, not suppressed or changed.
- Final browser evidence: `.tmp/category-image-check-5210e026-7335-4adb-a7ad-ed63266b2b72/` (five viewport screenshots, fallback screenshot, result.json).
- Browser fixtures used UUID-owned disposable products and a future category. All were removed. Preservation hashes across existing public records match, excluding only the new Category.imagePath field. Both existing products and all other business/user records remain unchanged.
- Asset checksums confirm all five original PNGs remain unchanged.

## Files created or modified

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json` (generated)
- `backend/src/prisma/contract.d.ts` (generated)
- `backend/migrations/app/20260911T1518_category_images_v1/migration.ts`
- `backend/migrations/app/20260911T1518_category_images_v1/migration.json`
- `backend/migrations/app/20260911T1518_category_images_v1/ops.json`
- `backend/migrations/app/refs/db.json`
- `backend/migrations/snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract.json`
- `backend/migrations/snapshots/127ab332c9fd7c1e9ede480ca57a2d833f4deebacecc9635c5e64f8a5251168a/contract.d.ts`
- `backend/src/public-catalogue/public-category.dto.ts`
- `backend/src/public-catalogue/public-catalogue.service.ts`
- `backend/test/public-catalogue.e2e-spec.ts`
- `backend/scripts/verify-category-image-preservation.mjs`
- `frontend/src/types/public-product.ts`
- `frontend/src/app/shop/storefront/category-image.tsx`
- `frontend/src/app/shop/storefront/home-selection.tsx`
- `frontend/src/app/shop/storefront/homepage-layout.css`
- `frontend/scripts/verify-category-images.mjs`
- `CATEGORY-IMAGES-V1.md`

Generated build outputs and ignored `.tmp` validation artifacts are not source changes. No dependencies or image assets were added or modified.

## Review

Open http://localhost:3000/shop and scroll to Nos catégories. Click a card to inspect its filtered catalogue. Resize the browser to inspect the existing responsive grid.

The current real dataset exposes only Herbes publicly because only that category has an eligible public product. All five image paths are assigned, and all five were verified with temporary fixtures. The other cards will appear when they contain eligible products under the existing rules; no real product visibility/classification was changed to force them to appear.

Tooling notes: PowerShell blocked the npm.ps1 shim, so validation used npm.cmd successfully. Prisma reports its optional local agent skills are out of date; migration and validation succeeded. Vitest emits an existing plugin-configuration deprecation warning. Neither required unrelated configuration changes.
