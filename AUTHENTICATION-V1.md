# Authentication + Users + Roles + Permissions V1

## Implementation

All registered back-office APIs now use a global, default-deny Nest guard. Public storefront controllers are explicitly marked public. Existing stock, sale, purchase, payment, cash, report and order service business rules were not changed.

The browser uses an opaque, revocable database session in an HttpOnly cookie. No JWT or authentication token is returned in JSON or stored in localStorage. A centralized AuthProvider loads `/auth/me`, supplies current user/loading/logout, handles session expiry, and gates protected page contents. Backend authorization is mandatory regardless of frontend navigation. Protected API responses use `Cache-Control: no-store`.

## User and session schema

`User`: id, unique normalized lowercase email, passwordHash, fullName, role, isActive (default true), lastLoginAt, createdAt, updatedAt. The database constrains role to ADMIN and requires normalized email. CUSTOMER uses its existing separate records and sessions.

`AuthSession`: id, unique tokenHash, userId foreign key, expiresAt and createdAt. User and expiration indexes support session lookup/revocation. Deleting an explicitly disposable test user cascades its sessions; there is no user-deletion API.

Migration `20260907T1843_authentication_v1` was emitted, dry-run reviewed and applied. Seven additive operations create the two tables with checks, two unique constraints, two indexes and one foreign key. Existing business tables/rows were not changed. Contract hash: `359c94795da585d29f878c1440c6c6504a5391b55fb6e2f0b6427a32e12ebd4a`.

## Passwords and sessions

- Password hashing: `bcryptjs`, cost 12, library-generated salt. No custom password hashing. Minimum 8 Unicode characters, at least one Unicode letter and one ASCII digit. Inputs exceeding 72 UTF-8 bytes are rejected to prevent bcrypt truncation, including long Arabic passwords.
- Unknown email, wrong password and inactive account return the same 401 message. Unknown accounts still run bcrypt comparison against a dummy hash. Successful login updates lastLoginAt.
- Session identifier: 32 cryptographically random bytes; only its SHA-256 digest is stored in the database. This digest is for a random session identifier, not password hashing.
- Cookie: HttpOnly, SameSite=Lax, Path=/, no Domain attribute. Production uses Secure and the `__Host-herb_session` name; local HTTP uses `herb_session`. Default absolute lifetime is 8 hours, configurable from 0.05 through 168 hours with `AUTH_SESSION_HOURS`.
- Every protected request checks session expiration and the user's current active status and role. Logout deletes the session and expires the cookie. Re-login rotates the browser's previous session. Password resets and active-state changes revoke all sessions for that user.
- Unsafe cookie-authenticated requests, including login/logout, require the exact configured Origin. Missing, null or foreign origins receive 403. SameSite is supplementary protection; this Origin check is the CSRF boundary. Public customer order/cart requests retain their existing public behavior.
- Login throttling: `express-rate-limit`, 10 failed requests per IP per 15 minutes, standard rate-limit headers, generic 429. Successful attempts do not count.
- No session signing secret is needed for this opaque database-backed strategy. DATABASE_URL and initial credentials remain outside source control. Root `.gitignore` excludes local browser profiles and env credentials.

Design references: [OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html), [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html), [express-rate-limit configuration](https://express-rate-limit.mintlify.app/reference/configuration). Installed Next.js and Prisma package documentation was also consulted.

## Permission matrix

| Capability | ADMIN | CUSTOMER |
| --- | --- | --- |
| All back-office modules, including settings, audit and user management | Yes | No |
| Public storefront and customer checkout | Separate public/customer flow | Yes |

Internal permissions are centralized in `auth-policy.ts` and enforced by the global guard. Every internal permission requires ADMIN. Customer cookies never authenticate internal routes. Automatic stock and cash-ledger operations continue under the existing business rules.

## Endpoints and routes

| Endpoint | Access / behavior |
| --- | --- |
| POST `/auth/login` | Public with trusted Origin and login throttle; returns id/fullName/email/role only |
| POST `/auth/logout` | Trusted Origin; revokes current cookie if present; safe for an already expired session |
| GET `/auth/me` | Authenticated safe current user; otherwise 401 |
| GET `/users` | ADMIN; safe list including active status and last login |
| POST `/users` | ADMIN; email/fullName/role/password/optional isActive |
| GET `/users/:id` | ADMIN; safe details |
| PATCH `/users/:id` | ADMIN; fullName/role/isActive only; email is read-only in V1 |
| PATCH `/users/:id/password` | ADMIN; password only; revokes target sessions |

Missing authentication on protected endpoints returns 401; insufficient permissions return 403. Unknown metadata does not grant even ADMIN access automatically.

Public APIs remain `/public/products`, `/public/products/:id`, `/public/categories`, `/public/cart/validate`, `/public/orders/preview`, `/public/orders`, and `/public/orders/:reference?phone=...`.

Protected modules: products, product stock, stock-movements, suppliers, purchases/payments, sales/payments, cash, expenses, finance, reports, online-orders/conversion and users. The starter backend `/` endpoint is ADMIN-only; its former unauthenticated smoke test now expects 401.

Frontend additions: `/login`, `/users`, `/users/new`, `/users/[id]/edit`. All other back-office routes require a loaded session; logged-out visitors are redirected to login and forbidden roles see an access-denied page. This is a client route boundary around existing static/client-rendered dashboards, with security enforced on the API, rather than an HTTP redirect middleware on every HTML request. Protected business data is fetched only after the boundary allows the page.

Public `/shop` and its catalogue, cart, checkout and success routes remain accessible logged out. Root `/` now redirects to `/products`.

The shared internal header displays name, Administrateur and logout. ADMIN sees every back-office module. Direct navigation and backend requests require an ADMIN session; customer-only sessions cannot enter the back-office.

## Last-admin and self-lockout rules

All user security mutations and bootstrap acquire the same PostgreSQL transaction advisory lock before checking/changing accounts. This serializes concurrent deactivations so two admins cannot both remove the last active admin.

- No logged-in ADMIN can deactivate their own account, even if another active admin exists.
- Role changes to unsupported values are rejected with 400; ADMIN is the only internal role.
- Deactivating the last active ADMIN is rejected with 409.
- Resetting one's own password succeeds and requires signing in again.
- Creating, updating and password-resetting users never returns a password hash.

## Initial admin: exact bootstrap instructions

The migration creates no default account. All validation accounts were removed. Create your own initial admin locally; no credentials are supplied or committed.

From PowerShell:

```powershell
cd C:\herb-store-system\backend
npm.cmd run build
$env:ADMIN_EMAIL = Read-Host 'Initial admin email'
$env:ADMIN_NAME = Read-Host 'Initial admin full name'
$initialAdminPassword = Read-Host 'Password (8+ characters, letter and digit)' -AsSecureString
$env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $initialAdminPassword).Password
try {
  npm.cmd run auth:bootstrap
} finally {
  Remove-Item Env:ADMIN_PASSWORD, Env:ADMIN_EMAIL, Env:ADMIN_NAME
  $initialAdminPassword.Dispose()
}
```

The command is idempotent and serialized: if the email already exists, it does not modify it. If any active ADMIN already exists, it does not create another initial admin. Otherwise it creates one active ADMIN. It never overwrites passwords or silently elevates an existing account. Subsequent users are created through `/users` by an admin.

## Local and production configuration

Backend `.env.example` now documents `FRONTEND_ORIGIN=http://localhost:3000` and `AUTH_SESSION_HOURS=8`. Existing credentialed CORS remains enabled for the exact origin, normal methods, Content-Type and Authorization. Frontend private request helpers use `credentials: include`; cookie login and preflight were verified between ports 3000/3001.

`NEXT_PUBLIC_API_URL` optionally sets the frontend API base; default is `http://localhost:3001`. Production requires NODE_ENV=production, HTTPS and an exact HTTPS FRONTEND_ORIGIN. Deploy frontend/API under the same site (for example app.example.com and api.example.com) for SameSite=Lax compatibility. Unrelated cross-site hosting is not supported by this V1 cookie configuration.

Do not enable broad proxy trust. If deploying behind a reverse proxy, configure known trusted proxies deliberately so the per-IP limiter uses the correct client address. The limiter is process-local; shared rate-limit storage is deferred for multi-instance deployment. Session data itself is durable/shared in PostgreSQL. Expired rows are ignored immediately and cleaned for a user during subsequent login; a scheduled global prune is future maintenance.

## Validation

- Backend production build: passed.
- Backend full TypeScript no-emit check: passed, including new tests.
- Backend lint: passed with the pre-existing stock test `no-unsafe-finally` warning at line 81.
- Backend unit suite: 205 passed across 19 files.
- Final full sequential database integration suite: 115 passed across 17 files, including all 26 auth/RBAC cases. The existing 89 regression cases remain unchanged apart from the root endpoint's intentional 401 expectation.
- Frontend lint: passed without warnings after removing an unused browser helper.
- Frontend production build: passed, including all four new frontend routes.
- Current ADMIN/customer authorization validation is documented in [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Disposable fixture integration covers ADMIN user sale create/edit/confirm/payment and public order submission plus ADMIN user confirmation/cancellation/conversion. Existing full business regression suites passed. Snapshot comparisons after cleanup verify existing business rows and accounts/sessions unchanged.
- Last-admin concurrency ran with fixture-only admins and passed. The test intentionally skips that database arrangement if real active admins exist; it never deactivates real admins to arrange a test.

Validation fixes: the first browser run submitted a fresh form before hydration and timed out; the form now disables submit until initial session loading completes, and the test waits for readiness. A first integration cleanup attempt encountered the existing SalePayment→CashMovement restriction (bank-transfer payments also have ledger rows); cleanup was corrected to remove the fixture ledger rows first. That run's exact UUID records were removed before rerunning; final cleanup/snapshot checks passed.

Screenshots and audit output are local, ignored artifacts under `.tmp/`. Final browser run: `.tmp/auth-validation-1788821136563/`. The script is `frontend/scripts/verify-auth.mjs`; it requires both app servers and an isolated Chrome debugger on port 9223. It generates random passwords in memory, creates only UUID-owned users, removes them and their sessions, and closes the isolated browser. Run it sequentially with database integration tests to avoid overlapping full-table snapshots. No test credentials remain available for login.

### Reproduce automated checks

```powershell
cd C:\herb-store-system\backend
npm.cmd run build
npm.cmd exec tsc -- --noEmit
npm.cmd run lint
npm.cmd test
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e -- --no-file-parallelism --testTimeout=20000

cd C:\herb-store-system\frontend
npm.cmd run lint
npm.cmd run build
# With both servers and a separate Chrome debugger on port 9223:
node scripts/verify-auth.mjs
```

## Exact manual verification

1. Bootstrap your initial admin as above. Run backend `npm.cmd run start:dev` on 3001 and frontend `npm.cmd run dev` on 3000 in separate terminals.
2. Logged out, open `http://localhost:3000/products`: expect login. Open `/shop`: expect public catalogue. Direct GET `http://localhost:3001/products` must return 401.
3. On `/login`, try an incorrect password: expect the generic error. Sign in with your admin: expect the header name, Administrateur and Utilisateurs link. Refresh: the session persists.
4. Open `/users/new`. Only Administrateur is available. Use a disposable ADMIN account only when testing user management; never repurpose an existing account.
5. Edit the disposable ADMIN user's name/status and use its separate password form. Verify invalid roles/passwords are rejected and password changes require that user's next login. Keep at least one real active admin; test self-deactivation to see the explicit rejection.
6. Log out. Verify `/products` returns to login and a previous browser tab cannot use protected API data after logout.
7. As ADMIN, open every internal module, including users, audit, settings and reports.
8. With only a customer session, try internal pages and APIs. Pages redirect to internal login; APIs return 401.
9. Use a disposable product with test stock to create a Sale as ADMIN, edit its draft, confirm and record a customer payment. Existing stock and payment validations still apply. Do not use real stock/funds for verification.
10. Submit a disposable online order publicly from `/shop`. As ADMIN, read it, confirm and convert it to a draft Sale. A separate PENDING disposable order can be cancelled. Conversion remains stock-neutral; only Sale confirmation deducts stock.
11. As ADMIN, deactivate the disposable ADMIN user or reset its password while it is logged in elsewhere. Its next API request returns 401; the frontend clears session state on that response or refresh. Only ADMIN is accepted; invalid role updates must be rejected.
12. On a 390px-wide viewport verify login form, wrapping navigation and user forms. Use French and Arabic names. Log out and confirm public shop/cart/checkout still work.
13. Deactivate manually created disposable accounts when finished. There is intentionally no delete-user API; automated test accounts are removed directly by the fixture harness only.

For an authenticated HTTP client outside the browser, send the login response cookie and `Origin: http://localhost:3000` on unsafe requests. A typed navigation cannot test a POST endpoint. Never put credentials in URLs or share cookies.

## Warnings and limitations

- No functional implementation blocker remains; initial admin bootstrap is required before staff can sign in.
- npm installation added `bcryptjs` and `express-rate-limit` (plus their required transitive dependency). npm reported existing peer/install-script advisories and 18 aggregate dependency vulnerabilities. A follow-up production audit found **14 findings: 9 high, 5 moderate**, all in the Prisma-related dependency tree, with `fixAvailable: false`. Neither added authentication library is listed in that audit. Details are saved locally in `.tmp/auth-production-audit.json`. These findings remain unresolved and require dependency review before production deployment; no force upgrade was attempted.
- Existing Prisma skills-sync and Vite tsconfig-path plugin advisories remain.
- No MFA, self-service password recovery, email verification, audit trail, per-record sales ownership, global session administration, purchases/sales business changes or enterprise IAM was added.
- Old standalone browser/API scripts written before authentication now need an authenticated fixture cookie for protected calls. The existing domain-only integration suites remain useful and unchanged; the new auth suite tests the actual global application guard around real domain operations.
- Already in-flight authorized requests may finish while another session deactivates the account; subsequent requests are checked against current state. Frontend session polling is centralized at 60 seconds plus focus/pageshow and immediate 401 handling, not a security boundary.

## Files created/modified

The complete implementation file inventory follows. Broad frontend changes are limited to substituting the shared role-aware Link and authenticated fetch helpers, plus the explicit new auth/user UI and inventory-delete gate.

### Created

- `.gitignore`
- `AUTHENTICATION-V1.md`
- `backend/migrations/app/20260907T1843_authentication_v1/migration.json`
- `backend/migrations/app/20260907T1843_authentication_v1/migration.ts`
- `backend/migrations/app/20260907T1843_authentication_v1/ops.json`
- `backend/migrations/snapshots/359c94795da585d29f878c1440c6c6504a5391b55fb6e2f0b6427a32e12ebd4a/contract.d.ts`
- `backend/migrations/snapshots/359c94795da585d29f878c1440c6c6504a5391b55fb6e2f0b6427a32e12ebd4a/contract.json`
- `backend/src/auth/auth-config.ts`
- `backend/src/auth/auth-policy.spec.ts`
- `backend/src/auth/auth-policy.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.guard.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/bootstrap-admin.ts`
- `backend/src/auth/http-security.ts`
- `backend/src/auth/user-validation.ts`
- `backend/src/auth/users.controller.ts`
- `backend/src/auth/users.service.ts`
- `backend/test/auth.e2e-spec.ts`
- `frontend/scripts/verify-auth.mjs`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/users/[id]/edit/page.tsx`
- `frontend/src/app/users/new/page.tsx`
- `frontend/src/app/users/page.tsx`
- `frontend/src/app/users/user-form.tsx`
- `frontend/src/app/users/user-ui.tsx`
- `frontend/src/components/auth-link.tsx`
- `frontend/src/components/auth-provider.tsx`
- `frontend/src/lib/auth.ts`

### Modified

- `backend/.env.example`
- `backend/migrations/app/refs/db.json`
- `backend/package-lock.json`
- `backend/package.json`
- `backend/src/app.controller.ts`
- `backend/src/app.module.ts`
- `backend/src/cash/cash.controller.ts`
- `backend/src/expenses/expenses.controller.ts`
- `backend/src/finance/finance.controller.ts`
- `backend/src/main.ts`
- `backend/src/online-orders/online-orders.controller.ts`
- `backend/src/online-orders/order-fulfillment.controller.ts`
- `backend/src/prisma/contract.d.ts`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.prisma`
- `backend/src/products/products.controller.ts`
- `backend/src/public-catalogue/public-cart.controller.ts`
- `backend/src/public-catalogue/public-catalogue.controller.ts`
- `backend/src/purchases/purchases.controller.ts`
- `backend/src/reports/reports.controller.ts`
- `backend/src/sales/sales.controller.ts`
- `backend/src/stock-movements/stock-movements.controller.ts`
- `backend/src/suppliers/suppliers.controller.ts`
- `backend/test/app.e2e-spec.ts`
- `frontend/src/app/cash/cash-dashboard.tsx`
- `frontend/src/app/cash/cash-ui.tsx`
- `frontend/src/app/cash/manual-form.tsx`
- `frontend/src/app/cash/movements-table.tsx`
- `frontend/src/app/cash/movements/page.tsx`
- `frontend/src/app/cash/page.tsx`
- `frontend/src/app/expenses/expense-form.tsx`
- `frontend/src/app/expenses/expense-record.tsx`
- `frontend/src/app/expenses/expense-ui.tsx`
- `frontend/src/app/expenses/expenses-table.tsx`
- `frontend/src/app/expenses/page.tsx`
- `frontend/src/app/finance/page.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/online-orders/layout.tsx`
- `frontend/src/app/online-orders/order-api.ts`
- `frontend/src/app/online-orders/order-fulfillment.tsx`
- `frontend/src/app/online-orders/order-list.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/products/[id]/edit/edit-product.tsx`
- `frontend/src/app/products/delete-product-dialog.tsx`
- `frontend/src/app/products/page.tsx`
- `frontend/src/app/products/product-form.tsx`
- `frontend/src/app/products/products-table.tsx`
- `frontend/src/app/purchases/page.tsx`
- `frontend/src/app/purchases/payment-form.tsx`
- `frontend/src/app/purchases/purchase-details.tsx`
- `frontend/src/app/purchases/purchase-form.tsx`
- `frontend/src/app/purchases/purchase-payments.tsx`
- `frontend/src/app/purchases/purchase-ui.tsx`
- `frontend/src/app/purchases/purchases-table.tsx`
- `frontend/src/app/reports/page.tsx`
- `frontend/src/app/reports/report-page.tsx`
- `frontend/src/app/sales/page.tsx`
- `frontend/src/app/sales/payment-form.tsx`
- `frontend/src/app/sales/sale-details.tsx`
- `frontend/src/app/sales/sale-form.tsx`
- `frontend/src/app/sales/sale-payments.tsx`
- `frontend/src/app/sales/sale-ui.tsx`
- `frontend/src/app/sales/sales-table.tsx`
- `frontend/src/app/stock/movement-form.tsx`
- `frontend/src/app/stock/movement-history.tsx`
- `frontend/src/app/stock/movements/page.tsx`
- `frontend/src/app/stock/page.tsx`
- `frontend/src/app/stock/products/[id]/page.tsx`
- `frontend/src/app/stock/products/[id]/stock-details.tsx`
- `frontend/src/app/stock/stock-table.tsx`
- `frontend/src/app/stock/stock-ui.tsx`
- `frontend/src/app/suppliers/page.tsx`
- `frontend/src/app/suppliers/supplier-form.tsx`
- `frontend/src/app/suppliers/suppliers-table.tsx`
- `frontend/src/lib/purchase-api.ts`
- `frontend/src/lib/stock-api.ts`
- `frontend/src/lib/supplier-api.ts`
