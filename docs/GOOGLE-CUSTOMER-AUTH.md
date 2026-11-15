# Google Customer Authentication

The existing Google OAuth authorization-code implementation is reused; no second authentication architecture or packages were added. The same “Continuer avec Google” action serves both login and registration at `/shop/auth`. It is hidden unless all three Google settings are configured. Email/password authentication remains available.

## Configuration

Set locally in the ignored `backend/.env` or in the backend process environment:

```dotenv
GOOGLE_CLIENT_ID=<Google Web application client ID>
GOOGLE_CLIENT_SECRET=<Google Web application client secret>
GOOGLE_REDIRECT_URI=http://localhost:3001/public/auth/google/callback
FRONTEND_ORIGIN=http://localhost:3000
```

Keep the existing `AUTH_SECRET` (required in production). Never expose the client secret through NEXT_PUBLIC variables. Restart the backend after configuring. No credential values were added during this task.

In Google Cloud / Google Auth Platform:
1. Select/create a project and configure Branding (app name, support and contact email).
2. Configure Audience for public customers (External); add test users as appropriate for the project's testing policy.
3. Create an OAuth client with application type Web application.
4. Add the exact authorized redirect URI `http://localhost:3001/public/auth/google/callback`.
5. Use only the basic identity scopes `openid`, `email`, `profile`. The redirect-based server flow does not require browser Google Identity Services or JavaScript origins.
6. Put the client credentials in the backend environment and restart. For deployment, register the exact public HTTPS callback URL (including any API prefix), set GOOGLE_REDIRECT_URI to it, and use the production HTTPS FRONTEND_ORIGIN and required AUTH_SECRET.

Official references: https://developers.google.com/identity/protocols/oauth2/web-server and https://developers.google.com/identity/openid-connect/openid-connect

## Security and account behavior

- Server library verifies JWT signatures, issuer, audience and expiry; application requires boolean `email_verified=true`, subject and matching nonce.
- Expiring signed state cookie binds return URL, nonce and PKCE verifier. Redirect targets use the existing storefront allowlist.
- Customer stores the unique Google subject identifier; Google access/refresh tokens are not persisted. Existing opaque customer-session cookies are used. ADMIN sessions remain separate.
- Existing linked subject reuses the customer. Unique email/subject constraints and serialized same-email operations prevent duplicate accounts.
- Existing safety behavior is retained: authoritative Google email (Gmail or verified Workspace) can link an existing email account; because local registration does not verify email ownership, linking revokes its previous sessions and unverified password. Non-authoritative third-party addresses do not auto-link and must use the existing email/password flow. Ordinary unlinked password accounts remain unchanged.
- Saved name, phone and delivery address remain intact when linking. Cart remains browser-owned; checkout/profile return targets are preserved.

## Validation and limitations

Backend/frontend builds and frontend lint passed. OIDC/auth unit tests passed, including cryptographic claim rejection and safe return targets. Eight customer integration tests passed: email/password, new Google customer, safe linking/deduplication, profile preservation, callback cookie/checkout redirect, customer-versus-ADMIN isolation and logout. Callback tests mock Google's external exchange; JWT tests verify locally signed tokens using the library.

Browser checks verified the hidden unconfigured state and, with a mocked enabled configuration, the button in both auth modes plus checkout target and unchanged browser cart state. Real Google consent/token exchange was not tested because no Google credentials are configured. Configure them and test both a new Google customer and an existing eligible email account before deployment. One pre-existing backend lint warning remains in `test/stock-movements.e2e-spec.ts:83`.

Changed files: `backend/src/customer-auth/google-auth.service.ts`, `backend/src/customer-auth/google-auth.spec.ts`, `backend/test/customer-auth.e2e-spec.ts`, `frontend/src/app/shop/auth/customer-auth.css`, and this guide.
