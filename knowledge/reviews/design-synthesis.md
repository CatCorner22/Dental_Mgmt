# Design synthesis (winner controls-trust with grafts)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 16 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, synthesis

## Summary

One cloud dental practice management system for independent general practices (1–3 dentists at launch; 2–9 location groups on the growth path) whose organizing promise is that the owner can trust the money and the team can run the whole day in it. Three struct…

## Product vision

One cloud dental practice management system for independent general practices (1–3 dentists at launch; 2–9 location groups on the growth path) whose organizing promise is that the owner can trust the money and the team can run the whole day in it. Three structural bets the incumbents cannot retrofit: (1) a readable, append-only ledger — every balance is a sum over visible, reason-coded, approver-attributed entries with explicit payment allocation; insurance estimates never enter it; 'Explain this balance' renders one plain sentence per open procedure; (2) internal controls that are ENFORCED inside the posting transaction rather than recommended in a report — Precog's dual-release evaluator refuses an over-threshold refund/write-off/adjustment without a distinct second approver, segregation-of-duties conflicts are detected from the roles the PMS itself grants, the day sheet reconciles to the actual bank deposit every morning, and a dated decision journal produces the control register a CPA, carrier or Board investigator will accept; (3) a chairside record built around Smile Notes' deterministic, versioned documentation gate and the structural rule that every note, perio exam, image and procedure carries a NOT NULL encounter FK — with a keyboard-first six-point perio a single hygienist completes inside the appointment. The product is designed, demoed and marketed to the office manager and hygienist (no vendor does), sells to the owner on the 48%-embezzled / 17%-caught-by-design evidence, and ships the market's cheapest differentiators as decisions: a published rate card with year-two price, one per-location billing unit with unlimited users, contractual no-fee self-service exit including DICOM, a public status page with incident history, and no per-use AI metering. It is HIPAA-grade by construction (tenant isolation with RLS, MFA on every account, hash-chained audit and PHI-read logs on an INSERT-only role, BAA-gated connectors) and it goes to market as a financial-controls layer beside the incumbent PMS first, so the novel thesis earns revenue and a falsifier before the full PMS exists.

## Guiding principles

- Controls are enforced in the transaction path, never merely recorded: evaluateRelease() runs server-side inside the same Postgres transaction as the ledger write and can refuse; a client-computed verdict is never authorization. The in-product Controls screen shows the 'recorded vs enforced' table so the owner knows which controls refuse and which merely surface.
- The ledger is a journal, not a balance: balances are sums over append-only entries; corrections are reversal-plus-repost; every row carries a typed kind, reason code, frozen poster name and explicit allocation to the charge it paid; estimates live in their own table and are shown beside, never inside, the balance. AR is split into patient / primary-insurance / secondary-insurance / unapplied so estimated write-offs can never contaminate a balance.
- The bank is the only independent ground truth: daily deposit-to-day-sheet reconciliation with an owner-cleared variance queue is a first-class screen fed by data the PMS did not generate; 'independent reconciliation' is measured (match rate, median lag), never a self-asserted boolean.
- Test the novel thesis first, port the mature code second: the readable ledger + enforced controls + reconciliation ship as a financial layer beside the incumbent PMS in Phase 1 because they are the unproven bet; the Smile Notes clinical core (201 test files) is the lowest-risk code and follows once encounters exist.
- Every state change emits a domain event in the same transaction (transactional outbox); audit log, PHI access log, controls engine, anomaly detectors, digests and webhooks are consumers of that stream, never logged by convention at call sites.
- Immutability is a database property: ledger, allocations, approvals, control decisions, claim events, filed notes, audit and access logs are written by an INSERT-only role with UPDATE/DELETE revoked, BEFORE triggers as a second lock, per-row HMAC chaining, and a sealed independent verifier (byteaudit pattern) that restates the promises rather than importing them.
- Authorization is derived per request from a fresh database row inside one default-deny wrapper (withGuard) that sets RLS context; a CI test globs every route file and fails on any unwrapped handler. Three orthogonal authority axes: administrative rank (roles.ts), clinical licence (clinicalRoles.ts), financial entitlement (Precog's 14 entitlements + PMS additions). SoD is a live query over the third axis.
- Tenant on every row, RLS as the backstop; frozen attribution everywhere (names snapshotted at write time, no FK) so records outlive accounts and a rename or merge can never rewrite history.
- Attachment is structural, never a label: NOT NULL encounter_id on every clinical row, NOT NULL procedure FK on every charge, explicit allocation rows between payments and charges. This eliminates Curve's orphaned-note failure class and Open Dental's hidden-payment class by construction.
- Home is the work, not a dashboard: each persona lands on its live worklist (Board, Chairs, Money Desk, Daily Close) and a persistent Patient Rail is the primary navigation object; a Cmd/Ctrl-K palette finds any patient, claim, appointment or action by its plain name.
- Fewer words, bigger targets at every gate: one verb line plus one control at every blocking message, 44px targets with 8px gaps on all pointer types, validation silent until blur, severity encoded by shape + word + monotonic luminance, named omission licences instead of forced blanks, two visual identities for irreversible (file/post/close) vs reversible (print/preview) actions.
- The compliant path is the fastest path: mask before waive, one-tap ranked starters before free text, and where a control has an override the override is the slow lane with a reason code that is aggregated, not buried. Dual release ships WITH its scoped, dated, owner-approved exception system, never after.
- Never score people; score control design and residual risk. No letter grades, badges, points, leaderboards or per-person rankings on any surface; person-scoped signals are visible only to the owner and a designated reviewer seat; findings that flag most of the practice are re-scoped to the practice (digest SYSTEMIC_SHARE rule). This is a walkout trigger and a liability posture, not a preference.
- Signals are batched and practice-scoped; hard events are immediate: a small named set (after-hours refund, retroactive-dated entry, waived dual control, deposit variance over threshold, audit-chain failure, new device on a financial role) pages the owner individually; everything else flows into the weekly digest with acknowledgment stamping.
- PHI leaves the tenant only through a named, logged, BAA-gated boundary: Smile Notes' PHI gate inverts from 'the app holds no PHI' to 'this field may cross to this BAA-covered destination'; every AI call, export, print, fax, SMS and portal send is a disclosure row; a connector is disabled at the registry until a countersigned BAA row exists — from the first integration, not a later compliance module.
- Refuse to start rather than silently degrade: production boots only with verify-full TLS Postgres, a KMS key, a backup target and the append-only role present; PGlite is for tests only; restore drills are scheduled jobs that write their own audit row.
- Deterministic first, model second, human always: every AI capability has a shipped deterministic twin, passes verifyMeaning and evidence pinning, shows source spans and never a confidence percentage; AI is included in the price or off, never metered.
- Every rule, weight, prompt, scoring constant and schema is versioned and stamped onto the record it produced (RULESET_VERSION, SCORING_VERSION, CONTROL_RULEBOOK_VERSION, ASSIST_PROMPT_VERSION, migration id) and CI fails an unbumped change; Precog constants are labelled directional/educational until calibrated.
- Publish what nobody publishes: full rate card, year-two price, exit and export terms, uptime history, incident post-mortems, subprocessor list with BAA status. Never claim 'HIPAA compliant', 'lawsuit-proof', 'board-proof', 'AI-powered' or indemnity ROI.
- Honest, bounded offline: v1 ships durable autosave plus a read-only degraded mode (today's schedule, alerts, chart summaries, encrypted with a session-derived key, disabled on shared devices); queued clinical capture is a v2 decision made from measured outage minutes; financial postings, approvals and claims are never offline because controls cannot be enforced without the server.
- Migration is a product feature: Open Dental importer first with a published fixed price and public 'what does not convert' list; go-live is refused unless opening AR ties to the incumbent to the cent.
- Learnable by a temp in one shift: role set at provisioning, role-scoped first-run inside the work surface, a public temp quick-start, free self-serve certification drills verified by the real engine — the only available answer to hiring-pool familiarity with Dentrix/Eaglesoft.

## Stack decision

FINAL STACK. Next.js 15 App Router / React 19 / TypeScript on the Node runtime (no Edge), served as long-lived containers rather than serverless; Drizzle ORM on Postgres 16; NextAuth v5 Credentials + otpauth TOTP extended with a server-side sessions table; pg-boss for jobs (queue in Postgres, no Redis subprocessor); Tailwind (stay on the existing v3 pipeline in Phase 0–1; upgrade only when a phase has slack) with the dental Daylight-chart token pipeline (design-tokens.json → src/lib/theme/palette.ts → tokens.ts → CSS) and contrast CI; Radix primitives adopted only for select/dialog/combobox (the a11y gap both repos share); Zod at every boundary behind readJsonRecord; Vitest + Playwright with the dental e2e probes promoted into the blocking CI job. Justification: the dental repo (/home/user/catcorner22/dental) is the only production-grade runtime — 201 test files, wire-level security probes (e2e/headers.mjs, lockout.mjs, mfa.totp.mjs, submission.immutability.mjs), hardened auth/throttle/watermark code, security headers, a runbook — while the precog repo (/home/user/catcorner22/precog) does not build (src/routes/index.tsx is a placeholder), has zero tests, no persistence, a committed PREVIEW_CLIENT_SECRET and Grok-federated better-auth that no BAA will cover. Precog's value is ~1,400 lines of framework-free domain TypeScript that lifts anywhere; nothing in its TanStack/Vite/better-auth/Kysely shell is worth carrying. Mitigation for the judges' NextAuth-beta concern: pin the exact next-auth beta, wrap all session logic behind src/lib/auth/guards.ts so the provider is swappable, and revisit at Phase 4 hardening.

REPO LAYOUT. Grow the dental repo into a pnpm-workspaces monorepo: apps/pms (the Next app), packages/clinical-core (schema, modules, vocab, audit, standardize, extract, verify, compose, readback — pure, no app imports), packages/controls-engine (Precog's sod/controls/scoring/coso/signals — pure, zero app imports enforced by a test the same way byteaudit is), packages/db (Drizzle schema + drizzle-kit migrations + roles), packages/verifier (byteaudit retargeted at ledger/day-close/audit-chain promises, sealed by manifest hash). Precog's git history is NOT carried forward (secret rotation).

DATABASE. Managed Postgres with a signed BAA (AWS RDS or Neon Business/HIPAA tier), PITR and cross-region backups, TLS pinned verify-full by src/lib/db/postgresUrl.ts pinPostgresSslMode (lift verbatim). Shared-schema multi-tenancy: tenant_id uuid NOT NULL on every table, every unique constraint and index, salted into every advisory-lock key (the FNV pattern from src/lib/db/repo/gamify.ts userSpendLockKey; the global ADMIN_GUARD_LOCK constant is replaced). Row-level security on every table keyed on current_setting('app.tenant_id'); the app connects as a non-owner role so RLS cannot be bypassed. Three DB roles: app_rw, app_append (INSERT-only on ledger_entries, allocations, approvals, control_decisions, claim_events, chart_events, clinical_notes_filed, domain_event, phi_access_log; UPDATE/DELETE revoked), app_migrate. Field-level envelope encryption (KMS data key per tenant, AES-GCM) for mfa_secret, SSN, insurance member ids, bank identifiers, portal tokens; names and DOB stay cleartext for search, protected by RLS + access logging, and that choice is documented in the product's own SRA. Identifiers: UUIDv7 primary keys everywhere (time-ordered, opaque, no cross-tenant volume leak) plus per-tenant sequences for user-visible ticket/claim/statement numbers. Money is bigint cents + currency; time is timestamptz with a per-location IANA zone and frozen local-time text on legal artifacts (replaces hard-coded America/New_York in src/lib/tickets/etTime.ts).

MIGRATIONS. drizzle-kit generated SQL migrations applied by a runner with a history table, one transaction per file, shadow-DB dry-run in CI, and a check that fresh-DB and migrated-DB schemas are identical. The hand-rolled src/lib/db/ddl.ts / SCHEMA_BOOT_VERSION mechanism is retired; its CI discipline survives as 'schema.ts changed without a migration file fails the build'. The existing .github/workflows/ci.yml version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION) carry over and gain SCORING_VERSION and CONTROL_RULEBOOK_VERSION.

HOSTING. Long-lived Node containers (AWS ECS/Fargate or Fly Machines) behind a WAF, one primary region in Phase 0–2 with cross-region backups and a documented failover runbook, promoted to two-region active/passive at Phase 4 GA hardening (judges: two regions from day one is ops burden a solo team cannot carry; the research's outage complaint is answered by the status page, PITR, restore drills and read-only degraded mode first). Background workers (claim batches, ERA posting, eligibility sweeps, bank sync, reconciliation matching, recall, statements, control snapshots, chain verification) run on pg-boss in a second container against the same Postgres. Object storage: S3 with BAA, SSE-KMS, signed URLs, ClamAV on ingest, Object Lock for the daily audit-chain head and WORM exports. Secrets in a vault with rotation and a dual-key AUTH_SECRET rollover window. Boot guards extended from src/lib/db/backend.ts resolveDbBackend: refuse without POSTGRES_URL (verify-full), KMS key, backup target, object storage config, append-only role.

AUTH AND SESSIONS. Keep src/lib/auth/{auth.ts,auth.config.ts,guards.ts,freshUser.ts,roles.ts,clinicalRoles.ts,approval.ts,throttle.ts,hashGate.ts,clientIp.ts,sessionWatermark.ts,totp.ts,password.ts,passwordPolicy,resetToken.ts,issueResetLink.ts,loginAction.ts,loginFormState.ts,username.ts}. Add: sessions table (server-enforced idle timeout — 10 minutes on the operatory device profile, 30 on desk, 12h absolute — with active-session list and per-device revoke; watermark retained as belt-and-braces), mandatory TOTP with hashed recovery codes for every role (retire src/lib/auth/mfaFeature.ts default-off), a two-admin dual-control recovery ceremony replacing the ADMIN_PASSWORD_RESET env break-glass, envelope-encrypted mfa_secret, and requireAccess(req, {tenant, minRank, entitlements[], clinicalScope?, locationScope?, phiRead?}) returning a fresh-row SessionUser. withGuard(handler, opts) wraps every route handler and server action: session → fresh user row → tenant/location scope → SET LOCAL app.tenant_id/app.user_id → Origin/Sec-Fetch-Site + Content-Type + body-size checks (pattern from precog src/lib/auth/isolation.server.ts) → phi_access_log row when phiRead names records → typed 401/403. A CI test globs src/app/api/**/route.ts and **/*.action.ts and fails on any bare export.

API. Internal: route handlers and server actions behind withGuard; keyset pagination (convert src/lib/http/pagination.ts); every money-moving handler calls the ledger service, never the tables. External: read-only OpenAPI v1 (zod-to-openapi) in Phase 2 for the practice's accountant, write access + HMAC webhooks + sandbox tenants in Phase 5; per-tenant keys hashed at rest, enabled only when a countersigned BAA row exists in the registry. FHIR R4 subset later once encounters and codes exist. Nonce-based CSP replaces 'unsafe-inline' when portal/intake HTML ships.

MIGRATION PATH FOR DENTAL CODE (Next.js/Drizzle). Lift verbatim into packages/clinical-core: src/lib/schema/{types.ts,conditions.ts,scopeGuard.ts,validateNoteState.ts}; src/lib/modules/** (33 modules); src/lib/vocab/** (teeth, surfaces, shorthand, abbreviations, procedures, clinical-terms, plain-language, misspellings, units, lexicons, given-names for the PHI classifier); src/lib/audit/{engine.ts,types.ts,omissions.ts,killers.ts,attestation.ts,tailorForAuthor.ts,byField.ts,maskPhi.ts,rules/**,precision/**}; src/lib/compose/{composeNote.ts,composeAuditReport.ts,filedNoteEqual.ts}; src/lib/standardize/**; src/lib/extract/**; src/lib/verify/**; src/lib/readback/readbackClass.ts; src/lib/scope/authorCapabilities.ts; src/lib/packs/**; src/lib/state/noteReducer.ts. Keep runTextAudit pure — tenant_id/encounter_id/jurisdiction are passed as arguments, never threaded through module state. Lift verbatim into apps/pms: src/lib/auth/** (as above), src/lib/db/{backend.ts,postgresUrl.ts,int4.ts}, src/lib/http/{readJson.ts,pagination.ts}, src/lib/export/csv.ts, src/lib/email/threading.ts, src/lib/learning/redact.ts (standard redactor for every analytics/support path), src/lib/digest/{digest.ts,similarity.ts,filingRollup.ts,metrics.ts}, src/lib/dictation/** (behind the engine seam; browser SpeechRecognition disabled for PHI fields), src/lib/assist/** and src/lib/bytestar/{config.ts,escape.ts,ladder.ts,one-way.ts,router.ts} (behind BAA + field gate), src/lib/theme/**, design-tokens.json, docs/{design-tokens.md,brand.md,model-charter.md}, src/components/builder/{NoteForm.tsx,AuditPanel.tsx,PasteIntake.tsx,FastLane.tsx,FastLanePackOffer.tsx,PinnedMyBlocks.tsx,SuggestedBlocks.tsx,ReadbackConfirm.tsx,NoteReadback.tsx,SectionReview.tsx,CheckNoteSummary.tsx,fields/*}, src/components/shell/{AppHeader.tsx,BrandMark.tsx,BrandFooter.tsx,NavLinks.tsx,NavMenu.tsx,DisplaySettings.tsx,SignOutButton.tsx}, e2e/*.mjs, .github/workflows/ci.yml. Adapt: src/lib/db/repo/auditLog.ts → domain_event writer with chain + ip/ua; src/lib/db/repo/gamify.ts → ledger_entries template (points → cents, keep partial-unique idempotency, advisory lock, refund-by-append); src/lib/db/repo/submissions.ts fileSubmissionAtomic → signNoteAtomic keyed on encounter and closeDayAtomic; src/lib/db/repo/drafts.ts OCC + revision ring → notes, perio exams, treatment plans; src/lib/db/repo/practicePacks.ts maker-checker + practice_pack_events → approval_request/approval_decision with compare-and-set; src/lib/db/repo/users.ts (isCreatureOf, mutateAdminGuarded, mergeUsers) → tenant-scoped; src/lib/db/repo/offices.ts → locations as a real boundary; src/lib/db/repo/wishes.ts + src/lib/wishes/wishes.ts → PHI-gated anonymous tip/observation intake; src/lib/client/{autosaveMachine.ts,useAutosave.ts} → generic resource URL; src/lib/client/draftBackup.ts → encrypted with session-derived key, disabled on shared-device profile; src/components/builder/Odontogram.tsx → editable with history layer; src/components/builder/SharedTabletIdleLock.tsx → server-enforced; src/lib/law/{tn-law.ts,license-scope.ts} → jurisdiction key; src/lib/audit/rules/{phi.ts,phi-secondary.ts} → demoted from S0 filing block to outbound-boundary classifier; src/lib/audit/rules/supervision.ts → also a scheduling validator; src/lib/byteaudit/{contract.ts,verify.ts,seal.ts,manifest.ts} → retargeted contract; src/lib/risk/categories.ts → folded into the findings register; src/lib/training/{scenarios.ts,synthetic-notes.ts,persona-agents.ts} → certification drills (IQ/generation fields removed); src/components/builder/BuilderShell.tsx (2,127 LOC) → decomposed into NoteEditor / Gates / Handoff / Context panels mounted inside the Encounter page. Rewritten: src/lib/db/schema.ts (tenant_id everywhere, new entities), src/lib/db/ddl.ts + client.ts bootstrap (drizzle-kit), src/middleware.ts (portal realm), src/lib/practice/config.ts (→ tenant seed data), ~100 'identifiers live in the EDR' strings. Deleted: src/lib/gamify/**, src/lib/gpa/**, src/lib/stats/{badges.ts,sparkle.ts character content}, src/app/api/store/**, src/lib/requests/gauntlet.ts UI + src/components/requests/GauntletForm.tsx, src/lib/edr/product.ts, src/lib/email/sendSubmission.ts as export, src/lib/law/watch.ts + src/lib/email/sendLawWatchAlert.ts + src/app/api/law-watch/** as a product feature (keep timingSafeEqualStr for webhook secrets), src/components/risk/RiskManagement.tsx, src/components/builder/PhiOverrideDialog.tsx as a waiver for in-record identifiers, src/lib/auth/mfaFeature.ts.

MIGRATION PATH FOR PRECOG CODE (TanStack/Kysely). Copy into packages/controls-engine as pure TypeScript with one mechanical refactor — every `import ... from '../demo-data'` becomes a parameter on a PracticeState { people, grants, controls, knowledge, staff, variables, policy, exceptions } built by a repository from live tenant rows: src/lib/precog/sod/conflict-rules.ts verbatim; src/lib/precog/sod/detect.ts with people/buildAssignments replaced by RoleAssignment[] from user_entitlements (ROLE_TEMPLATES become the six seeded PMS roles); src/lib/precog/controls/dual-release.ts with personById/listEligibleApprovers taking a repository interface, evaluateRelease server-only, waive_dual Infinity replaced by a discriminated `unbounded` flag, DualReleasePolicy/ThresholdException persisted as control_policies/control_exceptions; src/lib/precog/scoring/weights.ts verbatim into a versioned constants table; src/lib/precog/scoring/residual-engine.ts with id-substring factor derivation replaced by typed ControlRecord fields (fraud_opportunity_class, asset_exposure, duty_family, segregated); src/lib/precog/coso.ts as assessCoso(state) with P9/P11 driven by grant events; src/lib/precog/scoring/{dynamic-variables.ts,variable-cascade.ts,scenario-compare.ts} with the timeline sign convention fixed and asserted one way (p50 = time to material impact; stronger controls stretch it); src/lib/precog/ml/leading-indicators.ts renamed signals/ (it is a weighted threshold composite); src/lib/precog/rag/{corpus.ts,retrieve.ts} as in-product guidance; src/lib/precog/practice-profile.ts DecisionEntry → control_decisions table; src/lib/precog/threat-scoring.ts deriveRoe() remediation copy retained with military vocabulary removed; src/lib/precog/llm/reasoning/{beam-search.ts,counterfactual.ts} only after fixing the dropped status-quo node and the counterfactual-ignores-variables bug with tests; src/lib/precog/coach/context-pack.ts reshaped to role labels only; src/lib/precog/llm/tools.ts ToolResult contract; src/lib/precog/stats/README.md as the spec for the Phase 4 forensic suite. Golden-value + monotonicity tests are written for every lifted function before any score is shown. The six keeper panels (src/components/precog/{sod-panel,dual-release-panel,residual-radar,coso-heatmap,decision-journal,cascade-panel}.tsx) are re-implemented as Next components on dental tokens. Deleted: src/routes/**, src/lib/auth/** (Grok federation), src/lib/db.ts, src/lib/multiplayer/**, src/lib/precog/{map-vision.ts,practice-context.tsx,demo-data.ts (→ test fixture only)}, src/lib/precog/ml/{features,anomaly,forecast}.ts, src/lib/precog/llm/{multi-agent.ts,johari-applications.ts,meta-analysis.ts UI (gap list kept as backlog doc),agent-loop.ts Grok fetch}, src/components/precog/{threat-assessment,johari-panel,meta-analysis-panel,advanced-reasoning-panel,layers-panel,intelligence-panel,process-map}.tsx, AGENTS.md, scripts/, vite plugins.

## Modules


### Item 1
- **name**: Tenancy, Identity, Sessions and Authorization Spine
**purpose**

Multi-tenant practice → location model; per-user identity (no shared logins), mandatory TOTP with recovery codes, server-side sessions with idle timeout and per-device kill, three-axis roles (admin rank / clinical licence / financial entitlements), default-deny withGuard wrapper that sets RLS context and writes PHI reads, two-admin break-glass, location as an authorization boundary for financial and roster data.

**reuse from**

/home/user/catcorner22/dental/src/lib/auth/guards.ts, auth.ts, auth.config.ts, roles.ts (MANAGE_CEILING), clinicalRoles.ts, approval.ts, throttle.ts, hashGate.ts, clientIp.ts, sessionWatermark.ts, totp.ts, password.ts, passwordPolicy, resetToken.ts, issueResetLink.ts, loginAction.ts, loginFormState.ts (sanitizeCallbackPath), freshUser.ts, username.ts; /home/user/catcorner22/dental/src/app/api/me/mfa/route.ts; /home/user/catcorner22/dental/src/app/api/me/sessions/route.ts; /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts; /home/user/catcorner22/dental/src/lib/db/repo/users.ts (isCreatureOf, mutateAdminGuarded, mergeUsers, last-admin guard); /home/user/catcorner22/dental/src/lib/db/repo/offices.ts (shape only); /home/user/catcorner22/dental/src/middleware.ts; /home/user/catcorner22/dental/next.config.mjs headers; /home/user/catcorner22/dental/e2e/{headers,lockout,mfa.totp,account.lifecycle,setup.firstboot}.mjs; /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts (14 entitlements → financial axis); /home/user/catcorner22/precog/src/lib/precog/sod/detect.ts ROLE_TEMPLATES (six default roles); pattern only from /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts and verify.server.ts.

**build new**

tenants, locations, sessions (device_profile operatory|desk, idle 10/30 min, absolute 12h, revoked_at), mfa_recovery_codes (hashed), user_entitlements as an append-only grant event log (user, entitlement, location_id nullable, granted_by frozen, effective range), staff_credentials with expiries, withGuard() + requireAccess() with SET LOCAL app.tenant_id, RLS policies on every table, CI route-glob guard test, Origin/Sec-Fetch-Site/Content-Type checks, envelope-encrypted mfa_secret, two-admin dual-control recovery ceremony replacing ADMIN_PASSWORD_RESET, tenant-salted advisory locks, per-tenant sequences.

- **priority**: v1-core
- **ux notes**: Role set at provisioning, never day-of. Setup wizard seeds ROLE_TEMPLATES and shows the SoD conflicts each default creates before the first login is issued — setup is the first assessment. Shared operatory tablets: device profile with PIN/badge author switch that wipes local state, 10-minute idle lock that actually kills the session. Login failure copy byte-identical across causes.

### Item 2
- **name**: Tamper-Evident Event Stream, Audit Log and PHI Access Log
**purpose**

Transactional outbox (domain_event) written in the same transaction as every business write and consumed by audit rendering, controls engine, detectors, digests and webhooks; hash-chained append-only audit with ip/ua; separate high-volume phi_access_log with purpose and break-glass justification; disclosures accounting (print/export/fax/sms/portal/ai); nightly chain verification; daily chain head to Object Lock; plain-sentence rendering; 6-year retention with legal hold.

**reuse from**

/home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts (single write point, per-column caps, marked truncation, frozen actor, security filter); /home/user/catcorner22/dental/src/lib/byteaudit/{contract.ts,verify.ts,seal.ts,manifest.ts} (sealed independent verifier, retargeted); /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts event-log shape; /home/user/catcorner22/dental/src/lib/audit/attestation.ts (isValidPhiAttestation for break-glass justification); /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts ('authorization mirrors the screen'); /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts timingSafeEqualStr; /home/user/catcorner22/dental/src/app/api/assist/route.ts one-parseable-row-per-call pattern.

**build new**

domain_event (partitioned monthly, prev_hash/row_hash HMAC per tenant), phi_access_log (partitioned, purpose enum treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms), disclosures, audit_chain_checks, app_append role + BEFORE triggers, nightly verifier job writing its own row, WORM export, 'explain this row' sentence renderer, monthly log-review task that produces an attested row, retention_holds and destruction_log.

- **priority**: v1-core
- **ux notes**: Owner/compliance view reads as sentences ('Sarah reversed payment #4412 at 4:12pm, reason: posted to wrong account'). Default filter hides routine sign-ins. Every export shows the row count actually rendered.

### Item 3
- **name**: Patients, Accounts and Coverage
- **purpose**: Patient demographics, guardians/responsible parties, family guarantor accounts, un-collapsible critical alerts, consent objects, insurance carriers/plans/coverages with primary/secondary rank and effective dates, fee schedules per plan per provider in one place, eligibility snapshots, documents, patient merge with frozen history, records-request workflow.
**reuse from**

new entity; /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts + phi-secondary.ts + maskPhi.ts as the outbound-boundary classifier for exports; /home/user/catcorner22/dental/src/lib/vocab/given-names.ts for the classifier; /home/user/catcorner22/dental/src/lib/http/{readJson.ts,pagination.ts} and /home/user/catcorner22/dental/src/lib/db/int4.ts for input hygiene; consent enumeration from /home/user/catcorner22/dental/skill/references/tennessee-dental-law-summary.md and terminology-and-style.md; alert channel pattern from /home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md.

**build new**

patients (mrn per-tenant, ssn_enc), patient_relationships, guarantor_accounts + account_members, patient_alerts, consents (decision enum, consenting party + relationship, interpreter, clinical vs marketing image scope), insurance_carriers, insurance_plans (coverage_rules jsonb), patient_coverage (rank, subscriber, member_id_enc, effective range), fee_schedules + fee_schedule_lines (maker-checker edited), eligibility_checks (append-only frozen 271), documents (object key, sha256, virus-scanned, retention class), duplicate detection, merge-as-event, restricted-patient break-glass, records_requests with 10-working-day SLA and full-record export, retention_until computed from last contact + age (TN 7y adult / 10y minor, longer wins).

- **priority**: v1-core
**ux notes**

Persistent Patient Rail (Curve Sidekick pattern) on every patient-scoped screen: identity, critical alerts (red, uncollapsible), coverage + eligibility flag, balance as three labeled numbers with 'Explain', next/last appointment, open plan, recall, one-tap jumps to Chart · Notes · Perio · Imaging · Plan · Ledger · Claims · Docs. Privacy mode hides names on operatory glass. Two-identifier confirmation is a real technical control because the PMS owns the chart.


### Item 4
- **name**: Readable Ledger, Checkout and Payments
**purpose**

The signature module: one canonical append-only patient/account ledger in integer cents with explicit payment allocation, typed reason-coded entries, reversal-not-edit corrections, AR split by GL bucket (patient / primary insurance / secondary insurance / unapplied), estimates in a separate table shown beside the balance, 'Explain this balance' plain-language renderer, statements, day sheet, frozen day close, tokenized card processing (PCI SAQ-A), property-tested invariants enforced in Postgres.

**reuse from**

/home/user/catcorner22/dental/src/lib/db/repo/gamify.ts (balance = sum(delta), partial unique index idempotency, pg_advisory_xact_lock serialization, refund-by-append — points → cents); /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts fileSubmissionAtomic (transaction shape for posting and day close); /home/user/catcorner22/dental/src/lib/compose/filedNoteEqual.ts (dedupe on rendered artifact for statements); /home/user/catcorner22/dental/src/lib/export/csv.ts; frozen-attribution convention from /home/user/catcorner22/dental/src/lib/db/schema.ts; /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts evaluateRelease called inside the posting transaction.

**build new**

ledger_entries (kind charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer|reversal, amount_cents, gl_bucket patient_ar|ins_ar_primary|ins_ar_secondary|unapplied_credit|undeposited_funds, reason_code_id REQUIRED for adjustment/write_off/refund/reversal, posted_by frozen, encounter/procedure/claim/era_line refs, reverses_entry_id, approval_request_id, idempotency_key, tender, prev_hash/row_hash), payment_allocations (payment → charge, cents), reason_codes (typed, requires_approval_over_cents, maker-checker), estimates (never in balance), statements (frozen render), deposits + deposit_lines, day_closes (frozen totals by tender/kind, AR opening/closing, hash, verified closing = opening + charges − payments − adjustments ± reversals), account_balance views, ledger_explanations function, hosted-field processor integration + card-batch settlement import, property-test suite over 10,000 generated scenarios (dual payer, partial payments, secondary posting, reversals, refunds) written BEFORE any UI. DB-enforced invariants: INSERT-only role + BEFORE triggers; allocation ≤ payment and ≤ charge (trigger); reversal must reference an unreversed original of the same account and mirror it (trigger); an entry whose reason_code requires approval or whose amount exceeds the channel threshold must carry an approval_request_id in an approved status (trigger re-check so no code path bypasses evaluateRelease); charge entries require procedure_id; insurance_payment/contractual_adjustment require claim_id + coverage_id; effective_date > N days before posted_at emits a retroactive-edit event.

- **priority**: v1-core
**ux notes**

Exactly one ledger (never invoice-vs-ledger). Default view chosen from the D.8 reaction test between running-with-allocation-expanders and DOS-grouped itemized; both are toggles over the same rows. 'Explain this balance' renders one sentence per open procedure ('Crown #14 on 3/12: charged $1,180; Delta paid $590 on 4/2; contractual adjustment $190 (Delta PPO); you owe $400'). Balance always shown as three labeled numbers. Checkout closes on one screen in ≤4 clicks; allocation defaults oldest-open-charge and is shown, not hidden; unallocated payments are a visible queue. Post-payment is the reversible teal action; post-adjustment/close-day is the record-committing navy action. Blocked postings show 'Needs a second approver — Dana or Dr. Reagan' with one 'Request approval' control, never a dead end.


### Item 5
- **name**: Controls Enforcement Gate: Dual Release, Approvals, Exceptions
- **purpose**: Precog's evaluateRelease as a server-side authorization layer inside every money-moving transaction (write-off, refund, adjustment over threshold, reversal, vendor create/change, ACH/check release, deposit posting, payroll), scoped/dated threshold exceptions, second-approver inbox, immutable approvals log, owner-override path that is logged and scored.
**reuse from**

/home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts (evaluateRelease 9-state verdict, matchExceptions, resolveEffectiveThreshold, exceptionSpecificity, mitigatedSodRuleIds, activeExceptionSummary); /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts (maker-checker state machine + append-only events, add compare-and-set); /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts decideRedemption (conditional-update pattern); /home/user/catcorner22/dental/src/lib/auth/roles.ts MANAGE_CEILING (who may approve whom); /home/user/catcorner22/precog/src/components/precog/dual-release-panel.tsx (re-implemented on dental tokens).

**build new**

control_policies (per-tenant versioned DualReleasePolicy, new row per change, approved_by frozen, CONTROL_RULEBOOK_VERSION), control_exceptions (raise|lower|force|waive, scope, amount band, effective window, approved_by, residual_note REQUIRED; waive requires owner role and auto-expires), approval_requests (channel, amount, subject, requester, eligible second roles, status per ReleaseStatus, frozen evaluation jsonb, decided_by, decision_reason REQUIRED on decline, CHECK requester ≠ approver) with compare-and-set transitions, approvals_log append-only, postGuarded() helper every money-moving repo function must call (approved → write; needs_second → insert approval_request, write nothing, return 202 with one line + one control; blocked_* → rollback 403 with reasons[]/nextSteps[]), worker executes the held posting on approval with approval_request_id stamped, waive_dual Infinity leak fixed, expiring/active exceptions summary on owner home, denial-suppression rule (write-off after a denial with no appeal event routes through dual release regardless of amount).

- **priority**: v1-core
**ux notes**

The control is an inline card on the refund/write-off form ('Write-off over $150 needs a second approver: Dana or Dr. Reagan are eligible — request now'), not a settings page. Approver gets one tap with ledger context; MFA step-up only on approvals above a configurable high-value band, not every tap. 'This is your 3rd unapproved write-off this month' appears as an inline un-broadcast note. Nobody is named as a threat; findings are about role pairs and control gaps.


### Item 6
- **name**: Bank Reconciliation, Daily Close and Anomaly Signals
**purpose**

Daily ledger-to-deposit-to-bank comparison against data the PMS did not generate (aggregator feed or OFX/CSV statement import), deposit-slip preparation, automatic matching, owner-cleared variance queue with SoD on clearance, detection lag in days, detectors for refunds above threshold / after-hours postings / retroactive edits / void and adjustment velocity / duplicate payments / deposit gaps / copy-forward clusters; forensic screens (Benford, round-number, duplicates) in Phase 4.

**reuse from**

/home/user/catcorner22/precog/src/lib/precog/ml/leading-indicators.ts (composite pattern → signals/); /home/user/catcorner22/precog/src/lib/precog/scoring/dynamic-variables.ts (independentBankRec → measured); /home/user/catcorner22/precog/src/lib/precog/stats/README.md (forensic suite spec); /home/user/catcorner22/dental/src/lib/digest/{digest.ts,similarity.ts,metrics.ts} (batch-not-alert, SYSTEMIC_SHARE re-scoping, min-sample gating, copy-forward discriminator); /home/user/catcorner22/dental/src/lib/stats/computeStats.ts (after-hours rate metric); /home/user/catcorner22/dental/knowledge/sources adversarial-practice-owner-hate.md as acceptance criteria.

**build new**

bank_accounts, bank_transactions (append-only import, external_id unique), reconciliation_runs + reconciliation_matches + reconciliation_variances (reason_code, cleared_by frozen; SoD: whoever posted payments or prepared the deposit for that business day cannot clear that day's variance — configurable owner-only fallback for 1-owner/1-OM practices), control_findings/anomaly_events (practice-level framing; person-scoped detail reviewer-only), nightly detector jobs, digest_acks, hard-event alert channel via BAA-covered email/SMS, forensic suite (Phase 4).

- **priority**: v1-core
- **ux notes**: Owner home IS this screen: 'Yesterday reconciled?' as one shape+word status, three tender rows expected vs bank, one variance number, one clear/investigate action, detection lag in days, approvals waiting on me, expiring exceptions, open SoD findings. Green requires the bank feed or a statement import, never a self-assertion. Hard events are the only push notifications the product sends.

### Item 7
- **name**: SoD Monitor, Residual Risk, COSO Map and Decision Journal (Precog core)
**purpose**

Continuous SoD detection over real entitlement grants; grant-time refusal of critical conflicts without a recorded decision; residual-risk portfolio with named drivers and tornado levers; COSO 17-principle assessment from live state with design vs operating effectiveness distinguished; cascade what-if in settings; append-only decision journal (remediate / compensate / accept_residual / monitor / insure) with review dates; PHI-gated anonymous tip channel.

**reuse from**

/home/user/catcorner22/precog/src/lib/precog/sod/{conflict-rules.ts,detect.ts}; /home/user/catcorner22/precog/src/lib/precog/scoring/{weights.ts,residual-engine.ts,variable-cascade.ts,dynamic-variables.ts,scenario-compare.ts}; /home/user/catcorner22/precog/src/lib/precog/coso.ts; /home/user/catcorner22/precog/src/lib/precog/practice-profile.ts DecisionEntry; /home/user/catcorner22/precog/src/lib/precog/rag/{corpus.ts,retrieve.ts}; /home/user/catcorner22/precog/src/lib/precog/threat-scoring.ts deriveRoe() copy (military skin removed); /home/user/catcorner22/precog/src/lib/precog/llm/reasoning/{beam-search.ts,counterfactual.ts} (after bug fixes + tests); /home/user/catcorner22/precog/src/components/precog/{sod-panel,residual-radar,coso-heatmap,decision-journal,cascade-panel,scenario-runner}.tsx (re-implemented); /home/user/catcorner22/dental/src/lib/risk/categories.ts (coverageByCategory folded into one findings register); /home/user/catcorner22/dental/src/lib/wishes/wishes.ts + /home/user/catcorner22/dental/src/lib/db/repo/wishes.ts + /home/user/catcorner22/dental/src/app/api/wishes/route.ts (tip/observation intake with PHI gate, tenant scope, anonymous option); /home/user/catcorner22/dental/src/lib/audit/precision/ harness pattern for zero-false-block ratcheting.

**build new**

controls_registry (typed ControlRecord replacing demo controls), sod_findings (recomputed on every grant event and nightly; rule_id, person set, severity, score, mitigated_by[], decision_id, rulebook_version; history kept), control_decisions (append-only, owner-attributed, residual_at_decision, review_by, evidence refs), control_snapshots (portfolio, coso, sod, signals jsonb stamped SCORING_VERSION), derived StaffComposition (team size from roster, segregation from segregationHealth, sole-owner knowledge from credentials, tenure from hire_date), measured operating effectiveness (share of over-threshold posts with a second approver, days-to-reconcile, distinct-signer rate), grant-time refusal of critical conflicts unless an owner records accept_residual with review date in the same request (second-admin variant selectable per tenant), versioned constants table, golden + monotonicity tests, recorded-vs-enforced table rendered in-product, tip channel.

- **priority**: v1-core
- **ux notes**: Presented as 'Practice health', never 'threat assessment'; neutral vocabulary (priority queue, next steps, control gap). Findings surface where the cause is: conflict banner + one-sentence fraud path + compensating control at the moment of grant. The heat map is the last owner screen, not the first. Every score shows drivers and deep-links to rows. Constants labelled directional until calibrated.

### Item 8
- **name**: Scheduling and Front Desk Board
- **purpose**: Multi-operatory day/week board, appointment types with behavior contracts, provider schedule templates, confirmations/recall/ASAP waitlist, check-in with eligibility already fetched, supervision-level validation at booking (TN general vs direct; PC1107 effective-dated), per-chair documentation-status strip without PHI leakage, appointment moves/deletes as audited entitlements.
**reuse from**

new; /home/user/catcorner22/dental/src/lib/law/license-scope.ts and /home/user/catcorner22/dental/src/lib/audit/rules/supervision.ts (effective-dated rule → scheduler validator); /home/user/catcorner22/dental/docs/tn-license-scope-mermaid.md as spec; color/shape rules from /home/user/catcorner22/dental/docs/design-tokens.md and /home/user/catcorner22/dental/knowledge/sources/color-theory-uiux.md; acceptance criteria from /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-front-desk.md and adversarial-temp-agency-recruiter.md.

**build new**

operatories, appointment_types (default procedures, duration, color + shape token, behavior flags), provider_schedules, appointments (state machine scheduled→confirmed→arrived→seated→in_chart→note_filed→checked_out|no_show|cancelled, supervision_level, supervising_dentist_id, eligibility_check_id), appointment_events (append-only moves/deletes with reason), appointment_procedures, recall_rules/recall_due, waitlist, 6am eligibility sweep + re-run on arrival, supervision validator, readiness strip.

- **priority**: v1-core
- **ux notes**: Board is the coordinator's home. Arrive = one tap on the card (two-identifier confirmation lives in the chart open, not the arrive tap). Schedule = click slot → 3-letter patient search → type → Save (3 interactions). Supervision refusal is one line + one control ('New patient: needs a dentist exam before hygiene' → 'Add exam'). Status by shape + word, never hue alone.

### Item 9
- **name**: Encounters and Clinical Notes (Smile Notes core, inverted)
**purpose**

The encounter is the spine every clinical object attaches to by NOT NULL FK. Smile Notes' 33-module schema-driven builder, deterministic S0–S4 audit, killer hard gate, named omission licences, attestation tiers, frozen filing stamped RULESET_VERSION, byteaudit verification, addendum chain, paste intake, standardize proposals, Fast Lane packs, practice packs with maker-checker — PHI rules re-scoped from filing block to outbound-boundary classifier.

**reuse from**

/home/user/catcorner22/dental/src/lib/schema/{types.ts,conditions.ts,scopeGuard.ts,validateNoteState.ts}; /home/user/catcorner22/dental/src/lib/modules/** (33 modules + shared.ts PROCEDURE_STATES); /home/user/catcorner22/dental/src/lib/vocab/**; /home/user/catcorner22/dental/src/lib/audit/{engine.ts,types.ts,omissions.ts,killers.ts,attestation.ts,tailorForAuthor.ts,byField.ts,rules/**,precision/**}; /home/user/catcorner22/dental/src/lib/compose/{composeNote.ts,composeAuditReport.ts,filedNoteEqual.ts}; /home/user/catcorner22/dental/src/lib/standardize/**; /home/user/catcorner22/dental/src/lib/extract/**; /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts; /home/user/catcorner22/dental/src/lib/scope/authorCapabilities.ts; /home/user/catcorner22/dental/src/lib/packs/** + /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts; /home/user/catcorner22/dental/src/lib/db/repo/drafts.ts (OCC + revision ring); /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts fileSubmissionAtomic; /home/user/catcorner22/dental/src/lib/byteaudit/**; /home/user/catcorner22/dental/src/lib/client/{autosaveMachine.ts,useAutosave.ts,draftBackup.ts}; /home/user/catcorner22/dental/src/lib/state/noteReducer.ts; /home/user/catcorner22/dental/src/lib/tickets/**; /home/user/catcorner22/dental/src/lib/version.ts + /home/user/catcorner22/dental/.github/workflows/ci.yml guards; /home/user/catcorner22/dental/src/components/builder/{NoteForm,AuditPanel,PasteIntake,FastLane,FastLanePackOffer,PinnedMyBlocks,SuggestedBlocks,ReadbackConfirm,NoteReadback,SectionReview,CheckNoteSummary,PriorNotes,SaveIndicator}.tsx + fields/*; /home/user/catcorner22/dental/skill/assets/dental-note-templates.md as the normative spec; /home/user/catcorner22/dental/e2e/{submission.immutability,conflict,phi.mask-override,dictation}.mjs.

**build new**

encounters (patient, location, appointment, DOS, attending, supervising dentist, kind, status open|signed|amended), clinical_note_drafts (encounter_id NOT NULL, OCC), clinical_notes_filed (frozen markdown/audit/ruleset_version, three identities: entry author / clinical performer / reviewing dentist, immutable by role + trigger), note_amendments (amends_note_id, reason_code), omission_licences counted per note, attestations with second attester for killer class, module field-id deprecation registry + round-trip test, BuilderShell.tsx decomposition into encounter-context panels (runTextAudit stays pure), jurisdiction parameter on TN rules, PHI rules → egress classifier, ~100 EDR strings removed, encrypted session-bound draft mirror disabled on shared devices, medications/allergies/medical_history_snapshot, anesthesia_record with real-timestamp events.

- **priority**: v1-core
**ux notes**

Home is the note: opens cursor-ready inside the encounter with scheduled procedures pre-selecting modules (structure only). Ranked, role-filtered starters (verified blocks, practice packs) always visible as first thumb targets — the honest answer to Curve Favorites/QuickText. Killer strip ≤3 rows + one primary File button; dentist-owned sections locked by licence at the API and shown to auxiliaries as a single handoff strip. Emergency preset triages chief problem → swelling → site → diagnosis → care → escalation. Procedure mode never steals the caret.


### Item 10
- **name**: Odontogram, Procedure Log and Treatment Plans
- **purpose**: Editable chart of record with existing/planned/completed layers over an event log; painted procedures propagate one gesture into chart, plan, note scaffold and pending charge; licensed CDT reference; multiple concurrent phased treatment plans with estimates (never ledger rows), case presentation and acceptance capture; planned→completed conversion gated on encounter completion, not checkout.
**reuse from**

/home/user/catcorner22/dental/src/lib/vocab/{teeth.ts,surfaces.ts,procedures.ts}; /home/user/catcorner22/dental/src/components/builder/Odontogram.tsx (glyph geometry, paint policy → editable); /home/user/catcorner22/dental/src/components/builder/fields/{ToothPicker.tsx,SurfacePicker.tsx} (poka-yoke); /home/user/catcorner22/dental/src/lib/extract/chart.ts (chartMarks, CONTRADICTORY_PAIRS); /home/user/catcorner22/dental/src/lib/audit/rules/anatomy.ts (wrong-site S0); /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts (code-to-finding binding); /home/user/catcorner22/dental/src/lib/modules/shared.ts PROCEDURE_STATES; /home/user/catcorner22/dental/skill/references/tooth-and-surface-notation.md.

**build new**

chart_events (append-only per tooth/surface; status existing|planned|completed|referred; historical flag supplied by a human — the extractor refuses to guess temporality) + chart_current materialized view, cdt_codes (ADA licence, loaded per tenant, never redistributed), procedures (encounter, cdt, teeth, surfaces, provider, fee, status, plan item, charge_entry_id), treatment_plans + phases + items (estimates only), case_presentations, estimate engine over fee_schedule_lines + coverage rules with rule trace, shortcut macros, cross-surface contradiction (chart vs note vs claim) as blocking S0, conversion gate.

- **priority**: v1-core
- **ux notes**: Charting is a painting gesture with role-filtered macro buttons; one gesture writes four records; impossible surfaces disabled at the control; adjacent-tooth mistap has one-tap undo; severity palette never used on the chart; FDI as secondary display. Money lives on the plan card and ledger, never in the note text. 'Why this estimate' expands to the exact coverage rules applied.

### Item 11
- **name**: Periodontal Charting
**purpose**

Six-site full-mouth exam (PD, GM/recession, CAL derived, BOP, suppuration, plaque, mobility, furcation, MGJ) completable by one operator inside the appointment: keyboard/foot-pedal auto-advance grammar in v1, prior-exam ghosting with ≥2mm deltas, summary auto-fills the periodontal module and SRP justification evidence; voice layers on through the DictationEngine seam only with an on-device or BAA engine.

**reuse from**

/home/user/catcorner22/dental/src/lib/dictation/{engine.ts,normalize.ts,availability.ts,enrollment.ts,regional.ts,comprehension.ts}; /home/user/catcorner22/dental/src/lib/modules/periodontal.ts (summary fields become derived outputs); /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts (SRP rule consumes the exam); /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts; /home/user/catcorner22/dental/docs/voice-dictation-architecture.md phases; /home/user/catcorner22/dental/src/components/builder/fields/DictationField.tsx.

- **build new**: perio_exams (encounter_id NOT NULL, examiner frozen), perio_sites (tooth, site 1–6, pd, gm, bop, sup, plaque), perio_tooth (mobility, furcation, mgj), keyboard grammar (1–9 depth, space = BOP, arrows skip, undo-by-key, 168 sites in one continuous pass), compare view, on-device Whisper WASM or BAA STT behind the seam (Phase 5) with a frozen dental WER eval corpus before enablement.
- **priority**: v1-core
- **ux notes**: One tap from chair card to Perio; cursor at UR site 1 on the correct dentition; acceptance test is a full-mouth chart by one operator in under 8 minutes in a timed hygiene simulation (the 60%-skip statistic is the metric to beat, measured practice-level only).

### Item 12
- **name**: Insurance: Eligibility, Claims, ERA Posting
**purpose**

Real-time eligibility at booking and check-in via a clearinghouse adapter (one implementation), claim assembly from encounter procedures with a scrubber that blocks known denial causes and consumes the justification/completeness rules, secondary auto-generation, batch 837D, claims tracker by age/status/next action, 835 review-then-post with line-item match producing insurance_payment + contractual_adjustment entries through the controls gate, denial/appeal worklists, pre-authorizations, EDI enrollment tracker.

**reuse from**

/home/user/catcorner22/dental/src/lib/audit/rules/{justification.ts,completeness.ts} (narrative pre-flight bound to CDT lines); /home/user/catcorner22/dental/src/lib/extract/** (cross-check note facts vs claim lines); /home/user/catcorner22/dental/src/lib/verify/verifyMeaning.ts (any AI-drafted narrative); /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts (claim + ticket + freeze in one transaction; resend exact bytes); /home/user/catcorner22/dental/src/lib/auth/throttle.ts key namespaces (metering clearinghouse calls); /home/user/catcorner22/dental/knowledge/sources/adversarial-insurance-auditor-hate.md as acceptance criteria.

**build new**

claims (state machine, frozen 837 bytes, per-tenant claim_number, primary_claim_id for secondaries), claim_lines (CARC/RARC), claim_events (append-only), claim_attachments, preauthorizations, era_files/era_payments/era_lines (match_status auto|manual|unmatched), scrubber_rules (versioned), clearinghouse adapter interface (DentalXChange or Vyne first), denial worklist, edi_enrollments tracker, denial-suppression detection.

- **priority**: v1-core
**ux notes**

Money Desk (biller home) is three worklists as tabs with counts — ERA exceptions (auto-matched lines already posted), claims aging with next action, denials — plus approvals I can second, unposted encounters, variances I own; every row has one primary action. Pre-flight failures phrase WHAT/WHY/HOW and deep-link to the note field. Eligibility appears as a badge on the appointment; the benefits breakdown is a drawer, not a PDF.


### Item 13
- **name**: Reporting
- **purpose**: Curated report library answering owner/OM questions (production, collections, AR aging by GL bucket, adjustments by reason and role, claims aging, unscheduled treatment, recall, utilization) over the same views every screen reads so totals never disagree; visual filter builder; saved/scheduled PHI-minimal delivery; export mirrors screen authorization.
- **reuse from**: /home/user/catcorner22/dental/src/lib/digest/filingRollup.ts (versioned per-filing snapshot, practice totals only); /home/user/catcorner22/dental/src/lib/digest/metrics.ts; /home/user/catcorner22/dental/src/lib/stats/computeStats.ts (time-to-file, after-hours rate); /home/user/catcorner22/dental/src/lib/export/csv.ts; /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts.
- **build new**: report definitions as SQL views over ledger/claims/schedule, saved filters, filter builder UI, scheduled export job, automated check that every report total reconciles to ledger views.
- **priority**: v1-core
- **ux notes**: Every number links to its rows; same metric, same value, every screen. Practice-level staff metrics only.

### Item 14
- **name**: Data Migration, Conversion and Exit
**purpose**

Report-import ETL (day sheets, AR, patient/coverage headers) for the Phase 1 parallel run; Open Dental full importer first (public MySQL schema), then Dentrix/Eaglesoft via CSV/XML + Apteryx/Schick image folders; published fixed price and timeline; public 'what does not convert' list; tie-out-or-refuse go-live; EDI re-enrollment runner; the mirror image — self-service full export (structured + documents + DICOM) with no payment gate.

**reuse from**

/home/user/catcorner22/dental/src/components/builder/PasteIntake.tsx (human-in-the-loop review); /home/user/catcorner22/dental/src/lib/standardize/structure.ts + /home/user/catcorner22/dental/src/lib/extract/** (legacy free-text notes → structured facts, APPLIED vs FLAGGED); /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts (confirm high-stakes tokens on imported data); /home/user/catcorner22/dental/src/lib/edr/product.ts inverted into a source-system label; /home/user/catcorner22/dental/src/lib/export/csv.ts; /home/user/catcorner22/dental/knowledge/sources/open-dental-fee-schedule.md.

- **build new**: import staging schema, per-source mappers with dry-run diff and per-entity acceptance, conversion cockpit (counts, unmapped codes, unresolved patients, imaging progress), AR tie-out report, export bundle job, payer enrollment tracker.
- **priority**: v1-core
- **ux notes**: Nothing auto-fills a clinical field without a human accept. Opening AR must equal the incumbent to the cent or go-live is refused. Export is a button, not a ticket.

### Item 15
- **name**: Trust Page and Commercial Terms
- **purpose**: Public rate card (one per-location price, unlimited users/providers, every add-on priced, year-two rate), exit and export terms, status page fed by real health checks with incident history and post-mortems, SLA with credits, subprocessor list with BAA status, SOC 2/HIPAA attestation status, in-product cost calculator that cannot produce a surprise.
- **reuse from**: new; content model from the market report C.1 buyer checklist and /home/user/catcorner22/dental/knowledge/sources/open-dental-fee-schedule.md; /home/user/catcorner22/dental/docs/GO-LIVE.md for the runbook shape.
- **build new**: status page, published post-incident report template, pricing page, subprocessor registry view.
- **priority**: v1-core
- **ux notes**: Every one of the six C.1 buyer-checklist questions is answered on one public page.

### Item 16
- **name**: Documents and Imaging (bridge & store)
- **purpose**: Object storage for images, scans, consents, EOBs with signed URLs, virus scan, retention; images live in the encounter, not an external path; TWAIN/DICOM bridge to existing sensor software with a published certified list; basic viewer (no measurement claims); one-click full-history DICOM export at no charge; interpretation as a completeness gate.
- **reuse from**: /home/user/catcorner22/dental/skill/references/sedation-and-imaging.md (universal imaging record, per-structure status enum, CBCT entire-volume rule); /home/user/catcorner22/dental/src/lib/audit/rules/completeness.ts imaging-no-interpretation rule; /home/user/catcorner22/dental/src/lib/modules/imaging.ts.
- **build new**: imaging_studies, images (DICOM tags, sensor, object key, sha256), image_interpretations (dentist frozen, per-structure status), bridge adapter interface, viewer (zoom/contrast), bulk DICOM export job.
- **priority**: v1-nice
- **ux notes**: Images open from the tooth on the odontogram and from the encounter. Documents ship in Phase 3 with the clinical record; sensor bridge and viewer in Phase 4.

### Item 17
- **name**: HIPAA/OSHA Compliance Program
**purpose**

Guided security risk analysis → tailored versioned policies → remediation tracking → server-verified training with certificates; BAA registry (the gating primitive ships in Phase 0) with document management; OSHA logs (sterilizer biological monitoring, 2-year retention); incident intake with TN 45-day / HIPAA 60-day clocks; annual SRA reminder; provisional content labelled provisional pending counsel review.

**reuse from**

/home/user/catcorner22/dental/src/lib/training/{scenarios.ts,synthetic-notes.ts,persona-agents.ts} + /home/user/catcorner22/dental/src/app/api/training/complete/route.ts (server-verified drill pattern); /home/user/catcorner22/dental/src/lib/law/{tn-law.ts,license-scope.ts} rendered in-app; /home/user/catcorner22/dental/skill/references/tennessee-dental-law-summary.md; /home/user/catcorner22/dental/docs/tn-dental-authority-map.md; /home/user/catcorner22/dental/knowledge/sources/{adversarial-it-hipaa-security.md,adversarial-privacy-hipaa-attorney-hate.md} as acceptance criteria; /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts guidance copy; /home/user/catcorner22/precog/src/lib/precog/llm/meta-analysis.ts gap catalog as integration backlog; /home/user/catcorner22/dental/src/components/risk/RiskManagement.tsx content only (rewritten server-side).

- **build new**: sra_questionnaires + responses, policies (versioned, generated, maker-checker approved), training_assignments + completions, business_associates + baas (document, signed_at, expires_at, controls named) — registry itself is Phase 0, compliance_logs, incidents with breach clocks, compliance_tasks, annual SRA reminder.
- **priority**: v1-nice
- **ux notes**: One 'Practice risk' module spanning financial controls, HIPAA and OSHA — the budget line practices already have (Abyde/Patient Protect band). Compliance state recalculates as risks open/close; checklists are attributed server-side attestations.

### Item 18
- **name**: Patient Communications and Portal
- **purpose**: Confirmations/reminders/recall in Phase 4 (v1.x), then two-way texting, online booking against real availability, digital intake writing into the chart, statements and payments online, portal with plain-language visit summaries gated on plain-language/stigma findings, guardian-addressed voice for minors — every channel BAA-gated and every send a disclosure row.
**reuse from**

/home/user/catcorner22/dental/src/lib/vocab/plain-language.ts; audience:'patient' machinery in /home/user/catcorner22/dental/src/lib/audit/engine.ts and rules/{plain-language.ts,stigmatizing}; /home/user/catcorner22/dental/src/lib/email/threading.ts (opaque tokens, header-injection-safe); /home/user/catcorner22/dental/src/lib/email/config.ts single-configured-egress principle → per-channel destination allowlist; /home/user/catcorner22/dental/knowledge/sources/adversarial-parent-portal-language-hate.md.

- **build new**: messages (append-only, channel, direction, template_version), sms/email consents, reminder schedules, intake_forms, portal identity realm (separate auth), portal delivery gate, online booking, statement send job.
- **priority**: v2
- **ux notes**: Portal voice is the opposite of record voice; the standardize pass is disabled on patient-audience fields; an empty summary cannot claim delivery.

### Item 19
- **name**: AI Assist (caged)
- **purpose**: Optional, opt-in, BAA-covered model assistance for note normalization, SOAP partition, extraction, claim-narrative pre-flight and the controls coach; every output passes verifyMeaning and evidence pinning; field-level PHI boundary decides what may leave; deterministic twin for every capability; included in price, never metered; no training on practice data.
**reuse from**

/home/user/catcorner22/dental/src/lib/assist/{service.ts,tier.ts,prompts.ts,schemas.ts,extraction.ts,retrieval.ts,drift.ts,non-goals.ts}; /home/user/catcorner22/dental/src/lib/verify/**; /home/user/catcorner22/dental/src/lib/audit/rules/{phi.ts,phi-secondary.ts} + maskPhi.ts as egress classifier; /home/user/catcorner22/dental/src/lib/bytestar/{config.ts,escape.ts,ladder.ts,one-way.ts,router.ts}; /home/user/catcorner22/dental/docs/model-charter.md; /home/user/catcorner22/dental/docs/bytestar-architect-audit.md; /home/user/catcorner22/dental/src/lib/learning/redact.ts; /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts (names → role labels); /home/user/catcorner22/precog/src/lib/precog/llm/tools.ts ToolResult contract; /home/user/catcorner22/precog/src/lib/precog/rag/retrieve.ts.

- **build new**: provider adapter behind a BAA row (zero-retention endpoint), field-level minimum-necessary filter, per-tenant opt-in, per-call disclosure row (codes/versions/tokens only), ambient-dictation non-goal retired only when an on-device or BAA STT engine exists.
- **priority**: v2
- **ux notes**: AI proposes as ranked, evidence-quoted proposals inside the field; READBACK_CLASS tokens confirmed on accept; 'AI off' never means 'feature gone'.

### Item 20
- **name**: Public API, Interop and Multi-location Growth Path
- **purpose**: Read-only OpenAPI v1 for the practice's accountant in Phase 2; write access, HMAC webhooks and sandbox tenants in Phase 5; FHIR R4 subset later; organization tier above practice for 2–9 location groups with location-scoped financial access, cross-location clinical grants, org/region pack and control-policy catalogs with inheritance, consolidated reconciliation, SAML/OIDC + SCIM.
**reuse from**

/home/user/catcorner22/dental/src/lib/http/{readJson.ts,pagination.ts}; /home/user/catcorner22/dental/src/lib/db/int4.ts; /home/user/catcorner22/dental/src/lib/auth/throttle.ts namespaces; /home/user/catcorner22/dental/src/lib/db/repo/offices.ts (promoted); /home/user/catcorner22/dental/src/lib/packs/** governance (org tier); /home/user/catcorner22/dental/knowledge/sources/adversarial-dso-compliance-vp-hate.md.

- **build new**: api_keys (hashed, scoped), webhook outbox, full-export job, location_grants, organizations, consolidated views, SSO/SCIM, joiner-mover-leaver lifecycle.
- **priority**: later
- **ux notes**: Cross-location browse is a deliberate grant, not the default; no per-site fee.

### Item 21
- **name**: ePrescribing and Medication Safety
- **purpose**: Medication list, allergies, interaction flagging, EPCS via a certified vendor, TN CSMD/PMP check documentation, medication-safety rule set running before send.
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/medication-safety.ts (12 interactions, kg rule, dose reconciliation, opioid/CSMD gate); /home/user/catcorner22/dental/src/lib/audit/rules/anesthetic-dose.ts; /home/user/catcorner22/dental/src/lib/vocab/abbreviations.ts do-not-use list; /home/user/catcorner22/dental/src/lib/modules/medication.ts.
- **build new**: prescriptions, eRx vendor adapter (DoseSpot/DrFirst), per-state PMP rule switch.
- **priority**: v2
- **ux notes**: Flags, never prescribes or computes a dose.

### Item 22
- **name**: Points Economy, Store, Badges, GPA, Sparkle, Gauntlet UI, Threat/Johari/Meta panels, Multiplayer, Grok auth, Law-watch product
- **purpose**: Retired surfaces; see what_to_drop. Extract the append-only ledger pattern, the seeded-deterministic copy mechanism and its ethics tests, the Gauntlet cycles as internal process prose, and the meta-analysis gap list as backlog before deleting.
**reuse from**

/home/user/catcorner22/dental/src/lib/gamify/**, /home/user/catcorner22/dental/src/lib/gpa/deriveGpa.ts, /home/user/catcorner22/dental/src/lib/stats/{badges.ts,sparkle.ts}, /home/user/catcorner22/dental/src/lib/requests/gauntlet.ts, /home/user/catcorner22/dental/src/components/requests/GauntletForm.tsx, /home/user/catcorner22/dental/src/lib/law/watch.ts, /home/user/catcorner22/dental/src/lib/edr/product.ts; /home/user/catcorner22/precog/src/lib/multiplayer/**, /home/user/catcorner22/precog/src/lib/auth/**, /home/user/catcorner22/precog/src/lib/precog/map-vision.ts, /home/user/catcorner22/precog/src/lib/precog/llm/{johari-applications.ts,meta-analysis.ts,multi-agent.ts}, /home/user/catcorner22/precog/src/components/precog/{threat-assessment,johari-panel,meta-analysis-panel,advanced-reasoning-panel,layers-panel}.tsx

- **build new**: nothing
- **priority**: drop
- **ux notes**: A staff currency redeemable for value with single-role approval is a segregation-of-duties finding the product would flag in its own customer.

## Data model

CONVENTIONS. Every table: id uuid v7, tenant_id uuid NOT NULL (RLS policy tenant_id = current_setting('app.tenant_id')::uuid; in every unique constraint and index), created_at timestamptz, created_by_id uuid (no FK) + created_by_name text frozen. User-visible numbers minted from sequences(tenant_id, kind, next). Money bigint amount_cents + currency char(3). Time timestamptz; legal artifacts also store frozen local-time text with the zone from locations.timezone. No soft delete on clinical or financial data; corrections are new rows. Three DB roles (app_rw / app_append / app_migrate); append-only tables additionally carry BEFORE UPDATE/DELETE triggers that RAISE, and event/log tables carry prev_hash/row_hash HMAC chained per tenant.

TENANCY AND IDENTITY. tenants(name, plan, timezone_default, settings, published_price_id) → locations(tenant_id, name, address, timezone, npi, permits, sterilizer refs). users(tenant_id, username, display_name, email, pass_hash, active, admin_rank, clinical_role, mfa_enabled, mfa_secret_enc, recovery_codes_hash[], password_changed_at, sessions_revoked_at, notice_ack_at, hire_date, created_by frozen). sessions(user_id, device_profile operatory|desk, last_seen_at, idle_deadline, absolute_expires, revoked_at, ip, ua). role_templates(tenant_id, name, entitlements[]) seeded from Precog ROLE_TEMPLATES. user_entitlements(user_id, entitlement, location_id nullable, granted_by frozen, effective_from, effective_to) — append-only grant log; entitlement enum = Precog's 14 (collect_cash, post_payments, prepare_deposit, bank_reconcile, approve_writeoffs, post_adjustments, submit_claims, create_vendor, approve_vendor, release_payment, enter_payroll, approve_payroll, pms_admin_roles, view_reports_only) + PMS additions (edit_schedule, delete_appointment, edit_fee_schedule, export_data, break_glass, clear_variance). Three axes: rank (roles.ts ladder), clinical scope (derived per clinicalRoles.ts), financial entitlement (current view over grants). staff_credentials(user_id, kind licence|permit|cert LA/N2O/restorative/radiography/sedation, number, state, expires_at). location_grants reserved for the group tier. auth_throttle, password_reset_tokens (lifted).

PATIENTS AND ACCOUNTS. patients(tenant_id, mrn per-tenant, names, dob, sex, ssn_enc, contact, preferred_language, primary_location_id, status, restricted_flag, last_contact_at, retention_until, deceased_at). patient_relationships(patient_id, related_patient_id|party_id, kind guardian|spouse|responsible, consent_scope). patient_alerts(patient_id, kind allergy|premed|anticoagulant|latex|behavioral|guardianship|financial_hold|critical_note, text, severity, entered_by frozen, active) — its own table so it cannot be collapsed. guarantor_accounts(tenant_id, guarantor_party, statement_cycle, hold) + account_members(account_id, patient_id); a patient belongs to exactly one active account; every ledger row carries both account_id and patient_id. consents(patient_id, encounter_id, procedure_ids[], kind, decision agreed|declined|deferred|other_option, consenting_party, relationship, interpreter, questions_text, scope clinical|marketing, signed_document_id). medical_history_snapshots(encounter_id, jsonb, reviewed_by frozen), medications, allergies. documents(tenant_id, patient_id, encounter_id nullable, kind, object_key, sha256, mime, size, scanned_at, phi bool, retention_class, legal_hold). records_requests(received_at, due_at = +10 working days, fulfilled_at, export_bundle_id). retention_holds, destruction_log.

INSURANCE. insurance_carriers(payer_id_edi, name, attachment rules). insurance_plans(carrier_id, group, plan_type, fee_schedule_id, coverage_rules jsonb: category %, deductible, annual max, frequencies, downgrades, waiting periods). patient_coverage(patient_id, plan_id, rank primary|secondary|tertiary, subscriber, member_id_enc, effective_from/to, verified_at). fee_schedules(tenant_id, name, carrier_plan_id?, effective_from) + fee_schedule_lines(schedule_id, cdt_code, provider_id nullable, amount_cents) — maker-checker edited. eligibility_checks(coverage_id, requested_at, response_frozen jsonb, source, remaining_max_cents, deductible_met_cents). edi_enrollments(payer_id, status, submitted_at, active_at).

SCHEDULE. operatories(location_id, name). provider_schedules(user_id, location_id, weekday, blocks, effective range). appointment_types(tenant_id, name, default_procedures[], duration, color_token, shape_token, behavior flags confirm|recall|emergency|new_patient|supervision_required). appointments(tenant_id, location_id, operatory_id, patient_id, provider_id, hygienist_id, type_id, starts_at, ends_at, status scheduled|confirmed|arrived|seated|in_chart|note_filed|checked_out|no_show|cancelled, supervision_level direct|general|none, supervising_dentist_id, supervision_validated_at, eligibility_check_id, confirmed_at, arrived_at, seated_at). appointment_events(append-only moves/deletes with reason_code, actor frozen). appointment_procedures(appointment_id, cdt_code, teeth[], surfaces[], treatment_plan_item_id). recall_rules, recall_due(patient_id, kind, due_on, scheduled_appointment_id), waitlist.

ENCOUNTERS AND CLINICAL RECORD. encounters(tenant_id, patient_id, appointment_id nullable, location_id, date_of_service, attending_provider_id, supervising_dentist_id, kind visit|tele|phone|emergency, status open|signed|amended, signed_at, signed_by frozen) — THE spine; every clinical row below has encounter_id NOT NULL. clinical_note_drafts(encounter_id, owner_id, version OCC, note_state jsonb, module_ids[], status, last_filed_id). note_revisions (ring, keep 20, working-copy recovery only). clinical_notes_filed(encounter_id, ticket per-tenant, note_markdown frozen, audit_report frozen, audit_status, ruleset_version, entry_author frozen, clinical_performer frozen, reviewing_dentist frozen, attestations jsonb, omission_licences jsonb, byteaudit_verified, amends_note_id, amendment_reason_code) — immutable by role + trigger. note_amendments(amends_note_id, reason_code, text, author frozen, actual_at). chart_events(patient_id, encounter_id, tooth, surfaces[], kind condition|procedure|existing|missing|watch, status existing|planned|completed|referred, cdt_code, material, provider frozen, occurred_at, historical bool human-set, source manual|note_extract|import) — append-only; chart_current is a materialized view. procedures(tenant_id, patient_id, encounter_id, provider_id, cdt_code, teeth[], surfaces[], quadrant, description frozen, fee_cents, fee_schedule_id, status per PROCEDURE_STATES, treatment_plan_item_id nullable, chart_event_id, charge_entry_id nullable, completed_at). cdt_codes(code, description, category, licence_year; loaded per tenant under ADA licence). perio_exams(encounter_id, examiner frozen, exam_type) → perio_sites(tooth, site 1–6, pd_mm, gm_mm, cal generated, bop, sup, plaque) + perio_tooth(mobility, furcation, mgj). treatment_plans(patient_id, name, status draft|presented|accepted|declined|superseded, version) → treatment_plan_phases → treatment_plan_items(cdt_code, teeth, surfaces, provider_id, fee_cents, est_insurance_cents, est_patient_cents, rule_trace jsonb, priority, status). case_presentations(plan_id, presented_by frozen, at, outcome, patient_questions). prescriptions(drug, dose, unit, mg/kg basis, indication, duration, csmd_checked_at). anesthesia_records(encounter_id) → anesthesia_events(at, kind vitals|drug|milestone, values). imaging_studies(encounter_id) → images(object_key, dicom_tags, sensor, acquired_at) → image_interpretations(dentist frozen, per-structure status, text).

LEDGER (app_append role, hash-chained). ledger_entries(tenant_id, account_id, patient_id, encounter_id?, procedure_id?, claim_id?, era_line_id?, location_id, kind charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer_out|transfer_in|reversal, gl_bucket patient_ar|ins_ar_primary|ins_ar_secondary|unapplied_credit|undeposited_funds, amount_cents signed by kind, currency, reason_code_id (REQUIRED for adjustment/write_off/refund/transfer/reversal), effective_date, posted_at, posted_by_id + posted_by_name frozen, reverses_entry_id, reversed_by_entry_id (set by trigger), approval_request_id (REQUIRED when gate said needs_second), tender cash|check|card|ach|eft, check_no, processor_ref, memo, idempotency_key UNIQUE per tenant, prev_hash, row_hash). payment_allocations(payment_entry_id, charge_entry_id, amount_cents, allocated_by frozen, at, reversed_by_id) — sum per payment ≤ payment credit and per charge ≤ charge (triggers). reason_codes(tenant_id, kind, code, label, requires_approval_over_cents, active; maker-checker versioned). estimates(procedure_id|treatment_plan_item_id|claim_id, coverage_id, est_insurance_cents, est_writeoff_cents, est_patient_cents, as_of) — never joined into balance. Views: account_balances (patient_due = sum over patient_ar; pending_insurance = sum over ins_ar_*; unapplied = sum over unapplied_credit; estimated_write_off = sum(estimates) shown separately) — three/four separate numbers, never blended. ledger_explanations(account_id) returns ordered (charge → allocations → adjustments → residual) tuples for the plain-sentence renderer. statements(account_id, statement_number per-tenant, period, balance_snapshot, last_entry_id, object_key). deposits(location_id, business_date, cash/check/card breakdown, expected_cents, prepared_by frozen, status open|closed|reconciled) + deposit_lines(deposit_id, payment_entry_id). day_closes(location_id, business_date, totals by tender and kind, ar_opening, ar_closing, closed_by frozen, last_entry_id, hash) — frozen in one transaction with verifier check. Invariants (all in Postgres): INSERT-only; allocation bounds; reversal mirrors an unreversed original of the same account; approval-required entries carry an approved approval_request_id (re-checked by trigger); charge requires procedure_id + cdt; insurance_payment/contractual write_off require claim_id + coverage_id; every insert also inserts a domain_event in the same transaction; retroactive effective_date emits an anomaly event; balances are views, never columns.

BANK. bank_accounts. bank_transactions(account, external_id UNIQUE, amount_cents, posted_on, description, source feed|statement; append-only). reconciliation_runs(location_id, business_date, expected_by_tender, actual_by_tender, matched_cents, variance_cents, status, closed_by frozen, independent bool COMPUTED = closer held no post_payments/prepare_deposit activity that day, lag_days). reconciliation_matches(deposit_id, bank_transaction_id, matched_by system|user, variance_cents). reconciliation_variances(reason_code, cleared_by frozen, resolution_note, decision_id).

CLAIMS. claims(tenant_id, encounter_id, patient_id, coverage_id, rank, claim_number per-tenant, kind primary|secondary|preauth, status draft|scrubbed|preflight_failed|queued|submitted|acknowledged|pended|paid|denied|appealed|closed|voided, primary_claim_id, clearinghouse_ref, frozen_837, submitted_at) → claim_lines(procedure_id, cdt_code, tooth, surfaces, billed_cents, allowed_cents, paid_cents, patient_resp_cents, carc[], rarc[], narrative, status) → claim_events(append-only: kind created|scrubbed|rejected|submitted|acknowledged|denied|paid|appealed|written_off|closed, payload, actor frozen). preflight_findings(claim_id, rule_id, severity, field_ref). claim_attachments. preauthorizations(patient_id, coverage_id, items, response_frozen). era_files(raw_object_key, received_at, parsed jsonb, status) → era_payments(check_or_eft, payer, amount_cents) → era_lines(claim_line_id matched, paid, allowed, adjustments[], match_status auto|manual|unmatched, posted_entry_ids[]).

CONTROLS (app_append role). control_policies(tenant_id, version, dual_release_policy jsonb, rulebook_version, effective_from, approved_by frozen) — new row per change. control_exceptions(policy_id, action raise|lower|force|waive, scope payee/person/role/amount_band/channel, effective_from/to, approved_by frozen, residual_note). approval_requests(tenant_id, channel, amount_cents, subject_kind, subject_id, requester frozen, eligible_second_roles[], first_approver, second_approver frozen, status per ReleaseStatus, applied_exception_id, evaluation jsonb frozen, decision_reason REQUIRED on decline, requested_at, decided_at, resulting_entry_id; CHECK requester_id <> second_approver_id). approvals_log append-only. controls_registry(tenant_id, control_id, fraud_opportunity_class, asset_exposure, duty_family, segregated bool, compensating[], owner_id, monitoring_cadence). sod_findings(tenant_id, computed_at, rule_id, person_ids[], entitlements[], severity, score, mitigated_by[], status open|mitigated|accepted|resolved, first_seen, last_seen, decision_id, rulebook_version). control_findings(tenant_id, detector, severity, subject refs, practice_level bool, window, evidence_event_ids[], status open|explained|escalated, cleared_by frozen). control_snapshots(tenant_id, computed_at, trigger, scoring_version, rulebook_version, portfolio jsonb, sod jsonb, coso jsonb, signals jsonb). control_decisions(tenant_id, subject_kind, subject_id, kind remediate|compensate|accept_residual|monitor|insure, note, review_by, residual_at_decision, scoring_version, decided_by frozen, evidence_document_ids[]) — append-only; superseded by a new decision, never edited. digest_acks. tips(tenant_id, anonymous bool, text PHI-gated, status). scoring_constants(version, key, value) — the versioned weights table.

AUDIT, EVENTS, COMPLIANCE. domain_event(tenant_id, id uuidv7, occurred_at, actor_id, actor_name frozen, ip, ua, session_id, aggregate_type, aggregate_id, event_type namespaced auth.*|ledger.*|claim.*|chart.*|control.*|export.*|disclosure.*|role.*, payload jsonb codes-and-ids only, prev_hash, hash) partitioned monthly. phi_access_log(tenant_id, at, actor frozen, patient_id, account_id, resource_kind, resource_id, purpose treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms, justification, ip) partitioned monthly. disclosures(patient_id, at, channel, recipient, records, actor frozen, document_id). audit_chain_checks(tenant_id, day, ok, head_hash, object_lock_key). outbox processing columns on domain_event (processed_at) for pg-boss fan-out. business_associates → baas(vendor, kind, signed_at, expires_at, controls_named jsonb, document_id, active); integration_registry(kind, vendor, enabled REQUIRES live baa). policies(versioned, generated_from, approved_by frozen), training_completions, compliance_logs, incidents(kind, discovered_at, tn_deadline, hipaa_deadline, status), sra_questionnaires/responses, compliance_tasks, retention_policy, legal_holds.

## Ux blueprint

INFORMATION ARCHITECTURE. One shell, three persistent regions. (1) Top bar: tenant/location switcher, global patient search (typeahead over name/DOB/phone/MRN, two-identifier confirmation on chart open), the Andon slot (one verb line + one control, never prose), and a Cmd/Ctrl-K command palette that jumps to any patient, appointment, claim, report or ACTION by its plain name — the mechanism that neutralizes 'the hiring pool already knows Dentrix'. (2) The PATIENT RAIL (Curve Sidekick pattern): appears on patient selection and stays across every surface — header with the un-collapsible red critical-alert channel, one-tap targets Chart · Notes · Perio · Imaging · Plan · Ledger · Claims · Docs · Profile, expandable summaries (next/last appointment, coverage + eligibility flag, recall, balance as three labeled numbers with 'Explain', open plans, last filed note); privacy mode hides names on operatory glass. (3) The WORK CANVAS whose default is the persona's home. Primary nav is role-derived: Board, Chairs, Money Desk, Daily Close, Practice (Controls, Compliance, Roles, Settings), Reports, Trust. No deep menus; everything else is reached from the rail or a row's one primary action. Every number on every screen deep-links to the rows behind it; the same metric shows the same value everywhere.

HOME SCREEN PER PERSONA (login lands here; no dashboard card grid). Front-desk coordinator → BOARD: day view by operatory, cards colored by appointment type (shape + word + luminance, CVD-safe), per-chair status strip driven by encounter status (arrived / seated / in chart / note filed / ready to check out — initials and chair only, no PHI across the desk), readiness strip before open, eligibility badge already fetched at 6am, waitlist/ASAP fill, checkout queue. Office manager / biller → MONEY DESK: three worklists as tabs with counts (ERA exceptions with auto-matched lines already posted; claims aging >14/30/60 with next action; denials) plus approvals waiting on me, unposted encounters, unallocated credits, statements due, 'variances I own'; each row = patient, amount, one-line reason, one primary action. Hygienist → CHAIRS (mine): today's patients in order with alerts, last perio date and delta, recall due, two buttons per card (Perio, Note); the seated patient's chart opens straight to Perio when the appointment type is hygiene, prior exam ghosted, note pre-scaffolded from the type; dentist-owned sections collapsed into a single handoff strip. Dentist → one EXAMS-TO-SIGN queue (hygiene data collected awaiting diagnosis/plan; notes needing my filing authority; imaging awaiting interpretation folded in as rows, not separate queues) plus the seated chart; note opens on Assessment/Plan with killers hoisted to a ≤3-row strip. Owner → DAILY CLOSE & CONTROLS: 'Yesterday reconciled?' as one large shape+word status, three tender rows expected vs bank, one variance number with one clear/investigate action, detection lag in days, approvals only I can give, expiring exceptions, open SoD findings, decisions due for review, practice-health score with its top three levers; nothing ranks people. Compliance lead → open decisions past review date, BAAs expiring, training due, monthly log-review task. Temp / new hire → the same home as their role plus a one-shift fast path rendered inside the work surface; role was set at provisioning so the first beat is never 'you are not allowed yet'.

THE FIVE DAILY FLOWS, FEWEST CLICKS (each is a phase exit criterion). 1. CHECK-IN: Board → tap card → 'Arrive' (1 tap). Eligibility ran at 6am and re-runs on arrival; amber → inline 'Re-verify' runs a 270. Forms status and balance in the card expander; 'Seat' is the same card's next state. 2. PERIO: Chairs → Perio (1 tap) → grid opens on the correct dentition with cursor at UR site 1 → keyboard grammar (1–9 depth, space = BOP, arrows skip, undo-by-key; voice later through the same seam) → 'Save exam' (1 tap) writes perio_exam + derives the periodontal module summary + SRP evidence. Acceptance: one operator, full mouth, under 8 minutes. 3. CHART + PLAN + NOTE: Rail → Chart (1 tap) → paint procedure (tap tooth, drag surfaces, or macro) → procedure_line, plan card, chart layer and note scaffold update together → 'Open note' (1 tap) lands cursor-ready with ranked starters visible → killer strip ≤3 rows + one 'File' button. Acceptance: restorative visit charted and signed in ≤10 taps; filing runs the audit server-side, freezes, byteaudit-verifies, flips the Board chip. 4. CHECKOUT + PAYMENT: Board card → 'Checkout' (1 tap) → completed procedures with patient portion (estimate column separate from balance), per-line pre-flight status (WHAT/WHY/HOW, deep-link to the note field) → 'Take payment' (hosted card field or cash/check; allocation defaults oldest-open and is shown) → 'Post' writes charges + payment + allocations atomically and queues the claim (blocked only by S1/killer pre-flight). Acceptance: ≤4 clicks, one screen. Any write-off/adjustment above threshold shows one line and one control ('Request approval') and is held, never silently allowed. 5. POST ERAs + CLOSE THE DAY: Money Desk → ERA batch → matched lines green (already posted), unmatched amber with proposed match → 'Post matched' (1 click) → resolve exceptions with Post / Write-off (reason) / Appeal; over-threshold write-offs route to the named second approver inline. Then 'Close day' (2 clicks): totals by tender and provider, deposit slip prepared, day sheet frozen atomically. Next morning the owner sees 'Tied' or 'N variances' (1 click to clear with reason or escalate).

HOW CONTROLS LIVE IN THE WORKFLOW, NOT A DASHBOARD. A role grant that creates an SoD conflict shows the conflict, the fraud path in one sentence and the compensating control before save; the admin must pick remediate / compensate / accept-on-purpose, which writes a control_decision. The dual-release card appears inline on the refund/write-off form naming eligible second approvers. 'This is your 3rd unapproved write-off this month' is an inline, un-broadcast note. An after-hours refund pages the owner. The Controls screen shows the recorded-vs-enforced table. The COSO heat map is the last screen an owner needs, not the first.

HOW 'VERY INTUITIVE' IS ACHIEVED (rules, not adjectives). Home is the work; every row has exactly one primary action. One canonical view per fact: one ledger, one balance as three labeled numbers, same metric same value everywhere. Structural correctness over vigilance: notes attach by FK, planned→completed only via encounter completion, impossible surfaces disabled, supervision validated at booking. One verb line + one control at every gate; explanations behind progressive disclosure; policy prose never on the finish path. Validation silent until blur, live only after a field's first error. Severity three ways at once (shape, word, monotonic luminance) so a deuteranopic biller ranks a queue in grayscale. 44px targets with 8px gaps on every pointer type; glove mode is the default. Named omission licences so a blank is never forced into a fabrication. Read-back for high-stakes tokens (tooth, surface, dose, amount, payer) on bulk/AI/migration transformations. Recognition over recall: ranked, role-filtered starters always visible, never behind a chip. Two visual identities for irreversible (file, post, close day) vs reversible (print, preview) actions. Calm identity: cream/navy/teal work surfaces, no mascots or marketing chrome inside the chart or ledger; warmth lives at login, empty states and the portal. Learnability as a line item: role-based first-run inside the surface, public temp quick-start, free certification drills verified by the real engine. Honesty: degraded-mode banner says what still works; support hours and SLA printed in-app; AI shows evidence spans, never a confidence percentage. Measured, not asserted: the pilot instruments median ready→filed (≤ baseline +20%), perio completion rate, checkout taps, ERA auto-post rate, days-to-tie, ≥70% eligible-chart adoption by week 4, ≤90 minutes paid training per writer, zero wrong-author events on shared devices; usability sessions run with a biller, a hygienist and an assistant, not only dentists.

## Internal controls integration

EVENT SPINE. Every repo mutation inserts a domain_event row in the same transaction (transactional outbox): role.granted/revoked, user.deactivated, credential.expired, ledger.posted (kind, amount, reason, poster, effective vs posted date, hour, location), ledger.reversed, allocation.made, refund.posted, approval.requested/decided/waived, exception.created/expired, deposit.prepared/closed, bank.transaction.imported, reconciliation.closed/variance/cleared, claim.submitted/denied/appealed/voided/written_off, procedure.deleted, appointment.deleted/moved, vendor.created/changed, payment.released, encounter.signed, chart.event, export.performed, disclosure.recorded, phi.read (volume), device.new_login, chain.verify.result, control_policy.changed. pg-boss consumers fan these to the controls engine, detectors, digest, notifications and webhooks. The engine never reads demo data and never reads the browser; the PracticeState builder assembles what Precog's functions expect from live rows.

SEGREGATION OF DUTIES FROM REAL GRANTS. user_entitlements (current view) IS the RoleAssignment[] input to detectSodConflicts. It runs synchronously on every role.* event and nightly, upserting sod_findings keyed on (rule_id, person set), closing findings that no longer exist, reopening recurrences, with mitigatedSodRuleIds from the active control_policy injected so enabling a dual-release channel visibly lowers and reclassifies the linked conflicts. ENFORCED: the role-grant API refuses a grant that would create a critical-severity conflict unless the actor records a control_decision (accept_residual or compensate, with review date) in the same request; tenants may elect the stricter 'grant sits pending until a distinct second admin decides' mode. Setup seeds ROLE_TEMPLATES and shows the conflicts before the first login is issued. COSO P9 (assess change) and P11 (technology controls) flip from hard-coded weak to continuously monitored because grants, terminations, MFA coverage and shared-device posture are observed events; a terminated user still holding grants is a finding.

DUAL RELEASE ENFORCED IN THE TRANSACTION. The ledger posting service is the only writer of ledger_entries. For adjustment, write_off, refund, reversal, transfer, and for vendor/ACH/check/deposit/payroll channels, postGuarded(channel, request) loads the tenant's active control_policy and control_exceptions, runs evaluateRelease({channel, amountCents, requesterId, payee, secondApproverId}) with a repository-backed eligible-seconds list INSIDE the transaction, and: below_threshold / approved_single / approved_exception → post; needs_second → insert approval_requests (frozen evaluation) and post NOTHING, return 202 with one line + one control; approved_dual (a distinct, role-eligible second approver decided via compare-and-set, distinct-person re-checked server-side and by CHECK constraint) → worker executes the held posting with approval_request_id stamped; blocked_same_person / blocked_role / blocked_missing_second / blocked_policy_off → rollback 403 with reasons[] and nextSteps[]. A BEFORE INSERT trigger re-checks that any approval-required entry carries an approved request so no code path can bypass the service. Exceptions (raise/lower/force/waive) require owner role, a residual note and an effective window; waive auto-expires; activeExceptionSummary surfaces expiring and standing exceptions on the owner home and in the monthly digest so a temporary raise cannot quietly become permanent. Owner overrides exist (management-override controls per COSO/ACFE) but are ledger-annotated, appear in the digest and the CPA export, and lower the Control Activities score — never silent. Denial-suppression: a write-off whose claim_events show a denial with no appeal event routes through dual release regardless of amount, and the denial-writeoff cannot be posted by the person who submitted the claim.

HARD SoD BLOCKS AT ACTION TIME (small, named set). Because full SoD is arithmetically impossible in a six-person office, only critical pairs are refused at runtime by withGuard: whoever posted payments or prepared the deposit for a business day cannot clear that day's reconciliation variance; self-approval of vendor master changes; self-approval of payroll; requester = approver. Every other conflict is detected, scored and requires a dated decision but is not blocked. For 1-owner/1-OM practices the variance rule degrades to owner-only clearance rather than being disabled, and the degraded state is itself a finding.

INDEPENDENT RECONCILIATION, MEASURED. bank_transactions come from an aggregator feed (Plaid/Finicity class under DPA/BAA review) or OFX/CSV statement import — data the PMS did not generate. reconciliation_runs.independent is COMPUTED (closer held no custody/recording activity that day); detection lag is measured in days between posting and matched bank transaction; match rate within 48h is stored. These feed residual-engine's controlEffectiveness (independentReconciliation, monitoringCadence = whether the owner acknowledged the last digest, dual-authorization effectiveness = share of over-threshold posts that actually had a second approver) as MEASURED operating effectiveness alongside configured DESIGN effectiveness — COSO distinguishes them and so does the UI. Variances open beyond N days raise a control_finding. The reconciliation logic lives in the sealed independent verifier package so the system policing itself is at least tamper-evident.

DETECTORS (recorded, batched). Nightly and event-driven jobs over real tables write control_findings: refunds above channel threshold lacking approval_request_id (should be impossible — a chain-integrity alarm), postings outside location business hours, reversals/adjustments dated more than N days before posted_at, adjustment-to-production ratio per reason code per role against the practice baseline, void/reversal velocity, duplicate patient payments, deposit-batch vs bank gaps, unmatched bank lines older than 48h, sole ownership of a critical process (SPOF from credentials + entitlements), copy-forward documentation clusters (digest similarity.ts), and in Phase 4 the forensic suite from precog stats/README.md (Benford first/second digit, round-number bias, duplicate detection) framed as 'worth a look' control-test results. Dental's DIGEST_RULES govern reporting: batched weekly, minimum sample sizes, SYSTEMIC_SHARE re-scoping so a finding that flags most of the practice is reported as a practice-standard problem with names dropped; person-scoped detail is readable only by the owner and a designated reviewer/CPA seat. No output is ever phrased as an accusation.

OWNER ALERTS. Hard events (after-hours refund, retroactive-dated entry, waived dual control, deposit variance above threshold, audit-chain verification failure, new device login on a financial role) alert the owner individually and immediately via BAA-covered email/SMS. Everything else flows into the weekly digest with one three-action coach card and acknowledgment stamping. The PHI-gated anonymous tip channel (from wishes.ts) is first-class because ~40% of fraud surfaces through tips.

SCORING, COSO, JOURNAL. controls_registry (typed factors) + measured effectiveness + derived StaffComposition (team size from active users, sole-owner count from SPOF detection, tenure from hire_date, segregation from detectSodConflicts.segregationHealth) feed portfolioSummary and assessCoso nightly and on control events, frozen into control_snapshots stamped SCORING_VERSION + CONTROL_RULEBOOK_VERSION so a weight change never regrades history. Every finding, score and principle carries a DeepLinkTarget to the rows. tornadoSensitivity and the cascade simulator become the settings-page 'what if I turn on dual approval for write-offs' preview with dollar deltas labelled directional until calibrated. control_decisions (remediate / compensate / accept_residual / monitor / insure) is the append-only, owner-attributed control register with residual_at_decision, review_by and evidence; overdue reviews appear on the owner home; COSO P17 is literally 'open findings without a decision'. The journal, approvals log, exception table and hash-chained event stream together are the evidence pack for a CPA, carrier or OCR — rendered as plain sentences ('On 2027-03-04 M. Ortiz requested a $640 write-off (hardship); policy required a second approver; Dr. Reagan approved at 14:12; entry posted; SoD finding writeoff-self was mitigated by channel writeoff').

WHERE ENFORCED VS RECORDED (shown in-product). Enforced (refuse): dual release on money-moving entries; critical-conflict grants without a decision; the named runtime SoD set; requester ≠ approver; BAA-gated connector enablement; PHI egress classifier on AI/export; note-signing gates (killers, licence scope, supervision corroboration); MFA + unique identities + server idle timeout; immutability of ledger/approvals/decisions/events at the DB role. Recorded and surfaced: SoD findings, anomaly signals, COSO/residual scores, leading indicators, decision journal, compliance tasks, PHI access review. Everything advisory says so.

## Roadmap


### Item 1
- **phase**: Phase 0 — Trust Foundation and Repo Surgery
**scope**

Monorepo seeded from the dental repo (apps/pms, packages/clinical-core, controls-engine, db, verifier). Tenants/locations, tenant_id + RLS on every table, three DB roles, SET LOCAL per transaction, drizzle-kit migrations with history + shadow-DB CI check replacing ddl.ts/SCHEMA_BOOT_VERSION, per-tenant sequences, UUIDv7. Lift dental auth stack; add sessions table (idle/absolute/per-device revoke), mandatory TOTP + recovery codes, two-admin recovery ceremony, envelope-encrypted mfa_secret, withGuard() + requireAccess() + CI route-glob guard test, Origin/Content-Type checks. domain_event outbox with hash chain, phi_access_log, disclosures, nightly chain verifier, daily chain head to Object Lock, byteaudit retargeted. BAA registry primitive (integration_registry.enabled requires live baa row). Port precog engines into packages/controls-engine with demo-data replaced by PracticeState, the three math bugs fixed (timeline sign, counterfactual ignores vars, beam drops status quo), waive_dual Infinity fixed, versioned constants table, golden + monotonicity tests, zero-app-import test. Container deploy (one region + cross-region backups) + pg-boss worker + managed Postgres with BAA + S3 with BAA + status page + scheduled restore drill. CI: eslint, npm audit, secret scan, coverage floor, e2e probes + postgres durability in the blocking job, version guards extended with SCORING_VERSION/CONTROL_RULEBOOK_VERSION. Delete gamify/store/sparkle character/gauntlet UI/EDR seam/law-watch product/precog shell/Grok auth/multiplayer/military skin; rotate the committed secret and do not inherit precog history. In parallel: run the D.8 Phase 1 research — 24–30 persona interviews (office-manager weighted) and ledger-reading probes on three incumbent ledgers — as a gate on the Phase 1 ledger UI design, not a calendar blocker on Phase 0 code.

**exit criteria**

Two tenants seeded; RLS negative test proves a deliberately missing WHERE cannot leak rows; 100% of route handlers pass the guard-coverage test; deactivating a user kills the session on the next request; MFA enrollment forced on first login; audit chain verifies nightly and detects a planted tamper in test; restore drill from last night's backup passes and writes its own audit row; controls-engine has zero app imports and 100% of lifted scoring functions have golden tests with monotonicity asserted one way; a connector with no BAA row is refused at the registry; production refuses to boot without POSTGRES_URL (verify-full), KMS key, backup target, object storage and append role; no PHI yet held; D.8 interviews synthesized with the ledger default (running vs itemized) chosen from measured preference.

- **dependencies**: None. Owner decisions required first: managed Postgres + object storage vendor with BAA; stay on NextAuth Credentials + TOTP; hosting vendor; pricing model for the Phase 1 financial layer.
- **duration estimate**: 8–10 weeks

### Item 2
- **phase**: Phase 1 — Money Spine and Enforced Controls (financial layer piloted BESIDE the incumbent PMS)
**scope**

Patients/guarantor accounts/coverages (minimal headers), the Readable Ledger with the property-test suite (dual coverage, partial payments, secondary posting, reversals, refunds) written before UI, DB-enforced invariants, reason codes under maker-checker, estimates table, 'Explain this balance', statements, day close frozen atomically, hosted-field card processing; postGuarded() enforcing evaluateRelease inside every money-moving transaction; approval_requests inbox; control_policies/exceptions editor with expiry summary; SoD detection over real user_entitlements with grant-time refusal and setup-wizard conflict preview; deposits + bank reconciliation (aggregator feed with OFX/CSV statement import as fallback) + variance queue with the named runtime SoD set; control_snapshots, COSO/residual with measured effectiveness, decision journal, hard-event alerts, weekly digest, tip channel; report-import ETL of day sheets/AR/patient headers from Open Dental and Dentrix so one pilot practice runs the ledger and controls in parallel with its incumbent; Trust Page with published pricing and exit terms; the recorded-vs-enforced table in-product. State plainly in the pilot agreement that Phase 1 dual release enforces on the shadow ledger fed by import, not the incumbent's posting path.

**exit criteria**

Pilot practice opening AR ties to the incumbent to the cent for 30 consecutive business days; every over-threshold refund/write-off in the shadow ledger has a second named approver or a logged owner waiver — zero exceptions found by the independent verifier; owner clears reconciliation daily with median variance investigation under 10 minutes; a planted $300 skim (deposit short + after-hours adjustment) surfaces as a variance and a finding within one business day in a simulated month; D.8 ledger-reading probe with ≥5 billers shows higher task success than the incumbent ledger; at least one real SoD conflict detected from grants and closed by a decision; zero ledger rows updated or deleted (role + trigger test); scores reproduce byte-identically for a frozen snapshot; pilot office manager would choose this ledger (recorded interview). Financial-layer product is priceable and sold to at least one non-pilot practice as a standalone.

- **dependencies**: Phase 0. Bank aggregator agreement (DPA/BAA) or statement-import path; card processor with hosted vault; CPA-reviewed default thresholds and reason-code catalog; pilot practice (one Cornerstone location, not all three).
- **duration estimate**: 12–14 weeks

### Item 3
- **phase**: Phase 2 — Board, Encounters, Insurance and Claims (becomes a PMS)
**scope**

Scheduling Board with operatories, appointment-type behavior contracts, provider templates, recall/waitlist, supervision validation at booking, check-in/checkout flows, per-chair status strip; encounters table and procedures (CDT licence loaded) so charges have structural parents; fee schedules per plan/provider; clearinghouse adapter (one implementation) for 270/271 eligibility with 6am sweep + arrival re-run; claim assembly with scrubber consuming justification/completeness rules; secondary auto-generation; batch 837D with frozen bytes; claims tracker; 835 review-then-post through postGuarded producing insurance_payment + contractual write-off entries; denial/appeal worklists; denial-suppression detection; pre-auths; Money Desk home; canned reports v1 over ledger views; read-only public API v1 for the practice's accountant; Open Dental full importer with conversion cockpit and public 'what does not convert' list; EDI re-enrollment runbook. Clearinghouse contract and per-payer EDI enrollment are STARTED in Phase 1 (up to 30 business days per payer). SOC 2 auditor engaged now so the observation period overlaps the build.

**exit criteria**

Pilot practice runs scheduling, billing and claims entirely in the product for 60 days with the incumbent switched off for billing; first-pass clearinghouse acceptance ≥95% and days-to-payment at or better than the prior 90-day baseline; ERA auto-post ≥85–90% of clean remit lines with every unmatched line surfaced amber; eligibility on the Board for ≥90–95% of tomorrow's insured appointments by 6am; check-in 1 tap, checkout ≤4 clicks on one screen, schedule in 3 interactions (moderated test with a coordinator and a biller); dual-coverage + partial-payment scenario posts end to end and 'Explain this balance' renders it; conversion from Open Dental completes with AR tie-out and zero orphaned claims; a second practice converted at the published fixed price; every report total reconciles to ledger views in an automated check.

- **dependencies**: Phase 1. Clearinghouse contract + BAA; payer enrollment; ADA CDT licence; ONC-certification decision recorded before API v1 is published.
- **duration estimate**: 14–16 weeks

### Item 4
- **phase**: Phase 3 — Clinical Record
**scope**

Smile Notes clinical core ported from packages/clinical-core into the Encounter page: clinical_note_drafts/filed with NOT NULL encounter FK, three identities, signNoteAtomic, byteaudit verify, addendum chain, attestation tiers, omission licences, module field-id deprecation registry + round-trip test, jurisdiction parameter, PHI rules → egress classifier, ~100 EDR strings removed, BuilderShell.tsx decomposed with runTextAudit kept pure; editable odontogram on chart_events with history layer and paint-to-chart macros writing chart + plan + note scaffold + pending charge; treatment plans with phases, estimates and case presentation, conversion gated on encounter completion; six-point perio with the keyboard/foot-pedal grammar and prior-exam deltas; consents, medications, allergies, medical-history snapshots, anesthesia timeline; documents in object storage with signed URLs; hygienist and dentist homes; shared-device profile with PIN author switch and encrypted-or-disabled draft mirror; records-request workflow with SLA clock and retention clocks; read-only degraded mode (service worker + encrypted read cache of today's schedule/alerts/chart summaries, disabled on shared devices); dictation via the engine seam with browser SpeechRecognition blocked on PHI fields.

**exit criteria**

Full-mouth perio by one operator in under 8 minutes in a timed hygiene simulation and completion rate up vs the pilot's baseline; restorative visit charted and signed in ≤10 taps; every filed note reproduces byte-identically from frozen artifacts and an addendum never alters the original; precision harness shows zero blocking false positives on the 34-note corpus after the PHI re-scope; a draft saved under an older module set round-trips; wrong-site and chart/note/claim contradictions fire as S0; zero cleartext PHI on a shared device after logout (inspection); zero wrong-author events on shared tablets; pilot buy gates instrumented: ≥70% of eligible charts in the product by week 4, median ready→filed ≤ baseline +20% (target ≤ 0 by week 8), ≤90 minutes paid training per writer; usability sessions observed with a hygienist and an assistant; degraded-mode tabletop passes (board and chart visible, no writes accepted, banner shown); TN counsel review of rule set and consent fields started.

- **dependencies**: Phase 2 (encounters and procedures exist). STT decision recorded (on-device Whisper WASM with frozen dental WER corpus vs BAA vendor) for Phase 5.
- **duration estimate**: 14–16 weeks

### Item 5
- **phase**: Phase 4 — Hardening, GA, Compliance Program, Communications, Forensics
**scope**

Third-party penetration test; SOC 2 Type 2 fieldwork; HIPAA SRA performed on the product itself (documenting the cleartext name/DOB decision); nonce-based CSP; key rotation runbook; incident-response drill; promote hosting to two-region active/passive; PgBouncer + short-TTL session cache with revocation invalidation if latency requires. HIPAA/OSHA program after counsel review (SRA questionnaire → tailored versioned policies → remediation tasks → server-verified training with certificates; BAA document management on the Phase 0 registry; sterilizer/equipment logs; incident clocks; annual SRA reminder). Confirmations/reminders/recall via BAA-covered Twilio. Imaging sensor bridge + basic viewer + one-click DICOM export. Forensic suite (Benford, round-number, duplicates, adjustment velocity) as owner-private control-test signals. Reporting filter builder and scheduled delivery. Bank aggregator hardening or statement-import UX polish based on Phase 1 telemetry. Dentrix/Eaglesoft CSV + image-folder importers. Marketing that never claims 'HIPAA compliant', 'lawsuit-proof', 'board-proof' or 'AI-powered'.

**exit criteria**

Pen-test findings closed; SOC 2 Type 2 observation period complete or report issued; three paying practices live with 90-day retention; published uptime ≥99.9% over the prior quarter with post-mortems; compliance state recalculates as risks open/close; no integration enables without a live BAA (test); records request fulfilled as full-record export within ten working days in a drill; TN counsel sign-off on policy templates and legal content; owner-panel buy gates held across all live practices; no per-person ranking anywhere (review checklist); second and third practices onboarded using only the published conversion price and timeline.

- **dependencies**: Phase 3. Counsel review; SOC 2 auditor engaged in Phase 2; messaging vendor BAA.
- **duration estimate**: 12–14 weeks

### Item 6
- **phase**: Phase 5 — Growth: Voice Perio, Caged AI, Portal, eRx, Groups, API write, Offline decision
**scope**

Voice perio and dictation through the DictationEngine seam once the on-device Whisper WASM engine or BAA STT clears the frozen WER corpus; caged AI assist behind a BAA-covered zero-retention provider with field-level minimum-necessary gate, verifyMeaning on every output, per-call disclosure rows, controls coach with role labels only, included in price; patient portal (separate identity realm, plain-language/stigma delivery gate, guardian voice), two-way texting, online booking, digital intake; eRx via certified vendor with medication-safety pre-flight; organization tier for 2–9 location groups (location-scoped financial access, cross-location clinical grants, org catalogs with inheritance, consolidated reconciliation, SAML/OIDC + SCIM); public API v1 write access + HMAC webhooks + sandbox tenants; FHIR R4 subset; bounded offline capture (queued clinical notes/perio with explicit human reconciliation on reconnect, never money or claims) designed and shipped only if degraded-mode telemetry shows demand — decision recorded in an ADR with measured outage minutes; native imaging acquisition evaluated as a regulatory project; per-state jurisdiction packs beyond Tennessee; specialty scoping decision (native or public 'not in scope').

**exit criteria**

Voice perio WER on the frozen corpus meets the bar before enablement; AI refusal rate has a denominator, model identity logged on every call, zero PHI in provider logs verified by redaction test; portal blocks 100% of summaries with open plain-language findings; first 2–9 location group live with location-scoped money and cross-location clinical cover, SCIM deprovisioning revokes grants and sessions within one minute; API used by one external accountant/partner in sandbox; twelve months of published uptime; offline ADR recorded.

- **dependencies**: Phase 4 GA. BAAs with STT, model provider, eRx vendor, messaging; a signed group customer; per-state legal research budget.
- **duration estimate**: Ongoing; first 16 weeks post-GA, gated on demand

## Decisions for owner


### Item 1
- **decision**: Go-to-market sequencing: what ships and is piloted first

#### options
- A. Financial layer first (readable ledger + enforced dual release + bank reconciliation + SoD + decision journal) piloted beside the incumbent PMS via report import, then Board/claims, then clinical record
- B. Clinical record first (port Smile Notes into encounters, odontogram, perio), then ledger, then claims
- C. Chairside UX first with a 10-week research phase, money second, controls third
- **recommendation**: A
**why**

Two of three judges chose it. It tests the only unproven thesis (readable money + enforced controls) at ~month 6 with every line reused in the full PMS, produces revenue in the adjacent controls band before the PMS exists, fills the confirmed B.7 market gap nobody else fills, and defers the lowest-risk code (Smile Notes, 201 tests) rather than idling the riskiest. Costs: hygienists/dentists have nothing to adopt for ~a year, and the pilot OM carries a double-entry tax for 12–14 weeks — mitigated by report-import ETL and by stating plainly that Phase 1 enforcement is on the shadow ledger. Choose B only if a design partner will parallel-run charting without billing and early revenue does not matter.


### Item 2
- **decision**: Ledger model

#### options
- Single-entry append-only ledger_entries with typed kind + explicit payment_allocations + a gl_bucket column splitting AR (patient / primary ins / secondary ins / unapplied)
- Full double-entry journal_entry/journal_line with GL chart and balanced-entry deferred triggers
- **recommendation**: Single-entry append-only with gl_bucket and the domain-data-model's DB-enforced invariants (allocation bounds, reversal mirroring, approval-required trigger)
**why**

Captures the CPA-defensible AR separation and every structural protection the double-entry design offers (estimates can never contaminate a balance; hidden transfer rows impossible) without a GL chart that a solo engineer without an accountant in the loop will get wrong at least once and that risks debit/credit vocabulary leaking onto a front-desk screen. If a CPA advisor insists on true double-entry for the practice's books, add a derived GL export from the same rows rather than changing the posting model.


### Item 3
- **decision**: SoD enforcement strictness for critical role-grant conflicts

#### options
- Owner alone may accept residual risk by recording a decision with a review date in the same request
- Grant sits pending until a distinct second admin decides
- Per-tenant switch between the two, defaulting to owner-decision
- **recommendation**: Per-tenant switch, default owner-decision
- **why**: A 1-owner/1-office-manager practice cannot operate under a mandatory-second-admin rule (the owner is the only other admin), so the strict mode would be disabled week one; groups and larger practices should be able to require it. Either way the decision is append-only, attributed and surfaces on the owner home.

### Item 4
- **decision**: Runtime SoD hard block on reconciliation clearance in tiny offices

#### options
- Hard refuse: whoever posted payments/prepared the deposit that day cannot clear that day's variance, no exceptions
- Degrade to owner-only clearance when no other eligible person exists, and record the degraded state as a finding
- Detect-and-decide only, no runtime block
- **recommendation**: Degrade to owner-only clearance with the degradation recorded as a finding
- **why**: Keeps the control alive (the Zeldent thesis depends on someone other than the poster looking at the bank) without forcing the owner into daily clerical work or getting the control disabled. Full 'detect only' would make the reconciliation screen recorded, not enforced.

### Item 5
- **decision**: Operatory device idle timeout

#### options
- 5 minutes with session kill
- 10 minutes with session kill
- 15 minutes
- **recommendation**: 10 minutes on the operatory profile, 30 on desk, 12h absolute, with a PIN re-entry that restores the exact caret position
- **why**: 5 minutes fires mid-procedure with gloves on and converts the chairside panel's focus complaints into session-loss complaints; 15 exceeds what most HIPAA SRA reviewers accept for shared clinical devices. Ten is defensible and survivable if re-entry is one PIN and no state is lost.

### Item 6
- **decision**: Hosting topology at launch

#### options
- Single region + cross-region backups + PITR + documented failover runbook, promoting to two-region active/passive at Phase 4 GA
- Two regions active/passive from Phase 0
- **recommendation**: Single region until Phase 4
- **why**: Judges agreed two-region ops is burden a solo team cannot carry in Phase 0; the market's outage complaint is answered first by the status page, restore drills and read-only degraded mode. Redundancy is promoted when there are paying practices and an SLA with credits to honor.

### Item 7
- **decision**: Offline scope for v1

#### options
- Read-only degraded mode only (today's schedule, alerts, chart summaries; encrypted, disabled on shared devices); queued writes decided in Phase 5 from measured outage minutes
- Encrypted device replica plus queued clinical note/perio capture with reconciliation in v1
- **recommendation**: Read-only degraded mode in v1
- **why**: Every design agrees money and claims are never offline. Queued clinical capture puts a PHI replica and a conflict-reconciliation surface on operatory devices before any outage data exists; the dental knowledge base's own rule is that promising offline the product cannot safely honor is worse than not having it. Publish the behavior plainly — no vendor documents any offline mode.

### Item 8
- **decision**: Bank data source at launch

#### options
- Aggregator feed (Plaid/Finicity class) in Phase 1 with OFX/CSV statement import as fallback
- Statement import only in Phase 1, aggregator later
- **recommendation**: Both in Phase 1: build the statement importer first (it is the fallback forever and needs no vendor), pursue the aggregator DPA/BAA in parallel and enable it per tenant when signed
- **why**: The reconciliation screen must go 'green' from independent data on day one of the pilot; the aggregator relationship, its BAA and small-community-bank coverage are outside the team's control, so the importer is the floor and the feed is the ceiling.

### Item 9
- **decision**: Pricing and packaging of the Phase 1 financial layer

#### options
- Standalone controls/reconciliation product in the $39–$115/month product-led band (Zeldent/Abyde class), credited toward the PMS price on conversion
- Annual $499–$1,200 CPA-channel price
- Do not sell Phase 1 standalone; use it only as a pilot
- **recommendation**: Sell it standalone at a published per-location price near the top of the product-led band, credited toward the PMS, and price the PMS itself as one per-location fee with unlimited users
**why**

The controls module cannot carry standalone ARPU above ~$100/month, so it validates the thesis and funds little — but a published price, a real invoice and a real churn number are the falsifier the roadmap needs, and the credit makes it the wedge into the switch. Whether the number is $79 or $149 is the owner's call; the rate card must be sustainable in the $149–$700/location PMS band the market anchors on.


### Item 10
- **decision**: Clearinghouse partner

#### options
- DentalXChange
- Vyne Dental
- Change Healthcare
- **recommendation**: Choose one in Phase 1 (contract + BAA + certification suite), behind an adapter interface with exactly one implementation; never build payer connectivity
- **why**: Insurance is the #1 buying criterion and the largest build risk; EDI enrollment takes up to 30 business days per payer per practice and must start a full phase before claims ship. The specific vendor turns on pricing, eligibility payer coverage for Tennessee, attachment support and certification friction — a commercial negotiation, not an architecture question.

### Item 11
- **decision**: Person-scoped control signals: who may open the detail

#### options
- Owner only
- Owner plus a designated reviewer/CPA seat
- Owner plus office manager
- **recommendation**: Owner plus a designated external reviewer/CPA seat, never the office manager by default
- **why**: All designs agree on no ranking and practice-level framing; the CPA seat is what makes the decision journal an evidence pack a carrier or Board investigator accepts, and it is the person most likely to be the independent reconciler. The OM is the most common embezzler profile in the research and must not review signals about themselves.

### Item 12
- **decision**: AI assist timing and provider

#### options
- v2 (Phase 5) behind a BAA-covered zero-retention provider with a field-level gate
- v1-nice in Phase 3 alongside the clinical record
- **recommendation**: Phase 5
**why**

The deterministic engine is the moat and the market's 'AI-powered' claims are a live attack line; Grok/xAI is excluded because neither xAI nor auth.grok.me will sign a BAA. Deferring cedes the ambient-AI hype lane short-term but avoids a third-party PHI egress before SOC 2 and the SRA exist. The provider (Anthropic via BAA-eligible endpoint, Azure, or Bedrock) is a procurement decision at Phase 4.


### Item 13
- **decision**: Perio voice engine

#### options
- On-device Whisper WASM with a frozen dental WER evaluation corpus
- BAA-covered STT vendor
- Keyboard/foot-pedal only indefinitely
- **recommendation**: Keyboard grammar in Phase 3 regardless; record the engine decision at Phase 3 exit and ship voice in Phase 5 behind the existing DictationEngine seam
- **why**: Hygienist speed must not depend on an unbuilt engine (the browser SpeechRecognition engine is off-device and cannot hear PHI). On-device avoids a subprocessor and per-minute cost but needs an eval corpus and WASM performance work; a BAA vendor is faster but adds a BAA and recurring cost. HS1/Curve/Denticon are shipping voice perio now, so the window matters.

### Item 14
- **decision**: Design partner and pilot shape

#### options
- One location of the Cornerstone three-location practice for Phases 1–3, expanding to all three at Phase 5
- Recruit a 1–3 dentist practice via the D.8 interviews and keep Cornerstone for the group tier
- Both: Cornerstone one-location for the financial layer, a smaller practice for the clinical pilot
- **recommendation**: Both
- **why**: Cornerstone (~30 staff, three sites) exercises SoD and multi-location seams early but risks pulling scope toward group features; a 1–3 dentist practice is the actual target segment and the only honest test of learnability and small-office control friction. The OM/hygienist-weighted D.8 interviews are the recruiting channel.

### Item 15
- **decision**: HIPAA/OSHA compliance program timing

#### options
- Phase 4 (v1-nice) after counsel review, with the BAA registry primitive in Phase 0
- v2 after GA
- Phase 2 alongside claims
- **recommendation**: Phase 4, with the BAA-gating primitive in Phase 0 and the tip/incident intake in Phase 1
**why**

Practices already pay $39–$115/month for Abyde-class tools, so absorbing it on one 'Practice risk' budget line is real revenue — but every policy template is legal content that needs Tennessee counsel review before commercial distribution, and that review is a cost and a calendar outside engineering. The gating primitive cannot wait because clearinghouse, payments and messaging connectors ship earlier.


### Item 16
- **decision**: Tenancy and package layout

#### options
- Shared database with RLS + pnpm-workspaces monorepo (apps/pms, packages/clinical-core, controls-engine, db, verifier)
- Shared database with everything in one Next app under src/lib
- Schema-per-tenant or database-per-tenant
- **recommendation**: Shared DB + RLS, monorepo with pure packages enforced import-free by test
- **why**: Shared DB with RLS as a tested backstop is the cheapest safe option and all four designs agree; the packages split is what lets the clinical core and controls engine stay pure (runTextAudit, evaluateRelease) and be verified independently — the byteaudit pattern already proves this works in the dental repo. Schema-per-tenant is a documented later path for large groups, not a launch cost.

### Item 17
- **decision**: ONC health-IT certification

#### options
- Pursue ONC certification before publishing API v1
- Do not pursue; publish OpenAPI v1 and a FHIR R4 subset without certification
- Defer the decision to Phase 4
- **recommendation**: Decide (recorded) before API v1 is published in Phase 2; default no for a dental PMS unless a payer, group or state program requires it
- **why**: Certification is a regulatory project with real cost and little dental-market pull today, but the API and export shape (FHIR resources, USCDI fields) are cheaper to choose correctly once than to retrofit. This is a commercial/regulatory judgment the owner, as counsel, is best placed to make.

## What to drop

- Points economy, clinic store, badges, ranks, GPA and rollingGpa (dental src/lib/gamify/**, src/lib/gpa/**, src/lib/stats/badges.ts, src/app/api/store/**, points_ledger/store_items/redemptions tables, /training bounty) — a staff currency redeemable for gift cards approved by one lead is a segregation-of-duties finding the product would flag in its own customer, and three adversarial panels name scoring staff as a walkout trigger; extract the append-only ledger pattern and the time-to-file/after-hours ops metrics first, then delete.
- Sparkle mascot and character set on any clinical or financial surface (dental src/lib/stats/sparkle.ts content, 18 call sites, public/characters, docs/characters.md) — keep the seeded-deterministic copy mechanism and its ethics tests for empty/confirmation states; retire the tooth to marketing or pediatric portal material at most.
- Data Hygiene Gauntlet as a customer-facing screen (dental src/lib/requests/gauntlet.ts, src/lib/requests/composeTicket.ts, src/components/requests/GauntletForm.tsx, /requests, src/app/api/change-requests) — keep the five cycles as internal engineering process and onboarding prose; ship a low-friction request path.
- The EDR paste-target abstraction and everything premised on it (dental src/lib/edr/product.ts, edrProductName copy, 'identifiers live in the EDR' in ~100 strings, 'Copy for Curve' clipboard as primary egress, plaintext .md download fallback, CORPORATE_EMAIL note export via src/lib/email/sendSubmission.ts) — the merged product IS the record; egress becomes print/statement/portal/records-request, each a logged disclosure; product.ts survives only inverted as a source-system label for conversions.
- The whole-app de-identification premise as a compliance story: PHI S0 blocking of legitimate identifiers in the record and the attested override-as-waiver flow (dental src/components/builder/PhiOverrideDialog.tsx, e2e/phi.mask-override.mjs semantics) — replaced by outbound-boundary classification and real access controls (RLS, MFA, read logging, BAAs). Every 'we hold no PHI' answer must be replaced by a technical control.
- ADMIN_PASSWORD_RESET environment-variable break-glass and the default-off MFA flag (dental src/lib/auth/mfaFeature.ts) — replaced by mandatory MFA with recovery codes and a two-admin dual-control recovery ceremony.
- Hand-rolled SCHEMA_BOOT_VERSION + idempotent DDL array (dental src/lib/db/ddl.ts, schemaBoot.test.ts) and the stale drizzle/0000_init.sql — replaced by drizzle-kit migrations with history and a shadow-DB CI check; the version-bump discipline survives as 'schema changed without a migration fails the build'.
- Unencrypted IndexedDB/localStorage draft mirror as shipped (dental src/lib/client/draftBackup.ts) and the dismissible client-only SharedTabletIdleLock — rebuilt encrypted with a session-derived key, wiped on sign-out/author switch, disabled on the shared-device profile, with a server-enforced idle timeout.
- Vercel serverless assumptions (pool max:1, 60s maxDuration, weekly cron as the only background work, globalThis memos) — replaced by long-lived containers and pg-boss.
- Serial integer primary keys and globally sequential user-visible ids (DN-0001 tickets) — replaced by UUIDv7 and per-tenant sequences so identifiers never leak cross-tenant volume.
- Hard-coded America/New_York (dental src/lib/tickets/etTime.ts) and Tennessee-only rule bodies as literals (2027-01-01 supervision date, CSMD gate) — timezone moves to locations, jurisdiction becomes a rule-set parameter; the rules survive, the hardcoding does not.
- Law-watch HTML scraper as a product feature (dental src/lib/law/watch.ts, src/lib/email/sendLawWatchAlert.ts, src/app/api/law-watch/**, weekly cron) — detects presence not change, TN-only, untested; internal ops tool at most; keep timingSafeEqualStr for webhook secrets and in-app authority links.
- Static provisional risk-management page with localStorage checklists (dental src/components/risk/RiskManagement.tsx) and src/lib/risk/categories.ts as dead code — content folds into the server-attested compliance program and the findings register.
- Persona-agent IQ and generation fields (dental src/lib/training/persona-agents.ts) — keep archetypes as internal test fixtures with those fields removed.
- Dental's single fixed Cornerstone identity in code (src/lib/practice/config.ts with real addresses) and offices as ordering-only — becomes tenant seed data; locations become a real boundary.
- The entire precog application shell: TanStack Start routes (src/routes/** including the unrecoverable placeholder index.tsx), src/components/precog UI as-is, better-auth + Grok broker federation (src/lib/auth/**), Kysely/PGlite src/lib/db.ts, localStorage practice-context.tsx and PracticeProfile persistence, Zustand, unused Radix packages, vite plugins, scripts/, AGENTS.md sandbox scaffolding, and the committed PREVIEW_CLIENT_SECRET — rotate it and never carry precog's git history forward.
- precog src/lib/multiplayer/** (dead WebRTC), map-vision.ts Predator/Terminator vision modes and all military vocabulary (WHITE HOT, AO, ROE, mission brief, target deck, ticking UTC clock), threat-assessment.tsx, Johari panel, meta-analysis UI (keep its gap catalog as a backlog document), advanced-reasoning and layers panels as user-facing screens, the 'multi-agent'/'agent loop' framing (llm/multi-agent.ts, agent-loop.ts direct api.x.ai fetch), and the 'ml/' directory name (features/anomaly/forecast deleted; leading-indicators renamed signals).
- Grok/xAI as LLM provider and auth.grok.me as identity — neither will sign a BAA; any model call moves behind the dental assist cage with a BAA-covered provider and names stripped to roles.
- Per-use AI metering (FREE_RUNS, BYTESTAR_READS=3 on typing pauses) and per-provider seat surprises — AI is included or off, never metered to the practice; one per-location billing unit with unlimited users.
- Precog's self-asserted control booleans (independentBankRec, hand-entered StaffComposition, segregationScore) and the '95% CI' label on scaled hand-authored timelines — replaced by measured values from roster, grants and reconciliation runs; constants labelled directional.
- Any marketing claim of 'HIPAA compliant' as a product adjective, 'lawsuit-proof', 'board-proof', 'AI-powered' or indemnity ROI; any per-person ranking, leaderboard, letter grade, andon wall or 'top writer' digest — including as temporary engagement experiments; minimum-term or export-fee contract mechanics and proprietary imaging formats (documented switch-away triggers).

## Risks

- The readable ledger is the central bet and the market's observed success rate is zero: Open Dental, CareStack, Curve and Oryx each shipped ledgers their own billers hate across three different models. Mitigation: property-test the allocation model before any UI, choose the default view from the D.8 reaction test, run the biller/CPA ledger-reading probe as a Phase 1 exit gate, keep exactly one ledger view, and pilot beside an incumbent so failure is cheap and visible.
- The Phase 1 parallel pilot is enforcement on a mirror: refunds and write-offs are still posted in the incumbent, so dual release and SoD-from-grants run over the shadow ledger and the new tool's own roles until the PMS exists — partially regressing to Precog's questionnaire posture. Mitigation: say so in the pilot agreement and the exit criteria; the report-import ETL is a small unbudgeted conversion project and should be scoped as one.
- Clearinghouse and payer connectivity is the largest build risk and the #1 buying criterion; incumbents run ~100M claims a year, EDI re-enrollment takes up to 30 business days per payer, and a partial-quality claims module reproduces the exact complaint the product targets. Mitigation: one adapter, one vendor, contract and enrollments started a full phase early, ERA review-then-post never silent, payer coverage published honestly.
- Holding PHI is a step-change in liability from Smile Notes' de-identified posture: breach economics (~$6.64M average), OCR and TN 45-day notification, FTC exposure on every security claim (Dentrix G5 precedent), PCI scope if card data is mishandled, and a subprocessor inventory (Postgres, object storage, clearinghouse, processor, bank aggregator, messaging, STT, model provider) each needing a BAA. Everything both repos got 'for free' from not holding PHI must be re-derived; the adversarial panels in dental/knowledge/sources are the acceptance criteria.
- Enforced dual release trades speed for trust; a rigid threshold gets disabled the first week (alert override rates of ~88% in the literature) and a 1-owner/1-OM practice has a two-person approver pool. Mitigation: exceptions ship WITH the gate, thresholds set with the CPA at onboarding, owner-can-second-any, mobile one-tap approval, MFA step-up only above a high-value band, and the compliant path is never slower than an override because there is no override.
- Bank reconciliation depends on data from outside the product — an aggregator relationship, its DPA/BAA and coverage of small community banks. If the feed is unavailable the control degrades to statement import and the 'green' state is honestly downgraded. It is also the one place the design asks a customer to trust a system to police itself; mitigation is the sealed verifier and a read-only, logged bank path.
- Solo-owner capacity: both repos are single-author, and this is roughly 18–24 months of work for a small team even with reuse. Phases 2 and 3 are sequential by necessity; slippage compounds. Mitigation: Phase 1 exists to earn revenue and a falsifier before the full PMS is built; everything after Phase 3 is resequenced against pilot data, not built on faith; durations are estimates with exit criteria, not dates.
- Deferring the clinical record to Phase 3 idles the most mature, tested asset (Smile Notes) for ~a year and gives hygienists and dentists nothing to adopt while HS1/Curve/Denticon ship voice perio and eligibility; the perio window may close before Phase 3/5. Accepted deliberately in exchange for testing the novel thesis first.
- Precog's math has known defects (timeline sign inversion, beam-search status-quo drop, counterfactual ignoring variables, id-substring factors) and zero tests; its multipliers, priors and insurance discounts are illustrative. Shipping them as actuarial numbers is a liability for an attorney-owned product. Mitigation: fix on port with golden and monotonicity tests, versioned constants table, 'directional/educational' framing until calibrated against ACFE/ADA/carrier data, measured effectiveness wherever the PMS has the data.
- RLS + fresh-row authorization + PHI access logging + hash chaining on every request adds latency; acceptable at single-practice scale but needs a short-TTL session cache with revocation invalidation, partitioned log tables, PgBouncer and read replicas before group scale (Phase 4/5).
- Field-level encryption vs searchability: SSN, member ids, MFA secrets and bank identifiers are envelope-encrypted; names and DOB stay cleartext for search behind RLS and access logging — a defensible but explicit choice that must be documented in the product's own SRA and will be questioned by some buyers.
- Hiring-pool familiarity with Dentrix/Eaglesoft is a must-have a new entrant structurally cannot meet; the only counter is genuine one-shift learnability (command palette, role-before-work, temp quick-start, free certification) and it is a hypothesis until measured in pilot.
- Migration is the acquisition cost: imaging conversion, in-flight secondary claims and preauths, non-converting insurance benefits, EDI re-enrollment. The tie-out-or-refuse go-live rule protects the ledger promise but lengthens conversions; Eaglesoft's proprietary imaging may be unbridgeable. Treat conversion as product and price it publicly.
- Offline is deliberately bounded (read-only degraded mode in v1) and any local PHI cache is a breach surface on shared devices; practices burned by cloud outages may want more. Promising an offline ledger would mean unenforced controls — the one thing the product must never do — so the compromise must be stated publicly.
- Tennessee-only legal content (supervision, CSMD, teledentistry, retention, consent) limits commercial reach; per-state packs are a legal-research and counsel-review cost outside engineering, and no counsel or carrier has reviewed any of the existing content yet. Sell in TN first.
- Pricing anchors are low ($149–$700/month per location), only 16.9% of owners plan a software purchase in a given year, and the controls module cannot carry standalone ARPU above ~$100/month; the Phase 1 wedge validates but funds little, and the published rate card must be sustainable in that band. Published pricing and no-fee exit forgo lock-in revenue by design.
- Well-capitalized incumbents are moving on the same gaps (Curve's $200M R&D, HS1 Voice Perio/Eligibility Pro, Denticon AI perio and auto-835). The controls-and-reconciliation wedge is the part they are least likely to copy because it requires admitting their ledgers are the problem.
- The no-scoreboard doctrine versus owner demand: owners suspecting theft will ask for per-person adjustment reports. The design gives private, evidence-linked signals and a decision journal but refuses rankings and grades; some buyers will read that as a missing feature. Hold the line — it is also the liability posture.
- SOC 2 Type 2 requires an observation period and cannot exist at launch; early buyers are asked to trust a pen test, a documented SRA and a published incident policy for roughly a year. Engaging the auditor in Phase 2 shortens but does not remove this.
- The design partner (Cornerstone, ~30 staff, three locations) is larger than the 1–3 dentist target and risks pulling scope toward group features before the solo-practice core is proven; pilot one location and recruit a small practice for the clinical pilot.
- Keeping NextAuth v5 beta is a beta dependency in a PHI system; mitigated by pinning, wrapping all session logic behind guards.ts and the sessions table so the provider is swappable, and revisiting at Phase 4 hardening.
- Both source repos have effectively no commit history (dental: one squashed commit; precog: one broken commit), so 'battle-tested' claims about individual fixes cannot be bisected; the test suites and e2e probes are the evidence, and the precog engines have none until Phase 0 adds them.
- Re-scoping the PHI rules from 'block filing' to 'outbound boundary only' removes the premise every safety argument in the dental knowledge base rests on and touches ~100 strings, the precision harness and the byteaudit contract; Phase 3 is sized for it but it is real refactor risk — keep runTextAudit pure and pass context as arguments.
