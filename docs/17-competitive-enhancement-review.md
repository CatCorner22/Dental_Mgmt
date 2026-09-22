# Competitive enhancement review and Phase 0 increment

> Source: owner review of 2026-09-14. The owner asked for a comprehensive, beautiful, low-cognitive-load dental PMS with an industry-leading one-way SuperByte note advisor (twin deterministic and probabilistic knowledge bases; see Smile Notes) and a novel Precog risk-avoidance module. Two decisions lock this document: start Phase 0 of the real product, and keep SuperByte one-way (staff never prompt, chat, or rate). Evidence for market claims is the v3 knowledge base (`knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md`, `knowledge/semantic-memory.md`). Legal statements inherit the PRIMARY / SECONDARY / REPO / UNVERIFIED labels from `docs/11`.

This repository remains a consolidation plan plus a clickable prototype. Increment 0.1, recorded here, is the first code foundation of the merged PMS. Increment 0.2 wires the sessions table and `/api/me`. Increment 0.3 makes the database real: migrations that apply, roles that exist, and a verifier that reads a live chain. Increment 0.4 forces MFA enrollment on first login and seeds two Postgres tenants without `AUTH_DEV_MEMORY`. Increment 0.5 splits ledger appends to `app_append`, records nightly chain checks, and schedules the verifier. Increment 0.6 adds the `disclosures` schema and a two-admin recovery ceremony. Increment 0.7 anchors signed chain heads to Object Lock storage. Increment 0.8 wires the disclosure egress pattern and tenant-wide session revoke for incident response. Increment 0.9 adds golden snapshot tests for every exported controls-engine scorer. Increment 0.10 adds the restore drill CLI. Increment 0.11 refuses `DEV_MFA_KEY` in production boot and adds the PHI-free usage-metrics package. Increment 1.1 lays the ledger kernel, Increment 1.2 the approvals inbox, Increment 1.12 wires Precog to live rows, Increment 1.13 has the database re-check dual release on insert and adds the nightly snapshot job, Increment 1.14 enforces the deposit channel at the day-close seal, Increment 1.15 puts the Practice Risk surface in the product at `/risk`, Increment 1.16 measures independent bank reconciliation from cleared runs instead of assuming it absent, Increment 1.17 drives the Practice Risk page in Chromium against the production server in CI and fixes the same-origin check that refused every browser write behind a real hostname, and Increment 1.18 drives the whole Money Desk the same way. Increment 1.19 matches bank credits to the deposits the practice prepared, measures detection lag and the 48-hour match rate from the bank lines (recorded and shown, not yet scored), and fixes importing the same statement twice. Increment 1.20 runs axe over every state the browser suites reach, failing on a critical or serious violation. Increment 1.21 builds the owner's home board from live rows: "Yesterday reconciled?" as one shape and word with one action, approvals waiting, decisions due, expiring exceptions, and practice health with its top three levers. Increment 1.22 adds `control_findings` and the first detector, unmatched bank lines older than 48 hours, run on every frozen snapshot and shown on Practice Risk. Increment 1.23 adds the owner-only clearance and unreviewed-decision detectors on the same planner. Increment 1.24 adds three ledger detectors: a release above threshold without approval (the chain-integrity alarm), a posting dated well before it was posted, and a duplicate patient payment. Increment 1.25 adds two coverage detectors: a deposit not yet at the bank and a critical duty held by one person. Increment 1.26 lets the owner record a control decision on a detector finding, refuses self-licensing by whoever the row is about, and shows the governing decision beside the finding. Increment 1.27 puts Keep, Tighten, and Retire on the home board's decisions-due card, each decision carrying a measured, practice-wide sentence on what happened since it was made. Increment 1.28 adds the weekly digest with acknowledgment stamping: seven days of the practice's counts, computed from rows, stamped once by the owner. Increment 1.29 reads the six hard events from rows onto the owner board, immediate on every read, with business hours per location. Increment 1.30 turns the after-hours refund from an alert into a held posting, enforced at the service and by the database. Increment 1.31 makes switching that hold off a governed change: an owner's decision with a review date, written with the policy version, and read back on the owner home as "off since, review due". Increment 1.32 gives the owner the Locations page, where each location's business hours, the week the hold reads, are set, every change a chain event. Increment 1.33 lets the owner acknowledge each hard event with a note of what was done, one append-only row and one chain event per event, and has the digest count acknowledgments and after-hours holds. Increment 1.34 ships the first slice of the CPA month-end package: one calendar month, aggregate and hash-stamped, exported as CSV or JSON with every export a chain event. Increment 1.35 adds the chart-of-accounts mapping under maker-checker, so each journal line names an account or reads unmapped. Increment 1.36 closes a month: the package hash is frozen, and the database refuses a back-dated entry into it unless the correction carries reason `prior_period`. Owner-only Phase 0 items (BAA, hosting contract, 24-month budget, D.8 interviews) stay listed, not silently marked done.

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

**In by GA (already in the module map).** Tenancy, patients, Board, encounters, odontogram, six-point perio, treatment plans, readable ledger, checkout, membership and payment plans, eligibility, claims, ERA, denials, lab cases, referrals, imaging import, confirmations, **patient self-scheduling (online booking via the portal, Phase 5)**, reports that reconcile to the ledger, conversion, exit export.

**Later (do not pull into Phase 0–1).** eRx, portal, two-way text, **patient self-scheduling / online booking** (Phase 5; Phase 2 schedule kernel is the prerequisite), digital intake, voice perio, sensor bridge, groups/SSO, public write API, specialty modules, TennCare.

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
- Two-admin recovery: `POST /api/recovery-ceremony` (initiate + TOTP), `POST /api/recovery-ceremony/approve` (second admin + TOTP, returns `resetToken`), and a reset taking the token and a new password with no session. All three had zero callers until Increment 1.77 gave them screens; that increment also replaced the reset route with a server action and fixed the grant that had kept the lookup from reading its own table.

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

## Increment 1.2

Dual-release approvals are persisted and actionable without UI. This increment adds `control_policies`, `approval_requests`, and `approvals_log`; seeds an active policy per tenant (`hardBlockWithoutSecond: false`); teaches `postGuarded` to return `needs_second` as a held refusal; and exposes `GET /api/approvals/inbox`, `POST /api/approvals/[id]/decide`, and `GET /api/controls/policy`.

**Not in Increment 1.2.** Push notifications, walk-over PIN sessions, policy/exceptions editor UI, denial-suppression, BEFORE INSERT approval trigger on `ledger_entries`, hosted posting HTTP route.

## Increment 1.3

Phase 1 shadow-ledger feeding starts with a Curve Hero report-import stub. This increment adds `import_runs` and `import_staged_rows`, the `@pms/import` package (CSV parsers for day sheets, AR aging, deposit slips, and patient/coverage headers), row validation with SHA-256 fingerprints, synthetic fixtures, `pnpm import:curve`, and `POST /api/import/curve` behind the `run_import` entitlement. Parsed rows are staged and audited via `import.curve_hero.staged`; nothing posts to the ledger yet.

**Not in Increment 1.3.** Ledger apply from staged rows, nightly scheduler, location-code resolution, AR tie-out report, dry-run diff UI, Open Dental or Dentrix parsers.

## Increment 1.4

The readable ledger gets a minimal Money Desk UI before checkout or posting screens ship. This increment seeds a Ridgeview demo charge with partial payment, adds `GET /api/ledger/accounts` and `GET /api/ledger/accounts/[accountId]`, and renders `/ledger` plus `/ledger/[accountId]` with the three labeled balance numbers and a running itemized view over `ledger_explanations`.

**Not in Increment 1.4.** Posting UI, checkout, approvals inbox UI, As-of date chip, CPA/patient explanation audiences, palette search, mobile approvals surface, patient self-scheduling (on the roadmap for Phase 5; see `docs/08-roadmap.md`).

## Increment 1.5

Phase 1 independent reconciliation starts with bank statement import, not aggregator feeds. This increment adds `bank_accounts`, append-only `bank_transactions`, `bank_statement_imports`, `reconciliation_runs`, and `reconciliation_variances`; extends `@pms/import` with a CSV bank-statement parser and fixture; seeds a Ridgeview operating account; exposes `POST /api/import/bank-statement`, `GET /api/bank/accounts`, and `GET /api/reconciliation/runs` (+ detail); and renders `/reconciliation` with a statement-import form and variance queue. Credits on the statement auto-match staged Curve Hero `deposit_slip` rows by date and amount; everything else lands as an open `unmatched_bank` variance. Every import appends `import.bank_statement.applied` to `domain_event`.

**Not in Increment 1.5.** Aggregator feed, variance clearance / SoD runtime block, day close, ledger tie-out from bank lines, OFX parser, nightly scheduler, owner Tied tile.

## Increment 1.6

Location-scoped deposits and atomic day close land before month-end or CPA tooling. This increment adds `deposits` and `day_closes` (frozen rows are immutable), seeds Ridgeview demo deposits for 2026-09-14, exposes `GET /api/day-close`, `POST /api/day-close/freeze` (`bank_reconcile`), and `POST /api/deposits/apply-staged` (`post_payments`), and renders `/day-close` with deposit batch vs imported day-sheet payment totals and a freeze control. Freezing appends `day_close.frozen` to `domain_event` and marks deposits `closed`.

**Not in Increment 1.6.** Prior-period lock, month close, inter-location transfers, deposit variance alerts, owner Tied tile, ledger posting from deposits.

## Increment 1.7

Dual-release approvals get a minimal inbox UI. This increment seeds a pending write-off request from the front-desk user and renders `/approvals` with approve/decline actions wired to the existing `GET /api/approvals/inbox` and `POST /api/approvals/[id]/decide` routes (`approve_writeoffs`). Approving executes the held posting via `executeHeldPosting`.

**Not in Increment 1.7.** Push notifications, walk-over PIN sessions, policy/exceptions editor, mobile approvals surface, palette search.

## Increment 1.8

Validated Curve Hero day-sheet rows post to the shadow ledger. This increment adds `apps/pms/src/lib/import/apply.ts` (MRN and location resolution, day-sheet → charge / `patient_payment` mapping, idempotency keys `import:curve:{runId}:{rowNumber}`), a Postgres-backed `@pms/ledger` writer, `POST /api/import/curve/apply` behind `run_import`, `pnpm import:curve:apply` as an API-only stub, and `import.curve_hero.applied` on `domain_event`. `import_runs` move from `validated` to `applied` when processing completes.

**Not in Increment 1.8.** AR aging / deposit-slip ledger apply, nightly scheduler, dry-run diff UI, insurance-payment mapping, Open Dental or Dentrix parsers.

## Increment 1.9

Money Desk posting gets a guarded HTTP route and a minimal form. This increment adds `apps/pms/src/lib/ledger/post.ts` (Postgres `LedgerWriter` plus `postGuarded` with held `approval_requests` when dual release requires a second approver), `POST /api/ledger/post` behind `post_payments`, `GET /api/ledger/post/procedures` for charge procedure pickers, and `/ledger/post` with guarantor account, kind, amount, effective date, and reason code. Nav and home link to the posting screen; success and `needs_second` responses link staff to `/approvals` or the account ledger.

**Not in Increment 1.9.** Checkout, card processing, palette search, full posting wizard, tender capture, insurance payments, reversals, and ledger posting from bank deposits.

## Increment 1.10

Patient and guarantor statements become a Money Desk surface. This increment adds `statements` (draft / issued / held / void; issued rows are immutable), snapshots the three labeled balances and `ledger_explanations` lines from the same queries as `/ledger`, and exposes `GET /api/statements`, `POST /api/statements` (draft from current balances), `POST /api/statements/[id]/issue`, and `POST /api/statements/[id]/hold`. Issue and hold require `post_payments`; list and preview are `minRank: user`. `/statements` and `/statements/[id]` preview the frozen artifact. Issue appends `statement.issued` to `domain_event`. Hold is minimal: optional `hold_reason`, and issue refuses while held (statement status, hold reason, or `guarantor_accounts.statement_hold`). Ridgeview seed includes an issued Jane Doe statement.

**Not in Increment 1.10.** Hosted card processing, email or portal send of PHI, statement number sequences, maximum hold age, patient-voice explanation templates, print/mail/SMS disclosure channels, As-of historical re-query of posted_at.

## Increment 1.11

Variance clearance is enforced with runtime SoD (decision 7a). This increment is stacked independently of Increments 1.8 and 1.9: whoever prepared deposits covering the run period, or posted patient payments in that period, cannot clear that day's reconciliation run. When no other eligible clearer exists, tenant admin (`role=admin`) may still clear, and the degraded state is recorded as a finding on `reconciliation_runs.summary.degradedOwnerClearance` (not a silent disable) plus `domain_event` `reconciliation.cleared` / `reconciliation.variance_cleared`. Open variances become `cleared`; `matched_deposit` rows stay `matched`. Source remains `statement_import` — clearance is not a self-assertion. `POST /api/reconciliation/runs/[runId]/clear` is behind `bank_reconcile`. Ridgeview keeps only the owner on `bank_reconcile`; front desk has `post_payments` and prepared the demo deposits, so they are refused if they try to clear.

**Not in Increment 1.11.** Per-variance waive route, `control_findings` table, aggregator feed, owner Tied tile, grant-time SoD refusal UI.

## Increment 1.12

Increment 1.2 persisted approvals; the rest of Precog still scored a frozen fixture. This increment wires the engine to live rows so the module refuses, records, and scores from what the practice actually holds. Scores stay directional until a CPA calibrates them, and nothing here scores a person.

- **Segregation of duties from real grants.** `assignmentsFromGrants` turns the live `user_entitlements` rows into the `RoleAssignment[]` input; nothing is inferred from a role label, an expired grant does not count, and a value outside the fourteen-word rulebook vocabulary is reported, never scored. `POST /api/controls/grants` takes a per-tenant advisory lock, then runs `evaluateGrant` inside the tenant transaction and refuses (403) a grant that would create an unmitigated critical conflict unless the same request carries an `accept_residual` or `compensate` decision with a review date; an administrator may not license their own conflict, on the grant path or through the decisions route. Two concurrent grants of the two halves of a critical pair therefore serialize, and exactly one is refused; a partial unique index on live rows is the backstop. Every grant and revoke refreshes `sod_findings` (keyed on rule and person; closed, never deleted; a recurrence reopens the same row) and appends `role.granted` or `role.revoked` to the chain with a flat payload, because the chain hasher binds top-level keys and arrays of primitives only.
- **Decision register.** `control_decisions` is append-only at the role and the trigger: kind (`remediate | compensate | accept_residual | monitor | insure`), a note of at least ten characters, an optional review date within a year that must be a real calendar date, and both version stamps. A decision on a finding governs that finding; a decision on a control governs every conflict of that control; a decision on one person's finding never re-scores another person's conflict. `decisionCoverage` names the conflicts without a governing decision, which is COSO Principle 17 as a number; an overdue review is itself surfaced.
- **Channel coverage with an enforcement class.** `channelCoverage` labels each of the six channels `enforced` (write-off and adjustment: exactly the ledger kinds `postGuarded` maps), `partial` (check and ACH: `postGuarded` evaluates patient refunds and transfers, but the product holds no vendor payments, so these two mitigate no SoD rule and earn no dual-control credit), `external` (deposit, new vendor, payroll: the data is not held) or `off`. Only an enforced channel lowers a score, so payroll can be enabled in the policy and still show as attested, and a patient refund can never make a vendor-fraud control look covered. `POST /api/controls/release/evaluate` attests a release on an external channel: the signed-in user is the initiator, no second signer is taken from the request, the verdict can never be `approved_dual`, ledger channels refuse, and the record carries the class and `attestedBy`.
- **Exceptions as policy versions.** `POST /api/controls/exceptions` and `/retire` take the tenant's policy lock and write a new `control_policies` row; the action must be one of the four, scope fields must be strings, a raise or waiver needs a residual note and the approving owner, and a waiver must expire within 90 days. New tenants no longer seed the engine's sample exceptions.
- **Practice state from live rows.** `buildPracticeState` derives staff composition instead of asking for it: team size from active users, segregation score from the live report, dual control from a counted payment channel, independent bank reconciliation as `false` until reconciliation runs exist, sole-owner knowledge as zero until a knowledge map exists. Scenario and control templates carry the fixture's numbers with generic wording (`templates.ts`); the fixture stays frozen for the goldens.
- **Snapshots.** `POST /api/controls/risk` freezes portfolio, COSO, leading indicators, tornado, coverage, and decision coverage into `control_snapshots`, stamped with `SCORING_VERSION` and `CONTROL_RULEBOOK_VERSION`, and lists every assumption (unmeasured inputs, external channels) beside the numbers. `GET` serves the last snapshot or `?fresh=1`.
- **Tests.** Engine: 64 unit and golden tests (new golden file `golden-live-hashes.json`). Database: migration 0013 applied as `app_migrate` in the live suite, with append-only, uniqueness, and cross-tenant assertions. App: a live suite that grants, refuses, licenses, races two grants, revokes, reopens, versions, records, attests, snapshots, and verifies the chain afterwards. An adversarial review of the diff (three reviewers, one refuter per finding) confirmed eleven findings, all fixed before the push: the grant race, the release endpoint accepting other people as signers and ledger channels, nested chain payloads, self-licensing through the decisions route, unvalidated exception fields, the policy-version race, calendar-invalid dates, ACH and check crediting vendor controls, and the control-wide versus per-finding acceptance semantics.

**Not in Increment 1.12.** A UI for any of this (routes only); the BEFORE INSERT approval trigger on `ledger_entries`; deposit, vendor, and payroll entities (their channels stay external); measured independent reconciliation; the knowledge map; detectors and `control_findings`; the strict "grant sits pending until a second admin decides" mode; a nightly snapshot schedule.

## Increment 1.13

Increment 1.12 made the service refuse; this increment makes the database refuse too, closes the one path that could still name a second person without a decision, and gives the scores a clock.

- **Dual release re-checked on insert.** Migration 0014 adds `ledger_entries_dual_release`, a BEFORE INSERT trigger that reads the tenant's active policy exactly as the service does: the channel rule for the kind (write-off and adjustment and reversal → write-off; refund → check; transfers → ACH), its enabled flag, and its threshold. Above the threshold the row must cite an `approval_requests` row that is approved, decided by a different person than the poster, for the same channel and amount, and not yet consumed, or an enabled, in-window exception in that policy that licenses a single release at this amount. A unique index allows one entry per request. The trigger is a floor: role eligibility, `force_dual`, and `lower_threshold` stay with the service, which is stricter.
- **A name is not a decision.** `postGuarded` no longer accepts a second person named inline as the second signature. A dual-required posting posts only with an approved request id, and a single release licensed by an exception carries `applied_exception_id` so the trigger can verify it. The earlier code also wrote the second person's id into `approval_request_id`; that is gone.
- **Approve, then post, then attach.** The decide route records the approval first (the decision stands on its own), executes the held posting second (the trigger re-reads the approved request), and attaches the entry id last. If the ledger refuses, the approval is cancelled with the refusal as its reason and logged in `approvals_log` and on the chain, so no approval stands without the entry it was for.
- **Nightly snapshots.** `pnpm controls:snapshot` freezes one snapshot per tenant and refreshes `sod_findings`; tenants are listed on the administrator connection and scored on the runtime connection with the tenant bound. `.github/workflows/nightly-controls.yml` is the schedule template; CI runs the command against the migrated database.
- **Tests.** Database live suite: eight trigger cases (under threshold, no request, pending request, requester as approver, amount mismatch, one entry per request, raise up to its threshold, expired or wrong-channel or unknown or force-only exceptions, a tenant with no policy). App live suite: the approve-post-attach path, the cancel-on-refusal path, and the nightly job across two tenants. Ledger: inline second refused, request id stamped, exception id stamped, small posting free.

**Not in Increment 1.13.** The posting HTTP route that creates held requests (it arrives with the Cursor stack's Increment 1.9), deposit and vendor entities, detectors, the strict grant mode, a UI.

## Increment 1.14

Increment 1.7 gave the product deposits and an atomic day close; Increment 1.12 could only mark the deposit channel external. This increment runs dual release on the deposit path, so the channel moves from attested to enforced and earns the dual-control credit it was denied.

- **The freeze is the seal.** The rulebook's deposit control is "dual count of deposit before bag is sealed." In the product, preparing deposits is the first count (it already runs under its own entitlement) and freezing the day close is the second. `canSealDeposits` (`apps/pms/src/lib/day-close/seal.ts`) decides from the tenant's active policy, the day's deposit rows, and the live staff: policy or channel off → recorded, not enforced; total at or under the channel threshold → one count is enough; the freezer prepared any of the day's deposits → refused, unless the freezer is the owner and nobody else could count, in which case the seal proceeds as owner-only and is recorded as a finding (decision 7a, the same degradation variance clearance uses); a role the rule does not let second → refused; otherwise approved as a dual release. A refusal names who could count instead. Only the sealer's eligibility is checked; the preparer's was checked when the deposit was prepared.
- **Frozen into the close and onto the chain.** `freezeDayClose` runs the check inside the tenant transaction before it writes anything. The verdict (channel, status, threshold, preparer ids, sealer id, degraded flag, policy version) is written to `day_closes.summary.dualRelease`, an owner-only seal also to `summary.degradedOwnerSealFinding`, and the flat fields to the `day_close.frozen` event. `POST /api/day-close/freeze` returns 403 with `verb`, `why`, and `otherEligibleNames` for `sod_preparer` and `sod_role`; the day-close page shows the reason and the names, and shows the seal status once frozen.
- **Coverage, and what it changes at the grant path.** `ENFORCEMENT.deposit` is now `enforced`, so `channelCoverage` counts the channel, `dualControlPayments` derives `true` for a practice with the channel enabled, and the deposit control mitigates its three SoD rules in the scores: collect + post, deposit + post, and posting + reconciliation (`rule-cash-rec`, whose own compensating default is "dual count on deposit bags"). The last of these is critical, so the grant path now treats posting + reconciliation as a mitigated critical and writes the grant without a decision when the tenant's deposit channel is enabled; the finding is still recorded and scored. Custody + reconciliation (`rule-custody-rec`) is mitigated by no channel and still refuses. The live suite's critical-pair cases moved to that rule for this reason. The `golden-live-hashes.json` fixture did not change because it runs the engine's own fixture enforcement map, not the app's.
- **Tests.** Six unit cases on `canSealDeposits` and a live suite (`day-close.live.test.ts`) on two tenants: the preparer refused with the other eligible names and no row written, an ineligible role refused, the office manager sealing with the verdict in `day_closes.summary` and in the event payload and every deposit closed, a second freeze refused as already frozen, the solo owner degrading with the finding recorded, and the chain verifying afterwards.

**Not in Increment 1.14.** Checking the preparer's role at preparation time; a per-deposit second count (the bag is counted as a whole); vendor and payroll entities (their channels stay external); detectors; the strict grant mode.

## Increment 1.15

Increments 1.12 to 1.14 made Precog refuse and record from live rows behind `/api/controls/*`, with no screen. This increment gives the practice one Practice Risk surface over those routes, so the owner sees the same enforced-versus-recorded table the design in `docs/05` promised, and a refused grant is a conversation, not a dead end.

- **One page, `/risk`.** Manager rank reads it; administrator rank acts on it. In order: a provenance sentence (frozen at a time by a trigger, or computed live just now; both version stamps; "directional until a CPA calibrates the weights"); four headline tiles (segregation health, open conflicts, without a decision, overdue reviews) with the rest of the headline in one sentence; the six-channel table with its class (Enforced, Partial, Attested (external), Off), threshold, whether it counts toward scores, and active exceptions; duty combinations, each with the person who holds both duties, the severity, whether an enforced channel mitigates it, and the governing decision state (no decision, decided with its review date, or overdue); who holds which duties from live grants; the decision register; standing exceptions; and the assumptions the snapshot lists. Same-family combinations are behind a toggle so the table opens on the pairs that matter.
- **The Refusal component.** A refused grant renders as the design's Refusal: what was refused, why, the conflicts it would create, and the next steps from the rulebook. Only a refusal for an unmitigated critical pair offers "record the decision and grant in the same step", limited to accept-residual and compensate; a refusal for licensing one's own conflict, an invalid decision, or a duplicate offers no such form. Administrators can also record a standalone decision on any row (the rulebook's compensating defaults are shown beside the form), revoke a duty (the finding closes, never deletes), recompute from live rows, or freeze a snapshot. After a grant, revoke, or decision the headline is recomputed live so tiles and table agree; only a freeze shows the stored snapshot.
- **Verified in a browser, not only in tests.** Against the seeded development database: the owner signs in with a time-based code; the page loads with six channels and zero conflicts; granting the owner cash custody is refused (custody plus reconciliation is critical and no channel mitigates it); trying to license that refusal as the same owner is refused again with "Needs a different administrator"; the front desk receives custody (mitigated, written) and then reconciliation only with a decision; the row then reads "Accept residual · review by 2026-12-31"; a monitor decision on an open row succeeds; the snapshot freezes; both duties are revoked; a user-rank account sees the Refusal, not the page. No console or page errors.
- **Two defects the browser run found, both older than this increment.** `next build` failed on `main`: the posting screen imported its list of kinds from the posting service, which pulled the Postgres driver into the browser bundle; the list now lives in `lib/ledger/types.ts` and the production build passes. Every guarded write refuses a request without a JSON content type (415), and two buttons sent bare POSTs: the reconciliation Clear button (Increment 1.11) and this page's first version of Freeze snapshot; both now send a JSON body.
- **Tests.** Seven unit cases on the pure view helpers (`riskView.ts`: decision state from a finding-level or control-wide decision, overdue detection, refusal normalisation and when licensing is offered, provenance wording, duty ordering). The routes keep their live suites from Increments 1.12 to 1.14. The page itself was exercised by the browser run above, which is not part of CI.

**Not in Increment 1.15.** Owner home tiles and the decisions-due card; exception authoring on the page (the routes exist); the per-person conflict matrix; the tornado "what if" preview; the CPA export; a page-level automated test in CI.

## Increment 1.16

Every snapshot since Increment 1.12 has carried the assumption "independent bank reconciliation is not measured yet and is treated as absent", because the product held no reconciliation runs. The Cursor stack's Increment 1.8 and 1.11 gave it runs, clearers, and the runtime rule that a preparer or poster cannot clear. This increment measures the control from those rows, so a hard-coded false becomes a graded reading.

- **The grade.** `measureReconciliation` reads the tenant's runs cleared from a bank source (statement import or aggregator feed) in the last 45 days. For each, the clearer held custody or recording for the period when they prepared a deposit in it or posted a patient payment in it: the same test `canClearVariance` applies at the moment of clearing, computed after the fact from the deposit and ledger rows. Grades follow `docs/05`: `independent` only when every cleared run in the window is independent, because one same-hands clearance means the control did not operate independently throughout; `same_hands` when any was not, and owner-only clearance recorded as a finding counts as same hands; `stale_import` when nothing was cleared in the window, which also covers a practice that has never imported a statement.
- **Where it flows.** `loadControlsContext` measures before it builds the state and passes the grade's boolean as `independentBankRec`, so COSO monitoring, the cash controls' residual, the leading indicator, and the SoD uplift for reconciliation pairs all move with the measurement. `takeControlSnapshot` gains an optional `measurements.reconciliation` block (grade, window, counts, latest clearance, one sentence of reason), present only when the product measured it, and the assumptions list names the grade and the reason in place of "not measured". The Practice Risk page shows the grade, the window, and the sentence under the headline.
- **Tests.** Five unit cases on the pure grader (stale when nothing bank-sourced cleared in the window, independent only when all are, same hands on a preparer or on owner-only clearance, window edges inclusive at the start and closed at today, the snapshot summary). An engine case that the snapshot carries a measurement only when one was taken and words the assumption from it. A live suite on two tenants: stale import with the snapshot saying so, independent when the owner clears a period the front desk deposited in, same hands once the front desk clears a run covering their own deposit, owner-only clearance counted as same hands. The golden hashes did not change: the measurement block is absent unless supplied.

**Not in Increment 1.16.** Detection lag (days from posting to matched bank transaction) and the 48-hour match rate; the aggregator feed itself; a per-run `independent` column (the grade is computed, not stored); surfacing the grade on the reconciliation screens.

## Increment 1.17

Increment 1.15 verified the Practice Risk page by hand in a browser and listed "a page-level automated test in CI" as not done. This increment makes that run part of the gate, on the production server, and the first run found a defect that every real deployment would have hit.

- **The browser test.** `apps/pms/src/e2e/risk.e2e.test.ts` builds a throwaway database with the live helper (roles, every migration as `app_migrate`), seeds the two demo tenants, and starts `next start` against it with the production boot gates satisfied: an ordinary login role that inherits `app_rw` (the boot log must say "not superuser, not BYPASSRLS, owns no tables"), an encryption key instead of the development key, an append-role connection, backup and object-storage targets, and no in-memory auth. Chromium signs in as the owner with a time-based code and drives the page: the refused grant, the refusal of licensing one's own conflict, the licensed grant for someone else with the governing decision shown on the row, a standalone decision, a frozen snapshot, revocation with live recomputation, and the read-only Refusal for a user-rank account. Console errors, page errors, and any 5xx fail the run. It runs only with `PMS_E2E=1` (`pnpm e2e`) after a production build; the CI `packages` job builds the app, installs Chromium, and runs it after the package tests.
- **The defect it found.** Every guarded write checks that the browser's `Origin` matches the request's own origin, and that origin was read from `req.url`. Next.js builds `req.url` from its listen address, `http://localhost:<port>`, whatever hostname the browser used, so on any hostname other than `localhost` every state-changing request from a browser was refused with 403 "Origin is not allowed." The hand-driven check in Increment 1.15 passed only because it used `localhost`. The check now reads the origin the request arrived at from the Host header, or from `X-Forwarded-Host` and `X-Forwarded-Proto` when proxy headers are trusted (the same `TRUST_PROXY_HEADERS` switch `clientIp` uses; `none` ignores them), and `APP_ORIGIN` pins the one allowed origin over every header. Seven unit cases cover the hostname, the forwarded chain, the switch, the pin, the missing header, and the content-type and size refusals. `sec-fetch-site` is still checked as well.

**Not in Increment 1.17.** Browser tests for the other screens (ledger, posting, reconciliation, day close, statements, approvals); accessibility checks on the served pages (the prototype harness runs axe, the app does not yet).

## Increment 1.18

The browser harness from Increment 1.17 becomes shared (`apps/pms/src/e2e/harness.ts`: throwaway database, seed, production server on an ordinary role, Chromium with a time-based sign-in) and a second suite drives the Money Desk end to end on the seeded Ridgeview tenant, the way a practice would use it across a day:

- The owner opens home, the ledger, and Jane Doe's explanation with its running ledger.
- The front desk posts a $20 patient payment (posted) and a $200 courtesy write-off (held for a second approver, with the request id shown).
- The owner sees both held requests in the inbox, approves the new one (the write-off lands on the account), and declines the seeded one with a reason; the inbox empties.
- The owner imports the September bank statement CSV, lands on the run with three open variances, and clears it. Because the seed records the owner as the poster of the day's payments, the only clearance open to the owner is owner-only, and the run says so; it is recorded, never hidden.
- The owner freezes the day close as the second counter of the front desk's two deposits: "second count by a different person", and the button locks.
- Practice Risk, recomputed from live rows, now grades independent bank reconciliation "same hands" and names the owner-only clearance as the reason: Increment 1.16's measurement, observed through the product rather than a fixture.
- The front desk drafts a statement for John Smith and issues it.

Twelve browser tests in all (five on Practice Risk, seven on the Money Desk), about twenty seconds after the build. Console errors, page errors, and any 5xx fail a suite. This run found no new defect; the reconciliation Clear button, which could never have worked in a browser before Increment 1.15's content-type fix and Increment 1.17's origin fix, now clears.

**Not in Increment 1.18.** Import screens (Curve Hero staging and apply have no page); the recovery ceremony and MFA enrolment flows; accessibility checks on the served pages; a mobile viewport.

## Increment 1.19

Increment 1.16 measured whether reconciliation was independent and left two numbers `docs/05` names unmeasured: "detection lag is measured in days between posting and matched bank transaction; match rate within 48 hours is stored." This increment measures both from the bank lines the product holds, and first makes the matcher look at the practice's own deposits, without which the rate would read zero for every practice that does not import Curve Hero deposit slips.

- **The matcher.** A bank credit now matches the first candidate with the same bank account, date, and amount among the deposits the practice prepared in the product (the day-close path, oldest first) and then the Curve Hero deposit-slip rows it staged. The variance row records which (`match_ref.source` is `deposit` or `deposit_slip`, with the deposit id or the staged row id, the method, the reference, and for a deposit the preparer's name). A candidate matches once across every run, so a deposit explains one bank credit only. The run screen labels the row "Matched deposit".
- **The defect the matcher work found.** `bank_transactions` is append-only and unique per (tenant, account, external key), and the import inserted each line with "on conflict do nothing" and then pointed the run's variance rows at the id it had generated. Importing the same statement a second time therefore failed on the foreign key, since that id was never written. The import now reuses the existing line's id and reports `newBankLineCount`, zero on a repeat; the measurement below treats the earliest run that carried a line as its detection.
- **The measurement.** `measureMatching` takes every bank line whose posting date lies inside the 45-day window and is at least two calendar days old, so a line posted yesterday is not yet a miss. The practice resolved a line on the day it matched a deposit (matching runs when the statement is imported), or on the day its variance was cleared or waived; a line still open counts at its age today, a lower bound the sentence names. **Detection lag** is the median of those days over every line in the cohort. The **48-hour match rate** is the share of bank credits (money in) that matched a practice deposit on the posting date or within the two following calendar days; debits are matched by nothing yet, count toward lag only, and the sentence says so. With statement import the lag is honest about the cadence: a month imported on the 31st has a median lag near fifteen days, and a daily aggregator feed would bring it to one.
- **Where it flows.** `loadControlsContext` measures alongside independence; `takeControlSnapshot` freezes the numbers under `measurements.matching` and, because no score reads them until a CPA calibrates a weight, the assumptions list says "measured over the last 45 days and recorded, not scored" with the sentence. The golden hashes did not change: an unmeasured snapshot is unchanged, and an unmeasured matching rate is not an assumption the scores make. The Practice Risk headline shows a "Bank matching" line beside the reconciliation grade. `GET /api/reconciliation/runs` returns both measurements computed from live rows, and the reconciliation screen shows two cards over the runs: the independence grade with its reason, and the match rate with the median lag and its reason. That closes the Increment 1.16 item "surfacing the grade on the reconciliation screens".
- **Tests.** Five unit cases on the pure measurement (cohort bounds inclusive at the window start and at the 48-hour mark; lag to the match, the clearance, or today; a clean statement at 100 percent with a whole-day median; a window of debits only, where the rate is undefined; the snapshot summary). An engine case that the snapshot carries and words the matching measurement only when it was taken. A live suite through the real import path on a throwaway database: nothing to measure before a statement; two credits matched to the front desk's deposits with lag and rate computed from the lines and frozen into the snapshot; clearance shortening the open lines' lag; the same statement imported twice adding no bank line and matching no deposit twice, with the first detection governing. The Money Desk browser suite now prepares two deposits two days ago, imports the bank's record of them today, sees two "Matched deposit" rows and one open fee, clears the run, and reads "100% within 48 hours · median lag 2 days" on the reconciliation screen and on Practice Risk, on any calendar day the suite runs; the Practice Risk suite checks the "no rate yet" wording before any statement exists. Thirteen browser tests in all.

**Not in Increment 1.19.** The aggregator feed; EFT matching by trace number with many-to-one tolerance; a stored per-run `independent` column; a weight in the residual engine for lag and match rate (they are recorded until calibrated); the "unmatched bank lines older than 48 hours" detector as a `control_findings` row; accessibility checks on the served pages; a mobile viewport.

## Increment 1.20

Increments 1.17 to 1.19 listed "accessibility checks on the served pages" as not done each time: the prototype harness runs axe (`scripts/a11y-check.mjs`, `docs/16`), the application did not. This increment runs the same engine on the application, in the browser suites that already reach every screen and state.

- **The audit.** The shared harness gains `audit(state)`: it injects the axe-core 4.13.0 build the repository already vendors for the prototype (`scripts/vendor/axe-core`, MPL-2.0, no new dependency), runs it against WCAG 2.0, 2.1, and 2.2 A and AA plus axe's best practices, and records every violation once per rule and first target with the states it was seen in. At the end of a suite a critical or serious violation fails it, with the rule, the WCAG criteria, the first offending node, axe's own fix summary, and the help link in the failure; moderate and minor violations are printed so the record stays visible. A guard fails the suite when no audit ran or no rule passed, so a silent no-op cannot pass.
- **The states.** The Practice Risk suite audits six: the page for the owner, the refused grant with the decision form open, the self-licence refusal, the inline decision form, the frozen snapshot with decisions on the rows, and the user-rank refusal. The Money Desk suite audits eighteen: sign-in, home, the ledger, an account's explanation, posting after a posted payment and after a held write-off, the approvals inbox with two requests and empty, reconciliation with no runs, the run with an open variance and cleared, reconciliation with the measured cards, day close open and frozen, Practice Risk after live recomputation, statements, a statement draft, and an issued statement.
- **What it found.** Zero violations at any severity across the twenty-four states (247 and 663 rule passes on the two suites; the CI log prints the counts and how many checks axe could not decide). That is a statement about axe's automated rules, which cover a minority of WCAG, not about the pages' accessibility as a whole: keyboard order, focus management after a refusal, the reading of the Refusal component by a screen reader, and target size on touch devices stay with a manual audit and a mobile viewport, both still not done.

**Not in Increment 1.20.** A mobile viewport and a dark theme for the application (the prototype harness runs both; the application has neither yet); manual keyboard and screen-reader passes; import screens; the recovery ceremony and MFA enrolment flows.

## Increment 1.21

`docs/04` gives the owner one home: "Yesterday reconciled?" as one large shape and word, one variance number with one action, detection lag in days, approvals only the owner can give, expiring exceptions, open SoD findings, decisions due for review, the practice-health score with its top three levers, and nothing that ranks people. Until now `/home` was a heading and seven links. This increment builds that board from live rows.

- **The tile.** `yesterdayTile` is a pure function over yesterday's closes, the reconciliation runs, and the independence grade, in this order: no run from a bank source → triangle, "No bank record yet", because no green state exists without a bank line and a day sheet on its own is a self-assertion; any open variance → triangle, "N variances", with one action to the newest run that holds one; deposits or collections recorded yesterday at a location whose day is not frozen → half circle, "Yesterday not closed", with the action to the day close; otherwise the grade from Increment 1.16: filled circle "Tied · independent", half circle "Tied · needs a second look" with the sentence "The same hands posted or prepared deposits and cleared the bank reconciliation", or half circle "Tied · last clearance is stale". The shape is an inline SVG marked decorative; the words carry the meaning, so the tile reads in grayscale. Copy describes hands and process, never a person, and a unit case asserts no name appears.
- **The cards.** Approvals only you can give: the viewer's pending inbox, count and total, one link. Decisions due for review: active decisions (not superseded) whose review date has passed or falls within 30 days, overdue first, with the kind, the subject, and the date; the review itself happens on Practice Risk. Exceptions expiring: enabled exceptions whose window ends within 14 days, soonest first. Practice health: segregation health, COSO overall, open duty combinations, those without a decision, unmitigated critical, and the three levers the tornado says would lower average residual most, labelled directional. Under the tile: the 48-hour match rate and the median detection lag from Increment 1.19.
- **Where it lives.** `buildOwnerBoard` computes everything in one transaction from `computeSnapshot` (which measures reconciliation and matching on the way), the runs, yesterday's close at every active location, the viewer's inbox, the register, and the active policy. `GET /api/home/board` serves it to manager rank and above. The home page renders the board for those seats and, for every seat, the Money Desk links; a user-rank seat reads one sentence saying the board is for the manager and owner seats. The footer stamp moves to Increment 1.21.
- **Tests.** Six unit cases on the pure rules (no green without a bank record; variances summed across runs with the action on the newest; the close asked for only when yesterday had activity; the three tied states in words about hands; decisions due with superseded rows skipped and overdue first; expiring exceptions with disabled, expired, and open-ended rows skipped). A four-case live suite drives the board through the real import and clearance paths on a throwaway database: no bank record, one variance pointing at the run, yesterday not closed once a deposit lands on an open day, tied and independent once the day is frozen and the clearer held no custody or recording. The Money Desk browser suite reads the owner's board twice, before any statement (no bank record, the seeded $75 write-off waiting) and after the day (tied with a second look, 100 percent matched within 48 hours, nothing waiting), and the front desk's sentence; both states are audited with axe. Fourteen browser tests, twenty-six audited states, no violation.

**Not in Increment 1.21.** The three tender rows expected against bank and the changed-after-close line (the product does not yet hold tender-level day-sheet rows or post-close edits); Keep, Tighten, and Retire on the decisions-due card and the measured-effect sentence (`docs/13` item 21; decisions are reviewed on Practice Risk by superseding); yesterday computed in UTC rather than the location's timezone; CPA question rows and "Month open N days"; the digest.

## Increment 1.22

`docs/05` promises detectors that write `control_findings`, "recorded, batched", with "unmatched bank lines older than 48 hours" among them, and until now the status table read "Not built". This increment builds the table and the first detector, on the measurement Increment 1.19 introduced.

- **The table.** Migration 0019 creates `control_findings`: one row per (kind, subject kind, subject id), with severity, a flat `detail` object, the detector version, first and last seen, and a status that is open or closed. A closed row must carry a closed time and a reason, and rows are never deleted (a trigger refuses, and the runtime role holds no delete grant). Row-level security is forced. The kinds are a fixed list: the one built here and two reserved for the detectors `docs/05` and `docs/13` describe next (owner-only clearance, unreviewed decision). The live database suite proves the unique key, the closed-needs-reason rule, the refused delete, the refused unknown kind, and tenant isolation, as the runtime role.
- **The detector.** `listOpenBankLines` reads every bank line whose earliest variance row is still open and whose posting date is at least two days old (the same 48-hour mark the match rate uses), so a line posted yesterday is not yet a finding and a statement imported twice cannot reopen what the first run cleared. `planUnmatchedFindings` is the pure diff: open a finding for each new line, refresh the age and severity of one still open, reopen a closed one that recurs, and close the rest with the reason "matched or cleared". Severity is by age: low under a week, medium to a month, high beyond. The sentence describes the line and the process ("A $150.00 bank debit posted 2026-09-14 (ACH MERCHANT FEE) has had no matching deposit and no clearance for 3 days.") and names no one; the live suite asserts no name appears in any detail.
- **Where it runs.** `runDetectors` runs inside `takeSnapshot`, after the SoD findings refresh and on the same clock, so the nightly job and every manual freeze leave the findings current. `GET /api/controls/findings` reads them for manager rank and above. Practice Risk gains a "Detector findings" section (open first, with severity, the sentence, first seen, reopen count, and the closed date and reason), and the owner board's health card counts the open ones as of the last frozen snapshot. Nothing here scores; `docs/05` keeps detectors on the recorded side of the enforced-versus-recorded line.
- **Tests.** Two unit cases (severity by age and the sentence and flat detail; the plan across new, open, closed-and-recurring, unrelated, and resolved rows). A three-case live suite through the real import and clearance paths: nothing before a statement; one finding per line older than 48 hours, graded by age, none for yesterday's line, written by the snapshot freeze, refreshed rather than duplicated on a second run; findings closed with a reason once the run is cleared, and a repeat import leaving them closed. Database package: schema, migration order, and the live RLS and immutability cases. Browser: the Money Desk suite freezes a snapshot with the fee line open and reads the finding on Practice Risk, then clears the run and freezes again to read it closed with its reason; the Practice Risk suite reads the empty state after a freeze; both states audited with axe. Fourteen browser tests, twenty-eight audited states, no violation.

**Not in Increment 1.22.** The other detectors (owner-only clearance as a finding row; unreviewed decisions; refunds without an approval id; out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; duplicate payments; deposit-batch versus bank gaps; sole ownership of a critical process; the forensic suite); the weekly digest with its minimum sample sizes; a decision on a detector finding (the register accepts SoD findings and controls as subjects, not detector findings yet); the nightly job as an event-driven trigger after each import.

## Increment 1.23

Migration 0019 reserved two finding kinds beside the first detector. This increment builds both on the same framework, so every finding the product records now flows through one planner and one writer.

- **The planner, generalised.** `planFindings(existing, kind, subjectKind, candidates)` is the pure diff every detector uses: open a candidate with no row, refresh one whose row is open, reopen one whose row is closed, close every open row of that kind whose subject is no longer a candidate. A candidate is a subject id, a severity, and a flat detail object; the writer stamps `detectors-v2`. The bank-line detector moved onto it unchanged in behaviour (its unit and live cases still pass), and the planner keeps kinds apart: a bank line and a run with the same id never touch each other's rows.
- **Owner-only clearance.** `listDegradedClearances` reads the runs cleared inside the 45-day measurement window whose summary records owner-only clearance, the case Increment 1.11 degrades to when no other eligible person exists. Each becomes a medium finding on the run: "The reconciliation run for 2026-09-14 to 2026-09-15 was cleared on 2026-09-17 as owner-only clearance: no other eligible person existed, so the same hands that recorded or prepared also cleared. The control was not disabled; this row records that it ran degraded." It closes with the reason "outside the 45-day window" once the run ages out, matching the independence grade's window, so the finding and the grade always describe the same runs.
- **Decision past its review date.** `overdueDecisions` takes the active decisions (not superseded) whose review date is before today and grades them by how far past: medium to a month, high beyond. The sentence names the decision kind, its subject, the review date, and the days elapsed, and says the decision still governs until a new one supersedes it; it never names the decider. The finding closes with the reason "superseded" when a new decision cites the old one. `takeSnapshot` hands the detector the decisions it already loaded, so the freeze reads the register once.
- **Tests.** Four unit cases (severity by age and the bank-line sentence; the plan across new, open, closed-and-recurring, unrelated, and resolved rows; the owner-only sentence, candidate, and the planner keeping kinds apart; overdue decisions with a same-day review not yet past, a superseded decision skipped, grading by days over, and a sentence without the decider's name). The live suite gains two cases: a degraded run inside the window recorded and closed sixty days later with its reason, with a degraded run outside the window and an independent run recording nothing; an overdue decision recorded as high at 47 days and closed as superseded once a new decision cites it. The Money Desk browser suite, after the owner's owner-only clearance and a second freeze, reads one open finding (the clearance, medium) beside the closed bank-line finding, and asserts no name appears.

**Not in Increment 1.23.** The remaining detectors `docs/05` lists (refunds without an approval id; out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; duplicate payments; deposit-batch versus bank gaps; sole ownership of a critical process; the forensic suite); the weekly digest; a decision on a detector finding; running the detectors after each import rather than only at a frozen snapshot.

## Increment 1.24

Three of the detectors `docs/05` lists read the ledger, and the ledger rows carry what they need: kind, amount, effective date, posting time, the approval request or exception a guarded entry cites, and the entry a reversal reverses. This increment builds them on the planner from Increment 1.23. Migration 0020 widens the finding kinds and adds the ledger entry as a subject kind; it drops and re-adds the two check constraints and grants nothing new.

- **Release above threshold without approval.** `releaseWithoutApprovalCandidates` mirrors the floor the Increment 1.13 trigger enforces, from the same policy JSON: the master switch and the channel rule must be enabled, the amount must exceed the rule's threshold, and the row must cite neither an approved request nor an applied exception. Any such row is a high finding, because the trigger should have refused it: `docs/05` calls this "a chain-integrity alarm". It is judged over every guarded row, not a window, against the active policy, and closes only when the policy no longer holds that amount to dual release ("below the active threshold or licensed"). The sentence names the amount, the kind, the channel, and the threshold.
- **Posting dated well before it was posted.** A reversal, adjustment, or write-off posted more than seven days (`BACKDATE_DAYS`) after its effective date, inside the 45-day window on the posting date; medium to a month back, high beyond. Exactly seven days is not flagged. Closes when the row leaves the window.
- **Duplicate patient payment.** Two or more patient payments on one account with the same amount and effective date, none of them reversed, inside the window. The first by posting time stands; each later one carries a low finding whose sentence says so, so a genuine second payment on the same day is one row to look at, not an accusation. Reversal rows are read without the window, so a reversal posted later still clears the finding. Closes when one is reversed or the rows leave the window.
- **Tests.** Three unit cases (the alarm only on a guarded, enabled channel above threshold with nothing cited, and never with the policy absent or off; backdating with the seven-day edge, the two severities, and a payment kind ignored; duplicates across accounts and amounts, the later row flagged, and a reversal clearing it). A live suite on the seeded Ridgeview tenant: the dual-release trigger is switched off for one insert to plant the impossible row, and the detector alarms on it, ignores an approved one, flags a write-off posted 71 days after its effective date, flags the later of two same-day payments, and closes that finding once a reversal lands. The database suite proves the runtime role can write the new kind and subject.

**Not in Increment 1.24.** Out-of-hours postings (the product holds no business-hours model per location; `docs/13` puts one in the exception scopes); adjustment-to-production drift by reason code and void and reversal velocity (both need a baseline period the product does not have yet); deposit-batch versus bank gaps; sole ownership of a critical process; the forensic suite; the weekly digest; a decision on a detector finding; running the detectors after each posting rather than at a frozen snapshot.

## Increment 1.25

Two more detectors from the `docs/05` list read rows the product already holds: the deposits the practice prepares and the grants it holds. Migration 0021 adds their kinds and the deposit and entitlement subjects, drops and re-adds the two check constraints, and grants nothing new.

- **Deposit not yet at the bank.** `depositNotBankedCandidates` takes the deposits whose business date falls inside the 45-day window, asks whether any matched bank line cites each (the matcher from Increment 1.19 records the deposit id on the variance row), and flags the unmatched ones once at least five calendar days (`DEPOSIT_BANK_DAYS`) have passed since the business date, the lag a deposit gets to reach a statement. Medium to two weeks, high beyond. "A $40.00 check deposit prepared for 2026-09-08 has no matching bank credit after 9 days." Closes when a credit matches it or it leaves the window. This is the `docs/05` "deposit-batch vs bank gaps" detector seen from the deposit's side; the bank-line detector from Increment 1.22 is the same gap seen from the bank's side.
- **Critical duty held by one person.** `dutyHolders` counts, for each duty the rulebook weights 5 (collect cash, prepare deposit, reconcile bank, approve write-offs, create vendor, release payment), the active people holding it live; `soleHolderCandidates` flags exactly one. Medium. The sentence names the duty and the exposure ("If that person is away, no one can perform it and no one can check it") and never the holder. Closes when a second holder is live or none is. The staff the snapshot already loaded is handed to the detector, so the freeze reads the grants once. This is the `docs/05` "sole ownership of a critical process" detector on grants; the knowledge map the design also names stays not built.
- **What the seed shows.** The seeded Ridgeview grants leave two weight-5 duties with one holder each, so the first freeze on a fresh tenant records two of these findings, and the browser suites read them without a name appearing. Their assertions became row-based rather than totals, because the seeded deposits of 2026-09-14 pass the five-day banking lag on the calendar and would otherwise change the counts.
- **Tests.** Two unit cases (the banking lag with the five-day edge, both severities, and matched rows skipped; holder counting over active people only with exactly one flagged). Two live cases through real rows: a check deposit from the 8th flagged at nine days and closed once a statement's credit matches it; two duties flagged on the fixture's grants and one closed once a second grant is live. Because the snapshot freeze now opens those two sole-holder rows on the shared fixture, the older live assertions read their own kind rather than every finding. Database schema, migration order, and live migration list updated for 0021.

**Not in Increment 1.25.** Out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; the forensic suite; the weekly digest; a decision on a detector finding; the knowledge map behind sole-owner knowledge; running the detectors after each posting rather than at a frozen snapshot.

## Increment 1.26

A detector finding can now carry a control decision, so the register answers the findings the way it already answers duty conflicts. Migration 0022 adds `detector_finding` to the decision subjects; the subject id is the finding's row id. Nothing about the finding row changes: the detectors still open, refresh, close, and reopen it from the rows, and the decision records what the owner made of it, dated, attributed, and reviewed like any other.

- **Recording.** `POST /api/controls/decisions` with `subjectKind: "detector_finding"` (administrator rank, as before). `recordDecision` loads the finding inside the tenant transaction and refuses an id it cannot find and a finding that is closed ("A decision governs an open finding; if it reopens, decide on it then"). Every kind is allowed: remediate, compensate, accept residual, monitor, insure. Supersession works as for any decision; the page passes the governing decision's id when the owner replaces it.
- **Self-licensing.** The rule that nobody accepts or compensates a conflict on their own duties extends to findings. `implicatedUserIds` reads the finding's subject row for the hands it is about: the live holders of a sole-held duty, who cleared a degraded run, who made the overdue decision, who posted the ledger entry, who prepared the deposit. A bank line belongs to the bank and implicates nobody. Those people may still remediate, monitor, or insure the finding. The refusal reads "You cannot accept or compensate a finding about your own work; a different administrator must record this decision." and the route answers it with 403, as a refusal of the actor, where malformed input stays 400; the older refusal of licensing one's own duty conflict now answers 403 the same way. The finding's sentence still names no one; the rule reads ids, not prose.
- **Reading.** `GET /api/controls/findings` returns, for each row, the active decision that governs it (`governingFindingDecision`: the latest decision on that finding that no later decision supersedes) with its kind, note, review date, and whether the review is overdue, and a summary that splits the open rows into `decided` and `undecided`. Practice Risk gains a Decision column ("No decision yet" on an open row without one) and, for administrators, a Decide or Supersede action that opens the same decision form the duty conflicts use, with a line explaining that the row stays with the detector. The owner board's health card says how many open findings wait for a decision. A decision on a finding with a review date is watched by the unreviewed-decision detector like every other, so a finding the owner decided and then forgot becomes a finding again.
- **Tests.** Two unit cases (the governing decision honours supersession and ignores other subjects; the summary splits open rows and leaves closed ones out). One live case through real rows: an unknown id refused, a closed finding refused, the owner refused to accept the residual on the duty only the owner holds and allowed to monitor it, the owner allowed to accept the residual on the front desk's duty, the register reading both, and no finding's status changed. The browser suite drives the same refusal and both recordings in Chromium and reads the decisions back on the rows and in the register: fourteen browser tests, thirty audited states, no violation. Database schema, migration order, and live migration list updated for 0022.

**Not in Increment 1.26.** A decision that closes a finding (the detector owns the status, by design); a decision on a closed finding; decisions on findings from the home board; out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; the forensic suite; the weekly digest; the knowledge map behind sole-owner knowledge; running the detectors after each posting rather than at a frozen snapshot.

## Increment 1.27

The decisions-due card on the home board becomes the review loop `docs/13` item 21 describes: the owner is shown what happened since each decision rather than asked to remember what they meant, and answers with one of three words. Nothing renews on its own; an unreviewed decision still becomes a finding.

- **Measured effect.** For each decision due, `measuredEffectSince` counts the practice's rows since the decision was made: ledger postings; guarded releases (write-offs, adjustments, reversals, refunds, transfers) with a second approver and without; bank runs cleared and how many owner-only; detector findings opened and closed. `measuredEffectSentence` reads them back in one sentence ("Since this decision on 2026-06-01: 14 postings; 2 guarded releases with a second approver and 0 without; 3 bank runs cleared, 1 owner-only; 2 detector findings opened, 1 closed. Directional and practice-wide; no one is named."). The counts are practice-wide by construction: the queries carry no person dimension, so the card cannot become a scorecard. `docs/13` asked for per-payee counts on an exception; the product has no vendor entity yet, so the sentence is the practice's, labelled directional.
- **Three words.** `reviewPlan` in the engine turns a review into one superseding row. Keep carries the kind and the note forward for `KEEP_DAYS` (90), reversible at the next review. Tighten replaces the decision with Remediate, the one response that licenses nothing, for `TIGHTEN_DAYS` (30), and needs a note saying what tightens. Retire writes a `retire` row (migration 0023 admits the kind) with a note and no review date; `latestDecisionFor` then reads the subject as undecided, so a retired acceptance leaves the conflict open and undecided again, a retired finding decision leaves the finding with "No decision yet", and the retirement itself is never due for review. `docs/13` has Tighten open a policy card; the register holds no threshold decisions, so Tighten here means the strictest decision kind, and the mapping is written down rather than implied.
- **Rules that hold.** A review is recorded through `recordDecision`, so the self-licensing rule applies to a Keep of an accepting decision exactly as to the original: the subject of a conflict cannot keep their own licence alive. A retirement cannot be recorded on its own; it is only ever the end of an existing decision (`POST /api/controls/decisions` refuses `kind: "retire"` without `supersedesDecisionId`, and the decision form never offers it, `FIRST_DECISION_KINDS`). A decision a later decision already supersedes cannot be reviewed (409): the register moves forward only. The event for a review carries `reviewAction` so the chain says which word was chosen.
- **Surface.** `POST /api/controls/decisions/review` (administrator rank) takes `{ decisionId, action, note? }` and answers with the new decision and one sentence. The card shows, per decision due, the kind and subject, the original why, the measured-effect sentence, and for administrators three buttons: Keep 90 more days (one press), Tighten and Retire (a note and a second press; Retire's button reads "Retire for good"). The board's cards are now `section`s with `aria-labelledby`, so a browser test can address one card.
- **Tests.** Engine: `reviewPlan` for all three words and the refusals; a retired subject reads undecided; a retire row refuses a review date. App: the sentence's wording and plurals; `decisionsDue` drops a decision once a retirement supersedes it and never lists the retirement. Live: keep, tighten, and retire in sequence on a finding decision, the 404 and 409 refusals, the bare retirement refused, and the measured-effect counts on the fixture. Browser: two finding decisions brought inside the horizon, the card reading both with the sentence, Keep on one and Retire on the other, then Practice Risk reading the kept date, the undecided row, and the retirement in the register: fifteen browser tests, thirty-three audited states, no violation. Database schema, migration order, and live migration list updated for 0023.

**Not in Increment 1.27.** Per-payee or per-exception counts in the sentence (no vendor entity yet); a monthly batched review card; Tighten opening a policy card; out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; the forensic suite; the weekly digest; the knowledge map behind sole-owner knowledge.

## Increment 1.28

The weekly digest `docs/01` items 13 and 14 and `docs/05` describe: batched, never alerting, practice-scoped, with acknowledgment stamping. It is the first consumer of the chain that reads it as a whole.

- **What it counts.** `computeDigest` takes the seven calendar days ending on a chosen date (default today) and counts the practice's rows: ledger postings by kind with totals; guarded releases (write-offs, adjustments, reversals, refunds, transfers) with a second approver and without; approvals requested, given, declined, and cancelled; statements imported; bank runs cleared and how many owner-only; variances cleared with a reason; deposits prepared; day closes frozen; patient statements issued, held, and voided; detector findings opened and closed by kind, and open at week's end; decisions recorded by kind; reviews kept, tightened, and retired (read from the `reviewAction` the Increment 1.27 event carries); decisions past review at week's end; snapshots frozen; sign-ins, MFA enrolments, and all-sessions revocations; duties granted and revoked; policy changes; and the chain itself, its event count and sequence span, with any event kind no named field consumes listed raw so nothing on the chain is hidden. Money, bank, deposits, findings, and decisions come from their own tables; everything else comes from `domain_event` by kind.
- **What it refuses to be.** The queries carry no person dimension, so no row can name anyone: the `docs/01` "never score people" rule holds by construction, not by review. Rates are not shown, because a week is too small a sample to grade (`docs/05` minimum-sample rule); the scope sentence at the foot of the page says both things. `docs/13`'s practice coach card (three practice-scoped rows, one control each) stays not built: the digest reports, it does not yet coach.
- **Acknowledgment stamping.** `digest_acks` (migration 0024): one row per (tenant, period end), RLS forced, never updated or deleted, holding who acknowledged, when, the chain's event count for the period, and a sha256 of the canonical digest they read (`canonicalJson` sorts keys at every level, so the same digest always hashes the same). `acknowledgeDigest` refuses a period that has not ended (400), a period already stamped (409, naming who and when), and a hash that no longer matches the rows (409: "The digest changed since you read it"). The stamp also appends a `digest.acknowledged` chain event, which lands inside the week it acknowledges, so the digest moves on by one event the moment it is stamped and the page says so ("The rows have changed since"). That is deliberate: the stamp binds what was read, and the chain records that a reading happened.
- **Surface.** `GET /api/digest?ending=` (manager rank) returns the digest, its hash, the acknowledgment if any, and whether the rows changed since. `POST /api/digest/ack` (administrator rank) takes the period end and the hash. `/digest` shows a "Week ending" date picker, the acknowledgment card first, then Money, Approvals, Bank and close, Detector findings, Decisions, Access and duties, and Chain as labelled count tables. The home links and the header gain "Weekly digest" and "Digest".
- **Tests.** Unit: the period arithmetic and its exclusive end; the hash stable across key order and sensitive to any count; event labels. Live: the detectors fixture's week counted (three statements, one owner-only clearance, the findings opened and closed, the decisions and their three reviews, the chain from sequence 1), a stale hash and a future period refused, one stamp accepted with the event count and hash bound, a second refused by name, and the digest moved on by one event. Database: the row inserts once per period, refuses a duplicate period and a short hash, and cannot be updated, deleted, or read across tenants. Browser: the Money Desk suite reads the week it just lived in the digest, stamps it, sees the stamp survive a reload and the page report the rows moved, and the front desk is refused: sixteen browser tests, thirty-six audited states, no violation. Database schema, migration order, and live migration list updated for 0024.

**Not in Increment 1.28.** The practice coach card; the six hard events that page the owner (after-hours refund, retroactive-dated entry, waived dual control, deposit variance over threshold, chain failure, new device on a financial role); delivery by email; per-payee rows; the CPA export; out-of-hours postings; adjustment-to-production drift by reason code; void and reversal velocity; the forensic suite; the knowledge map behind sole-owner knowledge.

## Increment 1.29

The six hard events `docs/01` item 14 and `docs/10` decision 6 name as the only signals that reach the owner one at a time. They are read from rows the product already holds, on every read of the owner board, so each is immediate the moment its row exists. No push channel exists yet; the card is where they land, and the weekly digest keeps everything else.

- **The six, from rows.** After-hours refund: a refund posted outside the location's business hours, in the location's timezone, from the server clock. Migration 0025 gives every location a stored week (`locations.hours`: one `["HH:MM", "HH:MM"]` window per weekday or null when closed; default 7:00 to 19:00 Monday to Thursday, 7:00 to 17:00 Friday, closed weekends), the data-model change `docs/13`'s after-hours item asks for. Retroactive-dated entry: any posting more than `BACKDATE_DAYS` (seven) after its effective date, the same rule the snapshot detector grades, read live. Waived dual control: a `control.policy_changed` chain event that added a `waive_dual` exception. Deposit variance over threshold: a bank run whose variance against the practice's deposits exceeds `DEPOSIT_VARIANCE_THRESHOLD_CENTS` ($100). Audit-chain failure: an `audit_chain_checks` row with `ok` false. New device on a financial role: the first session from a browser signature that an account holding a weight-5 duty has not presented before; sessions are read in time order, so a signature seen months ago is known and the first session an account ever has counts.
- **What each says.** A row, a location, a clock, a duty: "A $120.00 refund was posted on Tuesday 2026-09-15 at 21:30 local time; Main is open 07:00 to 19:00 that day." "A holder of Approve write-offs / adjustments and Reconcile bank to PMS signed in from a browser not seen before for that account." No sentence names a person; the owner opens the row from the card. The card states its three assumptions in one line: the $100 threshold is a constant until the policy holds one, a device is a browser signature until enrolment exists, and hours come from the stored week and the server clock.
- **Who sees it.** `GET /api/alerts` is administrator rank, and the board fetches it only for that seat; the manager seat sees no card. The board's other cards are unchanged.
- **Tests.** Unit: the wall clock in Chicago and New York across midnight UTC; outside-hours at the edges and on a closed day; the refund sentence; new-device candidates independent of input order, ignoring known signatures and non-holders; counts by kind. Live, on the seeded tenant: all six planted and read (an in-hours refund and an under-threshold run do not page), sentences checked, newest first, no name. Browser: the Money Desk owner board shows the run's $150 variance and the new-device event for the browsers the suite signed in with, and none of the other four: sixteen browser tests, thirty-six audited states, no violation. Database schema, migration order, and live migration list updated for 0025.

**Not in Increment 1.29.** A push channel (email, SMS, or phone card); acknowledging a hard event; the after-hours hold that turns the refund into a held posting (`docs/13`: the hard event should then read "held", not "posted"); processor-initiated refunds excluded by source (the product posts none yet); a settings surface for `locations.hours`; a policy field for the variance threshold; device enrolment; the practice coach card; the CPA export; adjustment-to-production drift by reason code; void and reversal velocity; the forensic suite; the knowledge map behind sole-owner knowledge.

## Increment 1.30

The after-hours hold `docs/13` describes: the evening refund is held by the same gate that holds a large write-off, so staff learn one behaviour, and the hard event reads "held", never "posted". It uses the exception machinery Precog already had and the hours Increment 1.29 stored; adding time turned a detector into an enforced control.

- **An hours scope.** `ThresholdException` gains `outsideBusinessHours`: when true, the exception matches only a request the caller marked as made outside the location's business hours. The engine trusts the flag it is handed and reads no clock. `AFTER_HOURS_HOLD_EXCEPTION` is a `force_dual` exception on the `writeoff` and `check` channels (the two the ledger's refunds, adjustments, write-offs, and reversals map to) with the hours scope; every tenant starts with it (`defaultTenantPolicy`, and the seed for the development tenants). The engine's specificity order ranks it above amount bands and below a named payee or person.
- **The service reads the clock.** `postLedgerEntry` loads the posting location's stored week and timezone, reads the server clock, and when the moment falls outside the window hands the evaluator `outsideBusinessHours: true` and carries the facts (`afterHours`: location, weekday, date, wall clock, window) on the held payload. The refusal says when and where: "Exception "After-hours hold" forces dual release. Posted at 21:30 local time on Tuesday 2026-09-15; Main is open 07:00 to 19:00 that day." The approval re-evaluates on the same fact, so a request held at night is not re-judged by the morning's clock. The inbox card gains a "Why held" line with the evaluator's reason and, for an after-hours hold, that clock sentence.
- **The database is the second lock.** Migration 0026 re-defines the dual-release trigger: `ledger_posted_outside_hours` reads the location's week and timezone for the row's `posted_at`, and when the active policy holds an enabled, in-window `force_dual` exception with the hours scope covering the channel, a row posted outside hours must cite an approved request whatever its amount; an applied exception never licenses it. The message names the cause: "posted outside the location's business hours (after-hours hold) and cites no approved request". The trigger stays a floor: it enforces the hours scope for `force_dual` only.
- **The hard event tells the truth.** The after-hours refund sentence now ends one of three ways: "Held for a second person, who approved it." when the row cites an approval; "Posted with no second person: the after-hours hold did not run on this row." when it cites none, which the trigger should make impossible; and a pending request the hold caught reads "is held, still waiting for a second person", linking to the inbox. `docs/13` asked for exactly this: never "posted".
- **Tests.** Engine: the hours scope forces a second person on a $40 write-off only when the request is marked outside hours, covers the refund channel and not ACH, validates as a boolean. Live, on the seeded tenant with the location closed for the cases: a $12 write-off by the front desk is held at the service with the clock sentence, refused by the trigger when posted alone, and posted once the owner approves; a $12 refund request built the way the service builds one (the posting screen posts no refunds yet, so the case calls the evaluator and the request writer directly with the hours fact) reads "still waiting" on the hard-events card, is refused by the trigger when posted alone, and after the owner approves reads "who approved it"; the planted after-hours row from Increment 1.29 is now planted with the trigger off and reads "did not run". A same-day reversal in that fixture moved from 04:00 to 10:00 Chicago so the hold leaves it alone. The controls suite now expects the hold as the one seeded exception of a real tenant. `CONTROL_RULEBOOK_VERSION` moves to 0.2.0, since a dual-release default changed; snapshots frozen from here carry it. Browser: the inbox card shows "Why held" for the $200 write-off, worded for either the threshold or, when CI runs at night, the hold. Schema, migration order, and live migration list updated for 0026.

**Not in Increment 1.30.** A refund posting surface (the posting screen posts charges, payments, adjustments, and write-offs; refunds reach the ledger only through an approved request, which the hold and the trigger both cover); turning the hold off (a policy change requiring the owner and a control decision with a review date, per `docs/13`; no surface yet); per-location, per-weekday exceptions for evening clinics beyond editing `locations.hours`; a settings surface for those hours; excluding processor-initiated refunds by source (the product posts none); the "off since / review due" line on the owner home; a push channel; the practice coach card; the CPA export.

## Increment 1.31

Turning the after-hours hold off, as `docs/13` item 25 asks: "requires the owner role and writes a control_decision with a review date, shown on the owner home as 'After-hours hold: off since 3/2, review due 6/1'". Before this increment an administrator could retire any exception through the retire route with an optional reason, so the hold could be switched off with no record of why or of when anyone would look again.

- **A rule about exceptions, not a special case for one.** The engine gains `exceptionTightens`: a `force_dual` or `lower_threshold` exception tightens a control, so retiring it loosens one. `decisionPermitsRetirement` says what that takes: an `accept_residual` or `compensate` decision, a note of at least ten characters, and a review date, required. Retiring a raise or a waiver tightens a control and needs only a reason, as before.
- **One transaction.** `retireException` refuses a tightening exception without a decision (`needs_decision`, 400) or with the wrong one (`invalid`, with the engine's reasons), and writes nothing until both pass. Then it records the decision with the exception as its subject (`subjectKind: "exception"`), writes the policy version, and appends the `control.policy_changed` event with `loosens`, `decisionId`, and `reviewBy`. Off twice is refused (`already_off`, 409).
- **Switching back on.** `restoreException` re-enables a retired tightening exception in a new policy version, clears its end date, and retires the decision that licensed switching it off through the review path, so the register carries one `retire` row that supersedes it. A retired raise or waiver is not restored (`not_restorable`); those arrive only through `addException` with their own residual note and window. `POST /api/controls/exceptions/restore`, administrator rank.
- **The owner home.** `afterHoursHoldStatus` reads the hold from the active policy and its governing decision from the register: on, or off since the exception's end date with the decision's review date, who decided, and why. While it is off the board shows "After-hours hold: off since 2026-09-17, review due 2026-12-16" with a link to switch it back on. The review date also puts the decision on the decisions-due card as it approaches, and past it the decision-past-review detector flags it, so an off switch never goes quiet.
- **The surface.** The Practice Risk exceptions table gains a Switch column for administrators: Switch off opens the decision form limited to Accept residual and Compensate with the review date required before the button lives; Switch on restores; Retire ends a raise or a waiver. The database trigger reads the active policy, so with the hold off a small evening write-off posts alone, and with it back on the same row is refused again.
- **Tests.** Engine: which actions tighten; the decision rule refuses monitor, a missing date, and a short note. Board: on, off with a decision, off with none, overdue, and a retired decision ignored. Live, controls suite: no decision refused with no version written; monitor and no-date refused with the engine's sentences; the switch-off writes the version, the decision, and the event; off twice refused; restore writes the next version, retires the decision, appends its event; on twice refused; a retired raise not restorable. Live, ledger suite, with the seeded location closed: the trigger lets a $12 write-off through while the hold is off and refuses it once the hold is back on. Browser: the owner switches the hold off (the button lives only with a note and a date), the register shows the decision, the home board shows the line, the owner switches it back on, the register carries the retirement, and the line is gone.

**Not in Increment 1.31.** A settings page (the switch lives on Practice Risk, where the policy already shows); a per-location switch (the hold is one exception across the practice's locations); the digest's count of after-hours holds; a hard event for the switch-off itself (the chain event and the register carry it; the digest's policy-change count is the place it would surface); the practice coach card; the CPA export.

## Increment 1.32

The hours the after-hours hold reads were, until now, a column only SQL could change. `docs/13` item 25 says "Hours come from location settings and the server clock, never the client"; this increment supplies the settings.

- **A whole week or nothing.** `validateWeekHours` accepts a week only when every weekday is present, as an opening and closing time in HH:MM on a 24-hour clock that opens before it closes, or closed. A missing day, an unknown key, a malformed time, or a backwards window is refused with the day named, and nothing malformed reaches the row the hold reads.
- **One write, one event.** `updateLocationHours` replaces the location's week and appends `location.hours_changed` naming the location, its timezone, the days that moved, and each day's old and new window ("fri 07:00 to 17:00" to "fri 07:00 to 18:00"). Saving the same week again writes nothing. Another practice's location is not found, by row-level security before anything else.
- **Routes and page.** `GET /api/locations` (manager rank) lists the practice's locations with their week; `POST /api/locations/[locationId]/hours` (administrator rank) sets one. The Locations page shows each location as a seven-row table with a Closed checkbox and two time inputs per day; the owner saves per location and reads back exactly what moved. Manager seats read; user seats see the seat message.
- **The digest counts it.** `location.hours_changed` joins `control.policy_changed` under "Control policy and location-hours changes": moving the window moves the hold's reach, so the week's count of policy changes includes it.
- **Tests.** Unit: the validator's acceptances and refusals, the clock, the phrase, the changed days. Live: the default week listed for this practice only; refusals that write no row and no event; Friday's close moved to 18:00 in one row write and one event with the expected payload, after which `afterHoursFactsFor` reads 17:30 as inside and 18:30 as outside the new window; the same week again writes no second event. Browser: the owner sets Friday's close, reads the saved sentence, sees it after a reload, gets "no change" for the same week and, for a backwards Monday, the named refusal from the same validator the server runs, before any request is sent; the front desk sees the seat message and no Save button. The home links and the nav gain Locations.

**Not in Increment 1.32.** Adding or renaming a location or changing its timezone (the seed and SQL still do that); holidays and one-off closures; per-day windows for individual providers; a hard event for an hours change (the chain event and the digest count carry it); the practice coach card; the CPA export.

## Increment 1.33

The six hard events (Increment 1.29) page the owner and then sit on the card until the seven-day window passes. Nothing recorded that the owner saw one, or what was done. `docs/01` item 14 makes hard events the owner's alone; this increment gives the owner a way to answer each one.

- **One row per event, append-only.** `hard_event_acks` (migration 0027) stores the event's kind and the row it names, when it happened, a note of at least ten characters saying what was done, and who acknowledged it and when. One acknowledgment per event, by a unique key on (tenant, kind, subject kind, subject id); update and delete triggers refuse; row-level security is forced; `app_rw` may select and insert only. The events themselves stay computed from rows on every read; the acknowledgment is the one thing stored.
- **Only what the card shows is acknowledgeable.** `acknowledgeHardEvent` refuses an unknown kind, an empty subject, and a short note (400); recomputes the last seven days' hard events and refuses a subject not among them (404); refuses a second acknowledgment, naming who and when (409). Then one row and one `hard_event.acknowledged` chain event, in the caller's transaction. `POST /api/alerts/ack`, administrator rank.
- **The card reads it back.** `GET /api/alerts` attaches each event's acknowledgment and says how many still wait. On the owner board an acknowledged event reads "Seen by Riley Owner on 2026-09-17: Fee line; cleared in the variance queue with the bank's reason."; an unacknowledged one carries Acknowledge, which opens a note field and Mark as seen, disabled until the note says something.
- **The digest counts it.** A new Hard events section: after-hours holds (approval requests carrying the hours fact, whatever became of them) and hard events acknowledged. `docs/13` item 25 asked for the first; the second closes the loop the card opens.
- **Tests.** Unit: the key, attaching acknowledgments to their events only, the waiting count. Database: the migration's checks, uniqueness, triggers, policy, and grants. Live, on the seeded tenant with a planted retroactive entry: the three refusals write nothing; one acknowledgment writes one row and one event with the expected payload and reads back on the card; a second is refused naming who and when; the administrator cannot update or delete the row; the digest counts one acknowledgment and one after-hours hold and lists the new event kind nowhere else. Browser: the owner acknowledges the day's deposit variance (the button lives only with a note), the card reads "Seen by", the other events still wait, and the digest's Hard events section shows the count.

**Not in Increment 1.33.** A push channel; acknowledging from the digest; an acknowledgment that expires or is reviewed; a hard event for an hours change; the practice coach card; the CPA export.

## Increment 1.34

The CPA month-end package, `docs/13` item 22, has sat in every "not in" list since Increment 1.15. This is its first slice: the aggregate package the accountant downloads, with the property the item is really about, that "a closed month changed" is something the accountant can tell.

- **One calendar month, from rows, on every read.** `computeMonthPackage` reuses the digest's computation over the month (`monthPeriod`, first day to last) and adds what the accountant needs and the digest does not carry: the journal by ledger bucket and kind; adjustments, write-offs, refunds, and reversals by reason code with how many cited an approval; the deposit register by method and status; coverage, standing exceptions, and the decision register at month end; attestations on external channels; the chain head and the last nightly check; and a three-line tie-out (journal equals postings, register equals deposits, chain verified at its last check). Journal lines carry the bucket, the kind, and the reason code; nothing names a patient or a poster, and the live test asserts the package's JSON holds no seeded name.
- **Hash-stamped.** `packageHash` is the sha256 of the canonical package. The same rows give the same hash; any figure moving moves it. The page shows the hash and, once exported, whether the rows have changed since.
- **Every export is a chain event.** `POST /api/cpa/package/export` (administrator rank) computes the package, appends `cpa.package_exported` with the month, format, hash, row count, entry count, and journal total, and returns the CSV or JSON as an attachment. `GET /api/cpa/package` (manager rank) returns the package, its hash, and the exports taken. The export is itself a chain event, so the chain head moves and with it the hash: an export never leaves a month unchanged, and the test says so. `docs/13` asked for a disclosure row per download; the `disclosures` table is keyed by patient, and this package names none, so the chain carries the accounting instead and the patient-level drill-down, when it comes, writes the disclosure row.
- **The page.** `/cpa` with a month picker: the stamp and exports, the tie-out, and six sections. Download CSV and Download JSON for administrators; manager seats read; user seats see the seat message. Nav and home links gain Month-end.
- **Tests.** Unit: the month period across a leap year, hash stability across key order, the flat rows and CSV quoting. Live, on the seeded tenant: the journal ties to the postings and the register to the deposits; the six channels and the after-hours hold are the controls in force; no seeded name appears; a past month reads empty; an export writes one chain event with the expected payload; the hash holds while the rows stand and moves with a new posting. Browser: the owner reads the package (month in progress, hash, tie-out, journal, reasons, register, the hold), downloads the CSV with the expected filename, reads the export stamp, and the front desk sees the seat message.

**Not in Increment 1.34.** The CPA seat and its BAA gate; questions on a package line; the attestation tab (attestations are counted from the events the release route already writes); GL mappings for QuickBooks Online and Xero under maker-checker; the month close with its prior-period refusal; the AR roll-forward by bucket and the deferred-revenue roll-forward; per-figure links into the ledger view.

## Increment 1.35

`docs/13` item 22 carries one line from its judge panel: "All: GL mapping must be tenant-editable under maker-checker or the first import fails." Increment 1.34 shipped the package with journal lines keyed by ledger bucket and kind, which is the practice's vocabulary, not the accountant's. This increment lets the practice say which account each line belongs to, and makes that saying a two-person act.

- **One row per proposal.** `gl_mappings` (migration 0028) keys a mapping by the ledger bucket, the posting kind, and the reason code (`*` covers every reason code on that bucket and kind), and carries the account code, name, and side. A row is proposed by one person and decided by another. The database, not only the service, enforces it: a check constraint refuses a decider equal to the proposer, another refuses a half-written decision, a partial unique index permits one pending proposal per line so two people cannot race it, and a trigger refuses a delete and every update but the one decision that closes a proposal. A change is a new proposal that supersedes the approved one; the history of who mapped what and who agreed stays readable.
- **The service.** `proposeMapping` refuses an unknown bucket, kind, or side and an empty account (400), and a second proposal on a line that already has one pending (409, naming who proposed it). `decideMapping` refuses an unknown proposal (404), one already decided (409, naming who decided it), and the proposer's own approval (403). Both write a chain event: `gl_mapping.proposed` and `gl_mapping.decided`, the latter naming the proposer so the two-person act is legible on the chain alone.
- **The journal reads it.** `resolveMapping` prefers the mapping for a line's exact reason code and falls back to the one covering every reason code. Each journal row in the month-end package now carries its account or null, the CSV reads `→ 1200 Patient receivables (credit)` or `→ unmapped`, the package counts approved, pending, and unmapped lines, and the tie-out gains a fourth line: "Every journal line is mapped to an account", which says how many are not and how many proposals wait. Mapping a line moves the package hash, exactly as any other figure does.
- **The surface.** A Chart of accounts section on `/cpa`: the mappings with their state, a proposal form for managers, and Approve and Reject for administrators. A proposal the viewer made reads "Yours; a different person decides it" and offers no button, from a `mine` flag the route computes, so the session route still hands out no user ids.
- **Tests.** Unit: exact reason code beats the wildcard, the wildcard covers the rest, an unmapped bucket and kind resolve to null. Database: the key, the side and status checks, the maker-checker constraint, the pending index, the triggers, the policy, the grants. Live: bad input refused with five named errors and nothing written; a second proposal refused; self-approval refused by the service and by the database; approval puts the account on the journal line, writes both chain events, and moves the hash; deciding twice, editing, and deleting all refused; a superseding proposal leaves the old mapping governing until approved, and a rejection leaves it governing for good. Browser: the owner proposes a mapping, the row reads "Yours", no Approve button appears, and the counts move.

**Not in Increment 1.35.** QuickBooks Online and Xero export shapes (the mapping is theirs to feed, but the formats are not written); a starter chart of accounts; reason-code-level mappings in the page's form (the service and the resolver take them; the form proposes the wildcard); the CPA seat; month close.

## Increment 1.69

Increment 1.68 had the round keep asking after a proof lapses, and then let the address go. But **the asking is the only telling, and it goes to the mailbox that is failing.**

The person sees it on their own Practice Risk panel if they sign in. Nobody else learns anything at all. So a practice can run for months believing all of its people are being told, while one of them is not — which is the same silent success this arc has been closing since Increment 1.59, met one level up: not a message that failed, but a person the product quietly stopped reaching.

## A standing reading, not a change feed

"Who became unreachable last week" would name somebody once and then go quiet, so the longer a person had been unreachable the less the practice would hear about it. That is the decay this arc refuses everywhere else, and it would be worst here, where the silence is the symptom.

What the owner needs is who cannot be reached **now**. Four ways an address on file can fail to reach the person who saved it, and the reading says which:

| State | Since | What it means |
|---|---|---|
| **Refused** | the day somebody reading it said no | Increment 1.67; the mailbox's own word, and the address cannot be saved again |
| **Retired** | the day it stopped being a destination | Increment 1.68; the codes ran out |
| **Lapsed** | the day the proof lapsed | the practice is still asking, and the sentence says when it stops |
| **Unproved** | the day the address was saved | nobody ever brought a code back |

The states **rank**, and the strongest is the one reported: a refusal outranks anything the practice believes about the address, a retirement outranks the lapse it grew out of, and a lapse outranks the absence of a proof that used to exist. A live case pins that by refusing an address whose proof has not lapsed and is not going to, and checking the reading still reports the refusal rather than calling that person reachable.

## What it deliberately does not report

- **Somebody who withdrew.** That is a decision, not a fault (Increment 1.58). They leave the denominator too, because a person who receives nothing by choice is not a person the practice is trying to reach.
- **Somebody who has left.** Increment 1.65 stopped sending to a deactivated account. Filing that as a failure to reach them would report a rule working as a fault.
- **Somebody who never gave an address at all.** No message was ever expected, their own screen says so, and nothing is broken. That is a different question — who has not set this up — and it is named below rather than folded in here.

## Where it appears, and where it must not

On the owner's board, which is where the practice looks to see what needs it, and **beside** the weekly digest — never inside it. Increment 1.53 established the reason: the digest states facts about its seven days, the owner stamps a hash of exactly those facts, and the month-end package folds the whole digest into its own hash, so a standing figure in there would move every closed month's hash the moment anybody's address lapsed.

There is a second reason here that 1.53 did not need. **The digest is also a message that leaves the product** (Increment 1.64), and it names nobody. This names people. So it lives only where a guard stands, and the route adds it beside `computeDigest` rather than inside it — which keeps it out of the message by construction rather than by care.

- **It names the person and never the address.** The practice needs to know that Riley cannot be reached, not what Riley typed; a live case and a browser case both check that no address appears anywhere in the reading.
- **It shows in every state, the quiet one included.** A card that says nothing when it has nothing to say is indistinguishable from a card that broke — Increment 1.52's rule — so the reading carries how many addresses are on file at all, and a zero reads as measured rather than as missing.
- **One sentence, written once.** The board and the digest quote the same pure function, because a reading shown in two places drifts the moment it is written twice.

`seatOf` moved from the round to `outstanding.ts`, which is where a seat is defined. Two callers now read it — the round choosing what to send and this reading naming who cannot be reached — and a second copy would have been a second answer.

- **Tests.** Unit (6): who said no and that the address cannot come back; how many codes went unanswered; the practice still asking and when it stops; no end date invented where there is none; when an unproved address was saved; a person named and no address in any of the four. Live (9): an empty reading that is measured rather than missing; an unproved address named with its date; the person dropped the moment it is proved; a lapse still being chased, with the day it stops; a retirement with the count, and the same person still reading as lapsed five days earlier; a refusal outranking a proof that has not lapsed; no address anywhere in the payload; a withdrawal counted neither as unreachable nor in the denominator; a person who has left counted in neither. Browser (1): the owner's board naming the person, the reason and the date, and no address.

**Not in Increment 1.69.** People who never gave an address at all — a real gap, and the natural next one, but it is "who has not set this up" rather than "who is set up and broken", and folding them in would make the card mostly a roster. Anything that acts on the reading: no message, no finding, no decision, because the practice knowing is the whole of what was missing. A per-practice choice of any of the numbers behind it. An address for somebody who is not a user.


## Increment 1.70

Increment 1.69 reports who is set up and broken: an address on file that refuses, retires, lapses, or was never proved. It reads only people who have an address in force, and it said so — somebody who never gave one "is not a broken promise". That is true of the **address**, and it hides a plainer failure one step earlier: **a person the product would send to, who never told it where.**

Nothing fails. Nothing is refused. Nobody learns anything. It is the same silent success this arc has been closing since Increment 1.59, at the last place it could still hide.

## The hard half is who counts

A card listing everybody on the roster without an address is a card nobody reads. Most of a practice's people are sent nothing, so a list that is mostly fine teaches a reader to skip it — and a skipped card is worse than no card, because it looks like coverage.

So the reading answers a narrower question, **who could act on what a notice says?**, and it answers it from the guards rather than from a rank written down here:

| Who | Opens | Counted |
|---|---|---|
| The owner, and any manager | `/home`, where three of the four notice kinds send a person | yes |
| The outside accountant | `/cpa`, by the one grant that seat carries | yes |
| The front desk | four screens, none of them a notice's | no |
| A new hire holding nothing | none | no |

Every notice names where the doing happens (Increment 1.57), and what opens that screen is what `navLinksFor` opens (Increment 1.49). `NOTICE_PLACES` names the screens the notices point at, and a unit case asserts that every notice `outstandingNotices` can produce points at one of them — so the constant cannot quietly fall behind the list it describes, and the scope cannot drift from the guards.

## Three rules it keeps from earlier increments

- **Having an address stays anybody's to choose.** Increment 1.58 settled that where somebody is reachable is theirs, and the round still sends to whoever saved one. This narrows nothing. It reports the converse and only the converse: somebody the practice *needs* to be able to reach and cannot.
- **A withdrawal is a decision, not an absence.** Increment 1.69's rule holds, and it costs something to hold: a manager who withdrew is a manager the practice cannot tell anything. So the reading counts them, names them as withdrawn in their own list, and says what the decision costs — rather than either filing a decision as a fault or passing over it in silence.
- **Somebody who has left is in neither list nor the denominator.** Increment 1.65 stopped sending to a deactivated account, and a person the product must not reach is not one it was never set up to reach.

## Where the two readings divide

At the moment somebody saves an address. Before it, this reading names them; after it, Increment 1.69's does — proved or not. A live case pins exactly that handover: the owner saves an address, leaves `missing`, and appears in the same breath under `unproved`.

The denominator is the people who could act on a notice, and it does not move when the numerator does: a denominator that shrank as people were fixed would make the card say less the better the practice got. It appears on the owner's board and **beside** the weekly digest, never inside it, for both of Increment 1.69's reasons — a standing figure would unsettle a stamped week's hash, and this names people while a message that leaves the product names nobody.

- **Tests.** Unit (8): an owner, a manager and the accountant each counted, and why; the front desk, a lead and a bare `readonly` left out; an unknown role reaching nothing rather than everything; the sentence saying what never happened and what would change it; the accountant's seat named as the accountant's; a withdrawal called a decision and still costed. Live (8): the two people named before anybody says anything, with the denominator; the rest of the roster left out; the accountant's seat sorted first; the handover to Increment 1.69 the moment an address is saved; the denominator still while the numerator moves; a withdrawal moved to its own list and still counted; no address anywhere in the payload; somebody who has left in neither list nor the denominator. Browser (1): the owner's board naming the accountant and the reason, leaving the front desk and the new hire out, and carrying no address.

**Not in Increment 1.70.** Anything that acts on the reading: no message, no finding, no decision — the practice knowing is the whole of what was missing, which is the shape Increment 1.69 chose for the same reason. Asking somebody for an address, which would be a message to a person the product has no address for. An address for somebody who is not a user. Retiring an address nobody ever proved. A per-practice choice of who counts as able to act, which would be a setting where the guards are the answer.


## Increment 1.71

The question this answers was put as **an address for somebody who is not a user**, because `notice_addresses.user_id` is a foreign key into `users`, the own-user trigger is enforced against `app.user_id`, and a firm's shared mailbox is not a person. The answer is no — and the foreign key is not the reason.

A destination with no person behind it would be a **second kind of recipient** standing beside the seat. It would need its own proof that the mailbox consents (Increment 1.61), its own way for a stranger to refuse (1.67), its own place in the reading of who cannot be reached (1.69) and its own place in the reading of who was never set up (1.70). That is four second answers to questions the seat already answers, and this schema refuses second answers everywhere else. Two notions of "recipient" would eventually disagree about who was told what.

## What a shared mailbox actually wants

To **be** the recipient. This product's word for a recipient is a seat (Increment 1.49), and nothing stopped `accounting@firm.example` holding the outside accountant's one — proving its own address, being told when a month closes, refusing, appearing in both readings — except one thing:

> **`users` was written by the seed and by nothing else.** No screen, no route and no service in the product created a person. A practice that wanted an outside accountant could not have one, and Increment 1.70's card could name an accountant who never said where to send their messages while offering no way to add one.

So the gap was never an address for a non-user. It was the act of adding the person.

## The practice names the seat; the person supplies the secret

That is Increment 1.58's rule read the other way round, and it is the same rule. An address is set by the person it belongs to; so is a password. The row the invitation creates carries a hash of thirty-two random bytes nobody kept, so the account exists and **no password opens it** until its holder chooses one — a property of the rows rather than a promise about the code, and a live case proves it by checking that neither the invitation secret nor the username opens the account.

| Decision | Why |
|---|---|
| **Only the outside accountant's seat** | 1.49 settled that it pairs with no duty in the SoD rulebook, so inviting it creates no conflict, and it reaches the month-end package and no other screen. A general "invite anybody to any role" would be a grant path around `evaluateGrant`, the check every other new duty goes through |
| **Owner rank to invite** | The act adds somebody who will read the practice's month-end figures |
| **The ask and the answer are two tables** | A `claimed_at` column would be a status the rows under it could contradict, and an UPDATE on an otherwise append-only row. A claim row is a fact that cannot be unwritten — the shape a proof already has beside a challenge |
| **Seven days, against a stop link's thirty** | The two secrets point in opposite directions. A stop link can only withhold; this one **opens an account**, and it is the only token in this product whose leak hands somebody a seat rather than taking one away |
| **The link is shown once** | The rows keep a hash. A practice that mislays it invites again rather than asking this product to repeat a secret it does not hold |

The invitation page borrows the stop page's shape exactly (1.67): the second page in this product outside a session, it reads and does not act, it answers an unknown link and another practice's link in the same words, and it offers nothing else. It names the practice and the username, because the person holding it needs to know what to type at a sign-in box. It names no address — this seat has none yet, and saying where to send its messages is the seat's own act.

Two triggers carry the rules the code must not be trusted with. An invitation must name the acting user as its inviter, which is 1.58's rule read the other way: there nobody may act for another person, here nobody may record another person as having acted. A claim asks nothing at all about the session, because the person claiming has no account yet — the same deliberate absence 1.67's refusal has.

- **Tests.** Unit (7): a reference read back, and every malformed one refused before the practice id in it reaches a cast; the whole reference in one path segment; the week, and that it is far shorter than a stop link's life; a username somebody can be told over the phone, and every shape that would make "the same username" a question with two answers. Live (13): the seat created at the lowest rank with the one grant, and no second factor; an account no secret the practice holds opens; the seat handed straight to 1.70's reading; a username already in use refused in words; an unknown secret and another practice's secret answered identically; a weak password refused **without spending the link**; the password set and the link spent once; the claimed seat dropped from the open list; both acts in the chain, named to the practice's actor and then to the seat's own; an inviter who is not the acting user refused; an update refused; a week that has run out refused. Browser (1): the owner invites, the link appears once, the seat lands on the board's "never set up" card, the invited person opens the link with no session and sets a password, and the same link then says it has already been used.

**Not in Increment 1.71.** Inviting any other seat, which needs `evaluateGrant` rather than a second path around it. Re-sending an invitation, which would be a new one rather than a repeat of a secret the rows do not hold. Deactivating or removing a seat. A destination with no person behind it, which this increment argues should not exist. Anything about what the new seat receives: it is a seat like any other, so Increments 1.58 through 1.70 already decide that, starting with its own act of saying where.


## Increment 1.72

Increment 1.71 created the first account this product ever made for itself. This increment walked that account's first sign-in the way the person on the other end meets it — and found that **they could not finish it**.

## A rank on the one route rank must not gate

The enrolment route opened at `user` rank. The outside accountant's seat is `readonly` **by construction**: `isCpaSeat` is exactly "holds the reporting grant and does *not* meet `user`" (Increment 1.49), which is what makes it a seat rather than a member of the practice holding a grant. So the one seat a practice can invite was the one seat that route excluded.

That is not a withheld screen. The middleware sends every unenrolled session to `/enroll-mfa`, so the seat arrived at the only screen it was allowed to reach, whose only control answered **"You do not have access to this action"** — with no way forward, and nothing naming what was wrong. A seat that cannot enrol can never finish a first sign-in, and a seat that cannot sign in is one the practice believes it has.

> Nothing hid this before 1.71 because the only `readonly` account in the fixtures was seeded already enrolled. The first seat a practice created for itself was also the first that had to enrol. A defect can sit in a guard for ten increments while every fixture routes around it.

The rank comes off deliberately rather than by omission. Enrolling one's own second factor is not an action rank should weigh: it is how an account becomes usable at all, it acts on nobody else, and a rank that gates it gates signing in. `readonly` is the lowest rank the product has, so the route now admits every signed-in account and no more; `requireMfa: false` is what lets an unenrolled session through at all, and the session is still the thing being trusted.

`seats.test.ts` reads the route file and asserts both handlers sit at `readonly` — in the place where seat-and-route agreement already lives, and by reading the guard rather than asserting about it, because a claim about a guard that does not read the guard goes stale silently.

## And a scrollable region no keyboard could reach

The same walk put an axe audit on the enrolment screen for the first time. It found a **serious** violation that had been there all along: the setup URI sits in a horizontally scrolling block that was neither focusable nor named, so a keyboard user could not scroll it — and that string is the one thing the screen exists to hand over. It is now focusable and labelled.

## What this increment deliberately did not change

The seat signs in and lands on the practice home, where the board tells it in words that the board is for the manager and owner seats, and the header offers the one screen that is theirs. A redirect was written and then **reverted**: it would have replaced a plain refusal with a silent bounce, and a person who types `/home` deliberately is owed the explanation rather than being moved without one. An existing browser case already pinned that refusal, which is how the change was caught. Landing everybody on the practice home is what sign-in does; the seat is not stuck there, and being told why is this product's answer everywhere else.

- **Tests.** Unit (1): both enrolment handlers read from the route file and asserted at the lowest rank, beside the seat's other rules. Browser (1): the invited seat signs in with **no authenticator at all**, is taken to enrolment, is *not* told it lacks access, reads the setup URI the way an authenticator would, enrols, is signed out, signs in again with a real code, is told in words that the board is not theirs, and follows the one link it is offered to the month-end package.

**Not in Increment 1.72.** A seat-aware landing after sign-in, argued above and reverted. Anything about the address that seat has not yet given — that is the seat's own act (Increment 1.58), and Increments 1.69 and 1.70 already report it until it happens. Re-inviting a seat whose link expired. Inviting any other seat.


## Increment 1.73

Increment 1.71 gave a practice the act of inviting the outside accountant's seat, and 1.72 proved the invited person can finish a first sign-in. Neither gave them a **second chance**.

`inviteAccountant` has exactly one exit that creates anything, and it always creates a **new** user. A practice asking to invite the same seat again is refused earlier still, by the username check — so the `UNIQUE` index that supposedly forbade a replacement was never even reached. There was no re-invite path at all.

## What a lost link actually cost

The practice's only recourse was to invite a different username. That leaves the first account **orphaned**:

| | |
|---|---|
| active, holding the reporting grant | so every reading counts it |
| a password hash of bytes nobody kept | so nobody can ever sign in |
| an invitation that expires and cannot be reissued | so nothing can open it |
| named on Increment 1.70's "never set up" card | **forever** |

That last row is the sharp end. The card I shipped three increments earlier would accumulate entries nobody could clear — the signal that never clears, which this product refuses everywhere else.

## The seat is fine; only its secret is stale

The person is the same person and the practice already decided to invite them, so the act mints a new secret and writes nothing else. The user row, the username, the grant and the seat's place in every reading are untouched, because none of that went wrong. A live case pins it: the reissued seat comes back with the same `userId` and the same username, and a different secret.

**Newest row in force, and nothing marks the old one.** This is exactly the shape `notice_addresses` has held since Increment 1.58: append-only, last row wins. A `superseded` column would be a status the rows under it could contradict, written by whatever remembered to write it. Instead "live" is derived — an invitation is live when no newer one exists for its seat — so **the old link stops working on the same read that finds it**, rather than because a flag was set correctly. That is why migration 0052 drops `seat_invitations_one_per_seat`: it forbade the second row that makes the first one stale. What replaces it is not a weaker rule but a different one, enforced in the read, and a live case holds the old link and finds it refused with `superseded` — from both the lookup and the claim, because the claim re-looks-up rather than trusting what a page was rendered with.

`seat_invitations_token_uidx` stays. One secret still names at most one invitation; only how many invitations one seat may accumulate changed.

Two refusals bound the act. A seat that has already been opened cannot be reissued — somebody who cannot sign in needs their password recovered, not a link that would let whoever holds it set one. And somebody who was never an invited seat cannot be reissued at all, because handing out a link that sets a password for an account with a password of its own is the practice giving away an account it does not own.

The panel now lists the seats waiting to be opened, one live link each. A seat reissued three times has three unclaimed rows, and offering all three would hand the practice three links of which two open nothing.

## What the browser case caught

Two things, both mine. The invite panel never re-read after inviting, so the seat it had just created did not appear among those waiting — the link showed once and then nothing, and a practice that mislaid it had no row to act on. And the case's own first wait matched text that was already true before the reissue, so it read the stale link and compared it with itself; it now waits on the link **changing**.

- **Tests.** Live (6): a seat reissued with the same identity and a new secret; the older link refused as superseded, by both the lookup and the claim, having worked immediately before; one live link per seat however many were sent; a claimed seat refused with the sentence pointing at password recovery; somebody who was never a seat refused; the chain naming the reissue and what it replaced. Migration (4): the unique index dropped; the newest-row index added; **no column that could disagree with the rows under it** — no `superseded`, no `revoked_at`, no UPDATE, no DELETE; the token index left alone. Browser (1): invite, mislay, reissue from the waiting list, the old link opening nothing and saying why, the new one opening the seat.

**Not in Increment 1.73.** Recovering a seat that has already been opened, which is password recovery and has its own ceremony. Withdrawing or deactivating a seat. Telling the invited person their link was replaced — the product has no address for them, which is the whole reason the link exists. Inviting any seat other than the outside accountant's.

## Increment 1.74

Increment 1.70 shipped a card naming the people a practice was never set up to reach, and the outside accountant's seat is on it from the day it is invited. Increment 1.71 created that seat, and 1.72 walked its first sign-in. This increment walked the next step — the seat clearing its own name off that card — and found the seat could not.

The three routes behind the delivery panel had been widened for this seat deliberately. `GET` and `POST /api/notices/address`, `POST /api/notices/prove` and `POST /api/notices/send` all carry `{ minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }`. The only screen carrying the panel was Practice Risk, which is `{ minRank: "manager" }` with no entitlement, and the seat is `readonly` **by construction** — `isCpaSeat` is exactly "holds the reporting grant and does not meet `user`".

So the guards were opened for a seat and the surface was not. This is the shape Increment 1.72 found on the enrolment route, and it fails the same way: a permission nobody can exercise looks, from every reading the product takes, exactly like a permission that works.

## The message made it worse than merely absent

`renderProofMessage` ended on one sentence for every reader:

> Sign in at `<app>`, open Practice Risk, and type it beside your address.

The accountant's seat could ask for a code — the route admits it — receive the code, and be told to open the one screen in the product it meets a refusal on. A message that names a screen its reader cannot reach is worse than one that says nothing, because it reads as the product working and the reader failing.

## One panel, not a second copy of the act

The 187-line delivery section came out of `/risk` verbatim into `(app)/delivery-panel.tsx`, and its four acts — save, send now, ask for a code, prove — came out into `(app)/delivery-acts.ts`. Both screens render the one component and call the one set of acts; each keeps only what is its own: which control is busy, where the sentence goes, and the draft the saved value replaces.

A second copy would be a second answer to one question, which is what this codebase refuses from the owner board's counts to the reading of who cannot be reached. It would also drift: the panel quotes the standing rules on retries, the hourly limit and the scheduled round, and two copies of those sentences are two places for a rule to be stated wrongly.

## The screen a message names is derived, and checkable

`DELIVERY_PLACES` maps each seat to the screen carrying its panel, and `deliveryPlace(seat)` names that screen **as the header names it**, reading the label back out of `NAV_LINKS`. A message calling the screen something the header does not would send a reader hunting for a link that is not there.

Each entry also carries a `surface`: the file that renders the panel. That is the same claim `NavLink.gate` makes about a route file, and it is checked the same way — a unit case reads each `surface` and asserts it renders `DeliveryPanel`, and asserts the seat can open the `href` under `navLinksFor`. A constant that claims a place must be checkable against the place, or it is a comment with a type.

| | Owner and the practice's own seats | The outside accountant's seat |
|---|---|---|
| Screen | Practice Risk (`/risk`) | Month-end (`/cpa`) |
| What opens it | manager rank | the reporting grant |
| What the code's message says | open Practice Risk | open Month-end |

## Why the panel is on `/cpa` rather than `/risk` being widened

Widening `/risk` would hand this seat the practice's SoD findings, its decision register, its exceptions and its grant controls — everything the seat exists not to have. The seat's whole shape is what lets it exist without a BAA. The panel belongs beside the seat's own screen; the screen does not belong to the panel.

- **Tests.** Unit (9): every notice seat has a screen; each named screen renders the panel; each seat can open the screen named for it; each screen is called what the header calls it; the two seats resolve to different screens — plus the renderer taking the caller's name rather than one screen's. Live (1): a code sent for the accountant seat names Month-end, while every code this practice sent the owner still names Practice Risk, so the message reads its reader rather than having been renamed for everybody. Browser (1): the seat signs in, finds the panel on the only screen it has, saves an address, asks for a code, reads out of the sent row that the message names Month-end and not Practice Risk, brings the code back, and then meets the old screen's refusal — so the panel here is the whole of the way in rather than a convenience beside one that worked.

**Not in Increment 1.74.** The month-close deadlock a single-admin practice sits in, which needs an argument about the SoD rulebook rather than a surface. Any change to who may hold an address: the seat still sets its own and nobody else's, enforced at the database. A landing that reads the viewer's seat, argued and reverted in Increment 1.72. The notices themselves — what this seat is owed is what Increment 1.57 derives, unchanged.


## Increment 1.75

A practice with one administrator can never close a month. Not "rarely" — **never**, and it is the first month-end every such practice reaches.

The chart of accounts runs under maker-checker (Increment 1.35): proposing a mapping needs manager rank, deciding one needs administrator rank **and a different pair of hands**. `closeMonth` refuses while any journal line is unmapped, with no waiver. So the sole administrator proposes a mapping nobody may decide, every line stays unmapped, and the outside accountant never receives a frozen month.

## What made it a trap rather than a gap

**Nothing in the product gets them out.** No route writes `users.role`. The only `insert(users)` this product performs hard-codes `readonly` for the outside accountant's seat (Increment 1.71), and the store updates `active`, the MFA fields and the password — nothing else. A practice cannot appoint a second administrator, so the control asks for a person the product gives it no way to have.

And the refusal said: *"You proposed this mapping; a different person must approve or reject it."* True, and useless. It names an act the reader cannot perform and implies a path that does not exist.

## The escape is a decision, and the register already held everything it needed

Increment 1.31 settled the shape for a control that must sometimes stand down: a decision with a reason, a residual note and a required review date, with the control's state **derived from whether that decision stands**. `DECISION_SUBJECT_KINDS` already carries `"control"`, `DECISION_KINDS` already carries `accept_residual`, and `validateDecision` already requires the review date.

So this increment adds **no exception action, no channel, no table and no column**. `soleDeciderStanding` reads the newest decision on the subject `gl_mapping_maker_checker`; retiring it reads as undecided again, and the second pair of hands comes back with nothing to correct.

`ThresholdException` would have been the wrong home. It is channel-scoped — `validateThresholdException` runs every entry through `isReleaseChannel` — and its four actions all govern money release. The chart of accounts is not a release channel, and a pseudo-channel for it would corrupt the vocabulary the six-channel coverage table reads.

## The database keeps the guarantee, and learns to read

Migration 0028 wrote maker-checker into the table: `CHECK (decided_by_id IS NULL OR decided_by_id <> proposed_by_id)`. A CHECK sees one row, and the way out is a fact in another table — so migration 0053 replaces it with a trigger that reads the register:

| Before | After |
|---|---|
| A CHECK: the decider is never the proposer | A trigger: never, **unless the practice has recorded that it decides alone** |
| Enforced at the database | Still enforced at the database |
| No way out | A dated, reviewable, reported way out |

A decider who is not the proposer is admitted exactly as before, and a self-decision with nothing behind it is refused exactly as before — with a message naming the register rather than a person the practice may not have.

## The decision is self-licensed, and has to be

`recordDecision` refuses self-licensing: nobody accepts or compensates a conflict on their own duties. Here the sole administrator records the decision that licenses the sole administrator, which is self-licensing in substance — and it slips past the letter, because the check derives its person from the subject id and a `"control"` subject names none.

That is not something to leave silent. **Requiring a second administrator to record it reproduces the deadlock one level up**: the practice would need two administrators to license the state it is in precisely because it has one.

So what makes it safe is not a second pair of hands. It is that the standing-down is dated, reviewed, and **reported to the one independent party this product has**. The month-end package states how many of the mappings this month's own figures were read through had one pair of hands on both ends, and `PACKAGE_SCHEMA_VERSION` moves to `package-v7` because that is a figure about the month and belongs inside the hash. `approved` and `pending` stay outside it, as they always have: those are the practice's position now, and folding them in would move a frozen month's hash from a later month's work.

I rejected requiring the accountant to attest it. Increment 1.51's machinery fits and the seat is independent by construction, but a practice with no accountant would then be unable to close — a new deadlock in place of the old one. Reporting to that seat is unconditional; depending on it is not.

## Two surfaces that would have shipped the same defect twice

Building this, I twice nearly shipped the shape Increments 1.72 and 1.74 exist to fix.

**The Approve button is hidden from the proposer.** A practice could record the decision and still find no way to act on it. So asking is now an act: the row offers "Nobody else can decide this", the refusal answers with what to do, and the decision form sits inside the refusal.

**The form offered every decision kind.** Its default is `remediate`, which licenses nothing — the browser case caught this by recording a decision and watching the control stay shut. Recording that the practice will monitor the control is true and changes nothing, so offering it here would hand somebody an act that looks like the way out and is not. Only `accept_residual` and `compensate` are offered.

## The test that claimed what the product could not do

`money-desk.e2e.test.ts` carried a case titled *"…the owner proposes, cannot approve their own, and the approval reaches the journal"*. It proposed, asserted the owner could not decide their own, opened the close confirmation, and clicked **Cancel**. It never approved anything and never closed anything.

Nobody noticed because the fixture *could not* approve: Ridgeview has one administrator and the product cannot make a second. The title recorded an intention the product had never satisfied. It now records the decision, approves, and watches the account land on the journal line — which that sentence has claimed since Increment 1.35 and proves here for the first time.

- **Tests.** Unit (11): the standing read from the register; a decision about another subject licensing nothing; only the kinds that say the practice chose this state; a retirement tightening the control back; an overdue review still licensing and saying so; the refusal counting the people who could decide, and naming the act where there are none; the accountant's sentence. Live (5): the sole administrator refused in three sentences, and the database refusing it too; a `monitor` decision licensing nothing; the decision admitting the self-decision, with the chain naming `decidedAlone` and the decision that licensed it; the package reporting the count and the tie-out saying so in the row the accountant's seat reads; retirement putting the second pair of hands back, at the service and at the database. Migration (4): the CHECK dropped for a trigger; the newest-decision read with only the licensing kinds; no column that could disagree with the register; the refusal still naming where a licence would come from. Browser (1): the rewritten maker-checker case above.

**Not in Increment 1.75.** User administration, which is the root cause: this product ships a control requiring two people and no way to have two people, and a recorded decision buys a practice a governed way to proceed rather than a second person. Retiring the decision from the month-end screen — Practice Risk is where the register is reviewed, and a second place to retire one would be a second answer. Any change to `closeMonth`, which still refuses while a line is unmapped; what changed is that the practice can now map them. The MFA recovery lockout the seat-reachability audit surfaced, which is queued and worse.


## Increment 1.76

Every account in this product was counting down to a lockout nothing could undo. The practice owner's included.

Four facts composed into it, and each is ordinary on its own:

| | |
|---|---|
| `mfa_enrolled_at` is written once | by `completeMfaEnrollment`, and cleared **nowhere** |
| both enrolment functions refused an enrolled account | `beginMfaEnrollment` threw; `completeMfaEnrollment` returned `already_enrolled` |
| `/enroll-mfa` bounced anybody enrolled to `/home` | the middleware's second redirect |
| recovery codes only ever decrease | `replaceRecoveryHashes` has exactly one caller, the burn in `authorize`, and the only writer that *adds* is the enrolment nobody enrolled can reach |

So the supply is ten, it never goes up, and the screen that could refill it is shut to everyone who has ever used it. Burn the last code, lose the phone, and the account is gone — no re-pairing, no re-issue, and a two-admin recovery ceremony that resets only the password and has no surface at all.

## The trap in the obvious fix

Opening enrolment to an enrolled account is the fix, and doing it directly would have made things **worse**. `setMfaPendingSecret` writes `mfa_secret_enc` itself — harmless on a first enrolment, where the column is null and there is nothing to lose, and destructive on a re-pair, where merely **opening the screen** overwrites the working secret. A person who started a re-pair and changed their mind would have had the countdown replaced by an immediate lockout.

So migration 0054 gives a pairing in progress a column of its own. The live factor is untouched until a code from the new authenticator comes back — the rule the address proof has held since Increment 1.61: nothing becomes the destination until somebody shows they can read from it.

Neither auth lookup returns that column, deliberately. A pairing in progress is not a factor, and the functions that resolve a person for a sign-in or for a guard should be **incapable** of handing one out rather than merely disciplined about it. The enrolment path reads it through an accessor of its own. That also avoided altering `auth_lookup_user_by_id`, which is owned by `app_auth_lookup` and cannot be dropped by the migration role — a constraint I found by trying.

## Why a session is the whole of the authority

A session exists only because somebody passed the second factor or spent a recovery code. The person who has just spent one, on a phone they no longer have, **is** who a re-pair is for.

- Asking for the old code as well would refuse the one case this exists to serve.
- Asking a second administrator to approve it would be the deadlock Increment 1.75 spent an increment undoing, in a product where a practice may have exactly one.

What the act does carry is consequence: the new secret replaces the old, a fresh set of ten codes replaces whatever was left, every other session is revoked, and the chain records `auth.mfa_repaired` rather than `auth.mfa_enrolled` — two acts, two kinds, so an audit can tell a factor that changed from one first set.

## The reissue is the fix, not the re-pairing

Pairing a new phone stops the countdown; **reissuing the codes is what ends it**. The same act that pairs the phone mints the ten codes that would be used to reach that phone, so the supply is restored rather than merely stopped from falling. Without that, a person who re-paired would still be walking the same one-way path with however many codes they had left.

## Finding it

The link sits in the app header, outside `nav`. `navLinksFor` answers which screens a rank or a grant opens; this is not one of those — every signed-in person may re-pair their own factor. A mechanism nobody can find is not a mechanism, which is what Increments 1.72 and 1.74 were both about, and what this increment would have repeated by shipping the route alone.

The screen now serves both acts and reads its visitor: a first pairing is forced and offers no way out, while a re-pair says the old phone keeps working until a code comes back and offers "Leave this as it is".

- **Tests.** Unit (8, five new): a pairing starts on an enrolled account and says so; the live factor, its enrolment date and its codes are untouched while one is staged; a code from the factor already on the account is refused, so a code the person already holds cannot finish a pairing nobody started and silently reissue their codes; the promotion replaces the secret, mints ten fresh codes and clears the staging; the new authenticator signs in and the old one does not; the chain names the act. Live (3): the same against real Postgres, plus a case asserting that **neither** auth lookup returns the pending column — read off the result fields, so it fails if anybody adds it. Migration (3): the column added, its comment, and nothing else touched. Browser (1): the owner finds the link in the header, reads that the old phone still works, pairs a new authenticator, sees ten new codes, and then signs in on the new one while the old one is refused.

**Not in Increment 1.76.** The person who is **already** locked out: the two-admin recovery ceremony has three working routes, zero callers anywhere in the app, and resets only the password — so it cannot help somebody whose factor is gone even once it has a screen. That is the next increment, and it needs a way to clear an enrolment, which no store method offers today. Also out: the JWT that keeps saying "needs enrolment" after enrolment completes, pinning a dead session to `/enroll-mfa` with the only sign-out control in transient React state; and any rate limit on how often an account may re-pair.


## Increment 1.77

Increment 1.76 let a person re-pair their authenticator. It could not reach the person this was all about, and said so: **that screen needs a session, and somebody whose phone is gone and whose recovery codes are spent cannot get one.**

The product already held the answer to that, and had held it since Increment 0.6. Three facts kept it from working.

| | |
|---|---|
| The two-administrator ceremony has three working routes | and **zero callers** anywhere in the app — `grep` across the repository found the route files, generated `.next` types, and one line of this document |
| It resets a password and nothing else | `consumeRecoveryCeremony` called `setPassword`, and never touched `mfa_secret_enc`, `mfa_enrolled_at` or `recovery_codes_hash` |
| No store method could clear an enrolment | so even given a screen, the person finished the reset and met the same demand for a code they cannot produce |

**And a fourth, found by running it against a real database for the first time.** `auth_lookup_recovery_ceremony` is a SECURITY DEFINER function owned by `app_auth_lookup`, and migration 0007 granted SELECT on `recovery_ceremonies` to `app_rw` alone. Migration 0003 had already written the rule down — FORCE ROW LEVEL SECURITY binds table owners too, so such a lookup needs a GRANT *and* a role-scoped SELECT policy — and did exactly that for `users` and `sessions`. So every approval and every consume has answered `permission denied for table recovery_ceremonies` since 0007. Nothing caught it because nothing called it: the unit tests run against the memory store, which has no grants to get wrong. **Migration 0055** adds both halves.

- **The store learns to clear an enrolment.** `clearMfaEnrollment` empties the live secret, any pairing in progress, the enrolment date and the recovery codes in one write, and revokes the sessions. One write, because a half-cleared account is worse than either end of it: an enrolment date with no secret makes `needsMfaEnrollment` false and every code refused, so the person can neither pass the factor nor be sent to set a new one. Only the ceremony calls it; nothing a single person can reach clears somebody else's factor.
- **A consumed ceremony always means both.** The password is set and the factor is removed, so the next sign-in lands on `/enroll-mfa` — the screen Increment 1.76 made work for an account that carried a factor before. One act, one `auth.recovery.consumed` event, and its payload now carries `secondFactorCleared` rather than leaving a reader to infer it.
- **The ceremony gets its screens.** Practice Risk gains "Getting somebody back in": a manager reads it and an administrator acts on it, which is the split the rest of that page holds. `GET /api/recovery-ceremony` answers what this practice can do; the approver receives one link, once, and this product keeps only a SHA-256 of it. `/regain/[ref]` is the third page outside a session, and borrows the shape Increments 1.67 and 1.71 settled: it reads and does not act, it answers a link that ran out and a link that was never ours in the same words, and it offers nothing else.
- **`POST /api/recovery-ceremony/reset` is deleted.** It had no caller, it duplicated the new server action, and it was the one route under `/api` that did not pass through `withGuard`. Its entry in `check-route-guards.mjs` goes with it, leaving that allowlist holding only the two transport exemptions — so the invariant is restored rather than merely tidied.

**Two administrators, and no exception.** Increment 1.75 met the same shape and answered it with a governed exception; this one gets none, and the refusal says so out loud so that a practice which has met the GL mapping exception is not left expecting one. The GL mapping control protects a figure. This one protects every account in the practice: one administrator who can clear somebody's second factor and set their password can post as them and approve as them, which is the whole of what maker-checker prevents. Nor does a weaker rule work — "one administrator may bring back somebody ranked below them" rests on the claim that an administrator already holds power over that account. *(Corrected in Increment 1.99: when this was written the only such route revoked sessions, and nothing deactivated a user or wrote `users.role`. Increments 1.78, 1.79 and 1.90 made all three false — one administrator can now change a rank, stand somebody down and end their sign-ins. Every one of those takes something away; none is **becoming** that person, which is what the rule withholds. Becoming them needs their password, and the only thing that sets another person's password is the recovery ceremony itself, which needs two administrators. The rule rests on that one premise now, and a test reads the source to keep it true.)*

So a practice with one administrator cannot do this, and the honest thing is to refuse before a ceremony exists — `approveRecoveryCeremony` has always refused the initiator, so without that check a single-administrator practice would open ceremonies nobody alive could approve. **User administration, the root cause Increment 1.75 also named, now blocks two controls rather than one.**

**A hole closed while writing the tests.** `approveRecoveryCeremony` refused the initiator and nobody else, which left a confused-deputy shape: one administrator starts a recovery against a second, the second approves believing they are helping a colleague, and the first walks away holding a link into the second's account. The pair would be the attacker and the victim rather than two independent administrators. The target may no longer approve, and it costs the honest case nothing — somebody actually locked out cannot sign in to approve anything.

- **Tests.** Unit (30): ten on the ceremony — two distinct administrators, the target refused as the second pair of hands, the refusal landing before a row exists, the secret and enrolment date and every remaining code cleared, the account's live sessions revoked with it, the sign-in that follows carrying `needsMfaEnrollment`, the old password refused, the chain naming what the act did, a token the page will accept, and a link that works once; sixteen on the reading layer — who counts as an eligible administrator and who does not, the three refusal sentences, the candidate list leaving out the viewer and anybody who has left, and an unreadable code column read as none left rather than thrown on; four on the link shape. Live (4): the count read from the practice's own rows, the one-administrator refusal writing nothing, the whole path from two administrators to a password to a row with no factor left — read off the columns rather than off the store — and an expired ceremony leaving the waiting list. Migration (3): both halves of the grant, nothing else widened, and the reason recorded in the database. Browser (2): the one-administrator practice reading the refusal with no form offered, and a recovery link that opens nothing answered in one sentence with no way around it.

**Not in Increment 1.77.** User administration, which is now the root cause behind two controls: no route writes `users.role`, so no practice this product can produce has the second administrator this one needs. The seeded practice therefore reads the refusal rather than the happy path, and the browser suite proves that rather than papering over it. Also out: any rate limit on how often a practice may start a recovery; telling the locked-out person their recovery is waiting, which needs an address this product may not hold for them; and the JWT that keeps saying "needs enrolment" after enrolment completes.


## Increment 1.78

Increments 1.75 and 1.77 both ended by naming the same root cause, and 1.77 made it urgent: its refusal tells a one-administrator practice to **appoint a second administrator**, and this product could not obey that instruction. A refusal that names an impossible remedy is worse than no refusal.

Three facts, each checked against the code before anything was built:

| | |
|---|---|
| No route writes `users.role` | a grep for a role in a `set` or `values` returns nothing outside comments |
| The only `insert(users)` hard-codes `readonly` | `lib/auth/invite.ts:133`, the outside accountant's seat |
| The store updates four things | `active`, the two second-factor columns, and the password — nothing else |

## The premise this increment started from was half wrong

It set out to put a promotion through the gate `evaluateGrant` applies, reasoning that `precogRole` maps `role === "admin"` onto "Owner / Dentist" and that a promotion therefore moves duties. **The wrong half is the half that would have shipped a check that never fires.**

`detectSodConflicts` scores duty combinations from *entitlements*. This app builds its assignments with `assignmentsFromGrants`, which reads live grant rows and deliberately infers nothing from a label — the `ROLE_TEMPLATES` path runs only when a caller passes no assignments, which this app never does. So a change of rank grants nothing and creates no conflict. A probe over the engine's own fixtures confirmed it before the code was written: every promotion returned zero new conflicts, at every severity. The engine function written for that gate was deleted rather than shipped.

What a rank **does** move is signing power. `listEligibleApprovers` reads `firstApproverRoles` and `secondApproverRoles` against the label, so promoting somebody changes which releases they may start and second with no entitlement granted. It still does not let one person be both halves: `evaluateRelease` filters the initiator out of the eligible seconds, so two distinct people are required whatever labels they carry.

So the act **reports rather than refuses**. `signingShift` names the channels a change opens and closes, the screen says so, and the chain records it.

- **`changeRank`** locks the practice, refuses, writes `users.role`, refreshes the findings and appends `role.rank_changed` carrying the four channel lists. The findings are refreshed although no conflict moves, because each stored conflict row carries the person's label: leaving them would make the SoD view name somebody by a rank they no longer hold.
- **Refusals**: an unknown rank, somebody outside the practice, a deactivated account, a change that moves nothing, **an administrator changing their own rank**, and **lowering the last administrator**.
- **Practice Risk gains "Who holds which rank"**, above the recovery panel, because appointing a second administrator is what makes that one usable. It shows the control role beside the rank, since a reader who cannot see that "administrator" becomes "Owner / Dentist" to the release rules cannot see why a promotion is a control change rather than a convenience.

## One administrator may appoint another, deliberately

Requiring two to make a third is circular: a practice with one could never reach two, and Increment 1.77's refusal would go on naming a remedy nobody can take. Appointing does not escalate the appointer either — they already hold every administrator power, and a second administrator dilutes that rather than extending it.

What one administrator appointing a confederate defeats is the two-person rule itself, by supplying both people. No software prevents a practice hiring an accomplice. What software can do is make every appointment a dated fact naming who appointed whom, on the chain, with the duty concentration it creates reported on Practice Risk. This increment does that and claims nothing more.

## A second check that never fires, kept on purpose and said so

The last-administrator refusal **cannot be reached through the route**, and the test says why rather than driving a path that produces a different refusal. The route is `minRank: "admin"`, and the self-change refusal above it means anybody lowering an administrator is a *second* administrator — so the count is never one. The invariant is held by the self-change refusal; this is the net under it, for the day something else can lower or deactivate an administrator. It is kept, unlike the SoD gate, because the state it prevents is the one state in this product that nothing inside it could repair: a practice with no administrator cannot appoint one, and every route that would fix that needs the rank nobody holds. The live case exercises it on the function, where the rule lives.

- **Tests.** Engine (5): a label that does not move moves nothing; the channels a promotion opens, each confirmed against `listEligibleApprovers` itself; a demotion's losses equalling the same promotion's gains, so a practice is told what it gives up; the caller's array left unmutated, so a change merely considered leaves the practice as it was; and a seat no release rule names moving nothing. App unit (5): who counts as an administrator, and who does not — somebody below the rank, somebody who has left, and a rank this product does not have, read as none rather than thrown on. Live (10): the seeded practice's single administrator; the five refusals; the rank written to the row with the signing shift reported and the chain event carrying it; **two administrators making the Increment 1.77 ceremony usable**; the demotion saying what was given up; and an appointment afterwards, so the refusal bounds nothing permanently. Browser (1): the owner promotes Finn Front on Practice Risk, the recovery panel's refusal becomes a form, and putting the rank back brings the refusal back.

The browser case also caught a defect in its own first draft: it matched the row by the control role beside the name, and `precogRole` falls through to "Front Desk Lead" for everybody without a grant — so it promoted the one account with no second factor, left the eligible count at one, and failed for a reason that had nothing to do with what it asserts. It matches on the person's name now, and says why.

**Not in Increment 1.78.** Inviting a *new* person at a rank: `inviteAccountant` rests on the seat being the lowest rank with one reporting grant and therefore needing no business-associate agreement, and generalising it would need that question answered for a clinical seat, which `docs/05` leaves with the owner. Also out: deactivating somebody, which the store can do (`deactivateUser`) and no route calls; reactivating; a second administrator's approval for a demotion, which would reintroduce a deadlock for no gain while the self-change refusal already prevents the unrecoverable state; and changing a person's clinical role.


## Increment 1.101

Increments 1.97 and 1.100 both came from one shape: a fact the product **records and nobody reads**. So this swept for it properly — every chain event kind the app writes, against everything that reads one.

**57 kinds written. 29 of them reached the practice's weekly record as their own identifier with the punctuation swapped.**

> auth signin pending mfa · month rehash baseline · import curve hero staged · notice address withdrawn · reason code threshold changed

`chain.otherKinds` lists every kind the digest has no named field for, and `eventLabel` falls back to `kind.replace(/[._]/g, " ")`. So the fallback was not the exception it reads as in the code — it was **most of the week**, in the one artefact the owner stamps a hash of and the month-end package folds into its own.

For a product whose discipline everywhere else is to say the thing in words — every refusal since Increment 1.48, every act's sentence since 1.90 — the weekly record spoke in identifiers.

## A dead label beside twenty-nine missing ones

`EVENT_LABEL` carried `"import.applied": "Import applied"`, and **nothing writes `import.applied`**. The app writes `import.bank_statement.applied` and `import.curve_hero.applied`.

That is how a hand-kept list drifts when nothing reads it back: one entry for an act that cannot happen, and none for twenty-nine that do.

## What it says now

Every kind the app writes has words, grouped by what they are about: getting in and getting back in; who is on the practice; the month with the accountant; money and its record; what the practice governs; reaching people.

They are written for the person reading their week, not for the person who named the kind — *"Somebody used a recovery link to get back in"*, *"A closed month was re-baselined under a new package shape"*, *"Somebody stopped a code they had not asked for"*.

## The gate

`eventLabels.test.ts` reads **the source that writes the events** — every non-test file under `apps/pms/src` except `src/e2e`, comments stripped — for `append*Event(… "kind")` and `kind: "…"` in dotted lower-case form. Then:

- **Every kind written must be covered** by a named digest field, a label, or a place the digest shows it from its own table. A new kind with no words fails by name.
- **No label may name a kind nothing writes.** A promise about a week that cannot happen fails too.

Read from the source rather than asserted about it, for the reason the nav gates and the route-guard checks are: a claim about what the code writes that does not read the code goes stale in silence. This is the third gate of that kind this session, after Increment 1.91's entitlement check and Increment 1.96's uncalled-route check.

**Red-before, measured, both halves.** A probe kind added to an unrelated module fails the first with `expected [ 'probe.new_kind_without_words' ] to deeply equal []`; restoring the dead label fails the second with `expected [ 'import.applied' ] to deeply equal []`.

## What the sweep decided not to call a defect

The other 28 kinds are covered by `EVENT_FIELDS`, which sets a named digest figure, or by `EVENT_KINDS_SHOWN_ELSEWHERE`, whose four members are genuinely shown elsewhere from their own tables. Increment 1.100 removed the one member whose elsewhere was a month away; the rest hold.

And a kind written and read nowhere is **not by itself a defect**. The chain is the record: it exists to be verified and read back, not to be summarised. What this increment fixes is narrower and truer — the digest already lists these kinds, and listed them in machine-speak.

## Not in Increment 1.101

**A named digest figure for any of the twenty-nine.** A label is words for a row that already appears; a field is a claim that the figure matters enough to have a name and to sit inside the hash. Increment 1.100 made that case for one figure and made it on its merits. Doing it for twenty-nine at once would be doing it for none of them.

**The fallback itself.** It stays. A kind can be written by a migration, or by a future increment between edits, and a digest that threw would be worse than one that says the identifier. It is no longer what most of the week looks like.

**A day-sheet charge that cannot be imported.** Recorded in Increment 1.95; it wants the question of an unknown procedure code settled first.

## Increment 1.100

Increments 1.97 and 1.98 both recorded a debt to the digest, and both described it wrongly.

They said the digest *"labels them all 'Release attested'"*. **It labels them nothing.** `control.release_attested` sat in `EVENT_KINDS_SHOWN_ELSEWHERE`, so the event-counting loop neither set a named field for it nor pushed it to `chain.otherKinds` — the week's reader saw it only inside the total on the chain line, and the `EVENT_LABEL` entry for the kind was unreachable through the only path that uses `eventLabel`.

Four places in `docs/17` said the wrong thing and now say the right one, each with the correction marked.

## "Shown elsewhere" was a promise the elsewhere did not keep

The set's own comment says these kinds are *"counted from their own tables or from the chain but shown elsewhere; not listed twice."* For a release attestation the elsewhere was the **month-end package** — which, until Increment 1.97, showed a bare count per channel, and which is in any case a month away from the week a practice is reading.

So a release that left the practice by a channel this build cannot enforce, in the week just gone, appeared in exactly one figure: the total number of events on the chain.

## What the week now says

`alerts` gains two counts:

- **`releasesAttested`** — releases recorded on a channel the ledger does not carry. `control.release_attested` moves into `EVENT_FIELDS`, which is the same mechanism `control.channel_attested` has used since Increment 1.53, and leaves `EVENT_KINDS_SHOWN_ELSEWHERE` because the set is never consulted for a kind with a field and leaving it there would read as a claim that the week hides it.
- **`releasesNeedingSecond`** — how many of them this practice's own policy asked two people for. A second query rather than a second group, because the loop above groups by kind alone and this asks about one kind's payload. It matches the package's `requiredSecond` from Increment 1.97, so the week's reader and the month's reader cannot disagree.

Neither is a count of failures, for the reason Increment 1.97 recorded: the act records one person attesting what the policy said and cannot record a second person's own act. It is what the practice still owes evidence for.

## The rule this increment had to obey

`digest.test.ts` asserts the `alerts` block's exact key list, and its comment says why: the digest states its **seven days** and nothing about where the practice stands now, because the month-end package folds the whole digest into its own hash. A standing figure here would move every closed month's hash the moment somebody attested anything, and make a given acknowledgment read as stale.

Both new keys are counts of what happened **in those seven days**. The shape guard is extended, not relaxed, and its comment now says that a standing figure is still forbidden.

## Tests

- **Unit.** The shape guard carries the two new keys and states the rule they obey; the digest and package fixtures carry them.
- **Live (1).** A payroll release is attested and the week's digest moves by one on both counts, with the kind asserted **absent** from `chain.otherKinds` — the place a reader would look for it and, before this, not find it.

**Red-before, measured.** With `digest.ts` reverted the live case fails on `expected undefined to be NaN`: the fields are not there.

## Not in Increment 1.100

**A digest schema version.** The digest has none — the package carries the version that a digest shape change rides on (Increment 1.43), and Increment 1.97 already moved it to `package-v8` for the figure this increment mirrors. A second bump for the same fact would say the package changed shape twice.

**The other kinds in `EVENT_KINDS_SHOWN_ELSEWHERE`.** `reconciliation.cleared`, `control.decision`, `statement.drafted` and `deposit.staged_applied` each genuinely are shown elsewhere in the digest, from their own tables. Only the release attestation's elsewhere was a month away.

**A day-sheet charge that cannot be imported.** Recorded in Increment 1.95; it wants the question of an unknown procedure code settled first.

## Increment 1.99

Every increment since 1.88 has carried the same line in its *Not in* paragraph: **the stale comment in `regainAccess.ts`** — "nothing writes `users.role`", which Increment 1.78 made false — *recorded, still not this increment's subject.* Eleven increments. This is its subject.

And reading it properly showed it was never only a comment.

## It is the argument for a security rule, and two of its three premises had lapsed

`regainAccess.ts` explains why the two-administrator recovery ceremony gets **no governed exception**, where Increment 1.75's GL-mapping control got one. The paragraph then answers the obvious weaker rule — *"one administrator may bring back somebody who ranks below them"* — by arguing that an administrator does **not** already hold power over that account, and resting that on three facts:

| Claim | Then | Now |
|---|---|---|
| "nothing deactivates a user" | true | **false** — Increment 1.79 built `setPersonActive`, with a screen |
| "nothing sets another person's password" | true | **true**, and verified here |
| "nothing writes `users.role`" | true | **false** — Increment 1.78 built rank administration |

An argument for a security rule resting on lapsed facts is worse than an inconvenient rule: it invites the next reader to check the premises, find two of them false, and conclude the rule is unfounded.

## The conclusion stands, and is better supported than it was

One administrator, alone, **can** now end another person's sign-ins (Increment 1.90), stand them down and take their grants with them (Increment 1.79), and change their rank (Increment 1.78).

Every one of those acts **takes something away**. None of them is *becoming* that person — posting as them, approving as them, being both halves of every maker-checker rule this product has. That is the power the rule withholds, and it is untouched by any of the three.

Becoming them needs their password. **The only thing in this codebase that sets another person's password is the recovery ceremony itself**, which needs two administrators. `claimSeat` writes a password too, and it is the claimant setting their own from a link only they hold.

So the rule now rests on one premise instead of three, and that premise is the one still true.

## A test keeps it true

`regainAccess.test.ts` reads every `.ts`/`.tsx` file under `apps/pms/src`, excluding tests, for callers of `.setPassword(` — and asserts the list is exactly `["lib/auth/recoveryCeremony.ts"]`. A second caller anywhere makes the whole argument false, so the test fails by path and name rather than letting a comment quietly stop being true again.

A second case names `claimSeat`'s direct write of `password_hash`, so the omission from the first list reads as known rather than missed.

**Red-before, measured.** With one probe call to `store.setPassword` added to an unrelated module, the test fails: *expected `['lib/auth/endSessions.ts', …(1)]` to deeply equal `['lib/auth/recoveryCeremony.ts']`*.

## The same argument in docs/17

Increment 1.77's record repeats the three-premise version. It is corrected in place, with the correction marked, rather than rewritten as though it had always said the true thing.

The *Not in* lines in Increments 1.88 through 1.98 are left exactly as they were. Each was true when written, and a record of what an increment deliberately left undone is worth more intact than tidied.

## Not in Increment 1.99

**Any change to the rule itself.** The ceremony still needs two administrators, still offers no exception, and still says so in the words Increment 1.48 fixed for every refusal in this product. This increment changes what the codebase *says about why*, and nothing about what it does.

**The digest, which shows a release attestation nowhere by name.** Recorded in Increments 1.97 and 1.98, still the smaller separate edit. *(Corrected in Increment 1.100: those records called it a flat label, and there was no label.)*

**A day-sheet charge that cannot be imported.** Recorded in Increment 1.95; it wants the question of an unknown procedure code settled first.

## Increment 1.98

`POST /api/controls/release/evaluate` has had no screen since it was built. Increment 1.96's sweep put it on the uncalled list with the reason that it wanted a surface of its own; Increment 1.97 made the figure it records readable in the month-end package and restated the debt. This is the surface.

**Its arrival takes the route off that list, and the check verifies it.** `check-route-guards.mjs` fails on an allowlisted path something has since started calling, so the loop closes itself rather than leaving a stale claim behind: the run now reports *"1 route nothing calls"* where it reported two.

## Its own screen, at its own rank

The route opens at **`lead`**. Practice Risk needs `manager`, so a panel there would be a screen the people this act is for could not reach — **Increment 1.93's lesson read backwards**. `/releases` has a header link of its own at `lead`, gated on the route file, which `seats.test.ts` reads back.

In the seeded practice that means the owner is offered it and the front desk is not, which the nav test now pins.

## What the screen records, and what it says it cannot

One person attests that a release happened and what the practice's policy asked for. It does **not** record that a second person signed, because `attestChannelRelease` accepts no second signer — deliberately, as Increment 1.97 found and recorded.

So the answer says so, rather than leaving the reader to assume the opposite:

> Recorded, and the policy required a second pair of hands. This product cannot hold that signature — keep it where the channel does, on the payroll file or the bank's own authorisation log. 2 people here may second it.

And, beneath it, how the month-end package will read the channel:

> This channel is attested, never enforced: the product does not hold its data, so nothing here checks that the release matched what was authorised.

A practice where **nobody** may second gets that said plainly too, because a policy requiring a second pair of hands that no role can supply is worth the owner's attention on its own.

## A correction to Increment 1.97's record

Increment 1.97 wrote that **payroll is the only external channel this practice can attest**. That is **false**.

`ENFORCEMENT` marks two channels `external` — `payroll` and `vendor_new` — and both attest. Probed against a live seeded database: `vendor_new` at $10 and at $5,000 both record, both with `dualRequired: true` and a threshold of zero, and the owner's own evaluation returns `blocked_role` on either. What is *not* attestable is `wire` and `vendor`, which are not release channels at all and refuse `unknown_channel`, and `deposit`, which the ledger enforces and which refuses `ledger_channel`.

Nothing 1.97 built is wrong — the figure, the schema bump and the live assertions all stand, and the live case never asserted the "only". The prose did, and `docs/05`, `docs/17` and the comment in `package.live.test.ts` now say the true thing with the correction marked.

**A test makes the claim unrepeatable.** The screen's channel list is pinned to `ENFORCEMENT` rather than restated: `EXTERNAL_RELEASE_CHANNELS` must equal exactly the channels marked `external`. A channel promoted to enforced has to leave this screen in the same change, or the screen would offer an act `attestChannelRelease` refuses as a ledger channel — an act that could only fail, which is the shape Increments 1.88, 1.89 and 1.93 exist to remove.

## Tests

- **Unit (8).** The channel list equals `ENFORCEMENT`'s external set and every channel has a label; the recorded sentence's below-threshold, above-threshold, nobody-may-second and one-person cases; and both enforcement sentences.
- **Browser (1).** The owner opens `/releases`, cannot press the act without an amount, records an $18,000 payroll file, and reads that the policy required a second and that this product cannot hold that signature. The chain carries `control.release_attested` with `dualRequired` true, and the month-end package then shows *"payroll attested (external channel) · 1 needed a second pair of hands"* — Increment 1.97's figure, reached for the first time by pressing a button rather than by calling a function.

## Not in Increment 1.98

**Recording the second person's act.** Unchanged from Increment 1.97: it needs the second person's own sign-in and their own press, which is the shape of the recovery ceremony rather than of an attestation.

**A list of what has been attested.** The screen records and says what the policy asked; the month-end package is where the month's attestations are read, and the digest counts the week's. A third list would be a third place to disagree.

**The digest.** It shows a release attestation nowhere by name. Recorded in Increment 1.97 and still the smaller, separate edit. *(Corrected in Increment 1.100: "flat label" described a label the digest never applied.)*

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.97

`attestChannelRelease` has recorded `dualRequired` on every per-release attestation since Increment 1.12. **Nothing read it.**

The month-end package counted attested releases per channel — `{ channel, count }` — so a release the policy said needed two people and one it did not read exactly alike. The digest showed them nowhere by name. *(Corrected in Increment 1.100: this first read "The digest labels them all \"Release attested\"", which is false — `control.release_attested` sat in `EVENT_KINDS_SHOWN_ELSEWHERE`, so it was counted only inside the chain total and never labelled. The `EVENT_LABEL` entry for it was unreachable.)* An accountant reading the month saw a number and no way to tell which of it the practice still owed evidence for.

## What it is, and what it is not

`attestations` now carries `requiredSecond` beside `count`, and the CPA screen says so on the row: *"payroll attested (external channel) · 1 needed a second pair of hands"*.

**It is not a count of releases that failed to get a second.** The act records **one person attesting what the policy said**, and it cannot record a second person's own act. That is a decision this codebase made on purpose, and states in the doc comment above `attestChannelRelease`: *"no second signer is accepted from the request, so this path can never produce an approved_dual verdict."* One person asserting two people's participation is a weaker record than no record at all, and this product does not make it — the GL mapping maker-checker, the recovery ceremony and the correction approval all insist on two distinct acts by two people.

So `requiredSecond` is **what the practice still owes evidence for**, not what it did wrong. The evidence lives where the channel does: a payroll file's own signatures, a bank's dual-authorisation log.

**I went looking to "fix" this the other way first** — `ReleaseRequest` on the engine carries `secondPersonId`, `evaluateRelease` resolves it and refuses `blocked_same_person`, and the app wrapper simply never passes it. It reads like an oversight. It is not: the comment above the wrapper says why, and the increment that would have "fixed" it would have quietly weakened the record. Reading the comment before changing the code is the whole of the difference.

## What the seeded practice shows, and what it cannot

In the seed the two figures **coincide**, and the live case says so rather than hiding it.

There are **two** channels this practice can attest — `payroll` and `vendor_new`, the two `ENFORCEMENT` marks `external`. `wire` and `vendor` are not release channels at all and refuse `unknown_channel`, and `deposit` is a ledger channel that refuses `ledger_channel` because its evidence comes from the posting path. And **both seeded thresholds are zero**, so every release on either requires a second whatever it is worth.

*(Corrected in Increment 1.98. This first read "payroll is the only external channel this practice can attest", which is false: `vendor_new` is external too and attests. Verified by probing a live seeded database, which also showed both thresholds at zero and the owner's own evaluation returning `blocked_role`.)*

The figure separates them in a practice that sets a threshold. Here it reports the sharper fact: *all* of them need one, and the product can record none of them.

## The package schema version

`PACKAGE_SCHEMA_VERSION` moves **`package-v7` → `package-v8`**. How many of a channel's attested releases the policy required a second for is a figure about the month, so it belongs inside the hash — the same reasoning that moved v6 to v7 in Increment 1.75. A month closed under v7 reports *"the package changed shape"* rather than *"a figure moved"*, which is the fallback Increment 1.43 built for exactly this.

## Tests

- **Unit.** The package fixture carries the new field, and the schema version is pinned to `package-v8`.
- **Live (1).** Two payroll releases are attested, the package reports `count: 2, requiredSecond: 2`, the threshold is asserted to be zero so a reader knows why they are equal, and both refusals — the ledger channel and the channel the policy does not name — are driven.

**Red-before, measured.** With `package.ts` reverted, the live case fails on `expected undefined to be 2`: the field is not there.

## Not in Increment 1.97

**A screen for the act.** Increment 1.96 put `POST /api/controls/release/evaluate` on the uncalled list with the reason that it wants a surface of its own, and that is still true. Note the rank when it comes: the route opens at `lead` and Practice Risk needs `manager`, so a panel there would be a screen a lead could not reach — the Increment 1.93 lesson read backwards.

**Recording the second person's act.** It would need the second person's own sign-in and their own press, which is the shape of the recovery ceremony rather than of an attestation. Worth building; not worth faking.

**The digest.** It shows them nowhere by name. The package is where an accountant reads the month, so that is where the figure went first; the digest is a smaller, separate edit. *(Corrected in Increment 1.100: this first said the digest "still labels every one", which it never did.)*

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.96

Three increments in a row found the same defect, and each found it the same way.

- **Increment 1.90:** the tenant-wide session revoke had existed since Increment 0.8, and no screen called it.
- **Increment 1.94:** the Curve Hero import had no screen since Increment 1.3 — and giving it one showed that applying had *never worked at all*, because the append role held a grant on none of the tables the apply read.
- **Migration 0055**, from Increment 1.77, had already written the lesson down for the recovery ceremony: **"nothing caught it because nothing called it."**

Increment 1.94 ran the sweep by hand. This makes it a gate.

## A route nothing calls must say why

`scripts/check-route-guards.mjs` already fails a route exported without `withGuard`, and since Increment 1.91 a guard naming an entitlement the rulebook does not carry. It now also fails **a route whose path appears nowhere else in the app's own source**, unless that route is named in an `UNCALLED` allowlist with a written reason — the same device the two transport exemptions at the top of the file already are. An entry is a claim, and a route that leaves the list takes its claim with it: the check fails on an allowlisted path that something has since started calling, and on an entry naming a route this app does not have.

## The first draft of this check was worthless, and said so

It passed. It should not have.

Removing the import screen — reproducing exactly the state Increment 1.94 found — left the check green, because Increments 1.94 and 1.95 had written those very paths into **doc comments** explaining that nothing called them. **A gate that prose can satisfy is not a gate.**

Two exclusions fix it, and both are the check rather than tidiness:

- **Comments are stripped before the search.** A path named in a comment is prose.
- **Test files and `src/e2e` are left out.** A route only a test calls is precisely the defect: the recovery ceremony, the tenant-wide revoke and the Curve Hero import each had tests and no screen, and each was broken in a way only a real caller could show.

**Measured.** With the import screen moved aside, the tightened check names `/api/import/curve` and `/api/import/curve/apply` by path — it would have caught Increment 1.94's defect on the day the routes were written. With the allowlist emptied, it names the two routes below.

## The two routes on the list, and what the sweep found in one of them

**`GET /api/controls/policy`** answers with the practice's control policy — the dual-release thresholds among it — and stood at **`user` rank**, while `GET /api/controls/risk`, which puts the same material on a screen, has always needed **`manager`**.

The figure a control enforces is exactly what somebody structuring payments beneath it would want, and where one thing has two doors, the looser one decides. It is `manager` now. A unit test reads both route files and pins them together, rather than asserting about a guard it does not read — the same discipline the nav gates follow, for the same reason: a claim that does not read the thing goes stale in silence.

**`POST /api/controls/release/evaluate`** attests a release on a channel the ledger does not carry — a deposit bag, a new vendor, a payroll file — and answers whether a second person is needed and who may second. It is a real capability with no screen, exercised by live cases and by nothing a person can reach. Its allowlist entry says so, which is the point: recorded rather than hidden, and a surface of its own is worth an increment.

## Not in Increment 1.96

**A screen for the release attestation.** Naming it on the list is not the same as building it, and this increment deliberately does the naming: three increments spent finding routes with no screens have earned a gate before they earn another screen.

**Deleting `/api/controls/policy`.** Nothing calls it, and Increment 1.77 deleted a route whose purpose had moved, so the precedent exists. But a route that might have a caller outside this repository is safer tightened than removed, and tightening is the control-correct move in any case.

**A check on which route a button calls.** Increment 1.93 recorded why: it needs to know which press reaches which path, and the honest way to hold that is a browser case, not a script guessing from source.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.95

Increment 1.94 found that applying a Curve Hero import had never worked, granted the append role the two staging tables it needed, and stopped — because the next thing the apply reads is `patients` and `account_members`, and letting the role that writes the chain read patient records is a decision about who may read a patient. It recommended the split rather than the grant. This is the split.

## What moved

`applyCurveHeroImport` was one function doing both halves on one connection, and the route ran it inside `withTenantAppendTransaction`. It is now two:

- **`planCurveHeroImport`** reads. It loads the validated runs and their staged rows, resolves each row to an account, a patient and a location, counts what the import has no use for, and collects the rows it could not resolve as errors. It writes nothing.
- **`writeCurveHeroImport`** writes. It posts what the plan resolved, stamps each run `applied`, and appends one chain event per run. **It looks nothing up.** The tables it touches are the ledger, `import_runs` and `domain_event` — exactly what the append role is granted.

`applyCurveHeroImport` survives as the two called in order on one connection, for the `apply-cli` and the tests that drive the whole path. **The route does not use it**: it plans in a `withTenantTransaction` and writes in a `withTenantAppendTransaction`, which is the point of the increment.

The eligibility check moved with it. `hasValidatedCurveImportRun` is a read, so it runs as `app_rw` now rather than as the role that cannot read the table it selects from.

## One thing the split made necessary

The two halves are separate transactions, so a second apply can arrive between them. The idempotency key on each entry already refuses to post a row twice; what was missing was the stamp. `writeCurveHeroImport` now stamps a run `applied` **only while it is still `validated`**, and appends its event only if that stamp took. A run somebody else applied in between is skipped rather than counted twice.

## What the browser case proves, and what it cannot

The case drives the whole path through the real route on the real roles: check a file, read *"Read 1 row, none of them refused"*, press **Post it to the ledger**, read *"Posted 1 entry"*, and then find `import.curve_hero.staged` **and** `import.curve_hero.applied` on the chain with the run stamped `applied`.

Writing it ran into two rules of this ledger, both of which shaped the file it imports:

**A day-sheet charge cannot post at all.** `ledger_entries_charge_requires_procedure` demands a procedure row, and a Curve Hero day sheet carries a procedure *code in its description* and no procedure. The three-row fixture this case started with — two charges and a payment — posted nothing. That is a real gap in the import, named in *Not in* below rather than papered over.

**A payment may not allocate more than the account owes** (`allocation_exceeds_charge`). The case first carried a constant figure, passed alone, and failed inside its own suite, because every case above it has already moved those balances. It reads the largest outstanding account out of the ledger now and pays no more than it owes. A case that passes alone and fails in its suite is worth recording: the isolation that makes a case easy to write is the thing that hides what the suite does to it.

## Not in Increment 1.95

**Posting a day-sheet charge.** The import would have to resolve or create a procedure from a code in a description. That is a feature of the import, not of its transaction shape, and it wants its own increment — with the question of what this product does with a code it has never seen settled first.

**Granting the append role the patient tables.** Still not done, and now not needed: nothing the append role runs reads them.

**The other two unreferenced routes** from Increment 1.94's sweep, `/api/controls/policy` and `/api/controls/release/evaluate`.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.94

A sweep of every route under `src/app/api` against the rest of the app's source found **four whose path appears nowhere else**: `/api/controls/policy`, `/api/controls/release/evaluate`, and the pair this increment is about — `POST /api/import/curve` and `POST /api/import/curve/apply`.

The Curve Hero import is how a practice's own day sheets reach this ledger. It has existed since Increment 1.3 and **no screen ever called it**. The bank statement import has one — `/reconciliation` posts to it — and this did not.

## A correction to Increment 1.91's record

Increment 1.91 wrote that a practice which could not grant `run_import` could import nothing, and called that *"the two screens that bring outside evidence in were dead."* **The bank statement screen exists.** What was dead was one screen and one pair of routes with no screen at all. The finding about `run_import` stands unchanged; the sentence describing its reach was wrong, and this says so rather than leaving it to be read.

## Building the screen found a second defect

Checking a file works. **Applying one never has.**

`POST /api/import/curve/apply` runs inside `withTenantAppendTransaction`, so everything it touches it touches as `app_append`. It reads, in order:

| Table | Grant to `app_append` before this increment |
|---|---|
| `import_runs` | none — `permission denied` (SQLSTATE 42501) |
| `import_staged_rows` | none |
| `patients`, `account_members` | none |

Migration 0015 granted the two import tables to `app_rw` alone. `withGuard` carries no try/catch, so the failure reached the caller as a bare 500 with no `error` field — which is exactly what the new screen showed, and how this was found.

**This is the third time this codebase has met the same species of defect.** Migration 0055 recorded it for `auth_lookup_recovery_ceremony` (Increment 1.77): the routes had no caller anywhere in the app, and the unit tests run against the memory store, which has no grants to get wrong. Increment 1.90 found the same shape on the tenant-wide session revoke. **A route with no screen is a route nobody has run.**

## What this increment fixes, and what it deliberately does not

**Migration 0056** grants `app_append` SELECT and UPDATE on `import_runs` and SELECT on `import_staged_rows`. UPDATE on the run and not on the rows, because applying stamps the run `applied` with the moment it completed and leaves the staged rows as they were. The isolation policies on both tables name no role — they compare `tenant_id` to `app.tenant_id` — so a GRANT is all that is needed, exactly as migration 0029 did when the posting path had to read `month_closes`.

**The patient tables are left alone, on purpose.** Resolving a day-sheet row to an account reads `patients` and `account_members`. Granting the append role SELECT on those would let the role that exists to write chain rows read patient records, in a product whose thesis is a narrow, auditable role model under FORCE RLS everywhere. That is a decision about who may read a patient, and it is not one to settle on the way past a screen.

**Two ways out, and which I would take.** Widen the append role by grant, or split `applyCurveHeroImport` into a resolution that runs as `app_rw` and a write that runs as `app_append`, passing the resolved ids across. **The split is the better answer**: it keeps the append role exactly as narrow as it was designed to be, and resolution is a read that has no business inside the transaction that writes the chain. It is a change to the import kernel with its own tests, and it belongs in its own increment rather than as a tail on this one.

## So the screen offers no act it cannot finish

There is no *Post it to the ledger* button. After a successful check the screen says:

> Posting an import to the ledger is not built yet. The act reads patient records under a database role that holds no grant on them, and widening that role is a decision about who may read a patient — not a thing to settle on the way past. The check above is recorded either way.

Offering the press would have been offering an act that can only fail, which is the one shape Increments 1.88, 1.89 and 1.93 exist to remove. Shipping it would have been the same mistake three increments in a row have been spent undoing.

## The screen, and the link that reaches it

`/import` sits behind `{ entitlement: "run_import" }` in `NAV_LINKS`, gated on `api/import/curve/route.ts` — which `seats.test.ts` reads back and checks. That link is possible **because of Increment 1.91**: before the duty was in the rulebook there was nothing to hang a link on, and the seeded owner and front desk both hold it, so the header offers them both the screen.

**The page imports nothing from `@pms/import`.** Its entry point reaches `node:crypto` through the bank-statement validator, and webpack refuses that in a client component — which is how this was caught rather than shipped. The report kinds are declared app-side, as Increment 1.85 declared the demo dates rather than importing `@pms/db/seed-data`, and a unit test pins the two lists to each other because it runs in node and can import the package.

## Tests

- **Unit (6).** The app-side kind list equals the package's exactly; every kind has a label; the check sentence's singular and plural and its refusal wording; and the applied sentence, which stays and stays tested because the next increment posts.
- **Database (3).** Migration 0056 grants exactly what applying needs and nothing more — no INSERT, no DELETE, no `TO PUBLIC`, no policy touched, no other role named — and says in its own text why nothing had caught it.
- **Browser (1).** The owner opens `/import`, cannot press Check on nothing, pastes a three-row day sheet, and reads *"Read 3 rows, none of them refused."* No post button exists, the sentence explaining that is on the screen, and the chain carries `import.curve_hero.staged` and nothing else.

## Not in Increment 1.94

**The other two unreferenced routes**, `/api/controls/policy` and `/api/controls/release/evaluate`. Each is either a capability with no screen or a surface something outside the app uses, and each deserves reading before it is judged.

**Listing import runs.** No route does, so a reload loses the staged run from the screen; the check itself survives on the chain. A list is worth building when there is an act to offer on a listed run.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.93

`NAV_LINKS` offers `/day-close` and `/statements` at **`user` rank**. Every act on both opens on a **duty**:

| Act | Route | What it needs |
|---|---|---|
| Create draft | `POST /api/statements` | `post_payments` |
| Apply staged deposits | `POST /api/deposits/apply-staged` | `post_payments` |
| Freeze day close | `POST /api/day-close/freeze` | `bank_reconcile` |

Neither screen read the viewer's duties. All three buttons rendered for anybody who could open the screen, and for anybody without the duty each one could only refuse.

## The seeded practice carries both halves of it

**Riley Owner is an administrator who does not hold `post_payments`.** The seed gives the owner `approve_writeoffs`, `run_import` and `bank_reconcile`. So the practice owner — the highest rank this product has — was offered *Create draft* on Statements and *Apply staged deposits* on Day close, and both refused every time.

**Finn Front holds `post_payments` and not `bank_reconcile`**, so the front desk met the mirror: *Freeze day close* could only refuse.

A rank is not a duty, and this product has always said so at the routes. The screens had not caught up.

## Why the check that exists did not catch it

`seats.test.ts` reads each nav link's declared `gate` file and asserts the link and the route still agree — the comment beside `NAV_LINKS` says exactly that, and it is a good check. But a `gate` names **the route that serves the screen's read**: `api/statements/route.ts` for Statements, `api/day-close/route.ts` for Day close. Both open at `user` rank, so both links agree with their gates and always did.

The write half is on the same route file or a different one, and nothing compared it to anything. The check was answering a narrower question than its name suggests, which is worth recording: a screen can agree with its gate and still invite an act it cannot do.

## What it does now

One helper, `lib/auth/heldDuty.ts`, over the entitlements `readViewer` already returns:

- `holdsDuty(viewer, entitlement)` — true only for a `present` viewer holding it. An `ended` or `unknown` viewer holds nothing, which is the safe way round: the act is not offered, and the route would refuse it anyway.
- `dutyLabel(entitlement)` — the catalog's own words for the duty, falling back to the id rather than inventing a name.
- `dutyNeededSentence(act, entitlement)` — *"Creating a statement needs the “Post payments in PMS” duty, which you do not hold. An administrator grants it on Practice Risk."*

The sentence names the duty rather than the entitlement id, and says who grants it **and where**, because the person reading it cannot grant it to themselves and the next thing they need is whom to ask.

Both screens read `/api/me` as Practice Risk does, and render each act only for a holder, with the sentence in its place otherwise. **The screen is the courtesy and the route is the control**: every one of these routes still refuses a request that reaches it, exactly as before.

## Saying it before the press

This is Increment 1.90's reasoning applied to three more acts. The refusal is the same sentence either way; it is worth more arriving before the press than after it. And an act offered where it can only refuse is the shape Increments 1.88 and 1.89 named on the owner board — found there on an alarm, found here on two ordinary screens.

## Tests

- **Unit (6).** Holding and not holding; that rank is not read as a duty, pinned on the seeded owner's exact grant list; that an ended or unknown viewer holds nothing; the two duty labels the screens use; the fallback for an id the catalog does not carry; and that the sentence names the act, the duty and who grants it.
- **Browser (1).** The whole matrix in one case: as the owner, *Apply staged deposits* is absent and *Freeze day close* is present on Day close, and *Create draft* is absent on Statements, each with its sentence; then as the front desk, the mirror on Day close.

**A first draft of that case failed on its own timing.** It waited for the screen's heading, which renders before the screen is ready and before `/api/me` has answered, then counted buttons — and read zero of a button that was about to be there. Each wait is on the sentence now, which appears only once the viewer has been read, with the reason in a comment.

**Red-before, measured.** With both pages reverted and rebuilt, the case fails on the first wait: the sentence never appears.

## Not in Increment 1.93

**A check that compares a screen's acts to its routes' guards.** Increment 1.91 added one for a guard naming a duty that does not exist, which is a textual question. This one is not: it needs to know which button calls which route, and the honest way to hold it is the browser case above rather than a script that guesses from source.

**The other screens.** `/ledger` is offered at `user` rank and renders no act. The manager-rank screens gate their acts on rank, which they already read. This increment is the two screens where a rank opens the screen and a duty opens the act.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.92

A seat whose invitation link was reissued, and whose holder then opened the link that replaced it, is listed as **"Invited, not yet opened" forever**. The one act the practice is offered on that row refuses every time it is pressed.

## Why, exactly

`unclaimedInvitations` asked its question of the **invitation row**:

```
.leftJoin(seatInvitationClaims, eq(seatInvitationClaims.invitationId, seatInvitations.id))
.where(and(eq(seatInvitations.tenantId, tenantId), isNull(seatInvitationClaims.id), …))
```

A reissued seat has two invitation rows: the superseded one and the one in force (Increment 1.73). The accountant can open only the one in force, because `lookUpInvite` refuses a superseded link — which is the whole point of reissuing. So claiming attaches a claim to the newer row and leaves the older one unclaimed, permanently.

The SQL then filters out the claimed row and keeps the unclaimed one. The dedupe by seat that follows, which exists to show one link per seat rather than three, has only that row to pick. The practice reads that somebody who has set a password has not opened their seat.

**And the row carries a button that can only refuse.** `reinviteSeat` reads `newestInvitation` — the invitation *in force*, the claimed one — and returns 409 `claimed`: *"has already opened this seat and set a password. Somebody who cannot sign in needs their password recovered, not a new invitation."* Correct in itself, and unreachable as advice, because it arrives only after a press on a row that should not be there.

This is the shape Increment 1.89 named on the owner board: an act offered where it can only refuse.

## The fix

The claim belongs to the **seat**, not to the invitation. The read now excludes a person who has claimed *any* of their invitations, with a `notExists` over an alias of `seat_invitations` joined to the claims — `seat_invitation_claims` carries `invitation_id` and no `user_id`, so the join is how the question reaches the person.

The exclusion is permanent, and it is right that it is: `reinviteSeat` refuses once the in-force invitation is claimed, so no later invitation can follow a claim. A seat that has been opened is opened for good.

Nothing else changes. A genuinely unclaimed seat reissued three times still appears once, as the newest row, which the case from Increment 1.73 still pins.

## Where the test was, and why it passed

Two tests were within one line of this and neither reached it.

The live case **"refuses to reissue for a seat that has already been opened"** invites once, claims, and reinvites. One invitation row, one claim, no superseded row — the defect needs a reissue before the claim.

The browser case **"sends another link to a seat whose first one went astray, and the old link then opens nothing"** builds the exact state: it invites `firm-mislaid`, reissues, proves the stale link opens nothing, and opens the seat on the fresh one. Then it stops. The panel that had just been telling the truth was never read again.

Both now go one step further:

- **Live (1).** Invite, reissue, assert the seat is listed once while nobody has opened either link, claim the link in force, assert the seat is gone, and assert that the act the row used to offer refuses. Red-before, measured: without the fix the seat is still listed after the claim.
- **Browser (extended).** After `firm-mislaid` sets a password, sign back in as the owner and assert the invite panel carries no row for that seat.

## Not in Increment 1.92

**A record of who opened which link.** The claim names the invitation it was made against, which is enough for this list and for the refusal; a practice asking *which of three links was used* has a question this product has not been asked.

**Telling the practice that a seat was opened.** The row leaves the list, which is the product's usual way of saying a thing is done; a positive notice is a different feature with a different reader.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.91

Three routes have been guarded by a duty the control rulebook does not carry, for the whole life of this product.

`POST /api/import/bank-statement`, `POST /api/import/curve` and `POST /api/import/curve/apply` each declare `{ entitlements: ["run_import"] }`. `run_import` is not a member of `EntitlementId` and has no row in `ENTITLEMENTS`, which is what `isEntitlementId` tests. Four consequences follow, and each one was live:

- **The practice could not grant it.** `grantEntitlement` refuses an unknown entitlement 400 before it does anything else. So no administrator, on any screen, could give anybody the duty that opens the import routes.
- **The practice could revoke it.** `revokeEntitlement` never asks whether the string it was handed is a duty — it matches live rows and stamps `effective_to`. A one-way door, of the shape Increment 1.76 closed for the authenticator: the practice could end an import grant and never make another.
- **Nobody could be given it in the first place.** The only writer was `pnpm db:seed`, inserting the row directly. In a practice this product set up rather than seeded, **nobody could import a bank statement or a Curve Hero file at all**. *(Corrected in Increment 1.94: this first read "the two screens that bring outside evidence in were dead". The bank statement screen exists; the Curve Hero import had no screen at all.)*
- **The rulebook scored nobody who held it.** `assignmentsFromGrants` puts a grant naming an unknown duty into `unknownEntitlements` and leaves it out of the assignment, so the duty-family matrix had no row for it and no person's combination could include it.

## The screen was already saying so

Practice Risk renders, under the duty combinations: *"N grant row(s) name a duty outside the rulebook and are listed, not scored."* In the seeded practice N was **2** — the owner's `run_import` and the front desk's — and the browser suite has asserted that figure since Increment 1.17.

So a test has been pinning, all along, the product's own statement that it enforces a duty it cannot score. The suite now asserts that the notice does not render, which is the same fact read the other way round.

## What the duty is

`run_import` joins the catalog as **recording** — importing writes somebody else's record into this practice's books — at **risk weight 4**. Four rather than five is deliberate: `CRITICAL_DUTIES` is the weight-5 set that the sole-holder detector and the new-device alarm read, and a duty that stages a file for somebody else to post is not the custody of cash. Nothing in those detectors moves.

## What the practice sees that it did not

The duty-family matrix gains a row and a column, so the seeded owner — who holds `run_import`, `bank_reconcile` and `approve_writeoffs` — now carries **two open combinations**: recording beside reconciliation, and recording beside authorization. The person who imports the bank statement also reconciles against it, and also approves the write-offs. Both were true from the first day and neither was scored.

The browser suite's figures move with it, and the case that used to end at zero open conflicts now ends at two and names them. Segregation health for that practice reads 93 of 100 rather than 100.

## The check that would have caught this on day one

`scripts/check-route-guards.mjs` already fails a route exported without `withGuard`. It now also fails a guard naming an entitlement the rulebook does not carry — reading the catalog out of `conflict-rules.ts` as text, since the script is plain node, and resolving an `orEntitlement` written as a constant by finding its `export const NAME = "..."` under `src/lib`. A guard naming a duty nothing can confer is a route only the seed can open, and that is the shape the check refuses.

Reverted against the catalog addition, the check fails and names all three import routes by path.

## The rulebook version

`CONTROL_RULEBOOK_VERSION` moves **0.2.0 → 0.3.0**. The version file's own instruction is to bump when SoD pairs change, and the golden fixtures say the same: *"Regenerate only with a deliberate scoring or rulebook change, alongside a version bump."* Adding a duty to the catalog adds a row and a column to every pair scan, so it is one.

Three golden hashes moved, each traced rather than accepted:

| Hash | Why it moved |
|---|---|
| `buildPracticeState` | the duty matrix gained a row and a column |
| `evaluateGrant` | its result carries the state it evaluated against |
| `takeControlSnapshot` | a snapshot stamps the rulebook version, now 0.3.0 |

`channelCoverage` did not move, and of the ten hashes in the ridgeview golden only `detectSodConflicts` did. One app assertion pinned `"0.2.0"` and now pins `"0.3.0"`.

## Not in Increment 1.91

**A named conflict rule pairing import with reconciliation.** The duty-family matrix already registers that pair, at family severity, which is why the owner's combination shows up at all. Raising it to a named `critical` rule would change the residual score and would make `grantEntitlement` refuse the grant without a control decision — a calibration decision, and `version.ts` says in its own words that the weights are directional until a CPA calibrates them. The pair is visible and scored; what it is worth is a separate question with a separate bump.

**The import screens themselves.** This increment makes the duty grantable; it does not change who is offered `/reconciliation` or what the import forms do.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.90

`POST /api/admin/revoke-all-sessions` has existed since **Increment 0.8**. Nothing ever called it.

The search is short: across the repository the only references were the route file itself and three doc comments naming it as something the product has. No screen, no test that drove it through a browser, no link. An incident-response act — the one a practice reaches for in the hour somebody says a phone has gone astray — was reachable only by somebody who could write HTTP by hand, which is not the person who notices.

## Two defects, not one

**The act had no screen.** That is the visible one.

**The reason was a constant.** The route wrote `reason: "admin_revoke_all"` into the chain event, which records that the act happened and nothing about why. Every such event in every practice would read the same. This is the act whose reason is most worth keeping, because the moment it is pressed is the moment somebody will later ask what was known and when — and a constant answers neither.

The route now reads a typed reason and validates it: at least ten characters, at most two hundred. The floor is the same one a hard-event acknowledgement uses — enough to be a sentence rather than a keystroke. The ceiling says where the rest belongs: the detail goes wherever this practice keeps its incident notes, not into a chain payload.

## Why a typed sentence and not "are you sure"

The panel does not ask for confirmation. It asks for a reason, and the button stays disabled until there is one.

A dialogue is dismissed by the same reflex that opened it, and it leaves nothing behind. A sentence somebody has to compose slows the press by the length of a thought, and the thought is the part worth keeping — it is on the chain afterwards, which a dialogue's "OK" never is. One guard, doing both jobs.

## The half that makes this act different from Increment 1.88's

Increment 1.88 gave the owner board the proportionate act: end the sessions of one named person, and refuse when that person is the reader, because ending your own sessions is a sign-out.

This act ends **everybody's**, and the administrator pressing it is inside "everybody".

That is not a consequence to be discovered. The panel says it before the press ("including your own", in the paragraph above the field), the answer repeats it after ("Ended 4 sign-ins across the practice — including your own"), and the screen then **reloads nothing**. Every later read from that screen would meet a session that no longer exists; the Increment 1.81 and 1.83 work would render it correctly as "your sign-in has ended", and the administrator would read the act's success as a fault. So the panel settles into a done state carrying the sentence and one link back to the sign-in screen.

## What the tests cover

- **Unit (8).** The reason floor and ceiling, each at its boundary; whitespace trimmed before either is measured; the sentence's singular and plural; the nobody-was-signed-in case, which says nothing changed rather than reporting zero; and the chain event carrying the typed reason and the count rather than a constant.
- **Browser (1).** Signed in as the owner on Practice Risk: the button refuses while the field is empty, accepts a reason, and the page then says "including your own" and offers "Sign in again". Afterwards the database holds **no** live session for the tenant, and the chain holds one `auth.sessions_revoked_all` whose `payload->>'reason'` is the sentence that was typed — which is the assertion that would have passed against the old hardcoded constant only by coincidence, and does not.

**The placement trap, walked into a second time.** The case first went at the end of the suite, after the case that pairs a new authenticator for the owner — which leaves `DEV_MFA_SECRET` no longer that account's secret, so any later `b.signIn("ridgeview-owner", …)` times out on a URL that never comes. Increment 1.89 recorded this; writing 1.90 reproduced it anyway, and reading the suite caught it before the run. It now sits before that case, with the reason in a comment beside it. Ending every session is safe for the cases that follow, because each signs in for itself.

**An accessibility violation this increment introduced and its own gate caught.** The first browser run passed all 51 cases and axe reported one critical/serious violation: `link-in-text-block` on the "Sign in again" link. A link inside a paragraph, distinguished from the surrounding text by colour alone, fails for anybody who cannot tell that colour from the ink. The screen's other links sit on their own line, where the rule does not apply. This one is underlined now — `underline underline-offset-2`, with the reason in a comment so the next person does not take it back out as inconsistent. Re-run: 51 cases, 114 audited states, no violations.

## Not in Increment 1.90

**A second administrator's approval.** Ending every sign-in is recoverable by definition — everybody signs in again — so the two-pairs-of-hands control that Increment 1.77's recovery ceremony needs would buy nothing here and would cost the practice the minutes the act exists to save.

**Ending sessions for a chosen group** (one location, one rank). The two acts this product has are the proportionate one (Increment 1.88, one named person) and the blunt one (this). A middle needs a reason to exist that an incident has not yet given.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Recorded since Increment 1.88, still not this increment's subject.

## Increment 1.89

Increment 1.88 shipped without a browser case and said so in its own record — in the commit, the pull request and this document. This closes that, and writing it found something 1.88 had wrong.

## What the test found

**In the seeded practice the only holder of a critical duty is the owner.** `CRITICAL_DUTIES` is the six entitlements weighted 5 — `collect_cash`, `prepare_deposit`, `bank_reconcile`, `approve_writeoffs`, `create_vendor`, `release_payment` — and of the seeded Ridgeview people only Riley Owner holds any (`approve_writeoffs`, `bank_reconcile`). Finn Front's `post_payments` is weighted 4.

So the only `new_device_financial_role` alarm the seed can raise is **about the person reading it**, and `endSessionsForPerson` refuses that case by design: ending your own sessions is a sign-out, and the route says so. Increment 1.88 therefore put a button on the board that, for the one alarm a fresh practice sees, could only refuse.

A button that can only refuse is worse than none.

## Where the decision belongs

The board knows its viewer's username, display name and role — `readViewer` carries no id, and adding one would push a comparison onto seven screens to answer a question one place already knows.

**The alerts route knows both**: who is asking (`ctx.access.user.id`) and who each event names. It now clears `personId` and sets `aboutViewer` when they are the same person, so the board renders no act and says instead: *"This names your own sign-in. To end it, sign out from the header — that needs no administrator."* — the same guidance the route's refusal gives, arriving before the press rather than after it.

`listHardEvents` is unchanged and still viewer-blind, which is right: it reads rows, and who is looking is not one of them.

## The case itself

It grants `bank_reconcile` to the front desk — making a second critical-duty holder, which the seed does not have — then plants **two** sessions for that person from one browser nobody has seen on that account. Two, not one, because the sentence counts them, and a count is the part that tells the owner the act reached more than the row the alarm named.

Then, signed in as the owner, it asserts in one pass: the owner's own alarm carries the self line and **no** button; exactly one "End their sign-ins" button exists; pressing it says *"Ended 2 sign-ins for Finn Front"*; no live session remains for that person; and the chain holds one `auth.sessions_ended` event naming them with a count of two.

**Placement mattered and cost a run.** The case first went at the end of the suite, after the case that pairs a new authenticator for the owner — which leaves `DEV_MFA_SECRET` no longer that account's secret, so `b.signIn` timed out waiting for a URL that never came. It now sits before that case. The failure named the wrong thing (a URL timeout) for the right reason, which is worth recording for whoever adds the next owner-signed-in case to this suite.

**Red-before, measured.** With the route's decoration reverted, the case fails waiting for the self line, because the owner's own alarm still offers a button.

## Not in Increment 1.89

**Giving the seed a second critical-duty holder.** The case grants one and takes it back. Changing the seed would move what every other case sees of the SoD findings, the roster and the digest, for one case's convenience.

**Surfacing the tenant-wide revoke**, which still has no screen — unchanged from 1.88 and still its own increment.

**The stale comment in `regainAccess.ts`** ("nothing writes `users.role`", which Increment 1.78 made false). Still recorded, still not this increment's subject.

## Increment 1.88

The owner's board says: *"A holder of Approve write-offs and Reconcile bank to PMS signed in from a browser not seen before for that account, at 2026-09-22 04:17 UTC."*

Until now the product offered nothing to do about it.

## Three things wrong at once

**The alarm's link went somewhere it does not belong.** `new_device_financial_role` carried `href: "/risk"`. Practice Risk renders **no hard events at all** — they render on the owner's board, the weekly digest and the CPA package. So the one link on the most alarming sentence the product prints led away from the alarm, to a screen that has neither it nor any control for it.

**The act did not exist.** `revokeSessionsForUser` sits on the `AuthStore` interface and in both implementations, and its only caller is the enrolment route, acting on the caller's own sessions. **No route let an administrator end another person's sessions.**

**The one session-ending route nothing calls is the wrong size.** `POST /api/admin/revoke-all-sessions` ends every session in the practice. It has no caller anywhere — the only other mention is a doc comment. Ending everybody's sign-ins because one person's browser is unfamiliar is not the act the alarm describes.

## The proportionate act, where the alarm is

`endSessionsForPerson` ends the sessions of the person the alarm names and nobody else's, and `POST /api/admin/end-sessions` carries it at administrator rank. The control sits on the board beside the acknowledgement, because that is where the owner already is; the event's `href` is now `null`, since there is nowhere else worth sending anybody.

The event carries `personId` for this purpose. Its subject is the **session** — that is what was seen on a new browser — and ending a person's sign-ins needs the person, so the two are not the same field and the type now says so.

## The tenant check belongs above the store

`store.revokeSessionsForUser` resolves the **target's own** tenant and scopes its transaction to that, so it will end a session in any practice if handed an id from one. The guard therefore sits in `endSessionsForPerson`, before the call, and not in the store.

A target in another practice answers exactly as one that does not exist — "No such person in this practice." Saying which it was would confirm an account to somebody who only guessed at it, and the caller can act on neither answer. A unit case asserts the two responses are identical rather than merely similar.

## What it refuses, and what it says afterwards

Ending **your own** sessions is refused with the way to do it instead: sign out from the header, which needs no administrator. It is a different act wearing the same words.

A count of zero is reported plainly rather than as a failure — *"had no sessions left to end. Nothing was signed in, so nothing changed."* The person may have signed out already, or the session may have timed out between the alarm and the press, and in both cases the thing the owner wanted is true.

The act is disruptive, not destructive: the person signs in again with the password and a code they already hold, and nothing they did is undone. The button says so beside itself, which is why it asks nothing further before acting.

## Two integration points, checked rather than assumed

**Metrics.** The domain event carries `targetUsername`. `redactEventPayload` in `packages/metrics` filters by key name, and `SENSITIVE_KEY` already matches `username` — so the payload is stripped before aggregation by design, not by luck.

**The weekly digest.** An unmapped kind is not dropped; it falls through to a humanised label. `auth.sessions_ended` is now mapped explicitly to `access.sessionsRevoked`, beside the tenant-wide act, and carries its own label.

## Not in Increment 1.88

**A browser case.** Every other user-facing increment in this sequence has one, and this does not. Raising a `new_device_financial_role` event in a browser run means planting a session row with an unseen user agent for a critical-duty holder, and the honest choice at this point was to ship the increment with its unit and integration coverage and say the gap out loud rather than add a case built in haste. The existing 49 cases pass, including the board, which is what rules out a regression from dropping the `href`.

**Surfacing the tenant-wide revoke.** `revoke-all-sessions` still has no screen. It is a blunter act with different consequences — it signs out the person pressing it along with everybody else — and it deserves its own increment and its own confirmation, not a button added beside this one.

**Ending sessions from anywhere but this alarm.** The act is reachable only where the board names somebody. A general "end this person's sessions" beside every seat is a user-administration question, and belongs with that surface.

**A stale comment found on the way.** `regainAccess.ts` says "nothing writes `users.role`", which Increment 1.78 made false when it added user administration. The behaviour is right and the comment is not; correcting it is not this increment's subject.

## Increment 1.87

The practice invites its accountant, types a username, and presses the button. The screen reports a failure it cannot explain, no seat exists, and nothing says what to change. The username was free in this practice and taken in another.

## Why the check could not see it

A sign-in name is unique across **every** practice this product serves. `users_username_lower_uidx` (migration 0002) enforces it on `lower(username)` with no tenant in the key, because signing in carries no practice with it: `auth_lookup_user` finds one row by username alone, and a second row would make that lookup a question with two answers.

`inviteAccountant`'s own check is tenant-scoped (`tenantId = ? AND username = ?`), and **row-level security is why it must be**. The query runs inside a tenant transaction with FORCE RLS on `users`, so it cannot see another practice's row — not by oversight, by design. The check could not find the row it would collide with, so the insert went ahead, violated the global index, and threw.

`withGuard` catches nothing. The error travelled out to a bare 500 with no `error` field, which the screen's own loader read as `{}` and reported with its fallback sentence.

## The insert is the check

Some questions only the database can answer, and this is one. The insert now runs under a **savepoint**: a unique violation on that named index becomes a 409 refusal, and the savepoint rolls back so the surrounding transaction stays usable rather than aborted. `packages/db/src/pgErrors.ts` holds the reading — `isUniqueViolation(err, USERNAME_GLOBAL_UIDX)`.

Naming the index is deliberate. A caller that refused on any `23505` would swallow a collision it did not anticipate and report it as the one it did, which is how a second defect hides behind the first one's refusal.

## What the refusal says, and what it will not say

It names the rule — sign-in names are unique across every practice — and it does not name the practice holding the username, nor confirm anything about that practice. The caller learns only what the rule already implies: this name is spent, choose another.

That is a deliberate trade rather than an oversight. Saying less would hand back the dead end this increment exists to close; saying more would let one practice read another's roster one guess at a time. The live case asserts both halves — the sentence carries the rule, and it carries neither the other practice's name nor the sentence used when this practice already holds the username.

## A wrong first fix, and the case that caught it

The savepoint and the catch went in, and the test failed exactly as it had before: `duplicate key value violates unique constraint "users_username_lower_uidx"`, thrown rather than refused.

Drizzle wraps a failed statement in its own error — `Failed query: insert into "users" ...` — and hangs the driver's error off `cause`. `isUniqueViolation` read `code` off the error it was handed, found none, and re-threw. It now walks the `cause` chain to a fixed depth, and a unit case pins the wrapped shape so the next reader does not rediscover it. **The reproduction is what found this, not the reading**; the fix looked right and did nothing.

## One correction to the audit that named it

The seat audit listed this as two findings — "inviting a username another practice already uses throws instead of refusing" and "invite fails with an unexplained 500 when the username is free in this practice but taken in another". They are one defect with one cause. It also implied more than one user-creating path; `invite.ts` holds **the only `insert(users)` in the product**, which the comments in `soleDecider.ts` and `ranks.ts` already state.

A second hazard the audit did not raise turned out not to exist: a differently-cased duplicate within one practice would pass an exact-match check and violate an index on `lower(username)`. It cannot happen, because `USERNAME_SHAPE` admits lower-case letters, digits and hyphens only, so `lower(username)` is `username`. That was checked and discarded rather than carried into the increment.

## Not in Increment 1.87

**Making usernames unique per practice rather than globally.** That would end the collision at its root and break sign-in, which resolves a username with no practice to scope it by. It is a question about how people sign in, not about how a seat is invited.

**A general error boundary on `withGuard`.** Every other route reaching a bare 500 on an unhandled throw is a real gap and a much wider change; this increment closes the one path it can prove.

**The rest of the seat audit.** It ran against `2dab1b5` on 2026-09-20 and is substantially stale. Each remaining finding needs checking against the working tree before it counts as work.

## Increment 1.86

The owner opens Practice Risk, finds the departing hygienist's card, and presses **Revoke** beside `bank_reconcile`. The screen says the duty is gone. The SoD finding closes. The `role.revoked` domain event is written. The person keeps the duty — on the session they are sitting in, and on every session after it, permanently.

## Why a control could report success and do nothing

`revokeEntitlement` ends a grant the way this product ends every row: it stamps `effective_to` rather than deleting (`apps/pms/src/lib/controls/grants.ts:283`). It does not end the person's sessions. Eight readers honour that convention — `staff.ts`'s `isLive`, `roster.ts:210`, `findingSubjects.ts:41`, `hardEvents.ts:288`, `round.ts:394`, `grants.ts:260`, the partial unique index in migration `0013`, and `controls-engine`'s own `isActive`.

The authorization path honoured neither half of it:

```
apps/pms/src/lib/auth/postgresStore.ts (before)
  .from(userEntitlements)
  .where(eq(userEntitlements.userId, userId));
```

That function feeds `getUserById` and `getUserByUsername`, which are the two reads `requireAccess` makes on **every guarded request**. `requireAccess` then evaluates both the `entitlements` requirement and the `orEntitlement` opening against a list of every duty the user has ever been granted.

## The rule, written once

`packages/db/src/liveGrants.ts` now holds it: a grant is live when it has begun and has not yet ended. `isLiveGrant` is the in-memory form, `liveGrantAt` and `liveGrantsForUser` the Postgres predicates. `entitlementsFor` uses it, and `staff.ts` borrows it rather than restating it — because restating it is exactly how the auth path came to state it nowhere.

The comparison against the end is strict. `revokeEntitlement` stamps `effective_to` with the instant of the revoke, so a duty revoked at `now` is not live at `now`; a duty is gone the moment it ends, not one tick later.

**Which clock, and what it costs.** `now` is the caller's, matching `revokeEntitlement` and the in-memory readers that already take one. Some rows are written with the database's `now()` instead. On a deployment whose database clock runs ahead of its application clock, a grant written that instant reads as not yet begun for the length of the skew. That fails closed, which is the safe direction for an authorization predicate, and the alternative — moving `revokeEntitlement` to the database clock as well — is a larger change than this defect warrants. The note sits on the constant.

## One correction to the finding that produced this

The audit that surfaced it also claimed a **future-dated grant opens its routes early**. The missing `effective_from` predicate is real, and no product path reaches it: every writer stamps `now` (`grants.ts:194`, `invite.ts:153`, `policy.ts:95`). That half is a hazard the predicate closes, not a defect anybody met, and it is recorded as such rather than counted as a second live bug. It still earns a case, because the column exists, is `NOT NULL`, and is the half a reader adding a scheduled grant would otherwise rediscover.

## Why nothing caught it

`controls.live.test.ts:303-318` asserted the finding closes and that a second revoke answers 404. It never asked what the person could now do. `postgresStore.live.test.ts:112` asserted a user's entitlements equal the three the seed granted — and no seeded row has ever been revoked, so the missing filter would not have moved that assertion by a character.

Both now ask. The proof is red-before and green-after, measured rather than reasoned: with the one-line predicate reverted, `requireAccess` returns `ok: true` on a revoked duty and the new case fails with `expected true to be false`. The assertion that was missing sits where the audit said it was missing, in the revoke case itself.

## Not in Increment 1.86

**The other six `effective_to IS NULL` sites.** They read correctly today, and several deliberately ask "any row ever" rather than "live now" — `loadStaff` hands the engine every row and lets it filter by date. Rewriting them would widen this change well past the defect.

**The in-memory dev store.** `memoryStore.ts` holds entitlements as a plain array with no effective dates and no revoke path, so there is nothing there to filter; `AUTH_DEV_MEMORY` is a development convenience, not a seat any practice sits in.

**Ending the revoked person's sessions.** A revoke now closes the routes on the session they are sitting in, which is the control; whether it should also sign them out is a separate question about what a revoke means, and it is the owner's to answer.

**The rest of the seat audit.** It ran against `2dab1b5` on 2026-09-20, before Increments 1.74 through 1.85, and is substantially stale — its top three findings are Increment 1.74. This one was verified against the working tree before any of it was built, which is the only reason it is here.

## Increment 1.85

Increment 1.84 wrote the expiry date into a comment. This increment gives that sentence a reader.

The fixture that expires is now one constant. `SEED_STORY_WEEK` in `packages/db/src/seed-data.ts` holds `effective` (2026-09-19) and `issued` (2026-09-21), and the four seed modules, the three demonstration defaults and the seven money-desk assertions all read it rather than repeating it. Moving the week is one edit where it was eight, and the arithmetic note moved with the value — it sits on the constant now rather than in `seed-ledger.ts`, which keeps a four-line pointer to it. Increment 1.84's record says that note is in `seed-ledger.ts`; it was, for one increment.

**The gate now fails by name.** `apps/pms/src/lib/controls/seedWindow.ts` holds the three rules as one function, and `seedWindow.test.ts` runs it against the real clock. On 2026-09-27 the suite will say this, before the owner-board cases reach their assertions:

```
The seed's story week expired on 2026-09-27.

SEED_STORY_WEEK.effective is 2026-09-19 and today is 2026-09-27, which is
8 days. BACKDATE_DAYS is 7, so every seeded ledger row now raises a
`retroactive_entry`, and the owner board and weekly digest cases that assert
those rows raise nothing will fail too. This case fails first so that the
reason is not left to be inferred from them.

Two ways forward, as Increment 1.84 recorded:
  1. Anchor the seeded dates to the seed run. This ends the drift for good and
     moves every assertion that quotes them.
  2. Move SEED_STORY_WEEK forward in packages/db/src/seed-data.ts. An effective
     date may not run ahead of today and may not sit more than 7 days back, so
     any written date buys at most seven days; it also may not sit exactly
     2 days back, which is the day the money-desk suite banks its deposits.
```

## The third rule, which cost a run to find

`readSeedWindow` refuses three states, not one, and the third is the one worth recording. A week is wrong when it runs **ahead of the clock**, because no posted row may be effective on a day that has not happened. It is wrong when it sits **more than `BACKDATE_DAYS` back**, which is the expiry. And it is wrong when it sits **exactly two days back**, because that is the offset `money-desk.e2e.test.ts` banks its deposits at: the seeded day close already holds two, so the sealed day holds four and every case that pins the count fails.

That third rule is not a deduction. Increment 1.84 hit it on its first attempt, at a week six days back, and read it off four failures. `DEPOSIT_DAYS_AGO` now lives beside the other two rules and the money-desk suite imports it, so the guard follows the suite rather than quoting a number at it.

The collision is a single day, and it moves. Whoever next picks a date will reach for the maximum the arithmetic allows — today's date, seven days of life — and the collision will land two days later, on a day nothing else explains. The guard names it on the day it lands.

## What the guard does not do

It does not stop the owner-board cases going red on 2026-09-27; nothing short of moving the date or anchoring it does that. It fails alongside them, with the sentence. The value is the sentence, and the measure of it is what 1.84 cost: a morning spent reading two board assertions about retroactive entries to arrive at a constant neither of them names.

The three demonstration defaults are checked rather than shared. `apps/pms/src/lib/demo/dates.ts` holds the days the day-close, ledger-posting and statement forms offer, and `seedWindow.test.ts` asserts both against `SEED_STORY_WEEK`. They are not read from `@pms/db/seed-data` directly because that module also carries `DEV_PASSWORD` and `DEV_MFA_SECRET`, and a client component that imports it puts both inside the bundler's reach — not a thing to depend on tree-shaking for, when an asserted copy costs two lines.

## Not in Increment 1.85

Anchoring the seeded dates to the seed run, which remains option 1 and remains the durable answer whenever it is wanted. This increment makes that decision cheaper to take and impossible to miss; it does not take it. Nothing here changes `BACKDATE_DAYS`, the detector that reads it, or what a real practice sees — no screen imports `seedWindow.ts`. Nothing here moves the week again: it still expires on 2026-09-27, and five days of it remain.

## Increment 1.84

On 2026-09-22 the repository's own test suite began failing, on `main`, for nobody's change. Two money-desk cases went red:

- `shows the front desk the links only, and the owner a board that reflects the day`
- `counts the week for the owner in the digest, stamps it once, and refuses the front desk`

The seed writes `effective_date` as a written date — `2026-09-14` — and `posted_at` as the moment the seed runs. The gap between them therefore belongs to the wall clock and not to the fixture. `BACKDATE_DAYS = 7` in `controls/detectors.ts`, read by `alerts/hardEvents.ts`, raises a `retroactive_entry` once that gap passes seven days. On 2026-09-21 the gap was seven; on 2026-09-22 it was eight, and seven ordinary seeded rows became retroactive-dated entries on the owner's board — where one case asserts that kind is absent, and the other pins a count the first case's acknowledgment feeds.

Nothing was wrong with the rule. The rule is right: a charge effective on the 14th and posted on the 22nd **is** eight days retroactive. What was wrong was a fixture that describes "last week" with a date that stops being last week.

## The choice, and who made it

Three ways forward were put to the owner, with the recommendation named:

| | | |
|---|---|---|
| 1 | Anchor the seed's dates to the seed run | Ends the drift; moves every assertion that quotes them |
| 2 | Move the written dates forward | Smallest; the same failure re-armed for a later date |
| 3 | Rewrite the two cases to assert the rule | Honest about today; leaves the drift |

**The owner chose 2**, and this increment is that choice carried out rather than argued with. What the record owes in return is the arithmetic, stated where the next person will meet it.

## What a written date buys, exactly

Two constraints bound it. `today - effective` must stay at or under seven, or the rule fires. And `effective` may not run ahead of the clock, or the fixture describes a practice posting next week's work. Between them, **any written date buys at most seven days**.

This one buys five. The week moved from 2026-09-14 to 2026-09-19, not to the 2026-09-20 that six days would have allowed, because the money-desk suite imports its deposits at `daysAgo(2)` — which on 2026-09-22 *is* the 20th. A week anchored there put four rows on a day close that expects two, and the suite said so on the first run. Five days clears that collision for every day this week survives.

**It fails again on 2026-09-27.** That sentence is in `seed-ledger.ts`, above the rows it governs, with the arithmetic and the decision that is waiting — so that the next failure arrives as a dated note rather than as a mystery about why `main` went red overnight.

- **What moved.** Three ledger effective dates, the day-close business date, the approvals effective date and two statement effective dates, 2026-09-14 → 2026-09-19; the statements' as-of and issued dates, 2026-09-16 → 2026-09-21. Three demonstration defaults on the screens that offer a date moved with them. Seven assertions in the money-desk suite that name the sealed day moved with them.
- **What did not.** `account_members.effective_from` at 2026-09-01, which is a membership start that no window rule reads. And every self-contained unit fixture that passes its own `now` — the great majority of the forty-odd files holding these dates — because those never drift and moving them would have been churn dressed as a fix.
## A 401 belonging to no case

The first CI run of this increment failed with every one of its twenty-six money-desk cases passing. `assertNoProblems`, which runs once the suite is over, reported a single console error:

```
Failed to load resource: the server responded with a status of 401 @ /api/approvals/inbox
```

A 401 attributed to nobody, on a route the last case never touched, raised after the last assertion had already passed.

`b.signIn` opened each case by clearing the context's cookies and then navigating. The previous case's screen was still the live document at that moment, so whatever it still had in flight came back unauthorised — a console error from a page no case was looking at any more. Increment 1.82's case had just begun ending on `/approvals`, which is a screen that loads, and the case after it is the first thing to clear cookies underneath it.

`signIn` now unloads the document before the cookies go. That is hygiene between cases rather than a softening of the rule: a 401 outside a `signedOut` window still fails a suite, exactly as strictly as before.

**The record should say what it can and cannot claim.** The race never reproduced locally, across four full runs of the suite before and after the change. The evidence for the cause is the mechanism and CI's own log, not a reproduction — which is why the fix is the one that removes the race rather than one that makes a symptom quieter.

- **Method.** The seed and the three defaults changed first, then the full gate ran and the failures named the rest. Predicting which of forty files cared would have been guesswork; four failures on the first run, and none on the second, is the measurement.

## Increment 1.83

Increments 1.81 and 1.82 gave every screen one answer for a sign-in that has ended, on the way in. Pressing a button was still the old shape: the act's `catch` wrote `err.message` into the screen's message line, so a 401 mid-press produced one sentence and nothing to press.

26 act sites across 12 screens now show the `SessionEnded` panel instead. 19 catches that write `set<X>(err instanceof Error ? err.message : ...)` gained a two-line guard ahead of that line. Seven act blocks that handle a refusal **without throwing** set the state directly on `res.status === 401` — those sit in `try/finally` with no `catch`, so a thrown `SignInEnded` would have been an unhandled rejection saying nothing to anybody.

**The half-finished edit goes with the screen, deliberately.** The session is gone, so nothing on that screen can succeed; and the typing could not survive the sign-in either way, which Increment 1.82 put out of scope on its own merits. Offering the way back beats keeping a form that cannot be submitted.

## A correction to Increment 1.82's record

That increment's "Not in" paragraph said acts "still get the route's sentence". Once it inserted `refuseIfSignInEnded` at all forty-two sites, that stopped being true: a 401 mid-press began printing the message of the error class 1.82 introduced, rather than `requireAccess`'s "This session timed out. Sign in again." Both were link-less, and the second had lost the one instruction the first carried. The sentence was accurate when written and wrong by the time that increment merged, which is the kind of drift a "Not in" paragraph is most prone to.

- **Tests.** Browser (1): the owner opens the Locations screen, types a real edit into the Friday closing time, the session row is revoked underneath them, and pressing **Save Main** shows the panel rather than a sentence — with the link carrying `/locations`, the way back followed through a real sign-in, and the practice's own hours unchanged, because the edit that could not be saved was not saved.

**Not in Increments 1.83 and 1.84.** Anchoring the seed's dates to the seed run, which is option 1 above and remains the durable answer whenever the owner wants it. Anything about how long a session lives, or a warning before an idle window closes. A per-practice choice of that window. Re-running what a person was doing after they sign back in, which would mean holding a half-finished act across a sign-in and carries its own control implications. And a guard that would fail the suite loudly on the day the written week expires — worth having, and a different question from moving the date.


## Increment 1.82

Increment 1.81 drew the line between a sign-in that has ended and a seat that lacks rank, and taught the seven screens that pre-read `/api/me` to respect it. Its own "Not in" paragraph described what was left as a narrow race — a session dying *after* the seat check. Reading the rest of the product found something wider.

**Nine screens never read a viewer at all.** The ledger and an account's explanation, posting a payment, the approvals inbox, the day close, bank reconciliation and a run, statements and a statement. Every one loads straight from a guarded route with the same line:

```ts
if (!res.ok) throw new Error(body.error ?? "Could not load ...");
```

So a person whose sign-in ended on any of them — after a lunch break, or because an administrator stood them down — met `requireAccess`'s own sentence as a bare paragraph:

> This session timed out. Sign in again.

True, and a dead end. No link, no control, and a header `navLinksFor(null)` had emptied for the same reason. Seventeen files held forty-two such lines.

## The reading moves out of the screens

The correct version already existed, in exactly one place. Practice Risk got it in Increment 1.81 because that screen reads ten routes at once and needed a classification that would survive a race with the `/api/me` read beside it. It was written for one screen, and nothing else could reach it. `lib/auth/guardedFetch.ts` is that code, moved.

- **`getGuarded`** is how a screen reads a guarded route: a 401 raises `SignInEnded`, everything else raises an ordinary `Error` carrying the route's own words.
- **`refuseIfSignInEnded(res)`** does the same for a fetch a screen makes its own way, and it is what the forty-two sites got — **one line inserted ahead of each existing throw**. Nothing was restructured and no message changed: the 401 is lifted out in front, and every other failure falls through exactly as it did. A rewrite of forty-two loaders would have been a much larger diff with much more to get wrong.
- **`loadFailure(err, fallback)`** is the four lines every screen held in its `catch`, made once. The fallback stays the caller's, because only the screen knows what it was trying to read.

**Classified on the status, never on the sentence.** `requireAccess` has four sentences for a 401 and may gain a fifth; a screen that matched words would be tied to strings it does not own, and would quietly stop working the day one is reworded. A unit case pins all four, and an empty body besides.

## One concept, one word

Increment 1.81 named the state `signed_out` while the copy the reader sees says "Your sign-in has ended". Both files were in this diff anyway, so the state is now `sign_in_ended` throughout, and the error class is `SignInEnded`. One concept, one word, in the code and on the screen.

Three screens — posting a payment, the attestation view, the questions view — keep their errors as a `string | null` rather than a discriminated state. They get a flag of their own rather than being folded into a sentence, because the one state that is not an error must not be reported as one. That is the same rule this pair of increments is about, applied to the shape those screens happen to have.

- **Tests.** Unit (9): the answer returned; a 401 raising `SignInEnded`; **the four `requireAccess` sentences and an empty body all classified the same way**, which is what keeps this off strings it does not own; a 403 left exactly where it was, raising an ordinary error with the route's words and not a sign-in that ended; the caller's fallback used when the route gave none, and the route named when nobody gave any; the status still read when the body is not JSON; `refuseIfSignInEnded` silent on every status but 401; and the two kinds told apart. Browser (1): the owner reads the ledger, the session row is revoked underneath them, and the reload says the sign-in ended rather than showing the route's sentence alone — with the link carrying `/ledger`, the same reading on the approvals inbox reached with the same dead session, and the way back followed through a real sign-in onto the screen they lost.

**Not in Increment 1.82.** Acts. A person who presses Approve, or Post, or Close the month, and meets a 401 mid-press still gets the route's sentence in the screen's message line — true, and link-less, exactly as the loads were. The classification now reaches those throws too, because it was inserted at every site, but each screen's act handler still writes a string rather than reaching for the panel, and converting them would have doubled a diff that is already seventeen files. It is the obvious next increment and the shape is now in place for it.

Also out: anything about how long a session lives, or a warning before an idle window closes; a per-practice choice of that window; and re-running what the person was doing after they sign back in, which would mean holding a half-finished act across a sign-in and is a different question with its own control implications.


## Increment 1.81

Increment 1.80 ended by naming what it left: a general answer for a session revoked underneath somebody **elsewhere** in the product. Reading the code to build it turned up something sharper than the rough edge that was described.

Seven screens ask `/api/me` before deciding what to show. Between them they gave five different answers to one question, and four of them gave a false one.

| Screen | On a 401 | What the reader was told |
|---|---|---|
| Owner board, Locations, Weekly digest, Month-end package | `!meRes.ok` → `not_for_seat` | "…is for the manager and owner seats. Your seat works from the links in the header." |
| Practice Risk, Reason codes | no status read at all | nothing; the administrator controls simply vanished |
| `home/session-status.tsx` | `!state.ok` | "Not signed in", with the one sign-in link in the product |

`!meRes.ok` is true of a 401 exactly as much as of a 403. So a person whose sign-in had ended was told their **seat** was the wrong one — and the reader might be the owner, whose rank had not moved. Worse, the sentence sent them to a header that `navLinksFor(null)` had emptied for the same reason, so the one remedy it named was the one thing the screen had just taken away. Two false statements, each propping up the other.

**This is not a rare state.** `IDLE_MS` is thirty minutes at a desk and ten in an operatory, so a lunch break or one long appointment reaches it; and a stand-down (Increment 1.79), a recovery ceremony (Increment 1.77) and a re-pairing (Increment 1.76) each revoke sessions outright.

## The rule

**A session that has ended is never reported as a seat that lacks rank.**

They are facts about different things. One is about the sign-in, which a person fixes in ten seconds. The other is about the seat, which they cannot fix at all — it takes an administrator, a conversation, and possibly a decision recorded on the chain. Telling somebody the second when the first is true sends them to their practice manager over a session timeout.

`lib/auth/viewer.ts` holds the reading. 401 is the only status that means the sign-in is over: `requireAccess` answers it for a revoked session, an expired one, an idle one and no session at all, and 403 for every question about rank or grant. That is the line the four screens crossed, and it is now drawn in one place with a test on each side of it.

## One sentence for four endings

A person cannot act on the difference between a session revoked and a session timed out, and both want the same next step, so both wear the same words. Naming which one would be telling somebody about the product's bookkeeping rather than about their morning.

- **`(app)/session-ended.tsx`** renders it as a **Refusal** — what was refused, why, and what to do next, which is what `docs/04` asks a refusal to be. A screen that declines to load without saying which of those three it means is the dead end that shape exists to prevent. The component moved up from `(app)/risk/refusal.tsx`, where only one screen could reach a shape the product names everywhere.
- **The link carries the screen they were on**, through the same `sanitizeCallbackPath` guard the sign-in page applies to the parameter it receives — so a path the product cannot vouch for lands on the practice home rather than anywhere a caller chose.
- **The header offers the door.** A reader the layout cannot resolve now gets "Sign in" where an enrolled person gets "Your authenticator". It branches on the seat rather than on the length of the link list, because a seat can legitimately hold no links and that reader is signed in.
- **A 200 that names no seat is not a seat without rank either.** It reads as unknown, so no screen renders the read-only view as though the reader had been demoted.

## A wrong hypothesis that produced a right change

The browser case failed on its first run, and the reason it failed was not the reason first supposed. Both halves are worth the record.

The case cleared its cookies and reloaded. The server rendered a signed-out header — so that request carried no session — and `fetch("/api/me")` still answered **200 with the owner's name, rank and grants**. The obvious reading was the browser's own HTTP cache, and `withGuard` was given a `Cache-Control: no-store` stamp on every answer it returns.

The next run showed the header present **and the 200 unchanged**, which ruled the cache out. Printing the cookies around the clear showed what was really happening: they were gone immediately after clearing and **all three were back after the reload** — the previous screen's traffic was still landing, and its `Set-Cookie` put the session token straight back. So the case now ends the session the way the product ends one, by revoking the row, which is the state a stand-down, a ceremony, a re-pairing and an idle window all produce, and which no cookie race can undo.

**The `no-store` stamp stays, on its own merits rather than as the fix it was mistaken for.** Nothing said a guarded answer must not be stored, and every route behind that wrapper reads tenant rows under a session: an answer kept on disk outlives the session that earned it, which on a shared front-desk machine is the last person's guarded data handed to whoever sits down next. `no-store` rather than `no-cache`, because `no-cache` permits storing and asks for revalidation — a promise about a request that a cache is free to skip when it cannot reach the server.

`withGuard` had no unit test until now, because importing it reaches NextAuth through `resolveStore` and `sessionId`. Both are mocked and never called: every case passes its own ports.

## The harness window, folded rather than widened

Increment 1.80 excepted a 401 on `/api/enroll-mfa` from the rule that a console error fails a suite. This increment needs the same exception on other routes, and widening it to `/api/` would have hidden exactly the defect the rule exists to catch.

So the exception became a window the case opens for as long as it is driving an ended sign-in on purpose, and Increment 1.80's case now uses it too. One concept, one mechanism, and outside the window a 401 still fails a suite.

- **Tests.** Unit (18): the reading — a seat; a revoked session, a timed-out one and no session at all, all three carrying one sentence; **a 403 never read as a sign-in that ended**, which is the line this increment draws; entitlements kept only where usable; a success naming no seat refused; a 200 that does not say `ok` refused; the route's own words carried otherwise, with a fallback. The link — the screen carried, a query kept, and a path the guard cannot vouch for sent to the practice home. Then `withGuard` (5): the answer a live session earns, a refusal that names the session, a refusal about the seat, and a refusal made before the session is read at all, each stamped; and the handler's own headers and body left alone. Browser (1): the owner reads their own board, the session row is revoked underneath them, and the reload says the sign-in ended rather than that the board is not theirs — with the `no-store` stamp asserted on the wire, the header carrying the door, the same reading on a second of the four screens, and the link followed through a real sign-in back onto the screen they lost.

**Not in Increment 1.81.** The loaders behind the seat check. Once a screen has read its viewer, a session that dies a moment later surfaces through `loadLocations`, `loadPackage` or `loadDigest` as the route's own sentence in a plain paragraph — true, and link-less. Closing that would mean a typed 401 threaded through every loader, which is the shape `getJson` already has on Practice Risk and which the other screens can adopt when one of them next changes for its own reasons. Also out: any change to how long a session lives, or a warning before an idle window closes — both are worth having and neither is this increment's question; a per-practice choice of idle window; and telling a person **which** of the four endings they met, which is deliberately withheld rather than missing.


## Increment 1.80

Increment 1.79 closed by naming what it left behind: "the JWT that keeps saying 'needs enrolment' after enrolment completes". This is that, and it is the last of the cluster Increments 1.72 through 1.79 worked through — the one remaining way this product held somebody on a screen with nothing they could press.

Four facts, each read off the code before anything was built:

| | |
|---|---|
| The claim is written once and never again | `auth.config.ts` assigns `token.needsMfaEnrollment` only where NextAuth hands the callback a `user`, which it does at sign-in and at no later request |
| Finishing an enrolment revokes the session that reached it | `api/enroll-mfa/route.ts` calls `revokeSessionsForUser` on success — correctly, because not one of those sessions passed the factor the account now has |
| The gate refused the sign-in page | `middleware.ts` admitted `/enroll-mfa`, `/api/enroll-mfa` and `/api/auth`, and redirected everything else, `/signin` included |
| The only way off the screen lived in React state | the single `signOut` sat inside `if (recoveryCodes)`, which a reload discards |

## The cookie outlived the row it named

Put those four together from the person's side and the trap closes in one step.

They sign in for the first time with no authenticator. They pair one. The route revokes every session for the account and answers with ten recovery codes. The signed cookie in their browser survives that, still carrying a claim minted before the factor existed: **this account still owes a second factor.** Then they reload the page, or close the tab and come back, or their laptop sleeps.

The middleware reads the cookie and believes it, as it must — it runs on the edge, where there is no database to ask — and sends them to `/enroll-mfa`. That screen asks its own route for a setup URI. The route runs `requireAccess`, finds the session revoked, and answers **401**. The form had one reading for a refusal: put the words on the screen. With no setup URI the `Finish enrollment` button stayed disabled; with `repairing` false the `Leave this as it is` link never rendered; with no recovery codes in state the sign-out button was not there either.

One error line, one button that cannot be pressed, and an address bar that refuses to go anywhere else. The session behind it was already dead, so nothing on the screen could have worked even if something had been pressable.

A technical exit did exist — `GET /api/auth/signout` renders NextAuth's own confirmation page, and `/api/auth` was admitted — but it is an address nobody types, and a product whose only escape is an undocumented URL has not offered one.

## A gate may hold somebody out of the application; it may not hold the door

`enrollmentGateAllows` now admits `/signin`, and that is the rule this increment adds rather than a patch on the symptom. A person there holds nothing: every guarded route still refuses an unenrolled account through `requireAccess`, which reads the user row and not the token. What the old gate took from them was the ability to abandon a half-finished sign-in, which is something a person must always be able to do — and which, once the claim went stale, was the difference between a slow screen and a dead end.

The two decisions that produced the trap now live in one tested file rather than in two places nothing could reach. The middleware runs on the edge under NextAuth's wrapper and the form is a client component, of which this app has none under test; so between them they held a person on a screen, and no suite had ever exercised either.

## The field that was already in the response

The route has answered `signOut: true` since Increment 1.72. Nothing read it.

Reading it is what closes the gap: the route revokes the rows, and the screen ends the browser's half of the same session in the same breath, so **the cookie cannot outlive the row it names**. It is read strictly rather than defaulted, because the route is the one place that decides whether a session ends, and a screen that assumed it would be signing people out on its own authority.

The codes stay on screen throughout — nothing is redirected — because they exist in one place, once. A person who reloads past them still loses them, exactly as before; what changes is where that loses them to. It is now the sign-in page, and re-pairing (Increment 1.76) mints a fresh set, so the loss is recoverable rather than terminal.

## What a 401 is, and what it is not

Every other failure this screen can meet leaves a person somewhere they can still act: the code was wrong, the store is not configured, the network dropped. Those belong beside the field, and stay there.

A 401 is different in kind. It means the session this screen was reached on no longer exists, so nothing on the screen can work, and the only honest thing to offer is the way back. `requireAccess` answers 401 both for a revoked session and for no session at all, and the sentence covers both — with its second clause conditional, because only one of the two is the person's own doing.

## One allowance in the browser harness, narrowed on purpose

The harness fails a suite on any console error, excepting a 403 or 409 on `/api/` — a refusal the browser logs, which is the product working. A 401 was never excepted, because until now no case drove one deliberately.

The allowance added here names `/api/enroll-mfa` and nothing else. Widening it to `/api/` would have been the smaller diff and the worse check: a 401 anywhere else is a session the product lost track of, which is the defect this increment is about, and a harness that stopped failing on it would have hidden the next one.

- **Tests.** Unit (17): the screen and its route admitted, and NextAuth's endpoints, without which the one exit could not fetch a CSRF token; **the sign-in page admitted**, which is this increment's rule; the application itself refused, named screen by screen; and the two paths matched exactly rather than by prefix, so the gate opens on a decision and not on a spelling. Then the two readings: a first pairing and a re-pairing; **a 401 read as a session that is gone rather than as an error beside the field**, identically from both routes, so one state wears one sentence; the route's own words carried for every other failure, with a fallback when it said nothing usable; a 200 carrying no setup URI refused, because the alternative is an empty code block above an enabled button; the session's fate taken from the route's field and not assumed; and a mistyped six digits kept beside the field, where a person who is still on a working screen belongs. Browser: the first sign-in case now walks the trap — it leaves the enrolment screen for `/signin` while the claim is live and genuinely stale, comes back, finishes the pairing, and then **reloads**, which is the act nobody could survive.

The browser case was checked against the unfixed code rather than assumed to bite. With both halves reverted it fails at the sign-in page, which the old middleware redirected away. With the gate fixed and the screen left alone it gets one step further and fails at the reload, on the sentence the old screen had no way to say. Both halves are load-bearing, and the record says so rather than claiming it.

**Not in Increment 1.80.** Refreshing the claim itself — a `jwt` callback `trigger: "update"` path, or a middleware that re-reads the session row. The authority is already the server: `requireAccess` derives enrolment from the user row on every guarded call, and the token's copy is a redirect convenience sitting in front of it. Teaching the token to refresh would put a second answer beside one that is already correct, and the edge cannot read the row in any case. Also out: holding the recovery codes anywhere a reload could recover them, which would mean storing them somewhere they are meant never to rest; any change to what the enrolment route revokes, which is right as it stands; and a general answer for a session revoked underneath somebody **elsewhere** in the product — an enrolled person who re-pairs also loses their sessions, and lands not on a trap but on a degraded screen with an empty header whose fetches refuse. That is a real rough edge, it is not a dead end, and it wants one shape for "your sign-in ended" across every screen rather than a second copy of this one.


## Increment 1.79

`users.active` has been in the schema since Increment 0.2 and has never been reachable. Four facts, each checked against the code before anything was built:

| | |
|---|---|
| `deactivateUser` has two callers | `authorize.test.ts` and `postgresStore.live.test.ts` — both tests, no route |
| Nothing sets the column back | `active: true` appears only where an account is created |
| The rulebook never reads it | `detectSodConflicts` does not look at `active`, and `assignmentsFromGrants` builds an assignment for every person `loadStaff` returns |
| A *reason code* has both directions | `setReasonCodeActive` takes a direction and the screen offers both; people had neither |

So a practice could not remove access for somebody who left — they kept their password, their second factor and every grant — and could not have undone it either.

## Deactivating ends the grants, and that is the point

The third fact is why flipping the column alone would not have been enough: a departed colleague's duty conflicts would stand on Practice Risk forever, a signal that never clears.

Two ways out. Teaching the rulebook to skip inactive people would change what it scores — every practice's conflict counts would move, and `CONTROL_RULEBOOK_VERSION` would have to move with them, which is a real rulebook change made for a data problem. **Ending the person's live grant rows instead uses the mechanism already there**: `assignmentsFromGrants` reads live rows, the conflicts clear by themselves, no figure is redefined, and no stamp moves.

It also makes coming back honest. Reactivating restores the account and **not** the powers: every grant is granted again deliberately, through `evaluateGrant`, which is where a duty is supposed to be weighed. A reactivation that silently handed back six entitlements would be a grant nobody decided. What it does restore is the sign-in — the password and the second factor are untouched by either direction, because a practice bringing somebody back has decided to, and asking them to re-pair a phone they still hold would be ceremony rather than control.

- **`setPersonActive`** takes a direction rather than splitting into two functions, for the reason `setReasonCodeActive` does: one question about one column, and a practice reading two screens would have to decide which one to believe. It locks the practice, refuses, writes the column, and — on a deactivation — **revokes the sessions in the same transaction**, because `authorize` refuses an inactive account on the next sign-in and a session already minted is not a sign-in.
- **Refusals**: somebody outside the practice, a state that is already the state, **standing yourself down**, and **standing down the only administrator**.
- **Practice Risk's panel becomes "Who is on the practice"**, carrying both acts on one list. A person stood down is offered no rank change, because that act refuses a deactivated account and a button whose only outcome is a refusal is the shape Increments 1.72 and 1.74 were both about.

## The second false premise this pair of increments produced

Increment 1.78 found that its own reasoning about segregation of duties was wrong, and said so. This one began with a second wrong belief, and it is worth recording because it was wrong in the opposite direction.

The plan said the last-administrator refusal — written in 1.78 and unreachable there — would **finally become reachable**, because `administrators()` counts only *active* administrators, so standing one down can take the count to zero where lowering a rank cannot.

**That does not survive the guard.** The route is `minRank: "admin"`, so the actor is an active administrator; `self_deactivation` means the target is somebody else; and if that somebody else is also an administrator then there are two. The count is never one at that line. The refusal is exactly as unreachable through this route as through 1.78's, for a structurally identical reason, and the test says so rather than driving a path that would refuse on `self_deactivation` and prove nothing.

It is kept for the reason 1.78 kept it, now under two acts rather than one: the state it prevents is the only state in this product that nothing inside it could repair.

- **Tests.** Live (8): somebody outside the practice; an administrator standing themselves down, with the column unmoved; bringing back somebody who never left; the last-administrator refusal on the function where the rule lives, with its first next-step sentence; an administrator stood down once the practice has two, and the refusal returning when it has one again; every live grant ended and every session revoked in one act, **read off the rows**, with the person's conflicts then absent from the SoD report — the assertion the whole design turns on; the account brought back with `endedEntitlements` empty and no grant restored; and a second deactivation refused. Browser (1): the owner stands Nora Newhire down, the row says so, her rank control disappears, the owner's own row offers no standing control at all, and bringing her back says in the practice's own words that the powers did not come back with her.

The live cases also caught two fixtures that would have proved nothing: the new hire holds no entitlements in the seed, so a grant-ending case run against that account would have asserted that zero grants ended; and two event counts were totals that asserted the order the file ran in rather than the act under test.

**Not in Increment 1.79.** Inviting a new person at a rank, which still waits on the business-associate question `docs/05` leaves with the owner. Also out: a reason recorded against a standing change as a required field rather than an optional one; any notice to the person concerned; restoring grants on reactivation, which is refused by design rather than missing; and the JWT that keeps saying "needs enrolment" after enrolment completes.


## Increment 1.68

Increment 1.65 gave a proof a life, and had the round ask for a new code inside its last thirty days so that nothing would stop in silence. It then left a trap nobody had walked into yet: **once the proof lapsed, the round stopped asking. Forever.**

Read that from the person's side. They missed one message — leave, a busy month, a mailbox they read on a phone they replaced. The notices stop. The product never asks again. And the one thing that would tell them to open the screen and fetch a code is the notices, which is precisely what is being withheld.

The signal that would break the silence is the one the silence suppresses. Nothing in the product ever gets them out of it, and nothing ever told anybody it had happened.

## So the round keeps asking, and then stops

- **Monthly, not weekly.** A person who has not answered in a month will not answer faster for being asked more often; past that, asking again is the product talking to itself. The spacing counts from the last code that actually reached the transport, whether it went before the lapse or after — so Increment 1.65's ask inside the window and the asks after it are one unbroken cadence rather than two rules meeting at a cliff.
- **Three times, and the count is the rows.** Sent codes are already append-only, so the allowance is read from them exactly as Increment 1.63 reads its hourly limit. Nothing to reset, nothing to drift, nothing a reader must trust over what happened.
- **Sent, not attempted.** A code the transport refused never reached anybody. Counting it would spend a person's chances on the practice's own outage — retiring an address because the product could not send, which is the reverse of what the rule is for.
- **The last code keeps its month.** The address is let go when the third code's month runs out, not when it leaves: a code answered on its twenty-ninth day is answered.
- **Answering at any point takes it all back.** Nothing here is a punishment. A code brought back is a fresh proof and the notices resume, which is the whole reason for asking again.

## Retirement is derived, and this increment adds no migration

When an address stops being a destination is arithmetic over rows that cannot change — the proof that lapsed and the codes that went unanswered. A column would be a status the rows under it could contradict, and a job that had to remember to run. That is the argument Increment 1.65 made for a proof's life, held again one step further along, and it is why the schema is untouched.

It also means the date does not move. A reader told on day one that the address stops on a given day is told the same day on day eighty-nine, because the projection from the first ask and the answer from the last are the same arithmetic — which the unit cases check against each other rather than against a literal.

## Two states wore one word

"Lapsed" covered both a lapse the product is still working on and one it has given up on. They call for different things from the reader, and one sentence for both tells somebody a code is coming when none is. So `sendNotices` and the screen now say which:

| State | What the reader is told |
|---|---|
| Lapsed, still being chased | when the proof lapsed, how many codes have gone since, that the practice keeps asking monthly, and the day it stops |
| Retired | the day it stopped being a destination, how many codes went unanswered, and that saving an address again resumes everything |

## Why asking again is safe now, and was not before

The worry about mailing an address that has quietly changed hands is that a stranger receives it. Every one of these codes now carries that stranger a one-click way to stop it (Increment 1.67) — which also stops the asking here, because a refused address is refused before a code is minted, and a refusal outranks a lapse on the screen for the same reason.

The increment that gave strangers a way out is what licenses the product to keep trying. Had this been built first, it would have been three more unwanted messages a year to somebody who never asked for the first one.

- **Tests.** Unit (9): an ask owed at once when not one code has gone; the cadence counting from the last code sent, so the window's ask and the ones after it are one rhythm; the asks a month apart with the allowance spent one at a time; the asking stopping when the allowance is spent while the last code keeps its month; the address let go when that month runs out; the end date not moving while the practice keeps asking; the date projected from the first ask matching the one the last ask produces; the rule indifferent to the order the sends are read in; the lookback starting at the reprove window rather than at the lapse. Live (8): the round asking again after a lapse — the regression itself; not asking twice inside a month; asking three times in all; stopping once the allowance is spent and leaving the last code its month; the send saying "lapsed" while it is still asking and naming no end that has not come; the send saying "stopped being a destination" once it is let go, with the count and the date; nothing further sent however many rounds run; and the address taken back the moment somebody answers. Browser: a lapse still being chased, on a mailbox saved fresh because the refused one from Increment 1.67 outranks it.

**Not in Increment 1.68.** Anybody but the person themselves learning that their address retired — the asking is the telling, and it goes to the mailbox, but a practice-wide reading of who has become unreachable would ride beside the weekly digest rather than inside it, for the reason Increment 1.53 established about standing figures and the digest's hash. A per-practice choice of how many times to ask or how long to wait. Retiring an address **nobody ever proved**, which is the practice's own unfinished business and visible on the screen, rather than a proof that decayed. An address for somebody who is not a user. Nor does the product write anything on the person's behalf: `notice_addresses` still refuses a row acted for anybody but its owner, and retirement deliberately avoids needing that rule relaxed — a product that could write a null address for somebody could silence their notices, which is the attack Increment 1.58 exists to prevent.

## Increment 1.67

Increment 1.61 built the proof because a signed-in person can point this product's mail at an address that is not theirs. Increment 1.63 limited how often they may do it, and argued carefully about where the limit belongs. Neither gave the person on the other end anything to do.

Read the message Increment 1.61 shipped from that person's side. A practice they have never heard of has their address, is sending them codes, and the last line of the message tells them to ignore it. Ignoring it stops nothing: the practice may ask again, five times an hour, for as long as it likes. The advice worked for the product and not for the reader.

So this increment gives the reader the one thing this product had never offered anybody outside a practice: **a way to say no, and have it hold.**

## A second secret, with the opposite power

Increment 1.61 refused to put the code in a link, and that refusal stands. A link is a state-changing GET that leaves a bearer secret in a URL a browser keeps, a proxy logs, and a referrer leaks — and that secret **proves** an address.

The stop secret proves nothing. All it can do is withhold. The worst a leaked stop link achieves is that a practice stops mailing one mailbox and says so, on the screen of the person whose mailbox it was — loudly, and where it can be acted on. The argument against a link was never about links; it was about what the thing in the link could do, and these two tokens can do opposite things.

- **The GET shows, the POST acts.** Mail clients, scanners and link previewers fetch a URL before a person reads it, so a link that refused on being fetched would hand every anti-malware appliance a button it presses on its owner's behalf. The page reads; a form on it acts.
- **A server action rather than a route.** The act runs through a server action, so "every route under `/api` passes through `withGuard`" stays true of the whole surface rather than true except here. What authorises it is the secret, rechecked against the rows rather than against what the page was rendered with.
- **The page names the practice and never the mailbox.** A reader holding the message already knows which mailbox; a reader holding only a leaked URL should not learn one.
- **The link carries the practice's id.** Every read in this product runs inside a transaction already told which practice it is for, because the database refuses cross-practice reads and that refusal is the isolation the schema rests on. A stranger's browser arrives with nothing to tell it, so the link has to. The id says which practice to ask; the secret is what the answer depends on. A wrong id with a right secret and a right id with a wrong secret both find nothing, and both are answered in the same words rather than becoming an oracle for which practice a secret belongs to.
- **Thirty days, not twenty-four hours.** A code's window is about a proof resting on evidence somebody acted on promptly. A refusal rests on the message having been unwanted, which does not stop being true while the reader is away. The bound is what it protects rather than taste: a reader still being sent codes is still being handed fresh links, so the only person this ever runs out on is one who was mailed once and is no longer being bothered.

## What the row says, and what it refuses to say

| Decision | Why |
|---|---|
| **Names a mailbox, not a person** | Every other row in this schema names a user of the practice. The person who refuses has no account, will never have one, and is not the person the practice typed the address for. What they are entitled to say is "this mailbox did not ask" |
| **Keyed to the address text**, not the address row | A refusal tied to the row would be escaped exactly as Increment 1.63's per-row limit would have been: change one character back and forth, and every new row is a fresh start |
| **One practice, not the product** | A cross-practice list would be the only table here outside the isolation every other table has, and it would let one practice's reader learn that another mails the same mailbox. What the stranger holds is an unwanted message from one named practice |
| **Folding happens in `lower()`, once** | Two implementations of one case fold are two answers waiting to disagree, and the disagreement would reach the screen as a database error where a sentence had been promised. The application compares through the same expression the trigger does |
| **No acting-user rule** | Every other table in this group refuses a transaction with no `app.user_id`. Nobody signs in to refuse one. A trigger asserting something about the session here would assert a proxy for the rule rather than the rule, so the triggers assert what the database can actually check: that the refusal names the mailbox the message reached |

**A refusal outranks a proof that still stands** — on the screen and in `sendNotices` alike. A mailbox can change hands, and the person reading it now is the person entitled to say so; that is the same reason a proof lapses (Increment 1.65), met at the moment somebody says it out loud rather than at the end of a year. It also outranks the `already_proved` refusal in `sendProofCode`, which is an ordering worth testing: a refusal checked after the proof would answer "already proved", which is true and useless.

**It bites where the row is written.** A trigger refuses a new `notice_addresses` row naming a refused mailbox, so the practice cannot keep a destination on file that nothing will ever send to. `setAddress` says the same thing in words first, because a trigger firing reaches a screen as a broken page and the person typing is owed a sentence they can act on.

**It is not undone.** The only evidence that could authorise lifting a refusal is a code sent to that mailbox, and a refused mailbox is one this practice may no longer send a code to. The deadlock is the guarantee: an undo authorised by the practice would be an undo authorised by exactly the party the refusal protects against. What the practice keeps is the other mailbox — a person whose address was refused saves a different one and proves it, so the product loses a destination rather than a person.

## A defect this increment's browser suite found

The server action first shipped exporting its initial state object beside itself. A `"use server"` file may export nothing but async functions.

`tsc` passed. `next build` passed and emitted the route. The page answered **500 on its first load**, and only a browser found it. The state moved to `stopFormState.ts`, which is exactly why `loginFormState.ts` sits beside `loginAction.ts` — a precedent this increment had to rediscover, and has now written down.

## A second defect, found by CI rather than by this build

The first push of this increment turned `packages` red on a case this arc shipped in Increment 1.60, which had passed locally three times running: two attempts at one send came back in the wrong order.

The cause was not in the notices module. **`uuidv7` filled its random bits with nothing but randomness**, so two ids minted inside one millisecond ordered at random — and a 10,000-pair check written to confirm it put the pair the wrong way round **4,888 times**. Every read in this product that asks for the latest row breaks its tie on the id, so this was a coin toss wherever two rows shared a millisecond.

That is a product defect and not a test one. `lastSend` orders by `(attempted_at, id)`: a failed attempt and the success that followed it can land in the same millisecond, and the screen would then report a send that worked as a send that failed — the exact silent wrongness this arc exists to remove.

- **The fix is where the rule belongs.** RFC 9562 reserves twelve bits (`rand_a`) for a monotonic counter: seeded randomly when the millisecond changes, incremented while it repeats. Consecutive ids sharing a millisecond are now ordered by the id alone. Two limits are stated rather than papered over — the counter lives in one process, and a caller stamping an earlier millisecond reseeds, because that id belongs in that earlier range.
- **This codebase already held the rule and had applied it only to queries.** Increment 1.61 fixed an unordered `LIMIT 1` for being a coin toss. The tiebreak those ordered queries fall back on was the same coin toss, one level down.
- **The case now asserts the rule rather than the clock.** Both attempts are pinned to one stamp, so the read exercises the tiebreak on every run instead of whenever two inserts happen to share a millisecond. Pinning it surfaced a second fragility in the same case: the stamp is taken from the clock rather than written as a literal, because the rows are read back in time order and sliced from what the case added, so a stamp older than the rows already there would sort the pair in front of them.

- **Tests.** Unit: a reference reads back exactly what it was packed from; a malformed one is refused before the practice id in it is set as a transaction's own; the whitespace a mail client wraps a URL in is tolerated; one path segment whatever the origin's punctuation; the link's life is derived from the message's own stamp and outlives the code. Live: the message carries a link and the database keeps only its hash; the address is proved first, so what stops later is a proof rather than an absence; an unknown secret and one aimed at another practice answer in the same words; a link past its life refuses and writes nothing; the refusal names the mailbox and nobody at all, with a chain event carrying no mailbox and no actor; the notices stop although the proof still stands; no further code may be sent and the refusal is the reason given rather than the proof; a code minted before the refusal no longer proves; the same mailbox typed again in a different case is refused in words, with the database as the backstop; a different mailbox saves; a second press is settled rather than a second row; a refusal naming a mailbox the message never reached is refused; update and delete are refused. Identifiers: the millisecond, version and variant a uuid carries; a thousand ids minted inside one millisecond coming back sorted and distinct; ordering across milliseconds; an earlier millisecond landing back in its own range; the remaining bits still random. Browser: the stranger's page with the cookies cleared, naming the practice and never the mailbox, the button, the settled state, the link reopened and answered as settled, the practice reading it on its own screen, and typing the mailbox again refused in words.

**Not in Increment 1.67.** A refusal that reaches beyond one practice, which is the boundary argued above rather than an omission. Any way to lift one. Retiring an address nobody re-proves, which is the remaining hole in the address arc. Per-practice settings for whether the accountant is told or how long a proof stands. An address for somebody who is not a user. Nor does the product attempt to tell a refused mailbox that it worked: a confirmation message to an address whose reader just said "send me nothing" would be the product answering back, which is the behaviour this increment exists to stop.

## Increment 1.66

The outside accountant's seat reaches the month-end package and nothing else (Increment 1.49). Until now it learned that a month had closed only by signing in to look.

The practice closes a month. The person whose whole work begins at that moment is not told. That is the same gap the notices arc has been closing since Increment 1.57, met at the one place where the reader is not a member of the practice at all.

## What the message carries, and the line it draws

The month, the package **fingerprint** and the shape it was taken under, how many entries the month held, and whether each tie-out holds. **No money.**

That line is not the digest's line repeated for its own sake, and it needed arguing rather than assuming. The package **is** money: it exists to carry the practice's figures to their accountant, and that accountant may already export the whole thing as CSV or JSON. So why withhold the figures from a message to exactly the person entitled to them?

Because an export is **the accountant taking the figures while signed in**, and a message is **the product pushing them into a mailbox** it has only proved reaches somebody. Those are different acts with different blast radii. A month of revenue is the single most commercially sensitive number this product holds, and a link costs nothing.

- **The fingerprint is the reason to send anything at all.** A hash travelling by a different channel from the artefact it describes is the oldest integrity check there is: the accountant can compare what they later download against what was closed, and catch a package that moved in between without having to trust the channel it arrived on. Sending it is strictly more useful than not, and it reveals nothing — a hash of figures is not the figures.
- **It names nobody**, not even who closed the month. The close row carries that and the screen shows it; a message that leaves the product says the practice did it, for the same reason the digest counts without naming.
- **A failing tie-out is named; its detail is not.** The label says which check did not hold, which is what a reader needs in order to expect trouble. The detail carries figures, so it stays behind the guard.
- **Once per close**, answered by the message itself as the digest's is: the last package message that reached this person is older than the close now being reported, or there has not been one. No column records which month was told, because a close has a time and a message has a time.
- **The accountant's seat only.** The practice's own people read a close on the screen they already open.
- Migration 0049 widens `notice_sends.kind` to four and gives `notice_rounds` a third axis beside the sum that must add up — the same treatment, and the same reason, the digest got in Increment 1.64.

## A defect this increment found in the round

Building the package branch surfaced a real bug in code shipped two increments ago.

The round's loop **left outright** when a seat owed nothing — and that `continue` silently took the digest and the package with it. Owing nothing is the **ordinary** case for both: an accountant owes nothing most of the time, and so does a practice that is keeping up. So an owner who owed nothing had been getting no weekly digest since Increment 1.64, which is precisely the state in which a digest is most reassuring and least likely to be missed.

A decision about the notices now ends only the notices. The accountant case is the regression: that seat owes nothing, and the round must still reach it.

- **Tests.** Unit: the subject names the month and nothing else; the body carries the fingerprint and the schema and tells the reader to compare them; no money and no figure anywhere in it; how many tie-outs hold, with only the failing ones named and their detail withheld; nobody named, not even who closed. Live: the accountant told once with the fingerprint and no money, on a round where they owe nothing — which is the regression above; nobody else told; two further rounds telling them nothing; the next month's close telling them again.

**Not in Increment 1.66.** The package attached rather than linked, which is the whole question this increment answered "no" to and would need a different answer about what may leave. A per-practice choice of whether the accountant is told. The figures in the message for a practice that asks for them, which is a decision worth having a governed act for rather than a setting. A way for a stranger to stop a code they did not ask for, retiring an address nobody re-proves, and an address for somebody who is not a user, all still.

## Increment 1.65

Increment 1.61 stopped a message going to a mailbox nobody had confirmed. It did not stop one going to a mailbox that **used to be** confirmed, because a proof was forever.

A person leaves. A provider changes. A shared inbox is reassigned. The address stays proved, the notices keep arriving where nobody reads them — and that is the same silent success as a typo, merely delayed by however long the practice has existed.

- **A proof stands for a year.** That is a decision about the practice rather than about the code, and it is the product's default rather than a law: long enough that nobody is nagged, short enough that a mailbox nobody holds any more is caught within a plausible turn of staff.
- **Derived, never stored.** `notice_address_proofs` already dates every proof and never changes one, so when a proof lapses is arithmetic on a row that cannot drift. No expiry column to keep in step with the row beside it, and no job that has to remember to run.
- **Four states, not a boolean, and `expiring` is the point.** A product that knew only proved-or-not would have nothing to say until the day it stopped sending — and stopping without warning is exactly the silence this arc refuses. So the round asks for a new code inside the last thirty days, once per window, answered the same way the digest's is.
- **A lapsed proof refuses exactly as a never-proved one does.** No new outcome: an address nobody has confirmed in a year is not a destination, which is the rule 1.61 already wrote. What differs is only the reason, because "nobody ever said" and "nobody has said lately" call for different things from the reader.

## Two rules that turned out to be in the wrong place

- **Single use belongs to the code.** Increment 1.61 made a code single-use with a unique index on `address_id`. That worked while a proof was forever; the moment a proof can lapse, "one proof per address" stops meaning "a code is used once" and starts meaning **an address can never be proved twice** — which would leave a person with a lapsed proof no way back except to retype their address into a new row and lie about when they chose it. Migration 0047 moves the index onto the challenge, which is the thing the guarantee was always about.
- **The own-user rule was about proving, not about asking.** The round acts for nobody, so `app.user_id` is empty, and Increment 1.61's trigger refused that outright. Borrowing somebody's identity so the round could send them a code would put a lie in the one column the rule is enforced against. Migration 0048 splits it: a **proof** stays strict and must be written by the person it names, while a **challenge** may also be written with no acting user at all, which is the product acting for itself. That is safe because of what a challenge is — it sends a code to the address already on file, confers nothing, and reaches nobody the person did not choose — and because every route in this product runs under a guard with a real user, so "no acting user" is reachable only from a job the practice runs. The limit on asking (Increment 1.63) does not bind the round for the same reason: that limit exists because a person can type a stranger's address, and the round only ever writes to an address this person already proved.

## A defect the increment went looking for and found next door

The round read `users` and never checked `active`. **A person who had left the practice kept receiving its notices**, at an address nobody had revisited — the same silent delivery the proof exists to prevent, and worse, because the product knew they had gone. They are now skipped entirely, and not counted as unreachable: that count is about people a round could not reach, and this is a person it must not reach.

- **Three more tests that first passed for the wrong reason**, all the same family this arc keeps meeting. The new life cases were pinned at dates in the *future*, and Increment 1.63's ask limit counts challenges issued "within the last hour" — which a future-dated row satisfies, so they silently spent the ask-limit cases' allowance and refused them for an unrelated reason. The foreign-key case began picking codes that the new re-proving had already redeemed, so the single-use index fired before the key it names. And the round's lapse cases first sat where an earlier case leaves the owner withdrawn, with no address to lapse at all. Each was moved rather than patched.
- **Tests.** Unit: nothing proved; a year's standing; the window opening thirty days out and not on the day it stops; lapsed on the day rather than the day after. Live: a code refused while the proof stands comfortably, naming the day it lapses; one sent inside the last thirty days; the address proved again on the new code with two proofs on one address and the newest standing; the round asking inside the window and only once; the notices stopping after the lapse with the reason naming it; a deactivated person considered not at all; and, past the service, a code redeemed once. Browser: the screen says when the proof needs giving again rather than waiting for the day it stops.

**Not in Increment 1.65.** A per-practice choice of how long a proof stands — one number in one place, and nobody has yet found it wrong. Re-proving prompted from the screen rather than only by the round, which would be a second path to the same act. Retiring an address nobody re-proves, which is the practice's decision rather than the product's. The month-end package delivered, a way for a stranger to stop a code they did not ask for, and an address for somebody who is not a user, all still.

## Increment 1.64

"A digest across several notices" sat on three Not-in lists. The first honest question was whether it is a new thing at all — and it is not.

**Increment 1.28 already built the digest.** Seven days of the practice's counts, computed from rows, stamped once by the owner. It is already weekly and already the practice's retrospective. What was missing was never the digest; it was that reading it required somebody to remember to look, which is the gap this whole arc exists to close. So this increment carries that digest out. It does not compute a second one.

- **It is safe to send for a property the product already proved.** Every count in the digest is practice-wide, because the queries carry no person dimension — settled in Increment 1.28 for an unrelated reason (the owner stamps a hash of exactly those figures, and a figure about one person would make the stamp mean something else), and exactly what Increment 1.58 demands of anything that leaves. A rule built for one purpose turning out to discharge another is the nicest thing that happens in a codebase with rules.
- **Counts, and no money.** The digest screen shows amounts beside some counts. An amount in an inbox is the one number a person who should not have it would find worth reading, and counts already say whether a week needs attention — which is all a message has to do. The screen keeps the rest, behind the guard.
- **A different sending rule, because it answers a different question.** Notices ask "has anything changed?"; a digest asks "has a week passed?". The digest's counts move every day, so the change-or-stale rule from Increment 1.62 would turn it into a **daily** message — precisely the noise that rule exists to prevent. One digest per completed week per person instead.
- **A fixed week, ending Sunday.** A rolling seven days would name a different week on Monday than on Tuesday, and a subject that changed daily would be a new message daily. Sunday is the boundary a practice can say out loud.
- **"Once" is answered by the message itself.** The last digest that reached this person is older than the week now being reported, or there has not been one. No column records which week was sent, because a digest is only ever sent after its week has ended — so the timestamp already says which week it was.
- **The owner seat only.** The outside accountant's seat reaches the month-end package and nothing else (Increment 1.49); a weekly operations summary is not theirs to receive.
- **Reading it is not stamping it**, and the message says so in those words. The acknowledgment stays an act on the digest screen. A message that implied otherwise would quietly retire a control by making a person feel they had discharged it.
- **A kind on the row, rather than a fact inferred from a count.** Increment 1.61 distinguished the proof code by `notice_count = 0`, which was true — nothing owed writes no row — and was still a reader inferring one fact from the absence of another. Three kinds told apart by arithmetic is a table nobody reads the same way twice. Migration 0046 says it instead, and adds a check holding the old rule from both sides: only a code carries no notices, and a code always does.
- **Backfilled rather than grandfathered, and the contrast is the point.** Increment 1.60 added `failure_kind` under a NOT VALID check precisely because the fact was unknowable for earlier rows, and filling one in would have invented somebody's past. Here the fact *is* knowable, from a rule the database itself enforced, so reading it back out is recovering a fact rather than guessing one. **Backfill when the fact is derivable; grandfather when it is not** — the two migrations differ because the evidence differs, not because the style did.
- **The digest is counted beside the sum, never inside it.** `considered = sent + failed + unchanged + nothing_owed + unreachable` says every person the round looked at became exactly one **notices** outcome. A digest is a second message to the same person, so folding it into that sum would make the invariant say nothing about anything. `notice_rounds` gains two columns outside the constraint, backfilled to zero — which is what happened, since there were no digests to send.
- **A defect in the first draft of the tests, of the same family as the last three.** The digest cases asserted absolute row counts, and the rounds in the cases above had each already sent their own week's digest. They now measure what this round added. An absolute count there was asserting the suite's history rather than the rule.
- **Tests.** Live: the week boundary on a Monday, a Thursday, a Sunday and the Monday after, including that on a Sunday the week that ended is the one before rather than the one in progress; the digest sent with the week in its subject, no person named, no money anywhere in it; the sentence saying that reading is not stamping, with the acknowledgment table untouched; two further rounds the same week sending nothing; another week ending and a second digest going; and the round's own row still satisfying the invariant the digest sits outside. Plus, across the older suites, every raw insert and every reader moved from inferring the kind to naming it.

**Not in Increment 1.64.** A per-practice choice of which day the week ends, or whether to receive the digest at all — one number in one place, and nobody has yet found it wrong. The month-end package delivered, which is a larger question because it is the accountant's and it is hash-stamped. A digest that names what changed since the last one rather than what the week held, which would need the previous digest's figures and is a different product. A way for a stranger to stop a code they did not ask for, re-proving an address on a schedule, and an address for somebody who is not a user, all still.

## Increment 1.63

Increment 1.61 left "a throttle on guessing a proof code" as work to come. Building it was the obvious next step, and it is the wrong one.

**A guessing throttle here protects nothing.** The lookup is scoped to the caller's own rows, so a code issued to somebody else does not match. The only address anybody can prove is their own. And a person who wants their own address proved does not need to guess — they can press the button and be sent a code. Guessing buys nobody anything they cannot have for the asking, and a limit on it would be a thing that looks like protection, which this product has refused to ship since the transport with no default.

**The real abuse is the other half.** A signed-in person can point this product's mail at **somebody else's address** by typing it, and press the button again and again. The thing worth limiting is not how often somebody can answer, but how often the product can be made to send.

- **Five asks an hour, per person.** Not per address row: a per-row limit is escaped by changing one character, which writes a new row and hands the asker a fresh allowance — and typing a slightly different stranger's address is exactly the move being limited.
- **The rows are the count.** Every ask is already an append-only challenge with its own `issued_at`, so the limit is a `count` over those rows. No counter, nothing to reset, nothing that can drift from what actually happened. This is why the increment does **not** reuse `auth_throttle`: its mutable `fail_count` earns its keep against unauthenticated sign-in traffic, which must not be allowed to write a row per attempt, but here it would be precisely the status column the rest of this codebase refuses.
- **The refusal names a time.** "You may ask again after 10:00 UTC", computed from when the oldest of the five leaves the window — rather than "try again later", which leaves a person to guess and to keep pressing.
- **A refused ask writes nothing.** The limit is checked before a code is minted or a row written, so a refusal does not itself spend part of the next window. A throttle that charged for being throttled would tighten under exactly the pressure it exists to absorb.
- **409, like every other state refusal here.** Nothing is missing and nothing is malformed; what refuses is the practice's state. It also keeps a 404 from an API route meaning the one thing it should mean, which the browser harness depends on.
- **The screen says it.** One clause in the proof form, where a person about to press the button reads it, rather than in a document they will not open.
- **A defect in the first draft of the tests.** The new cases sat after a case that leaves a **proved** address — and an already-proved address refuses an ask before the limit is ever consulted, so all four passed on a refusal that had nothing to do with the rule they named. They now set a fresh unproved address first, which puts the limit back in the path. This is the third time in this arc a case has been caught proving something other than its own name; it is worth saying that the tell each time was a refusal arriving for a plausible but different reason.
- **Tests.** Live: the first five within the hour all send; the sixth refuses, names the hour it frees up, and writes no challenge row; a changed address does not hand out a fresh allowance; and the window opens again once the oldest ask has left it, checked both through `nextAskAllowedAt` at a minute either side of the boundary and through a real ask that then succeeds. Browser: the limit is on the screen beside the button it governs.

**Not in Increment 1.63.** A way for the stranger to stop it, which needs an address belonging to somebody who is not a user — five messages an hour is bounded and the message tells an unexpecting reader to ignore it, but bounded is not zero. A limit on how often one *address* may be written to across different people, which would need reading other people's address rows and is a worse trade than it sounds. A practice-wide ceiling. And a digest across several notices, re-proving an address on a schedule, and an address for somebody who is not a user, all still.

## Increment 1.62

Everything the notices arc has built so far waits to be asked. That is backwards. A notice exists to reach a person who is **not** looking, and a product that tells you things only when you open it has told you nothing you could not have found yourself.

Two questions were deferred to this increment. Only one of them turned out to be a question.

- **"Since you last read" dissolves rather than resolves.** What a seat owes is derived on every read (Increment 1.57): it is a state, not a feed. A message does not need to know what somebody has seen — it needs to say what is true now. Nothing records a read because nothing needs to.
- **What is real is repetition.** The same three sentences every morning is noise, noise gets filtered, and a filtered signal is not a signal. So a round sends only where the message **would read differently from the last one that actually reached that person**. Body against body: two identical bodies say the same thing, and comparing what was actually sent is one fewer thing that can drift than comparing a digest kept beside it.
- **Staleness is the other half, and it is not optional.** Change alone would mean a debt nobody acts on is mentioned once and then never again — and silence reads as "nothing owed", so the thing most in need of attention would become the quietest thing on the list. A message that still stands goes again each week.
- **Running it twice changes nothing.** Idempotence falls out of that rule rather than out of a lock: a second round a minute later finds every message unchanged and sends none. So the schedule itself may be wrong — early, late, doubled by two workers — without a person being told twice, which is what lets a practice schedule this with whatever it has rather than needing something exact. That mattered concretely here: this repository's two existing crons have never passed for want of secrets, so a design that needed an exact scheduler would have shipped untested.
- **A failure is not "told".** The comparison reads the last send that actually left, so a message the transport refused does not suppress the next round's attempt. Increment 1.59 made a failure visible; this keeps it from also being silencing.
- **Somebody who withdrew is not considered at all.** They decided that. Counting them among the people a round could not reach would file a decision as a failure.
- **Every round writes a row, including the quiet ones.** This is the one place this codebase writes a row saying nothing happened, and the exception is the point of the increment: a round that wrote nothing when it had nothing to do would make **a scheduler that died indistinguishable from a practice that owes nothing**, and telling those two apart is the entire job. A check constraint refuses counts that do not account for everybody considered, so a round cannot report a shape that never happened, and the Practice Risk page says when the sender last ran.
- **The chain names nobody.** A round acts for no person, so its event carries a null actor. The column always admitted one; only `appendControlEvent`'s signature did not, which had been pushing background work into either borrowing an actor or writing no event at all. The nightly snapshot job takes the same shape and is the model this one follows: tenants listed on the administrator connection, each round run on the runtime connection with that tenant bound, one practice's failure never stopping the rest.
- **A defect in the first draft of a test, worth recording.** The case meant to prove that a failed send does not count as having told somebody put the failure a day after a successful send — where the round would not have attempted anything at all, so nothing could fail and the case proved nothing. Moved to a week later, it now isolates exactly the rule it names: the round after the failure sends, because the last message that actually reached this person is still eight days old.
- **Tests.** Unit: never told, says something different, says exactly what it said, gone stale at exactly a week and not a moment before, a caller's own interval, and a second round in the same minute. Live: a round runs and leaves a row before anybody has an address; an unproved address counted unreachable rather than sent to; a send once it is proved; silence the next day with no row written; two more rounds in the same minute writing no sends but three round rows; the weekly repeat; a failure that does not silence the round after it; a withdrawal left out of the count entirely; the chain event with a null actor and no address in it; and, past the service, counts that do not add up, an edit and a delete. Browser: the delivery section says plainly that nothing sends these on a schedule yet.

**Not in Increment 1.62.** The schedule itself, deliberately: the product owes a correct, idempotent round, and *when* to call it is the deployment's — a cron, a platform timer, a container that wakes hourly. A per-practice choice of how often, or of a quiet hour; the week is one number in one place and nobody has yet found it wrong. A digest across several notices rather than the state now. A throttle on guessing a proof code, which belongs with `auth_throttle`. Re-proving an address on a schedule. And an address for somebody who is not a user, still.

## Increment 1.61

Increment 1.58 stopped one person redirecting another's notices: the database refuses an address row naming anybody but the caller. It did not stop a person redirecting their own into a typo, and the typo is the likelier accident.

And this is the case Increment 1.59's guarantee cannot reach. `riley@ridgeveiw.example` passes every shape check there is, and a message it goes to **does not fail** — it is accepted by whoever does own that mailbox. It succeeds, silently, which is the one outcome this whole arc exists to prevent. So the product stops taking the practice's word for it: a code goes to the address, the person brings it back, and the coming back is the proof.

- **A code, not a link.** A link is a state-changing GET, and it puts a bearer secret in a URL that a browser keeps, a proxy logs, and a referrer leaks. A code carried from the inbox to a screen the person is already signed into proves both halves at once — the token proves who can open the mailbox, the session proves who is asking — and neither proof is written anywhere a third party sees. The alphabet drops I, L, O, 0 and 1, because a code is read off one screen and typed into another, and a person who mistakes O for 0 is told their code was wrong when it was the alphabet that was wrong.
- **Proved, not verified.** `packages/verifier` verifies the hash chain, which is a different thing entirely. One word for two concepts is how a reader ends up believing a claim nobody made.
- **Two tables, because a secret and a fact are not the same thing.** A challenge holds a secret and expires; a proof holds neither — it is true forever after and there is nothing in it worth keeping from anybody. One table would give the fact the secret's lifetime and the secret the fact's permanence, and both are wrong. The code is stored as a SHA-256: what the database keeps recognises the right code and cannot produce one.
- **The proof names the address row, not the person.** `notice_addresses` is append-only and newest-row-wins, so changing an address writes a new row with a new id, which no proof points at. A person who changes their address is unproved again **by construction** — no flag to clear, no code left stale, nothing to remember. This codebase's rule is that a signal which never clears is not a signal; this is the first time that rule is met with no clearing to do at all.
- **An unproved address is nowhere to send, not a fourth outcome.** `unreachable` already means "something was owed and there was no usable destination", and an address nobody has proved is not one. So it joins nobody-said-where and you-withdrew, the reason says what would change it, and `notice_sends` keeps exactly the three outcomes Increment 1.59 gave it.
- **The code's own message is a send like any other.** It goes through the same transport, the same three-attempt rule, and the same row per attempt, so a code that could not be delivered is as visible as any other failure — which matters more here than anywhere, because a person waiting for a code that never left would conclude either that the product is broken or, worse, that their address works. Its row carries `notice_count = 0`, and that names it uniquely rather than standing in for something: a send of no notices never happens, since nothing owed writes no row at all.
- **The code stays out of the subject and off the chain.** Increment 1.58 settled that a subject is the part a person sees without choosing to look, so a code there would make the proof measure who can see the phone rather than who can open the mailbox. The chain records that a code was sent and that an address was proved, and neither event carries the code or the address.
- **The database holds the rules, not the service.** One proof per address, which is what makes a code single-use. A composite foreign key so a proof answers a code issued for that same address, and another so the address belongs to that same person. A trigger refusing a proof stamped after its code expired, reading the proof's own stamp rather than the clock so that it says what it means and stays true for a caller that supplies the time. And the same own-user trigger `notice_addresses` carries, for the same reason: this is the act whose whole risk is being done on somebody else's behalf.
- **One copy of the attempt loop.** Both the notices a seat owes and the code that proves an address now reach a person through `deliverMessage`, so the retry rule, the row per attempt, and the stamp on each attempt are written once. A second copy would be a second rule, and the two would drift the first time one was changed.
- **A defect the test suite caught in its own fixtures.** Four database cases passed for the wrong reason: without an acting user the own-user trigger refuses first, before Postgres evaluates any check constraint, so each case asserted that rule again rather than the one it named. They now set an acting user, and the rule they were accidentally proving gets a case of its own.
- **Tests.** Unit: the alphabet avoids the characters a person reads wrong, two hundred codes are all distinct and ten long, a code is read back through the punctuation and case a person typed, the digest cannot be read back as the code, the subject does not carry it, and the message says how long it lasts and what to do if you were not expecting it. Live: notices refused to an unproved address with a reason naming what would change it and no attempt counted; the code sent and only its hash kept; the code's message recorded as the one send that carried no notices; a misshapen code and a code nobody issued both refused with nothing written; a code brought back after its window refused; the real code taken back, typed as a person types it, the proof recorded and the notices then going; a second proof and a second code both refused; an address changed and unproved with no flag to clear; and, past the service, one proof per address, a proof answering another address's code, a proof stamped after expiry, a code expiring before it is issued, a code stored in the clear, an edit and a delete on both tables, and a row acted for somebody else. Browser: the owner saves an address, is told nobody has proved it, asks for a code, is refused a code nobody sent, reads the real one out of the row the product wrote, proves the address, and watches the notices go.

**Not in Increment 1.61.** A throttle on guessing: the lookup is scoped to the caller's own rows, so a code issued to somebody else does not match rather than matching and being refused, and there is no cross-person guess to make — but a person could still grind at their own codes, and `auth_throttle` is where that would belong. Re-proving an address on a schedule, since a mailbox somebody loses access to stays proved; that needs a rule about how long a proof is good for, which is a decision about the practice rather than about the code. An address for somebody who is not a user, still. A digest across several notices. And a schedule, still, for the reason Increment 1.59 gave: it needs a definition of "since you last read" when nothing records a read.

## Increment 1.60

Increment 1.59 made a failed send visible. It did not make one actionable. Every refusal read alike, so an owner facing a provider that was unavailable for a second and an owner facing an address that does not exist were told the same thing and offered the same non-choice. One of them should ask again; the other never should.

- **Only the transport can know whether a refusal could pass, so the transport says.** The caller sees an error string, and no amount of reading it tells a busy provider from an address that was never real. `Delivery` therefore carries a kind: `transient` where the provider was unavailable, busy, or timed out, and `permanent` where the address does not exist, the provider rejected the message itself, or the deployment has no transport at all.
- **An unconfigured practice is a permanent refusal, by the plain meaning of the word.** No number of retries configures a transport. Calling it transient would spend a waiting person's time on an outcome nobody can reach by waiting, which is the same disservice as a message that vanishes quietly — the thing Increment 1.59 exists to prevent — wearing the opposite costume.
- **The rule is three attempts, and the number is derived rather than declared.** `PAUSES_MS = [500, 1_500]` holds the whole of it: wait half a second before a second attempt, a second and a half before a third, and stop. The attempt limit is `PAUSES_MS.length + 1`, so the count and the pauses cannot fall out of step. A permanent refusal ends the act at the first attempt.
- **The retrying leaves rows, not a counter.** Every attempt writes its own row before the next begins. How many times the practice tried is answered by counting rows; a tries-so-far number beside them would be a status the rows under it could contradict, which is the shape this codebase has refused since the owner board's counts — and it is exactly the queue this increment was warned not to become. Each attempt stamps its own moment, because attempts inside one act are seconds apart and a column called `attempted_at` should say when the attempt was.
- **One chain event per act, not per attempt.** A person asked to be sent their notices once. The event names the seat, the outcome, the notice count, and how many attempts it took; the attempts themselves are in the table for whoever wants them. The address and the body stay off the chain, as they have since 1.59, because the chain is read by people who may govern this practice without being this person.
- **The migration invents nothing about the past.** Migration 0043 adds `failure_kind` under three checks: two kinds and no third, a kind only on a failure, and that every failure says which kind it was. The last is added **NOT VALID** on purpose. A failure recorded before this migration genuinely does not know its kind; filling one in would invent a fact about somebody's past attempt, and guessing `permanent` would tell a reader not to try again on evidence nobody ever had. Postgres skips the scan of existing rows and enforces the check on every insert after it, which is precisely the honest shape — old rows keep a null and read exactly as they read under 1.59, and every later failure must say.
- **The sentence tells the reader what to do, and is true of the row alone.** A transient failure reads "That kind of refusal can pass, so asking again later may get through"; a permanent one reads "That kind of refusal will not pass, so asking again would fail the same way; something has to change first." The clause reads the kind, never how many attempts surrounded it, so it holds for any row in any position — including a failure that a later attempt recovered from, which stays on the record rather than being erased by the success after it.
- **The screen states the standing rule beside the outcome it governs.** A reader deciding whether to press the button again deserves to know what pressing it already did, on the screen rather than in a document; and the act just performed reports its own attempt count, which is the one place that number is a fact about something the reader watched happen rather than a stored figure.
- **`flakyTransport` exists, and no configuration can reach it.** A rule about a provider that comes back cannot be proved without a provider that comes back, so the port ships one that refuses transiently a stated number of times and then succeeds — for the same reason `memoryTransport` ships. `transportFromEnv` never returns it, and a unit case walks the plausible settings to assert that a deployment cannot be handed a transport that refuses on purpose.
- **A smaller correction.** The attempt counters on the test transports live in closures rather than on `this`. A transport handed around as a bare function would otherwise stop counting silently, and a count that can silently stop is worse than no count — the same lesson the browser harness learned when `titleAtRest` had to stop depending on its receiver.
- **Tests.** Unit: an unconfigured deployment refuses permanently and names the setting; no setting yields a test transport; a refusal carries its own words and its kind; a counter keeps counting when its method is called bare; the flaky transport comes back after a stated number of refusals; and each sentence, including the one a pre-1.60 failure still reads, which advises nothing. Live: a transient refusal that clears on the second attempt leaves `failed` then `sent` and reports two attempts, with the failure not erased by the success; a refusal that never clears stops at three attempts and three rows; a permanent refusal is tried exactly once and the transport's own counter proves it; the chain carries one event per act with the attempt counts; and, past the service, the database refuses a failure with no kind, a third kind, and a kind on a send that worked — each case supplying the other fields so it breaks one rule and no other, since Postgres names whichever constraint it checks first and a case satisfiable by either asserts neither. Browser: the standing rule is on the delivery section where a reader deciding whether to press again will meet it.

**Not in Increment 1.60.** A retry that outlives the request — the bounce that arrives hours later, or a provider down for an afternoon — which needs durable work the product picks up again and is therefore the queue this increment deliberately is not; the design it would take is a separate decision, not an extension of this one. A backoff the practice can configure, which is a setting nobody has asked for over a rule nobody has yet found wrong. A per-transport judgment of which provider errors are transient, which arrives with the first real provider and is that provider's knowledge rather than this module's. A schedule, still, for the reason Increment 1.59 gave: it needs a definition of "since you last read" when nothing records a read. A digest across several notices. An address for somebody who is not a user. And verifying that an address belongs to the person who typed it, which now has both a send to verify with and a way to tell a bounce that will not pass from one that might.

## Increment 1.59

Increment 1.58 built the message and recorded where it would go, and sent nothing. This sends. The interesting half is not the sending — it is what the product does when it cannot, because that is where a delivery system either keeps faith with its reader or quietly stops being one.

- **A failed send is visible, or the whole thing is worse than useless.** A bounce, a provider that refuses, a transport nobody configured: each is a signal that did not arrive, about a practice that owed something. A product that swallowed one would be worse than a product that never sent at all, because its owner would believe they had been told. So every attempt writes a row, and the row saying what failed is the point of the table rather than an exception to it.
- **A port, and deliberately no provider yet.** Writing an SMTP client against no server would be untested code that looks like working code, and picking a vendor is the practice's decision rather than this increment's. What the increment owes is the shape: one call, two outcomes, and a refusal in words a person can act on.
- **There is no default transport, on purpose.** A practice that has configured nothing gets one that refuses, naming the setting that would change it. That is the rule the increment turns on, applied to itself: the product says plainly that it cannot send rather than appearing to work.
- **Three outcomes, and the database refuses a fourth.** `sent`, `failed` with the transport's own words, and `unreachable` — something was owed and there was nowhere to send it, because nobody gave an address or the person withdrew. That third one is neither an error nor nothing, and giving it a name is what stops it being filed as either. Check constraints hold each shape: a failure that does not say what failed is refused, a send claiming to have gone nowhere or said nothing is refused, an unreachable row carries no address and says why.
- **Nothing owed writes no row.** Not an act, and a table of rows recording that nothing happened is a table nobody can read. "We checked and there was nothing" is already on the screen, where a reader went looking.
- **The body is kept, not hashed.** "What did they actually receive" is the question an audit asks, and the body cannot be re-derived later because it is built from rows that move. It is safe to keep for the reason Increment 1.58 settled — the renderer cannot read a person's typed words — and a live case asserts that at rest, on the row that outlives the request, rather than only at the type level.
- **The address is copied onto the row.** `notice_addresses` is append-only precisely so that "what address was on file that day" survives; copying it here answers the same question without a join through time, and it is the address this message actually went to rather than the one in force now.
- **The notices are passed in, not re-read.** The list a person saw on the screen is the list that goes out. A second reading could differ from the one they were looking at, and a message that disagrees with the screen it came from is worse than no message.
- **On demand rather than on a schedule.** A schedule needs a decision about what "since you last read" means when nothing records a read, and a cron the practice can trust. Asking for it answers the question somebody actually has before relying on any of this — does delivery work for me — and it is the act Increment 1.58's screen already sets up.
- **A defect the build caught and the typechecker did not.** The Practice Risk page is a client component, and importing `sendSentence` from the module that writes rows dragged `pg` into the browser bundle. `tsc` said nothing; `next build` refused with `Can't resolve 'tls'`. The outcome shape and its sentence now live in a pure `sendOutcome.ts` that both sides may have, which is the same split `message.ts` already keeps and the same rule this codebase learned in Increment 1.52.
- **Tests.** Unit: an unconfigured deployment refuses and names the setting; an unrecognised setting refuses rather than guessing; the memory transport holds what it was given and reaches no network; and each outcome's sentence, with the failure saying that *nothing arrived* rather than merely that a send failed. Live: something owed with nowhere to send it recorded as `unreachable` with the message still built; a failure carrying the transport's own words and the address it tried; a send handing the transport exactly what the row keeps; every stored body carrying the line that says it names no patient; three attempts leaving three rows; nothing owed leaving none; the chain naming the act and its outcome without the address or the body; and, past the service, the database refusing a silent failure, a send that went nowhere, a fourth outcome, an edit and a delete. Browser: the owner asks to be sent their notices while withdrawn and reads that nothing was sent and why, then gives an address and reads where it went.

**Not in Increment 1.59.** A real provider, and with it the bounce that arrives hours later — which is a second kind of failure, asynchronous and attributable to a message already recorded as sent, and needs a way to attach it to the row without rewriting one. A schedule, for the reason above. Retrying a failure, which needs a rule for how many times and a way to tell a transient refusal from a permanent one, and which must not become a queue with a status column. A digest across several notices rather than the state now. An address for somebody who is not a user, which would put a recipient outside every rule Increment 1.58 set. And verifying that an address belongs to the person who typed it, which needs a send to verify with — and now, for the first time, has one.

## Increment 1.58

Increment 1.57 folded what each seat owes into one list. Everything in it is read rather than sent: nobody learns anything unless they sign in, so the month-end loop runs at the speed of somebody remembering to look. This increment renders that list into the message that would go out and records where it would go. It sends nothing — which is the point of splitting delivery in two, because the interesting question is not how to send but what may leave.

- **A screen and a message are not the same surface.** A screen sits behind a guard. A message lands in an inbox, on a lock screen, in a forward, in whatever a mail provider keeps. Two of the four notice kinds carry a person's typed words verbatim, because Increment 1.50 deliberately put the question's own words on the owner board rather than a resolved label — right behind a guard, and wrong outside one. Nothing constrains what somebody types into a thread, and the whole reason the outside accountant's seat needs no BAA is that what it reaches names no patient. So the rule is: **a message carries only sentences the product generated.**
- **Held by the type, not by care.** Every notice now carries `outside` beside `sentence`. `renderMessage` takes `Omit<Notice, "sentence">`, so nothing in that module can read the typed words even by mistake; a rule enforced by a comment is a rule somebody edits out in a hurry. The unit case drives a thread whose body names a patient and asserts the rendered message contains neither the body nor the name.
- **The subject is the part nobody chose to read.** It carries the practice and a count. What is owed goes in the body, and what was said goes nowhere but the screen. The body ends by saying so, so a thin message does not read as a broken one.
- **Nothing owed, nothing sent.** `renderMessage` returns null rather than a cheerful all-clear: a message that arrives whether or not anything happened teaches its reader to ignore whatever arrives, which is the rule Increment 1.55 settled for a badge that never clears. Silence is shown as a state on the screen, where a reader went looking.
- **An address is append-only, and a withdrawal is an act.** `notice_addresses` (migration 0041) keeps the newest row in force. After a message has gone out, "what address was on file that day" is the question an audit asks, and an update would destroy the answer. A row carrying no address is a withdrawal recorded rather than a row deleted, because a person who stops wanting messages has decided something.
- **Nobody sets anybody else's address.** This is the rule the table exists to hold, and it is stricter than the rest of the product, where one person acts for the practice all the time. It is stricter because this is the one act whose entire risk is being done on somebody else's behalf: an administrator who could write another person's address could redirect that person's notices, silently, and the notices are precisely the signal that something has gone unattended. A trigger checks `app.user_id`, the session setting every tenant transaction sets, so no service path and no future caller can route around it; the route takes no user id at all; and the live case asserts the refusal against the database directly, because that is where the rule has to live to survive a later caller.
- **No seat column.** A seat is derived from rank and grants at read time. A stored copy would be a status column that can disagree with the rows under it the moment somebody's grant changes.
- **The chain names the act, never the address.** The chain is read by people who may govern this practice without being this person, and where somebody is reachable is theirs.
- **The message is shown beside the address.** A person deciding whether to receive these is entitled to read, first, what receiving them would mean — and it is the only way the rule about what a message may carry is visible to the person it protects.
- **Tests.** Unit: nothing owed renders nothing; only this seat's debts, whatever the renderer is handed; the count reads as English at either end; the subject names no content; the base URL joins with one slash or none; a dated notice says since when and an undated one stays quiet; and the two quoted kinds render the act and the date while the two generated ones pass through unchanged, asserted against a body that names a patient. Live: nothing held until somebody says so; an unreachable address refused with nothing written; the act recorded with a chain event that does not contain the address; a second act that changes nothing refused, naming the day of the first; a change adding a row rather than rewriting one, with the earlier row still saying what it said; a withdrawal in force as null rather than absent; and, past the service, the database refusing one person setting another's address, refusing an edit and a delete, and refusing an address a message could not reach. Browser: the owner sets an address, reads the message that would go, and sees that it does not quote the question the accountant typed.

**Not in Increment 1.58.** Sending anything at all — the transport, the retry, the bounce, and the append-only record of what *was* sent are the second half, and what that half must not become is a status column saying "notified" that the rows under it can contradict. Also not: a digest of several notices on a schedule rather than one message for the state now, which needs a decision about what "since you last read" means when nothing records a read; an address for somebody who is not a user, which would put a recipient outside every rule above; verifying that an address belongs to the person who typed it, which needs a send to verify with; and a per-practice choice about what may leave, which would make the rule about typed words a setting rather than a rule.

## Increment 1.57

Everything this arc built since Increment 1.52 is read rather than sent, and each thing is read on its own screen: the unattested channels on the owner board, the unanswered questions on the same board, the unread answers on `/cpa`, the decisions due on the board again. Nobody could answer "what does this practice owe right now, and who owes it" without visiting all of them and holding the answer in their head.

- **Derived, never stored.** The obvious build is a notices table, and it is the wrong one: it would be a status column that can disagree with the rows under it — the thing this product refuses from the owner board's counts to a thread's `awaitingPractice`. So the list folds the same readings the screens already use, on every read, and an entry cannot outlive the fact it reports. A live case drives one thread from asked to answered to read and watches the entry move from the practice's side to the accountant's and then go.
- **Each entry carries the sentence its own surface already writes.** A second wording for one fact is two things to keep true, and one of them eventually is not. This is the rule Increment 1.52 settled for attestation coverage and Increment 1.54 repeated for a closed month, applied across the set; the unit case asserts identity with the source sentence rather than a lookalike.
- **A notice names who owes the doing.** The owner cannot discharge the accountant's reading and the accountant cannot answer the practice's question, so a list that mixed them would be a list nobody could act on. Owner's debts first, and within a seat the oldest first, because the thing owed longest is the thing least likely to be discharged by somebody noticing it on a screen.
- **Its own route, not a field on the snapshot.** The risk snapshot may be the frozen one and this is always the practice's position now. Increment 1.36 settled that a figure about a moment and a figure about the present do not belong in one object; the same holds here.
- **Silence is a state.** An empty list says so in words rather than rendering nothing, for the reason the attestation card is shown in every state: a reader who sees a section only when it is full cannot tell a clear practice from a page that failed to load.
- **Tests.** Unit: nothing owed reads empty; each entry carries its source sentence exactly; a covered month adds nothing rather than a reassuring row; the two seats are counted apart; a decision counts only once actually overdue; and the ordering puts the owner first and the oldest first, with an undated entry sorting last within its seat. Live: the seeded practice owing the unattested month; a question appearing on the practice's side and moving to the accountant's once answered; the entry going when the fact goes; and the whole list empty once nothing is owed. Browser: the section on `/risk`, addressed to a seat, carrying the owner board's own sentence.

- **A title assertion that read the frame rather than the screen, and what measuring it showed.** CI failed this branch on `expected '' to be 'Account ledger'` in the money-desk correction case — the raw `page.title()` that Increment 1.49's titles were pinned with. Patching the four mutators on `document.head` and recording `document.title` synchronously after each call says why: a link navigation removes the old `<title>`, inserts two unrelated nodes, and inserts the new `<title>` about 0.1 ms later, so for that span the document carries no title at all. The window is narrower than a frame, which is why sampling every animation frame — 25 frames at full speed and 58 under 20x CPU throttling — never caught it, while CI, sampling on its own clock, caught it twice. React reconciles the head that way and no route or layout here can close it, so the harness now offers `titleAtRest`, which settles the document and returns the value from the predicate that passed rather than reading a second time. It weakens nothing: a screen carrying no title of its own never settles and the wait fails the suite, and a screen inheriting the root layout's "Practice home" still fails the assertion. The same reading now serves the axe audits, so one place holds the rule.

**Not in Increment 1.57.** Sending any of it — email or push is still its own increment, and this is the list such a sender would drain; what it would then need to store is what was *sent*, which is a record of an act like a read or an attestation rather than a status. Also not: the hard events and expiring exceptions, which have their own cards and would double-count here without a rule for which surface owns them; and a per-seat view for the accountant, who sees their own debts on `/cpa` already.

## Increment 1.56

Increment 1.43 made the package's shape part of its hash and recorded that shape on the close, so the CPA page can tell "the package changed shape" from "a figure moved" rather than reporting the first as the second forever. That was the honest answer, and it has a cost this increment finally pays: a month closed under an earlier shape can never again be asked whether a figure moved. Only the entry count and journal total the close froze in their own columns still answer — two figures out of the many the package states. The shape has moved five times since, so that is most closed months.

- **Why the obvious fix is wrong, and why the schema already said so.** Recomputing the hash onto the close would restore the comparison by destroying the record: that frozen hash is what the accountant received. `month_closes` refuses every update and every delete, so the fix is not merely unwise, it is not available — and a migration reaching for `ALTER TABLE month_closes` would be the tell. A schema case asserts this migration does no such thing.
- **A baseline is an addition.** `month_close_rehashes` (migration 0040) says: under this shape, as of this moment, this month hashed to this. The close goes on saying what was received; the baseline gives the "moved since?" question something to compare against again, and the sentence names the date that claim runs from rather than letting a reader assume it runs from the close.
- **One baseline per shape, and never the close's own.** The first reading under a shape is the baseline; a second would quietly move the line a later comparison is drawn from and hide any move in between, so a unique index refuses it and the service names who took the first. A baseline under the shape the close itself froze is refused by a trigger, because that close is already its own baseline and offering both would invite a reader to compare the wrong pair.
- **Only a closed month has one.** A foreign key on (tenant, month) into `month_closes`: there is nothing to re-hash until a close froze something to compare against.
- **It is the practice's act.** Administrator rank, like the close, and a `month.rehash_baseline` chain event — not a background job. It records nothing about the past, but it changes what a later reader may conclude and from when, which is a thing a person should do deliberately.
- **Tests.** Unit: the four states of `compareClose` — same shape answers from the close; an older shape with no baseline claims nothing either way; an older shape with a baseline answers again and says what the claim runs from; a baseline taken under a shape no longer current is ignored, since it can answer a current question no better than the close can. Live: every refusal with nothing written, including the two the database holds past the service; the baseline recorded with its chain event; the close's frozen hash and shape untouched afterwards, checked against what it held before; a second baseline refused naming who took the first; and the move reported once a channel threshold the package reports actually changes. Browser: a month closed under the shape in force offers no baseline and says so.
- **What the browser cannot reach, said plainly.** The state that offers a baseline needs a close taken *before* a schema change, and every close in a fresh test database is made under the current shape. The browser therefore covers the negative — the control stays away while the shapes agree — and the live suite drives the positive path by standing the recorded shape back, which is what a month closed months ago already looks like.

**Not in Increment 1.56.** Taking baselines for every closed month at once, which would make a bulk act out of something whose whole value is that somebody chose the date it runs from; re-hashing on a schedule, for the same reason; a baseline for an export rather than a close, since an export is already re-taken freely and its hash compared to the month's current one; and delivering any of this off-screen.

## Increment 1.55

Increment 1.50 made the month-end package two-way and left it lopsided. The practice learns it owes an answer, because the owner board reads the last message's seat and shows what is owed. The accountant learns nothing: an answer lands in a thread on a screen nobody is watching, and finding it means re-reading every thread of every month.

- **Why the obvious fix is worse than nothing.** A badge on `/cpa` for any thread the practice has answered never clears, and a signal that is always on is not a signal. What clears it is somebody reading the answer — and that is worth recording rather than inferring, because an accountant closing a month-end file is asserting they saw what the practice said, which is exactly the kind of assertion the rest of this product records rather than assumes.
- **So reading is an act.** It is stamped, like the digest acknowledgment of Increment 1.28, not written by the act of loading a screen. A GET that writes would make the record a side effect of a page view, which is a weaker claim than the file needs.
- **Append-only, and deliberately not unique.** `cpa_thread_reads` (migration 0039) holds one row per read act, carrying `up_to_message_id` — the last message the reader had in front of them. A thread is read again whenever it grows, so a seat accumulates rows over a thread's life and the latest one wins. A unique key per thread and seat would force the row to be rewritten, which is what the append-only rule forbids; a schema case pins the *absence* of that key, because it is a decision rather than an omission.
- **What the database holds, and what the service holds.** The database refuses a read naming a message of another thread: a read pointing elsewhere would clear a signal about a conversation the reader never saw. The service refuses a thread whose last word is the reader's own — a message you wrote is one you have seen — and a second mark while nothing has been said since, naming who read it and when, so the table carries acts rather than a pile of rows asserting the same thing.
- **Each seat reads separately.** One side marking a thread read never clears the other's, which is what makes the same table serve the accountant's signal and the practice's without either standing in for the other.
- **What the screen says.** A count when something waits — not a permanent badge — plus, on each thread, who last marked it read and whether anything has been said since. Silence here means nobody is owed a reading, which is why this card is shown only when something waits, unlike the attestation card of Increment 1.52, where silence is the state that matters.
- **Tests.** Unit: the other side's last message is unread until a read names it; a seat's own last word never is; a later message re-opens the thread while the earlier read still says truly what it said; the two seats are independent; an empty thread is nothing to read rather than unread. Live: both refusals with nothing written; the answer marked read with its chain event; a second mark refused naming the reader; the re-open leaving two rows rather than one rewritten; the seats independent; and the database refusing an edit, a delete, and a read naming another thread's message. Browser: the accountant is told the practice has spoken, marks it read, and both the count and the control go.

- **A defect this increment did not cause, found by running the gate at night.** Three cases in `reasonCodes.live.test.ts` failed, and the same three failed identically on a clean tree at `main`, so they were nothing to do with this work. They insert straight at `ledger_entries` to prove a foreign key and a count, with `posted_at = now()`, and the after-hours hold (Increment 1.30) refuses a write-off or an adjustment posted outside the location's week whatever the amount. The seeded week closes at 19:00 and is shut at weekends, so the cases passed by day and failed by night and all weekend — in CI too, which runs at every hour. They now post midweek at 14:00 in the location's own timezone, read from the row rather than written a second time. The subtlety worth recording: `date_trunc` on a date returns `timestamptz`, and `AT TIME ZONE` on a `timestamptz` converts the other way — UTC to local rather than local to UTC — which landed the row at 04:00 Chicago, before the window opens, and made the first fix fail exactly as the original did. The `::timestamp` cast is what makes 14:00 mean 14:00 where the location is. The fourth insert in that file needed the same treatment although it was passing: it asserts a foreign-key refusal, and at night it would have met the hold instead and passed for the wrong reason.

**Not in Increment 1.55.** Delivering the signal anywhere but the screen — email or push is its own increment with its own delivery questions; a reading the practice owes on its own board, since the board already shows what the practice owes and a second signal there would compete with it; a digest count of unread threads, which would put a standing figure back into an object that may hold only facts about its seven days (Increment 1.53); and the migration that re-hashes historical closes under the current package schema, still two versions behind at `package-v6`.

## Increment 1.54

Increment 1.50 gave the accountant and the practice a thread about a line of the month. Increment 1.36 made a month closable: the package hash freezes, and the database admits a later entry into that month only as a correction carrying `prior_period`, posted today. Nothing joined the two, and the gap is not cosmetic — a thread about a closed month read exactly like a thread about an open one, and the two call for different answers.

- **Why it matters that they read alike.** "I will fix that figure" is a true answer about an open month and a false one about a closed month, where the fix posts today, is reported in the month it posts, and leaves the accountant's copy still reading what they received. The owner answering had no way to tell which kind of month they were answering about.
- **One pure sentence, two surfaces.** `closedMonthNote` names who closed the month, the day, and what a correction to that line now does. The `/cpa` thread and the owner board's card both render it, so neither invents its own wording — the pattern Increment 1.52 settled for attestation coverage, applied again.
- **It sits above the messages, not below them.** On both screens the note comes before the thread's words, because it changes how the next message should be written rather than annotating what was already said.
- **The board resolves the close, although it resolves no labels.** Increment 1.50 deliberately left `threadsAwaitingPractice` label-free: the owner board reads it on every render and one label costs a whole month-end package. A close is one indexed read covering every thread, and it changes what a true answer says, so this one is worth its cost. The distinction is about what a figure costs and what it is worth, not about a blanket rule.
- **The note is the thread's own month.** Never the practice's latest close: a question about the running month stays unmarked while a neighbouring month is closed, which a live case asserts by driving both threads at once.
- **A reply reads it too.** The thread a write returns resolves the close exactly as a later list of it will, so a message written into a closed month says so from the moment it lands rather than only once the screen is loaded again.
- **Tests.** Unit: the sentence names the closer, the day and the consequence; it cites `PRIOR_PERIOD_REASON` rather than spelling the code a second time, since a sentence naming a different string would send the practice to a refusal; and the timestamp it keeps and the day it prints come from one value. Live: null while the month is open — which means open, not unexamined — on all three readings; the full sentence on both the thread and the board once the month is closed; the note on the thread a reply returns; and a thread about the running month left unmarked beside a closed one. Browser: the owner closes the ended month for good (the first case in the suite to do so, and therefore the last case in the suite), the accountant asks about a line of it, and the same sentence appears on the thread and on the owner board.

**Not in Increment 1.54.** Notifying the accountant that an answer landed — a signal that never clears is noise, and doing it properly needs read state per seat, which is its own increment; a reminder sent when a month ends with an external channel unattested, still read rather than delivered; refusing a question about a closed month, which would be wrong — asking about the month you have just received is the legitimate case, and the point is to annotate it rather than forbid it; and the migration that re-hashes historical closes under the current package schema, now two versions behind at `package-v6`.

## Increment 1.53

Increment 1.52 made an unattested external channel visible on the owner board and in the month-end package. The weekly digest — the surface an owner actually reads on a schedule — still said nothing about it. Adding it turned out to be the interesting part: the digest is not a place where any figure may be put.

- **Why the digest cannot simply carry it.** The owner stamps an acknowledgment that binds a hash of the digest they read, and the month-end package folds the whole digest into its own hash. A figure stating where the practice stands *now* would therefore move the hash of every month already closed the moment somebody attested anything, and would make an acknowledgment already given read as stale. That is exactly the false positive Increment 1.36 removed from the package hash, and this coupling would have reintroduced it somewhere new.
- **So the increment splits the question in two.** What happened in the seven days is a count inside the digest: `alerts.channelsAttested`, fed from `control.channel_attested` chain events through the same `EVENT_FIELDS` table every other kind uses, which also takes the kind out of the chain's "other kinds" list so one event is never read as two. What the practice still owes rides **beside** the digest on the route, as the same `attestationCoverage` the board and the package read, and never enters the digest object, the acknowledgment hash, or the package hash.
- **The page says which is which.** The standing section is headed "Standing, not this week", sits apart from the counted tables, and states in its own words that it is outside the figures the acknowledgment stamps. An owner who reads a number under a weekly heading is entitled to assume it describes the week.
- **The schema version moved, as it must.** `PACKAGE_SCHEMA_VERSION` is now `package-v6`: one field added to the digest changes the hash of every month already closed, which is the coupling Increment 1.42 discovered, Increment 1.43 made legible, and a standing unit case pins.
- **Two months, one act.** An attestation is counted in the month the act happened and reported by the tie-out of the month it speaks for. Those differ whenever somebody vouches for a month after it has ended — which is the only time anybody can — so a live case asserts both readings at once rather than assuming they agree.
- **Tests.** Unit: the week's count moves the acknowledgment hash, since a figure the owner reads must move the stamp that says they read it; and the `alerts` group carries no standing figure, asserted by the shape of the object rather than by convention. Live: nothing counted before anybody attests and the kind absent from the chain's other kinds; the count moving in the week the act was made and moving the hash with it; the act counted in the month it happened while the ended month's tie-out still reports the channel nobody has spoken for; and a month whose own figures have not changed hashing the same after another channel is attested. Browser: the zero state with the standing line marked as standing, and, last of all, the three attestations the suite made read back as the week's count beside a standing line that now names who said each.

**Not in Increment 1.53.** A reminder sent when a month ends with an external channel unattested — this is still read rather than delivered, and a notification is its own increment with its own delivery questions; notifying the accountant that an answer landed; marking a question about a closed month as such; withdrawing an attestation, which the append-only rule deliberately forbids; and the migration that re-hashes historical closes under the current package schema, now two versions further behind.

## Increment 1.52

Increment 1.51 gave the word "attested" something behind it: a dated assertion, by a named person, that somebody reviewed one of the two channels this build cannot enforce. It said nothing about the channels nobody spoke for — and silence is the state that matters. An external channel with no attestation is a month of vendor payments or payroll that no person, inside the practice or outside it, has claimed to have looked at, and nothing in the product said so.

- **One reading, two surfaces.** The month-end package's tie-out and the owner board's card answer the same question, so they read one pure function over the same rows (`attestationCoverage`) rather than each computing its own sentence. A tie-out that reads green while the board reads red would be worse than either alone, because the reader would then have to decide which one lies. A live case asserts the two are identical at each of three states — nobody, one of two, both — rather than asserting each separately and hoping.
- **The tie-out, and why the schema version moved.** `PACKAGE_SCHEMA_VERSION` is now `package-v5`: whether every external channel carries an attestation is a figure about the month, so it belongs inside the hash. A month closed under v4 reports "the package changed shape" rather than "a figure moved", the fallback Increment 1.43 built for exactly this.
- **The card is on the board in every state.** An owner who sees this card only when something is wrong cannot tell a reviewed month from a month nobody looked at. Where every channel is covered it names who said each, and marks the practice's own word as the practice's, because an attestation a practice makes about its own external channel is worth less than an independent reader's — the same distinction Increment 1.51 records in the row.
- **Nothing to attest is complete, not a false red.** A build that enforces every release channel has no external channel for anybody to vouch for. That reads complete rather than "0 of 0 attested", because a red on a practice that owes nothing is the failure this card exists to prevent, and docs/05 forbids it in the other direction too.
- **One definition of the month that has ended.** Every surface that reports an attestation reads the month somebody could have finished reviewing, never the one still filling. `lastCompleteMonth` moved into the pure module both the board and the Practice Risk page already depend on, so there is one definition rather than two that could disagree about January — the case a naive subtraction gets wrong, and the case the unit test pins.
- **Tests.** Unit: the missing sentence singular and plural; the covered sentence naming who and flagging the practice's own word; a build with nothing to attest reading complete; an unlabelled channel falling back to its key. Live: the tie-out and the card identical at each of the three states, from real rows on the seeded practice. Browser: the owner reads the card naming both channels for the month that ended — not counting the attestation Increment 1.51's case made for the month still running — the accountant reads that ended month on the picker and vouches for both, and the card then names who said each and offers no link.

- **A sampling defect in the audit harness, found by CI.** All 28 browser cases passed and the suite still failed: axe reported a WCAG 2.4.2 `document-title` violation against the account ledger at the state where a correction waits for a second person — a screen whose title reads "Account ledger" both before and after that moment, and which a case has pinned since Increment 1.49. The audit was sampling the document mid-update. `b.audit` now waits for a non-empty `document.title` before injecting axe, and records the title it saw beside each state's counts, so the next failure of this shape says what it was looking at rather than leaving it to be guessed. The wait settles the sample and excuses nothing: a screen that genuinely carries no title never settles, so the wait times out and the suite fails — which is how the nine missing titles of Increment 1.49 were found in the first place. The exact window did not reproduce locally: sampling `document.title` at every animation frame across the link navigation, both at full speed and under twentyfold CPU throttling, showed it going "Ledger" to "Account ledger" with no gap.

**Not in Increment 1.52.** The weekly digest counting attestations; a reminder when a month ends with an external channel unattested, which this card only partly covers, since it is read rather than sent; notifying the accountant that an answer landed; marking a question about a closed month as such; withdrawing an attestation, which the append-only rule deliberately forbids; and the migration that re-hashes historical closes under the current package schema — now one version further behind still.

## Increment 1.51

Two of the six dual-release channels are `external` in this build: the product holds no vendor payments and no payroll file, so it can evaluate nothing about them. docs/05 forbids showing such a channel as enforced, and the coverage table has read "attested, never enforced" since Increment 1.12 — with nothing behind the word. This is what stands behind it.

- **Only a channel the product cannot enforce may be attested.** Attesting an enforced channel is refused rather than accepted and quietly ignored: an attestation beside evidence the product already holds adds nothing and reads as though it did. The list of attestable channels is derived from `ENFORCEMENT` rather than typed a second time, so moving a channel up to enforced takes it off the tab in the same change — a unit case pins that the list is exactly `vendor_new` and `payroll` today.
- **Who attested is part of what is recorded.** An attestation the practice makes about its own external channel is worth less than one an independent reader makes, so the seat is stored beside the name and the coverage row says which: "by Casey Prentice (the accountant)" or "by Riley Owner (the practice itself)". The seat comes from the signed-in user, never from the request body.
- **It is said once and never rewritten.** One row per practice, month and channel, append-only, with the unique index named in the migration rather than left to a table-level `UNIQUE` — the live test caught that mismatch, because the schema declared one name and the database held another. An attestation is an assertion made on a date by a person who was willing to make it, so a later opinion is a later month's row rather than an edit of this one.
- **The coverage table names the month that has ended.** "Reviewed this month" means a month somebody could have reviewed, and the one still filling is not one. Where nobody has spoken it says so, rather than leaving the row to read as though the word meant somebody had.
- **The package carries it, which is why the schema version moved.** `PACKAGE_SCHEMA_VERSION` is now `package-v4`: who attested each external channel is a figure about the month, so it belongs inside the hash. Every month closed under v3 now reports "the package changed shape" rather than "a figure moved", and falls back to the entry count and journal total the close froze — which is exactly the machinery Increment 1.43 built, used here for the first time since.
- **No new refusal shape.** A duplicate answers 409 and names who said it and when, as `addReasonCode` does; a bad month, a thin note, and a channel the product enforces each answer 400.
- **Tests.** Unit: the attestable list is derived, not typed; the last complete month, including across a year boundary, which a naive subtraction gets wrong; and what the coverage row says with and without an attestation, and for each seat. Live: the enforced channel, the unknown channel, the month nobody could have reviewed and the thin note are each refused with nothing written; the accountant's attestation records its seat and reaches the chain; a second attestation of the same channel and month is refused whoever makes it, while the other channel is still open; and the database refuses an edit, a delete, and a second row past the service. Browser: only the two channels appear, the button holds until the note says something, the attestation reads back with its seat and date, its control is gone from that row, and the owner reads the same word on the coverage table — with an enforced channel carrying no such line at all.

**Not in Increment 1.51.** A tie-out line for attestation coverage ("every external channel attested for the month: yes/no"); the weekly digest counting attestations; a reminder when a month ends with an external channel unattested; withdrawing an attestation, which the append-only rule deliberately forbids; and the migration that re-hashes historical closes under the current package schema — now one version further behind.

## Increment 1.50

Increment 1.49 gave the month-end package the person it was built for. It was still one-way: the accountant could read the month and export it, and ask about a figure only by email, where the question and its answer end up somewhere other than the month they are about.

- **A question hangs on a line the package states.** `subjectKey` is the section and key `packageRows` gives every row, and opening a thread is refused when that month's package holds no such row — the form offers the lines rather than taking dictation, for the reason Increment 1.39 settled about reason codes. A question floating beside the package instead of pointing into it is the thing email already does badly.
- **One append-only table holds both halves.** A thread is the message that opened it plus every message after; `thread_id` points at the opening message and the opener points at itself, so a thread is one indexed read and there is no second table to keep in step. Nothing is edited or deleted: an answer that was wrong is followed by another message, the treatment a posting gets from a correction.
- **Who owes the next word is read from the last one.** `author_seat` records which side spoke, and `awaitingPractice` is simply "the last message was the accountant's". There is no status column that could disagree with the messages under it — the defect shape Increment 1.43 met when a figure and the thing it was derived from could drift apart.
- **The seat is the server's to decide.** The route reads it from the signed-in user and never from the request body. Which side spoke is what decides whether the practice still owes an answer, so it is not the caller's to assert.
- **The database holds the thread together.** A reply naming a message that is not itself a thread opener is refused, as is one filed under another month or another line: a thread id pointing nowhere would leave a message no reader could reach, and a reply under the wrong month would answer a figure it is not about. The service checks the same things first, so the practice meets words rather than a crash.
- **The board carries no cost for it.** `threadsAwaitingPractice` resolves no labels, because the owner board reads it on every render and one label costs a whole month-end package to compute. The question's own words carry the meaning and the subject key names the line; `/cpa`, which has already computed that month's package, is where the line reads in full.
- **Tests.** Live: a body that says nothing, a month that is not one, and a line the package does not state are each refused with nothing written; a thread opens on a real line with its chain event and the practice owes the answer; the answer lands, the thread owes nothing, and the second chain event names it; the accountant may speak again and the debt returns; a reply to a thread this practice does not hold is refused; and the database refuses an edit, a delete, a reply to a reply, and a reply filed under another month. Browser: the accountant asks about the journal total from the line list, the practice reads it on the board and answers there (the button held until the answer says something), the card leaves the board, and the accountant reads the answer beside the figure it is about.

**Not in Increment 1.50.** The attestation tab, which is the rest of docs/13 item 22 — external channels with "Reviewed this month", writing a dated attestation so the coverage table reads "external / attested by the accountant"; a count of open questions in the weekly digest or the month-end package itself; notifying the accountant that an answer landed; a question about a line of a month already closed being marked as such; and the migration that re-hashes historical closes under the current package schema.

## Increment 1.49

The month-end package has existed since Increment 1.34 and the person it was built for could not sign in. This increment gives the outside accountant a seat.

- **A seat is a grant, not a rank.** Most of this product's screens open on rank; a few open on a duty, because the duty is what the screen is for. The accountant is the first seat that is nothing but a duty: the lowest rank the product has, holding `view_reports_only` and nothing else. `withGuard` gained `orEntitlement`, which relaxes the rank alone — a declared `entitlements` list still has to be held in full — so the package route opens to the manager's rank *or* to that one grant, and every other route is untouched and refuses the seat exactly as it did before.
- **The seat needs no BAA, and that now rests on a test rather than on a sentence.** The package is aggregate and names no patient, which the page has claimed since Increment 1.34 and which docs/05 and docs/07 question 25 make the condition of letting an outside firm read anything at all. A live case reads the practice's own `patients` and `guarantor_accounts` rows and looks for any of their names, MRNs, or ids in the package and in its CSV. It also asserts that both haystacks contain a string that *is* there, so an empty result is an absence rather than a search that could never have found anything.
- **The duty pairs with nothing.** `view_reports_only` appears in no conflict rule, so inviting the seat creates no finding — the claim docs/13 makes about the invitation. A unit test pins it, because a rule added later that paired the reporting duty with another would make every invited seat a finding on arrival, and the practice would learn it from the Practice Risk page rather than from the grant.
- **The seat is not a Front Desk Lead.** `precogRole` read an ungranted row as "Front Desk Lead" — a role the write-off channel names as a *first approver*. Left alone, the accountant would have been modelled as a person who may initiate a write-off release. The seat now carries its own label, which no release rule names, so it neither initiates nor seconds.
- **The header offers what the viewer may reach.** One catalog states each link's gate, the layout resolves the viewer and filters, and a unit test reads each route file named in the catalog and asserts its guard still says the same thing — a link whose declared gate drifts from its route offers a person a screen that refuses them. Filtering is never the control; every screen still guards itself. It also settled a smaller question honestly: the owner had been offered **Post**, which posting's own route had refused all along, because posting opens on `post_payments` and the practice's front desk holds it.
- **The seat reads and exports; it does not run the practice.** Export is the point — the accountant takes the month away — and each export is a chain event naming who did it, as before. The chart of accounts is the practice's own maker-checker and the month close is the owner's irreversible act, so neither is offered, and the seat never asks for the mappings it would be refused.
- **No migration.** Every row this increment reads already exists; the seat is a seeded user, a guard option, a catalog, and a label.
- **What CI found, which nothing local did.** Every test passed and the run failed anyway: one uncaught exception, `terminating connection due to administrator command`, raised on a socket while an unrelated file happened to be running. The cause is real and was not a test problem. `pg` emits `error` on a pool when a client sitting idle in it fails, and in Node an `error` event with no listener is an uncaught exception — so neither of the app's pools had ever been able to survive a database restart, a failover, or an administrator closing a backend. The harness dropping its throwaway database is simply the cheapest way to produce that event. Both pools now handle it: the pool has already discarded the client, and the next caller is handed a fresh one. A live case terminates every backend under the pool from outside and then queries through it again; without the handler that case reproduces the CI failure exactly.
- **Nine screens had no title of their own.** CI's second finding, on the same head: a `document-title` violation — a WCAG 2.4.2 failure — on the account ledger reached by a link rather than by a fresh load. Every client screen without its own `metadata` inherited the root layout's "Practice home", so the account ledger, the ledger, the posting form, the approvals inbox, the day close, the reconciliation screens and the statements screens all announced themselves as the home page; and while a client navigation swapped that inherited title, the document read as having none at all. Each now carries a descriptive title on a layout beside it, which is the pattern `/risk` already set, because a client component cannot export metadata. The browser case at the state CI failed asserts the title it now reads.
- **What the first browser drive found.** The header rendered empty for everyone. The layout is a server component, and a layout prerendered at build time has no session — the pages under it were being served from a static shell. They are rendered on demand now, which costs nothing: they are client screens reading guarded routes.
- **Tests.** Unit: the grant opens the route in the rank's place, the same seat without it is refused, and the `entitlements` list still applies; the seat is the grant below every rank, an owner holding the same grant is not one; the duty pairs with no other; the links each viewer is offered; and each catalog gate matches its route file. Live: the package and its CSV name no patient. The pools listen for the idle-client failure, and survive the database closing every connection under them. Browser: the accountant signs in, is offered one link, reads the package, is offered neither the chart of accounts nor Close month, exports a CSV onto the chain, and meets a refusal in words on Practice Risk, the owner board, and the ledger.

**Not in Increment 1.49.** The question verb (a package line the accountant asks about, answered on the owner's board) and the attestation tab, which are the rest of docs/13 item 22; an invitation flow (the seat is seeded, and granting one is still a database row); patient-level drill-down and named bank reconciliation, which docs/05 refuses until a countersigned BAA row exists for the firm and which this increment deliberately does not approach; a Month-end home listing every month; a reason threshold set from the Practice Risk page; and a migration that re-hashes historical closes under the current package schema.

## Increment 1.48

Increment 1.47 left two things written down: a refusal that answered differently from the one beside it for the same condition, and a control the Practice Risk page could not see. This increment closes both.

- **One refusal for one condition.** Switching a tightening exception off and moving a reason's threshold the loose way are the same act asked of two objects, and both already reuse `decisionPermitsRetirement` so the rule cannot drift. The refusals still drifted around it: 400 in one place, 409 in the other, in different words. `needsDecision.ts` now holds the status, the code, and the sentence, and both paths read them. **409 is the right one**: nothing is wrong with the request, and the same request succeeds the moment a decision stands beside it, so what refuses it is the practice's state. The browser harness draws the same line — it fails a suite on a 400 from an API route, because the product's own screens should not send malformed requests — so a 400 there reads as a defect in the screen rather than as an answer to the person using it.
- **The coverage table shows what actually governs.** "What is enforced" says a channel holds at $150. A reason code may hold that channel to less (Increment 1.46), and the practice may loosen what a reason holds only under a decision (Increment 1.47) — so a reader of that table who could not see the reasons was reading a figure that no longer governed every posting on the channel. Each channel row now names the active reasons carrying a figure of their own, loosest first, under the figure they tighten. It is the same standard the section's own sentence sets: the table must not show a green it does not have.
- **A reason not below the channel says so.** Where a reason's figure is at or above the channel's, `least(channel, reason)` is the channel's and the reason holds nothing extra. The row says that in words rather than printing a figure that looks like a tightening. A reason may sit there legitimately — a practice that tightened the channel afterward leaves one behind — and the honest reading is that it is inert today, not that it governs.
- **The decision is named where one stands.** A reason whose threshold the practice loosened carries the decision that licensed it: its kind, who decided, and the review date, read through `latestDecisionFor`, which reads a retire as nothing standing. So tightening back — which retires that decision (Increment 1.47) — takes the naming off the row by itself, with no second rule to keep in step.
- **One map, checked against the two it composes.** A reason kind reaches a release channel through two maps the product already held: posting kind to reason kind, and posting kind to channel (which itself mirrors `ledger_release_channel()` in migration 0014). `CHANNEL_FOR_REASON_KIND` writes the composition out rather than computing it, because computing it would pull the ledger package into the browser bundle and break the build — the failure Increment 1.45 met. A unit test computes it and asserts the two agree, so the four cannot drift apart in silence.
- **No migration.** Every row this increment reads already exists. The change is a status code, a shared sentence, a pure view helper, and a sub-line in a table.
- **Tests.** Unit: only active codes carrying a figure appear, on the channel their kind reaches, loosest first; a refund reason lands on the check channel rather than the write-off one; a figure not below the channel reads as holding nothing extra; a loosened reason names its decision; a retired decision names nothing; and the composed channel map equals the written one. Live: the exception refusal now answers 409 in the shared words. Browser: the coverage row says nothing before any reason carries a figure, names "Courtesy adjustment: $50" once the owner sets one and leaves the check channel alone, and after a loosening to $100 under an accept-residual decision reads the figure, the decision, and its review date.

**Not in Increment 1.48.** A reason threshold set from the Practice Risk page itself (the row names it and links nowhere; `/reason-codes` is where it changes); the reason's figure on the coverage row of a channel whose policy rule is switched off; a migration that re-hashes historical closes under the current package schema; and the CPA seat, questions, and the attestation tab.

## Increment 1.47

Increment 1.46 made a reason code able to tighten the dual-release threshold, and recorded on the chain which way each change moved. That direction was the fact this increment hangs on: tightening a control is a settings change, loosening one is a decision.

- **Loosening takes a decision.** Raising the figure, or clearing it so the channel's own governs again, lets through what used to wait for a second person. That is the same act as switching the after-hours hold off, so it takes the same thing (Increment 1.31): an accept-residual or compensate decision, with a note and the day the practice looks at it again. `decisionPermitsRetirement` from the engine is reused rather than reimplemented, so the two paths cannot drift.
- **Neither lands without the other.** The decision is recorded first, in the caller's one transaction; refused, nothing else is written. The chain event then names the decision that licensed the change, so the two read as one story rather than two rows that happen to share a timestamp.
- **Tightening back ends it.** The control stands again, so nothing is left to accept: the governing decision is retired through the review path, as restoring the after-hours hold does.
- **The subject is the reason code itself** (migration 0036 widens `control_decisions.subject_kind`). The code never changes (Increment 1.45), so a decision keeps pointing at the same reason for as long as the practice holds it, and the owner board's decisions-due card carries it like any other decision without a line of new code.
- **409, not 400.** The refusal says the figure was well formed and the practice's state is what refuses it until a decision stands beside it. The browser harness found this: it treats a 400 on an API route as a defect, because the product's own screens should not send malformed requests, and it was right — the request was fine. (`retireException` answered 400 for the same condition; Increment 1.48 unifies them.)
- **The form holds Save until the decision is complete.** It already knows the note or the review date is missing, so it says so rather than spending a round trip to be refused; the service refusal remains the backstop, proved by the live case rather than the browser one.
- **Tests.** Unit: clearing the figure read as the loosest move of all, setting a first figure read as a tightening whatever the figure, and zero read as the strictest state. Live: a loosening refused with nothing written and no decision recorded; a wrong-kind decision and one with no review date refused the same way; the decision and the change written together with the event naming it; tightening back retiring it; and clearing it afterward needing a fresh one. The Increment 1.46 case that raised a threshold now supplies its own decisions, which shows the two rules composing rather than one replacing the other. Browser: the form naming what the change does, Save held until the note and the review date are both there, and the loosening saved under its decision.

**Not in Increment 1.47.** Unifying `retireException`'s 400 with this 409 for the same condition; a per-reason threshold shown on the Practice Risk page beside the channel coverage it tightens; a migration that re-hashes historical closes under the current package schema; and the CPA seat, questions, and the attestation tab.

## Increment 1.46

`reason_codes.requires_approval_over_cents` has existed since migration 0010 and nothing had ever read it. Increment 1.45 named it as the next thing to do and said why it had been left alone: a per-reason threshold is a control of its own, not a field beside a label.

- **Three states, made distinguishable.** Left as it was the column read 0 on every row, and 0 is ambiguous — either "no rule for this reason" or "hold every one of these". Migration 0035 makes it nullable so the two are different facts: `null` the channel governs, `0` every posting waits, `N` a second person above N cents. Every existing row backfills to `null`, which is the truth about them: nothing read the column, so no practice ever expressed a rule through it.
- **A reason tightens; it never loosens.** The effective threshold is `least(channel, reason)`. That one line is the whole control: a reason that could loosen would let a practice undo dual release by inventing one, which is exactly what this path exists to prevent. A live case sets a reason *above* the channel and shows the channel still governing.
- **The service and the database reach one figure.** The trigger computes `least()` itself; the posting and correction services hand the engine a policy whose channel threshold has been tightened by the same rule. Where those two disagree the practice meets a crash instead of a hold — the shape of defect Increment 1.39 found in the reason column, and the reason the browser case drives a real posting and asserts the held message rather than trusting the service alone.
- **The exception path is deliberately untouched.** A `raise_threshold` exception carries a governed decision with a review date behind it (Increment 1.31), so it still licenses up to its own figure. The reason threshold decides whether a hold is needed at all, not what an exception may license.
- **The trigger carried forward whole.** The after-hours hold (1.30) and the correction branch (1.38) both live in `ledger_entries_requires_approval`, and rebuilding it from an older migration's text would silently revert them — as it nearly did in 1.38. The migration extracts 0031's current body and inserts only the reason lookup; a schema case pins both the hold and the correction branch by name.
- **Tests.** Unit: the effective figure in each of the four states, the policy returned unchanged where there is no rule and where the reason is looser, only the named channel moving, and the practice's own policy never mutated. Live: every row carrying no threshold after the backfill, a code the practice does not hold carrying none rather than raising, malformed figures refused, each change on the chain with which way it moved, and the database tightening at $50, holding every one at 0, and refusing to loosen at $900 while $100 still posts under the channel's own $150. Browser: the owner setting the threshold, the front desk meeting a hold in words on a $100 write-off that the channel alone would have admitted, and the threshold cleared again.

**Not in Increment 1.46.** Loosening a reason threshold as a governed decision with a review date, as switching the after-hours hold off is (Increment 1.31) — the chain event records which way it moved, which is the fact a decision would hang on, and that decision is the natural next increment; a migration that re-hashes historical closes under the current package schema; and the CPA seat, questions, and the attestation tab.

## Increment 1.45

Every write-off, adjustment, refund, reversal, and transfer cites a reason code, and until now the list was the product's: seeded per practice and hard-coded in the forms. A practice that wanted a reason of its own had no way to adopt one, and Increment 1.39 had already shown what happens when the forms and the table disagree — a reason the practice never adopted reached the database and failed the insert.

- **The practice governs its own list**, at `/reason-codes`. Anyone who posts may read it, because the posting forms are built from it; adopting, relabelling and retiring are the administrator's, as with the locations and the policy.
- **The foreign key settles what may change.** `ledger_entries.reason_code` references `reason_codes (tenant_id, code)`, so: the **code** never changes, because rewriting it would orphan every entry carrying it; a code is never **deleted**, because entries cite it and the database would refuse; the **label** is free to change, because nothing keys on it. Retiring clears `active`, which takes the code off the forms and leaves the history readable — the only thing the key permits, and the only honest treatment of history. The screen shows how many entries cite each code, which is that reason in one column.
- **`prior_period` is reserved.** The closed-month refusal admits a correction only under it, so retiring it would leave the practice unable to correct a closed month at all. The service refuses in those words and the button is disabled; its label is still the practice's to change.
- **The forms read the rows.** `reasonOptionsForPosting` narrows by the reason kind the posting kind draws from, and `allReasonOptions` offers a correction every active code, because a repost keeps the kind of the entry it replaces. Both leave the reserved codes out: into a closed month the service applies `prior_period` itself, so offering it as a first posting's reason would invite a meaning it lacks.
- **Reading the rows settled a disagreement the constant was hiding.** The hard-coded list filed `correction` under the adjustment kind while the seed files it under `reversal`. A unit case now pins the table's answer.
- **No migration.** The table has carried `active` and FORCE RLS since migration 0010. Two things were missing rather than wrong: `reason_codes` had no Drizzle table object (Increment 1.39 had to reach for raw SQL), and the list naming the tenant-scoped tables had never named it. Both are fixed, with a schema case pinning the policy and the key.
- **Tests.** Unit: the options a form offers in the reader's order, a retired code off both forms while its entries keep citing it, the reserved code off both, both transfer kinds mapping to one reason kind, a kind that takes no reason offering none, and `correction` filed under reversal. Live: the seeded list with its counts and the reserved mark; adopting with the code lowercased, a duplicate refused, four malformed codes refused and an unknown kind refused by name; relabelling without touching the key and a no-op refused; retiring a code in use, the database refusing a delete while an entry cites it, then restoring; the reserved code refused retirement but not relabelling; and an adopted code reaching an entry while one never adopted cannot. Browser: the owner adopting, relabelling and retiring, the reserved row's Retire disabled, the posting form offering what the practice holds and neither the retired nor the reserved one, and the front desk reading the list with nothing to change.

**Not in Increment 1.45.** `requires_approval_over_cents`, which the table carries and nothing reads yet — a per-reason threshold is a control of its own and belongs with the policy rather than beside a label; a migration that re-hashes historical closes under the current package schema, which would defeat the point of freezing them; and the CPA seat, questions, and the attestation tab.

## Increment 1.44

Increment 1.43 gave the package a schema version so its shape could grow honestly. This is the first growth it makes room for, and the one the sealed-day work has been heading toward since 1.40: the accountant's own copy of the month says which of its days moved after the practice counted them.

- **A sealed-days section.** How many day closes the month froze, a row per sealed date that a posting landed against — the count, the first postings among them, and the net — and the totals. Aggregate: a date two locations both sealed is one row, and `closes` says how many seals it covers. Nothing in it names a person.
- **Windowed on the sealed day, not the posting.** This differs from the journal, which windows on `posted_at`, and the difference is the point. A row posted in a later month against one of this month's sealed days appears in this section and *not* in this month's journal — which is exactly the row an accountant reconciling daily deposit slips against the journal would otherwise hunt for. The page says so in its own words rather than leaving the reader to infer it.
- **A tie-out of its own.** "No row posted against a day this month after the practice sealed it", holding when nothing landed, and otherwise naming the rows, the total, how many of the month's sealed days took them, and how many were first postings.
- **`package-v3`.** The section and the tie-out both sit inside `hashedView`, so the version moves with them, in the same commit — which is what Increment 1.43 built the version to make possible.
- **Tests.** Unit: the fixture carrying the section, the version pinned by name, and the key-order check rebuilt to derive its reordering rather than hand-list every field, so a package field added later cannot quietly drop out of it. Live: a fresh practice reporting nothing with the tie-out holding; freezing a day moving the denominator and the hash while the tie-out still holds; two postings behind that seal giving one row, the right split, and a tie-out that names them; and the CSV carrying both the day row and the frozen-day count. Browser: the package reading one frozen day and nothing behind it, then, after the sealed-day case posts, naming 2026-09-14 with three rows and $10.00, with the section and the tie-out naming no person.

**Not in Increment 1.44.** A migration that re-hashes historical closes under the current schema, which would defeat the point of freezing them; reason codes as practice-editable rows with a screen of their own; and the CPA seat, questions, and the attestation tab.

## Increment 1.43

Increment 1.42 left one item deliberately unbuilt and said why: the digest's count of postings into sealed days could not be added, because `hashedView` folds the whole weekly digest into the month-end package hash and `canonicalJson` serializes every key. Adding one digest field would change the hash of every month already closed, and each would begin reporting `changedSinceClose` — permanently, which also means the flag stops being read. This increment fixes the cause, then adds the count.

- **The hash names the shape it covers.** `PACKAGE_SCHEMA_VERSION` sits inside `hashedView`, so a hash is self-describing and two hashes are only ever compared within one version. v1 is Increments 1.34 to 1.42; v2 is this one.
- **A close records the shape it froze.** `month_closes.package_schema` (migration 0034). Months closed before this carry `package-v1`, backfilled by the column's default, which is then dropped: a close states the schema it used rather than inheriting one.
- **The page tells a shape change from a figure moving.** Where the close's schema differs from the one running, the CPA page says the two hashes do not compare and that neither says anything about the figures — rather than claiming a change it cannot evidence.
- **And it still answers.** The close froze the entry count and the journal total in their own columns, and no change of shape touches those. Where the hashes are incomparable the page checks those two against the month as it computes today, so a close stays verifiable across a schema change instead of going silent. That is a better answer than the hash alone, and it only exists because the schema version forced the question.
- **The digest count, now safe to add.** Postings into sealed days over the week, and how many of them are first postings, on the digest's bank section. Adding them is what took the package to v2.
- **Tests.** Unit: the version present in the hashed view and pinned by name; the digest-shape coupling still pinned, its comment now recording that adding a digest field means bumping the version in the same commit. Live: the close recording the running schema on the row and on the chain event; and a month rewritten to `package-v1` reading as incomparable while the two frozen figures still answer. Browser: the digest's rows reading zero before anything lands behind a seal, and reading three and one after the sealed-day case posts.

**Not in Increment 1.43.** The CPA package reporting sealed-day postings as a section of its own rather than only through the digest counts; a migration that re-hashes historical closes under the current schema, which would defeat the point of freezing them; reason codes as practice-editable rows with a screen of their own; and the CPA seat, questions, and the attestation tab.

## Increment 1.42

Increments 1.40 and 1.41 made the database stamp what lands behind a seal and put the counts on the board. A count is something the owner has to go and read. The two signals the practice already has for "look at this now" are the detector register and the hard-event card, and a first posting into a sealed day belongs in both.

- **A ninth detector, `posting_into_sealed_day`.** One `control_findings` row per first posting the database stamped against a frozen day, inside the same 45-day window the other ledger detectors use, closing when the row leaves it. Migration 0033 widens the finding kinds by one; the subject is a ledger entry, which the constraint already admits.
- **Severity says slip or pattern.** One first posting behind a seal is medium. A second behind the same seal turns both high and the sentence says how many have landed there, because one late payment is an operational slip and a sealed day taking several is a habit.
- **A seventh hard event.** The same rows reach the owner one at a time on the home board rather than waiting for the weekly digest, each naming the amount, the day it landed against, and the day it was posted, and linking to the sealed day.
- **Both exclude corrections, for the same reason.** A correction names the entry it replaces, carries a reason, and above the threshold waits for a second person; it announces itself. A first posting into a sealed day announces nothing, which is the whole reason to raise it. The browser drive proves the distinction end to end: three rows land behind one seal, and exactly one of them pages the owner.
- **The row's effective date is the sealed day.** The trigger stamps a row only where a frozen close carries that date for that location, so neither the detector nor the alert needs a join to name the day.
- **Tests.** Unit: the detector flagging a first posting and leaving both halves of a correction alone, the sentence naming no person, and a second posting behind one seal turning both high while a lone row behind another seal stays medium; and the hard-event kind list pinned, so a new kind cannot go uncounted. Live: all seven hard events read from rows, the sealed-day one among them; the stamp reaching the detector; two sealed days with one row each reading as two slips; and a second row behind one seal turning that day's rows high while the other stays medium. Browser: the owner's card showing exactly one alert for the three rows behind the seal.

**Not in Increment 1.42.** The digest's count of postings into sealed days, and the CPA package reporting them for the month. Both are blocked on the same thing, found while building this increment and now pinned by a regression test in `package.test.ts`: `hashedView` spreads the whole weekly digest into the package hash, and `canonicalJson` serializes every key, so **adding one field to the digest changes the hash of months already closed** and makes them read "changed since close" forever. The package needs a schema version recorded on `month_closes` at close, so a hash that differs because the shape changed is distinguishable from one that differs because a figure moved. That version is the next increment, and the digest count rides on it. Also still out: reason codes as practice-editable rows with a screen of their own, and the CPA seat, questions, and the attestation tab.

## Increment 1.41

Increment 1.40 made the database stamp every ledger row it admits against a frozen day close, and the day-close page read those stamps back for one day at a time. One day at a time is the wrong resolution for the risk. Sealing a day at the figure the owner expects and posting the rest later shows up as a habit long before it shows up as a variance, and a habit is only visible across days.

- **Two practice-level counts on the owner board.** A "Sealed days" card reads the stamps back as what landed behind yesterday's seals and what landed behind any seal in the last 30 days. Each count carries the rows, the net they move the sealed days by, how many sealed days they touched, and how many are first postings rather than halves of a correction. One aggregate over `ledger_entries` joined to `day_closes` on `closed_day_id` produces both; the join is the proof, because only the trigger writes that column.
- **The split is the point, not the total.** A correction names the entry it replaces and arrives with a reason and, above the threshold, a second person. A first posting names nothing. The card counts the two apart and says so in its own words, so a month of corrections reads differently from a month of quiet first postings even where the totals match.
- **The card appears in every state, the quiet one included.** "Nothing posted into a sealed day" is said out loud rather than omitted: an owner who never sees the card cannot tell a clean practice from a broken count. Where yesterday moved, the card leads with yesterday and keeps the window behind it; where yesterday's seals hold, it leads with the window.
- **Nothing names a person.** The card reports the practice, as the rest of the board does.
- **Tests.** Seven unit cases on the card's words, covering each state and the four shapes a count can take, including a lone correction reading as one rather than as plural and every row being a first posting reading as its own sentence. Live: the quiet state before any day is sealed and again once a day is sealed with nothing behind it; the window leading where an older sealed day moved and yesterday held; yesterday leading once yesterday's own seal moved, with the window still behind it and the day's own tile unchanged; and a sealed day older than the window left out of the count while the row keeps its stamp, which is what makes the card a window rather than a ledger. Browser: the board reads the quiet state while the sealed day is untouched, and after the last case posts into it, the board counts the same three rows and the same $10.00 the day-close page shows, from the same stamps.

**Not in Increment 1.41.** A hard event on a pattern of late postings, and a detector finding for one; the digest's count of them; the CPA package reporting them for the month; reason codes as practice-editable rows with a screen of their own; and the CPA seat, questions, and the attestation tab.

## Increment 1.40

A day close is the practice's own statement of what a day took in: the deposit batch, the day-sheet total, the variance between them, counted twice and frozen. Until now a ledger row effective-dated into a day already frozen landed in silence. The sealed figures never moved, so the day's statement and the day's ledger drifted apart with nothing recording that they had — which is the shape of a skim. Seal the day at the figure the owner expects, post the rest of it afterward.

- **The database stamps what lands behind a seal.** A BEFORE INSERT trigger reads the frozen day close for this row's location and effective date and writes `posted_after_close` and `closed_day_id` onto the row (migration 0032). It reads the seal at insert time rather than deriving it from dates afterward, so a row written while the day was open stays unstamped and a seal taken later does not reach back and make one. The trigger assigns both columns, so whatever the writer passed is overwritten, and a CHECK keeps the flag and the day as one fact stated twice. The columns carry no UPDATE grant, so the stamp is the database's own observation and no later hand moves it.
- **The row is admitted, not refused.** A payment that arrived arrived, and the front desk must be able to record it. The refusal belongs to the month close (Increment 1.36), because a month is what the practice hands its accountant; a day is the practice's own, and the honest treatment of a late posting into one is to admit it, name it, and count it.
- **The sealed day says what has happened to it since.** The day-close page carries the lock beside the word "Frozen" rather than instead of it, and a "Since the seal" section naming each row that landed afterward: when it posted, whether it is a first posting or the half of a correction that clears or the half that replaces, who wrote it, its reason, and the amount — with one sentence giving what they move the day by and saying that the sealed figures do not move, so the day now reads two ways: what the practice counted, and what the ledger holds. A frozen day with nothing behind it says so.
- **The grant the trigger needs.** The trigger reads `day_closes` on every ledger insert, and the held-release path inserts as `app_append`. The migration grants that role SELECT on `day_closes`, as Increment 1.30 needed `locations` and Increment 1.36 needed `month_closes`. A live case drives an append-role insert for exactly this reason: without the grant the row raises permission denied rather than posting.
- **Tests.** Live: a row into an open day left unstamped even where a `day_closes` row exists on it, because open is not sealed; a row into the frozen day stamped with that close; a row against another location on the same date left unstamped; a forged claim overwritten in both directions, including one naming another practice's close; the append role's insert stamped; and the snapshot naming the three rows that landed, totalling them, and leaving the deposit total at what the practice counted. Browser: the front desk records a payment for a day an earlier case sealed, and the sealed day then names all three rows behind it — the correction pair the previous case approved and the payment just posted — while the seal still reads $350.00.

**Not in Increment 1.40.** The two practice-level counts, "Yesterday changed after close" and "Postings into closed days"; the hard event on a pattern of late postings; reason codes as practice-editable rows with a screen of their own; and the CPA seat, questions, and the attestation tab.

## Increment 1.39

Increment 1.38 let one approval release a correction pair but left the second person looking at a bare reversal: the inbox named a channel and one figure, and said nothing about what was being corrected. Driving that journey end to end in a browser then found three defects in code already merged — the kind a service test with well-chosen fixtures cannot find, because the fixtures were the part that was right.

- **The inbox reads a correction as a correction.** Where the request names an entry, the card is headed "Correction" and says what changes: the figure the entry carries now, the figure proposed for it, and that approving writes both rows in one transaction while declining writes neither. Everything comes from the held payload the request already carried; no new query, no new column.
- **Defect, shipped in 1.37: a free-text reason reached the database.** `ledger_entries.reason_code` is a foreign key into each practice's `reason_codes`. `correctEntry` passed the caller's words straight through, so correcting an entry with a reason the practice had not adopted failed the insert with `ledger_entries_reason_fk` — which the browser saw as a 500 with an empty body. Every live test had used `courtesy`, a seeded code, so every live test passed. The service now looks the code up and refuses in words: "This practice has no reason code …". The row count is asserted unchanged.
- **Defect, shipped in 1.36: `prior_period` was never seeded.** A correction into a closed month must carry that reason, and the reason column is a foreign key — so a real practice could not correct a closed month at all. The live suite had been inserting the code by hand in its own `beforeAll`, which hid it. The seed carries it now, and the suite asserts it is there rather than creating it.
- **The correction form offers reasons rather than taking dictation.** `REASON_OPTIONS` moves out of the posting page into `lib/ledger/reasons.ts`, and both forms read it. The correction's Reason is a select of codes the practice has adopted, and Reverse and repost waits for one, as Post already did.
- **Tests.** Live: the inbox item carrying the entry it corrects, the reversal's own figure and the repost's; declining writing neither half and leaving the entry still correctable; an unregistered reason refused in words with nothing written, then the same correction accepted under an adopted one; and the seed's `prior_period` asserted. Browser: the whole journey in one case and without a clock branch — the front desk corrects the $200 write-off an earlier case approved (always above the $150 threshold, so the hold never depends on the hour), the ledger stays unchanged while it waits, the owner's inbox names both figures, and one approval writes the pair.

**Not in Increment 1.39.** Reason codes as practice-editable rows with a screen of their own (the list is still the product's, seeded per practice); the late-first-posting path (`posted_after_close` and `closed_day_id`); the closed-day view's lock glyph and its correction footer; the two practice-level counts, "Yesterday changed after close" and "Postings into closed days"; and the CPA seat and questions.

## Increment 1.38

Increment 1.37 refused a correction whose figure needed a second person, because a pair has to land in one transaction and a hold would split it. That was safe and honest, and it left the practice no way to correct a large entry. This increment gives the second person the whole correction to approve.

- **Why the database had to learn something.** Migration 0014's trigger admits one row per approved request, at exactly the approved amount, and a unique index held one entry per request. A pair is two rows at two amounts, so no arrangement of the service could have released one under the old rule. Migration 0031 adds `approval_requests.corrects_entry_id`: an approval may name the entry being corrected, and then it releases both halves of that one correction, neither of which may exceed the figure the second person approved. The old exact-amount and one-row rules still govern every ordinary approval.
- **One request, not two.** `correctEntry` evaluates the release at the larger of the two figures. Above the threshold, or under the after-hours hold, it writes one approval request carrying the reversal as its held payload and the repost's kind, figure and tender beside it, and returns the request id rather than a refusal. Nothing posts until the decision.
- **One decision, both halves.** `executeHeldPosting` writes the reversal the approvals path already wrote, and then — when the payload carries a correction — the repost, in the same append transaction under the same approval. Both rows cite the one request. The request's resulting entry is the reversal; the repost is found through `corrects_entry_id`.
- **The unique index, restated rather than dropped.** One row per ordinary approval, and one row per kind per correction approval. That admits the reversal and its repost and nothing else — a third row, or a second repost, still fails.
- **The surface.** Correcting a large entry now reads "the correction waits as one request; approving it writes both the reversal and the repost", with the request id, and the ledger is unchanged until the owner decides.
- **A regression this increment caught in itself.** The first draft of migration 0031 rebuilt `ledger_entries_requires_approval` from migration 0014's text, which silently dropped the after-hours hold migration 0026 had added to the same function. Three live cases in `detectorsLedger.live.test.ts` failed on it. The migration now carries the whole current function forward, and `schema.test.ts` pins the after-hours lines by name so the next edit of this function cannot quietly revert them.
- **Tests.** Database: the new column, the correction branch and its two refusals, the after-hours lines carried forward, the ordinary rules still standing, and both unique indexes. Live: a $200 write-off correction held as one request naming the entry and the larger figure, nothing posted while it waits, and the owner's approval writing both halves under the one request. Browser: the held branch asserting the request id and an unchanged ledger.

**Not in Increment 1.38.** Declining a held correction (the ordinary cancel path applies, but the inbox does not yet say a correction is what waits); the approvals inbox naming the two figures of a held correction rather than the one it was raised at; the late-first-posting path (`posted_after_close` and `closed_day_id`); the closed-day view's lock glyph and its correction footer; the two practice-level counts, "Yesterday changed after close" and "Postings into closed days"; and the CPA seat and questions.

## Increment 1.37

Increment 1.36 admitted a row into a closed month on its reason code alone. A reason code is a label; `docs/13` item 22 asks for the arithmetic — "unless it is a reversal-and-repost pair with reason 'prior_period'" — and feature 20 says what the pair is: "the service writes a reversal entry (kind='reversal', reverses_entry_id = the original, amount mirrored) and a repost entry (the original's kind with the corrected values), both carrying corrects_entry_id = the original and the same required reason code, in one transaction; there is no 'correction' kind".

- **What a correction is.** Two rows, written in one transaction, posted today against the original's effective date: a reversal that mirrors the entry it clears, and a repost of the original's kind carrying the corrected figure. Both name the entry they correct in the new `corrects_entry_id` column (migration 0030). Nothing is edited; the ledger stays a history.
- **What the database refuses.** A reversal whose original this practice does not hold, a reversal of a reversal (correct the entry it reverses), a second reversal of one entry (correct the repost), a reversal whose amount does not mirror its original to the cent, a repost with no reversal behind it, and — by CHECK rather than trigger — a reversal that claims to correct one entry while reversing another. Each refusal names the entry and the way through.
- **The closed month tightens.** `ledger_entries_month_not_closed` now needs reason `prior_period` *and* a `corrects_entry_id`. A bare adjustment wearing the label no longer reaches a month the accountant has taken, and Increment 1.36's live case says so in its own words.
- **The reason code, and where the why goes.** Inside a closed month both rows carry `prior_period`, because that is the only reason the refusal admits. The practice's own reason is not lost: it is written into each row's memo beside the month that is closed, so the record reads "Corrects entry … (posted twice); 2026-08 is closed to the accountant."
- **Dual release, and why a large correction is refused rather than held.** A correction is released on the write-off channel at the larger of the two figures. Where the policy calls for a second person — above the threshold, or under the after-hours hold — the service refuses and says so, because a hold would split a pair that has to land in one transaction. The database refuses it too, on the same policy, whatever the service decides. Holding a pair as one approval request is Increment 1.38's.
- **The surface.** The account ledger says plainly that a posted entry is never edited, offers **Correct** on a row that is neither half of a correction nor a charge, opens on the figure the entry carries, and writes the pair. Each half then reads "Reverses the write-off from 2026-08-14" or "Reposts the write-off from 2026-08-14", and neither offers Correct again.
- **Tests.** Database: the column and its foreign key, the mirror CHECK, the pair trigger, and each of the five refusals by name. Live: every refusal driven against real Postgres; the pair written with both rows carrying the reason, the effective date, and today's posting time; the chain event's payload; a second correction of the same entry refused; a correction of a reversal refused; a correction that changes nothing refused; and the closed month admitting the pair while refusing a bare labelled row. Browser: the Correct control opening on the entry's own figure, then either the pair appearing with its two labels or the second-person refusal stated — whichever the clock makes true, since the after-hours hold forces dual release on this channel and CI runs at every hour.

**Not in Increment 1.37.** Holding a correction pair as one approval request, so a large correction can be released by a second person rather than refused; the late-first-posting path (`posted_after_close` and `closed_day_id`, for a charge or an 835 line that has no prior entry to correct); the closed-day view's lock glyph and its "Corrected on 9/3: see entries #5120 and #5121" footer; the two practice-level counts, "Yesterday changed after close" and "Postings into closed days", each excluding worker-actor rows; and the CPA seat and questions.

## Increment 1.36

`docs/13` item 22 asks for the close and the refusal that gives it meaning: "Any entry effective-dated into a closed month is refused unless it is a reversal-and-repost pair with reason 'prior_period' ... posts today, and fires the retroactive hard event." Increments 1.34 and 1.35 made the month readable and mappable; this makes it final.

- **What closing freezes.** `month_closes` (migration 0029) holds one append-only row per month: the period, the package hash at the moment of closing, the journal's entry count and total, and who closed it and when. A month is never re-opened, because re-opening would make that frozen hash a lie; update and delete triggers refuse, and the table says so in the exception it raises.
- **What closing refuses.** `closeMonth` refuses a month that has not ended (its rows are still arriving), one already closed (naming who closed it), and one whose journal still holds a line no approved mapping covers, because the accountant would otherwise receive a frozen month they cannot post to a chart of accounts. That last refusal is what ties Increment 1.35 to this one.
- **The prior-period refusal, at the database.** A `BEFORE INSERT` trigger on `ledger_entries` reads the closes and refuses any entry effective-dated inside a closed month unless its reason code is `prior_period`. The message names the kind, the effective date, the month, and the way through: "post it today with reason prior_period instead". Because the correction posts today against an old effective date, the retroactive-entry hard event (Increment 1.29) raises it on the owner's board, which is the alarm `docs/13` wanted, not a side effect. That event's rule is the gap, not the close: it raises an entry whose effective date precedes its posting date by more than seven days, so a correction into a month that closed days ago can fall under it. The refusal stands either way. `app_append` gains SELECT on the table for the same reason it holds SELECT on `locations`: the posting path runs as that role and must read the rule it enforces.
- **What the frozen hash covers, and the correction Increment 1.34 needed.** Building the close exposed a defect in Increment 1.34's hash: `packageHash` covered the whole package, including the practice's chain head as of the moment of reading. Every appended event therefore moved every month's hash — including the close's own `month.closed` event, one statement after the hash was frozen. Left alone, every closed month would have reported a change it never had, and Increment 1.34's own "changed since that export" signal was already reporting the same false positive. The hash now covers the figures the package *states about the month* — the journal and the accounts its lines map to, the reasons, the deposit register, the counts, how many lines the month left unmapped, the controls as they stood at month end, how many chain events the month carried, and which tie-outs held — and none of the figures that state the practice's position right now: the chain head, the last nightly check, how many findings are open, how many reviews are overdue, and how much of the chart of accounts is approved or waiting. `hashedView` in `package.ts` names the split and says why. Exported hashes recorded before this change no longer reproduce; nothing in the product verifies an old export hash, and the alternative was a signal that was always on.
- **What "changed since the close" now means.** A closed month's journal cannot move: the product stamps `posted_at` at insert, so a later correction lands in the month it posts, not in the closed one. What can still move a closed month is the practice re-mapping a journal line to a different account, or editing the policy the package reports as in force at month end. Those are the drift the page reports, and they are worth reporting: the accountant's copy no longer reproduces. The page says so in those terms and shows the frozen hash beside the current one.
- **The surface.** The month picker on `/cpa` shows the close beside the package: who closed it, the entries and total frozen, the frozen hash, and whether the month still reads as the accountant received it. A month still running offers no control at all. A month that has ended offers Close month behind one confirmation that says plainly it cannot be undone.
- **Tests.** Database: the month pattern, the hash length, uniqueness, the triggers, the policy, both grants, and the refusal trigger with its one exception. Live: a running month refused; an unmapped journal refused; the close freezing the expected hash and writing one chain event with the expected payload; a second close refused naming who closed it; update and delete refused; a back-dated entry refused with the full message; an open month untouched; the `prior_period` correction going through, landing in the month it posts rather than the closed one, leaving the frozen hash reproducing, and raising the retroactive-entry hard event with its full sentence; and re-mapping the closed month's one journal line moving the month away from its frozen hash while the close row keeps saying what the accountant received. Unit: the hash unmoved by the chain head, the last check, the open-findings and overdue counts, the chart-wide mapping counts, and a reworded tie-out; moved by the month's unmapped lines, its event count, its controls, and a tie-out's verdict. Browser: the current month offers no close, the previous month offers one behind a confirmation that names the consequence, and Cancel leaves it unclosed.

**Not in Increment 1.36.** The reversal-and-repost pairing itself (the reason code is enforced; pairing the two entries is not); the late-first-posting path (`posted_after_close`); a practice-level "changed after close" count; re-opening under any circumstance; the CPA seat and questions. Nor does the journal move to an effective-date window: the package still windows on `posted_at`, which is why a correction is reported in the month it posts. Windowing the month on effective date would change what Increments 1.34 and 1.35 already ship, including the tie-out that compares the journal against the weekly digest's postings, and belongs in its own increment.

## Risks that stay visible

- Lifting Smile Notes tests while inverting the PHI premise will fail some of those tests; they become a tracked rewrite list, not a reason to leave PHI-blocking rules in place.
- Precog math is illustrative. Shipping scores before golden tests is a liability.
- SuperByte's 3-read cost model must not auto-fire on every keystroke in a PHI product.
- Solo-team capacity: Increment 0.1 is the only honest Phase 0 slice for one engagement. Decision 23 (budget and staffing) is still the gate on Phase 1 durations.

## Increment 1.102

Increment 1.90 made the reason for ending every sign-in **typed rather than hardcoded**. The guard refuses anything under ten characters, and the words beside the field say why:

> "It goes on the chain beside the act, and it is what the practice reads afterwards."

That last clause was not true. The reason reached the chain and stopped there. In the whole repository, **exactly one thing ever selected it** — a browser test, going round the product to Postgres:

```sql
SELECT payload->>'reason' FROM domain_event WHERE kind = 'auth.sessions_revoked_all'
```

No screen, no digest, no month-end package. The product demanded a sentence from a person during an incident, promised they would read it back, and gave them nowhere to read it.

This is the shape Increments 1.97, 1.100 and 1.101 each found: **a fact the product records and nothing reads.** Here it is sharper, because the product does not merely record the fact — it refuses the act until a person composes one.

## What it does now

The practice's recent sign-out-everybody acts sit **above the form that takes another one**: when, who pressed, how many sign-ins ended, and what they typed. Five of them, because this act belongs to an incident and an incident is read in one sitting; the chain keeps every one and is the record a verifier reads.

Above the form is the placement that matters. A second administrator during the same incident meets, before pressing, the fact that somebody already did this an hour ago and why — which is either the answer to their question or the reason to press anyway.

## Three contingencies the rows carry

- **The administrator has left.** The join to `users` is a left join: the act does not leave with them. The row reads *"An administrator whose seat has since gone ended 2 sign-ins"* rather than naming nobody.
- **Nobody was signed in.** `revoked: 0` is not nothing happening. The act ran, and the row says it ran.
- **A reason from before there were reasons.** A row this practice wrote while the route still hardcoded `admin_revoke_all` carries no reason at all. It reads *"Recorded before this screen asked why"*, never a blank — a blank would read as somebody having typed nothing, which the guard has refused since Increment 1.90.

And one contingency the *screen* carries: the history is `null` until it loads, and only a load that came back empty prints "this practice has never ended every sign-in at once". A fetch that fails leaves the sentence unsaid rather than having the screen state something false about the practice's history because a request did not land.

**Red-before, measured.** Without the increment the browser case fails on its first new assertion — `waiting for getByText(/never ended every sign-in at once/) to be visible`, 60s — on a screen where the panel's heading renders as it always did.

**Tests.** App unit (7): the sentence naming who pressed and how many ended, the singular, the act that ended nothing, the administrator who has gone, a reason given back unchanged, the empty reason explained rather than blanked, and the never-done sentence. Live (4): nothing read back from a practice that has never done it; the reason, the name and the instant read back from one that has; the most recent first with **another practice's act absent**, because a reason names the incident a practice was in the middle of; and no more rows than the screen shows. Browser (1): the panel says it has never happened, the act runs, and after signing back in — the act the panel itself tells the administrator to take — the reason is on the screen.

## Not in Increment 1.102

**A clock time.** The row shows the date and carries the full instant in `<time dateTime>`. Every other screen in this product shows dates, and the instant a row shows belongs in whichever of the practice's locations the reader is standing in — a question `docs/05` leaves with the owner and one this increment will not answer by picking UTC quietly.

**A gate over unread payload fields.** The obvious generalisation — every key written into an event payload must be read by something — was tried against the code and is **wrong**. Ten keys are written and unread, and they are forensic: `ceremonyId`, `secondFactorCleared`, `targetUsername`. The chain is the record, and a record exists to be verified, not to be summarised. What makes this increment's field different is that the product asked a person for it and told them it would be read.

**The digest.** It counts these acts already, under Increment 1.101's label. A reason is a sentence about one incident, and a weekly figure is not where a sentence belongs.

## Increment 1.103

Increment 1.96 found one figure behind two doors: `GET /api/controls/policy` answered at `user` while `GET /api/controls/risk` needed `manager` for the same dual-release thresholds. **Where one thing has two doors, the looser decides.** A sweep of every route's rank found the same shape again.

`GET /api/reason-codes` opens at `user`, and the route's own comment says why:

> "Anyone who posts needs to read them, because the posting forms are built from them."

True of the code, the kind, the wording, and whether a reason is still offered. **Not true of the other two fields it returned.**

- **`requiresApprovalOverCents`** — the dollar line above which a posting on that reason waits for a second person.
- **`entries`** — how many ledger entries in the practice cite it.

Neither reaches a form. `reasonOptionsForPosting` and `allReasonOptions`, the only two functions the posting screens build their menus with, read `code`, `kind`, `label` and `active`. **No screen below `manager` has ever read either field**: the threshold surfaces on the reason-codes table, whose acts need `admin`, and on Practice Risk, which needs `manager`.

So every seat that posts held the figure under which a write-off gets no second pair of eyes. That is the one number somebody structuring beneath a control would want, and the product handed it over as a side effect of a payload shape.

## What it does now

`reasonCodesForViewer` decides by rank. `manager` and above read the practice's governance of its own reasons; everybody else reads the list their forms are built from. The narrowing is a type, `PostingReasonCode`, so a screen cannot ask for a field a rank was not given — the compiler produced nine errors the moment it existed, one per place that had been reading a governed field without knowing it.

**The screen stayed open.** A seat below `manager` still reads the reason-codes table: which reasons exist, what they read as, which are retired. It was tempting to refuse the whole screen, which is one line rather than a column-by-column narrowing — but Increment 1.45 put that list there for the person who has to choose among the reasons, and taking the screen away to close a leak in two of its columns would fix the leak by removing something else. The two governed columns are **absent rather than blank**: a blank in a threshold column reads as "no second person needed".

**Red-before, measured.** Without the increment the browser case fails on `expected 3 to be +0` — the "Second person over" column heading, present in each of the three reason groups on the front desk's own screen.

**Tests.** App unit (5): the narrowed row's exact fields; the **dropped-field gate**, which reads both objects and fails the day the difference between them stops being the two fields somebody decided on; `manager` and `admin` receiving the governance; every rank below `manager` receiving the narrower list; and every rank the product has being decided, so a sixth cannot slip through unconsidered. Browser (2 assertions added to the existing case): the front desk's screen carries neither column and neither figure, and the route answers that seat with exactly `active, code, kind, label, reserved` — read from inside the page, so the request carries that seat's own sign-in — while the owner's answer carries all seven.

## Not in Increment 1.103

**Telling the person posting that their entry will wait.** There is a good product argument for it: somebody about to post $600 under a reason that holds at $500 is better off knowing before they press than after. But that is a sentence the posting screen would say about *this* posting, computed where the hold is decided, not a table of every reason's line handed to every seat. It is worth building; it is not what removing a leak looks like.

**A gate over route ranks generally.** `routeRanks.test.ts` pins the one pair Increment 1.96 found, and this increment's gate pins the fields rather than the rank. A rule that every route's rank must match some other route's is not a rule the product has — the ranks differ for reasons, and a check that cannot say which pairs are the same material would fail honest ones.

**The entry count.** It went behind the same door as the threshold, on the weaker argument: a per-reason census of the practice's ledger is not something a seat needs to post, and the two fields travel together in the same payload. If the practice ever wants a posting seat to see how established a reason is, that is a decision to make on its own.

