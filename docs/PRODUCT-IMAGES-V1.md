# Product Images V1

Implemented on 2026-09-11. Review at http://localhost:3000/products/new and http://localhost:3000/shop/catalogue.

## Data and storage

Product has one nullable `mainImagePath` string. No binary data is stored in PostgreSQL. Existing products remain valid with null images; no existing image or product was fabricated during migration.

Prisma migration `backend/migrations/app/20260911T1234_product_images_v1` adds only the nullable column. The supported migration preview showed exactly one additive operation, `ALTER TABLE public.product ADD COLUMN "mainImagePath" text`. It was applied successfully, advancing the database ref to `c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859`.

Default file directory: `backend/uploads/products/`. `PRODUCT_IMAGE_DIR` may override it with an operator-controlled persistent directory; it is not accepted from API input. Uploaded files and local verification artifacts are Git-ignored.

Each upload is decoded and normalized to a generated UUID-v4 `.webp` filename. The original filename is used only to validate its extension. New files use exclusive creation (`wx`); they cannot overwrite a pre-existing file. The database stores `/uploads/products/<uuid>.webp`.

## API and validation

- `POST /products/:id/image`, multipart field `image`: ADMIN only. Returns `{ id, mainImagePath }` after a successful file write and transaction commit. Existing staff sessions, trusted-Origin enforcement, and role policy apply before multipart parsing.
- `GET /uploads/products/:filename`: constrained public static-file route. It serves only generated `.webp` filenames inside the image directory, rejects traversal/symlinks/non-files, and never exposes a directory listing.
- Staff and public product list/detail DTOs expose the same nullable `mainImagePath`. The shared public cart DTO naturally includes this public-safe field without changing cart calculations.
- General product JSON creation/update cannot set `mainImagePath`; only the dedicated upload route can write it.

Validation is authoritative on the backend:

- JPG/JPEG, PNG, WebP extensions only, case-insensitive.
- Matching declared MIME and decoded image format required.
- Maximum input size: 3 MiB (3 × 1024 × 1024 bytes). Multer limits the request to one file and no extra text fields.
- Decoding is limited to 25 million pixels; corrupt/truncated files and multi-frame images are rejected.
- Sharp re-encodes to static WebP, applies orientation, strips metadata and appended original bytes, and resizes within 1600 × 1600 without enlargement or distortion. Output is also bounded to 3 MiB.
- PDF, SVG, executable data, fake image extensions, and MIME/content mismatches are rejected.

Sharp is the sole new direct runtime dependency. It validates actual decoded images and prevents original active/untrusted bytes from being served. It is declared in the backend package rather than relying on the frontend's dependency tree.

The image response uses `image/webp`, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, and a one-day immutable cache. Only this image route overrides Helmet's resource policy to `cross-origin`, allowing the frontend origin to display backend-hosted images. Authentication and security policies on other routes are unchanged. Image URLs are public assets; do not upload confidential documents or private images.

## Replacement, deletion, and failures

Replacement uses the existing product row lock. The new file is written before the database path is changed. The old path remains intact if validation, writing, the database transaction, or its audit write fails. After commit, the old generated file is removed only if no product references it. Concurrent replacements serialize and leave one referenced file.

Failed transactions attempt to remove their unlinked new file. Cleanup first checks database references, including when commit status may be ambiguous. It accepts only generated filenames within the configured directory. Cleanup failure logs a generic warning and does not turn a committed save into a user-visible failure. Existing product deletion rules are preserved; after an allowed deletion, its now-unreferenced image is cleaned up.

Uploads generate an existing `PRODUCT_UPDATE` audit event with `changedFields: ['mainImagePath']`. No file content or unsafe filename is logged.

Filesystem writes and database commits cannot be one atomic transaction. A process crash or disk-cleanup failure can leave an unreferenced file; there is no bulk cleanup job in V1. Back up the upload directory together with the database, and use persistent storage in deployment. Multiple application instances need shared storage. No automatic deletion of arbitrary files is implemented.

## Create/edit form and display

The shared form includes an accepted-type/size hint, file input, current-image preview, local preview, and clear validation messages.

New products require an image in the UI. Backend JSON creation remains nullable for legacy/API compatibility. The form first creates the product, remembers its ID, then uploads the image. It redirects only after both steps succeed. If upload fails, it explains that product fields were saved, remains on the form, and offers retry or a link to edit the saved product. Retry uses PATCH/the same ID and does not create another product. Abandoning this two-step flow can leave a product without an image; it remains editable and uses a placeholder.

On edit, choosing no file preserves the image. A selected replacement uploads after field updates. If replacement fails, the previous image remains when the upload transaction did not commit. A transport interruption after commit can leave the result uncertain; retry is safe and the UI does not claim confirmed image success in that case.

Image presentation uses one URL helper and a shared component:

- Compact 48px thumbnails in the existing back-office product-name cell.
- Existing homepage product-card visual area.
- Existing catalogue visual area.
- Existing product-detail visual area.
- Original placeholders for null paths and image loading failures.

Images use `object-contain`, fixed thumbnail or aspect-ratio areas, and descriptive product-name alt text. The local browser directly loads the backend's pre-sized image using Next Image's `unoptimized` option. No remote optimizer allowlist, local-IP bypass, or proxy workaround was added. Arabic product names remain UTF-8. Category images, page designs, prices, stock formulas, cart calculations, and order rules were not changed.

## Validation results

- Backend build and `tsc --noEmit -p tsconfig.build.json`: passed.
- Backend unit suite: 291 passed.
- Full integration suite: 174 passed, one existing skip. After adding rollback/file-deletion coverage, the focused image suite passed all 10 tests (the earlier full run included 8 of them).
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Extension/MIME/content/size rejection, legacy null readability, safe static serving, path traversal rejection, edit preservation, replacement cleanup, transaction rollback, concurrent replacements, and audit checks: passed.
- Frontend lint and production build: passed.
- `/products`, `/products/new`, `/shop`, `/shop/catalogue`: HTTP 200. Product details were checked through disposable products in the browser.
- Upload POST preflight: HTTP 204, allows exactly the configured `http://localhost:3000` origin and configured methods.
- Browser: file previews, PDF/oversize messages, create → simulated upload failure → retry on the same product, back-office thumbnail, homepage/catalogue/detail images, edit without a new file, ADMIN replacement, old-file removal, and null-image fallback: passed.
- Browser widths: 1920, 1440, 1024, 768, 390. No horizontal document overflow, captured console errors, or hydration errors. Screenshots were visually inspected.
- Evidence: `.tmp/product-images-1789131063557/` contains 30 screenshots, generated test images, and `result.json`. Harness: `frontend/scripts/verify-product-images.mjs`.
- Existing-data preservation: passed before/after migration and again after test cleanup. The existing product and all other pre-existing public-table records remain unchanged, excluding only the newly added nullable column. No existing stock movements or business documents were modified. All disposable users/sessions/products/audit events and their uploaded files were removed.
- `npm audit --omit=dev`: zero vulnerabilities. The full dependency tree still reports 18 existing development-tool findings. No forced dependency upgrades were applied.

During implementation, a multipart part-count limit initially rejected valid uploads and was corrected; a browser harness readiness race was corrected to wait for category options before submitting. Both reruns passed. Windows permissions required approved server restarts and headless browser execution. The existing stock integration test's no-unsafe-finally warning, Vitest tsconfig-paths notice, and Prisma skill-sync notice remain. There is no outstanding implementation blocker.

## Manual test steps

1. Open http://localhost:3000/login and log in as an existing ADMIN. Go to http://localhost:3000/products/new.
2. Fill the product fields with a unique test SKU, an active category, compatible units, positive conversion factor, and positive price. Select a JPG, PNG, or WebP under 3 MiB. Verify the preview and save.
3. Confirm the redirected product list shows its thumbnail. For public verification, enable Actif, Vendable, and Visible en ligne under an active category. A zero-stock product can still display an image and remains unavailable for purchase.
4. Open http://localhost:3000/shop/catalogue, search the new product, and open its detail page. Confirm the image fits cleanly. The homepage shows the image if the product is among its existing six featured products; the featured-selection rule was not changed.
5. Edit the product without selecting another file. Change a text field and save. The image must remain unchanged.
6. Edit again and select another permitted image. Verify its preview, save, and confirm the new image in the list and public detail page.
7. Select a PDF or an image over 3 MiB. Confirm the form reports the invalid file. Direct API upload also rejects invalid files even if client validation is bypassed.
8. To test retry, block the `/products/<id>/image` request in browser tooling after creation. The form must explain that fields were saved and stay open. Unblock, retry, and confirm there is only one product with that SKU.
9. Open an existing product without an image. Its edit form permits saving without a file, and its eligible public detail uses the placeholder. The pre-existing unclassified product stays hidden from the shop until you intentionally assign an active category; this image feature does not change that category rule.
10. Verify ADMIN access and customer-only denial for internal pages/APIs. See [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md) for current checks and migration behavior.
11. Check desktop, tablet, and mobile layouts and the console. Do not change real stock merely to test an image.

Local servers remain at ports 3000 and 3001. For a later production build/start, retain the project's existing `NEXT_PUBLIC_API_BASE_URL=http://localhost:3001` shell setting. The backend process must have write permission on the configured upload directory.

## Files created/modified for Product Images V1

Backend/schema:

- `.gitignore`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/migrations/app/20260911T1234_product_images_v1/migration.ts` (new)
- `backend/migrations/app/20260911T1234_product_images_v1/migration.json` (new)
- `backend/migrations/app/20260911T1234_product_images_v1/ops.json` (new)
- `backend/migrations/snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract.json` (new)
- `backend/migrations/snapshots/c81552a21c34e3439c58aa1484cb3e58fcec8c18b92e1998170bde2098200859/contract.d.ts` (new)
- `backend/migrations/app/refs/db.json`
- `backend/src/products/product-image-storage.ts` (new)
- `backend/src/products/product-images.module.ts` (new)
- `backend/src/products/products.service.ts`
- `backend/src/app.module.ts`
- `backend/src/audit/audit-values.ts`
- `backend/src/public-catalogue/public-product.dto.ts`
- `backend/src/public-catalogue/public-catalogue.service.ts`

Frontend:

- `frontend/src/lib/product-image.ts` (new)
- `frontend/src/components/product-image.tsx` (new)
- `frontend/src/types/product.ts`
- `frontend/src/types/public-product.ts`
- `frontend/src/app/products/product-form.tsx`
- `frontend/src/app/products/products-table.tsx`
- `frontend/src/app/shop/storefront/home-selection.tsx`
- `frontend/src/app/shop/shop-components.tsx`
- `frontend/src/app/shop/catalogue.tsx`
- `frontend/src/app/shop/products/[id]/page.tsx`

Tests/report:

- `backend/src/products/product-image-storage.spec.ts` (new)
- `backend/test/product-images.e2e-spec.ts` (new)
- `backend/test/public-catalogue.e2e-spec.ts` (updated public DTO allowlist)
- `backend/test/public-cart.e2e-spec.ts` (updated public DTO allowlist)
- `backend/scripts/verify-image-preservation.mjs` (new)
- `frontend/scripts/verify-product-images.mjs` (new)
- `PRODUCT-IMAGES-V1.md` (new)

Local uploads and `.tmp` verification artifacts are ignored. No user passwords, image binaries, or environment secrets were added to tracked source.
