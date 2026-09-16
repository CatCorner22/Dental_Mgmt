# Competitive enhancement review and Phase 0 increment

> Source: owner review of 2026-09-14. The owner asked for a comprehensive, beautiful, low-cognitive-load dental PMS with an industry-leading one-way SuperByte note advisor (twin deterministic and probabilistic knowledge bases; see Smile Notes) and a novel Precog risk-avoidance module. Two decisions lock this document: start Phase 0 of the real product, and keep SuperByte one-way (staff never prompt, chat, or rate). Evidence for market claims is the v3 knowledge base (`knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md`, `knowledge/semantic-memory.md`). Legal statements inherit the PRIMARY / SECONDARY / REPO / UNVERIFIED labels from `docs/11`.

This repository remains a consolidation plan plus a clickable prototype. Increment 0.1, recorded here, is the first code foundation of the merged PMS. Increment 0.2 wires the sessions table and `/api/me`. Increment 0.3 makes the database real: migrations that apply, roles that exist, and a verifier that reads a live chain. Increment 0.4 forces MFA enrollment on first login and seeds two Postgres tenants without `AUTH_DEV_MEMORY`. Increment 0.5 splits ledger appends to `app_append`, records nightly chain checks, and schedules the verifier. Increment 0.6 adds the `disclosures` schema and a two-admin recovery ceremony. Increment 0.7 anchors signed chain heads to Object Lock storage. Increment 0.8 wires the disclosure egress pattern and tenant-wide session revoke for incident response. Increment 0.9 adds golden snapshot tests for every exported controls-engine scorer. Increment 0.10 adds the restore drill CLI. Increment 0.11 refuses `DEV_MFA_KEY` in production boot and adds the PHI-free usage-metrics package. Increment 1.1 lays the ledger kernel, Increment 1.2 the approvals inbox, Increment 1.12 wires Precog to live rows, and Increment 1.13 has the database re-check dual release on insert and adds the nightly snapshot job. Owner-only Phase 0 items (BAA, hosting contract, 24-month budget, D.8 interviews) stay listed, not silently marked done.

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

## Risks that stay visible

- Lifting Smile Notes tests while inverting the PHI premise will fail some of those tests; they become a tracked rewrite list, not a reason to leave PHI-blocking rules in place.
- Precog math is illustrative. Shipping scores before golden tests is a liability.
- SuperByte's 3-read cost model must not auto-fire on every keystroke in a PHI product.
- Solo-team capacity: Increment 0.1 is the only honest Phase 0 slice for one engagement. Decision 23 (budget and staffing) is still the gate on Phase 1 durations.
