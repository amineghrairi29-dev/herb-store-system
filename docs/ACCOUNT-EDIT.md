# Self-service account editing

Review customer `/shop/profile` and internal `/account`.
Customer contact fields and checkout prefill retain their existing API/behavior.
The internal page now saves display name. Both pages reuse a security form for
email and password changes, with current-password confirmation and password
confirmation, pending states, and success/error feedback.

## Endpoints and boundaries

| Account | Read security capabilities | Profile | Email | Password |
| --- | --- | --- | --- | --- |
| ADMIN | GET /auth/account/security | PATCH /auth/account/profile | PATCH /auth/account/email | PATCH /auth/account/password |
| CUSTOMER | GET /public/auth/security | PATCH /public/auth/profile (existing) | PATCH /public/auth/email | PATCH /public/auth/password |

- IDs come exclusively from the authenticated session; account kind is fixed in
  each controller. Unknown fields, including IDs and roles, are rejected.
- Email payload: `email`, `currentPassword`. Password payload: `currentPassword`,
  `newPassword`, `confirmPassword`. Passwords use bcrypt cost 12 and the existing
  password policy (8 characters, letter and digit, maximum 72 UTF-8 bytes).
- Security mutations recheck the actual session and active account inside the
  transaction after locking the account row. Development bypass alone cannot
  authorize these changes: sign in with a real session.
- Email/password changes revoke other sessions for that account only. The current
  session remains valid with its original expiry. Concurrent changes using a
  session revoked by the first change fail. Existing administrative password
  reset still revokes *all* sessions as before.
- Cross-identity email checks normalize case/whitespace and serialize claims with
  a shared database advisory lock. Registration, internal user creation/reactivation,
  Google linking/creation, and self-service email updates use the same check.
  Inactive identities reserve their addresses too, avoiding ambiguity in unified
  login. Legacy records are not changed or deleted. No schema migration is needed.
- Existing trusted-Origin checks, separate cookies/guards and session hashing
  remain in place. Security update endpoints share a 10-failed-attempt / 15-minute
  limiter. Internal changes use existing audit actions without secret metadata.

## Google accounts

Google-only customers have no current local password. They can edit contact data
but cannot change email/password through this password-confirmation flow. The UI
explains this; it does not silently create a password or bypass confirmation.
If an account has both a local password and a Google link, changing its email
disconnects that old Google link. Password changes alone retain the link. New Google
identities cannot claim an email reserved by an internal account.

## Validation

- Backend/frontend builds and lint passed. Existing backend warning remains in
  `test/stock-movements.e2e-spec.ts:83` (`no-unsafe-finally`).
- 54 auth/security/Google unit tests passed.
- 52 existing auth/customer/unified-login integration tests passed; 1 existing skip.
- 8 new self-account database tests passed: both profile/email/password flows,
  generic wrong-password rejection, normalization/duplicates, role/ID injection,
  bcrypt verification, session isolation/revocation, concurrent email claims and
  stale-session password changes, Google-only restrictions.
- Tests used UUID accounts and removed only those fixtures. Existing accounts,
  including the development ADMIN, and business data were not edited.
- Browser tests with mocked sessions/responses covered both pages at 1440px and
  390px, profile/email/password submission, disabled buttons, errors/success,
  secret-field clearing, read-only account email refresh, and Google-only UI.
  No horizontal overflow or runtime exceptions were observed.

Manual session check: sign in to a disposable account in two browsers; change its
password in the first. The first remains signed in; the second must authenticate
again. Verify old credentials fail and new credentials work. Repeat for each
account type. Try an email already used by the other account type: it must fail
without changing the account or sessions.

## Files

Created:
- backend/src/auth/identity-email.ts
- backend/src/auth/self-account.service.ts
- backend/test/self-account.e2e-spec.ts
- frontend/src/components/account-security.tsx
- frontend/src/components/account-security.module.css
- ACCOUNT-EDIT.md

Modified:
- backend/src/auth/auth.module.ts
- backend/src/auth/auth.controller.ts
- backend/src/auth/users.service.ts
- backend/src/auth/http-security.ts
- backend/src/customer-auth/customer-auth.controller.ts
- backend/src/customer-auth/customer-auth.service.ts
- backend/test/customer-auth.e2e-spec.ts
- backend/test/unified-login.e2e-spec.ts
- frontend/src/app/account/page.tsx
- frontend/src/app/shop/profile/page.tsx
- frontend/src/app/shop/profile/profile.module.css
- UNIFIED-LOGIN.md
