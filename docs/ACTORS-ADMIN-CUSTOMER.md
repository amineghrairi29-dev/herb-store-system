# ADMIN / CUSTOMER actor model

ADMIN is the shop owner and the only supported internal operator role. Every back-office permission requires ADMIN: products, categories, stock, suppliers, purchases/payments, sales/payments, caisse, expenses, finance, reports, online orders, settings, audit and users.

CUSTOMER remains a separate public-shop identity with the existing Customer records, customer cookie, session service and checkout flow. It is not a role in the internal User table. Customer cookies, including a customer token renamed as an internal cookie, cannot authenticate back-office requests.

## Authorization

- Internal login and session lookup reject any role other than ADMIN. The global guard continues to enforce the centralized permission policy, trusted Origin and session expiration.
- Internal navigation and API response parsing accept ADMIN only. All owner modules remain visible and accessible. The dashboard now has one complete owner response, with the same underlying calculations.
- User creation/update accepts ADMIN only. The form has only Administrateur. Existing self-deactivation, last-active-admin and password/session protections remain.
- Historical audit role snapshots remain readable and are marked historical when they are not ADMIN. They never authorize access. Historical migrations and snapshots are immutable and were not rewritten. Obsolete role strings remain only as negative-test inputs and immutable history, not supported roles or account fixtures.

## Migration and retained data

The active schema source is `backend/src/prisma/contract.prisma`, configured by `backend/prisma.config.ts`. `backend/prisma/schema.prisma` is an unused generator/datasource stub; no second schema flow was introduced.

Migration: `backend/migrations/app/20260913T1807_admin_only_roles`.

The supported migration transaction drops the old role check, revokes internal sessions belonging to non-ADMIN users, updates those users to `role = ADMIN, isActive = false`, then installs `CHECK (role = 'ADMIN')`. User IDs, names, email addresses, password hashes and historical references are retained. Original ADMIN rows and their sessions are untouched. No users or business records are deleted. Customer records and sessions are untouched.

This migration has been applied locally. The original ADMIN (ID 39) remains active and unchanged. The two obsolete-role records (IDs 40 and 41) remain as inactive ADMIN records. They cannot log in; explicitly activating one would grant owner-level access, so do so only if intended.

For another environment, stop old application writers, deploy the updated artifacts and use the existing supported commands from `backend`:

```powershell
.\node_modules\.bin\prisma.cmd db migrate --show
.\node_modules\.bin\prisma.cmd db migrate --advance-ref db
.\node_modules\.bin\prisma.cmd migration status
```

Restart the updated application after migration. Do not run the obsolete application against the new role model. Migration status locally is up to date.

## Validation

- Backend build: passed. Unit suite: **304 passed**, 28 files, including unsupported-role login/session rejection and the internal permission matrix.
- Auth/customer-auth/category/image/settings/audit/dashboard integration suites: **89 passed, 1 skipped**, 7 files. The skipped last-admin concurrency scenario refuses to rearrange real active administrators; no manual account was changed to force that test.
- Dashboard integration rerun after removing the obsolete response branch: **9 passed**. Exact finance/stock totals and the bounded query checks passed.
- ADMIN HTTP access passed for every internal module. Actual customer cookies and renamed customer cookies were denied. Invalid roles were rejected by user validation and login/session checks.
- Frontend lint and production build: passed. `node scripts/verify-admin-policy.mjs`: passed for all navigation gates, unsupported actors, ADMIN-only choices and historical audit labels.
- `node scripts/verify-auth.mjs`: passed against the updated local servers, including ADMIN navigation, user create/edit/password reset, expiration/logout, anonymous denial, public shop, UTF-8 and mobile. No hydration/runtime exceptions. Screenshots are in ignored `.tmp/auth-validation-1789323736965`.
- All updated browser scripts pass Node syntax checks; the other browser harnesses were updated but not rerun in full.
- Before/after hashes confirmed the original ADMIN and all pre-existing business/customer rows were unchanged. Browser checks used disposable users, removed them afterward and retained their ordinary security audit events. No original audit history was modified or deleted. Disposable tests may advance identity sequences.
- Backend lint reports one pre-existing warning in `test/stock-movements.e2e-spec.ts:83` (`no-unsafe-finally`). Prisma reports a stale generated skills advisory. Neither blocks the builds or migration. A browser launch was blocked by sandbox GPU restrictions; the isolated browser rerun outside the sandbox passed.

Review: `http://localhost:3000/login` for the owner, `http://localhost:3000/shop/auth` for customers. Customer-only navigation to an internal page redirects to internal login; protected API requests return 401. Public HTML route availability is not authorization: internal data is gated by the API and loaded only after internal authentication.

## Files created or modified

Backend authorization and dashboard:

- `backend/src/auth/auth-policy.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/auth-policy.spec.ts`
- `backend/src/auth/auth.service.spec.ts` (new)
- `backend/src/audit/audit-values.ts`
- `backend/src/audit/audit.spec.ts`
- `backend/src/categories/category-validation.spec.ts`
- `backend/src/dashboard/dashboard.service.ts`
- `backend/src/dashboard/dashboard.dto.ts`
- `backend/src/dashboard/dashboard-finance.ts`
- `backend/src/dashboard/dashboard-activity.ts`
- `backend/src/dashboard/dashboard.spec.ts`

Schema and generated migration artifacts:

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/migrations/app/20260913T1807_admin_only_roles/migration.ts` (new)
- `backend/migrations/app/20260913T1807_admin_only_roles/migration.json` (new)
- `backend/migrations/app/20260913T1807_admin_only_roles/ops.json` (new)
- `backend/migrations/app/refs/db.json`
- `backend/migrations/snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract.json` (new)
- `backend/migrations/snapshots/8ab10b36394f541c76375e840ed7008106b1ea340786b4675e97efc3fae45c7a/contract.d.ts` (new)

Integration tests:

- `backend/test/auth.e2e-spec.ts`
- `backend/test/customer-auth.e2e-spec.ts`
- `backend/test/categories.e2e-spec.ts`
- `backend/test/product-images.e2e-spec.ts`
- `backend/test/store-settings.e2e-spec.ts`
- `backend/test/audit.e2e-spec.ts`
- `backend/test/dashboard.e2e-spec.ts`

Frontend:

- `frontend/src/lib/auth.ts`
- `frontend/src/components/auth-link.tsx`
- `frontend/src/app/users/user-form.tsx`
- `frontend/src/app/dashboard.tsx`
- `frontend/src/types/dashboard.ts`
- `frontend/src/types/audit.ts`
- `frontend/src/app/audit/page.tsx`
- `frontend/src/app/audit/[id]/page.tsx`
- `frontend/scripts/verify-admin-policy.mjs` (new)
- `frontend/scripts/verify-auth.mjs`
- `frontend/scripts/verify-audit.mjs`
- `frontend/scripts/verify-categories.mjs`
- `frontend/scripts/verify-dashboard.mjs`
- `frontend/scripts/verify-final-qa.mjs`
- `frontend/scripts/verify-product-images.mjs`
- `frontend/scripts/verify-security.mjs`
- `frontend/scripts/verify-store-settings.mjs`

Documentation:

- `ACTORS-ADMIN-CUSTOMER.md` (new)
- `AUTHENTICATION-V1.md`
- `AUDIT-V1.md`
- `CATEGORY-MANAGEMENT-V1.md`
- `DEPLOYMENT-PRODUCTION-V1.md`
- `FINAL-QA-V1.md`
- `GENERAL-DASHBOARD-V1.md`
- `PRODUCT-IMAGES-V1.md`
- `SECURITY-BACKUP-V1.md`
- `STORE-SETTINGS-V1.md`

Ignored `.tmp` contains local edit helpers, hash snapshots and browser artifacts only; no generated password was committed or added to application configuration or documentation.
