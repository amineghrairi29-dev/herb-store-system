# Customer Profile V1

Review: http://localhost:3000/shop/profile

Authenticated customers can edit their name, phone and default delivery address. Email is read-only. The existing account menu (desktop and mobile) links to the profile; logout remains in that menu and is also available on the profile. Guests are redirected to `/shop/auth?returnTo=/shop/profile`. The existing customer session and Google redirect allowlists support returning to the profile.

`GET /public/auth/me` now includes `deliveryAddress`. `PATCH /public/auth/profile` accepts only `fullName`, `phone` and `deliveryAddress`, using the customer ID from the existing CustomerGuard. It rejects account/administrative fields, requires a nonblank name, limits name/phone/address to 150/40/500 characters and preserves email, passwords, sessions and all other customers. Existing trusted-origin protection applies. Phone and address may be left blank; checkout still enforces its own required fields.

Checkout prefills all three fields from the saved profile. Editing a profile does not rewrite historical orders, and checkout-specific edits do not silently overwrite the default profile. No order-history UI was added.

## Migration

Applied `20260915T1213_customer_profile` locally using the existing Prisma contract migration workflow. Its only operation adds nullable `Customer.deliveryAddress`; existing rows receive NULL. No data is deleted or copied from historical orders. Other environments must apply this migration before starting the updated backend.

## Files created/modified

- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json`
- `backend/src/prisma/contract.d.ts`
- `backend/src/customer-auth/customer-config.ts`
- `backend/src/customer-auth/customer-auth.service.ts`
- `backend/src/customer-auth/customer-auth.controller.ts`
- `backend/test/customer-auth.e2e-spec.ts`
- `backend/migrations/app/20260915T1213_customer_profile/migration.ts`
- `backend/migrations/app/20260915T1213_customer_profile/migration.json`
- `backend/migrations/app/20260915T1213_customer_profile/ops.json`
- `backend/migrations/app/refs/db.json`
- `backend/migrations/snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract.json`
- `backend/migrations/snapshots/a08fc9b25a03ed9e8730184da9e2acacb001b1592fcd169c6069c5efae29010f/contract.d.ts`
- `frontend/src/app/shop/profile/page.tsx`
- `frontend/src/app/shop/profile/profile.module.css`
- `frontend/src/app/shop/customer-auth-provider.tsx`
- `frontend/src/app/shop/storefront/public-header.tsx`
- `frontend/src/app/shop/checkout/checkout.tsx`
- `frontend/scripts/verify-customer-profile.mjs`
- This document.

## Validation

Backend and frontend production builds passed. Frontend lint passed. All seven customer-auth integration tests passed, including profile validation, unauthenticated/origin rejection, saved-field reads, unchanged credentials and other-customer isolation. Backend lint has one pre-existing `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:83`.

Browser checks passed at 1440px and 390px: guest redirect, save/reload (including Arabic), read-only email, no overflow, checkout prefill and logout. No runtime exceptions were observed. Disposable UUID-owned customer/product/stock fixtures were removed; original customer/business snapshots matched. No orders were submitted. Screenshots are in `.tmp/profile-ui-737c5046-9545-4863-9e77-6520859a1402`.

Manual check: log in as a customer, open “Mon profil”, save contact details, reload, then open checkout with a cart item and confirm the three delivery fields are prefilled. Log out and open `/shop/profile` to verify the auth redirect.
