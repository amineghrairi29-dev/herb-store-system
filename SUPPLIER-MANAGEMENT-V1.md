# Supplier Management V1

## Implementation

Supplier management is available at `/suppliers`, `/suppliers/new`, and `/suppliers/[id]/edit`. The list includes name/code search, all requested columns, status badges, editing, and activation controls. A shared create/edit form provides every requested field, loading/error/retry states, required-field/email validation, and UTF-8 inputs. Successful saves reload `/suppliers` to fetch fresh data. Status changes use the server's returned supplier to update the list immediately.

Deactivation requires a native modal confirmation identifying the supplier and warning: “Ce fournisseur sera désactivé mais son historique futur restera conservé.” This also applies when an active supplier is made inactive through the edit form. Cancellation makes no request; errors keep the confirmation open. Activation requires no confirmation. No DELETE endpoint or permanent deletion button was added. No purchases, sales, accounting, or new dependencies were added.

## Exact database changes

Added only `public.supplier`:

| Column | PostgreSQL type and constraints |
| --- | --- |
| id | SERIAL, primary key |
| code | text, NOT NULL, unique constraint `supplier_code_key` |
| name | text, NOT NULL |
| contactName, phone, email, address, city, country, taxId, notes | nullable text |
| isActive | boolean, NOT NULL, default true |
| createdAt | timestamptz, NOT NULL, default now() |
| updatedAt | timestamptz, NOT NULL; generated through Prisma's `temporal.updatedAtString()` preset |

The model has no relations. Product and Stock models were not changed. The contract was emitted, the database dry-run was reviewed, and the formal migration `20260906T0016_suppliers_v1` was applied. It contains exactly two operations: creating the supplier table and adding the unique constraint. The generated migration getter has an explicit return type to support the project's full TypeScript check; re-emitting it preserved the migration hash.

Migration hash: `0f07e7bef80b22216c8f9a41366a4e452ba9f8932d97addbba957ed3f0a13b21`.

## API and validation

| Endpoint | Behavior |
| --- | --- |
| POST /suppliers | Creates supplier; HTTP 201 |
| GET /suppliers | Lists suppliers, ordered by name |
| GET /suppliers/:id | Loads supplier; missing supplier returns 404 |
| PATCH /suppliers/:id | Updates supplied fields, including isActive; missing supplier returns 404 |

DTOs describe create/update inputs. Runtime validation at the service boundary rejects malformed bodies and unknown fields. Code and name must be nonempty strings after trimming. Optional text is trimmed; blank text becomes null. Email receives a basic format check when provided. isActive must be a boolean when provided. IDs must be positive PostgreSQL int4 values. Invalid input returns 400. Duplicate codes return 409 with “Ce code fournisseur est déjà utilisé.” Both a precheck and PostgreSQL unique-violation handling cover duplicates. Code uniqueness is case-sensitive, as provided by the text unique constraint.

## Validation results

- Backend `npm.cmd run build`: passed.
- Backend `npm.cmd exec tsc -- --noEmit`: passed.
- Backend `npm.cmd run test -- src/suppliers/supplier-validation.spec.ts`: 11 tests passed.
- Backend `$env:RUN_DATABASE_TESTS='1'; npm.cmd run test:e2e -- test/suppliers.e2e-spec.ts`: 1 transactional HTTP integration test passed.
- Integration covered create, list, get, edit, deactivate/reactivate, automatic timestamps/default active status, duplicate codes on create/update, invalid emails on create/update, invalid IDs, not-found errors, and exact Arabic supplier/contact round trips.
- All integration writes used an isolated transaction that was deliberately rolled back. Both temporary supplier codes were confirmed absent afterward. No Product or Stock write was executed.
- Frontend `npm.cmd run lint`: passed.
- Frontend `npm.cmd run build`: passed, including all supplier routes.
- HTTP GET `/suppliers`, `/suppliers/new`, `/suppliers/2147483647/edit` on port 3000: each returned 200. The nonexistent-ID route check verifies page delivery; API 404 handling was separately tested.
- Live GET `/suppliers` on port 3001: 200, empty array after tests, correct CORS origin.
- POST and PATCH OPTIONS preflights: 204, allowed origin `http://localhost:3000`, methods include POST/PATCH, and Content-Type is allowed. Existing CORS configuration required no modification.
- `npm.cmd exec prisma -- db verify`: database marker and schema match the contract; no schema warnings.
- Before/after Product and Stock Movement API snapshots matched exactly (one existing product and one existing movement).

No implementation blocker remains. Existing tooling emits two advisory warnings: Prisma agent skills have not been synced, and Vite supports native tsconfig path resolution instead of the existing vite-tsconfig-paths plugin. Neither prevented validation; unrelated tooling configuration was left intact. Browser clicks, layout, focus behavior, and visual Arabic rendering were not automated and should be checked manually below. Arabic transport/storage was verified by integration tests; inputs and displayed names use automatic text direction.

## Exact manual test steps

1. Start the backend in `C:\herb-store-system\backend` with `npm.cmd run start:dev` and frontend in `C:\herb-store-system\frontend` with `npm.cmd run dev`, unless they are already running.
2. Open `http://localhost:3000/suppliers`. With no suppliers, expect “Aucun fournisseur disponible”. Confirm the add action and links to Products/Stock. The Products page also links to suppliers.
3. Click “Ajouter un fournisseur”. Try submitting without code/name, then with an invalid email: submission must be blocked with clear validation.
4. Create a disposable supplier with code `SUP-MANUAL-001`, name `مورد الأطلس`, contact `أحمد`, email `contact@example.com`, and optional fields of your choice. Leave Actif checked. Submit; expect “Enregistrement...”, then return to the list with the new active supplier.
5. Search for `SUP-MANUAL-001`, then part of the Arabic name; the supplier should appear. Search a nonexistent value to check the filtered empty state.
6. Try creating another supplier with the same code: expect the duplicate-code error and no redirect.
7. Click “Modifier”. Check every field is prefilled. Change name/contact (for example contact `فاطمة`), clear an optional field, and save. Confirm the list reflects changes. Reopen editing to confirm persistence.
8. Click “Désactiver”. Check the name/code and history warning. Click “Annuler” and verify the supplier remains active. Reopen and confirm: expect Inactif without a manual refresh.
9. Click “Activer”; expect Actif immediately after the request succeeds. Also test unchecking Actif in the edit form: saving must request confirmation before deactivation.
10. Open `http://localhost:3000/suppliers/2147483647/edit`: expect a clear not-found message plus retry/back actions.
11. Temporarily stop the backend, then retry list loading or save an edit: expect a visible connection error, preserved form contents, and re-enabled controls. Restart the backend and retry.
12. Check a narrow mobile viewport, horizontal table scrolling, keyboard access/Escape/cancel in the confirmation dialog, and Arabic display. Use DevTools Network to confirm POST/PATCH requests target port 3001 and no DELETE request occurs.
13. Deactivate the disposable manual supplier when finished. There is intentionally no permanent-delete interface.

## Complete file inventory for this task

Modified:

- `backend/src/app.module.ts`
- `backend/src/prisma/contract.prisma`
- `backend/src/prisma/contract.json` (generated)
- `backend/src/prisma/contract.d.ts` (generated)
- `backend/migrations/app/refs/db.json` (generated migration reference)
- `frontend/src/app/products/page.tsx` (supplier navigation link)

Created backend files:

- `backend/src/suppliers/dto/create-supplier.dto.ts`
- `backend/src/suppliers/dto/update-supplier.dto.ts`
- `backend/src/suppliers/supplier-validation.ts`
- `backend/src/suppliers/supplier-validation.spec.ts`
- `backend/src/suppliers/suppliers.controller.ts`
- `backend/src/suppliers/suppliers.service.ts`
- `backend/src/suppliers/suppliers.module.ts`
- `backend/test/suppliers.e2e-spec.ts`
- `backend/migrations/app/20260906T0016_suppliers_v1/migration.ts`
- `backend/migrations/app/20260906T0016_suppliers_v1/migration.json`
- `backend/migrations/app/20260906T0016_suppliers_v1/ops.json`
- `backend/migrations/snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract.json`
- `backend/migrations/snapshots/9acd7b08629e7fe68016462a585f3f6f25eb136d6ede051e430d254f399d68e1/contract.d.ts`

Created frontend files:

- `frontend/src/types/supplier.ts`
- `frontend/src/lib/supplier-api.ts`
- `frontend/src/app/suppliers/page.tsx`
- `frontend/src/app/suppliers/suppliers-table.tsx`
- `frontend/src/app/suppliers/supplier-form.tsx`
- `frontend/src/app/suppliers/supplier-confirmation.tsx`
- `frontend/src/app/suppliers/new/page.tsx`
- `frontend/src/app/suppliers/[id]/edit/page.tsx`

Created documentation: `SUPPLIER-MANAGEMENT-V1.md` (this file). Build outputs and caches are omitted from this source/artifact inventory.
