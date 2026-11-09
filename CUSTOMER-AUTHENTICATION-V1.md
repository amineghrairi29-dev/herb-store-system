# Customer Authentication V1

Public browsing and cart editing remain available without an account. Checkout now checks a separate customer session, and `POST /public/orders` enforces that session on the backend. No back-office roles, pricing, stock calculations, order conversion or payment rules were changed.

## Identity and migration

The Prisma 8 contract adds `Customer` (normalized unique email, nullable bcrypt password hash, optional name/phone, unique nullable Google subject, active flag and timestamps) and `CustomerSession` (unique hashed opaque token, customer foreign key, expiration and creation timestamps). There is no customer role field.

`OnlineOrder.customerId` is nullable with an indexed, restrictive foreign key. Existing orders retain null and all existing contact snapshots. New public orders obtain the ID from the server-side session guard; a `customerId` submitted in JSON is rejected by the existing input whitelist. Contact, product, price and total snapshots remain independent of the customer profile.

Applied migration: `backend/migrations/app/20260910T1817_customer_auth_v1/`. Its 11 operations are additive. Contract hash: `cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14`.

Supported workflow used, from `backend`:

```powershell
npx prisma contract emit
npx prisma migration plan --name customer-auth-v1
npx prisma db migrate --show
npx prisma db migrate --advance-ref db
```

The installed Prisma version does not support `db migrate --dry-run`; its read-only preview is `--show`. No reset or data transform was used. Hash comparisons of all 17 existing public tables matched before/after migration and after fixture cleanup (excluding the new nullable column from the comparison). Sequence values can advance during disposable tests; existing rows are unchanged.

## Password and session behavior

- Registration requires email/password; name and phone are optional. Passwords require eight characters, a letter and a number, with a 72-byte bcrypt limit. Bcrypt cost is 12, matching staff authentication.
- Registration automatically creates a session. Login normalizes the email and returns a generic error for missing, incorrect, Google-only or inactive credentials.
- Safe responses contain only `id`, `email`, `fullName`, `phone`.
- Customer cookies are `herb_customer` locally and `__Host-herb_customer` in production, separate from staff cookies and session tables. Tokens contain 32 random bytes; only domain-separated hashes are stored, using the existing AUTH_SECRET architecture. Production still requires a strong AUTH_SECRET.
- Cookies use HttpOnly, SameSite=Lax, Path=/ and Secure in production. Lifetime follows `AUTH_SESSION_HOURS` (eight hours by default). Login rotates the presented customer session. Logout revokes it; inactive accounts and expired sessions are rejected on each authenticated request.
- Exact trusted Origin is required for unsafe customer-auth and order requests, using the existing global security guard. Strict credentialed CORS remains unchanged. Customer registration/login/Google routes share a separate 30-request/15-minute/IP limit. No credentials or provider tokens are logged or audited.
- Cart localStorage remains independent. Customer auth tokens never enter localStorage. The deployment topology remains the documented same-site frontend/API arrangement; production HTTPS is required.

## Google architecture and configuration

The official `google-auth-library` is the sole new direct dependency. The backend runs an authorization-code OpenID Connect flow, using PKCE S256, a random state, a nonce and a signed ten-minute HttpOnly flow cookie. The callback consumes Google's single-use code, verifies the signed ID token server-side (signature, audience, issuer, expiration, nonce and verified email), then creates a customer session. Errors redirect to a safe auth-gate message without exposing provider responses.

Local Google configuration is **absent**: `/public/auth/config` returns `googleEnabled: false`, and the UI hides the Google option. Email/password remains fully functional. Live Google consent was not tested with a real provider account.

Supply these only in the backend's ignored local `.env` or deployment secrets:

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/public/auth/google/callback
```

Create a Google OAuth **Web application** and register that exact redirect URI. For the existing production reverse-proxy layout, use `https://YOUR-SHOP/api/public/auth/google/callback` instead and register it with Google. All three settings are needed. Restart the backend after configuring them. No frontend secret or Google SDK configuration is needed.

Account linking uses the Google subject as the stable identifier and unique email constraints to prevent duplicates. A matching local account links automatically only when Google is authoritative for the verified address (Gmail or verified Workspace domain). Third-party email matches are rejected and must use email/password. Inactive accounts and conflicting subjects are rejected.

**V1 linking tradeoff:** local registration does not verify ownership of the email address. To prevent a pre-registered attacker retaining access, authoritative Google linking revokes that customer's previous sessions and removes the unverified local password. That account subsequently signs in through Google. This does not modify any staff account. A future dual-proof linking/password-recovery flow can allow both credentials to coexist safely.

Provider reference: [Google server-side ID-token verification and email authority](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). The implementation also uses the installed official Node client’s verification/code-exchange APIs.

## Frontend flow

`CustomerAuthProvider` is independent of the staff AuthProvider. It exposes customer/loading/error/refresh/logout and deduplicates concurrent session checks. Session checks start only on the auth/checkout routes, with refresh on window focus; ordinary browsing has no session requirement.

The existing cart link still goes to `/shop/checkout`. Checkout gates visitors at `/shop/auth?returnTo=/shop/checkout` before mounting the order form. Successful login, registration or Google login returns to checkout. Authenticated customers proceed directly to the form. A server-side 401 on order submission returns to the gate while preserving the cart. The cart clears only through the existing successful-order handler.

Return destinations use the same explicit allowlist on frontend and backend: `/shop`, `/shop/checkout`, `/shop/cart`, `/shop/catalogue`. External, encoded, traversal, query-bearing and unknown targets fall back to `/shop`.

Checkout preloads email/name/phone and permits completing or correcting contact snapshots. A subtle checkout-only logout action is provided. The public header is unchanged; no dominant login link, account dashboard, profile editor or order history was added.

## Endpoint matrix

| Endpoint | Access |
| --- | --- |
| Public products, categories and store-info GET | Visitor |
| Public cart validation and order preview POST | Visitor; existing validation retained |
| GET `/public/orders/:reference?phone=...` | Existing public tracking fallback |
| POST `/public/auth/register`, `/login`, `/logout` | Public entry points; exact Origin required |
| GET `/public/auth/config`, `/google/start`, `/google/callback` | Public; signed state/PKCE protect Google callback |
| GET `/public/auth/me` | Customer session; otherwise 401 |
| POST `/public/orders` | Customer session and trusted Origin; otherwise rejected |
| Back-office APIs including `/auth/me` | Existing staff session/role rules; customer cookies rejected |

## Validation

- Backend build passed; backend lint completed with one pre-existing `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts`.
- Frontend lint and production build passed; `/shop/auth` is included in the production routes.
- All 280 unit tests passed, including real RSA-signed token checks through Google's verifier with test certificates. Invalid signatures, audience, issuer, expiration, nonce, email verification, state tampering/expiry and redirect attacks are covered.
- Full integration run: 156 passed, one skipped, one initial failure from an incorrect test URL. After correcting real finance/report/audit endpoint paths, the customer integration suite passed all six scenarios. The remaining 151 existing integration tests had already passed; the existing skip remains.
- Customer integration tests cover normalized registration, duplicates, weak passwords, safe responses, login errors, inactive accounts, rotation/logout, CSRF, visitor order denial, authenticated order linking, spoofed customer ID rejection, historical snapshots, public tracking/cart/catalogue, every staff domain's denial, renamed-cookie denial, staff authentication independence, and safe Google creation/linking.
- Credentialed POST preflight returned 204 with exact `http://localhost:3000` origin and credentials enabled.
- Real browser registration/login/checkout/order flow passed with UUID-owned fixtures; cart persisted through authentication and cleared after successful creation. Logout, safe-return fallback, contact prefill, HttpOnly behavior and back-office denial passed.
- Auth screenshots checked at 1920, 1440, 1024, 768 and 390px; no horizontal overflow, hydration issues or runtime/console errors. Results/screenshots: `.tmp/customer-auth-1789065122902/`.
- Fixtures were removed after validation. No existing customer/staff/business rows were changed. Production dependency audit reports zero vulnerabilities. The full dependency install reports 18 development-tree findings plus peer/install-script advisories; no forced dependency upgrades were attempted.

## Manual verification

1. Open **http://localhost:3000/shop** in a fresh/private browser. Browse catalogue, search/filter, open a product and add it to the cart without logging in.
2. Open `/shop/cart`; change quantities if desired, then choose **Passer la commande**. Expect `/shop/auth?returnTo=/shop/checkout`.
3. Choose **Créer un compte**. Enter an unused email, a password meeting the policy, and optionally name/phone. Submit. Expect automatic login and checkout with the same cart and prefilled details.
4. Complete required name/phone, review authoritative totals, then submit. Expect the success page and an empty cart. This manual action creates a real pending order; it does not deduct stock.
5. Open `/shop/checkout`, choose **Se déconnecter**, then sign in again with the same email/password. Verify the visitor gate and successful continuation.
6. While authenticated only as this customer, open `/users` or another staff page. Expect the staff login gate. In DevTools, a credentialed GET to `http://localhost:3001/users` must return 401.
7. With Google unconfigured, verify the Google button is absent and email login works. Once configured as above, repeat the cart flow with Google and verify checkout continuation. Review the linking tradeoff before using Google on an existing email/password customer.
8. Test `/shop/auth?returnTo=https://example.com` in a logged-out session; after login the destination must be `/shop`.

## Files

Created:

- `backend/src/customer-auth/customer-config.ts`
- `backend/src/customer-auth/customer-auth.service.ts`
- `backend/src/customer-auth/customer.guard.ts`
- `backend/src/customer-auth/google-auth.service.ts`
- `backend/src/customer-auth/customer-auth.controller.ts`
- `backend/src/customer-auth/customer-auth.module.ts`
- `backend/src/customer-auth/google-auth.spec.ts`
- `backend/test/customer-auth.e2e-spec.ts`
- `backend/migrations/app/20260910T1817_customer_auth_v1/migration.ts`
- `backend/migrations/app/20260910T1817_customer_auth_v1/migration.json`
- `backend/migrations/app/20260910T1817_customer_auth_v1/ops.json`
- `backend/migrations/snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract.json`
- `backend/migrations/snapshots/cac356f8d4f132d4fec6cb0546b90fdca1bee3726a1035738483d1bb5ce99e14/contract.d.ts`
- `frontend/src/app/shop/customer-auth-provider.tsx`
- `frontend/src/app/shop/auth/page.tsx`
- `frontend/src/app/shop/auth/customer-auth.tsx`
- `frontend/src/app/shop/checkout/customer-checkout.tsx`
- `frontend/scripts/verify-customer-auth.mjs`
- `CUSTOMER-AUTHENTICATION-V1.md`

Modified:

- `backend/src/prisma/contract.prisma`, `contract.json`, `contract.d.ts`
- `backend/migrations/app/refs/db.json`
- `backend/src/online-orders/online-orders.module.ts`, `online-orders.controller.ts`, `online-orders.service.ts`
- `backend/src/auth/http-security.ts`, `environment.ts`
- `backend/.env.example`, `package.json`, `package-lock.json`
- `backend/test/auth.e2e-spec.ts`, `online-orders.e2e-spec.ts`, `order-fulfillment.e2e-spec.ts` (adapt existing domain fixtures to the new customer boundary; dedicated customer tests exercise real guards)
- `frontend/src/app/shop/layout.tsx`
- `frontend/src/app/shop/checkout/page.tsx`, `checkout.tsx`

No live Google credentials were available. Email verification, password recovery, dual-proof account linking, customer profile/history and customer management are outside this V1. The installed Prisma skills-sync and Vite plugin advisories remain; they did not block validation.
