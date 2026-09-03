# Explorer report 3: dental-data-ops

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 3 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, dental-data-ops

## Summary

Smile Notes' data layer is a small, unusually disciplined single-tenant Postgres application: 17 tables, ~2,900 LOC across `src/lib/db/**`, driven by Drizzle ORM over two interchangeable drivers (node-postgres for production, PGlite for dev/test/CI). The domai…

## Scope

dental-data-ops

## Summary

Smile Notes' data layer is a small, unusually disciplined single-tenant Postgres application: 17 tables, ~2,900 LOC across `src/lib/db/**`, driven by Drizzle ORM over two interchangeable drivers (node-postgres for production, PGlite for dev/test/CI). The domain it persists is deliberately narrow — accounts, offices, de-identified note drafts, frozen filed submissions, an audit log, a points economy, a wish list, and a practice-pack approval workflow. There is no patient, appointment, ledger, claim, or imaging entity anywhere, and the product's core claim ("no PHI is stored") is enforced by an application-layer PHI rule at submit time (`src/app/api/drafts/[id]/submit/route.ts`), not by anything in the database.

The engineering quality of what exists is high and idiosyncratic. Migrations are NOT run by drizzle-kit: `drizzle/0000_init.sql` is a stale 51-line artifact covering only 4 of the 17 tables, and the real migration mechanism is `src/lib/db/ddl.ts` — a hand-written array of ~60 idempotent `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements, gated by a single integer `SCHEMA_BOOT_VERSION` stamped into a singleton `schema_boot` row (`ensureSchema` in `src/lib/db/client.ts`). CI (`.github/workflows/ci.yml`) enforces that any diff touching `ddl.ts` also touches `SCHEMA_BOOT_VERSION`, the same discipline it applies to `RULESET_VERSION` and `ASSIST_PROMPT_VERSION`. Concurrent bootstrap of multiple serverless isolates is tolerated by swallowing five specific duplicate-object SQLSTATEs.

Immutability and concurrency are the repo's real strengths and the most transferable work. Filed records are frozen: `submissions.note_markdown` and `audit_report` carry the exact stamped text, `submitted_by_name`/`office_name` are snapshots that a later rename cannot rewrite, and `fileSubmissionAtomic` (`src/lib/db/repo/submissions.ts:76`) performs claim + ticket issue + freeze + independent ByteAudit re-verification inside ONE transaction that rolls back entirely on disagreement. Drafts use optimistic concurrency on an integer `version` column, with the OCC update, revision-ring insert, and ring prune wrapped in one transaction (`updateDraftChecked`, `src/lib/db/repo/drafts.ts:114`). Resends are claimed atomically via a conditional flag flip; redemptions are serialized with `pg_advisory_xact_lock` on an FNV-1a hash of the user id; admin-losing mutations serialize on a single global advisory lock; award idempotency is enforced by a partial unique index rather than route logic. The points ledger is append-only with balances computed as `sum(delta)` and refunds appended, never deleted.

Maturity is "production-ready for one small practice, not for a multi-tenant PMS." 201 test files / ~25,000 lines of test code, of which 8 files (~1,600 lines) cover the DB layer via real PGlite; 16 hand-rolled e2e probes plus a `postgres-durability.sh` script that boots the app twice against real Postgres and verifies records survive. But there is no `tenant_id`/`practice_id` column anywhere in the schema (grep returns zero hits), no row-level security, no encryption at rest beyond whatever the host provides, no read-access audit logging, no backup/restore procedure in `docs/GO-LIVE.md`, no object storage for images/documents, no money or decimal columns, and a hard-coded `America/New_York` timezone. Scaling this to a commercial multi-tenant PHI-holding PMS is a rewrite of the schema and access layer that keeps the patterns, not the tables.

## Architecture

DRIVER SELECTION AND BOOTSTRAP
- `src/lib/db/backend.ts` `resolveDbBackend()` is a pure function over env: `POSTGRES_URL` wins; in `NODE_ENV=production` a missing URL is a hard `{kind:"reject"}` with an explanatory reason, and `PGLITE_DIR=memory://` is refused unless `ALLOW_EPHEMERAL_DB=1` is ALSO set (a two-hands guard against an operator pasting a local `.env` into Vercel and silently shipping a self-wiping deployment). Dev defaults to `.data/pglite`, Vercel dev to `/tmp/smile-notes-pglite`, tests to `memory://`.
- `postgresPoolOptions()` returns `{max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000, allowExitOnIdle: true}`, with `PG_POOL_MAX` overriding but hard-clamped to 10. No `statement_timeout` is set.
- `src/lib/db/postgresUrl.ts` `pinPostgresSslMode()` rewrites `sslmode=require|prefer|verify-ca` to `verify-full` and APPENDS `sslmode=verify-full` when absent for any non-loopback host — closing a real plaintext-PHI-on-the-wire hole for Supabase/RDS/Railway/self-hosted URLs that ship no sslmode.
- `src/lib/db/client.ts` `getDb()` memoizes one bootstrap promise on `globalThis` (NOT module scope — Next bundles this file into multiple webpack layers, and a per-layer memo against PGlite produced two separate in-memory databases with two different seeded admins). A failed bootstrap is un-memoized and rate-limited by a 3-second `BOOTSTRAP_COOLDOWN_MS` so a down database does not turn every request into a full retry storm.
- Bootstrap sequence: `ensureSchema` → `seedAdmin` → `sweepMfaWhileDisabled` → `seedOffices`. Seeds are "if empty" only, never a reconciliation, so an in-app rename survives redeploy. `ADMIN_PASSWORD_RESET=1` is a documented one-shot break-glass that also clears MFA.

MIGRATIONS
- Authoritative: `src/lib/db/ddl.ts` — `SCHEMA_BOOT_VERSION = 2` plus `SCHEMA_STATEMENTS: string[]` (~60 statements, all idempotent). Enum growth uses `DO $$ ... ALTER TYPE "role" ADD VALUE ... $$` guarded by a `pg_enum` lookup, each as its own statement because Postgres forbids using a new enum value in the transaction that adds it.
- `applySchema()` executes statements serially and swallows SQLSTATEs 42710/42P06/42P07/42701/23505 so two isolates bootstrapping the same fresh database do not fail each other.
- `ensureSchema()` reads `schema_boot.version`; equal → `"skipped"` (saves ~55 round-trips per new isolate), otherwise apply then stamp.
- One data backfill lives inside the DDL array: `UPDATE drafts SET last_submission_id = (SELECT MAX(s.id) ...) WHERE last_submission_id IS NULL AND status IN ('submitted','error')`. Scoped so it is a no-op on re-run.
- `drizzle/0000_init.sql` + `drizzle/meta/` exist but are stale reference only; `drizzle.config.ts` points at `schema.ts` with `out: ./drizzle`. Nothing in the deploy path runs drizzle-kit.

REPOSITORY LAYER
`src/lib/db/repo/*` is the only place SQL is written; API routes never touch tables. Nine repos: `drafts.ts` (310), `submissions.ts` (333), `practicePacks.ts` (347), `users.ts` (268), `gamify.ts` (248), `auditLog.ts` (146), `offices.ts` (119), `resetTokens.ts` (119), `wishes.ts` (62), `userBlocks.ts` (45). Every list function takes a `PageParams` and defaults to a bounded page. Every list view uses an explicit column projection (`draftSummaryColumns`, `submissionSummaryColumns`) so the two largest columns (`note_state` jsonb up to ~120KB; `note_markdown`/`audit_report` text) are never dragged out to render a row of scalars; `drafts` even extracts `note_state->'selectedModuleIds'` in SQL rather than shipping the note back.

ENFORCEMENT — SERVER, ALWAYS
- Authorization is re-derived server-side on every route via `requireRole()` (`src/lib/auth/guards.ts`), which re-reads role/active from the DB against a JWT watermark (`users.password_changed_at` / `users.sessions_revoked_at`), so a stale cookie dies on its next request.
- Scope-of-practice (Tennessee: diagnosis/treatment planning reserved to the dentist) is enforced in BOTH `POST /api/drafts` and `PATCH /api/drafts/[id]` via `checkScope(...)` compared against the PREVIOUS note state, not mere presence of a value — the create path was explicitly closed because POSTing the whole assessment at creation bypassed the PATCH check.
- The submit route composes and audits server-side and never trusts client-supplied audit results; it refuses any request body carrying a case-insensitive recipient key (`to/cc/bcc/recipient/recipients/email/address`); the corporate address comes only from `CORPORATE_EMAIL`.
- CSV export authorization mirrors the SCREEN, not the table (`src/app/api/export/[table]/route.ts`), and the submissions export deliberately carries the stamp only, never note bodies.

CLIENT DATA FLOW (autosave)
`src/lib/client/autosaveMachine.ts` is a pure reducer (idle/dirty/saving/saved/conflict/error). `src/lib/client/useAutosave.ts` drives it: 800ms debounce → `PATCH /api/drafts/[id]` with `baseVersion`; 409 → conflict state, human chooses, `adoptVersion` prevents a 409 loop; flush on `pagehide`/`visibilitychange` with `keepalive: true`; soft retry at 4s and on the `online` event; `beforeunload` guard keyed on `pending.current`. Submit is gated on `flush()` returning `"clean"`. `src/lib/client/draftBackup.ts` maintains a same-device IndexedDB ring (keep 8, composite key `[draftId, seq]`) with a localStorage single-slot fallback, plus `clearAllDraftBackups()` for shared-tablet sign-out. `src/lib/state/noteReducer.ts` is a pure note reducer with orphan-surface pruning when tooth selection changes.

DEPLOYMENT
Vercel + Neon/Vercel Postgres (pooled string). `vercel.json` contains only one cron (`/api/law-watch/alert`, Mondays 13:00 UTC, gated by `CRON_SECRET`). `maxDuration = 60` on submit, resend, and export; `runtime = "nodejs"` on every API route. Security headers (CSP, HSTS, X-Frame-Options DENY) in `next.config.mjs`. `docs/GO-LIVE.md` is a genuinely good 198-line runbook: pooled connection string, `PG_POOL_MAX=5` (because Fluid Compute serves concurrent requests per instance and the default `max:1` serializes a busy morning), "do not set PGLITE_DIR", prove durability with `scripts/postgres-durability.sh` before anyone uses it, `/setup` over env-seeded admin, BAA before Resend or the AI gateway sees clinical content, scope `POSTGRES_URL` to Production only so a Preview branch cannot write real clinical rows.

## Key files


### Item 1
- **path**: /home/user/catcorner22/dental/src/lib/db/schema.ts
- **purpose**: Drizzle table definitions for all 17 tables; the comment blocks are the design rationale (frozen attribution, append-only ledger, no-FK-on-purpose columns, clinical_role as a separate axis from system role)
- **loc estimate**: 402

### Item 2
- **path**: /home/user/catcorner22/dental/src/lib/db/ddl.ts
- **purpose**: THE actual migration mechanism: SCHEMA_BOOT_VERSION=2 plus ~60 idempotent DDL statements including enum growth guards, additive ALTERs, 15 indexes, one data backfill, and the schema_boot singleton
- **loc estimate**: 312

### Item 3
- **path**: /home/user/catcorner22/dental/src/lib/db/client.ts
- **purpose**: Driver construction, applySchema/ensureSchema with duplicate-DDL tolerance, globalThis-held bootstrap memo with failure cooldown, seedAdmin/seedOffices/MFA sweep, __setDbForTests
- **loc estimate**: 327

### Item 4
- **path**: /home/user/catcorner22/dental/src/lib/db/backend.ts
- **purpose**: Pure env->backend decision with the production PGlite refusal and the ALLOW_EPHEMERAL_DB two-hands escape hatch; serverless-sized pg pool options
- **loc estimate**: 79

### Item 5
- **path**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts
- **purpose**: Pins sslmode=verify-full for every non-loopback Postgres URL, closing plaintext-clinical-data-on-the-wire for providers that ship no sslmode
- **loc estimate**: 58

### Item 6
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts
- **purpose**: fileSubmissionAtomic (claim+issue+freeze+verify in one tx), frozen-column projections, digest/analytics/stat queries, submissionCountByUser used to block user deletion
- **loc estimate**: 333

### Item 7
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/drafts.ts
- **purpose**: updateDraftChecked (OCC + revision ring + prune in one tx), claimResend, setDraftStatus with expectVersion guard, transferDraft version bump, revision list/get/prune
- **loc estimate**: 310

### Item 8
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts
- **purpose**: Append-only points ledger: balance/XP as sums, DB-enforced award idempotency, pg_advisory_xact_lock spend serialization, refund-by-append, conditional-transition decide
- **loc estimate**: 248

### Item 9
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/users.ts
- **purpose**: isCreatureOf transitive sock-puppet walk (16 hops, cycle-guarded), mergeUsers under a global advisory lock that never rewrites frozen submission attribution, createFirstAdminGuarded, mutateAdminGuarded last-admin protection
- **loc estimate**: 268

### Item 10
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts
- **purpose**: Bounded audit writes (cap() with visible truncation marker at the single write site), (at,id) deterministic ordering, action/prefix-scoped queries, assistEventsForDraft scoped to the actor
- **loc estimate**: 146

### Item 11
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/resetTokens.ts
- **purpose**: Hash-only reset tokens, atomic single-use redemption, setPasswordAndRevokeLinks as the mandatory password-write path, expiry pruning on the create path
- **loc estimate**: 119

### Item 12
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts
- **purpose**: Status machine (draft/in_review/approved/published/rejected/retired) with dual-control approval and an append-only practice_pack_events history carrying from/to version and JSON snapshots
- **loc estimate**: 347

### Item 13
- **path**: /home/user/catcorner22/dental/src/app/api/drafts/[id]/submit/route.ts
- **purpose**: The filing pipeline: scope/authority checks, server-side compose+audit, title-as-filename PHI rule, attestation validation, killer-finding hard block, atomic file with in-transaction ByteAudit verification, best-effort award and email, version-guarded status write
- **loc estimate**: 461

### Item 14
- **path**: /home/user/catcorner22/dental/src/app/api/drafts/[id]/route.ts
- **purpose**: GET/PATCH/DELETE with OCC, office validation against the configured list, filedNoteEqual-based re-file gate, owner-role status recompute, delete blocked when submissions exist
- **loc estimate**: 211

### Item 15
- **path**: /home/user/catcorner22/dental/src/app/api/drafts/[id]/resend/route.ts
- **purpose**: Resend the exact frozen copy under an atomic claim + DB-backed throttle, with claim-undo on failure and version-guarded status restore
- **loc estimate**: 145

### Item 16
- **path**: /home/user/catcorner22/dental/src/lib/client/useAutosave.ts
- **purpose**: Debounced OCC autosave chain with trailing-edit drain, keepalive pagehide flush, online/backoff retry, conflict adoption, and flush-before-submit contract
- **loc estimate**: 211

### Item 17
- **path**: /home/user/catcorner22/dental/src/lib/client/draftBackup.ts
- **purpose**: IndexedDB ring (keep 8) + localStorage fallback same-device mirror, with per-draft clear on server ACK and a whole-device wipe for shared tablets
- **loc estimate**: 222

### Item 18
- **path**: /home/user/catcorner22/dental/src/lib/client/autosaveMachine.ts
- **purpose**: Pure autosave reducer plus saveErrorMessage, which prefers the route's human sentence over a status code and filters out programmer-facing wire-format errors
- **loc estimate**: 101

### Item 19
- **path**: /home/user/catcorner22/dental/src/lib/email/sendSubmission.ts
- **purpose**: Single send path for original and resend so the resent bytes are identical; never throws; server-only recipient
- **loc estimate**: 64

### Item 20
- **path**: /home/user/catcorner22/dental/src/lib/email/threading.ts
- **purpose**: RFC 5322 threading with a HIPAA rationale for why the token is the random ticket and not initials+birth-year, plus leading-run ticket sanitization that blocks header injection without carrying attacker text along
- **loc estimate**: 119

### Item 21
- **path**: /home/user/catcorner22/dental/src/lib/export/csv.ts
- **purpose**: CSV formula-injection neutralization, RFC 4180 CRLF, UTF-8 BOM for Excel, no-store cache headers, filename-safe timestamp
- **loc estimate**: 93

### Item 22
- **path**: /home/user/catcorner22/dental/src/lib/http/readJson.ts
- **purpose**: MAX_BODY_BYTES=1MB pre-check on content-length and on actual bytes, plus object/empty/invalid tri-state so a literal null body is a 400 rather than a 500
- **loc estimate**: 44

### Item 23
- **path**: /home/user/catcorner22/dental/src/lib/http/pagination.ts
- **purpose**: DEFAULT_PAGE_SIZE=50 / MAX_PAGE_SIZE=200 clamps; unparseable params fall back rather than erroring
- **loc estimate**: 28

### Item 24
- **path**: /home/user/catcorner22/dental/src/lib/db/int4.ts
- **purpose**: parseRowId: rejects out-of-int4-range ids from URLs so a 1e21 path segment is a 404 rather than a driver 500
- **loc estimate**: 23

### Item 25
- **path**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts
- **purpose**: DB-backed failed-attempt throttle (auth_throttle) with doubling backoff, per-IP vs per-account budgets, justLocked flag to stop refusals amplifying; reused for resend and export metering
- **loc estimate**: 200

### Item 26
- **path**: /home/user/catcorner22/dental/src/lib/db/db.test.ts
- **purpose**: The main DB integration suite: 39 tests over real PGlite covering OCC, revision ring, atomic filing, merge, admin guards, throttle, audit bounds, backfill, enum migration
- **loc estimate**: 817

### Item 27
- **path**: /home/user/catcorner22/dental/.github/workflows/ci.yml
- **purpose**: tsc --noEmit + vitest + version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION, SCHEMA_BOOT_VERSION) + next build; separate non-blocking cross-browser job running one smoke against a production build on an ephemeral DB
- **loc estimate**: 130

### Item 28
- **path**: /home/user/catcorner22/dental/docs/GO-LIVE.md
- **purpose**: Ordered deployment runbook with proof steps: pooled string, PG_POOL_MAX, the PGLITE_DIR prohibition, durability verification, /setup over env admin, BAA gates, post-deploy verification, and a failure-symptom table
- **loc estimate**: 198

### Item 29
- **path**: /home/user/catcorner22/dental/scripts/postgres-durability.sh
- **purpose**: Boots the app in production mode against real Postgres, writes an account/draft/filed submission through the HTTP API, restarts, and proves every record survives and that boot 2 replays no DDL
- **loc estimate**: 67

### Item 30
- **path**: /home/user/catcorner22/dental/scripts/stability-battery.sh
- **purpose**: Runs 14 e2e probes each against a freshly booted server, with an optional repeat count for flake hunting; stashes .env.local so the battery tests the app as shipped
- **loc estimate**: 131

### Item 31
- **path**: /home/user/catcorner22/dental/drizzle/0000_init.sql
- **purpose**: Stale reference migration covering only users/drafts/submissions/audit_log — 4 of 17 tables; NOT in the deploy path
- **loc estimate**: 51

### Item 32
- **path**: /home/user/catcorner22/dental/knowledge/sources/stability-scalability-deep-dive.md
- **purpose**: Owner's own findings->actions table for the scalability pass (pool max, schema_boot gate, audit_log action index, digest cap, OCC+prune transaction) plus a Now/Next/Later/Watch list
- **loc estimate**: 59

### Item 33
- **path**: /home/user/catcorner22/dental/knowledge/sources/draft-autosave-reliability.md
- **purpose**: The five-layer autosave pattern (debounce+OCC, pagehide flush, online retry, same-device mirror, capped server revision ring) and the explicit rejection of CRDT stacks for single-author clinical drafts
- **loc estimate**: 48

## Reusable assets


### Item 1
- **name**: Atomic file-and-freeze transaction (fileSubmissionAtomic)
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts
**why reusable**

Claim the mutable row (guarded on both status and expected version), issue the serial ticket, write the frozen artifacts, stamp the claim back onto the source row, and run an independent verifier — all in ONE transaction, so either a complete consistent record exists or nothing changed. This is exactly the shape a PMS needs for posting a claim, finalizing an invoice, locking a clinical note, or closing a day-sheet. The version pin also prevents an in-flight autosave from being frozen out of, or a stale copy frozen into, the legal record.

- **quality**: production-grade
- **coupling**: Depends on drizzle `db.transaction`, the `drafts`/`submissions` tables, and `formatTicket`. The pattern lifts cleanly; the callback shape (buildFrozen(ticket) closing over outer `let` variables to leak the frozen text back out) is a wart worth restructuring.

### Item 2
- **name**: Append-only ledger with DB-enforced idempotency and advisory-lock spend
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts
**why reusable**

The single most directly transferable asset for the merged PMS's biggest market gap (ledger clarity). Balance is `sum(delta)`, never a stored column a bug can overwrite. A partial unique index on `(user_id, ref_type, ref_id) WHERE delta > 0` makes a retried award a no-op at the database, not at the route. Spend is serialized by `pg_advisory_xact_lock` on an FNV-1a hash of the actor id, closing the classic read-sum-then-insert overspend race. A reversal is an appended positive row, never a delete. Swap points for cents and this is a patient A/R ledger that reconciles by construction.

- **quality**: production-grade
- **coupling**: Postgres-specific (advisory locks, partial unique index). Integer `delta` would need to become a numeric/bigint-cents column. Tested by 13 cases in /home/user/catcorner22/dental/src/lib/db/gamify.test.ts including a concurrent-overspend test.

### Item 3
- **name**: Optimistic concurrency + capped revision ring in one transaction
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/drafts.ts
**why reusable**

updateDraftChecked applies a patch only when `version = baseVersion`, bumps the version, appends a working-copy snapshot when content actually changed, and prunes to the newest 20 — all inside one transaction so a crash or multi-tab storm cannot leave the recovery ring inconsistent. Returns undefined on a stale write, which the route turns into a clean 409. Directly reusable for perio charts, treatment plans, and any long-lived form in a PMS.

- **quality**: production-grade
- **coupling**: Drizzle + the drafts/draft_revisions pair. The prune is a select-then-delete-not-in rather than a window function; fine at keep=20, would want revisiting at larger rings.

### Item 4
- **name**: Autosave stack: pure machine + hook + IndexedDB mirror
- **path**: /home/user/catcorner22/dental/src/lib/client/autosaveMachine.ts
**why reusable**

A five-layer answer to the exact failure the research says cloud PMSs have no answer for (outages, no offline mode): debounced version-checked PATCH, keepalive flush on pagehide/visibilitychange, retry on the `online` event with backoff (never a hammer loop), a same-device IndexedDB ring plus localStorage fallback for the window before server ACK, and a server-side revision ring for 'restore a few minutes ago'. The state machine is pure and separately tested, and saveErrorMessage deliberately surfaces the route's human sentence while suppressing programmer-facing wire-format errors.

- **quality**: production-grade
- **coupling**: useAutosave is React-specific and hardcodes the `/api/drafts/[id]` URL and payload shape; autosaveMachine.ts and draftBackup.ts are framework-free. Extracting a generic `useVersionedAutosave(resourceUrl)` is a small refactor.

### Item 5
- **name**: Production database-backend guard (resolveDbBackend)
- **path**: /home/user/catcorner22/dental/src/lib/db/backend.ts
**why reusable**

A pure, fully tested function that makes 'silently shipped an ephemeral database' impossible: production without POSTGRES_URL is a loud boot failure, and the in-memory escape hatch requires two independent env vars so an operator copy-pasting a working local env cannot trip it. For a PHI-holding PMS this class of guard should be copied verbatim and extended (refuse to boot without a backup target, without TLS, without an encryption key).

- **quality**: production-grade
- **coupling**: None — pure over an env record. 8 tests in backend.test.ts.

### Item 6
- **name**: Postgres TLS pinning (pinPostgresSslMode)
- **path**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts
- **why reusable**: Rewrites weak sslmode aliases to verify-full and appends verify-full to any non-loopback URL that lacks one, with correct loopback and unix-socket detection (including bracketed IPv6). Prevents plaintext PHI on the wire for every provider whose dashboard hands out a bare connection string.
- **quality**: production-grade
- **coupling**: None — pure string function, 94 lines of tests.

### Item 7
- **name**: Injection-safe CSV export
- **path**: /home/user/catcorner22/dental/src/lib/export/csv.ts
- **why reusable**: Neutralizes spreadsheet formula injection (=+-@ TAB CR) BEFORE quoting, emits RFC 4180 CRLF, prepends a UTF-8 BOM so Excel renders accented clinician names, and ships no-store cache headers with a Windows-safe filename. Every PMS exports to Excel constantly; this is a solved problem to copy rather than re-derive.
- **quality**: production-grade
- **coupling**: None — pure functions. 96 lines of tests.

### Item 8
- **name**: Database-backed throttle with per-key budgets
- **path**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts
**why reusable**

The counter lives in `auth_throttle` rather than process memory, so a restart or a second instance cannot hand an attacker a fresh budget — essential on serverless. Doubling backoff with a cap, separate per-IP budget (30 attempts / 60s max lock, because a whole office shares one NAT) versus per-account (5 / 15min), a single-upsert read-modify-write so concurrent failures cannot overwrite each other, and a `justLocked` flag so refusals do not amplify into audit rows or email. Already reused for resend metering and CSV export metering.

- **quality**: production-grade
- **coupling**: One small table plus drizzle. Lifts directly.

### Item 9
- **name**: Email threading with a documented PHI rationale
- **path**: /home/user/catcorner22/dental/src/lib/email/threading.ts
**why reusable**

Random opaque ticket as the only thread token, with an explicit written argument for why initials+birth-year in a subject line is a Safe Harbor violation and re-identifying in a small practice. safeTicket() takes only the LEADING ticket-shaped run — which blocks CRLF header injection without folding attacker text into a well-formed Message-ID, a subtlety most sanitizers get wrong. Reusable verbatim for any outbound PMS notification.

- **quality**: production-grade
- **coupling**: Resend-shaped headers record; the functions themselves are pure. 97 lines of tests.

### Item 10
- **name**: Version-stamp CI guard
- **path**: /home/user/catcorner22/dental/.github/workflows/ci.yml
**why reusable**

Three enforced invariants: rules/vocab/module changes must bump RULESET_VERSION; prompt changes must touch ASSIST_PROMPT_VERSION; and any change to ddl.ts must bump SCHEMA_BOOT_VERSION or existing databases silently never receive the DDL. The third is the highest-value one to carry forward under any hand-rolled migration scheme, and the rationale comment explains the exact failure mode (works on a fresh local DB, 'column does not exist' in production).

- **quality**: solid
- **coupling**: Shell + git diff against the PR base; needs fetch-depth: 0. Trivially portable.

### Item 11
- **name**: Durability and stability harnesses
- **path**: /home/user/catcorner22/dental/scripts/postgres-durability.sh
**why reusable**

postgres-durability.sh is the only thing in either repo that exercises the real production persistence path: boot in production mode against real Postgres, write a clinician's whole day through the app's own HTTP API, kill the process, boot again, and verify every record is still readable through the app (and that boot 2 replays no DDL). stability-battery.sh runs 14 probes each against a freshly booted server with a repeat count for flake hunting, and stashes .env.local so it tests the app as shipped. A PHI-holding PMS needs both, extended with a restore-from-backup drill.

- **quality**: solid
- **coupling**: Bash + curl + node + a real Postgres URL; assumes `next start` and this repo's routes. The structure transfers; the probe bodies do not.

### Item 12
- **name**: Dual-control approval state machine with append-only event log
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts
**why reusable**

draft -> in_review -> approved -> published (+ rejected/retired), where neither the author nor the submitter may decide, a reject requires a note, publishing retires same-title predecessors, and every transition appends a practice_pack_events row carrying actor, from/to version, a JSON before/after snapshot, and the decision note. This is the segregation-of-duties primitive the merged product needs for fee-schedule changes, write-off approvals, refunds, and adjustment overrides — which is precisely the Precog gap.

- **quality**: solid
- **coupling**: Transitions are read-then-write WITHOUT a compare-and-set or transaction, so two concurrent decisions can race (the owner's own stability doc lists 'practice-pack CAS transitions' as a Later item). Redemptions in gamify.ts show the correct conditional-update pattern to apply here.

### Item 13
- **name**: Bounded audit write with marked truncation
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts
- **why reusable**: Length caps live at the single write site (action 64, name 200, target 200, detail 1000) rather than at ~30 call sites where forgetting is silent, and truncation appends a visible marker so a cut value never reads as a complete fact in a record whose purpose is being trusted. Ordering is (at DESC, id DESC) so ties are deterministic across loads. Both are the right defaults for a HIPAA access log.
- **quality**: production-grade
- **coupling**: One table plus drizzle.

### Item 14
- **name**: Frozen-attribution convention
- **path**: /home/user/catcorner22/dental/src/lib/db/schema.ts
**why reusable**

A consistent, documented rule applied across six tables: any name that appears in a record is snapshotted at write time (submitted_by_name, office_name, actor_name, author_name, user_name, item_title, created_by_name/decided_by_name) and the referencing id carries no FK, so the record outlives the account and a later rename or deletion cannot rewrite history. mergeUsers explicitly moves live drafts but never re-attributes filed submissions. This is the single most important convention to carry into a PHI-holding PMS.

- **quality**: production-grade
- **coupling**: Convention, not code. Needs discipline plus review, not a library.

### Item 15
- **name**: Bounded input primitives (readJson, pagination, int4)
- **path**: /home/user/catcorner22/dental/src/lib/http/readJson.ts
**why reusable**

MAX_BODY_BYTES=1MB checked on both the declared content-length and the bytes that actually arrived (chunked encoding defeats the former); object/empty/invalid tri-state so a literal `null` body becomes a 400 not a 500; page limits clamped to 200 with graceful fallback on garbage; and parseRowId rejecting out-of-int4-range path segments so `/submissions/1e21` is a 404 rather than a driver crash. Small, boring, and exactly the set of things a new codebase re-learns the hard way.

- **quality**: production-grade
- **coupling**: None — pure functions, all three tested.

## Weaknesses

- NO MULTI-TENANCY AT ALL. Grep across src/ for tenant/practice_id/organization_id/orgId returns zero hits. Every table is implicitly one practice; `offices` is the only location concept and is not a security boundary (repo comments say so explicitly: 'NOT a permission boundary'). There is no RLS, no `SET LOCAL app.tenant_id`, no schema-per-tenant, and no tenant column to add an index on. Converting this to multi-tenant is not an incremental change — it is a new schema with tenant scoping on every table, every index, every repo function signature, and every advisory-lock key.
- MIGRATIONS ARE A HAND-ROLLED IDEMPOTENT DDL ARRAY WITH A SINGLE GLOBAL INTEGER VERSION. `SCHEMA_BOOT_VERSION = 2` gates ~60 statements. There is no per-migration history table, no ordering guarantee beyond array position, no down migrations, no dry-run, no `--check` against a live database, and no safe mechanism for a destructive or data-transforming migration (the one backfill is an UPDATE embedded in the DDL array that re-runs on every fresh boot). `drizzle/0000_init.sql` covers 4 of 17 tables and is dead weight that will mislead the next reader. At PMS scale — where a column type change on a ledger table is a real event — this mechanism is inadequate and would need replacing with a proper migration runner.
- SCHEMA.TS AND DDL.TS CAN DRIFT SILENTLY AND ALREADY HAVE. `password_reset_tokens.user_id` is declared with no onDelete in schema.ts but `ON DELETE CASCADE` in ddl.ts. The `role` enum is declared with 5 values in schema.ts but created with 3 in ddl.ts and grown by ALTER TYPE. Nothing tests that the Drizzle model and the executed DDL agree; the only check is a human keeping two files in step, which the file header asks for ('Keep in sync with schema.ts').
- THE `schema` OBJECT PASSED TO drizzle() IS INCOMPLETE. schema.ts:390 exports only 11 of 17 tables — offices, userOffices, draftRevisions, pointsLedger, storeItems, redemptions, and userBlocks are missing. Harmless today because every query uses the core builder with table objects directly, but it means Drizzle's relational query API is unusable for those tables and the omission is invisible until someone tries.
- SUBMISSION AND AUDIT IMMUTABILITY IS CONVENTION, NOT ENFORCED. There is no PATCH route on submissions and the code says 'filed notes are immutable' — but there is no database trigger, no REVOKE UPDATE/DELETE, no append-only role, and no hash chain over audit_log rows. `finalizeSubmission()` (submissions.ts:51) is a general-purpose `UPDATE submissions SET note_markdown, audit_report WHERE id = ?` that any future route could call on any row. For a product whose legal defense is 'the record cannot be altered', this needs to become a database-level guarantee.
- NO READ-ACCESS AUDIT LOGGING. The audit log records submits, exports, deletes, merges, role changes, and sign-ins, but a `GET /api/submissions/[id]` or `GET /api/drafts/[id]` writes nothing. Once the product holds PHI, HIPAA 164.312(b) effectively requires recording who VIEWED which patient record; the current log answers 'who changed what', not 'who looked at whom'. There is also no break-glass flow and no minimum-necessary review report.
- NO BACKUP, RESTORE, OR DR STORY ANYWHERE. docs/GO-LIVE.md has 9 numbered steps and a post-deploy verification section, and none of them mention backups, PITR, retention, or a restore drill. The durability script proves records survive a process restart, not a database loss. For a PMS the restore drill is the deliverable, not the backup.
- NO ENCRYPTION AT REST OR FIELD-LEVEL ENCRYPTION. No pgcrypto, no envelope encryption, no KMS integration. Passwords are bcrypt-hashed and reset tokens are hash-only, but the MFA TOTP secret (`users.mfa_secret`) is stored in plaintext, and every note body is plaintext jsonb/text. Protection today rests entirely on the premise that no PHI is present, which is the exact premise the merged product abandons.
- CONNECTION POOL CEILING IS HARD-CODED AT 10. postgresPoolOptions clamps PG_POOL_MAX to `Math.min(floor(n), 10)` with a default of 1. Sensible for one-request-per-isolate serverless; a real cap for a long-lived Node server or a busy multi-tenant deployment, and there is no PgBouncer/Neon-pooler guidance beyond 'use the pooled string'. No `statement_timeout` or `idle_in_transaction_session_timeout` is set, so a hung query holds a connection for the full 60s route budget.
- GLOBAL ADVISORY LOCK CONSTANT WILL BECOME A CROSS-TENANT CONTENTION POINT. `ADMIN_GUARD_LOCK = 742001` (users.ts:145) serializes createFirstAdminGuarded, mergeUsers, and mutateAdminGuarded database-wide. In a shared multi-tenant database, one practice's user-admin activity would block every other practice's. The lock key needs tenant salting (the FNV-1a userSpendLockKey pattern in gamify.ts already shows how).
- LIMIT/OFFSET PAGINATION ONLY. parsePageParams produces `{limit, offset}` and every list uses `.limit().offset()`. Deep offsets degrade linearly and are unstable under concurrent inserts (a row can be seen twice or skipped). A PMS's transaction and appointment history needs keyset/cursor pagination. `listOpenStandardsWishes` is deliberately unbounded, and `listRedemptions` and `listPracticePacks` fetch whole tables then sort in JS.
- SEVERAL QUERIES MATERIALIZE LARGE SETS IN MEMORY. CSV export assembles up to 5,000 rows before responding, with no streaming (route comment acknowledges this and sets maxDuration=60). `listSubmissionsForDigest` pulls up to 500 FULL frozen notes plus audit reports. `recentNoteTexts` pulls 200 full note bodies. `countUserBlocks` selects rows and takes `.length` instead of `count(*)`, contradicting the count(*) pattern used everywhere else.
- SERIAL PRIMARY KEYS ARE GLOBALLY SEQUENTIAL AND USER-VISIBLE. The ticket is `DN-` + zero-padded `submissions.id`, so the ticket number leaks total filing volume across the whole deployment. Under multi-tenancy this becomes cross-tenant information disclosure and a per-tenant sequence or opaque id is required. Serial int4 also caps at ~2.1 billion, which int4.ts correctly guards against on input but which is the wrong type for a PMS transaction table.
- TIME IS HARD-CODED TO US EASTERN. `formatEasternTime` pins America/New_York and freezes the result as TEXT in `submissions.submitted_at_et`. A commercial PMS needs per-practice (arguably per-location) timezones; the frozen-text approach is right, the fixed zone is not.
- NO DOMAIN MODEL FOR THE PMS AT ALL. There is no patient, appointment, provider schedule, operatory, procedure code, fee schedule, insurance plan, claim, payment, adjustment, statement, recall, document, or image entity — and no money type anywhere (the only ledger is integer points). The entire clinical/financial core of the merged product is greenfield; what carries over is patterns, primitives, and roughly 6 of the 17 tables (users, offices, user_offices, audit_log, auth_throttle, password_reset_tokens) in modified form.
- NO OBJECT STORAGE OR BLOB HANDLING. Nothing in the schema or code handles files. Imaging, scanned consents, EOBs, and attachments are a first-class PMS requirement and a first-class PHI risk surface, and there is no signed-URL, virus-scan, or retention pattern to inherit.
- CI IS THIN FOR A PHI SYSTEM. One workflow, one blocking job: tsc + vitest + version guards + next build. No linter (eslint is not even a devDependency), no coverage threshold, no dependency audit, no secret scanning, no SAST, no container/IaC scan. Only ONE of the 16 e2e probes (crossbrowser.smoke.mjs) runs in CI, on an EPHEMERAL in-memory database with ALLOW_EPHEMERAL_DB=1 — so the production Postgres path, the DDL replay path, and the durability guarantee are never exercised by CI at all; they are manual scripts. The cross-browser job is continue-on-error, so it can be permanently yellow without blocking a merge.
- PRACTICE-PACK STATUS TRANSITIONS ARE READ-THEN-WRITE WITHOUT COMPARE-AND-SET. submitPack, decidePack, publishPack, and revisePublishedPack each `getPracticePack` then `update ... where id = ?` with no status predicate and no transaction. Two concurrent approvals, or an approve racing an edit, can both pass the status check. The correct pattern is already in this codebase (decideRedemption's `where(and(eq(id), eq(status,'requested')))`); the owner's own knowledge doc lists 'practice-pack CAS transitions' as an unshipped Later item.
- SILENT CATCHES SWALLOW FAILURES. `awardForSubmission`/`awardOnce` catch every error and return null/false to treat a unique-index collision as a no-op — which also silently eats a connection error or a constraint bug. The post-filing award block, the office seed, and the MFA sweep all catch broadly. The owner's stability doc flags this ('gamify silent catches: surface couldn't reach server instead of award miss') as unaddressed.
- CLIENT-SIDE LOCAL BACKUP STORES NOTE CONTENT IN INDEXEDDB AND localStorage UNENCRYPTED. draftBackup.ts mirrors the full note state to the device. Today that content is de-identified by policy; once the product holds PHI, an unencrypted same-device mirror on a shared operatory tablet is a breach surface. clearAllDraftBackups() exists for sign-out and is best-effort (swallows every error), so a failed wipe is invisible.
- SINGLE-COMMIT GIT HISTORY. `git rev-list --count HEAD` returns 1 — the repo is one squashed commit dated 2026-08-09. There is no change history to review, no ability to bisect, and no record of why any given decision was made beyond the (admittedly excellent) code comments.

## Phi security observations

- The product's PHI posture is 'we do not store it', enforced at the application boundary rather than in the database. `runPhiRule` is applied to the composed note AND to the draft title (because slugifyTitle becomes the emailed attachment filename — a note titled with a patient's name previously left the building as 'john-smith-crown-seat-DN-0001.md' while the body reported AUDIT PASS). A PHI stop can only be waived with a validated free-text attestation (isValidPhiAttestation), server-checked, and the waiver is written to the audit log with the rule ids but deliberately NOT the matched text. Killer findings have no checkbox bypass at all.
- TLS to the database is pinned to verify-full for every non-loopback host (pinPostgresSslMode). The prior implementation only pinned for *.neon.tech, meaning Supabase/RDS/Railway/self-hosted URLs without an explicit sslmode connected in PLAINTEXT — the comment names this as the bug and the fix inverts the rule. This is the single highest-value security fix in the data layer and should be carried forward verbatim.
- Passwords are bcrypt cost 12; reset tokens are stored as a HASH only, single-use (usedAt), short-lived (expiresAt), with issuance invalidating prior live tokens and redemption retiring any others in the same transaction. `setPasswordAndRevokeLinks` is documented as the mandatory path for every password write so a previously-mailed link cannot survive a user's own remediation. Session revocation uses a watermark pair (password_changed_at + sessions_revoked_at) so 'sign out everywhere' works without a password change.
- The MFA TOTP secret is stored in PLAINTEXT in `users.mfa_secret`. The comment says it is never logged and never returned after enrollment, but a database dump hands over every second factor. This is the one credential in the schema that is not hashed or encrypted.
- There is NO read-access logging. Viewing a draft or a submission writes nothing to audit_log. Exports, submits, deletes, merges, role changes, reset-link issuance, and sign-ins are logged. For a PHI-holding PMS this is the largest compliance gap in the data layer.
- There is NO row-level security, no tenant isolation, and no database-level role separation. The application connects as a single superuser-equivalent role and every isolation guarantee is a WHERE clause in a repo function. Ownership scoping is consistently applied (userBlocks takes ownerId on every function precisely so 'a route bug cannot leak one writer's templates to another'; drafts/submissions GETs 404 rather than 403 for non-owners), but it is defense by convention.
- Clinical content leaves the system by email through Resend as two attachments (frozen note + audit report). The recipient is server-configured only, and the submit route refuses any request body carrying a recipient key in any case. GO-LIVE.md explicitly states 'Resend therefore processes clinical content: get a BAA in place before real patient records flow', and says the same for the AI gateway. Third-party calls in the data path: Resend (email), the AI gateway (assist/SuperByte, behind a PHI gate and off by default), and law-watch outbound fetches (public sources only, no note data).
- Email threading tokens are the random ticket and nothing else, with a written HIPAA Safe Harbor argument for why initials+birth-year in a subject line would be a violation (subject lines cross mail servers in the clear, appear in bounce messages, out-of-office replies, mail search indexes, and lock-screen notification previews) and why hiding it as white text makes it worse. safeTicket() takes only the leading ticket-shaped run, which blocks CRLF header injection WITHOUT folding attacker text into a well-formed Message-ID.
- The audit log is bounded at the single write site (action 64 / name 200 / target 200 / detail 1000 chars) with a visible truncation marker, specifically so a route echoing an unbounded third-party error cannot turn the log into attacker-controlled storage — a log that is both rendered on a page and exported to CSV, so the cost would land twice.
- CSV export neutralizes spreadsheet formula injection before quoting, with the rationale that display names are set by Team Leads on accounts they create and the export is read by the people with the most authority. Export authorization mirrors the screen (submissions scoped by seesAllNotes; user emails masked unless the viewer could already mail a reset link there), exports are metered (12 free attempts), and every export writes an audit row whose row count is taken from the rendered rows rather than by splitting the CSV text (so a user cannot inflate the recorded number by typing a newline).
- The failed-auth throttle lives in the database, not process memory, so a cold start or a second serverless instance cannot hand an attacker a fresh budget. Per-IP budgets are deliberately much larger than per-account ones with a 60-second max lock, because a whole practice shares one NAT address and a 15-minute IP lock would take the front desk offline.
- Separation of duties is implemented in several places and is the most PMS-relevant security work in the repo: the reset-link route refuses to let the actor who repointed an email address also mail a link to it (emailChangedAt/emailChangedBy); `isCreatureOf` walks the createdById chain up to 16 hops with a cycle guard so a sock puppet at one remove cannot receive another clinician's drafts; practice packs and store redemptions both refuse self-approval; and last-active-admin protection is enforced under an advisory lock so two concurrent demotions cannot together lock everyone out.
- Local device mirrors (IndexedDB + localStorage) hold full note content unencrypted, with a best-effort whole-device wipe on sign-out for shared tablets. Under a PHI regime this needs encryption-at-rest on the device or removal in favor of server-only recovery.
- Client-side data is never trusted for anything that reaches the record: the server recomposes and re-audits at submit, validates officeId against the configured list rather than accepting free text, sanitizes all user text against markdown block-start forgery before it enters the frozen note (the comment enumerates five prior bypasses: 4-space indent, setext underline, raw HTML, unterminated HTML comment which erases the rest of the document, and unterminated code fences), and bounds every string that reaches the stamp.

## Product insights

- The 'frozen attribution' rule is the strongest product idea in this repo and maps straight onto the PMS's biggest documented pain (ledgers an owner cannot audit, only 17% of embezzlement caught by designed controls). Any name shown on a record is snapshotted at write time and the referencing id carries no FK, so the record outlives the account. mergeUsers moves live drafts but explicitly never re-attributes filed submissions: 'retroactively re-attributing them to a different account would forge history.' Applied to a patient ledger, this means an adjustment, write-off, or refund permanently names who did it even after that employee is deleted.
- A ledger whose balance is `sum(delta)` rather than a stored column is the direct architectural answer to 'no PMS is praised for ledger clarity after dual insurance/partial payments.' Every posting is an immutable row with a reason and a typed reference; reversals append rather than delete; and the DB-level partial unique index makes replays free. That gives a reconcilable, explainable A/R by construction and lets the UI show 'here is every event that produced this balance' instead of an opaque allocation.
- The re-file guard is a subtle correctness idea worth carrying: duplicate detection compares the COMPOSED artifact (filedNoteEqual), not the raw state, because composition normalizes value order, whitespace, and stray otherText — a raw compare reported 'changed' when re-toggling a multiselect chip reordered an array, which re-opened the gate and would have filed a second identical ticket for the same encounter. The PMS equivalent: dedupe a claim or statement on the rendered submission, not on the form model.
- The email-failure design separates 'is it filed' from 'did it deliver.' `lastSubmissionId` (a fact) blocks a second filing; the cached `status` string only drives the UI chip. So a failed send leaves the note resendable but NOT re-fileable, and Resend puts the exact frozen bytes back on the wire rather than recomposing under a newer ruleset. Before this existed, the only recovery was to submit again, which grew the permanent record by one duplicate per retry. Any PMS with outbound claims, statements, or e-prescriptions needs exactly this split.
- Status is cached on the row but computed for the OWNER's clinical role, not the editor's — a Team Lead saving a hygienist's note must not stamp 'Ready' onto a note that still requires dentist filing, and a transfer restamps for the RECIPIENT so a hygienist->dentist handoff does not leave 'Dentist must file' forever. Role-dependent derived state is a real trap in a PMS with mixed-credential staff.
- The office is a per-ENCOUNTER property, not a per-person one — 'staff rotate, and a patient may be seen at one office for an emergency and another for recall' — and user_offices is explicitly ordering-only, never a permission boundary. That is the right multi-location model for the merged product and the opposite of what most systems do. Changing the office after filing re-opens the submit gate because a note recorded at the wrong location is a materially wrong record, and 'a corrected second ticket is better than a permanent first one that is false about where care happened.'
- Autosave reliability is framed as a patient-outcome risk rather than a convenience: 'Smile Notes files what the SERVER holds at submit time, so unsaved local keystrokes are a patient-outcome risk.' Submit is hard-gated on flush() returning 'clean'. Given the research finding that no cloud PMS documents an offline mode and Curve had 6+ hour outages, the five-layer stack (debounce+OCC, pagehide keepalive flush, online retry with backoff, IndexedDB device mirror, capped server revision ring) plus the explicit rejection of CRDT stacks for single-author clinical documents is a defensible differentiator.
- Server revision rings are deliberately labeled 'working-copy recovery, not legal history' and capped at 20, kept strictly distinct from immutable filed submissions. Keeping that line bright avoids the trap of a chart history that is neither a real audit trail nor a usable undo.
- Dual-control with a mandatory reason is applied consistently: a rejected practice pack needs a note 'so the author knows what to fix', a declined store redemption needs 'a short note back to the person who asked' because 'a decline with no reason teaches people to stop asking', and neither author nor submitter may decide their own item. That is the interactive-controls product Precog is aiming at, already expressed as working code — and it generalizes to refund/adjustment/write-off approval thresholds.
- The wish list is deliberately the LOWEST-friction surface in the app ('the cost of a bad suggestion is that somebody reads a sentence and moves on, while the cost of a suppressed safety observation is unbounded') and non-anonymous by design. Critically, `listOpenStandardsWishes` is deliberately unbounded because the paged version applied LIMIT before ranking, so an open 'sterilizer running cold' could fall off the query and take the amber banner's count to zero — 'the one mechanism designed to stop a safety report being buried was computed from the buried set.' A safety-reporting channel in the PMS should copy both the low friction and that specific bug lesson.
- Error copy is treated as product surface: saveErrorMessage prefers the route's human sentence over a status code but suppresses programmer-facing wire-format words ('baseVersion', 'noteState'), because a false positive there throws away a refusal the writer needed to read. The ByteAudit refusal gets its own status and message because 'try again' is exactly wrong advice for an artifact that will be rebuilt and refused identically.
- Seeds are one-time, never reconciliation: 'a practice that renames an office through the app must not find the old name back after the next deploy.' Small rule, and the difference between an operator trusting the software and not.
- The market research reinforces two data-layer priorities: data ownership/portability is a top buyer concern at switching time (Eaglesoft's unbridgeable proprietary x-rays, Dentrix images outside the database, tab32's data-exit dispute, Open Dental's month-to-month and standard MySQL as a selling point), and conversion cost/quality is a real purchase blocker ($1,450+/database published, separate image conversion, insurance benefits that do not convert, up to 30 business days of EDI re-enrollment). A documented export format and an honest conversion story are product features, not chores.

## Test and ci posture

"VOLUME: 201 test files (`src/**/*.test.ts{,x}`), ~24,960 lines of test code against ~635 source files — roughly a 1:3 test-file-to-source-file ratio. Largest clusters: src/lib/standardize (19), src/lib/auth (15), src/lib/audit/rules (14), src/components/builder (14), src/lib/status (9), src/lib/db (8), src/lib/audit (8).\n\nDB TESTS: 8 files, ~1,600 lines. `src/lib/db/db.test.ts` is the centerpiece — 39 tests in one describe over a real PGlite instance (`createTestDb()` in testDb.ts spins a fresh `memory://` Postgres and runs the same embedded `applySchema` the runtime uses, so tests exercise the ACTUAL DDL, not a parallel definition). Coverage includes: unique usernames, last-active-admin guard, OCC bump and stale-write rejection, revision ring recording and pruning, home-page draft selection, transfer version bump and status restamp, idempotent notice ack, auth throttle, audit-log input bounds, the last_submission_id backfill, the enum migration accepting all 5 hierarchy roles, merge-users (a nested describe), sequential ticket minting and frozen text, atomic filing (one winner / no phantom / resubmit-after-edit), and FK-safe deletion counting. `gamify.test.ts` (189 lines, 13 tests) covers exactly-once payment under retry, XP-not-reduced-by-spending, atomic overspend refusal, refund-by-append, no-double-decide, no-self-approve, and CONCURRENT redemptions against one balance. `offices.test.ts` (251), `resetTokens.test.ts` (149), `repo/practicePacks.test.ts` (93, dual-control), `backend.test.ts` (102, pure env matrix including the operator-paste trap), `postgresUrl.test.ts` (94), `schemaBoot.test.ts` (43), `int4.test.ts` (30).\n\nOTHER DATA-OPS TESTS: `src/lib/compose/filedNoteEqual.test.ts` and `injection.test.ts` (markdown/stamp forgery), `src/lib/email/threading.test.ts` (97, header injection + threading), `src/lib/export/csv.test.ts` (96, formula injection), `src/lib/http/{readJson,pagination}.test.ts`, `src/lib/client/{autosaveMachine,draftBackup,apiReady}.test.ts` (141/116/73), `src/lib/state/noteReducer.test.ts` (134), `src/lib/tickets/tickets.test.ts` (86).\n\nRUNNER: vitest 3, `environment: \"node\"` by default with per-file `// @vitest-environment jsdom` opt-in for component tests (deliberately chosen over the deprecated environmentMatchGlobs and over a two-project split), esbuild `jsx: \"automatic\"` so .tsx tests run without touching the tsconfig the app builds with. Single setup file `src/test/setup.ts`. No coverage configuration and no threshold.\n\nE2E: 16 hand-rolled Node scripts in `e2e/` driving Playwright — headers, prehydration.login, hydration.clean, ttfa, lockout, account.lifecycle, mfa.totp, conflict, dictation, submission.immutability, export.aioff, phi.mask-override, email.assist, setup.firstboot, crossbrowser.smoke, plus a `_noteSeed.mjs` helper. These are NOT run by CI except crossbrowser.smoke; the rest run locally via `scripts/stability-battery.sh`, which boots a fresh server per probe, takes a repeat count for flake hunting, and stashes `.env.local` so the battery tests the app as shipped rather than the app plus the developer's dotfile.\n\nCI (`.github/workflows/ci.yml`, on push to main and all PRs): job `test-and-build` runs `npm ci`, `npx tsc --noEmit`, `npm test`, three version-stamp guards, then `npm run build`. The guards are the distinguishing feature — a diff touching src/lib/{vocab,modules}/ or src/lib/audit/{rules,maskPhi} must also touch `src/lib/version.ts`; a diff touching src/lib/assist/prompts.ts must mention ASSIST_PROMPT_VERSION; and a diff touching src/lib/db/ddl.ts must mention SCHEMA_BOOT_VERSION, with the comment explaining that new DDL under an unchanged constant reaches a fresh local database and NEVER reaches production. Requires fetch-depth: 0 for the merge base. Job `cross-browser` is `continue-on-error: true` with `timeout-minutes: 15` (added after a job sat in_progress for 25 minutes), installs Playwright with `--no-save` because the dev sandbox cannot fetch browsers, builds, starts `next start` on an in-memory database with `ALLOW_EPHEMERAL_DB=1`, waits for /login, and runs one smoke across chromium/firefox/webkit.\n\nGAPS: no linter at all (eslint is not in devDependencies), no coverage gate, no dependency audit / SAST / secret scanning, no CI job that touches real Postgres — so the production driver path, the DDL replay-skip behavior, and the durability guarantee are verified only by manually-run scripts (`scripts/postgres-durability.sh`), not by any automated gate. 15 of 16 e2e probes never run in CI. The single blocking job means a green PR proves types compile, unit tests pass, version stamps were bumped, and the app builds — nothing about persistence under the driver production actually uses."

## Open questions

- Is the hand-rolled `SCHEMA_BOOT_VERSION` + idempotent-DDL-array mechanism intended to survive into the merged product, or should the PMS adopt a real migration runner (drizzle-kit, Atlas, sqitch) with per-migration history, down migrations, and a CI check that a fresh database and a migrated database produce identical schemas? The current mechanism cannot express a destructive or data-transforming migration safely, and it has already drifted from schema.ts in at least two places.
- What is the tenancy model for the merged product: shared database with a tenant_id column plus Postgres RLS, schema-per-tenant, or database-per-practice? This decision determines whether ANY of the current tables can be carried forward as-is, how advisory-lock keys must be salted, whether serial ids can remain user-visible, and what the pooling story looks like. Nothing in either repo commits to an answer.
- Does the merged PMS keep Vercel serverless, or move to a long-lived Node/container deployment? The `max: 1` pool default, the 10-connection hard clamp, the globalThis bootstrap memo, the 60-second maxDuration ceiling, and the whole `resolveDbBackend` design are shaped by serverless isolates. A PHI-holding PMS with background jobs (claim batches, recall runs, statement generation, eligibility checks) has no obvious home on this platform, and nothing in the repo runs work outside a request except one weekly Vercel cron.
- What is the backup, PITR, retention, and restore-drill plan, and who owns it? GO-LIVE.md has nine steps and none of them mention backups. For a PMS the restore drill is the compliance artifact, not the backup itself. Related: what is the record retention and purge policy once PHI is stored (state dental record retention vs HIPAA 6-year documentation retention are different clocks)?
- Should submission and audit-log immutability become a database-level guarantee (append-only role with REVOKE UPDATE/DELETE, a BEFORE UPDATE trigger, or hash-chained rows) rather than the current convention plus the general-purpose `finalizeSubmission` UPDATE that any route could call? The ByteAudit seal (`scripts/byteaudit-seal.mjs` + in-transaction `byteAuditVerify`) suggests the owner already values tamper-evidence and may want to extend it to stored rows.
- How will PHI read-access be logged, and at what granularity — per record view, per search result set, per report run? This is the largest compliance gap in the current data layer and it has performance implications (an access log on a busy schedule view generates far more rows than the current audit_log ever sees), so it needs a design decision, not a retrofit.
- Is the points economy (points_ledger, store_items, redemptions, badges, GPA) staying in the commercial product? It is roughly 700 lines of schema+repo+route and 189 lines of tests, and the research file contains an adversarial persona document (`knowledge/sources/adversarial-rdh-surveillance-labor.md`) that presumably argues against staff scoreboards. If it goes, the append-only ledger PATTERN should be extracted first and repointed at patient A/R — that is the highest-value reuse in either repo.
- Where do images, documents, and scanned consents live? Nothing in the schema handles blobs, and the research names imaging lock-in and conversion cost as top buyer concerns. Object storage choice, signed-URL policy, virus scanning, DICOM handling, and retention need a decision before the schema is designed around them.
- What is the plan for money types and rounding? There are no decimal/numeric columns anywhere and the only ledger uses integer points. Integer cents with an explicit currency column is the obvious choice, but allocation logic (dual insurance, partial payments, transfer adjustments) is exactly what the market research says every incumbent gets wrong, so it deserves a written spec and a property-test suite before any code.
- Does the merged product keep email-as-export at all, or move to an in-app record with signed download links? Emailing clinical attachments through Resend requires a BAA and puts PHI in a mailbox nobody controls after delivery. The frozen-artifact + resend-exact-bytes pattern is worth keeping regardless of the transport.
- Per-practice (or per-location) timezone handling: `formatEasternTime` is hard-coded to America/New_York and the result is frozen as text. Freezing a rendered local time is right; the zone needs to come from configuration, which means a decision about whether it lives on the tenant or on the office.
- Should the `offices` / `user_offices` model be promoted to a real permission boundary in the PMS? Smile Notes deliberately makes it ordering-only ('a patient may be seen anywhere and cover is arranged at short notice'), which is the correct clinical answer but the wrong answer for a DSO or group practice that needs location-scoped financial reporting and staff access. The two requirements may need different axes.
- Only one squashed commit exists in the dental repo, so there is no way to see which of the documented 'this used to be broken' comments correspond to shipped fixes versus aspirational notes. Is there an upstream repository with real history that should be consulted before deciding what is battle-tested?
