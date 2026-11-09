# Store Settings V1

Store Settings is available at `http://localhost:3000/settings/store` for ADMIN. It manages business display information only. No existing business records, financial formulas, account credentials or stock rules were changed.

## Model, singleton and migration

`StoreSettings` contains `id`, `storeName`, `phone`, `secondaryPhone`, `email`, `address`, `city`, `country`, `website`, `currency`, `reportFooter`, `createdAt` and `updatedAt`.

The singleton uses primary key `id = 1`, with a database CHECK that rejects every other ID. The primary key prevents duplicate rows even under concurrent initial saves. There is no create-profile or delete API. Currency is constrained to TND in the database and validator. Store name is required and limited to 160 characters.

Reads do not initialize or write a row. If absent, they return `Herb Store`, TND, null optional fields and null timestamps. The first explicit save atomically inserts the row; subsequent saves use PostgreSQL `INSERT ... ON CONFLICT (id) DO UPDATE`. Only supplied fields are updated, so concurrent partial updates of distinct fields do not overwrite each other. Repeated reads and initialization attempts cannot create duplicates.

Migration workflow completed:

1. Edited the authoritative `backend/src/prisma/contract.prisma`.
2. Ran `npm.cmd run contract:emit`.
3. Ran `npm.cmd exec -- prisma migration plan --name store_settings_v1`.
4. Ran `npm.cmd exec -- prisma db update --dry-run` against the local database and reviewed generated SQL/operations.
5. Applied with `npm.cmd exec -- prisma db migrate --advance-ref db`.

The reviewed plan contained exactly one additive CREATE TABLE operation. No business table was altered, deleted or backfilled. Migration: `20260908T1113_store_settings_v1`; new contract hash: `6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2`. The generated migration getter needed the same explicit return type used in existing migrations for declaration type-checking; self-emission preserved its operation hash `cd8484e4dd59b43de3281403d414ae7181f2eb61d715e758c902682bf19b70af`.

No default row or invented contact details were left in the local database. Your first manual save will create the singleton.

## APIs and authorization

| Endpoint | Access | Response/use |
| --- | --- | --- |
| GET `/settings/store` | ADMIN only | Full singleton or defaults |
| PATCH `/settings/store` | ADMIN only | Atomic update, returning saved settings |
| GET `/public/store-info` | Public, read-only | Exactly `{ "storeName": "Herb Store" }`, using configured name when present |
| GET `/reports/store-info/identity` | ADMIN via existing REPORTS permission | Only storeName, phone, email, address, city, reportFooter |

Unauthenticated direct settings access returns 401. Customer-only sessions also return 401; unsupported internal roles never grant access. Writes require the existing exact trusted origin and session cookie. Unsupported methods have no route. Public info has no internal fields, timestamps, contact information or report footer. Responses use no-store caching.

PATCH accepts only the display fields and `currency: "TND"`; unknown fields, IDs and secrets are rejected. Required fields cannot be cleared when supplied. Optional empty/whitespace strings become null; omitted fields are preserved. Email is validated if provided. Website accepts only absolute HTTP/HTTPS URLs without embedded credentials. Length limits are: storeName 160, phone/secondaryPhone 40, email 254, address 500, city/country 100, website 500, reportFooter 1000. JSON and database text support Arabic/French UTF-8.

## Frontend and report integration

The ADMIN navigation includes “Paramètres”. The page has Informations générales, Adresse, Paramètres commerciaux and Rapports sections. TND is read-only. Saves occur only after pressing “Enregistrer les modifications”; controls are disabled while saving. Loading, load retry, validation, save error and success states are included. Customer-only sessions cannot access settings or internal navigation.

The shared StoreName component loads the public-safe name in the back-office header and public shop header, with `Herb Store` as fallback. A successful settings save refreshes the current back-office branding.

All existing report kinds share the updated ReportContent component. Screen reports and Imprimer / PDF output show store name and available phone/address/city/email; reportFooter appears after report content when supplied. Print preparation fetches fresh report identity before printing. If identity cannot load, it falls back to `Herb Store` without invented contact information. Financial calculations, report rows and CSV structure are unchanged.

## Files created

- `backend/src/settings/store-settings.values.ts`
- `backend/src/settings/store-settings.service.ts`
- `backend/src/settings/store-settings.controller.ts`
- `backend/src/settings/store-settings.module.ts`
- `backend/src/settings/store-settings.spec.ts`
- `backend/test/store-settings.e2e-spec.ts`
- `backend/migrations/app/20260908T1113_store_settings_v1/migration.ts`
- `backend/migrations/app/20260908T1113_store_settings_v1/migration.json`
- `backend/migrations/app/20260908T1113_store_settings_v1/ops.json`
- `backend/migrations/snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract.json`
- `backend/migrations/snapshots/6c64809fedb14213cae9cb7c8a607943a10ae3644cc92deb0b21d96d68d516f2/contract.d.ts`
- `frontend/src/types/store-settings.ts`
- `frontend/src/components/store-name.tsx`
- `frontend/src/app/settings/store/page.tsx`
- `frontend/scripts/verify-store-settings.mjs`
- `STORE-SETTINGS-V1.md`

## Files modified

- `backend/src/prisma/contract.prisma`: singleton model and checks.
- `backend/src/prisma/contract.json`: generated contract.
- `backend/src/prisma/contract.d.ts`: generated types.
- `backend/migrations/app/refs/db.json`: applied contract reference.
- `backend/src/app.module.ts`: register settings module.
- `frontend/src/lib/auth.ts`: deny non-admin settings routes.
- `frontend/src/components/auth-provider.tsx`: ADMIN navigation and store branding.
- `frontend/src/app/shop/layout.tsx`: public store branding.
- `frontend/src/app/reports/report-page.tsx`: load identity for screen/print.
- `frontend/src/app/reports/report-content.tsx`: shared identity header and optional footer.

## Validation

- Backend build: passed.
- Backend full TypeScript check: passed after correcting the generated getter type.
- Backend units: 228 passed across 21 files.
- Backend integrations: 132 passed, 1 skipped across 19 files, including eight settings integration cases. The existing last-admin concurrency test skips because retained active admins exist; your manual ADMIN was not altered to force that test.
- Backend lint: passed with the pre-existing `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:81`.
- Frontend lint and production build: passed; final browser script lint also passed.
- `/settings/store` returns HTTP 200 for the frontend shell; auth/role checks then control page access.
- PATCH CORS preflight: HTTP 204 with localhost:3000, credentials, PATCH and Content-Type allowed.
- Browser tests passed for real authentication for each role, ADMIN-only navigation, direct unauthorized access, no auto-save, save loading/success/error, load retry, refresh, Arabic/French, report screen/print identity/footer, and public branding/fallback.
- Layout checks passed at 1440px, 768px and 390px without horizontal overflow. Mobile screenshot inspected. No hydration errors reported.

Settings integration tests use an isolated PostgreSQL table copied with all real singleton/default/check constraints; they exercise the actual service SQL, API and guard while redirecting only the settings table reference. Tests cover empty defaults, repeated reads, concurrent upserts, persistence, optional clearing, database constraints, public whitelists and report permissions. Existing Finance/Caisse summaries and all business/account/settings rows are compared before and after cleanup.

Browser save responses are deliberately simulated; real persistence is verified by the isolated integration tests. Browser authentication uses disposable users, removed afterward. Your retained manual accounts and real singleton are unchanged. Screenshots: `.tmp/settings-validation-1788893483050/`. One initial browser run encountered a login connection failure; the complete rerun passed. No application workaround was added.

## Exact manual test

1. Keep the backend running at localhost:3001 and frontend at localhost:3000. Log in at `http://localhost:3000/login` as `admin@test.local` with the password previously supplied.
2. Select Paramètres or open `http://localhost:3000/settings/store`. With no saved row, expect Herb Store, TND and empty optional fields.
3. Enter store name `Herboristerie Test`, phone `22111222`, city `Tunis`, country `Tunisie`. Optionally add Arabic text to the name/address/footer. Use only test contact data, not invented legal details.
4. Before pressing save, verify no PATCH is sent. Press Enregistrer les modifications; expect Enregistrement..., disabled controls and then a success message.
5. Refresh the page and verify values persist. Check the back-office header and open `/shop` in a signed-out tab to verify the configured name. The public API response must contain only storeName.
6. Open `/reports/sales`, verify the store identity, then select Imprimer / PDF and inspect the header/footer. Existing report totals must remain unchanged.
7. Clear the store name or enter an invalid email and verify validation. In browser Network tools, block `/settings/store`, reload and verify load error; unblock and select Réessayer. A failed save must retain entered values and show an error.
8. As ADMIN, verify settings and report identity remain available.
9. With only a customer session, settings and report identity APIs return 401; public `/shop` remains available.
10. Restore your preferred display values using the ADMIN page when finished. These manual saves intentionally persist; automated checks did not leave sample settings behind.

## Limitations and warnings

Settings changes made after Audit V1 are recorded as STORE_SETTINGS_UPDATE with actor snapshots and field names; see [AUDIT-V1.md](AUDIT-V1.md). This is one store, TND only, with no taxes, delivery, gateways, secrets, notifications or themes. Concurrent edits to the same field use last-writer-wins behavior. Branding is refreshed after saving in the same page or after reload in other tabs; there is no live cross-tab synchronization. Shop metadata titles remain static. CSV exports retain their existing data-only structure; the configured identity/footer applies to screen and print/PDF reports, with the footer at the end rather than repeated on every printed page.

Prisma's existing “skills out of date” diagnostic and Vite's existing tsconfig-paths plugin notice remain. No packages were added. No remaining settings implementation blocker.
