# Design lens 4: controls-trust

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 12 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, controls-trust

## Summary

A cloud dental PMS for independent general practices and small groups (1–9 locations) whose organizing promise is that the owner can trust the money: every dollar in the ledger is an append-only, reason-coded, human-readable event; every refund, write-off, adj…

## Lens

controls-trust

## Product vision

A cloud dental PMS for independent general practices and small groups (1–9 locations) whose organizing promise is that the owner can trust the money: every dollar in the ledger is an append-only, reason-coded, human-readable event; every refund, write-off, adjustment and vendor payment above a threshold physically cannot post without a second named person; segregation-of-duties conflicts are detected from the roles the PMS itself grants, not from a questionnaire; the day sheet reconciles to the actual bank deposit every morning; and the practice's control posture is continuously scored against COSO with a dated decision journal an insurer, CPA or Board investigator will accept. It replaces the PMS plus the separate HIPAA/OSHA compliance subscription plus the CPA's annual control review, and it is sold to the office manager and biller as much as to the owner. It wins because (1) the research shows no PMS is praised for ledger clarity after dual coverage and partial payments and no SMB product interactively tailors financial controls — while 48% of dentists are embezzled and only 17% of thefts are caught by designed controls; (2) incumbents cannot enforce controls they merely recommend, and a standalone controls tool cannot enforce anything at all — only the system that posts the transaction can refuse it; and (3) the two cheapest differentiators in the entire market are decisions, not builds: a published rate card and contractual, no-fee, self-service data exit including DICOM. Clinically it inherits Smile Notes' deterministic note-quality gate, ADA notation library and PHI-boundary engine; operationally it inherits Precog's SoD rulebook, dual-release engine and COSO mapping — both rewired onto real patient, ledger and role data instead of de-identified drafts and demo fixtures.

## Guiding principles

- Controls are enforced in the transaction path, never merely recorded. evaluateRelease() runs server-side inside the same database transaction as the ledger post and can return a refusal; a client-computed verdict is never authorization. The 'recorded vs enforced' test from the research is applied to every control before it ships.
- The ledger is append-only and readable by construction. Balance is sum(delta); corrections are reversal-plus-repost; every row carries a typed kind, a reason code, the posting user frozen by name, and an explicit allocation to the charge it paid. There are no hidden, auto-generated, or 'transfer adjustment' rows. Insurance estimates live in a separate table and are never mixed into the patient balance.
- The bank is the only independent ground truth. The PMS is manipulable by anyone with access (that is the Zeldent thesis and the Prosperident data), so daily deposit-to-day-sheet reconciliation with an owner-cleared variance queue is a first-class screen, not a report — and it pulls bank data from outside the PMS.
- Authorization is derived per request from a fresh database row, never from a token. Carry requireRole()'s fresh-PK-read shape forward, extend it with practice_id and location scope, and flip the API to default-deny with a wrapper every handler must pass through plus a CI test that fails on any unwrapped route.
- Three orthogonal authority axes, never one ladder: administrative rank (who manages accounts), clinical licence (who may diagnose, file, prescribe — from clinicalRoles.ts), and financial authority (who may post, adjust, approve, reconcile — from Precog's 14 entitlements). SoD detection is a query over the third axis on real grants.
- Immutability is a database property, not a convention. Ledger, approvals, control decisions, audit log and PHI access log are written by an append-only role with UPDATE/DELETE revoked, hash-chained per row, and verified by an independent sealed verifier in the byteaudit pattern that restates the promises rather than importing them.
- Frozen attribution: any name shown on a record is snapshotted at write time with no FK, so the record outlives the account and a rename or merge can never forge history (the Smile Notes convention, applied to every financial row).
- Signals are batched and practice-scoped; blocks are immediate and person-scoped. Owner alerts follow the digest rules (never a single note, re-scope to the practice when most staff trip it, always carry the sample size) except for hard events — after-hours refund, retroactive edit, waived dual control — which page the owner individually.
- Never score people; score control design and residual risk. No letter grades, no peer scoreboards, no staff ranking, no app currency redeemable for value. Precog's anti-accusation guardrails and Smile Notes' no-scoreboard doctrine are both hard constraints — two adversarial panels named them as walkout triggers.
- The compliant path is the fastest path. Wherever a control has an override, the compliant action must be fewer clicks than the override, and every override requires a controlled reason code plus free text that is aggregated, not buried.
- Published pricing, published exit terms, published uptime, one billing unit (per location, unlimited users and providers), no per-use AI metering. These are trust controls and they cost nothing to build.
- PHI leaves the tenant only through an explicit, logged, BAA-gated boundary. Smile Notes' PHI gate inverts from 'the whole app is de-identified' to 'this specific field may cross to this specific BAA-covered destination', and every AI call, export, print, fax and portal send is a disclosure event in the access log.
- Refuse to start rather than silently lose or expose records. Production boots only with a verified-TLS Postgres URL, an encryption key, a backup target and an append-only database role present — extending resolveDbBackend()'s two-hands guard to every load-bearing dependency.
- Every score and every gate explains itself: RiskDrivers with direction and weight, a SCORING_VERSION stamped on every frozen snapshot, a RULESET_VERSION stamped on every filed note, and a one-click path from any finding to the underlying rows. No percentage confidence, no compliance score, no 'you are protected' copy anywhere.

## Modules


### Item 1
- **name**: Identity, Sessions and MFA
- **purpose**: Per-user identity for every staff member (no shared logins, ever), mandatory TOTP with recovery codes for all roles, server-side session table with idle timeout, device list and admin kill, plus the JWT watermark as belt-and-braces. Break-glass replaced by dual-admin recovery.
**reuse from**

/home/user/catcorner22/dental/src/lib/auth/{auth.ts,auth.config.ts,guards.ts,freshUser.ts,roles.ts,clinicalRoles.ts,throttle.ts,hashGate.ts,clientIp.ts,sessionWatermark.ts,totp.ts,password.ts,resetToken.ts,issueResetLink.ts,loginFormState.ts,loginAction.ts}; /home/user/catcorner22/dental/src/app/api/me/mfa/route.ts; /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts; /home/user/catcorner22/dental/e2e/{lockout,mfa.totp,headers}.mjs. Pattern-only from /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts (Fetch-Metadata cross-site guard) and verify.server.ts (fail-closed when real DB present).

- **build new**: sessions table (id, user_id, practice_id, created, last_seen, idle_deadline, device_label, revoked_at) checked inside requireRole; mfa_recovery_codes (hashed); mandatory-MFA enrollment gate at first login; WebAuthn/passkey later; encrypt mfa_secret with envelope key; delete ADMIN_PASSWORD_RESET and replace with a two-admin recovery ceremony; Origin/Sec-Fetch-Site check in the guard wrapper.
- **priority**: v1-core
- **ux notes**: Login is byte-identical on every failure (keep the no-oracle e2e). Shared operatory tablets get a device profile with a 5-minute idle lock that actually invalidates the session and a hard author switch. 'Nobody at the practice can see or set your password' stays in the reset email verbatim.

### Item 2
- **name**: Tenancy, Locations and Authorization Spine
- **purpose**: practice_id on every table with Postgres RLS as a backstop against a missing WHERE clause; location as a real authorization boundary (not a picker order); the default-deny API wrapper; three-axis role model with named capability predicates.
**reuse from**

/home/user/catcorner22/dental/src/lib/auth/roles.ts (MANAGE_CEILING actor-x-target matrix, allowlist predicates); /home/user/catcorner22/dental/src/lib/auth/clinicalRoles.ts; /home/user/catcorner22/dental/src/lib/law/license-scope.ts; /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts (the 14 entitlements become the financial-authority axis); /home/user/catcorner22/dental/src/lib/db/repo/offices.ts (shape only, semantics inverted to a boundary).

**build new**

withGuard(handler, {minRank, entitlements[], locationScope}) wrapper; SET LOCAL app.practice_id per transaction and RLS policies on every table; role_grants table (user, entitlement, location, granted_by, granted_at, revoked_at) as an event log; CI test that globs src/app/api/**/route.ts and fails on any export not wrapped; per-tenant advisory-lock salting (hash practice_id into the FNV key the way gamify.ts does).

- **priority**: v1-core
- **ux notes**: Roles are set at provisioning, never day-of (temp-recruiter panel). Setup wizard uses Precog's six ROLE_TEMPLATES as defaults and shows the SoD conflicts each default creates before the first login is issued — setup is the first assessment.

### Item 3
- **name**: Tamper-Evident Audit and PHI Access Log
- **purpose**: Two append-only streams: audit_log for writes/auth/admin/exports with hash chaining, IP and user-agent columns, and 6-year retention; access_log for every PHI read (chart open, ledger view, claim inspect, search result set) so the snooping half of insider abuse is visible. Both rendered in plain sentences and reviewed monthly as a logged act.
**reuse from**

/home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts (single write point, per-column caps, marked truncation, frozen actor name, (at,id) ordering, security filter); /home/user/catcorner22/dental/src/lib/byteaudit/{contract.ts,verify.ts,seal.ts,manifest.ts} (sealed independent verifier pattern, extended to verify chain integrity); /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts lines 18-22 (timingSafeEqualStr).

**build new**

prev_hash/row_hash columns with HMAC over canonical row + previous hash; append-only Postgres role (REVOKE UPDATE, DELETE) used by the app for these tables; nightly chain verification job writing its own audit row; daily export of the chain head to object storage with Object Lock; access_log written from the repo layer for every PHI-bearing SELECT by record id; 'explain this row' renderer ('Sarah P. reversed payment #4412 at 4:12pm, reason: posted to wrong account').

- **priority**: v1-core
- **ux notes**: Owner sees a monthly 'review the log' task that produces an attested review row. Everything is filterable by person, record, and source IP; successful sign-ins are hidden by default because they are the noise.

### Item 4
- **name**: Patients, Accounts and Insurance Coverage
- **purpose**: Patient demographics, guarantor/family accounts, insurance plans and coverages (primary/secondary with COB order and effective dates), fee schedules per plan per provider maintained in one place, and the eligibility record.
- **reuse from**: new (Smile Notes has no patient entity; Precog has none). Reuse /home/user/catcorner22/dental/src/lib/http/{readJson.ts,pagination.ts} and /home/user/catcorner22/dental/src/lib/db/int4.ts for input hygiene; /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts + maskPhi.ts as the outbound-boundary classifier for exports.
**build new**

patients, guarantors, patient_guarantor, insurance_carriers, insurance_plans, coverages (patient, plan, rank, subscriber, effective_from/to), fee_schedules, fee_schedule_lines (plan, provider, cdt_code, allowed_cents), eligibility_checks (append-only responses); keyset pagination; patient merge as an event (never re-attributes frozen rows); per-patient restriction flags (employee/VIP) with break-the-glass that logs a justification.

- **priority**: v1-core
- **ux notes**: Patient rail persists across every module (the Curve Sidekick pattern) with a privacy mode that hides names on operatory glass. Critical flags (allergy, premed, anticoagulant, financial hold, guardianship) are one un-collapsible channel shown on patient selection.

### Item 5
- **name**: Readable Ledger
- **purpose**: The signature module. One canonical, append-only patient/account ledger in integer cents with explicit allocation, typed reason-coded entries, reversal-not-edit corrections, and a derived 'why does this patient owe this' narrative. Insurance estimates and expected write-offs are kept in a separate estimates table shown beside, never inside, the balance.
**reuse from**

/home/user/catcorner22/dental/src/lib/db/repo/gamify.ts (balance = sum(delta), partial unique index for idempotency, pg_advisory_xact_lock spend serialization, refund-by-append — swap points for cents); /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts fileSubmissionAtomic (claim+freeze+verify in one transaction, for day close); /home/user/catcorner22/dental/src/lib/compose/filedNoteEqual.ts idea (dedupe on the rendered artifact, applied to statements/claims).

**build new**

ledger_entries (practice, account, patient, kind ∈ charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer|reversal, amount_cents, currency, reason_code, effective_date, posted_at, posted_by_id, posted_by_name, encounter_id, procedure_id, claim_id, reverses_entry_id, approval_id, idempotency_key), allocations (payment_entry → charge_entry, cents) with a check that allocations never exceed either side, reason_codes table (typed, practice-editable under maker-checker), estimates table, day_closes (frozen day sheet totals + hash), property-test suite for dual coverage/partial payment/secondary posting/reversal before any UI.

- **priority**: v1-core
- **ux notes**: Default view is a running ledger with every row explaining itself in one sentence; toggle to itemized-by-procedure. An 'Explain balance' button renders the allocation chain in plain English for the front desk. No row is ever hidden; unallocated payments are a visible queue, not a hidden state.

### Item 6
- **name**: Dual Release and Approval Policy (enforced)
- **purpose**: Two-person control on refunds, write-offs, adjustments over threshold, new vendors, ACH/check releases, deposit posting and payroll, with scoped/dated threshold exceptions, executed inside the ledger transaction so an unapproved post is refused, and an immutable approval record.
**reuse from**

/home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts (evaluateRelease, matchExceptions, resolveEffectiveThreshold, exceptionSpecificity, mitigatedSodRuleIds, activeExceptionSummary — replace the demo `people` import with the users/role_grants repo); /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts (maker-checker state machine + append-only events, fixed with compare-and-set); /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts decideRedemption (the conditional-update pattern).

**build new**

dual_release_policies and threshold_exceptions tables (versioned, maker-checker edited); approvals table (request, channel, amount, requester, first_approver, second_approver, status, applied_exception_id, reasons[], created/decided timestamps, frozen names); postLedgerEntry() calls evaluateRelease() server-side and refuses on any blocked_* status; second-approver inbox with MFA step-up; waive_dual always requires owner + residual note and auto-expires; fix the Infinity threshold type leak.

- **priority**: v1-core
- **ux notes**: The control appears as an inline card on the refund/write-off form ('Needs a second approver: Dana or Dr. Reagan are eligible — request now'), not as a settings page. The requester can keep working; the approver gets one tap with the ledger context. Owner sees raises/waives expiring soon on the daily screen.

### Item 7
- **name**: Bank Reconciliation and Deposit Matching
- **purpose**: Daily comparison of posted collections (by tender type) to actual bank deposits pulled from outside the PMS, deposit-slip preparation, automatic matching, an owner-cleared variance queue, and anomaly alerts (refund above threshold, after-hours transaction, retroactive-dated entry, deposit gap).
- **reuse from**: new. Conceptual spec from KB!knowledge/sources/zeldent-dental-fraud-detection.md and the reconciliation control in /home/user/catcorner22/precog/src/lib/precog/scoring/dynamic-variables.ts (independentBankRec becomes a measured status with a real detection-lag number).
**build new**

bank_accounts, bank_transactions (append-only import via Plaid/Finicity-class aggregator or OFX/CSV statement import), deposits (prepared slips with cash/check/card breakdown), reconciliations (day, expected_cents, actual_cents, variance, cleared_by, cleared_at, note), anomaly_events; nightly job computes variances and writes leading-indicator facts; card processor settlement import to match card batches.

- **priority**: v1-core
- **ux notes**: The owner's home screen IS this screen: yesterday's day sheet vs deposit, three tender rows, one variance number, one 'clear or investigate' action. Green requires the bank feed, not a self-assertion. Detection lag is shown in days, the number the embezzlement research says matters most.

### Item 8
- **name**: Segregation-of-Duties Monitor and Control Register (COSO)
- **purpose**: Continuous SoD conflict detection over real role_grants, residual-risk scoring with named drivers, COSO 17-principle heat map derived from live state (role changes, approvals, reconciliation status, open decisions), tornado sensitivity, and the decision journal (remediate / compensate / accept-on-purpose / insure) with review dates.
**reuse from**

/home/user/catcorner22/precog/src/lib/precog/sod/{conflict-rules.ts,detect.ts}; /home/user/catcorner22/precog/src/lib/precog/scoring/{weights.ts,residual-engine.ts}; /home/user/catcorner22/precog/src/lib/precog/coso.ts (parameterize assessCoso(practiceState)); /home/user/catcorner22/precog/src/lib/precog/ml/leading-indicators.ts (rename to signals); /home/user/catcorner22/precog/src/lib/precog/practice-profile.ts DecisionEntry; /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts (remediation copy); /home/user/catcorner22/dental/src/lib/risk/categories.ts coverageByCategory pattern; /home/user/catcorner22/dental/src/lib/audit/precision/ harness for zero-false-block ratcheting.

**build new**

control_snapshots (practice, scoring_version, computed_at, portfolio JSON, coso JSON, sod JSON) frozen nightly and on every control event; control_decisions table (append-only, owner-attributed, residual_at_decision, review_by, linked evidence); replace control-id substring matching with typed fields (fraud_opportunity_class, asset_exposure, duty_family); derive StaffComposition from roster/grants instead of hand entry; fix the timeline sign convention and assert it; magic constants moved into the versioned weights table; COSO P9 and P11 driven by role_grants events.

- **priority**: v1-core
- **ux notes**: Not a dashboard: findings surface where the cause is (a conflict banner on the role-grant screen at the moment the grant is made; a 'this write-off will be your 4th unapproved this month' inline). The heat map is one owner screen with deep links from each principle to the rows behind it. Neutral vocabulary; no WHITE HOT, no target deck.

### Item 9
- **name**: Owner Alerts and Digest
- **purpose**: Batched, practice-scoped signal digest for the owner/lead (never per-person rankings) plus immediate individual alerts for hard control events, with acknowledgment stamping so oversight is a closed loop.
- **reuse from**: /home/user/catcorner22/dental/src/lib/digest/{digest.ts,similarity.ts,filingRollup.ts} (SYSTEMIC_SHARE rule, min-sample rules, copy-forward discriminator); /home/user/catcorner22/dental/src/lib/auth/throttle.ts key-namespacing for alert metering; /home/user/catcorner22/dental/src/lib/email/threading.ts (opaque token threading).
- **build new**: digest_acks table; hard-event alert channel (email/SMS via BAA-covered provider) for after-hours refunds, retroactive edits, waived dual control, chain-verification failure, new device login; weekly control digest with one 3-action coach card.
- **priority**: v1-core
- **ux notes**: Digest opens on 'what changed and what to do', not on people. Hard alerts are the only push notifications the product ever sends.

### Item 10
- **name**: Scheduling and Front Desk
- **purpose**: Multi-location schedule with operatories, provider columns, appointment types with behavior (confirm/recall/emergency/new patient), supervision-level validation for hygiene appointments (TN PC1107 and the general/direct matrix), check-in with eligibility, and a coordinator documentation-status strip.
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/supervision.ts (effective-dated rule, moved to appointment validation); /home/user/catcorner22/dental/src/lib/law/license-scope.ts; /home/user/catcorner22/dental/docs/tn-license-scope-mermaid.md as spec.
- **build new**: appointments, appointment_types, operatories, provider_schedules, recall_due, waitlist; appointment deletions/moves as an audited entitlement (a gap Precog's rulebook does not cover); supervision validator at booking; role-safe color coding with shape channel.
- **priority**: v1-core
- **ux notes**: Front desk home is the board. One click from an appointment to check-in, eligibility result, and checkout. Documentation status per chair without PHI leakage across the desk.

### Item 11
- **name**: Insurance: Eligibility, Claims, ERA Posting
- **purpose**: Real-time eligibility at booking and check-in, claim assembly from encounter procedures with a scrubber that blocks known denial causes, secondary claim auto-generation, batch submission through a clearinghouse, claim tracker with age/status/next action, and 835/ERA auto-posting into the ledger with line-item match and reason-coded write-offs that flow through dual release.
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts and completeness.ts (narrative-supports-the-claim pre-flight, now bound to the actual CDT lines); /home/user/catcorner22/dental/src/lib/export/csv.ts; ledger and approvals modules above.
- **build new**: claims, claim_lines, claim_events (append-only status), attachments refs, eras, era_lines, scrubber_rules (versioned); clearinghouse adapter interface with one implementation (DentalXChange/Vyne class) behind the BAA-gated integration registry; denial-suppression detection (write-off immediately after denial with no appeal event) as an SoD-adjacent anomaly.
- **priority**: v1-core
- **ux notes**: Biller home is the claims worklist plus unposted ERAs. Every ERA write-off shows the reason code and whether it needed approval; denial write-offs above threshold cannot be posted by the same person who submitted the claim.

### Item 12
- **name**: Clinical Notes and Documentation Gate
- **purpose**: Smile Notes' deterministic, versioned note builder and S0–S4 audit engine, re-scoped from de-identified drafts to encounter-attached chart notes: identifiers are legitimate content, the PHI rules become the outbound-boundary classifier, filing authority follows clinical licence, filed notes are immutable with a first-class addendum chain.
**reuse from**

/home/user/catcorner22/dental/src/lib/{schema,modules,vocab,audit,standardize,extract,verify,compose,readback}/**; /home/user/catcorner22/dental/src/lib/auth/approval.ts; /home/user/catcorner22/dental/src/lib/client/{autosaveMachine.ts,useAutosave.ts}; /home/user/catcorner22/dental/src/lib/db/repo/drafts.ts (OCC + revision ring); /home/user/catcorner22/dental/src/lib/version.ts + CI version-stamp guards; /home/user/catcorner22/dental/skill/assets/dental-note-templates.md as the module spec.

**build new**

encounters and clinical_notes tables with mandatory encounter FK (attachment is structural, never a tag); note_addenda (amends_note_id, reason_code, actual timestamp); jurisdiction parameter on rule sets; re-scope phi.* S0 rules to boundary-only; decompose BuilderShell.tsx (2,127 LOC) into encounter context + builder; retire the EDR paste seam and clipboard handoff; encrypted or disabled local draft mirror bound to session key.

- **priority**: v1-core
- **ux notes**: Home is the note. Named omission licences on every required field; killer items hard-block filing; validation silent until blur. Prose and structure coexist; paste intake with one click per destination survives as the legacy-note migration tool.

### Item 13
- **name**: Odontogram and Perio Charting
- **purpose**: Editable tooth chart with existing-conditions and planned/completed layers driven by an event log, propagating painted procedures into the treatment plan and the encounter; six-point perio charting completable by one operator inside a hygiene appointment with voice entry.
**reuse from**

/home/user/catcorner22/dental/src/lib/vocab/{teeth.ts,surfaces.ts} (verbatim); /home/user/catcorner22/dental/src/components/builder/Odontogram.tsx (glyph geometry and paint policy); /home/user/catcorner22/dental/src/lib/extract/chart.ts (contradiction pairs, readback); /home/user/catcorner22/dental/src/components/builder/fields/{ToothPicker,SurfacePicker}.tsx (poka-yoke); /home/user/catcorner22/dental/src/lib/dictation/{engine.ts,normalize.ts,enrollment.ts} (swappable engine seam).

**build new**

chart_events (tooth, surfaces, condition/procedure, status, provider, encounter, historical flag supplied by the human — the extractor correctly refuses to guess temporality); perio_exams and perio_sites (6 sites × depth/recession/BOP/mobility/furcation) with prior-visit delta; on-device or BAA-covered STT engine behind the existing DictationEngine interface (the browser SpeechRecognition engine is offDevice and cannot touch PHI).

- **priority**: v1-nice
- **ux notes**: Perio: auto-advance, audible confirmation of the READBACK_CLASS tokens, undo by voice, completes in the appointment. Chart: one painting gesture writes code, site, surfaces, provider and visit group everywhere. Severity colors never used on the chart.

### Item 14
- **name**: Treatment Plans and Case Presentation
- **purpose**: Multiple concurrent plans per patient with visit phasing, per-visit patient-portion estimates from the fee schedule and coverage, presentable to the patient; plan-authored text may not become the encounter note until individualized and gated.
- **reuse from**: /home/user/catcorner22/dental/src/lib/modules/shared.ts PROCEDURE_STATES (Recommended…Declined, never collapsed); consent object spec from /home/user/catcorner22/dental/skill/references/tennessee-dental-law-summary.md.
- **build new**: treatment_plans, plan_procedures (status enum), plan_visits, consents (decision enum, consenting party + relationship, questions asked, separate marketing-image scope); estimate engine reading fee_schedule_lines and coverages; explicit conversion gate at checkout.
- **priority**: v1-nice
- **ux notes**: Money lives on the plan and the ledger, never in the clinical note (the practice's own rule) — separation of surfaces, not suppression of data.

### Item 15
- **name**: HIPAA/OSHA Compliance Program
- **purpose**: Guided security risk analysis, tailored policies kept current, staff training with certificates, BAA registry that gates integrations and outbound PHI channels, OSHA logs (sterilizer biological monitoring with 2-year retention), incident intake and breach-clock workflow, records-request workflow with the TN ten-working-day SLA and full-record export.
**reuse from**

/home/user/catcorner22/dental/src/lib/wishes/wishes.ts + /home/user/catcorner22/dental/src/app/api/wishes/ (low-friction observation/tip intake — add PHI gate and tenant scope, add anonymous option); /home/user/catcorner22/dental/src/lib/training/ (server-verified drills against the real engine); /home/user/catcorner22/dental/src/lib/law/tn-law.ts and license-scope.ts rendered in-app; /home/user/catcorner22/dental/src/lib/requests/gauntlet.ts as internal engineering process only.

**build new**

business_associates + baas (countersigned doc, expiry) with integration_registry.enabled requiring a live BAA; policies (versioned, generated from practice answers under maker-checker); training_completions; compliance_logs (sterilizer, equipment daily check); incidents with TN 45-day / HIPAA 60-day clocks; records_requests; retention clocks per record keyed to last contact and patient age; legal_hold flag blocking purge; destruction_log.

- **priority**: v1-nice
- **ux notes**: One 'practice risk' module covering financial controls, HIPAA and OSHA, because that is the budget line practices already have. Provisional content is labeled provisional. Checklists are server-side attested, not localStorage.

### Item 16
- **name**: Patient Communications and Portal
- **purpose**: Two-way texting, confirmations, recall fill, online booking, digital intake writing into the chart, statements, and a portal delivering plain-language summaries — all in the base price, each channel BAA-gated.
- **reuse from**: /home/user/catcorner22/dental/src/lib/vocab/plain-language.ts and the patient-audience rules in /home/user/catcorner22/dental/src/lib/audit/engine.ts; /home/user/catcorner22/dental/src/lib/email/threading.ts; single-fixed-recipient egress principle generalized to an enumerated destination allowlist per channel.
- **build new**: messages (append-only, channel, direction, template_version), consents for SMS/email, portal accounts with separate auth, portal delivery gate (open plain-language/stigma findings block delivery; empty summary cannot claim delivery), statement generation job with dedupe on rendered artifact.
- **priority**: v2
- **ux notes**: Guardian-addressed phrasing when the patient is a minor. Every outbound message is a disclosure event in the access log.

### Item 17
- **name**: Imaging Bridge and Documents
- **purpose**: Images and scanned documents stored in the patient record via object storage with signed URLs, DICOM export on demand, a published certified-sensor list via TWAIN/bridge, and portable exit.
- **reuse from**: new. Imaging-record spec from /home/user/catcorner22/dental/skill/references/sedation-and-imaging.md (per-structure interpretation status, CBCT entire-volume duty).
- **build new**: documents, images (object key, sha256, modality, acquired_at, interpreted_by, interpretation status), signed-URL service, virus scan, retention; bridge adapter interface; DICOM export job.
- **priority**: v2
- **ux notes**: Radiograph interpretation is a completeness gate on the encounter, not optional. Export is one click and free.

### Item 18
- **name**: Data Migration and Exit
- **purpose**: Conversion tooling from Dentrix, Eaglesoft, Open Dental, Ascend, Denticon and Curve with a published fixed price and timeline, an explicit list of what does not convert, EDI re-enrollment run for the practice — and the mirror image: self-service full export (structured + documents + DICOM) with no payment gate and a published API.
**reuse from**

/home/user/catcorner22/dental/src/components/builder/PasteIntake.tsx + /home/user/catcorner22/dental/src/lib/standardize/ (human-in-the-loop legacy note ingest); /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts (confirm safety-critical tokens on imported data); /home/user/catcorner22/dental/src/lib/edr/product.ts inverted into an incumbent-system label for conversions; /home/user/catcorner22/dental/src/lib/export/csv.ts.

- **build new**: import staging schema, per-source mappers, reconciliation report (counts and balances tie-out to the old day sheet), export bundle job, versioned OpenAPI v1 read/write API with per-tenant keys and webhooks.
- **priority**: v1-nice
- **ux notes**: The conversion report is itself a trust artifact: opening AR in the old system must equal opening AR in the new ledger to the cent, or the go-live is refused.

### Item 19
- **name**: Trust Page and Commercial Terms
- **purpose**: Public rate card (one per-location price, unlimited users/providers, every add-on priced, year-two rate), exit and export terms, status page with incident history and uptime, SLA with credits, SOC 2 Type 2 and HIPAA attestation, subprocessor list with BAA status.
- **reuse from**: new; content model from KB!knowledge/sources/open-dental-fee-schedule.md and RPT C.1 buyer checklist.
- **build new**: Status page fed by real health checks; published post-incident reports; in-product cost calculator that cannot produce a surprise.
- **priority**: v1-core
- **ux notes**: Every one of the six C.1 buyer-checklist questions is answered on one public page.

### Item 20
- **name**: AI Assist (caged)
- **purpose**: Optional, opt-in, BAA-covered model assistance for note normalization, SOAP partition, claim-narrative pre-flight and control coaching — every output verified deterministically before a human sees it, no per-use metering, no training on practice data.
**reuse from**

/home/user/catcorner22/dental/src/lib/assist/{service.ts,tier.ts,prompts.ts,extraction.ts,drift.ts,non-goals.ts}; /home/user/catcorner22/dental/src/lib/verify/**; /home/user/catcorner22/dental/src/lib/bytestar/{config.ts,escape.ts,ladder.ts,one-way.ts,router.ts} (killswitch, escape ladder, one-way feedback); /home/user/catcorner22/dental/docs/model-charter.md; /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts (names stripped, roles only); /home/user/catcorner22/precog/src/lib/precog/rag/retrieve.ts.

- **build new**: Provider interface with a BAA-covered endpoint (zero retention); field-level PHI boundary gate replacing the whole-app gate; per-call disclosure row in access_log; retire the ambient-dictation non-goal deliberately only if an on-device or BAA engine exists.
- **priority**: v2
- **ux notes**: Refuse, never score. Deterministic twin ships for every capability so 'AI off' never means 'feature gone'.

### Item 21
- **name**: Points Economy, Store, Badges, GPA
- **purpose**: Staff currency redeemable for value, letter grades, badges.
- **reuse from**: /home/user/catcorner22/dental/src/lib/{gamify,gpa,stats}/ — extract only the append-only ledger pattern (already listed under Readable Ledger) and the ops metrics time-to-file / after-hours rate.
- **build new**: none
- **priority**: drop
- **ux notes**: A tracked currency redeemable for gift cards approved by a single lead is a segregation-of-duties finding the product itself would flag; three adversarial panels name scoring as a walkout trigger.

## Architecture

STACK. Next.js 15 App Router / React 19 / TypeScript, Node runtime only (no Edge), served as long-lived containers (e.g. AWS ECS/Fargate or Fly.io) — not serverless — because the product needs background workers (claim batches, ERA posting, bank sync, statements, nightly control snapshots, chain verification). Rationale for keeping the dental stack over precog's: the dental repo has 201 test files, wire-level security e2e probes, a hardened auth layer and a production runbook; the precog repo does not build (src/routes/index.tsx is a 32-byte placeholder), has zero tests, no persistence and no auth call sites. Precog contributes a domain layer (~1,400 durable LOC) that is framework-free and lifts as pure TypeScript.

Libraries: Drizzle ORM on Postgres (keep), with drizzle-kit generated migrations replacing the hand-rolled SCHEMA_STATEMENTS array (keep the CI 'ddl changed without version bump' guard as a 'migration added without changelog entry' guard); pg-boss for jobs so the queue lives in Postgres and adds no subprocessor; Auth.js/NextAuth v5 Credentials + otpauth TOTP (keep) with a new server-side sessions table; Zod for all request bodies behind readJsonRecord; Vitest + Playwright (promote the e2e probes into the blocking CI job); OpenAPI via zod-to-openapi for the public v1 API. UI: Tailwind v4 with the dental design tokens (design-tokens.json, severity luminance ladder, 44px target floor), Radix primitives for accessible select/dialog/combobox (precog declares them, uses none), React Flow only if a process map survives (it does not in v1). Dictation: DictationEngine seam kept; browser SpeechRecognition disabled for PHI fields until an on-device Whisper WASM engine or BAA-covered STT lands. Payments: processor-hosted vault/hosted fields so cardholder data never touches the app (PCI scope minimization). Bank data: aggregator (Plaid/Finicity class, BAA/DPA reviewed) with OFX/CSV statement import as the fallback. Clearinghouse: adapter interface, one implementation (DentalXChange/Vyne class) — do not build payer connectivity.

DATABASE AND HOSTING. Managed Postgres with PITR and cross-region backups (Neon, RDS or Crunchy), TLS pinned to verify-full by pinPostgresSslMode (lift verbatim). Three database roles: app_rw (normal tables), app_append (INSERT-only on ledger_entries, allocations, approvals, control_decisions, audit_log, access_log, chart_events, claim_events; UPDATE/DELETE revoked), app_migrate. Field-level envelope encryption (KMS-managed data key per tenant) for mfa_secret, SSNs, bank account identifiers and document keys. Object storage with Object Lock for documents, images and the daily audit-chain head. Restore drill is a scheduled job that restores last night's backup into a scratch database and runs the tie-out; its result is an audit row.

MULTI-TENANCY. Shared database, practice_id NOT NULL on every table, Postgres RLS enabled on every table with policies keyed on current_setting('app.practice_id'); every transaction opens with SET LOCAL app.practice_id from the guard. The guard's fresh-row read (requireRole) is extended to return practice_id and location grants; repo functions take a TenantCtx as their first argument and there is no repo function without one (lint rule). Location is an authorization boundary for financial and scheduling data (DSO panel E5) while clinical cover across locations is an explicit grant. Advisory-lock keys are salted with practice_id (the FNV pattern from gamify.ts). Serial ids are replaced by ULIDs for anything user-visible; tickets/statement numbers are per-tenant sequences.

API. Default-deny: middleware refuses /api/* unless the route module exports a handler produced by withGuard(); a CI test globs src/app/api/**/route.ts and fails on any bare export. withGuard enforces session, MFA, active, watermark, practice scope, entitlement list, Origin/Sec-Fetch-Site, body size and Content-Type. Every money-moving handler calls the ledger service, never the tables; the ledger service runs evaluateRelease() inside the transaction and refuses. Public API v1: versioned OpenAPI, per-tenant keys hashed at rest, webhooks with HMAC, enabled only when the partner has a countersigned BAA in the registry. Export endpoints mirror the screen's authorization and log row counts from rendered rows (the dental export principle).

OFFLINE STRATEGY (honest degraded mode, not 'offline PMS'). A PGlite replica in the browser holds a read-only, session-key-encrypted snapshot of today's schedule, patient demographics, alerts and chart summaries for the signed-in location, refreshed every few minutes and wiped on logout/idle-lock. During an outage staff can see the board and the chart and can capture clinical notes and perio entries into an encrypted queue that reconciles through the OCC autosave path with an explicit human review of conflicts on reconnect. Financial postings, approvals and claims are never available offline because controls cannot be enforced without the server; the UI says so. Status page and RTO/RPO are published.

HOW THE CODE MIGRATES. From dental: copy src/lib/auth/* wholesale (add sessions + practice scope to guards.ts, remove mfaFeature.ts default-off); copy src/lib/db/{backend.ts,postgresUrl.ts,int4.ts}, src/lib/http/*, src/lib/export/csv.ts, src/lib/email/threading.ts, src/lib/db/repo/auditLog.ts (add chain + ip/ua), src/lib/byteaudit/* (retarget contract to ledger/day-close/audit-chain promises), src/lib/db/repo/gamify.ts as the template for ledger_entries, the whole clinical core (schema, modules, vocab, audit, standardize, extract, verify, compose, readback, assist, dictation) as a package with a jurisdiction parameter and encounter FK, the autosave stack, design tokens, e2e probes and the version-stamp CI guards. Retire BuilderShell.tsx by decomposition, draftBackup.ts by encryption-or-disable, the EDR seam, Resend-as-export, the points economy. From precog: copy src/lib/precog/sod/{conflict-rules.ts,detect.ts}, controls/dual-release.ts, scoring/{weights.ts,residual-engine.ts,dynamic-variables.ts,variable-cascade.ts}, coso.ts, ml/leading-indicators.ts (renamed signals), rag/{corpus.ts,retrieve.ts}, practice-profile.ts types, llm/reasoning/beam-search.ts (fix the dropped status-quo node) into a server-only `controls` package; replace every demo-data import with repository parameters; move all evaluation server-side; delete src/routes, src/lib/auth (Grok federation, committed secret), src/lib/multiplayer, ml/{features,anomaly,forecast}, the military skin, Johari/meta-analysis UI, and localStorage persistence. The meta-analysis known-unknowns list is kept as the integration backlog document, not code.

## Data model outline

TENANCY AND IDENTITY. practices (id, legal_name, timezone, retention_policy, billing_plan) → locations (practice_id, name, address, npi, sedation_permit, facility_permit_expiry) → users (practice_id, username, display_name, pass_hash, mfa_secret_enc, admin_rank, clinical_role, active, password_changed_at, sessions_revoked_at, notice_ack_at) → sessions (user_id, device_label, idle_deadline, revoked_at) → role_grants (user_id, entitlement, location_id|null, granted_by, granted_at, revoked_at; append-only event log — the SoD detector reads the current set, COSO P9 reads the events) → credentials (user_id, licence/cert type, expiry). Entitlement enum = Precog's 14 (collect_cash, post_payments, prepare_deposit, bank_reconcile, approve_writeoffs, post_adjustments, submit_claims, create_vendor, approve_vendor, release_payment, enter_payroll, approve_payroll, pms_admin_roles, view_reports_only) + PMS additions (edit_schedule, delete_appointment, edit_fee_schedule, export_data, break_glass).

PATIENTS AND COVERAGE. patients (practice_id, demographics, restricted_flag) ↔ guarantors via patient_guarantor; accounts (one per guarantor family); insurance_carriers; insurance_plans (carrier, group, fee_schedule_id); coverages (patient, plan, rank primary|secondary, subscriber, effective_from/to); fee_schedules → fee_schedule_lines (plan, provider|null, cdt_code, allowed_cents) — edited only under maker-checker; eligibility_checks (append-only raw + parsed response). critical_flags (patient, kind, text, set_by) is its own table so it cannot be collapsed.

SCHEDULE AND ENCOUNTERS. appointment_types (behavior contract: confirm/recall/emergency/new_patient/supervision_required); appointments (location, operatory, provider, patient, type, status, supervision_level, supervising_dentist_id); appointment_events (append-only moves/deletes with reason code); encounters (patient, location, appointment, date_of_service, rendering_provider, supervising_provider, status); procedures (encounter, cdt_code, teeth[], surfaces[], status ∈ PROCEDURE_STATES, fee_cents, provider); clinical_notes (encounter FK NOT NULL, note_state jsonb, composed_text, audit_report, ruleset_version, filed_at, filed_by_id, filed_by_name; immutable after filing) → note_addenda (amends_note_id, reason_code, text, author, actual_timestamp); chart_events (patient, tooth, surfaces, kind condition|procedure, status existing|planned|completed, historical bool set by human, encounter, provider); perio_exams → perio_sites (tooth, site 1-6, depth_mm, recession_mm, bop, suppuration, mobility, furcation); treatment_plans → plan_visits → plan_procedures; consents (encounter, procedure set, decision enum, consenting_party, relationship, questions, scope clinical|marketing).

THE LEDGER (append-only role). ledger_entries (id ULID, practice_id, account_id, patient_id, kind ∈ charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer|reversal, amount_cents bigint signed by convention, currency, reason_code_id, effective_date, posted_at, posted_by_id, posted_by_name frozen, encounter_id, procedure_id, claim_id, era_line_id, reverses_entry_id, approval_id, idempotency_key UNIQUE, tender ∈ cash|check|card|ach|eft|null, check_no, prev_hash, row_hash). allocations (payment_entry_id, charge_entry_id, cents; constraint: sum per payment ≤ payment, sum per charge ≤ charge). reason_codes (practice_id, kind, code, label, requires_approval_over_cents, active; maker-checker versioned). estimates (patient, plan_procedure|claim, insurance_est_cents, writeoff_est_cents, as_of) — never joined into balance. Balance = sum(amount) over the account; 'explain balance' walks allocations. day_closes (location, date, totals by tender and kind, ar_opening, ar_closing, closed_by, hash) frozen in one transaction with byteaudit-style verification that closing AR = opening + charges − payments − adjustments ± reversals.

CONTROLS (append-only role). dual_release_policies (practice, version, channels jsonb, active_from) and threshold_exceptions (policy, action raise|lower|force|waive, scope fields, amount band, effective_from/to, approved_by, reason, residual_note); approvals (request_kind/channel, target ledger draft, amount_cents, requester_id/name, first_approver_id/name, second_approver_id/name, status ∈ ReleaseStatus, applied_exception_id, reasons jsonb, requested_at, decided_at); control_snapshots (practice, scoring_version, computed_at, trigger, portfolio jsonb, sod jsonb, coso jsonb, signals jsonb); control_decisions (practice, subject_kind, subject_id, kind remediate|accept_residual|monitor|insure, note, review_by, residual_at_decision, decided_by_id/name, evidence_refs); anomaly_events (kind after_hours_refund|retroactive_edit|deposit_gap|denial_writeoff|threshold_waived|new_device, severity, refs, acknowledged_by).

BANK AND CLAIMS. bank_accounts; bank_transactions (append-only import, external_id UNIQUE, amount, posted_date, description); deposits (location, date, cash/check/card breakdown, prepared_by, entry_ids[]); reconciliations (location, date, expected_by_tender, actual_by_tender, variance_cents, status, cleared_by, cleared_at, note). claims (encounter, coverage rank, status, clearinghouse_id) → claim_lines → claim_events (append-only); eras (raw 835, received_at) → era_lines (claim_line, paid_cents, adjustment_cents, carc/rarc) → each posted as ledger_entries with era_line_id.

AUDIT AND ACCESS (append-only role, hash-chained). audit_log (practice, at, actor_id, actor_name frozen, action ≤64, target_kind, target_id, detail ≤1000 marked-truncated, ip, user_agent, session_id, prev_hash, row_hash) and access_log (practice, at, actor_id/name, record_kind, record_id, purpose ∈ treatment|payment|operations|break_glass|export|ai|print|fax|portal, justification for break_glass, prev_hash, row_hash). chain_heads (table, date, head_hash, object_lock_key) written daily to WORM storage. Immutability pattern throughout: INSERT-only role, hash chain, nightly independent verifier (byteaudit shape: restates the invariants, imports nothing from the app, sealed by manifest hash), reversal rows instead of edits, frozen names with no FK, RULESET_VERSION / SCORING_VERSION / policy version stamped on every frozen artifact so nothing is ever silently regraded.

COMPLIANCE. business_associates → baas (doc ref, signed_at, expires_at, controls named); integration_registry (kind, vendor, enabled requires live BAA); policies (versioned, generated_from answers, approved_by); training_completions; compliance_logs (sterilizer biological test, equipment daily check; 2-year retention); incidents (kind, discovered_at, tn_deadline, hipaa_deadline, status); records_requests (received_at, due_at = +10 working days, fulfilled_at, export_bundle_id); retention: every patient row carries last_contact_at and dob; a purge job respects retention_policy and legal_hold and writes destruction_log rows.

## Ux blueprint

INFORMATION ARCHITECTURE. One persistent patient rail (Curve Sidekick pattern) on the left of every patient-scoped screen: identity, un-collapsible critical flags, coverage status, balance with 'Explain', next/last appointment, open items — with a privacy toggle that masks names on operatory glass. Top-level areas: Board (schedule), Patients, Claims, Money (ledger, deposits, reconciliation), Chart (odontogram/perio/notes), Practice (roles, controls, compliance, decisions), Trust (status, pricing, exports). Every finding, alert or score has a one-click deep link to the rows behind it; no number appears without a path to its evidence.

HOME SCREEN PER PERSONA (role-derived, not configured). Owner: 'Yesterday reconciled?' — three tender rows expected vs bank, one variance figure, one clear/investigate action; below it, approvals waiting on me, hard-event alerts since last visit, expiring exceptions, and the control heat map as five tiles with the single cheapest lever named. Office manager / biller: claims worklist by age and next action, unposted ERAs, unallocated payments, approvals I can second, today's day-close checklist. Front desk: the board with per-chair documentation status, check-in queue with eligibility result already fetched, checkout queue. Hygienist: today's column, perio due/prior-visit deltas, notes awaiting my text, handoff strip for dentist-owned items. Dentist: killer-only finish queue (notes needing my filing authority, interpretations awaiting me, approvals only I can give), then my column. Compliance lead: open decisions past review date, BAAs expiring, training due, monthly log-review task.

FEWEST-CLICKS FLOWS FOR THE TOP FIVE DAILY TASKS. (1) Check-in: click appointment → check-in sheet opens with eligibility already run in the background at booking and re-run overnight; one 'Confirm identity (two identifiers)' tap; done — 2 clicks. (2) Checkout and post payment: from the appointment, 'Checkout' shows completed procedures, patient portion from the estimate, one payment form with tender and amount; 'Post' writes charges + payment + allocation atomically — 3 clicks, no separate allocation step because allocation defaults to oldest-open-charge and is shown, not hidden. (3) Post an ERA: open the ERA from the biller home → lines pre-matched to claim lines with variance highlighted → 'Post all matched' (write-offs under threshold post with reason code CARC-derived; over threshold create an approval request inline) — 2 clicks for the clean case. (4) Refund or write-off with approval: from the ledger, 'Adjust' → pick reason code → amount → the dual-release card appears inline stating the threshold, why it applies, and the eligible second approvers → 'Request approval' → approver gets one tap with the ledger context and MFA step-up → posts; requester never leaves the patient — 4 clicks plus one tap by another human, and the compliant path has no faster alternative because there is no override. (5) End of day close and reconcile: 'Close day' shows totals by tender and provider, prepares the deposit slip, freezes the day sheet in one transaction; next morning the owner's home shows the bank match automatically — 2 clicks at close, 1 to clear the reconciliation.

HOW CONTROLS LIVE IN THE WORKFLOW, NOT A DASHBOARD. A role grant that creates an SoD conflict shows the conflict, the fraud path in one sentence and the compensating control before the grant is saved; the admin may proceed but must pick remediate/compensate/accept, which writes a control_decision. A write-off form shows 'this is your 3rd unapproved write-off this month' as an inline note with no name broadcast. An after-hours refund pages the owner. The reconciliation screen is the owner's front door. The COSO heat map exists but is the last screen an owner needs, not the first.

HOW 'VERY INTUITIVE' IS ACHIEVED. Home is the work, never a card grid. Task-oriented navigation with no hidden modal chains; every blocking message is one verb line (≤8 words) plus one control, with the explanation in progressive disclosure; validation is silent until blur and live only after a field's first error; 44px targets with 8px gaps on every pointer type; severity is a luminance ladder plus a shape plus a word so it survives grayscale and deuteranopia; two visual identities for irreversible record-committing actions (file, post, close) versus reversible transport actions (print, preview, copy); recognition over recall via ranked, role-filtered starters (verified blocks, appointment types, reason codes) that are always visible, never behind a chip; named omission licences ('not applicable', 'not assessed') so no field ever forces a fabrication; and a role-based first-run that gets a temp to a real task in under 90 minutes with no after-hours training. Ledger readability is tested directly: the D.8 usability probe (task success and error rate reading a dual-coverage, partial-payment ledger) is the acceptance test for the Money area and runs with billers, not dentists.

## Internal controls integration

EVENT SPINE. Every state change in the PMS that a control cares about is written to a Postgres outbox table (control_events: practice_id, kind, refs, occurred_at) inside the originating transaction; pg-boss workers consume it. Kinds: role_grant.added/revoked, user.deactivated, ledger.posted, approval.requested/decided/waived, exception.created/expired, deposit.prepared, bank.transaction.imported, reconciliation.cleared/variance, claim.denied, writeoff.posted, appointment.deleted, device.new_login, chain.verify.result. The Precog engines consume these instead of demo-data.

WHERE CONTROLS ARE ENFORCED (refuse), NOT RECORDED. (1) Dual release: postLedgerEntry() opens the transaction, SETs the tenant, loads the current dual_release_policy and exceptions, calls evaluateRelease({channel, amountCents, requesterId, payee, secondApproverId}) and, on any blocked_* or needs_second status, rolls back and returns the verdict with eligibleSeconds — nothing posts. The approval row is created in that same call so the requester's intent is recorded even though the post is refused. (2) Same-person rule: requester ≠ approver is enforced by the evaluator and by a CHECK constraint on approvals. (3) SoD hard blocks: a small set of conflicts (the 'critical' rule ids: self-reconciliation of own postings, self-approved vendor master, self-approved payroll) are enforced by withGuard refusing an action when the actor's current grants plus the requested action would complete the pair — e.g. a user who posted payments today cannot clear today's reconciliation. Other conflicts are detected, scored and require a decision but are not blocked, because full SoD is arithmetically impossible in a six-person office. (4) Denial-suppression: a write-off whose claim_event history shows a denial with no appeal event routes through dual release regardless of amount. (5) Immutability: ledger, approvals, decisions and logs are written by the INSERT-only role; the app literally lacks the grant to alter them. (6) Break-glass reads of restricted patients require a justification written to access_log before the row is returned. (7) BAA gate: an integration or outbound channel with no live BAA is disabled at the registry, so PHI cannot move through it.

WHERE CONTROLS ARE SCORED (Precog, continuously). detectSodConflicts(assignments) runs on every role_grant event over the real grant set, with mitigatedSodRuleIds(policy) injected so enabling a dual-release channel visibly lowers conflict scores and reclassifies them as mitigated; segregationHealth replaces the hand-entered segregationScore. Residual scoring runs nightly and on control events with StaffComposition derived from the roster (team size), the knowledge/credential map (sole-owner count), HR dates (tenure) and detect.ts (segregation), and with control effectiveness measured rather than asserted: dual-authorization effectiveness = share of over-threshold posts that actually had a second approver; independent reconciliation = days since last cleared reconciliation and variance rate; monitoring cadence = whether the owner acknowledged the last digest. assessCoso(practiceState) becomes truthful: P8 fraud risk reads real dual-release coverage and bank-rec status, P9 assess-change reads role_grant events (a terminated user still holding grants is a finding), P11 technology controls reads MFA coverage and shared-device posture, P17 reads open control_decisions past review_by. Snapshots are frozen with SCORING_VERSION so a weight change never regrades history.

OWNER ALERTS. Hard events (after-hours refund, retroactive-dated entry, waived dual control, deposit variance above threshold, chain verification failure, new device login for a financial role) alert the owner individually and immediately. Everything else flows into the weekly digest under the dental digest rules: practice-scoped, minimum sample sizes, SYSTEMIC_SHARE re-scoping, one three-action coach card, acknowledgment stamped. The tip/observation channel (from wishes.ts, with PHI gate and anonymous option) is first-class because ~40% of fraud surfaces through tips.

THE DECISION JOURNAL AS THE DEFENSIBLE ARTIFACT. Every conflict, weak principle or anomaly can be closed only by a control_decision (remediate with a linked grant change or policy change; compensate with a named compensating control and cadence; accept_residual with owner attestation, residual_at_decision and a review date; insure with policy refs). Decisions are append-only, owner-attributed, and rendered as the practice's control register — the document a carrier, CPA or Board investigator receives.

FORENSIC LAYER (v2). With real transactions the missing stats/ suite becomes buildable: Benford first/second-digit conformity on adjustments, round-number bias, duplicate-payment detection, deposit-gap heuristics, adjustment-velocity per user against the practice's own baseline — always framed as control signals, never accusations, and surfaced first to the owner privately.

## Roadmap


### Item 1
- **phase**: Phase 0 — Trust Foundation
**scope**

New monorepo seeded from the dental repo. Tenancy (practice_id + RLS), sessions table, mandatory MFA with recovery codes, three-axis roles and role_grants event log, withGuard default-deny wrapper with route-glob CI test, hash-chained audit_log and access_log on an INSERT-only role with nightly verifier (byteaudit retargeted), envelope encryption for secrets, drizzle-kit migrations, pg-boss workers, boot guards extended (TLS, key, backup target, append role), production runbook with restore drill. Port the dental auth/e2e probes into the blocking CI job. Delete precog's broken shell, Grok auth, committed secret, multiplayer, ml/.

- **exit criteria**: Two practices in one database cannot see each other's rows even with a deliberately missing WHERE (RLS test); every API route fails CI unless wrapped; deactivating a user kills their session on the next request; audit chain verifies nightly and a tampered row is detected in test; restore drill passes from last night's backup; all 17 e2e security probes green in the blocking job; no PHI yet held.
- **dependencies**: None. Owner decisions needed: single provider for managed Postgres + object storage with BAA; IdP decision (stay with Credentials+TOTP).
- **duration estimate**: 8–10 weeks

### Item 2
- **phase**: Phase 1 — Money Spine and Enforced Controls (pilot as a financial layer beside the incumbent PMS)
**scope**

Patients/accounts/coverages (minimal), the Readable Ledger with property tests for dual coverage, partial payments, secondary posting and reversals, reason codes under maker-checker, dual-release engine moved server-side and enforced in postLedgerEntry(), approvals inbox with MFA step-up, day close frozen atomically, deposits and bank reconciliation via aggregator or statement import, anomaly events and hard-event owner alerts, SoD detection over real role_grants with the setup-wizard conflict preview, control snapshots and decision journal, weekly digest. Import of day sheets/AR from Open Dental and Dentrix reports so one pilot practice can run the ledger and controls in parallel with its existing PMS. Trust page with published pricing and exit terms.

**exit criteria**

Pilot practice opening AR ties to the incumbent to the cent for 30 consecutive days; every over-threshold refund/write-off in the pilot has a second named approver or a logged owner waiver — zero exceptions found by the independent verifier; owner clears reconciliation daily with median variance investigation under 10 minutes; D.8 ledger-reading usability probe with billers shows higher task success than the incumbent ledger; at least one real SoD conflict detected from grants and closed by a decision; pilot office manager would choose this ledger (recorded interview).

- **dependencies**: Phase 0. Bank aggregator agreement (with DPA/BAA review); card processor with hosted vault; owner-reviewed default thresholds and reason-code catalog; the D.8 Phase 1 interviews (24–30) run in parallel to validate the ledger hypothesis.
- **duration estimate**: 12–14 weeks

### Item 3
- **phase**: Phase 2 — Schedule, Insurance and Claims (becomes a PMS)
**scope**

Board with operatories and appointment-type behavior contracts, supervision validation at booking, check-in/checkout flows, eligibility via clearinghouse adapter, fee schedules, encounters and procedures (CDT), claim assembly with scrubber, secondary auto-generation, batch submission, claim tracker, ERA auto-posting into the ledger through dual release, denial-suppression detection, statements, conversion tooling for Dentrix/Eaglesoft/Open Dental with tie-out report and EDI re-enrollment runbook, public API v1 read-only.

**exit criteria**

Pilot practice runs scheduling and claims entirely in the new product for 60 days; first-pass claim acceptance and days-to-payment at or better than its prior 90-day baseline; ERA posting requires no manual allocation for ≥90% of clean lines; checkout completes in ≤3 clicks in usability testing; conversion from the incumbent completes with AR tie-out and zero orphaned claims; clearinghouse adapter passes the vendor certification suite.

- **dependencies**: Phase 1. Clearinghouse contract and BAA; payer coverage for eligibility; CDT licence; ONC-certification decision made (yes/no) before API v1 is published.
- **duration estimate**: 14–16 weeks

### Item 4
- **phase**: Phase 3 — Clinical Record
**scope**

Smile Notes clinical core ported with encounter FK, jurisdiction parameter and PHI rules re-scoped to boundary-only; BuilderShell decomposed; immutable notes with addendum chain and filing authority by licence; editable odontogram on chart_events; six-point perio with prior-visit delta and voice entry behind an on-device or BAA-covered engine; treatment plans with phasing and estimates; consents; imaging/document storage with DICOM export; records-request workflow and retention clocks; encrypted-or-disabled local draft mirror; shared-device profile with hard author switch.

**exit criteria**

Notes filed under a stamped RULESET_VERSION with zero blocking false positives on the precision corpus; hygienists complete full-mouth perio inside the appointment in ≥80% of pilot visits (versus the 11% industry baseline); every radiograph has an interpretation before the encounter closes; an addendum never alters the original; records request fulfilled as a full-record export within ten working days in a drill; shared-tablet author-switch test shows zero cross-author draft residue.

- **dependencies**: Phase 2 (encounters exist). STT engine decision (on-device Whisper WASM with frozen dental WER eval, or BAA vendor). TN counsel review of the rule set and consent fields; per-state content plan if selling outside TN.
- **duration estimate**: 14–16 weeks

### Item 5
- **phase**: Phase 4 — Compliance Program, Communications, Caged AI
**scope**

HIPAA SRA questionnaire → tailored policies → remediation tracking → training with server-verified drills; BAA registry gating integrations and channels; OSHA logs; incident workflow with TN/HIPAA clocks; patient comms (two-way text, confirmations, recall fill, intake) and portal with the plain-language delivery gate; AI assist behind the field-level PHI boundary with a BAA-covered provider, verifyMeaning on every output, one-way feedback, drift logging; forensic layer (Benford, duplicates, adjustment velocity) as owner-private signals; SOC 2 Type 2 audit fieldwork.

- **exit criteria**: A compliance state that recalculates as risks open and close; no integration can be enabled without a live BAA (test); portal cannot deliver a summary with open plain-language findings (test); AI refusal rate has a denominator and model identity is logged on every call; SOC 2 Type 2 report issued; a second and third practice onboarded using only the published conversion price and timeline.
- **dependencies**: Phase 3. Messaging vendor and model provider BAAs; HIPAA/OSHA content review by counsel; SOC 2 auditor engaged at Phase 2.
- **duration estimate**: 12–14 weeks

### Item 6
- **phase**: Phase 5 — Groups and Scale
**scope**

Organization tier above practice for 2–9 location groups: cross-location patient record with location-scoped financial access, regional roles, org-level reason-code and pack catalogs with inheritance, consolidated and per-site reconciliation, SSO/SCIM for joiner-mover-leaver, published SLA with credits and status history, API v1 write access with webhooks, offline degraded mode (encrypted PGlite replica of board and chart summaries).

- **exit criteria**: A three-location group runs on one tenant with location-scoped money and cross-location clinical cover; SCIM deprovisioning revokes all grants and sessions within one minute; twelve months of published uptime; degraded mode passes the outage tabletop (board and chart visible, notes captured, no financial post possible, reconciliation on reconnect with human review).
- **dependencies**: Phase 4 plus a signed group customer; enterprise IdP; operational staffing for the SLA.
- **duration estimate**: 16+ weeks, gated on demand

## Risks and tradeoffs

- The readable ledger is the central bet and the market's observed success rate is zero: Open Dental, CareStack, Curve and Oryx each shipped ledgers their own billers hate across three different models. Mitigation: property-test the allocation model before any UI, run the D.8 ledger-reading usability probe with billers as an acceptance gate, and pilot the ledger beside an incumbent so a failure is cheap and visible.
- Enforcing controls in the transaction path trades speed for trust. A refund that needs a second human is slower than one that does not, and a practice with one owner and one office manager has a very small approver pool. Mitigation: owner-can-second-any, mobile one-tap approval with MFA step-up, scoped/dated exceptions with mandatory residual notes, and the rule that the compliant path is never slower than an override (there is no override).
- Bank reconciliation depends on data from outside the product — an aggregator relationship, its DPA/BAA, and coverage of small community banks. If the feed is unavailable the control degrades to statement import and the 'green' state is honestly downgraded. This is also the one place the design asks the customer to trust a system to police itself; the mitigation is that the reconciliation logic is in the sealed independent verifier and the bank data path is read-only and logged.
- Clearinghouse and payer connectivity is the largest build risk and the #1 buying criterion. Building payer connectivity directly is off the table; the adapter approach concentrates risk in one vendor contract and its certification suite. Eligibility coverage by payer will be uneven at launch and must be published honestly.
- Migration is the acquisition cost: imaging conversion, in-flight secondary claims and preauths, non-converting insurance benefits, and up to 30 business days of EDI re-enrollment. The tie-out-or-refuse go-live rule protects the ledger promise but will lengthen conversions. Treat conversion tooling as product, price it publicly, and expect it to dominate early engineering time.
- Holding PHI is a step-change in liability from Smile Notes' de-identified posture: breach economics, FTC exposure on every security claim, SOC 2 cost, insurance, and a subprocessor inventory with BAAs (Postgres host, object storage, bank aggregator, clearinghouse, messaging, model provider). Everything the two repos got 'for free' from not holding PHI must be re-derived; the adversarial panels in the dental repo are the acceptance criteria and should be treated as such.
- Solo-owner capacity. Both repos are single-author, and the roadmap above is roughly 18 months of full-time work for a small team even with the reuse. Scope must be held ruthlessly — the financial-layer pilot in Phase 1 exists so the product can earn revenue and validate its thesis before the full PMS is built.
- No-scoreboard doctrine versus owner demand. Owners suspecting theft will ask for per-person adjustment reports. The design gives the owner private, evidence-linked anomaly signals and a decision journal but refuses rankings and grades; some buyers will read that as a missing feature. Hold the line — two panels name scoring as a walkout trigger and the anti-accusation posture is also the liability posture.
- Hiring-pool familiarity is a must-have a new entrant cannot satisfy. The only mitigation is being learnable in a shift with free role-based training and temp-first defaults; this is a UX budget line, not a nice-to-have.
- Well-capitalized incumbents are moving on exactly these gaps (Curve's $200M R&D commitment, HS1's voice perio and eligibility, Denticon's ERA auto-posting). The controls-and-reconciliation wedge is the part they are least likely to copy because it requires admitting their ledgers are the problem; the perio/voice gap may close before Phase 3 ships.
- Published pricing and no-fee exit forgo lock-in revenue and the month-to-month model raises churn risk. This is deliberate: lock-in is priced as a defect by today's buyers, and the trust page is the cheapest differentiator in the analysis.
- Precog's scoring constants (multipliers, priors, discount percentages) are illustrative and self-labelled so; shipping them as defensible numbers would be a liability for an attorney-owned product. The design keeps 'educational, not actuarial' framing, moves every constant into the versioned weight table, and replaces asserted effectiveness with measured effectiveness where the PMS has the data.
- Offline mode is bounded and honest rather than a marketing feature: read-only board/chart plus queued clinical capture, never financial postings. Some buyers burned by cloud outages will want more; promising an offline ledger would mean unenforced controls, which is the one thing the product must never do.
- RLS plus per-request fresh-row authorization plus hash chaining adds latency on every request. Acceptable at single-practice scale; needs a short-TTL session cache with explicit invalidation on revocation events and read replicas before DSO scale.

## What to drop

- Points economy, clinic store, badges, GPA and rank titles (dental src/lib/{gamify,gpa,stats/badges}, /store, /training bounty) — an app-tracked currency redeemable for gift cards approved by one lead is itself a segregation-of-duties finding; extract only the append-only ledger pattern and the time-to-file/after-hours ops metrics.
- Sparkle mascot and character set on clinical/financial surfaces (keep the deterministic seeded-copy mechanism and its tested ethics contract; retire the tooth).
- Data Hygiene Gauntlet as a customer-facing screen (GauntletForm.tsx, /requests) — keep the five cycles as internal engineering process and onboarding prose.
- The EDR paste-target seam (src/lib/edr/product.ts), 'Copy for Curve' clipboard handoff, plaintext .md download fallback, and the 'identifiers live in the EDR' messaging in ~100 strings — the merged product is the record.
- Email-as-export through Resend to CORPORATE_EMAIL; filed records are in-app with signed download links, and the enumerated-egress-destination principle survives as the channel allowlist.
- Unencrypted IndexedDB/localStorage draft mirror (draftBackup.ts) and the dismissible client-only idle lock — replaced by a session-key-encrypted mirror wiped on logout and a server-enforced idle timeout.
- ADMIN_PASSWORD_RESET environment break-glass and default-off MFA (mfaFeature.ts) — replaced by mandatory MFA with recovery codes and a two-admin recovery ceremony.
- Hand-rolled SCHEMA_STATEMENTS DDL array and the stale drizzle/0000_init.sql — replaced by real migrations; keep the version-bump CI guard concept.
- Precog's entire application shell and UI: the broken TanStack Start routes, the Predator/Terminator/WHITE HOT threat skin, /threat, Johari and meta-analysis panels, advanced-reasoning panel, layers panel, React Flow process map (v1), localStorage PracticeProfile persistence.
- Precog's ml/ directory (features, anomaly, forecast) — hand-written priors labelled as ML; keep leading-indicators.ts renamed to signals and rebuild anomaly detection on real transactions in Phase 4.
- Precog's Grok-federated Better Auth stack, the committed PREVIEW_CLIENT_SECRET (do not inherit the git history), AGENTS.md sandbox template, WebRTC multiplayer, and the direct api.x.ai coupling — replace with a BAA-covered provider interface.
- Persona-agent IQ and generation fields (persona-agents.ts) — keep as internal test fixtures only with the IQ field removed.
- Law-watch HTML scraper as a product feature (no diffing, TN-only, untested) — replace with a maintained per-state rules content process; keep in-app authority links.
- Static provisional Risk Management page with localStorage checklists (RiskManagement.tsx) — replaced by the server-attested compliance program.
- Whole-app 'we hold no PHI' PHI gate semantics and the attested S0 override dialog for identifiers in the record — PHI rules become an outbound boundary classifier; identifiers are legitimate content.
- Per-use AI metering (FREE_RUNS, BYTESTAR_READS=3 on every typing pause) — AI is included or off, never metered to the practice.
- Serial, globally sequential user-visible ids (DN-0001 tickets) — per-tenant sequences or ULIDs.
- Hard-coded America/New_York and Tennessee-only rule bodies — timezone on location, jurisdiction as a rule-set parameter.
