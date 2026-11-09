# Security Hardening + Backup / Recovery V1

Validated locally on 2026-09-09. This is application hardening and a tested logical recovery workflow, not an absolute claim of production security. No stock/accounting formulas, models or migrations were changed. Existing manual accounts and business records were retained.

## Review and changes

The pre-change review covered authentication, CORS, headers, manual validators, throttling, bcrypt, backend roles, public API projections, exceptions/logging, audit metadata, environment files, dependencies and PostgreSQL tooling. The working checklist is in ignored `.tmp/security-review.md`.

Implemented:

- Helmet 8.3.0 on the API: MIME sniffing protection, frame denial, no-referrer, removal of framework identification, and other Helmet defaults. HSTS is enabled in backend production mode.
- Next.js headers: `nosniff`, `DENY`, `no-referrer`, disabled camera/microphone/geolocation, no X-Powered-By. HSTS is enabled for production with an HTTPS API configuration. Configure it at the HTTPS edge as well.
- No CSP was added. A nonce-based Next.js CSP needs a separate deployment/browser rollout; an untested restrictive policy would break scripts or styles. React escaping and frame/MIME headers are not a replacement for CSP.
- Foreign supplied Origin headers now get an explicit 403 before application handlers. The one exact configured frontend origin receives credentialed CORS. Requests without Origin can still read public/protected APIs according to their normal authorization rules.
- Production validates configuration before importing application/database providers. Missing DATABASE_URL, AUTH_SECRET or FRONTEND_ORIGIN fails startup. Invalid PostgreSQL URL, unsafe origin, invalid duration or weak/example secret fails clearly without echoing its value.
- Opaque sessions remain unchanged externally. Their stored token hash uses HMAC-SHA256 when AUTH_SECRET is supplied. Local development without a key retains the existing SHA256 behavior. Production cannot use this fallback. Adding, removing or rotating a key invalidates previously issued sessions; users must log in again. No schema migration is required.
- A global exception filter returns generic 5xx responses and logs only a constant message in production. Controlled 4xx responses are preserved. Raw parser errors are bounded/sanitized when received directly; Nest also maps malformed JSON to 400. Development can retain diagnostic stacks. No request body, cookie, authorization header or secret is logged by the new code.
- A compatible mutation-body bounds pipe adds 500-character string limits, with 10,000 for `notes`, `description`, `address`, `reportFooter`; at most 1,000 items per array, 32 nesting levels and 64-character property names. Existing stricter endpoint limits still apply. These are explicit 400 rejections, never truncation/coercion. Decimal strings and UTF-8 text pass through unchanged. Express's default 100 KB JSON body limit is retained and verified (413). These new limits are an intentional API validation constraint; historical larger text may need shortening when resubmitted.

### Existing controls verified, unchanged

- bcrypt cost 12, password length/UTF-8 byte checks, generic unknown/wrong/inactive login failure, safe user projection without passwordHash.
- 256-bit random opaque session token in an HttpOnly host-only cookie, explicit expiry (default 8 hours, configurable 0.05–168), SameSite=Lax. Production uses Secure and the `__Host-herb_session` name. Development uses `herb_session`. Logout clears the same cookie attributes and revokes the session. Password/role/activation changes revoke existing sessions.
- Login limiter: 10 failed requests per IP per 15 minutes; successful requests excluded. Generic 429. The store is in memory and is not a distributed production limiter.
- Backend authorization is authoritative: ADMIN alone may access every internal module. Customer sessions never grant internal access. UI hiding alone is never authorization.
- Manual endpoint validators reject unknown fields, invalid enums, IDs, dates and decimal values. Existing exact decimal/BigInt arithmetic remains unchanged. A class-validator whitelist/transform pipe was deliberately not introduced because these DTOs use manual validation rather than decorators.
- Public catalogue/cart/order responses use explicit projections. They do not expose exact internal stock, purchase cost, storage location/min/max, supplier, session or audit data. Order lookup requires reference and matching phone. Public creation is intentionally unauthenticated; it does not confer authenticated privileges.
- Audit V1 keeps transactional business events, allowlisted metadata and best-effort authentication events separate from debug logging. DB-owner tamper resistance and historical backfill remain outside Audit V1.
- User descriptions, notes, report footers and audit metadata use escaped React text. No user-content `dangerouslySetInnerHTML` path was found. Authentication tokens are not stored in localStorage; shop cart storage is unrelated.

## Environment and deployment

Both `.env.example` files contain empty values only. Real `.env` files and backups are ignored by Git. No existing local secret was printed, replaced or committed.

| Variable | Requirement |
|---|---|
| DATABASE_URL | PostgreSQL URL including host/database; mandatory in production. Use a private/TLS connection and deployment credentials. |
| AUTH_SECRET | Mandatory in production: at least 32 bytes and basic weak-placeholder checks. Generate 32 cryptographically random bytes and encode as hex (64 characters). Length checks cannot prove entropy. |
| FRONTEND_ORIGIN | One exact origin, no path/trailing slash/wildcard. HTTPS mandatory in production. Local default is http://localhost:3000. |
| AUTH_SESSION_HOURS | Optional; defaults to 8, bounded 0.05–168. |
| NODE_ENV | Set to production for deployed backend. Never rely on development defaults. |
| PORT | Optional backend port; default 3001 when unset. |
| NEXT_PUBLIC_API_URL | Required at frontend production build/start; exact HTTPS API origin. Explicit HTTP loopback is allowed for local production-build verification. This value is public and embedded at build time. Rebuild when changing it. |
| ADMIN_EMAIL / ADMIN_NAME / ADMIN_PASSWORD | Existing initial-bootstrap command only; supply in that shell, never in committed files. |

Generate a secret into the current PowerShell session (no file or printed value):

```powershell
$env:AUTH_SECRET = node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))"
```

For real deployment, persist it in the host's protected environment configuration, together with DATABASE_URL and FRONTEND_ORIGIN. Do not generate a new key on every restart. Do not use NEXT_PUBLIC variables for secrets. Local ignored `backend/.env` is an option for local use, not `.env.example`.

### Cookie, CORS and CSRF decision

CORS allows only FRONTEND_ORIGIN, credentials, methods GET/POST/PATCH/DELETE/OPTIONS and headers Content-Type/Authorization. The app currently authenticates with its cookie, not an Authorization bearer token; that header remains allowed for existing compatibility.

SameSite=Lax is defense in depth. The existing guard also requires the exact trusted Origin on every unsafe authenticated/auth request, including login/logout. Foreign/missing-origin cookie mutations are rejected. No custom CSRF token system was needed for this architecture. Deploy frontend and API on HTTPS origins within the same site (for example store.example and api.store.example); unrelated-site hosting will not work with this cookie policy and needs a deliberate auth/CSRF design review. Origin checks cannot defend against XSS on the trusted origin. Public order/cart endpoints do not use ambient authentication authority; abuse/rate controls there remain a deployment concern. See [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Dependency audit

| Audit | Before | After |
|---|---|---|
| Backend `npm audit --omit=dev` | 17: 12 high, 5 moderate | **0** |
| Frontend `npm audit --omit=dev` | 0 | **0** |
| Backend full `npm audit` | Full-tree baseline not captured before installation | 18: 10 high, 6 moderate, 2 low |
| Frontend full `npm audit` | Full-tree baseline not captured | 0 |

The previously reported 14/9 figures were stale; the current initial audit found 17/12. No `audit fix --force` was used.

Changes: remove unused direct `@prisma/client` 7.10.0 (no source imports or PrismaClient usage; the application already exclusively uses Prisma 8 `@prisma/orm-postgres`), add Helmet, and narrowly override Nest platform-express's pinned Multer 2.2.0 with 2.3.0. The [Multer 2.3.0 release](https://github.com/expressjs/multer/releases/tag/v2.3.0) fixes its four reported advisories. There is no upload route, but the production dependency was hardened anyway. Prisma 8, its contract and runtime were not upgraded or rewritten. Build, runtime HTTP and migration checks passed after removal of the unused client.

Removing the unused client removes its peer link that had classified Prisma CLI/composer development tooling as production dependencies. It does **not** fix those tools' own vulnerabilities. All residual advisory packages are marked development-only in the resulting lockfile. Deploy a built application with a production-only dependency installation, e.g. `npm ci --omit=dev --ignore-scripts` in a separate runtime artifact, not the entire development node_modules. Keep generated contract/build artifacts. Never run this pruning command in the working development checkout during validation.

Remaining actual vulnerable packages and their development exposure:

| Package (installed) | Severity | Risk / fixed version floor / decision |
|---|---|---|
| hono 4.11.4 | High | Numerous request/middleware/cookie/static-file advisories; latest reported fix floor 4.13.5. Pinned by @prisma/dev, not used by the Express application. Do not expose Prisma dev/composer HTTP services to untrusted networks. |
| @hono/node-server 1.19.9 | High | HTTP/static-file handling; fix floor 1.19.15. Pinned dev server, not the Nest adapter. |
| lodash 4.17.21 (nested Chevrotain) | High | Template code injection and prototype pollution; advisory ranges include <=4.17.23. Other lodash instance is already 4.18.1. Old version is pinned by the Prisma schema parser tree; no user-provided schemas/templates should enter this tooling. |
| valibot 1.2.0 | Moderate | Inherited-property validation/flatten behavior; affected <=1.4.1. Pinned Prisma development tooling. |
| undici 6.20.1 | High | HTTP/WebSocket/cookie/resource-exhaustion advisories; latest floor 6.28.0. Exact pin in @nestjs/mau deployment tooling, not the application's Node fetch or Express server. |
| tmp 0.0.33 | High | Temporary path/symlink traversal; fix floor 0.2.6. external-editor/inquirer development tree; crossing its 0.0.x constraint is outside a normal lockfile update. |

The other audit entries propagate those findings: @chevrotain/cst-dts-gen, @chevrotain/gast, @mrleebo/prisma-ast, chevrotain (moderate); @nestjs/mau (moderate, direct dev dependency); @prisma/composer, @prisma/composer-cli, @prisma/dev, alchemy, prisma (high; prisma is direct dev); external-editor/inquirer (low). All 18 entries report `fixAvailable: false` in the current audit, because upstream tooling pins block ordinary fixes. Patching the remaining tree would require unsupported overrides or upstream tool upgrades; those were left for a separately tested tooling/deployment decision rather than changing stable Prisma internals. Their advisory IDs, exact ranges, paths and URLs are retained in ignored `.tmp/security-backend-full-after.json`; rerun npm audit before deployment. A zero production audit is not proof of absence of vulnerabilities.

Installation also reports existing Prisma/composer Effect RC peer conflicts (rc.111 versus consumers requiring rc.112). Do not deploy or run that composer tree unreviewed. Vite reports its existing tsconfig-paths plugin deprecation; Prisma reports its agent skills sync warning. Neither prevented the checks. No skill files were rewritten.

## Backup and recovery

Scripts use official PostgreSQL client tools on PATH and explicit session variables PGHOST, PGPORT, PGDATABASE and PGUSER. Supply a password via PGPASSWORD in that session or PostgreSQL's protected pgpass/PGPASSFILE mechanism. PGSSLMODE/PGSSLROOTCERT and other normal libpq settings are honored; use verify-full for remote production connections. Scripts deliberately do not parse DATABASE_URL. Use a pg_dump version matching the server major (validated with PostgreSQL 18 tools).

- `scripts/backup-db.ps1`: custom-format dump; creates the directory; UTC-independent local timestamp with milliseconds plus UUID filename; atomic unique `.partial` reservation; nonzero/empty-file failure; no-overwrite rename only after success; prints completed path. Failed partial archives are retained for diagnosis and must not be restored.
- `scripts/restore-db.ps1`: explicit completed archive and target database; source-name rejection; verifies the target is empty; interactive typed confirmation unless explicitly acknowledging an empty separate target with `-ConfirmEmptyDatabase`; transactional pg_restore with exit-on-error, no owner/ACL restore. **V1 refuses all non-empty targets**, even with the confirmation switch. It never supplies `--clean` or `--create`. Existing-database destructive overwrite is intentionally unsupported.
- `scripts/pg-environment.ps1`: shared required-variable/plain-database-name/tool checks.
- `scripts/verify-backup.mjs`: local validation helper using existing backend pg/dotenv packages; reads local DATABASE_URL privately, exports a read-only snapshot, passes connection settings to official tools in child environments, restores into a UUID database, compares every table's count and canonical row text digest, checks source unchanged, rejects unsafe targets, and drops only its own database. It needs CREATEDB locally. It is not a production scheduled job and reads tables into memory for this small validation database.

From the repository root, set the non-secret connection details to your actual database values. Local PostgreSQL is on port 5433:

```powershell
$env:PGHOST = 'localhost'
$env:PGPORT = '5433'
$env:PGDATABASE = 'YOUR_SOURCE_DATABASE'
$env:PGUSER = 'YOUR_BACKUP_USER'
$pgPassword = Read-Host 'PostgreSQL password' -AsSecureString
$env:PGPASSWORD = ([PSCredential]::new($env:PGUSER, $pgPassword)).GetNetworkCredential().Password
try {
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backup-db.ps1
    if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
} finally {
    Remove-Item Env:PGPASSWORD
    $pgPassword = $null
}
```

The machine currently disables script execution by default; `-ExecutionPolicy Bypass` applies **only to that reviewed script process**, not a persistent machine policy. Alternatively use your organization's signed-script policy. No administrator policy change is made. A protected pgpass file avoids repeating the password prompt; do not put a plaintext password in command history.

Keep PGDATABASE pointing at the source when restoring so the safety check knows which database to refuse. Provision a separate empty database on the intended recovery server with the desired locale/encoding and owner:

```powershell
# Configure PG* for the intended server and authenticate through pgpass or this session.
createdb.exe --no-password --template=template0 --encoding=UTF8 herb_store_recovery
if ($LASTEXITCODE -ne 0) { throw 'Recovery database creation failed' }
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\restore-db.ps1 `
    -BackupFile 'C:\herb-store-system\backups\YOUR_COMPLETED_BACKUP.dump' `
    -TargetDatabase herb_store_recovery
# Type: RESTORE herb_store_recovery
if ($LASTEXITCODE -ne 0) { throw 'Restore failed' }
```

Do not connect application writers to the recovery target during restore. It must be private and empty; the emptiness check cannot prevent a separate administrator from racing it. Only restore trusted archives: pg_restore executes database definitions/SQL. An empty target does not make a malicious archive safe. Check counts/content, then deliberately change application connection settings for cutover. To reclaim the old database requires a separate explicit operator decision; these scripts never do it. Rotate AUTH_SECRET after recovery if restored sessions should all be invalidated.

Repeat local non-destructive validation:

```powershell
node .\scripts\verify-backup.mjs
```

This helper loads ignored `backend/.env`, does not print its password and never restores over that database. It removes only its own UUID target and retains the completed backup. Concurrent external writers can make the source-before/after check fail; rerun in a quiet validation window rather than reverting their data.

### Verified recovery result

Completed archive: `backups/herb_store_db_2026-09-09_033628_746_24610c5ef0514581a6a2633293501fd2.dump` (132,452 bytes). It is ignored by Git. This is a sensitive local backup, not source code. Report: `.tmp/security-backup-validation.json`.

| Table | Source | Restored |
|---|---:|---:|
| product | 1 | 1 |
| user | 3 | 3 |
| authSession | 1 | 1 |
| stockMovement | 4 | 4 |
| sale / saleLine / salePayment | 1 each | 1 each |
| purchase / purchaseLine / purchasePayment | 1 each | 1 each |
| onlineOrder / onlineOrderLine | 1 each | 1 each |
| supplier | 1 | 1 |
| expense | 1 | 1 |
| cashMovement | 3 | 3 |
| storeSettings | 1 | 1 |
| auditEvent | 1 | 1 |
| prisma_contract.contract / ledger | 16 each | 16 each |
| prisma_contract.marker | 1 | 1 |

All 20 tables matched both counts and exact canonical row text; numeric values were never converted through JavaScript floating-point numbers. Existing Arabic and accented French text was present and matched. Source table snapshots remained identical. Both source-target and non-empty-target refusal were exercised. The disposable database was dropped successfully. No production/current database restore was attempted.

### Retention and recovery limits

Keep 7 daily, 4 weekly and 3 monthly backups as a starting policy, with at least one encrypted off-host copy. No automatic retention/deletion is implemented. Backups include customer information, password hashes and sessions: restrict filesystem ACLs, encrypt storage/transport, limit operators and protect pgpass. The ignored folder is not encryption or access control. Scheduling, off-host storage, monitoring, retention enforcement and restore drills remain to configure.

pg_dump is a logical snapshot, not continuous recovery/PITR. Recovery point equals the last completed backup; validate recovery time against real data size. Cluster roles, pg_hba/TLS configuration, secrets, external files and infrastructure are not included; provision them separately and review ownership/permissions after recovery. These scripts omit restored ownership/ACLs intentionally. See official [pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/18/app-pgrestore.html) documentation.

## Migration and regression validation

- `prisma migration status`: up to date, no pending migration path or destructive changes. The baseline is represented by the initial marker rather than an applied edge. No migration was executed.
- `prisma db verify`: database marker and introspected schema satisfy the generated contract; no warnings or unclaimed objects. Storage hash: `4837f938bfe2ce697387d57f917552c2ad7b07d11d34ef0023fab1bff73dce48`. Migration/contract files were not regenerated or changed.
- Backend build and `tsc --noEmit`: passed.
- Backend unit tests: **251 passed / 23 files** (including configuration, cookies/key rotation, CORS/headers, safe errors and input bounds).
- Backend integration tests: **144 passed, 1 skipped / 20 files**. The existing last-active-admin concurrency test skips while a real admin exists; it does not alter that account to arrange a test. Full suites cover auth throttling/generic failures/session revocation, RBAC, public catalogue/orders, exact stock/accounting arithmetic, transaction rollback and audit/settings isolation.
- Backend lint: exits successfully; pre-existing `no-unsafe-finally` warning in `test/stock-movements.e2e-spec.ts:81` remains.
- Frontend lint and production build: passed. Build used `NEXT_PUBLIC_API_URL=http://localhost:3001` only in the command's session.
- Actual production entrypoint with missing AUTH_SECRET: rejected before startup as expected.
- Current authorization checks and results supersede previous role-specific QA: [ACTORS-ADMIN-CUSTOMER.md](ACTORS-ADMIN-CUSTOMER.md).
- Browser fixture cleanup compared every pre-existing business/account/settings/audit table before/after and passed. Tests only use owned UUID fixtures and isolated audit/settings tables; permanent records and manual accounts remain. Sequence values may advance from fixture inserts; they are not reset.

To rerun suites in separate shells (database suites and browser fixtures must run sequentially):

```powershell
cd C:\herb-store-system\backend
npm.cmd run build
npx.cmd tsc --noEmit
npm.cmd test
$env:RUN_DATABASE_TESTS = '1'
npm.cmd run test:e2e -- --no-file-parallelism
npm.cmd audit --omit=dev
npm.cmd audit

cd C:\herb-store-system\frontend
npm.cmd run lint
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001'
npm.cmd run build
npm.cmd audit --omit=dev
```

Browser harness: with both local app servers available and an isolated Chrome debugging session at port 9223, run `node scripts/verify-security.mjs` from frontend. It creates temporary UUID users/product/sale only and removes them in cleanup. Keep the debug port loopback-only and close Chrome after checks (the harness does this).

## Production checklist and remaining risks

- Configure HTTPS termination, exact origins, same-site cookies, production NODE_ENV, strong persistent AUTH_SECRET, private/TLS database and correct public API URL before building.
- Install only production runtime dependencies. Review the remaining development advisories/Effect peer conflicts before using CLI deployment/dev servers; update those tools in a separate tested change.
- Configure a narrowly trusted proxy and shared rate-limit store if scaling; do not set unrestricted trust proxy. The current limiter uses the direct socket IP. Behind a proxy it may group users until deployment configuration is reviewed.
- Public order lookup still uses a phone and reference rather than an authenticated customer account; do not log query strings containing phone numbers at the reverse proxy. Public order creation/lookup abuse limits and operational monitoring should be added at deployment. This V1 does not provide CAPTCHA or a customer identity proof.
- Add and browser-test a CSP in a separate rollout. Keep third-party scripts and user content controlled.
- Configure encrypted off-host backups/scheduling/monitoring; rehearse restore/cutover with expected data volume. Review recovered user/session state and ownership/ACLs.
- Use a least-privilege runtime DB account; separate migration/backup operators. Do not expose PostgreSQL publicly. Never reset the production database. Always take a verified backup before migrations; periodically test recovery.
- No uploads exist. Before adding them, validate file type/content and size, generate safe filenames/storage paths, isolate storage and consider malware scanning.
- Known existing bug retained for Final QA: editing products with a blank barcode may hit the unique-barcode constraint. It now remains a generic 500 through the safe error boundary; this task does not change barcode semantics. Do not claim it fixed.
- Default error logs intentionally trade production stack detail for non-disclosure; deployment observability should add vetted correlation/structured events without sensitive data. In-memory rate limits, no CSP and local-only backup storage mean deployment work remains.

## Files created or modified

Created:

- `SECURITY-BACKUP-V1.md`
- `backend/src/auth/environment.ts`
- `backend/src/auth/startup.ts`
- `backend/src/auth/safe-exception.filter.ts`
- `backend/src/auth/input-bounds.pipe.ts`
- `backend/src/auth/security-hardening.spec.ts`
- `frontend/.env.example`
- `frontend/scripts/verify-security.mjs`
- `scripts/pg-environment.ps1`
- `scripts/backup-db.ps1`
- `scripts/restore-db.ps1`
- `scripts/verify-backup.mjs`

Modified:

- `.gitignore`
- `backend/.env.example`
- `backend/package.json`
- `backend/package-lock.json`
- `backend/src/main.ts`
- `backend/src/auth/auth-config.ts`
- `backend/src/auth/auth.service.ts`
- `backend/src/auth/http-security.ts`
- `backend/test/auth.e2e-spec.ts`
- `frontend/next.config.ts`
- `frontend/.gitignore`

Generated local artifacts (ignored): the completed backup, `.tmp/security-review.md`, before/after audit JSON files, backup validation JSON, browser profile and screenshots. No password file or committed secret was created. The working repository already had many untracked files before this task; no commit was made.
