# Unified email/password login

`/` and legacy `/login` redirect to `/auth`. This initial page reuses the existing
auth component and storefront auth shell. Customer login, registration and Google
return to `/shop`; a visitor link opens `/shop` without creating an account/session.
`/shop/auth` is the action-gated entry for checkout/profile and preserves their
allowlisted return destinations. It never shows the visitor link.
Both Connexion forms post email, password and the customer return destination to
`POST /public/auth/sign-in`. No account type is accepted from the browser.

The server normalizes the email and resolves its identity across internal users
and customers. A unique internal identity is authenticated by `AuthService`
(which still requires active ADMIN); a unique customer identity uses
`CustomerAuthService`. Existing password checks, token hashing, expiry, previous
session rotation and separate HttpOnly cookies/session tables are reused.
The response contains only an allowlisted destination: `/dashboard` for ADMIN or the
existing customer destination. The browser reloads there so both providers read
their own session cookies. Browser cart storage is untouched.

The existing dashboard moved to `/dashboard`, and internal navigation points there.
Google signs the initial-entry context in its existing OAuth flow cookie: successful
entry authentication returns to `/shop`, and a provider failure with a valid flow
returns to `/auth`. Gated failures retain `/shop/auth` and their return target.

## Ambiguity and security

- Zero or multiple matching identities produce the same generic 401 as a wrong
  password. Inactive and obsolete identities also count when detecting ambiguity.
  No account is merged, promoted, deleted or selected by password precedence.
- Existing duplicate identities require an intentional email correction by the
  owner before using shared email/password login. There is no data migration.
- Registration and Google OAuth remain customer-only. Account-edit functionality
  now prevents new cross-identity email collisions across registration, Google,
  internal creation and email updates using a shared transactional check. Legacy
  collisions still fail closed at shared sign-in. Google never issues an admin cookie.
- Existing explicit auth API endpoints remain for compatibility; their session
  types and guards are unchanged. The separate admin login **UI** is removed.
- The shared sign-in endpoint shares the existing admin login IP throttle:
  10 failed attempts per 15 minutes. Trusted-Origin enforcement and admin login
  audit events remain enabled. Customer registration/Google throttles are unchanged.
- Existing development-only ADMIN bypass configuration remains unchanged. Disable
  `DEV_ADMIN_BYPASS` when manually verifying unauthenticated/admin isolation.

## Validation

- Frontend/backend builds and lint passed. Backend lint retains the unrelated
  `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:83`.
- 53 auth/security/Google unit tests passed. The production-boundary test needs
  a test HTTPS `GOOGLE_REDIRECT_URI` rather than the local HTTP callback inherited
  from `.env`; only the invoking test shell was adjusted.
- 6 new database integration tests passed; 45 existing auth/customer integration
  tests passed, with 1 existing skipped test. UUID test identities are cleaned up;
  existing accounts and business records are not modified.
- Coverage includes both sessions, logout and rotation, registration injection,
  admin guard isolation, generic failures, normalized duplicate-email rejection,
  return destination allowlisting, trusted origin and throttling.
- Google signature/claim checks are unit-tested; the integration callback uses a
  mocked verified provider identity. A live Google account/browser exchange was
  not performed.
- Browser form checks with mocked responses passed for ADMIN dashboard redirect,
  customer profile return, wrong-password feedback and retained local storage.
- Routing refinement: both builds passed; 54 auth/security/Google unit tests and
  7 isolated database login tests passed. Browser tests with mocked auth responses
  covered root entry, visitor continuation, ADMIN dashboard, customer login/register
  to shop, checkout/profile interruption and return, Google URLs, and unchanged cart
  storage. Live Google exchange was not performed.
- `/login` and `/` redirect to `/auth`.

Review initial entry at http://localhost:3000/auth. Test each account type after logging out
of its existing session. Registration still creates only a customer, and Google
continues using the configured customer callback.
