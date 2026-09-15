# Competitive enhancement review and Phase 0 increment

> Source: owner review of 2026-09-14. The owner asked for a comprehensive, beautiful, low-cognitive-load dental PMS with an industry-leading one-way SuperByte note advisor (twin deterministic and probabilistic knowledge bases; see Smile Notes) and a novel Precog risk-avoidance module. Two decisions lock this document: start Phase 0 of the real product, and keep SuperByte one-way (staff never prompt, chat, or rate). Evidence for market claims is the v3 knowledge base (`knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md`, `knowledge/semantic-memory.md`). Legal statements inherit the PRIMARY / SECONDARY / REPO / UNVERIFIED labels from `docs/11`.

This repository remains a consolidation plan plus a clickable prototype. Increment 0.1, recorded here, is the first code foundation of the merged PMS. Increment 0.2 wires the sessions table and `/api/me`. Increment 0.3 makes the database real: migrations that apply, roles that exist, and a verifier that reads a live chain. Increment 0.4 forces MFA enrollment on first login and seeds two Postgres tenants without `AUTH_DEV_MEMORY`. Increment 0.5 splits ledger appends to `app_append`, records nightly chain checks, and schedules the verifier. Increment 0.6 adds the `disclosures` schema and a two-admin recovery ceremony. Increment 0.7 anchors signed chain heads to Object Lock storage. Increment 0.8 wires the disclosure egress pattern and tenant-wide session revoke for incident response. Increment 0.9 adds golden snapshot tests for every exported controls-engine scorer. Increment 0.10 adds the restore drill CLI. Increment 0.11 refuses `DEV_MFA_KEY` in production boot and adds the PHI-free usage-metrics package. Owner-only Phase 0 items (BAA, hosting contract, 24-month budget, D.8 interviews) stay listed, not silently marked done.

## Current state

| Layer | Status |
|---|---|
| Vision, architecture, data model, 25 ADRs, 30-feature catalog | Complete (planning session 2026-09-03) |
| Clickable prototype (`prototype/`) | Seven persona homes, five daily flows, 117 UX heuristics, 0 axe violations in 144 contexts |
| Production PMS (`apps/pms`, packages) | Starts in this increment |
| Smile Notes (`CatCorner22/dental`) | External; ~34k LOC clinical core, 201 test files; de-identified by design |
| Precog Pioneer (`CatCorner22/precog`) | External; ~4,700-line engine, zero tests, localStorage, broken home route |

The existing plan is already stronger than most greenfield PMS briefs. The gaps versus the five goals are sequencing, knowledge-base depth, visual ambition, and a broader definition of risk-avoidance — not a missing module list.

## Competitive position

Incumbents a GP will compare you to: Dentrix, Eaglesoft, Open Dental, Dentrix Ascend, Denticon, Curve SuperHero, CareStack. Adjacent AI: Curve Care+, Dentrix Voice Notes / Detect AI, Denticon Voice Perio, Pearl / Overjet / VideaHealth. Adjacent risk: Zeldent (observe-only bank-to-PMS recon), Abyde / Patient Protect (HIPAA/OSHA), Prosperident (forensic, after the loss).

**Where incumbents win today.** Hiring-pool familiarity (Dentrix / Eaglesoft). Insurance plumbing and clearinghouse years (HS1, Open Dental, Curve unlimited eClaims). Ambient / voice charting already shipping (Ascend Voice Notes and Voice Perio, Curve Care+, Denticon AI Voice). Native imaging and sensor lists. Patient comms, portal, and eRx in the base or as a known add-on.

**Where this product can win if it ships what is already designed.**

- A ledger both the window and the CPA can read after dual coverage and partial payments. No harvested review praises any incumbent for that.
- Controls that refuse inside the posting transaction. Zeldent and every PMS audit trail can only observe; Precog today only calculates. The PMS is the only host that can block the $410 courtesy write-off.
- Chairside notes whose evidence is a versioned deterministic gate (`RULESET_VERSION`, `verifyMeaning`, encounter FK), not a template the biller retypes into the claim.
- Published rate card, year-two price, no-fee exit including DICOM, no per-use AI metering — the cheapest differentiators, and the ones tab32 and Dentrix/Eaglesoft lose on.

**Where the plan was behind the market narrative (corrected below).** SuperByte sat in Phase 5 and Byte's knowledge table is 23 entries. Precog was specified as financial SoD / dual-release / COSO, not clinical and compliance near-miss avoidance. The visual system is NHS / GOV.UK-grade: extremely usable, not yet beautiful. A controls-only public identity would be compared to Zeldent and lose on price.

## Five public pillars

These are the product's public pillars. They do not replace the three structural bets in `docs/01` (readable ledger, enforced controls, chairside record). They name what a buyer and a daily user should be able to say about the software.

1. **A comprehensive GP practice-management system.** Independent general practices, 1–3 dentists at launch, Tennessee first. The Trust page publishes an honest In / Later / Not list so "comprehensive" is not a silent promise of ortho, OMS, or TennCare.
2. **Aesthetically beautiful and modern.** The 117 heuristics, 44 px glove floor, two button identities, and monotonic severity ladder are floors. Beauty is a layer that does not add choices: quieter chrome, one editorial display face for h1 only, more generous rag on worklists, signature empty states that still name the next verb. Encounter density is decomposed, not decorated.
3. **Industry-leading minimization of cognitive load.** Home is the work. One primary action per row. Byte on the note so the completeness checklist is not held in working memory. Palette with incumbent vocabulary so hiring-pool familiarity is a search problem, not a training problem.
4. **SuperByte, one-way, with a twin knowledge base.** Staff never prompt, chat, or rate. The deterministic Byte twin and a versioned, cited knowledge base ship as packages in Phase 0 and appear on the Encounter in Phase 3. The SuperByte cage (killswitch, dual PHI scan, N-read consensus, `verifyMeaning`, evidence quotes, audit row with no note text) ships in Phase 0 with the provider call still Phase 5. Ambient scribe is ceded short-term; PTT voice stays Phase 5. Never claim "AI-powered." Never meter. Never show a confidence percentage. Never train on filed notes.
5. **Precog as risk-avoidance, not a heat map.** One Practice Risk surface that prevents the next bad action: financial (dual release, SoD grant refusal, bank-tied close), clinical (killers, encounter FK, chart/note/claim contradiction, open referral, undispositioned tag), compliance (BAA registry now; HIPAA/OSHA program after counsel). Never score people. Military and "threat assessment" vocabulary stays deleted.

## In / Later / Not (Trust page copy)

**In by GA (already in the module map).** Tenancy, patients, Board, encounters, odontogram, six-point perio, treatment plans, readable ledger, checkout, membership and payment plans, eligibility, claims, ERA, denials, lab cases, referrals, imaging import, confirmations, reports that reconcile to the ledger, conversion, exit export.

**Later (do not pull into Phase 0–1).** eRx, portal, two-way text, online booking, digital intake, voice perio, sensor bridge, groups/SSO, public write API, specialty modules, TennCare.

**Not at launch (say so).** Inventory, time-clock, and payroll as a system of record; marketing and reputation; teledentistry; Canada; DSO enterprise.

The Phase 1 shadow-ledger wedge stays. It is how the novel thesis gets a falsifier before claims and notes exist. Frame it as "the money layer of the PMS, run beside your current system," not as a separate product name.

## SuperByte and the knowledge base

Industry-leading here is the twin, not the model. Curve and HS1 already sell ambient notes. A 23-entry advisor cannot compete on that headline. A versioned, cited, module-mapped corpus that a counsel can review, plus a cage that refuses unsafe rewrites, can.

| Layer | What it is | When it ships |
|---|---|---|
| Deterministic Byte | Pure `advise()` over a versioned, cited knowledge base; gauges are presence-only, never a percentage | Package in Phase 0 (`packages/clinical-kb`); on the Encounter in Phase 3 |
| Knowledge base | Grow from 23 entries to a module-mapped, counsel-reviewable corpus (completeness, justification, med-safety, TN scope, claim-narrative, omission licences) | Authoring starts in Phase 0; `KB_VERSION` stamped |
| SuperByte cage | One-way, killswitch, dual PHI scan, N-read consensus, `verifyMeaning`, evidence quotes, audit row with no note text | Cage and twin CI in Phase 0; provider call Phase 5 |
| Ambient scribe | Cede the marketing lane short-term; PTT voice behind the existing `DictationEngine` seam | Phase 5 |

Hard rules: `BYTESTAR_ENABLED` defaults off; no provider key is required to boot; SuperByte must not auto-fire on every keystroke (the 3-read cost model in explorer-05 is a standing risk); one-way stays server-enforced.

## Precog as Practice Risk

Zeldent watches the bank. Abyde writes HIPAA policies. Precog today scores demo data. The novel module refuses or records from live `domain_event` rows.

- **Financial (enforced in Phase 1).** `evaluateRelease` and `detectSodConflicts` port in Phase 0 onto `PracticeState`; they refuse inside the Postgres posting transaction in Phase 1.
- **Clinical (avoidance in Phase 3).** Smile Notes killers, encounter FK, contradiction stop. A missing interpretation, open referral, or undispositioned hygienist tag is a Board or Exams row, not a weekly PDF.
- **Compliance (boundary now, program later).** `integration_registry` requires a live BAA row before a connector enables (Phase 0). HIPAA/OSHA program stays Phase 4 after counsel.
- **Math on port.** Timeline sign, counterfactual ignoring variables, beam-search dropping the status quo, `waive_dual` infinity leak. Golden and monotonicity tests before any score is shown. Constants labelled directional until a CPA calibrates them.

## Beauty and cognitive load

The prototype already leads the category on measurement: controls above the fold 530 → 293; chip vocabulary 103 → 48; five flows inside tap budgets; 0 axe violations. `docs/16` treated "modern" as a byproduct of restraint. Beauty is now a goal that may not violate those floors.

- Keep cream / navy / teal (Daylight chart). Do not copy Linear's 28 px targets or dashboard ornament.
- Tokens stay the contract: `prototype/css/tokens.css` becomes `apps/pms` theme via the dental `design-tokens.json` pipeline.
- The remaining density problem is Encounter (58 controls above the fold). `BuilderShell.tsx` (2,127 LOC in Smile Notes) must not land as one screen.
- Next load reductions are product, not CSS: Byte on the note; one primary action per row enforced by the gate-contract CI (feature 29); paint-once-write-four-records; palette synonyms.

## Decisions accepted in this increment

| Decision | Status | Amendment |
|---|---|---|
| ADR-0002 (what ships first) | **Accepted** | Money and controls first as GTM (report-import shadow ledger). Product identity is the full PMS from the first public page. |
| ADR-0012 (AI assist timing) | **Accepted, amended** | LLM provider call remains Phase 5 behind a BAA. Byte, `packages/clinical-kb`, and the SuperByte cage ship in Phase 0. SuperByte stays one-way. |
| Other ADRs | Proposed | Stand unless Increment 0.1 forces a pin (NextAuth v5 beta, Tailwind 3). |

## Increment 0.1 (this engagement)

Phase 0 as written is 8–10 weeks plus legal pack, budget, and D.8 interviews. This increment is the code foundation only.

- `apps/pms` — Next.js 15 App Router, React 19, TypeScript, Tailwind 3. Sign-in and empty shell. `withGuard` plus a CI glob that fails on a bare route export.
- `packages/clinical-core` — lift audit, vocab, modules, verify, extract, standardize, compose, readback. `runTextAudit` stays pure.
- `packages/clinical-kb` — Byte `advise()`, versioned knowledge table, SuperByte cage with `BYTESTAR_ENABLED` default off.
- `packages/controls-engine` — SoD, dual-release, residual, COSO, signals on `PracticeState`; known math bugs fixed; golden, monotonicity, and zero-app-import tests.
- `packages/db` — Drizzle tenants, locations, users, sessions, entitlements, `domain_event`, `phi_access_log`, `integration_registry`. RLS. No PHI patient rows yet.
- `packages/verifier` — byteaudit retargeted at chain verification and an RLS negative test.
- Auth: lifted dental guards, mandatory TOTP, sessions table, envelope-encrypted MFA secret (dev: local key).
- Prototype and its harness stay green.

**Not in Increment 0.1.** Ledger UI, claims, Board, imaging, hosting/WAF, real KMS, Object Lock, legal pack, D.8 interviews, product name, clearinghouse contract.

## Increment 0.2

Wires the Increment 0.1 sessions table so sign-in is real.

- `authorizeCredentials` against an `AuthStore`: password, mandatory TOTP, one-time recovery codes, pair-keyed throttle, process-wide hash gate.
- Successful sign-in inserts a `sessions` row. The JWT carries only that opaque id. `withGuard` / `requireAccess` re-read the row on every call.
- Deactivating a user revokes every live session. `/api/me` returns identity once ports are configured.
- `AUTH_DEV_MEMORY=1` seeds two synthetic tenants (Ridgeview, Oakridge) with no patient rows. Forbidden in production.
- `POSTGRES_URL` selects the Drizzle store. Login reads users through `auth_lookup_user` (SECURITY DEFINER) so FORCE RLS does not hide the row before tenant context exists. Writes use `SET LOCAL` (`set_config(..., true)`).
- The sign-in form is a server action (pre-hydration POST still authenticates). Failure copy never names the reason.

**Not in Increment 0.2.** Two-admin recovery ceremony UI, real KMS, Object Lock, ledger UI, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.3

Increments 0.1 and 0.2 left the database as SQL files nobody applied, roles that existed only as comments, and an RLS test that read migration text. This increment runs all of it against PostgreSQL 16, in CI and locally, and keeps what the live database disproved.

- `packages/db` gains a plain-SQL migration runner: `schema_migrations` with SHA-256 checksums, an advisory lock, one transaction per file, refusal on a rewritten historical file or a numbering gap. `pnpm db:roles | db:migrate | db:status | db:reset`. drizzle-kit stays for schema diffing only.
- `sql/roles.sql` creates the cluster roles once per database. Migration 0003 grants them: `app_rw` reads, inserts, and updates mutable tables and may never DELETE users or sessions; `app_rw` and `app_append` may INSERT into `domain_event` and `phi_access_log` and no role may UPDATE or DELETE a row there; `app_verify` holds SELECT on `domain_event` alone, admitted across tenants by a role-scoped policy.
- The SECURITY DEFINER auth lookups are handed to `app_auth_lookup`, a role that owns nothing else, with role-scoped SELECT policies on `users` and `sessions`. FORCE RLS binds table owners, so a migrator-owned lookup returned no rows; a superuser-owned one would have passed CI and failed in production.
- Migration 0004 adds a per-tenant `seq` to `domain_event` with `UNIQUE (tenant_id, seq)`. Chain order is `seq`, not `occurred_at`: two events in one millisecond have no time order, and two concurrent appends could otherwise fork the chain with nothing firing.
- `packages/verifier` gains `verifyDatabaseChains` and a `verify:chain` CLI that connects as `app_verify`, verifies each tenant's chain (genesis, hash, links, dense sequence), prints one JSON verdict, and exits 1 on any refusal. It writes nothing. It first proves the connection holds `app_verify`: an ordinary role sees zero rows under RLS, and an empty view must not pass as a clean chain.
- Appends take a transaction-scoped advisory lock per tenant before reading the last row, so concurrent writers serialize; the unique `seq` index stays as the backstop.
- `apps/pms/src/instrumentation.ts` calls the boot guard that 0.1 defined and never invoked. Production also asks its live connection who it is and refuses a superuser, BYPASSRLS, or table-owning role.
- CI runs a Postgres 16 service: roles and migrations apply from empty as `app_migrate`, the verifier runs as `app_verify`, and the live suites are mandatory (`PMS_TEST_POSTGRES_REQUIRED=1`). Locally they skip without `PMS_TEST_POSTGRES_URL`.

**What the live tests caught that text tests could not.** The migrator inherited the lookup role's open policy through a plain `GRANT` (fixed with `INHERIT FALSE`). `REVOKE ... FROM PUBLIC` issued after `ALTER FUNCTION ... OWNER TO` was a silent no-op, leaving the lookups callable by every role (fixed by ordering). Two sign-ins in one millisecond verified or failed by coin flip (fixed by `seq`).

**Phase 0 exit criteria now met in code.** Two tenants seeded in test; a deliberately missing WHERE clause returns only the bound tenant, as `app_rw` and as the table owner; deactivating a user denies the next guarded call; the chain verifies and detects a planted tamper against a live database; a connector with no BAA row is refused by the trigger under `app_rw`; production refuses to boot without the listed controls or with a connection that could bypass RLS.

**Not in Increment 0.3.** A separate `app_append` connection in the app process (the runtime still inserts audit rows as `app_rw`; the grants for the split exist), nightly scheduling of the verifier, daily chain head to Object Lock, `disclosures`, MFA enrollment flow, two-admin recovery ceremony, real KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.4

Increment 0.3 left MFA half-wired: `requireAccess` refused unenrolled users, but `authorizeCredentials` also refused them, so provisioned staff could not sign in and had no enrollment path. This increment closes the Phase 0 exit criterion.

- Migration `0005_mfa_enrollment.sql` makes `mfa_secret_enc` nullable until enrollment completes.
- `authorizeCredentials` accepts password-only sign-in when `mfa_enrolled_at` is null, creates a session, appends `auth.signin.pending_mfa`, and sets `needsMfaEnrollment` on the JWT. Enrolled accounts still require TOTP or a recovery code.
- `/enroll-mfa` plus `/api/enroll-mfa` (`requireMfa: false`): begin generates a secret and otpauth URI; complete verifies the first TOTP, writes recovery-code hashes, sets `mfa_enrolled_at`, appends `auth.mfa_enrolled`, shows recovery codes once, revokes the session, and sends the user back to sign in with their authenticator.
- Middleware redirects every signed-in route to `/enroll-mfa` until enrollment finishes.
- `pnpm db:seed` idempotently loads Ridgeview and Oakridge with four staff rows, including `ridgeview-newhire` (unenrolled). Seed data lives in `packages/db/src/seed-data.ts` and is re-exported by `apps/pms` dev seed.
- Production runtime-role probing moved from `instrumentation.ts` to the first database pool use so the Next.js build does not bundle `pg` into edge middleware.

**Phase 0 exit criterion met.** MFA enrollment is forced on first login: unenrolled users cannot reach guarded routes, must enroll before the app opens, and must sign in again with TOTP once enrolled.

**Not in Increment 0.4.** Two-admin recovery ceremony, `disclosures`, separate `app_append` connection, nightly verifier scheduling, Object Lock chain head, real KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.5

Increment 0.4 closed MFA enrollment but audit rows still flowed through the runtime `app_rw` connection, and the verifier only printed a JSON verdict. This increment splits append traffic and records nightly chain checks.

- Migration `0006_audit_chain_checks.sql` adds `audit_chain_checks` (one row per tenant per UTC day, append-only triggers) and grants `app_append` SELECT on `domain_event` so the append role can read the chain tip inside a tenant-scoped transaction.
- `APPEND_ROLE_DSN` selects a second pool. `appendDomainEvent` and `logPhiAccess` use `withTenantAppendTransaction`; production boot requires `APPEND_ROLE_DSN` and probes that the connection holds `app_append` and cannot UPDATE `domain_event`.
- `pnpm --filter @pms/verifier verify:chain:record` verifies as `app_verify`, then inserts into `audit_chain_checks` as `app_append` (idempotent on `(tenant_id, day)`). CI exercises it; `.github/workflows/nightly-verifier.yml` is the production schedule template (secrets `VERIFY_ROLE_DSN`, `APPEND_ROLE_DSN`).

**Not in Increment 0.5.** Object Lock chain head, `disclosures`, two-admin recovery ceremony, real KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.6

Increment 0.5 split ledger appends and recorded nightly chain checks but left two Phase 0 compliance gaps: no accounting-of-disclosures table and no replacement for a single-admin password reset. This increment adds both.

- Migration `0007_disclosures_recovery.sql` creates `disclosures` (append-only, INSERT via `app_append`) and `recovery_ceremonies` (two distinct admins, 15-minute expiry, one-time reset token). A SECURITY DEFINER `auth_lookup_recovery_ceremony` admits password reset before tenant context exists.
- `recordDisclosure` validates channel and purpose enums and writes through the append pool.
- Two-admin recovery: `POST /api/recovery-ceremony` (initiate + TOTP), `POST /api/recovery-ceremony/approve` (second admin + TOTP, returns `resetToken`), `POST /api/recovery-ceremony/reset` (token + new password, no session).

**Not in Increment 0.6.** Object Lock chain head, egress paths that call `recordDisclosure`, real KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.7

Increment 0.6 added disclosures and recovery ceremonies but nightly verification still stopped at `audit_chain_checks` rows in Postgres. This increment anchors signed chain heads to Object Lock storage.

- Migration `0008_chain_head_anchor.sql` adds `object_lock_key` to `audit_chain_checks` and permits `app_append` to set it once after insert; all other updates remain refused.
- `packages/verifier` gains `anchor.ts`: HMAC-signed chain-head documents, a `file://` sink for dev/CI, and `anchorRecordedHeads` called from `verify:chain:record` when `OBJECT_STORAGE_URL` and `CHAIN_HEAD_SIGN_KEY` are set. Production will swap the dev HMAC signer for KMS ECDSA P-256.
- CI writes anchored heads under `file:///tmp/pms-audit-heads`; the nightly workflow template passes through the production secrets.

**Not in Increment 0.7.** Real KMS signing, S3 Object Lock compliance mode, egress paths that call `recordDisclosure`, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.8

Increment 0.7 anchored chain heads but disclosures were still only reachable through a standalone helper. This increment establishes the egress accounting pattern and the incident-response revoke-all path.

- `requireAccess` accepts an optional `disclosure` option; when set it validates channel/purpose enums and appends a `disclosures` row through the append pool in the same request as the guarded handler.
- `revokeAllSessionsForTenant` revokes every live session in the tenant, appends `auth.sessions_revoked_all` to `domain_event`, and is exposed at `POST /api/admin/revoke-all-sessions` (admin rank).

**Not in Increment 0.8.** Live export/print/fax routes that call the disclosure option (no patient rows yet), real KMS, restore drill, usage-metrics pipeline, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.9

Increment 0.8 closed the disclosure and revoke-all gaps but Phase 0 exit criteria still required golden tests for every lifted scoring function. This increment adds SHA-256 snapshot hashes for the frozen `ridgeviewPractice()` fixture across all exported `controls-engine` scorers (knowledge risks, precog scenario, COSO, residual portfolio, leading indicators, SoD detection, dual release, counterfactuals, beam search).

**Not in Increment 0.9.** Restore drill, usage-metrics pipeline, production KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.10

Phase 0 exit criteria require a restore drill that verifies `BACKUP_TARGET` and writes its own audit row. This increment adds `pnpm db:restore-drill`: it checks `file://` reachability (or validates `s3://` format), then appends `backup.restore_drill` to `domain_event` for every tenant through `app_append`. CI runs it against `file:///tmp/pms-backups`.

**Not in Increment 0.10.** Real S3 restore verification, usage-metrics pipeline, production KMS, PHI patient rows, legal pack, D.8 interviews.

## Increment 0.11

Phase 0 non-code deliverables include a first-party usage-metrics pipeline derived from `domain_event` and passed through a redactor. This increment adds `@pms/metrics` (`redactEventPayload`, `aggregateDailyMetrics`) and refuses `DEV_MFA_KEY` when `NODE_ENV=production`.

**Not in Increment 0.11.** Scheduled metrics worker, production KMS, real S3 restore verification, PHI patient rows, legal pack, D.8 interviews.

## Increment 1.1

Phase 1 starts with the ledger kernel before any UI. This increment adds patient and guarantor-account headers, the append-only `ledger_entries` and `payment_allocations` tables with database triggers (immutable rows, reversal mirroring, allocation bounds), balance and explanation views, and the `@pms/ledger` package (`post`, `postGuarded`, `balances`, `idempotency`) with fast-check property tests and live Postgres invariant tests.

**Not in Increment 1.1.** Ledger UI, `approval_requests` inbox, report-import ETL, bank reconciliation, card processing, day close, statements.

## Risks that stay visible

- Lifting Smile Notes tests while inverting the PHI premise will fail some of those tests; they become a tracked rewrite list, not a reason to leave PHI-blocking rules in place.
- Precog math is illustrative. Shipping scores before golden tests is a liability.
- SuperByte's 3-read cost model must not auto-fire on every keystroke in a PHI product.
- Solo-team capacity: Increment 0.1 is the only honest Phase 0 slice for one engagement. Decision 23 (budget and staffing) is still the gate on Phase 1 durations.
