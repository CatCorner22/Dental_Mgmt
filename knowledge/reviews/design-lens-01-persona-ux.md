# Design lens 1: persona-ux

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 9 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, persona-ux

## Summary

A cloud dental PMS for the people who actually live in it — the office manager/biller, the hygienist, the front-desk coordinator, the dentist, and the owner-as-fraud-risk-manager — that replaces the incumbent chart+ledger+claims stack (Dentrix/Eaglesoft/Curve/…

## Lens

persona-ux

## Product vision

A cloud dental PMS for the people who actually live in it — the office manager/biller, the hygienist, the front-desk coordinator, the dentist, and the owner-as-fraud-risk-manager — that replaces the incumbent chart+ledger+claims stack (Dentrix/Eaglesoft/Curve/Open Dental) plus the two things practices bolt on beside it: a note-quality tool (Smile Notes) and a compliance/controls advisor (Precog, Abyde-class). It wins on three things no incumbent is praised for in the owner's own research: a ledger a biller can read after dual insurance and partial payments (derived balances over an append-only posting log with explicit allocations — no invented 'transfer adjustment' lines); a daily close that ties production → collections → adjustments → deposits → the bank, with segregation-of-duties and two-person release enforced inside the transaction rather than recommended in a report; and a chairside surface that is as fast as Curve Favorites (one tap to Perio, paint-to-chart, Fast Lane scaffolds) while carrying Smile Notes' deterministic filing gate, PHI-aware AI cage, and TN scope-of-practice locks. Pricing and exit terms are published — the cheapest differentiator in the market — and the product is designed, demoed and marketed to the office manager and hygienist, which no vendor does.

## Guiding principles

- Home is the work, not a dashboard: each persona lands on their live worklist (board, chair queue, Money Desk, Daily Close) and the persistent Patient Rail is the primary navigation object — no card-grid front door. (Lifted from dental docs/design-tokens.md 'Home is the note' and the Curve Sidekick benchmark.)
- Attachment is structural, never a label: every clinical note, perio exam, image and procedure line carries a required encounter_id FK set by context of creation. This single decision eliminates Curve's documented wrong-visit/orphaned-note class of error.
- Balances are sums, never stored: every money event is an immutable posting; reversals append; allocations link payments to charges explicitly; estimated insurance is a separate column, never part of the balance. (Pattern lifted from dental src/lib/db/repo/gamify.ts, repointed at A/R.)
- Enforce in the transaction, record in the report: dual release, SoD conflicts, export scoping, MFA policy and idle timeout are server-side refusals inside the write path; COSO scores, leading indicators and residual heat are reporting. Never let a client-computed verdict authorize anything.
- Fewer words and bigger targets at every gate: blocking messages are one verb line plus one control; 44px targets with 8px gaps on ALL pointer types; validation silent until blur; policy prose lives in progressive disclosure. (Panels: 'they don't hate gates — they hate reading under time pressure.')
- Two role axes plus a third: administrative rank (dental roles.ts), clinical licence (clinicalRoles.ts, per-state), and financial authority (precog entitlements). Capability is a named predicate over actor × target, and precog's SoD rulebook is a live query over the third axis.
- Practice-level metrics, never people scoreboards: the digest's SYSTEMIC_SHARE re-scoping rule, no letter grades on chairside surfaces, person-scoped signals private to a coach. Two adversarial panels name scoreboards as a walkout trigger; the controls engine 'never labels individuals as threats.'
- The compliant path must be the fastest path: masking before waiver, named omission licences instead of blank fields, verified blocks ranked and offered but always human-inserted; when a stop has an override, the override is the slow lane.
- Refuse to degrade silently when real data is present: boot refusals without POSTGRES_URL, TLS pinned verify-full, no ephemeral DB in production, no PHI to a model without a per-request gate and BAA — extend to 'no backup target configured' and 'no encryption key' at startup.
- Deterministic first, model second, human always: every AI capability has a shipped deterministic twin; model output passes verifyMeaning and evidence-pinning; no confidence percentages; 'I could not read this' is a first-class output.
- Publish what incumbents hide: a complete rate card, year-two rate, export terms, uptime history and incident post-mortems on the public site from day one — 'a decision, not a build.'
- Learnable by a temp in one shift: role set at provisioning (never day-of), role-scoped first-run inside the work surface, free self-serve certification; the hiring-pool advantage incumbents hold must be neutralized by design.

## Modules


### Item 1
- **name**: Tenancy, identity and access (Foundation)
- **purpose**: Multi-tenant (practice → locations) identity with username/password + bcrypt + TOTP MFA (policy-enforced per role with recovery codes), server-side session table plus watermark revocation, idle timeout, three-axis roles (admin rank / clinical licence / financial entitlements), fresh-row per-request authorization, Postgres RLS as defence-in-depth.
**reuse from**

dental: src/lib/auth/guards.ts (requireRole → requireAccess(tenant, min, capability)), auth.ts, auth.config.ts, roles.ts (MANAGE_CEILING), clinicalRoles.ts, approval.ts, throttle.ts, hashGate.ts, clientIp.ts, sessionWatermark.ts, totp.ts, password.ts, resetToken.ts, issueResetLink.ts, mfaFeature.ts (retire default-off), freshUser.ts, loginAction.ts, loginFormState.ts, middleware.ts, next.config.mjs headers, e2e/headers.mjs, e2e/lockout.mjs, e2e/mfa.totp.mjs. precog: src/lib/precog/sod/conflict-rules.ts entitlement taxonomy and ROLE_TEMPLATES in sod/detect.ts become the seeded financial-entitlement grants. Patterns only from precog/src/lib/auth/isolation.server.ts (Fetch-Metadata same-site guard) and verify.server.ts (fail-closed).

- **priority**: v1-core
- **ux notes**: Role-before-work at provisioning; the coordinator's board shows an 'unset role' readiness strip before open. Shared operatory tablets get a device profile: shorter absolute session, hard author switch (badge/PIN) that wipes local state, no local draft backup. Login failure copy byte-identical across causes (keep the no-oracle e2e).

### Item 2
- **name**: Design system and application shell
- **purpose**: Daylight-chart tokens (cream/navy/blue/teal), severity luminance ladder + shape channel, 44px target floor, action.primary vs action.complete split, Patient Rail (persistent side panel), per-persona home routing, one-line Andon pattern, reduced-motion discipline.
**reuse from**

dental: design-tokens.json, docs/design-tokens.md, docs/brand.md, src/lib/theme/palette.ts, tokens.ts, contrast.test.ts, tokens.test.ts, src/app/globals.css (.chip/.tap/.btn-primary/.btn-complete), src/components/shell/AppHeader.tsx, BrandMark.tsx, src/lib/audit/types.ts presentation ramps (CHIP/RAIL/TEXT/CLASS/SHAPE). precog: nothing visual (dark-only, military skin dropped); reuse only the panel composition idea hero/stat-tile-row/card-grid re-expressed in dental tokens.

- **priority**: v1-core
- **ux notes**: Work surfaces stay calm and cream; marketing/login/empty states may use display type and the atomic molar mark. Patient Rail has a privacy mode that hides names for open operatories. Every metric shown has a path to its underlying records (deep-link rule inherited from precog coso.ts DeepLinkTarget).

### Item 3
- **name**: Patients, schedule and front-desk Board
- **purpose**: Patient master (demographics, guardians, alerts, coverage), appointment book by operatory/provider with appointment-type colors (shape + word + luminance), per-chair status strip (scheduled → arrived → seated → in-chart → note filed → checkout ready), recall/recare, confirmations, waitlist/ASAP fill, supervision-level validation at booking (TN general vs direct), online booking in v1-nice.
- **reuse from**: new. Supervision constraint data from dental src/lib/law/license-scope.ts and src/lib/audit/rules/supervision.ts (effective-dated PC1107 rule) becomes a scheduler validation. Office-as-encounter-property model from dental src/lib/db/repo/offices.ts comments (office is per-encounter, not per-person) — but promoted to a real authorization boundary per the DSO panel.
- **priority**: v1-core
**ux notes**

Board is the coordinator's home. Documentation status is visible per chair without PHI leakage across the desk (initials/chair only). Critical alerts (allergies, premed, anticoagulant, latex, behavioral, guardianship, financial hold) are one practice-wide channel that surfaces on patient selection and cannot be collapsed. Check-in = one tap on the appointment; eligibility already ran overnight and shows as a flag.


### Item 4
- **name**: Encounter, odontogram and treatment plan
**purpose**

Encounter is the spine record every clinical object attaches to. Editable odontogram with Planning/History layers, existing-conditions layer, per-surface history; paint-to-chart creates procedure_line (CDT code, site, surfaces, material, provider, visit group) and propagates to plan and note; multiple concurrent treatment plans with visit phasing and patient-portion estimates; PROCEDURE_STATES (recommended → planned → consented → completed etc.) never collapsed; plan-note conversion to encounter note gated on individualization.

**reuse from**

dental: src/lib/vocab/teeth.ts and surfaces.ts (ADA Universal table, allowedSurfaces, FDI display), src/lib/extract/chart.ts (chartMarks, CONTRADICTORY_PAIRS), src/components/builder/Odontogram.tsx (glyph geometry, paint policy — extended from readback to editable), fields/ToothPicker.tsx, fields/SurfacePicker.tsx (poka-yoke), src/lib/modules/shared.ts PROCEDURE_STATES/DATA_STATES, src/lib/audit/rules/anatomy.ts (wrong-site S0). CDT code set licensed separately (never reproduce in vocab).

- **priority**: v1-core
- **ux notes**: Charting is a painting gesture with role-filtered macro shortcuts (multi-tooth/multi-code). One gesture writes three records (plan line, odontogram mark, note fact scaffold). Dentist-owned Assessment/Plan is locked by licence at the API; auxiliaries see a single handoff strip, not open required work. Money lives on the plan card and ledger, never inside the clinical note text.

### Item 5
- **name**: Clinical notes (Smile Notes core, inverted)
- **purpose**: Schema-driven note builder (33 modules), deterministic S0–S4 audit, killer-item hard gate, named omission licences, attestation with reason codes, frozen filing stamped with RULESET_VERSION, amends_note_id addendum chain, paste intake, standardize proposals, plain-language patient summary, verified blocks and practice packs. PHI rules re-scoped from 'never present' to outbound-boundary control.
**reuse from**

dental: src/lib/schema/types.ts, src/lib/modules/** (all 33), src/lib/vocab/** (~4,100 LOC), src/lib/audit/engine.ts, types.ts, rules/** (completeness, justification, medication-safety, anatomy, shorthand-gate, supervision), omissions.ts, attestation.ts, precision/**, src/lib/standardize/**, src/lib/compose/composeNote.ts (sanitizeUserText), src/lib/extract/**, src/lib/readback/readbackClass.ts, src/components/builder/NoteForm.tsx, AuditPanel.tsx, PasteIntake.tsx, FastLane.tsx, src/lib/packs/** + src/lib/db/repo/practicePacks.ts (add CAS), src/lib/db/repo/submissions.ts fileSubmissionAtomic, src/lib/byteaudit/** (sealed independent verifier), src/lib/version.ts + CI version-stamp guards. BuilderShell.tsx decomposed into encounter-context panels, not ported whole. Retire: rules/phi.ts as an S0 filing block (keep phi.ts + phi-secondary.ts + maskPhi.ts for egress), draftBackup.ts on shared devices, clipboard/email as primary handoff, edr/product.ts.

- **priority**: v1-core
- **ux notes**: Note opens cursor-ready inside the encounter with Fast Lane visible while Core-only; killer strip finish (≤3 rows + one primary button) replaces the compliance essay; procedure mode keeps the caret put while a field is dirty; dentist filing queue on the dentist home. Emergency/after-hours preset triages fields chief problem → swelling screen → site → diagnosis → care → escalation.

### Item 6
- **name**: Periodontal charting
**purpose**

Six-point site-by-site perio exam (PD, recession, BOP, suppuration, mobility, furcation, plaque, MGJ) completable by one operator inside a hygiene appointment: keyboard auto-advance, foot-pedal/hotkey, voice entry through the DictationEngine seam with audible confirmation and undo-by-voice, prior-exam delta highlighting, summary measures auto-derived into the note's periodontal module and SRP justification evidence.

- **reuse from**: new for the chart. dental: src/lib/dictation/engine.ts (DictationEngine interface, on-device Whisper Phase 2 required before PHI audio), normalize.ts, availability.ts, enrollment.ts; src/lib/modules/periodontal.ts summary fields become derived outputs; src/lib/audit/rules/justification.ts SRP rule consumes the exam.
- **priority**: v1-core
- **ux notes**: One tap from chair card to Perio. Default entry path is voice-or-keys with no second person; targets glove-sized; the 60%-skip statistic is the metric to beat (perio completion rate per hygiene visit, practice-level only).

### Item 7
- **name**: Ledger, checkout and payments
**purpose**

Append-only ledger_posting (charge, patient_payment, insurance_payment, adjustment w/ reason code, writeoff, refund, reversal) with explicit allocation rows; balance = sum; 'Why does this patient owe $X' explanation view; estimated insurance and estimated write-off as separate columns; statements; checkout that closes in ≤4 clicks; tokenized card processing via hosted fields (PCI scope out); typed, reason-coded, approval-gated adjustments.

- **reuse from**: dental: src/lib/db/repo/gamify.ts (append-only ledger, partial unique index idempotency, advisory-lock spend, refund-by-append) as the pattern; src/lib/export/csv.ts; src/lib/http/*. precog: controls/dual-release.ts evaluateRelease sits inside the posting transaction for writeoff/refund/deposit channels. Money type: integer cents + currency column (new).
- **priority**: v1-core
- **ux notes**: Ledger view is a single chronological posting list with an allocation trace expander per payment, in plain language, readable at the front desk. No hidden/unallocated buckets. Blocked postings surface as 'Needs second approver — [name]' with one tap to request, never a dead end.

### Item 8
- **name**: Insurance, claims and ERA posting
**purpose**

Plans, fee schedules per plan per provider (one place, no clone workarounds), primary/secondary COB with automatic secondary generation, real-time eligibility at booking and check-in, claim pre-flight scrubber (narrative justification + code/finding binding + payer rules), batch eClaims via clearinghouse (DentalXChange/Vyne/Change), claims tracker (age/status/next action), automatic 835 line-item posting with exception queue, denial worklist.

- **reuse from**: new integration layer. dental: src/lib/audit/rules/justification.ts and completeness.ts as the pre-flight narrative gate; src/lib/extract/** to cross-check note facts against claim lines; src/lib/auth/throttle.ts key namespaces for metering; src/app/api/law-watch/alert/route.ts timingSafeEqualStr for webhook secrets.
- **priority**: v1-core
- **ux notes**: Money Desk (biller home) is three worklists: unposted ERAs (auto-matched lines already posted; only exceptions shown), claims aging, denials — each row has one next action. Pre-flight failures phrase WHAT/WHY/HOW and deep-link to the note field. Eligibility runs overnight so check-in is a glance, not a call.

### Item 9
- **name**: Daily Close and bank reconciliation
- **purpose**: Day sheet tying production → collections → adjustments → deposits; deposit slips; bank feed (aggregator or statement import) matched to deposits; variance queue the owner must clear; alerts for refunds above threshold, after-hours postings, retroactive edits, voids; independent-of-PMS ground truth per Zeldent thesis.
- **reuse from**: new. precog: scoring/dynamic-variables.ts detection-lag model retired in favour of measured lag; ml/leading-indicators.ts pattern repointed at real signals (adjustment rate, refund velocity, void count, days-to-deposit, unreconciled age). dental: src/lib/digest/digest.ts DIGEST_RULES (batch not alert; systemic re-scoping) governs how variances are reported.
- **priority**: v1-core
- **ux notes**: Owner home. One screen: yesterday tied or not, variance count, decisions due, control score. Every number deep-links to postings. Signals are batched into a weekly digest, not per-event pings; person-scoped anomalies are visible only to the owner/coach role.

### Item 10
- **name**: Internal controls engine (Precog core)
**purpose**

Live SoD conflict detection over real entitlement grants; dual-release policy with threshold exceptions enforced in posting paths; residual-risk portfolio with named drivers and tornado levers; COSO 17-principle assessment parameterized from live state; decision journal (remediate/accept_residual/monitor/insure) server-side and append-only; control-change events on every grant/termination (makes COSO P9/P11 continuously monitored).

**reuse from**

precog: src/lib/precog/sod/conflict-rules.ts (verbatim), sod/detect.ts (replace demo-data import with grants repo), controls/dual-release.ts (replace people import; make evaluateRelease server-only), scoring/weights.ts, scoring/residual-engine.ts (replace id-substring factors with typed control fields), coso.ts (parameterize assessCoso(state)), scoring/dynamic-variables.ts retainLoss/computeNetPremium, scoring/variable-cascade.ts, threat-scoring.ts (rename: priority queue, ROE → next steps), practice-profile.ts DecisionEntry → control_decision table, rag/corpus.ts (in-product guidance copy), llm/meta-analysis.ts content as the integrations backlog. dental: src/lib/risk/categories.ts (currently dead) joins as the clinical-documentation domain of one findings register; practicePacks maker-checker for control-policy changes.

- **priority**: v1-core
- **ux notes**: Setup IS the assessment: seeding roles from ROLE_TEMPLATES pre-flags conflicts and offers remediate / compensate / accept-on-purpose with a review date. Blocked grants explain the fraud path in one paragraph. Vocabulary is neutral (Priority queue, Next steps) — no WHITE HOT/Terminator. Never names a person as a threat.

### Item 11
- **name**: Audit, PHI access log and tamper-evidence
- **purpose**: Hash-chained, append-only audit_event with IP/UA columns and structured actor/target/tenant; PHI read logging on every record open, search result set and report run; disclosure accounting for print/export/email/fax/portal-send; plain-sentence rendering of the trail; monthly documented review that writes its own row; 6+ year retention with legal hold.
- **reuse from**: dental: src/lib/db/repo/auditLog.ts (bounded writes, marked truncation, frozen actor names), src/lib/auth/auth.ts logging discipline (never log unknown usernames), src/app/api/assist/route.ts one-parseable-row-per-call pattern, src/app/api/export/[table]/route.ts 'authorization mirrors the screen'. New: HMAC chaining, REVOKE UPDATE/DELETE role, WORM sink.
- **priority**: v1-core
- **ux notes**: Owner/compliance view reads as sentences ('Sarah replaced the extraction outcome in encounter 1043 at 4:12pm, reason: corrected tooth'). Filters default to 'signal' (everything except routine sign-ins).

### Item 12
- **name**: AI assist and dictation cage
**purpose**

Single doorway for any model call: PHI/minimum-necessary gate (field-level, not whole-app) → retrieval → injected provider under BAA → JSON schema → verifyMeaning / evidence-pinned extraction → human accept per fact; capability follows licence; deterministic twins always shipped; drift logging without content; silent killswitch and escape ladder; one-way feedback; dictation through DictationEngine with on-device engine required before PHI audio.

**reuse from**

dental: src/lib/assist/service.ts, tier.ts, prompts.ts, schemas.ts, extraction.ts, non-goals.ts (retire ambient-dictation entry deliberately, keep the file), drift.ts, src/lib/verify/** (verifyMeaning, grounding, vocabulary, redteam tests), src/lib/audit/rules/phi.ts + phi-secondary.ts + maskPhi.ts as egress classifier, src/lib/bytestar/config.ts (BYTESTAR_KILL), escape.ts, ladder.ts, one-way.ts, docs/model-charter.md, docs/bytestar-architect-audit.md, src/lib/learning/redact.ts (allow-list redactor for telemetry/support bundles). precog: coach/context-pack.ts shape with names stripped to roles; drop agent-loop.ts Grok fetch behind a provider interface.

- **priority**: v1-nice
- **ux notes**: Assist appears as ranked, evidence-quoted proposals inside the field, never autocomplete of clinical truth; READBACK_CLASS tokens (teeth, surfaces, drugs, doses, units, times) confirmed as a five-item list on accept. No per-use AI metering — included in the seat.

### Item 13
- **name**: HIPAA/OSHA compliance program
- **purpose**: Guided security risk analysis, tailored policies kept current, staff training with certificates (server-verified drills), BAA registry that gates integrations (connector disabled until countersigned BAA on file), sterilizer biological-monitoring log with 2-year retention, incident intake, records-request workflow with 10-working-day SLA and full-record export.
**reuse from**

precog: rag/corpus.ts chunks as guidance copy; decision journal for remediation tracking. dental: src/lib/training/** + src/app/api/training/complete/route.ts (server-verified drill pattern), src/lib/wishes/** as safety-observation intake (add PHI gate + tenant scoping), src/lib/law/tn-law.ts + license-scope.ts + /reference/tennessee-law rendering, skill/references/tennessee-dental-law-summary.md, docs/tn-dental-authority-map.md. Drop RiskManagement.tsx localStorage checklists.

- **priority**: v2
- **ux notes**: Compliance state recalculates as risks open/close (Abyde pattern); every enforced rule links to its authority in plain words; checklists are attributed, timestamped attestations, not local ticks.

### Item 14
- **name**: Patient communications and portal
- **purpose**: Two-way SMS, confirmations/reminders, recall outreach, digital intake writing into the chart, patient portal with plain-language summaries gated on the plain-language/stigma rules, guardian-addressed voice for minors, separate consent scopes (clinical vs marketing images).
- **reuse from**: dental: src/lib/vocab/plain-language.ts, audience:'patient' machinery in src/lib/audit/engine.ts, src/lib/email/threading.ts (opaque ticket tokens, header-injection-safe), single-configured-egress principle from sendSubmission.ts. Transport vendors new under BAA.
- **priority**: v2
- **ux notes**: Portal-delivery gate: open plain-language or stigma findings block send; empty patient summary cannot claim delivery.

### Item 15
- **name**: Imaging and documents
- **purpose**: Object storage for images, scans, consents, EOBs with signed URLs, virus scan, retention; DICOM import/export; sensor bridge via published certified list; images live in the encounter (not an external path); one-click full-history DICOM export at no charge.
- **reuse from**: new. dental: skill/references/sedation-and-imaging.md universal imaging record + per-structure status enum; src/lib/audit/rules/completeness.ts imaging-no-interpretation rule.
- **priority**: v2
- **ux notes**: Viewer opens from the odontogram tooth or the encounter; interpretation field is a completeness gate on any encounter with acquired images.

### Item 16
- **name**: Reporting without SQL
- **purpose**: Curated report library answering owner/OM questions (production, collections, AR aging real vs estimated, adjustments by reason and user, unscheduled treatment, recall), visual filter builder, saved/scheduled reports, numbers identical across every screen showing the same metric, export mirrors screen authorization.
- **reuse from**: dental: src/lib/digest/filingRollup.ts (versioned per-filing snapshot, practice totals only), digest/metrics.ts, digest/similarity.ts (copy-forward discriminator as a documentation-quality/fraud signal), src/lib/stats/computeStats.ts (time-to-file, after-hours rate), src/lib/export/csv.ts.
- **priority**: v1-nice
- **ux notes**: Every report line is explainable and deep-links to postings/encounters. No per-person rankings; practice-level by default, person-scoped only in the owner/coach view.

### Item 17
- **name**: Migration and interoperability
- **purpose**: Conversion tooling from Dentrix/Eaglesoft/Open Dental/Curve/Ascend/Denticon with a published fixed price and timeline, explicit 'what does not convert' list, EDI re-enrollment run for the practice, self-service full export (structured + documents + DICOM), documented versioned REST API + webhooks (v2), FHIR export (later, once codes and encounters make it conformant).
- **reuse from**: dental: src/components/builder/PasteIntake.tsx + src/lib/standardize/structure.ts + src/lib/extract/** for legacy free-text note ingestion with human-in-the-loop; src/lib/edr/product.ts inverted into a source-system label for conversions; src/lib/export/csv.ts. precog: llm/meta-analysis.ts gap list as the integration backlog.
- **priority**: v2
- **ux notes**: Conversion status is a first-class screen during go-live week: what arrived, what needs cleanup (in-flight secondaries, preauths), imaging progress.

### Item 18
- **name**: Multi-location and DSO
- **purpose**: Single database across locations with location as an authorization boundary (Minimum Necessary), cross-location booking, consolidated + per-site reporting, org/region content catalog for packs and control policies with inheritance, SSO/SCIM (SAML/OIDC) with IdP-owned MFA, joiner/mover/leaver lifecycle.
- **reuse from**: dental: src/lib/db/repo/offices.ts model promoted; src/lib/packs/** governance extended with org tier. precog: none.
- **priority**: later
- **ux notes**: Cross-location browse is a deliberate grant, not the default; no per-site fee.

### Item 19
- **name**: Specialty modules (ortho, pedo, OMS) and Canada parity
- **purpose**: Native specialty workflows or an explicit public 'not in scope' statement; CDAnet and provincial fee guides if Canada is pursued.
- **reuse from**: dental: src/lib/modules/orthodontic.ts, pediatric.ts, sedation-anesthesia.ts, robotic-surgery.ts as note content only.
- **priority**: later
- **ux notes**: Do not ship GP workarounds under a specialty label.

### Item 20
- **name**: Points economy, store, GPA, Sparkle mascot, Gauntlet UI, Johari/meta panels, WebRTC multiplayer, Grok auth, law-watch product
- **purpose**: Retired surfaces; see what_to_drop.
- **reuse from**: dental: src/lib/gamify/**, src/lib/stats/sparkle.ts (keep the deterministic-copy mechanism and ethics tests only), src/lib/requests/gauntlet.ts (keep as internal engineering process doc), src/lib/gpa/deriveGpa.ts, src/lib/law/watch.ts. precog: src/lib/multiplayer/**, src/lib/auth/**, johari-*.ts, meta-analysis-panel.tsx, threat-assessment.tsx, process-map.tsx vision modes.
- **priority**: drop

## Architecture

STACK. Next.js 15 App Router / React 19 / TypeScript — the dental repo's stack — chosen because the hardened auth, header, PHI, audit and note-builder code (201 test files) is already there, whereas precog's TanStack Start/Vite app is unbuildable at HEAD and its value is entirely in ~1,400 lines of pure TypeScript that port to any framework. Drizzle ORM stays, but migrations move from the hand-rolled SCHEMA_BOOT_VERSION DDL array to drizzle-kit generated SQL migrations with a per-migration history table, plus a CI check that fresh-vs-migrated schemas are identical; keep the CI version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION) and add SCORING_VERSION/CONTROL_RULEBOOK_VERSION for the controls engine. Postgres 16 on a BAA-signing managed provider (RDS or Neon Business with BAA) with pinPostgresSslMode retained; PGlite kept ONLY for tests and the offline client replica. UI: Tailwind + the Daylight-chart token pipeline (palette.ts → tokens.ts → CSS) with contrast CI; Radix primitives adopted for select/dialog/combobox to close the a11y gap both repos have; TanStack Query for worklists; server actions + route handlers for mutations. Validation: zod at every boundary.

HOSTING. Long-lived Node containers (e.g., ECS/Fargate or Fly Machines, ≥2 regions active/passive) behind a WAF, NOT Vercel serverless: claims batches, 835 posting, eligibility sweeps, reconciliation matching, recall runs and statement generation are background jobs (BullMQ on Redis or pg-boss on Postgres) with no home in a 60-second request budget. Object storage (S3 with Object Lock for the WORM audit sink and images) via signed URLs. Secrets in a vault with rotation; startup refuses to boot without POSTGRES_URL, backup target, KMS key and AUTH_SECRET (extend dental src/lib/db/backend.ts). Public status page with incident history; PITR with a quarterly restore drill as a documented control.

MULTI-TENANCY. Shared database, `tenant_id` NOT NULL on every table, composite indexes led by tenant_id, and Postgres row-level security enabled on every PHI table with `SET LOCAL app.tenant_id` in a transaction wrapper — RLS is the backstop against a missing WHERE clause, the guard is the primary control. Location is a second scoping column used as an authorization boundary (Minimum Necessary) but with cross-location grants. Per-tenant KMS envelope keys for field-level encryption of SSN, MFA secrets, portal tokens and bank identifiers. Advisory-lock keys are tenant-salted (precog's FNV-1a pattern from dental gamify.ts). Serial ids stay internal; user-visible identifiers (ticket, claim, statement) are per-tenant sequences or opaque.

SESSIONS AND AUTHZ. NextAuth v5 Credentials + bcrypt (cost 12) + TOTP with recovery codes, MFA policy-enforced for every role that touches PHI (retire MFA_ENABLED default-off). Add a server-side `session` table (server-enforced idle timeout, user-visible active-session list with per-device revoke, admin terminate-now) and keep the watermark as belt-and-braces. `requireAccess(tenantId, minRank, capability?)` does one PK read per request (short-TTL cache invalidated on revocation events); default-deny for /api/* is made structural via a wrapper every handler is passed through plus a CI test that globs route files and asserts the wrapper. Three role axes: admin rank (roles.ts ladder + MANAGE_CEILING), clinical licence (clinicalRoles.ts, per-state configuration), financial entitlements (precog conflict-rules.ts taxonomy stored as `entitlement_grant` rows). Break-glass replaces ADMIN_PASSWORD_RESET with a mandatory second owner at setup plus a time-boxed, dual-control, audited recovery code.

OFFLINE STRATEGY (honest, bounded). Not full offline. A 'degraded mode' service worker keeps an encrypted (session-derived key, wiped on sign-out) PGlite/IndexedDB replica of today's schedule, patient headers, critical alerts, and chart summaries for the tenant's locations, read-only during an outage, with clinical-note capture queued through the existing five-layer autosave stack (autosaveMachine.ts, useAutosave.ts, OCC + revision ring) and explicit reconciliation on reconnect. Money postings and claims are never queued offline. Shared-device profiles disable the local replica entirely. Publish this behavior plainly — no vendor documents any offline mode today.

API. Internal: typed server actions and route handlers behind the guard wrapper; every state-changing JSON route checks Origin/Sec-Fetch-Site and Content-Type (adopt precog isolation.server.ts idea). External (v2): versioned REST + webhooks with per-tenant API keys scoped by capability, sandbox tenants, rate limits; FHIR/C-CDA export later once encounters and codes exist. Integrations: clearinghouse (X12 837D/835/270-271 via DentalXChange/Vyne/Change), payment processor via hosted fields (PCI SAQ-A), bank feed aggregator, SMS/email under BAA, sensor bridge. Every connector is disabled until a countersigned BAA is on file (BAA-gated integration registry).

HOW DENTAL CODE MIGRATES. Lift verbatim into `src/lib/`: auth/* (extend guards with tenant + capability), audit/* (engine, rules, omissions, attestation, precision harness; phi.ts demoted from filing S0 to egress classifier), vocab/*, modules/*, schema/types.ts, compose/*, extract/*, verify/*, assist/*, standardize/*, dictation/*, readback/*, byteaudit/*, packs/*, digest/* (rules constants and similarity), db/repo/auditLog.ts (add chain + IP/UA), db/repo/gamify.ts ledger pattern (repointed at A/R, integer cents), db/repo/practicePacks.ts (add CAS transitions), http/*, export/csv.ts, email/threading.ts, theme/*, design-tokens.json, e2e probes into blocking CI. NoteState gains encounter_id/patient_id/provider_id and becomes a clinical_note row with amends_note_id; BuilderShell.tsx (2,127 LOC) is decomposed into NoteEditor / Gates / Handoff / Context panels mounted inside the Encounter page. Retire: edr/product.ts paste seam, draftBackup.ts on shared devices, clipboard/email as primary egress, gamify/store, GPA display, law/watch.ts as a product, requests/gauntlet UI.

HOW PRECOG CODE MIGRATES. Copy `src/lib/precog/{sod,controls,scoring,coso.ts,threat-scoring.ts,rag/corpus.ts,practice-profile.ts types}` into `src/lib/controls/` and perform one mechanical refactor: every `import ... from '../demo-data'` becomes a parameter (`PracticeState { people, grants, controls, knowledge, staff, variables }`) built by a repository from live tenant rows; `assessCoso()` and `findKnowledgeRisks()` take that state; residual-engine's id-substring factors become typed fields on `control` (fraudOpportunityClass, assetExposure, cascade); `evaluateRelease` becomes server-only and is called inside posting transactions; `DecisionEntry` becomes the `control_decision` table; `ROLE_TEMPLATES` seed `entitlement_grant`. Fix the two known math bugs on port (timeline sign convention; beam-search dropping the status-quo node) and add golden-value + monotonicity tests before any score is shown. Precog's UI, TanStack/better-auth/Grok/WebRTC layers, localStorage profile, ml/ naming and military skin are not ported; panels (sod, dual-release simulator, residual radar, coso heatmap, cascade, decision journal, leading indicators) are re-implemented as Next components on dental tokens.

## Data model outline

TENANCY AND PEOPLE. tenant (practice) → location (timezone, permits, sterilizer log). user (tenant_id, username, pass_hash, mfa_secret ENCRYPTED, active, admin_rank, clinical_role, password_changed_at, sessions_revoked_at, created_by_id, notice_ack_at); session (server-side, device_profile shared|personal, last_seen, idle_expires, absolute_expires, ip, ua); staff_credential (user_id, kind: LA/N2O/restorative/radiograph/sedation_permit, expires_at, jurisdiction); entitlement_grant (user_id, entitlement_id from precog taxonomy, location_id?, granted_by, granted_at, revoked_at) — grants are append-only events so control-change history is native; entitlement_conflict (derived, materialized nightly and on grant change: rule_id, user_id, score, status open|compensated|accepted|mitigated, decision_id).

PATIENT AND COVERAGE. patient (tenant_id, mrn per-tenant, demographics, ssn ENCRYPTED, preferred_language, deceased_at, privacy_flags); guardian (relationship, consent scopes); critical_alert (kind, text, active) — the single must-not-miss channel; insurance_plan (carrier, payer_id, fee_schedule_id, COB rules); patient_coverage (rank primary|secondary, subscriber, effective range); eligibility_check (checked_at, raw 271 ref, benefits snapshot); fee_schedule / fee (plan, provider, cdt_code, amount_cents).

SCHEDULE AND ENCOUNTER. appointment (location, operatory, provider, patient, type, start/end, status scheduled→confirmed→arrived→seated→in_chart→note_filed→checked_out, supervision_level, confirmations); encounter (appointment_id?, patient_id, location_id, date_of_service, rendering_provider_id, supervising_dentist_id, status open|closed, closed_at) — THE spine: every clinical and financial child row carries encounter_id NOT NULL. procedure_line (encounter_id, cdt_code, tooth, surfaces[], quadrant, state from PROCEDURE_STATES, treatment_plan_id, visit_group, fee_cents, performer_id, entered_by_id, consented_at, completed_at) — three identities stored separately per the TN research. treatment_plan (patient, name, status, presented_at, accepted_at) with plan_visit grouping. tooth_condition (patient, tooth, surface?, condition, source this_practice|other|existing, dated, encounter_id?) — the odontogram History/Existing layers. perio_exam (encounter_id, examiner_id) → perio_site (tooth, site 1-6, pd, rec, bop, sup, plaque, mgj) + perio_tooth (mobility, furcation); summary measures derived.

CLINICAL RECORD. clinical_note (encounter_id, author_id, clinical_performer_id, reviewing_dentist_id, note_state jsonb, module_ids[], version OCC, status draft|ready|filed, filed_at, frozen_markdown, frozen_audit jsonb, ruleset_version, gpa_version?, amends_note_id NULL for originals, amendment_reason_code, byteaudit_verified) — filed rows immutable by trigger + REVOKE; note_revision ring (working-copy recovery only, keep 20). omission_licence (note_id, field_key, licence kind) counted per note. attestation (note_id, finding_id, reason_code, free_text, attester_id, second_attester_id for killer/PHI class). document (encounter_id?, patient_id, kind image|consent|eob|scan|referral, storage_key, sha256, dicom_meta, interpretation_status, retention_until, legal_hold). rx_record (drug, dose, unit, mg/kg basis, indication, duration, csmd_checked_at) — flag-only interaction screen, never dose calculation. sedation_record as a time-oriented timeline table (event_at real timestamps, vitals, agents, doses).

MONEY — THE READABLE LEDGER. ledger_posting (tenant_id, patient_id, encounter_id?, kind charge|patient_payment|insurance_payment|adjustment|writeoff|refund|reversal, amount_cents signed, reason_code (typed enum per kind), procedure_line_id?, claim_id?, era_line_id?, posted_by_id, posted_at, effective_date, reverses_posting_id, approval_request_id?, idempotency_key) — INSERT-only; a partial unique index on (tenant_id, idempotency_key) makes replays no-ops; balance = SUM per patient/guarantor, never stored. allocation (payment_posting_id, charge_posting_id, amount_cents) — explicit, so 'which procedures did this check pay' is a join, and no 'transfer adjustment' row ever exists. estimate (procedure_line_id, plan rank, est_insurance_cents, est_writeoff_cents) lives in its own table and its own UI column. statement (guarantor, period, frozen pdf key). payment_token (processor token only; no PAN). deposit (location, business_date, expected_cents from postings, slip_cents, deposited_by) ; bank_transaction (account, posted_at, amount, description, source feed|statement) ; reconciliation_match (deposit_id, bank_transaction_id, matched_by system|user, variance_cents) ; variance (open until cleared, cleared_by, decision_id). day_close (location, business_date, production, collections, adjustments, deposits, tied bool, closed_by, closed_at, frozen snapshot).

CLAIMS. claim (encounter_id, coverage_id, rank, status draft|preflight_failed|queued|sent|accepted|rejected|paid|denied|appealed, payer_claim_id, sent_at, age_days derived) → claim_line (procedure_line_id, billed_cents, allowed, paid, patient_resp, adjustment_reason_codes[]); preflight_finding (claim_id, rule_id, severity, field_ref) from the note-justification rules; era_file (835 raw key, received_at) → era_line (claim_line match, status auto_posted|exception, exception_reason). denial_worklist derived.

CONTROLS. control (tenant_id, kind, typed factors, segregated bool, compensating[] , owner_id); dual_release_policy (channel, threshold_cents, first_roles[], second_roles[], enabled) + threshold_exception (action raise|lower|force|waive, scope payee/person/role/amount_band/channel, effective range, approved_by, residual_note); approval_request (channel, amount, requested_by, first_approver, second_approver, status, decision_at, linked posting) — approvals are the only path that unblocks a blocked posting; control_decision (subject_ref, kind remediate|accept_residual|monitor|insure, note, review_by, residual_at_decision, made_by, made_at, evidence_refs[]) append-only; control_score_snapshot (scoring_version, rulebook_version, portfolio jsonb, coso jsonb, computed_at) so scores are reproducible over time.

AUDIT AND PHI ACCESS. audit_event (tenant_id, at, actor_id, actor_name frozen, action, target_type, target_id, detail bounded+marked-truncation, ip, ua, session_id, prev_hash, row_hash) — INSERT-only via a dedicated DB role with UPDATE/DELETE revoked, per-row HMAC chained to prev_hash, nightly anchored to an S3 Object Lock sink; a 'security' filter excludes routine sign-ins. phi_access (tenant_id, at, actor_id, patient_id, surface chart|ledger|claim|report|search, record_refs[], purpose treatment|payment|operations|break_glass, justification) — written for every record open and every report/search result set; itself access-restricted to the compliance role. disclosure (patient_id, channel print|export|email|fax|portal, recipient, records, actor, at) for accounting of disclosures. All PHI tables: RLS policy `tenant_id = current_setting('app.tenant_id')::uuid`. Timestamps stored UTC with the location timezone frozen as text on filed artifacts (replace hard-coded America/New_York). Retention: retention_until computed from last professional contact and patient age (TN 7y adult / 10y minor rule, longer wins), legal_hold blocks purge, destruction_log records group-level detail.

## Ux blueprint

INFORMATION ARCHITECTURE. One shell, three persistent regions: (1) a top bar with tenant/location switcher, global patient search (typeahead over name/DOB/phone/MRN with two-identifier confirmation on selection), and the Andon slot (one verb line + one control, never prose); (2) the PATIENT RAIL — a persistent left/right panel that appears on patient selection and stays across every surface (the Curve Sidekick pattern): header with critical-alert channel (always visible, red, uncollapsible), then one-tap targets Chart · Notes · Perio · Imaging · Plan · Ledger · Claims · Docs · Profile, then expandable summaries (next/last appointments, coverage + eligibility flag, recall status, balance real vs estimated, open plans, last filed note). Privacy mode hides names on operatory screens. (3) the WORK CANVAS whose default content is the persona's home. Primary nav is role-derived: Board, Chairs, Money Desk, Daily Close, Controls, Reports, Setup. Everything else is reached from the rail or a row's next action — no deep menus.

HOME SCREENS BY PERSONA (the login lands here; no dashboard card grid).
- Front-desk coordinator → BOARD: day view by operatory with appointment cards colored by type (shape + word + luminance, CVD-safe), a per-chair status strip (arrived / seated / in chart / note filed / ready to checkout) driven by encounter status so 'is the note done' is visible without texting anyone, an unset-role/readiness strip before open, waitlist/ASAP fill, and a checkout queue. Arrive = one tap on the card.
- Office manager / biller → MONEY DESK: three worklists as tabs with counts — ERA exceptions (auto-matched lines are already posted), Claims aging (>14/30/60 with next action), Denials — plus Approvals waiting on me (dual release), Unposted encounters, and a 'variances I own' strip. Each row: patient, amount, one-line reason, one primary action.
- Hygienist → CHAIRS (mine): today's patients in order with alerts, last perio date and delta, recall due, and two buttons per card: Perio and Note. Perio opens directly into six-point entry.
- Dentist → CHAIRS + QUEUES: exams waiting, plans to present, notes needing dentist filing (the handoff rail), imaging without interpretation, prescriptions pending CSMD check. Killer-strip finish at the bottom of every note.
- Owner → DAILY CLOSE & CONTROLS: yesterday tied to the bank or not (one word), variance count, control score with its top three levers (tornado), decisions due for review, practice-level filing rollup, weekly digest. Everything deep-links to postings; nothing ranks people.
- Temp/new hire (any role) → same home as their role plus a one-shift fast path checklist rendered inside the work surface (not an LMS tour), with role already set at provisioning.

THE FIVE DAILY FLOWS, FEWEST CLICKS.
1. CHECK-IN (coordinator): Board → tap card → 'Arrive' (1 tap). Eligibility ran overnight and shows green/amber flag on the card; forms status and outstanding balance appear in the card's expander; 'Seat' is the same card's next state. Zero navigation away from the Board. Fail state: amber eligibility → 'Re-verify' button runs a 270 inline.
2. PERIO (hygienist): Chairs → Perio (1 tap) → entry grid opens on the correct dentition with cursor at UR site 1; voice ('four three three, bleeding') or number keys auto-advance; prior exam ghosted in grey with deltas ≥2mm highlighted; 'Save exam' (1 tap) writes perio_exam + derives the note's periodontal summary + SRP justification evidence. Undo-by-voice or Backspace. Total: 2 taps plus data entry; one operator.
3. CHART + PLAN + NOTE (dentist/assistant): Patient Rail → Chart (1 tap) → paint procedure on the odontogram (tap tooth, drag surfaces, pick macro shortcut) → the procedure_line appears on the plan card with CDT/fee/estimate, the History/Planning layers update, and the encounter note gets the fact scaffold; 'Open note' (1 tap) lands cursor-ready with Fast Lane scaffolds; killer strip at the bottom shows ≤3 open items + one primary 'File' button; dentist-owned sections are locked by licence and appear to auxiliaries as a single handoff strip. Filing runs the audit server-side, freezes, byteaudit-verifies, and flips the Board chip to 'note filed'.
4. CHECKOUT (coordinator/biller): Board card → 'Checkout' (1 tap) → completed procedures listed with patient portion (estimate column separate from balance), pre-flight status per claim line (WHAT/WHY/HOW, deep-link to the note field), 'Take payment' (hosted card fields, 1 tap) → 'Queue claim' (1 tap; blocked only by S1/killer pre-flight). Three to four taps; no ledger navigation needed; the ledger explains itself later.
5. POST ERAs AND CLOSE THE DAY (biller, then owner): Money Desk → ERA exceptions (only unmatched lines) → each row offers the likely match + 'Post' / 'Write-off (reason)' / 'Appeal'; write-offs above threshold route to Approvals with the second approver named, not a dead end. Then Daily Close → one screen: production, collections, adjustments (by reason), deposits, bank matches; variances listed with 'Resolve' → decision recorded. 'Close day' freezes the day_close snapshot. Owner sees 'Tied' or 'N variances' the next morning.

HOW 'VERY INTUITIVE' IS ACHIEVED. (a) Persona-first entry: nobody hunts for their work; the home IS the worklist and every row has exactly one primary action. (b) Persistent patient context: one selection, then one tap to any surface — the same object model Curve users praise. (c) Structural attachment removes an entire error class (wrong-visit notes) and therefore an entire category of 'where did it go' confusion. (d) Readable money: chronological postings with plain-language allocation traces and a 'why does this patient owe $X' explainer; estimates in their own column; no hidden buckets. (e) Gates read like instruments: one verb line, one control, ≤3-row killer strip, validation silent until blur, named omission licences instead of blanks, mask before waiver. (f) Glove-first physics: 44px/8px everywhere, procedure mode preserving the caret, purposeful motion only under prefers-reduced-motion:no-preference. (g) Calm identity: cream/navy/teal work surfaces, severity by luminance + shape + word (CVD-safe), no dark glow, no marketing hero inside the chart — 'instrument seriousness is a speed feature.' (h) Learnability: role set before work, role-scoped first run inside the surface, free certification drills verified by the real engine, coordinator readiness strip. (i) Honesty: outages show the degraded-mode banner with what still works; support hours and SLA are printed in-app; AI proposals show their evidence quote and never a confidence percentage. (j) Measured, not asserted: the pilot instruments median ready→filed time (≤ baseline +20%), perio completion rate, checkout clicks, ERA auto-post rate, days-to-tie, and ≥70% eligible-chart adoption by week 4 — the owner panel's buy gates — before more features ship.

## Internal controls integration

EVENT SOURCES. The controls engine no longer reads a demo profile; it reads live tenant state through a repository: entitlement_grant events (every role/grant change and every termination emits control.change), ledger_posting inserts (with kind, reason, poster, effective_date vs posted_at, hour-of-day), approval_request outcomes, deposit/bank_transaction/reconciliation_match rows, claim/ERA outcomes (denial-writeoff patterns), audit_event and phi_access streams (after-hours access, retroactive edits, export volume), staff_credential expiries, and control_decision rows. A `PracticeState` builder assembles these into the shape precog's engines expect (people, grants, controls, knowledge, staff composition — now DERIVED: teamSize from roster, segregationScore from detectSodConflicts' own segregationHealth, soleOwnerKnowledgeCount from the knowledge map, tenure from HR dates), eliminating precog's double-bookkeeping inconsistency.

ENFORCED (server-side refusals inside the write path). (1) Dual release: `evaluateRelease(policy, request)` from precog controls/dual-release.ts runs inside the posting transaction for writeoff, refund, adjustment-over-threshold, ACH/check release, new-vendor and deposit channels; any status other than approved_* / below_threshold rolls back the posting and creates an approval_request naming eligible second approvers; blocked_same_person and blocked_role are hard, owner-can-second is configurable, waive_dual requires a residual note and shows in the exception summary with expiry. (2) Segregation of duties: on every grant change, `detectSodConflicts` runs synchronously; a grant that creates a critical-severity conflict is refused unless the grantor records an accept_residual or compensating-control decision with a review date (dual-control by construction because canManageUsers and the affected user cannot be the same person, via MANAGE_CEILING). (3) Authority-scoped actions: financial entitlements are checked by named predicates (canPostAdjustment, canApproveWriteoff, canReleasePayment, canChangeVendorBank) exactly like dental's canManageUsers — no inline role checks. (4) Export/report scoping mirrors the screen and every export writes a disclosure row with rendered-row counts. (5) MFA policy, server idle timeout, shared-device author switch, break-glass dual control. (6) BAA-gated connectors stay disabled until countersigned. (7) Filing gates: killer items hard-block note filing (submit 422), supervision claims require corroborating fields (named supervising dentist, examined-this-visit), attestation authority tiers bind who may attest which severity, PHI/killer overrides require a second named person.

DETECTED AND SURFACED (recorded, batched, never accusatory). Daily reconciliation job matches deposits to bank transactions and opens variances; anomaly detectors emit signals for refunds above threshold, after-hours postings, retroactive effective dates, void/adjustment velocity per reason code, unusual vendors, copy-forward documentation clusters (dental digest/similarity.ts), and denial-suppression-by-writeoff; leading indicators (precog ml/leading-indicators.ts pattern, real inputs) roll into a pressure index; all signals obey dental's DIGEST_RULES — batched weekly, minimum sample sizes, SYSTEMIC_SHARE re-scoping when most of the practice trips the same rule, person-scoped detail visible only to the owner/coach role. Forensic screens (Benford, round-number bias, duplicate detection) that precog's README promised are built here against real postings, framed as control-test results.

SCORING AND COSO. `portfolioSummary(state)` and `assessCoso(state)` run nightly and on control-change events, stamped with SCORING_VERSION and CONTROL_RULEBOOK_VERSION into control_score_snapshot so historical scores are reproducible; residual-engine's inherent factors become typed control fields; control OPERATING effectiveness is measured from data (fraction of over-threshold write-offs with a second approver, days-to-reconcile, distinct-signer rate) alongside DESIGN effectiveness from configuration — COSO distinguishes them and so does the UI. Principles 9 (assess change) and 11 (technology controls) flip from hard-coded 'weak' to continuously monitored because grant/termination events are now observed. Every COSO finding keeps precog's DeepLinkTarget so 'Principle 8 weak' opens the actual conflicts. Tornado levers and the cascade simulator answer 'if I turn on dual approval for write-offs, what moves' with dollar deltas (insurance-credit model retained, labelled directional until calibrated per carrier).

DECISION JOURNAL AS THE DEFENSIBLE ARTIFACT. Every remediate / compensate / accept-on-purpose / insure choice is an append-only control_decision row with residual_at_decision, review_by and evidence refs; overdue reviews appear on the owner home; the journal, the approval log, the exception table and the hash-chained audit trail together are the evidence pack for a CPA, carrier or OCR — rendered as plain sentences. Vocabulary throughout is neutral (priority queue, next steps, control gap); the engine never labels a person a threat, and the anti-accusation guardrails from precog's system prompt and the ADA/Prosperident framing ('17% caught by design') are the product's stated posture and headline.

## Roadmap


### Item 1
- **phase**: Phase 0 — Foundation and honest research (weeks 0-10)
**scope**

Monorepo on dental's Next 15 stack; tenant/location/RLS; auth lift with server sessions, MFA policy + recovery codes, three-axis roles, requireAccess wrapper + route-guard CI test; hash-chained audit_event + phi_access + disclosure; drizzle-kit migrations replacing SCHEMA_BOOT_VERSION; container hosting + jobs + object storage + backups with restore drill; design tokens + Patient Rail shell + Radix primitives + 44px floor; patient/guardian/critical_alert/appointment/encounter tables; dental e2e probes (headers, lockout, MFA, immutability) in the blocking CI job. In parallel run RPT D.8 Phase 1 (24-30 persona interviews, office-manager weighted) and ledger-reading usability probes on three incumbent platforms.

- **exit criteria**: Two tenants cannot see each other's rows even with a deliberately broken WHERE clause (RLS test); every /api route passes the guard-coverage test; audit chain verifies end-to-end and survives a restore drill; MFA enforced for all PHI roles with recovery; contrast + shape uniqueness CI green; 10+ interviews synthesized into the flow spec with ledger-layout preference measured.
- **duration estimate**: 10 weeks
- **dependencies**: BAA-signing Postgres/object-storage/email providers selected; TN counsel engaged for record-content and retention review.

### Item 2
- **phase**: Phase 1 — Chairside core (weeks 10-24)
**scope**

Board with per-chair status strip and check-in; editable odontogram (Planning/History/Existing) with paint-to-chart and macro shortcuts; procedure_line + treatment_plan with estimates column; six-point perio with keyboard/foot-pedal and voice via the DictationEngine seam (on-device engine or BAA vendor gate); note builder ported and decomposed into the Encounter page with structural encounter_id, Fast Lane, killer strip, omission licences, attestation tiers, amends_note_id, byteaudit verify at filing; dentist filing queue and auxiliary handoff strip; shared-device profile (author switch, no local mirror); PHI rules demoted to egress classifier; degraded-mode read replica of today's schedule/alerts.

**exit criteria**

Flows 1-3 meet click budgets (check-in 1 tap, perio 2 taps + entry, chart→note→file ≤ 6 interactions) in a moderated test with a hygienist, an assistant and a dentist; perio exam completable by one operator in a timed 50-minute hygiene simulation; filed note immutability + addendum chain e2e green; precision harness reports zero blocking false positives on the 34-note corpus after the PHI re-scope; ninety-second chairside observation performed at the pilot practice (the corpus's top unknown).

- **duration estimate**: 14 weeks
- **dependencies**: Phase 0; CDT licence; sensor/imaging bridge decision (bridge-only acceptable here).

### Item 3
- **phase**: Phase 2 — Money that reads (weeks 24-40)
**scope**

Append-only ledger + allocations + estimates column + 'why do I owe' explainer; checkout with hosted-field payments; fee schedules per plan/provider; coverage with primary/secondary COB; clearinghouse integration for 270/271 eligibility (overnight sweep + inline re-verify), 837D batch with pre-flight scrubber consuming the justification rules, 835 auto-posting with exception queue; claims tracker and denial worklist; Money Desk home; statements; Daily Close day sheet with deposits; canned report library v1 with export mirroring screen authorization; published rate card and export terms on the public site.

**exit criteria**

A biller posts a full simulated day (dual coverage, partial payments, one refund, one write-off) and a CPA reads the resulting ledger without asking a question (usability probe, task success ≥ 90%); ERA auto-post rate ≥ 85% on a payer test set; checkout ≤ 4 taps; production→collections→adjustments→deposits ties to the penny on the day sheet for 10 consecutive simulated days; property tests on allocation invariants (sum of allocations ≤ payment; balances reproducible from postings alone).

- **duration estimate**: 16 weeks
- **dependencies**: Clearinghouse contract and payer enrollment (allow 30 business days); processor with hosted fields; Phase 1 encounter/procedure model.

### Item 4
- **phase**: Phase 3 — Controls enforced (weeks 40-52)
**scope**

Port precog engines behind the PracticeState repository; entitlement_grant seeding from ROLE_TEMPLATES with conflict pre-flag at setup; dual release inside posting transactions with approval_request flow; SoD grant refusal with decision capture; bank feed/statement import + reconciliation matching + variance queue; anomaly signals and weekly digest under DIGEST_RULES; COSO/residual snapshots with deep links; tornado/cascade what-if; decision journal; owner Daily Close & Controls home; forensic screens (Benford, round-number, duplicates) as control tests; golden-value, monotonicity and evaluateRelease truth-table tests; timeline-sign and beam-search bugs fixed on port.

**exit criteria**

A seeded practice with the Office Manager template shows the expected critical conflicts and cannot grant create_vendor + release_payment to one person without a recorded decision; an over-threshold write-off is refused at the database transaction and appears in the second approver's queue; a planted $300 skim (deposit short, adjustment after hours) surfaces as a variance and an anomaly within one business day in a simulated month; scores reproduce byte-identically for a frozen snapshot across two runs; no screen ranks individuals (review checklist).

- **duration estimate**: 12 weeks
- **dependencies**: Phase 2 ledger and deposits; bank aggregator/BAA or statement-import path chosen; CPA review of rulebook defaults and thresholds.

### Item 5
- **phase**: Phase 4 — Pilot, compliance program, comms (weeks 52-68)
**scope**

Live pilot at one practice with the owner-panel buy gates instrumented; HIPAA/OSHA program (guided SRA, tailored policies, server-verified training drills, BAA registry gating connectors, sterilizer log, records-request workflow); patient comms (SMS/email/recall under BAA) and portal with plain-language/stigma delivery gate; imaging documents in the encounter with DICOM export; AI assist under the cage (note assist, claim-narrative pre-flight suggestions, coach over aggregate control scores with names stripped) with no per-use metering; migration tooling for the pilot's incumbent PMS including in-flight claims cleanup screen.

**exit criteria**

Pilot week 4: ≥70% of eligible charts in the product, median ready→filed ≤ baseline +20% (target ≤ 0 by week 8), ≤90 minutes paid training per writer, perio completion rate up vs baseline, day tied ≥ 90% of business days, zero wrong-author events on shared devices, zero cleartext draft bytes recoverable after sign-out; portal gate blocks 100% of summaries with open plain-language findings; BAA registry blocks a connector without a countersigned BAA in test.

- **duration estimate**: 16 weeks
- **dependencies**: Phase 3; pilot practice agreement; SMS/email/model providers under BAA; TN counsel sign-off on policy templates.

### Item 6
- **phase**: Phase 5 — Scale and open (post-pilot)
**scope**

Multi-location as authorization boundary, org/region content catalog, SSO/SCIM, versioned public REST API + webhooks + sandbox tenants, FHIR export once conformant, published uptime history and SLA with credits, per-state licence/supervision configuration beyond Tennessee, specialty scoping decision (native or public 'not in scope'), Canada parity decision, conversion tooling for the remaining incumbents with a published fixed price.

- **exit criteria**: Second and third practices onboarded via self-service conversion with published price and ≤ 10 business days to go-live excluding EDI enrollment; a DSO-style two-location tenant demonstrates cross-location Minimum Necessary; API used by one external partner in sandbox; status page shows 90 days of real uptime.
- **duration estimate**: Ongoing; first 16 weeks post-pilot
- **dependencies**: Pilot exit; per-state legal research budget; partner program.

## Risks and tradeoffs

- Clearinghouse depth is the #1 buying criterion and the hardest build: incumbents run ~100M claims/yr; payer-rule coverage, 835 matching breadth and EDI re-enrollment (up to 30 business days) can make v1 insurance workflow the very complaint the product exists to fix. Mitigation: ride an established clearinghouse, ship pre-flight + exception-queue UX first, publish payer coverage honestly.
- The signature ledger has a market base rate of zero: four vendors across three ledger models each shipped something their own billers hate. Mitigation: usability probes on incumbents before building, explicit allocation model, CPA read test as a phase exit criterion, property tests on allocation invariants.
- Hiring-pool familiarity cannot be met by a new entrant; mitigations (one-shift fast path, free certification, role-before-work) are hypotheses until measured in the pilot.
- Holding PHI inverts every safety argument both repos currently make; the PHI gate becomes the first line, not defence-in-depth, and breach economics ($6.64M average) plus FTC exposure on security marketing are new. Mitigation: BAA-gated connectors, field-level encryption, own SOC 2 Type 2 path, no 'HIPAA compliant' as a product adjective.
- Dictation: shipped engine is off-device browser SpeechRecognition; voice perio on PHI audio requires an on-device Whisper engine (unbuilt) or a BAA vendor — perio-at-hygiene-speed may slip if this is not started in Phase 0.
- Precog's math has known defects (timeline sign inversion, beam-search status-quo drop, counterfactual ignoring variables, illustrative multipliers with no calibration) and zero tests; scores shown to a paying owner must be re-tested and labelled directional until calibrated against ADA/ACFE figures or carrier data.
- Reconciliation needs bank data from outside the PMS; aggregator BAA/pricing and statement-import fallbacks are unresolved, and 'independent of the system being checked' is philosophically awkward when we also own the PMS — mitigated by the hash-chained audit trail and read-only bank feed.
- Offline mode is bounded by design (read replica + queued notes, no money) and any local PHI replica is a breach surface on shared devices; the privacy panels and the reliability research pull in opposite directions and the compromise must be stated publicly.
- Tennessee-only legal content (rules, supervision, retention, scope) limits commercial reach; per-state authoring is a legal-research cost, not engineering, and no counsel or carrier has reviewed any of it yet.
- Pricing is anchored low ($149-$700/location), only 16.9% of owners plan a software purchase in 2026, and the controls module's adjacent-market ceiling is $39-$115/mo — the controls layer likely monetizes as the reason to switch, not as ARPU; migration cost dominates acquisition.
- Well-funded incumbents (Curve $200M R&D, HS1 Voice Perio/Eligibility Pro/MCP, Denticon AI perio and auto-835) are moving on the same gaps; the perio and eligibility windows may narrow before launch.
- Evidence is thin and dentist-weighted; the ledger-clarity bet rests on complaint text. RPT D.8 primary research is scheduled in Phase 0 and should gate the Phase 2 ledger design.
- Decomposing BuilderShell.tsx (2,127 LOC) and threading tenant_id/encounter_id through the note engine while preserving the pure-function audit property is real refactor risk; keep runTextAudit pure and pass context as arguments.
- Enforcing dual release in the transaction adds friction that a rigid threshold will get disabled in week one; the exception system (payee/person/date-scoped, expiring) is what makes it survivable and must ship with it, not after.
- Team size: this is a multi-year build for a small team; the roadmap front-loads the two things that differentiate (readable money, enforced controls) and deliberately defers comms, portal, imaging viewer, multi-location and specialty.

## What to drop

- Points economy, clinic store and badges (dental src/lib/gamify/**, store_items, redemptions, /store, /training bounty) — an app-tracked currency approved by one lead is itself an SoD finding; extract the append-only ledger pattern first, then delete.
- GPA and letter grades on any staff-facing surface (deriveGpa display, rollingGpa, insights.ts) — keep practice-level first-pass rate and time-to-file only.
- Sparkle mascot as chairside chrome (18 call sites) — keep the seeded-deterministic-copy mechanism and its ethics tests for empty/error states; retire the character from work surfaces.
- Data Hygiene Gauntlet as a customer-facing form (/requests, GauntletForm.tsx) — keep the five cycles as internal engineering process; ship a low-friction request path.
- EDR paste-target seam (src/lib/edr/product.ts), clipboard/plaintext-download/email-attachment as primary handoff, and 'identifiers live in the EDR' copy across ~100 strings — the product is the record.
- Local draft mirrors on shared devices (draftBackup.ts localStorage/IndexedDB ring) — replaced by encrypted, session-bound replica on personal devices only.
- ADMIN_PASSWORD_RESET env break-glass, MFA_ENABLED default-off, 12h-absolute-only sessions, and the hand-rolled SCHEMA_BOOT_VERSION DDL array.
- PHI rules as an S0 filing block and the attested PHI-override dialog — re-scoped to outbound-boundary classification.
- Law-watch scraper as a product feature (src/lib/law/watch.ts) — internal ops tool at most; do not promise 50-state currency.
- Persona training corpus IQ/generation fields (persona-agents.ts) — keep fixtures with those fields removed.
- Precog UI and platform layers entirely: TanStack Start/Vite app, better-auth + Grok broker federation (and the committed PREVIEW_CLIENT_SECRET history), WebRTC multiplayer, localStorage practiceProfile, Zustand, unused Radix packages, broken index.tsx.
- Precog 'ml/' branding (z-scores against a hand-written prior), the '95% CI' label on scaled hand-authored timelines, Johari and meta-analysis panels as user-facing screens (keep the gap catalog as backlog), advanced-reasoning panel raw output, layers panel.
- Predator/Terminator vision modes, WHITE HOT/AO/mission-brief/rules-of-engagement vocabulary and the ticking UTC clock — neutral priority-queue language only.
- Precog's Grok agent loop and 'multi-agent' framing; any LLM call moves behind the dental assist cage with a BAA provider and names stripped.
- Dark-only theme, per-use AI metering, per-provider seat surprises, minimum-term/export-fee contract mechanics, proprietary imaging formats — all documented switch-away triggers.
