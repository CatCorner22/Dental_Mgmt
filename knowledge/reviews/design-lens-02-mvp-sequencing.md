# Design lens 2: mvp-sequencing

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 10 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, mvp-sequencing

## Summary

A cloud practice management system for the 1–3 dentist independent practice that replaces Dentrix/Eaglesoft/Open Dental/Curve with three things none of them ship together: a ledger that a front-desk biller and the owner's CPA can both read line by line and tha…

## Lens

mvp-sequencing

## Product vision

A cloud practice management system for the 1–3 dentist independent practice that replaces Dentrix/Eaglesoft/Open Dental/Curve with three things none of them ship together: a ledger that a front-desk biller and the owner's CPA can both read line by line and that reconciles to the bank every day; clinical documentation and charting that are enforced by a deterministic, versioned audit gate (Smile Notes' engine, now inside the chart it used to feed by clipboard); and internal controls that are enforced by the PMS itself rather than recommended by a questionnaire — segregation-of-duties detected from the real role grants, two-person approval refused server-side on write-offs, refunds, adjustments and vendor payments, and an owner review queue that turns "17% of theft caught by design" into a designed control. It wins on the cheapest differentiators first (published rate card, exit terms, uptime history, no per-use AI), sells to the office manager and hygienist who live in it rather than only the dentist who signs the check, and is HIPAA-grade by construction (tenant isolation with RLS, MFA on every clinical account, hash-chained audit log with read logging, no PHI to any provider without a BAA and a field-level gate). Growth path: the same tenant model extends to multi-location groups via location-scoped authorization and consolidated reporting without a rewrite.

## Guiding principles

- Shortest credible path to one paying 1–3 dentist practice running its whole day on the product; everything else is sequenced behind that.
- Lift dental's production-grade infrastructure (auth, throttle, guards, audit writer, PHI rules, audit engine, vocab, autosave, atomic filing) verbatim; lift precog's DOMAIN logic (SoD rulebook, dual-release evaluator, residual math, COSO mapping, decision journal) and rewrite ALL of precog's plumbing. Nothing from precog's app shell, auth, or persistence survives.
- One stack, one repo: Next.js 15 / React 19 / Drizzle / Postgres. Precog's TanStack/better-auth/Kysely app is retired; its pure-TS engine moves into the monorepo as a package.
- PHI is the design assumption from commit one: tenant_id on every table with Postgres RLS as backstop, server-authoritative authorization on every request, read logging, hash-chained audit, MFA required, encryption at rest, BAA-gated third parties. Retrofitting any of these later is the most expensive mistake available.
- Enforced, not recorded. Every control precog computes must be able to REFUSE a transaction inside the database transaction that would commit it. A client-side verdict is advice; the server verdict is the control.
- The ledger is append-only, balances are sums, every payment is explicitly allocated to charges, every adjustment has a typed reason code and a named poster, reversals are new rows. No hidden transfer-adjustment lines, ever. Estimated insurance is a projection, not a ledger row.
- Frozen attribution: any name shown on a record is snapshotted at write time and never re-attributed. Records outlive accounts.
- Every clinical note has a required foreign key to an encounter (visit). Attachment is structural, never a user-selected tag — this eliminates Curve's documented orphaned-note failure class.
- No scores that grade people. Practice-level metrics only; person-scoped signals are private to a designated reviewer; no letter grades, badges, points, or leaderboards on any clinical surface. This is a walkout trigger, not a preference.
- Refuse, don't score. No confidence percentages, no compliance percentages. Gates are binary; escape hatches are named, finite, and counted (omission licences, attested overrides with reason codes).
- Publish what nobody publishes: the full rate card, year-two price, exit and export terms, uptime history, incident post-mortems. These are decisions, not builds, and they are the cheapest wins in the market research.
- Do not promise offline the product cannot safely honor. Ship a documented read-only degraded mode and durable autosave in v1; schedule true offline capture for v2 with an explicit sync/reconciliation design.
- Home is the work: the clinician's front door is the chart, the front desk's is the board, the owner's is the reconciliation and controls queue. No dashboard of cards as a landing page.
- Glove-first, one-verb gates: 44px targets on every pointer type, one verb line plus one control at every blocking message, validation silent until blur, severity encoded by shape + word + luminance.
- Every rule, weight, prompt, and schema is versioned and stamped onto the record it produced, and CI fails a change that does not bump the version. Regulators and plaintiffs ask 'which rules ran'; the answer must be in the row.
- Build the clearinghouse integration, not a clearinghouse. Ride DentalXChange/Vyne for eligibility, claims and ERA; own the scrubber, the worklist, and the posting.
- Imaging is bridge-and-store in v1 (DICOM in, DICOM out, contractually free export). Native acquisition and FDA-cleared measurement tools are a later regulatory project, not an MVP feature.
- Migration is a product feature: the Open Dental importer ships with v1 because its schema is public MySQL and its customers are the most price-sensitive and portability-motivated switchers.

## Modules


### Item 1
- **name**: Tenant, Identity & Access
- **purpose**: Multi-tenant practice/location model; users with three orthogonal axes (admin rank, clinical licence, financial entitlements); server-authoritative guards; MFA required for clinical/financial roles with recovery codes; session store with idle timeout and per-device revocation; default-deny API wrapper.
**reuse from**

dental: src/lib/auth/guards.ts (requireRole -> requireAccess(tenant)), src/lib/auth/roles.ts (rank ladder + MANAGE_CEILING), src/lib/auth/clinicalRoles.ts, src/lib/auth/approval.ts, src/lib/auth/throttle.ts, src/lib/auth/hashGate.ts, src/lib/auth/clientIp.ts, src/lib/auth/sessionWatermark.ts, src/lib/auth/totp.ts, src/lib/auth/password.ts, src/lib/auth/resetToken.ts, src/lib/auth/issueResetLink.ts, src/lib/auth/freshUser.ts, src/lib/auth/loginFormState.ts (sanitizeCallbackPath), src/app/api/me/mfa/route.ts lifecycle, src/app/api/admin/users/[id]/mfa-reset/route.ts (second-person recovery), src/lib/db/repo/users.ts (isCreatureOf, mutateAdminGuarded), timingSafeEqualStr from src/app/api/law-watch/alert/route.ts. precog: sod/conflict-rules.ts 14 entitlements become the financial-entitlement axis; sod/detect.ts ROLE_TEMPLATES become the six default roles. Patterns only from precog src/lib/auth/isolation.server.ts (Fetch-Metadata cross-site guard) and verify.server.ts (fail-closed when real DB present).

**build new**

tenants/locations tables and tenant-scoped guard signature; server-side sessions table (keep JWT watermark as belt-and-braces) with 15-min idle on operatory device profile and active-sessions list; MFA policy enforcement (mandatory for dentist/hygienist/biller/manager/owner) plus recovery codes; break-glass replacing ADMIN_PASSWORD_RESET env var (dual-control one-shot recovery code with audit); withGuard() wrapper every route handler is exported through plus a CI test that globs src/app/api/**/route.ts and fails on any unwrapped handler; Origin/Sec-Fetch-Site check and Content-Type check on all state-changing routes; encrypted mfa_secret column (envelope encryption via KMS); postgres RLS policies with SET LOCAL app.tenant_id in every transaction.

- **priority**: v1-core
- **ux notes**: Role set at provisioning, never day-of. Shared operatory tablet gets a device profile: fast switch-author with PIN, wipes local drafts on switch. Login failure copy byte-identical across all refusals (keep e2e/mfa.totp.mjs).

### Item 2
- **name**: Audit Log, PHI Access Log & Tamper Evidence
- **purpose**: Append-only, hash-chained action log with IP/UA columns; separate PHI read log (who opened which patient/ledger/claim when); plain-sentence rendering; 6-year retention; monthly reviewed-as-an-act.
- **reuse from**: dental: src/lib/db/repo/auditLog.ts (bounded write, marked truncation, frozen actor), src/lib/audit/attestation.ts (isValidPhiAttestation), export filters pattern from src/app/api/export/[table]/route.ts ('authorization mirrors the screen'), src/lib/export/csv.ts.
**build new**

audit_log gains tenant_id, ip, user_agent, prev_hash, row_hash (HMAC chained to previous row), and an append-only Postgres role with REVOKE UPDATE/DELETE; phi_access_log table written by a repo-layer read hook on patient, encounter, ledger, claim, document fetches; nightly chain verifier job; disclosure events (print, export, fax, portal send, clipboard) as first-class rows; plain-language audit narrative view; retention/legal-hold flags.

- **priority**: v1-core
- **ux notes**: Owner-only 'security' filter that hides routine sign-ins (dental's rule: a successful login is the noise). Every export shows the row count that was actually rendered.

### Item 3
- **name**: Patients & Accounts
- **purpose**: Patient demographics, guardians/guarantors, family/account grouping, alerts (allergy, premed, anticoagulant, latex, behavioral, financial hold), consent objects, document storage.
- **reuse from**: new (no patient entity exists in either repo). Consent field enumeration from dental skill/references/tennessee-dental-law-summary.md; alert channel pattern from dental knowledge/sources/curve-hero-pms-clinical-documentation.md (Critical-note).
**build new**

patients, guarantor_accounts, patient_alerts (uncollapsible 'must not miss' channel surfaced on patient selection), consents (decision enum, consenting party + relationship, interpreter, separate clinical vs marketing image scopes), documents (S3-compatible object storage with signed URLs, virus scan, retention), duplicate-patient detection, patient merge with frozen attribution, records-request export (full record, 10-working-day SLA workflow).

- **priority**: v1-core
- **ux notes**: Persistent patient rail (Curve Sidekick pattern) visible across schedule, chart, ledger, claims; privacy mode that hides names for open operatories; two-identifier confirmation becomes a real technical control because the PMS owns the chart.

### Item 4
- **name**: Scheduling & Front Desk Board
- **purpose**: Multi-operatory day/week board, appointment types, provider schedules, confirmations, recall/recare, ASAP list, check-in with eligibility, supervision-level validation for hygiene appointments.
- **reuse from**: new. Supervision matrix from dental src/lib/law/license-scope.ts and src/lib/audit/rules/supervision.ts (PC1107 effective-dated logic) as a scheduling constraint. Color/shape encoding rules from dental docs/design-tokens.md and knowledge/sources/color-theory-uiux.md.
**build new**

appointments, operatories, provider_schedules, appointment_types (colors + default procedures), recall rules, waitlist; check-in flow that fires eligibility; supervision validator (direct vs general; new-patient direct-supervision rule after 2027-01-01; certification gates for LA/N2O); per-chair documentation-status strip (from the front-desk adversarial panel) with no PHI leaking across the desk; SMS/email confirmations via BAA-covered Twilio (v1-nice).

- **priority**: v1-core
- **ux notes**: The board is the front desk's home. Drag to reschedule, one click to check in, eligibility badge on the appointment card. Status by shape + word, never hue alone.

### Item 5
- **name**: Encounters & Clinical Notes
- **purpose**: Every visit is an encounter; notes attach structurally to encounters; the Smile Notes module/audit engine becomes the note builder inside the chart; frozen filing with ruleset version; addenda chain; identity now legitimately in the record.
**reuse from**

dental (largely verbatim): src/lib/schema/types.ts, src/lib/modules/** (33 modules), src/lib/vocab/** (teeth, surfaces, shorthand, abbreviations, procedures, clinical-terms, plain-language, misspellings, lexicons), src/lib/audit/engine.ts + types.ts + rules/** (completeness, justification, medication-safety, anatomy, shorthand-gate, supervision, tone, etc.), src/lib/audit/omissions.ts, killers.ts, tailorForAuthor.ts, src/lib/compose/composeNote.ts + filedNoteEqual.ts, src/lib/standardize/**, src/lib/extract/**, src/lib/readback/readbackClass.ts, src/lib/db/repo/drafts.ts (updateDraftChecked OCC + revision ring), src/lib/db/repo/submissions.ts (fileSubmissionAtomic), src/lib/byteaudit/** (sealed independent verifier), src/lib/client/autosaveMachine.ts + useAutosave.ts + draftBackup.ts, src/lib/state/noteReducer.ts, src/components/builder/NoteForm.tsx, AuditPanel.tsx, PasteIntake.tsx, fields/ToothPicker.tsx + SurfacePicker.tsx, src/lib/version.ts + CI version-stamp guards, src/lib/tickets/**, src/lib/scope/authorCapabilities.ts, src/lib/packs/** (composition-only practice packs with maker-checker).

**build new**

encounters table (patient, location, provider, date of service, type, status) and drafts/submissions gain encounter_id NOT NULL + tenant_id; re-scope the PHI rule family from 'block filing' to 'outbound boundary only' (identifiers are legitimate in the record; phi.* becomes S0 only on provider/export/analytics paths); retire override-as-waiver for in-record identifiers; addendum chain (amends_submission_id, reason code, cumulative view + sequence list); jurisdiction parameter on TN-specific rules; BuilderShell.tsx decomposed into chart-context-aware panels; encrypted IndexedDB mirror keyed to session, wiped on sign-out/author switch; module field-id deprecation registry + round-trip test for older drafts; remove ~100 'identifiers live in the EDR' strings.

- **priority**: v1-core
- **ux notes**: Note opens from the encounter with the scheduled procedures pre-selecting modules (structure only, never values). Fast Lane packs are first-class and visible. Killers hard-block signing; S2 is review. Dictation via the existing DictationEngine seam, but only an on-device or BAA-covered engine may touch PHI.

### Item 6
- **name**: Odontogram & Restorative Charting
- **purpose**: Editable tooth chart of record with existing/planned/completed layers, per-surface history, paint-to-chart procedures that propagate structured facts into plan and note, plus the readback contradiction detector.
- **reuse from**: dental: src/lib/vocab/teeth.ts + surfaces.ts (ADA Universal table, allowedSurfaces), src/components/builder/Odontogram.tsx (five-zone glyph geometry, mesial/distal orientation, paint policy), src/lib/extract/chart.ts (chartMarks, CONTRADICTORY_PAIRS), src/lib/audit/rules/anatomy.ts (wrong-site S0).
**build new**

chart_events (event-sourced per tooth/surface: condition, procedure, status planned|completed|existing, provider, encounter, date) with a materialized current-state view; editing interactions (click/drag surfaces, multi-tooth macros/shortcuts); temporality supplied by the entity model (extract refuses to guess); planned-vs-completed conversion gated on encounter completion + note gate (Curve's checkout auto-conversion trap redesigned); mixed dentition; cross-surface contradiction findings (note vs chart vs claim) as blocking S0.

- **priority**: v1-core
- **ux notes**: Charting is a painting gesture with shortcut buttons; one gesture writes chart + plan + note scaffold. Category colour never uses severity palette. Undo is one tap; adjacent-tooth mistap recovery is designed in (44px, 8px gaps).

### Item 7
- **name**: Periodontal Charting
- **purpose**: Six-point full-mouth perio exam completable by one hygienist inside the appointment: keyboard/foot-pedal auto-advance, prior-visit deltas, voice entry with confirmation as soon as an on-device or BAA engine is available.
- **reuse from**: dental: src/lib/dictation/engine.ts (DictationEngine seam), normalize.ts, availability.ts; summary measures from src/lib/modules/periodontal.ts; readback pattern from src/lib/readback/readbackClass.ts.
- **build new**: perio_exams + perio_sites (PD, GM/recession, CAL derived, BOP, suppuration, plaque, mobility, furcation, MGJ) with exam compare view; single-operator input model (auto-advance path, undo-by-key); perio summary auto-fills the periodontal note module and the SRP justification evidence; voice engine Phase 2 (on-device Whisper WASM or BAA vendor) behind the existing seam.
- **priority**: v1-core
- **ux notes**: Full-mouth chart in under the appointment with no second person is the acceptance test (market: 60% skip when behind). Keyboard-first in v1; voice in v1.x once the WER eval corpus exists.

### Item 8
- **name**: Procedures, CDT Codes, Fee Schedules & Treatment Plans
- **purpose**: Licensed CDT code set, per-plan/per-provider fee schedules maintained in one place, phased treatment plans with per-visit patient-portion estimates presentable to the patient, plan acceptance capture.
- **reuse from**: dental: src/lib/audit/rules/justification.ts (narrative supports the code, seed for code-to-finding binding), src/lib/vocab/procedures.ts. precog: none.
**build new**

cdt_codes (ADA licence), fee_schedules, fee_schedule_items, procedures (charted/planned/completed with encounter, tooth, surfaces, provider, fee, code), treatment_plans + phases + alternatives, estimate engine (coverage % by category, deductible, annual max, frequency limits, downgrade rules), presentation view with patient/insurance/total; code-to-finding cross-check (SRP requires perio evidence; crown requires necessity narrative) as an S1 pre-sign finding.

- **priority**: v1-core
- **ux notes**: Money lives on the plan and ledger surfaces, never in the clinical note (dental's rule). Plan cards reorder/split by visit. 'Why this estimate' expands to the exact coverage rules applied.

### Item 9
- **name**: Ledger & Payments
- **purpose**: The signature feature: an append-only patient/account ledger with explicit payment allocation, typed reason-coded adjustments, no hidden transfer lines, a plain-language 'why does this patient owe this' view, statements, and tokenized card processing kept out of PCI scope.
- **reuse from**: dental: src/lib/db/repo/gamify.ts (append-only ledger, balance = sum(delta), partial unique index idempotency, pg_advisory_xact_lock spend serialization, refund-by-append) repointed from points to integer cents; fileSubmissionAtomic transaction shape from src/lib/db/repo/submissions.ts for posting; frozen attribution convention from src/lib/db/schema.ts; src/lib/export/csv.ts.
**build new**

ledger_entries (kind: charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer|reversal; amount_cents; reason_code FK; posted_by frozen; encounter/procedure/claim refs; reverses_entry_id), payment_allocations (payment -> charge, explicit, sums must equal), expected_insurance projection table (never a ledger line), account balance views (patient portion vs pending insurance vs estimated write-off shown separately), statements, day sheet (production -> collections -> adjustments -> deposits), tokenized processor integration (Stripe Terminal/Global Payments hosted vault; no card data touches the DB), property-test suite for dual-coverage and partial-payment allocation written BEFORE code. Every write-off/refund/adjustment/reversal routes through the Controls Enforcement Gate.

- **priority**: v1-core
- **ux notes**: Checkout closes in <=4 clicks. Each ledger row expands to its allocations and its poster. A biller and an accountant reading the same screen see the same numbers; there is exactly one ledger view, not an invoice view and a ledger view.

### Item 10
- **name**: Insurance: Eligibility, Claims, ERA Posting
- **purpose**: Real-time eligibility at booking and check-in, plan/coverage with primary/secondary COB and automatic secondary claim generation, claim scrubber blocking known denial causes, batch eClaims via clearinghouse, claims worklist by age/status/next action, ERA/835 auto-posting with line-item match, attachments.
- **reuse from**: dental: src/lib/audit/rules/justification.ts + completeness.ts as the narrative pre-flight; ticket/atomic-claim pattern from src/lib/db/repo/submissions.ts (claim + ticket + freeze in one transaction; resend exact bytes); src/lib/auth/throttle.ts key namespaces for metering clearinghouse calls.
**build new**

insurance_carriers, insurance_plans, patient_coverage (ordinal, subscriber, effective dates), eligibility_checks (270/271 via DentalXChange or Vyne API, cached), claims + claim_lines + claim_events (append-only status history), scrubber rules engine (missing tooth/surface, frequency, narrative required, attachment required, secondary requires primary EOB), 837D generation via clearinghouse SDK, 835 ERA import with auto-post into ledger via Controls gate (insurance_payment + contractual write-off with reason code), denial worklist, pre-authorizations, EDI enrollment tracker per payer.

- **priority**: v1-core
- **ux notes**: The biller's home is the claims worklist: unsent, rejected, aging >30, unposted ERAs. One click from a denial to the encounter note and chart. Eligibility appears as a badge on the appointment; benefit breakdown is a drawer, not a PDF.

### Item 11
- **name**: Controls Enforcement Gate (Dual Release, SoD, Thresholds)
- **purpose**: The precog engine as a server-side authorization layer: evaluateRelease runs inside the transaction for every write-off, refund, adjustment, vendor change, ACH/check release and deposit; SoD conflicts detected from live role grants; threshold exceptions scoped and dated; approval requests queued to eligible second approvers; every decision appended to an immutable approvals log.
**reuse from**

precog (lift, replace demo-data imports with repositories): src/lib/precog/controls/dual-release.ts (channels, exceptions, evaluateRelease 9-state verdict, mitigatedSodRuleIds), src/lib/precog/sod/conflict-rules.ts (verbatim), src/lib/precog/sod/detect.ts (parameterize assignments/people), ROLE_TEMPLATES. dental: src/lib/db/repo/practicePacks.ts maker-checker + practice_pack_events shape for the approvals log (add compare-and-set), src/lib/auth/roles.ts MANAGE_CEILING for who may approve whom.

**build new**

control_policies (per-tenant versioned DualReleasePolicy + exceptions with approved_by, created_at, effective window), approval_requests (channel, amount, requester, eligible seconds, status, decision, reason) with compare-and-set transitions, approvals_log (append-only), sod_findings (recomputed on every role grant/revoke and nightly), a postGuarded() helper every money-moving repo function must call which returns approved|needs_second|blocked and rolls back on blocked; owner-override path that is itself logged and surfaced (management-override controls per COSO/ACFE); fix waive_dual Infinity leak; per-tenant editable rulebook with version stamp on findings.

- **priority**: v1-core
- **ux notes**: A blocked posting shows one line ('Write-off over $150 needs a second approver') and one control ('Request approval'). Approver gets a queue item, sees claim/ledger context, approves or declines with a mandatory reason. Nobody is ever named as a threat; findings are about role pairs and control gaps.

### Item 12
- **name**: Bank Reconciliation & Anomaly Signals
- **purpose**: Daily ledger-to-deposit reconciliation performed against data outside the PMS (bank feed or statement import), deposit matching, unresolved-variance queue the owner must clear, plus detectors for refunds above threshold, after-hours postings, retroactive edits, duplicate/void patterns, adjustment velocity per role.
- **reuse from**: precog: leading-indicators.ts composite pattern (weights/thresholds/why/link), forecast.ts shape for trend, stats/README.md spec for the Benford/forensic suite (the files do not exist; the spec does). dental: src/lib/digest/digest.ts rules (batch not alert; SYSTEMIC_SHARE re-scoping; min-sample gating) and src/lib/digest/similarity.ts idea for duplicate detection.
**build new**

bank_accounts, bank_transactions (Plaid/Finicity feed in v1.x; CSV/OFX statement import in v1), deposit_batches (from day sheet), reconciliation_runs + matches + variances, detector jobs writing control_findings with practice-level framing, daily owner digest (batched, never per-event), Benford/round-number/duplicate screens on adjustments and refunds (framed as control signals, never accusations).

- **priority**: v1-core
- **ux notes**: Owner home = yesterday reconciled? (green/amber with shape), open variances, pending approvals, open SoD findings. Everything is one click from the underlying ledger rows. Zero person-ranking anywhere.

### Item 13
- **name**: Risk Assessment, COSO Map & Decision Journal
- **purpose**: The interactive assess -> score -> tailor -> track loop: residual-risk portfolio computed from live PMS state, COSO 17-principle map with deep links to evidence, tornado/cascade what-ifs, and an append-only decision journal (remediate/accept/monitor/insure with residual-at-decision and review date).
**reuse from**

precog: scoring/weights.ts (verbatim), scoring/residual-engine.ts (parameterize; replace id-substring factor derivation with typed control fields), coso.ts (parameterize assessCoso), scoring/variable-cascade.ts, scoring/dynamic-variables.ts (retainLoss, computeNetPremium), practice-profile.ts DecisionEntry model, rag/corpus.ts (16 chunks as in-product guidance), threat-scoring.ts deriveRoe() remediation copy (drop the military skin). dental: src/lib/risk/categories.ts (failure taxonomy + coverageByCategory, currently dead code) merged into one findings register with precog's categories.

**build new**

controls registry (typed control records replacing demo controls), risk_scores stamped with SCORING_VERSION, decision_journal table (append-only, user-attributed, evidence attachments), onboarding assessment that derives StaffComposition from real roster/roles rather than hand entry, COSO P9/P11 flip to continuously monitored from role-change events, fix timeline sign convention and counterfactual/beam bugs, golden-value tests for every score.

- **priority**: v1-nice
- **ux notes**: Presented as 'Practice health', not 'threat assessment'. A score is never shown without its drivers and a path to the rows behind it. Owner-only surface.

### Item 14
- **name**: HIPAA/OSHA Compliance Program
- **purpose**: Guided security risk analysis, practice-tailored policies kept current, staff training with certificates, BAA registry that GATES integrations (a connector stays disabled until a countersigned BAA is on file), remediation tracking, incident log with TN 45-day/HIPAA 60-day clocks, sterilizer monitoring log with 2-year retention.
**reuse from**

dental: src/lib/training/** (server-verified drill pattern), src/lib/wishes/** (low-friction safety/incident intake with PHI gate added), src/lib/law/tn-law.ts + license-scope.ts (in-app authority references), knowledge/sources/adversarial-* panels as acceptance criteria, src/components/risk/RiskManagement.tsx content (rewritten, server-side attestations). precog: rag/corpus.ts, meta-analysis.ts gap catalog as the integration backlog.

- **build new**: sra_questionnaires + responses, policies (generated from templates per response, versioned), training_assignments + completions, business_associates + baa_documents with integration gating, incidents + breach clocks, compliance_logs (sterilizer biological monitoring, equipment checks), annual SRA reminder. Content requires counsel review before commercial distribution.
- **priority**: v2
- **ux notes**: One 'Practice risk' module spanning HIPAA, OSHA and financial controls, because that is the budget line the practice already has. Provisional content is labeled provisional.

### Item 15
- **name**: Patient Communications
- **purpose**: Two-way texting, confirmations, reminders, recall, online booking, digital intake forms writing into the chart — included in base price.
- **reuse from**: dental: src/lib/email/threading.ts (opaque ticket tokens, header-injection-safe), single-configured-egress principle from sendSubmission.ts; plain-language + stigma vocab from src/lib/vocab/plain-language.ts for anything patient-facing.
- **build new**: messaging via BAA-covered Twilio, templates with PHI-minimal content, consent to text, intake forms (writes to patients/alerts/medical history), online booking against real availability, recall automation.
- **priority**: v1-nice
- **ux notes**: Reminders/confirmations ship in v1; two-way texting and online booking in v1.x. Every outbound message is a disclosure event in the audit log.

### Item 16
- **name**: Imaging (bridge & store)
- **purpose**: Store patient images in the record (not an external path), import from sensors via TWAIN/DICOM bridge, DICOM export of full history on demand at no charge, interpretation required before referral.
- **reuse from**: dental: sedation-and-imaging.md universal imaging record spec (per-structure status enum, CBCT entire-volume rule) and imaging-no-interpretation completeness rule.
- **build new**: images table (DICOM metadata, object storage, encounter FK), viewer (basic zoom/contrast; no measurement tools claimed), bridge adapters, bulk DICOM export, interpretation gate on referral path. Native acquisition + FDA-cleared measurement is 'later'.
- **priority**: v1-nice
- **ux notes**: Images open from the tooth on the odontogram and from the encounter. Export is self-service.

### Item 17
- **name**: Data Migration & Conversion
- **purpose**: Importers for incumbent PMSs with a published fixed price and timeline, explicit list of what does not convert, imaging conversion, EDI re-enrollment runner.
- **reuse from**: dental: src/components/builder/PasteIntake.tsx human-in-the-loop review pattern; src/lib/extract/** for legacy free-text note structuring; src/lib/standardize/** for cleanup with APPLIED vs FLAGGED; readback tokens for high-stakes fields.
- **build new**: Open Dental importer (public MySQL schema) first; staged import with dry-run diff, mapping review, and per-entity acceptance; Dentrix/Eaglesoft via exported CSV/XML + Apteryx/Schick image folders later; payer enrollment tracker.
- **priority**: v1-core
- **ux notes**: A conversion cockpit the practice can watch: entity counts, unmapped codes, unresolved patients, imaging status. Nothing auto-fills a clinical field without a human accept.

### Item 18
- **name**: Reporting
- **purpose**: Curated canned reports answering owner and office-manager questions, all reconciling to the ledger and the day sheet, a visual filter builder instead of SQL, saved/scheduled reports, consistent numbers across screens.
- **reuse from**: dental: src/lib/digest/filingRollup.ts (versioned per-filing snapshot; practice totals only), src/lib/stats/computeStats.ts (time-to-file, after-hours filing rate), export authorization-mirrors-screen pattern.
- **build new**: report definitions over ledger/claims/schedule/production materialized views, AR aging split (patient vs pending insurance vs estimated write-off), production by provider, collections vs deposits, adjustment/write-off by reason code, filter builder UI, scheduled email (PHI-minimal).
- **priority**: v1-core
- **ux notes**: Every number links to its rows. Same metric, same value, every screen. No per-person clinical quality ranking.

### Item 19
- **name**: AI Assist (caged)
- **purpose**: Optional, BAA-covered, field-level-gated LLM assist for note normalization/SOAP/extraction/questions and for the controls coach — never as a gate, always through verifyMeaning, never trained on records.
**reuse from**

dental: src/lib/assist/service.ts (runAssist single doorway), tier.ts (capability follows licence), prompts.ts + schemas.ts, extraction.ts (evidence-pinned), drift.ts, non-goals.ts, src/lib/verify/** (verifyMeaning, grounding, vocabulary), src/lib/audit/rules/phi.ts + phi-secondary.ts + maskPhi.ts as the OUTBOUND boundary gate, src/lib/bytestar/{escape.ts, ladder.ts, one-way.ts, config.ts} killswitch/escape ladder, docs/model-charter.md. precog: coach/context-pack.ts shape (strip names, role labels only), llm/tools.ts ToolResult contract, rag/retrieve.ts TF-IDF.

- **build new**: provider abstraction behind a BAA (Anthropic via BAA-eligible endpoint or Azure/Bedrock), field-level minimum-necessary filter replacing the whole-app de-identification premise, per-tenant opt-in switch, per-call audit rows (codes/versions/tokens only), no per-use pricing. Ambient dictation non-goal retired deliberately only when an on-device or BAA engine exists.
- **priority**: v2
- **ux notes**: AI proposes, rails dispose; every accepted fact shows its source span; deterministic twin always available so 'AI off' never means 'feature gone'.

### Item 20
- **name**: Public REST API & Interop
- **purpose**: Documented, versioned read/write API with webhooks and sandbox for the practice's accountant, analysts and partners; contractual self-service full export.
- **reuse from**: dental: src/lib/http/readJson.ts, pagination.ts (convert to keyset), int4.ts, throttle key namespaces.
- **build new**: OAuth client credentials per tenant, scoped tokens, webhook outbox, full-export job (structured JSON/CSV + documents + DICOM), FHIR R4 subset once codes and encounter ids exist.
- **priority**: v2
- **ux notes**: Export is a button, not a ticket.

### Item 21
- **name**: Multi-location & Group Growth Path
- **purpose**: Location as an authorization boundary (deliberate cross-location grants), consolidated and per-site reporting, location-scoped fee schedules and schedules, central role administration, SSO/SCIM for groups.
- **reuse from**: dental: offices/user_offices (currently ordering-only; promote to optional boundary), src/lib/db/repo/offices.ts seed-if-empty. precog: sod detection already handles multi-person rosters.
- **build new**: location_grants, org/region pack catalog with inheritance, consolidated views, SAML/OIDC + SCIM, tenant-salted advisory lock keys, per-tenant sequences for user-visible ticket/claim numbers.
- **priority**: later
- **ux notes**: Cross-office browse is a deliberate grant, not the default.

### Item 22
- **name**: Patient Portal & eRx
- **purpose**: Portal (statements, forms, plain-language visit summary with delivery gate) and e-prescribing via a certified vendor (DoseSpot/Surescripts) with the medication-safety rule set running before send.
- **reuse from**: dental: src/lib/audit/rules/medication-safety.ts (12 interactions, kg rule, dose reconciliation, CSMD gate), src/lib/vocab/abbreviations.ts do-not-use list, plain-language + stigma rules, patient-audience field semantics (audience: 'patient').
- **build new**: portal auth (separate identity realm), portal delivery gate (open plain-language/stigma findings block send; guardian-addressed for minors), eRx vendor integration with pre-send medication-safety findings.
- **priority**: v2
- **ux notes**: Portal voice is opposite to record voice; the standardize pass is disabled on patient-audience fields.

### Item 23
- **name**: Gamification, Store, Mascot & Sandbox Leftovers
- **purpose**: Points economy, clinic store, badges, GPA, Sparkle mascot, Gauntlet UI, EDR paste seam, ByteStar military skin, WebRTC multiplayer, Johari/meta-analysis/advanced-reasoning panels, persona IQ fields, law-watch as a product feature.
- **reuse from**: dental src/lib/gamify/**, src/lib/gpa/**, src/lib/stats/sparkle.ts, src/lib/requests/gauntlet.ts + GauntletForm.tsx, src/lib/edr/product.ts; precog src/lib/multiplayer/**, map-vision.ts skin, llm/johari-applications.ts, llm/meta-analysis.ts UI, llm/multi-agent.ts
- **build new**: nothing. Extract the append-only ledger PATTERN from gamify.ts and the seeded-deterministic copy technique from sparkle.ts before deleting; keep Gauntlet prose as internal engineering process; keep meta-analysis gap list as a backlog doc.
- **priority**: drop
- **ux notes**: Staff-scored currency redeemable for value with single-role approval is a segregation-of-duties finding the product would flag in its own customer.

## Architecture

STACK. Keep the dental repo as the base and grow it into a monorepo; retire the precog app. Framework: Next.js 15 (App Router, Node runtime, `output: 'standalone'`) with React 19 and Tailwind — the dental repo's 201 test files, hardened auth, security headers, e2e probes and CI already exist there, and precog does not currently build. ORM: Drizzle over node-postgres, but REPLACE the hand-rolled SCHEMA_BOOT_VERSION/ddl.ts mechanism with drizzle-kit generated migrations run by a migrate step at deploy (per-migration history, dry-run, CI check that a fresh DB and a migrated DB produce identical schema). Keep PGlite for tests/dev only via the existing resolveDbBackend guard (production refuses without POSTGRES_URL; pinPostgresSslMode forces verify-full). Database: managed Postgres with a signed BAA (AWS RDS or Neon Business/HIPAA tier), encryption at rest, PITR, and a quarterly restore drill as a release gate. Object storage: S3 with BAA, SSE-KMS, signed URLs, ClamAV scan on ingest. Hosting: a long-lived Node container (AWS ECS/Fargate or Fly.io, single region us-east) rather than Vercel serverless — background work (claim batches, ERA import, eligibility refresh, reconciliation, recall, chain verification, detectors) runs on pg-boss workers against the same Postgres in a second container, and the pool ceiling, maxDuration and globalThis-memo constraints of the serverless design all go away. HTTPS terminates at an ALB with WAF; TRUST_PROXY_HEADERS pinned to one hop. Secrets in AWS Secrets Manager with a dual-key AUTH_SECRET rollover window. Auth: NextAuth v5 Credentials stays (it is what the tested throttle/hashGate/watermark code is built on) PLUS a server-side sessions table for idle timeout, active-session list and per-device kill; JWT watermark retained as belt-and-braces. MFA mandatory for all clinical/financial roles with recovery codes; better-auth is not adopted. Jobs: pg-boss. Email: Resend or SES under BAA, PHI-minimal. SMS: Twilio under BAA. Payments: Stripe Terminal / hosted vault so card data never touches the DB (PCI SAQ-A). Clearinghouse: DentalXChange or Vyne API for 270/271, 837D, 835, attachments. Optional LLM: provider abstraction behind a BAA-eligible endpoint; CSP connect-src stays 'self' in the browser (all provider calls server-side); a nonce-based CSP replaces 'unsafe-inline' once patient-portal/intake HTML exists. Testing: vitest + Playwright, with dental's e2e probes (headers, lockout, mfa, immutability) and postgres-durability.sh moved INTO the blocking CI job, plus route-guard-coverage, RLS, and ledger property tests. CI adds eslint, npm audit, secret scanning, coverage floor, and the existing version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION, SCORING_VERSION, plus a new CONTROL_RULEBOOK_VERSION).

MULTI-TENANCY. Shared database, `tenant_id uuid NOT NULL` on every application table, composite indexes led by tenant_id, and Postgres row-level security as a defence-in-depth backstop: the app connects as a non-superuser role, every transaction begins with `SET LOCAL app.tenant_id = $1` (and app.user_id), and RLS policies filter on `current_setting('app.tenant_id')`. Guard signature becomes `requireAccess(req, { min, entitlement?, tenant })` and returns a fresh-row SessionUser scoped to the tenant. Advisory-lock keys are FNV-1a hashed over (tenant_id, subject) (the pattern already in gamify.ts). User-visible identifiers (ticket, claim number, statement number) come from per-tenant sequence tables, never global serials. Locations live inside a tenant; in v1 they are provenance and scheduling scope (dental's 'office is a per-encounter property' rule), and the schema reserves `location_grants` so they can become an authorization boundary for groups without a migration of intent. Tenant deletion/export is a job that emits the full record set.

OFFLINE STRATEGY. Honest and bounded. v1 ships: (a) the dental five-layer autosave stack (debounced OCC PATCH, pagehide keepalive flush, online retry with backoff, server revision ring) for every long-lived form — notes, perio, treatment plans; (b) the same-device IndexedDB mirror rewritten to be encrypted with a key derived from the server session (AES-GCM, key held in memory, discarded on sign-out/author switch, and a 'shared device' profile that disables the mirror entirely); (c) a service worker that caches today's schedule, the currently open patient's chart summary, and open notes for read-only degraded mode during an outage, with a visible 'read-only: reconnecting' banner and no writes accepted; (d) a public status page with incident history and a contractual chairside-severity SLA. True offline capture with queued writes and explicit conflict reconciliation is v2 and is designed then, not promised now — the dental knowledge base's own rule ('promising offline capability it cannot safely honor would be worse than not having it') stands.

API. Internal API = Next route handlers, every one exported through `withGuard(handler, { min, entitlement })` so the API is default-deny (the middleware still passes /api/* through, but a CI test globs `src/app/api/**/route.ts` and fails on any handler not wrapped — closing the class of bug that shipped GET /api/bytestar unguarded). readJsonRecord gains Content-Type and Sec-Fetch-Site checks. Pagination moves to keyset cursors. Domain events are written to an `outbox` table in the same transaction as the business write; pg-boss workers fan them out to the controls engine, detectors, recall, and webhooks. v2 adds an external REST API (OAuth client credentials per tenant, scoped tokens, webhooks, full-export job) and a FHIR R4 subset once encounters and codes exist.

HOW DENTAL CODE MIGRATES. Verbatim lift into `packages/` and `src/lib/` of the merged repo: auth/{guards, roles, clinicalRoles, approval, throttle, hashGate, clientIp, sessionWatermark, totp, password, resetToken, issueResetLink, freshUser, loginFormState, loginAction}; db/{backend, postgresUrl, int4, repo/auditLog, repo/resetTokens, repo/users (add tenant), repo/drafts (add tenant + encounter), repo/submissions (add tenant + encounter), repo/practicePacks (add CAS)}; http/{readJson, pagination}; export/csv; email/threading; audit/** (engine, types, rules, omissions, killers, maskPhi, attestation, precision harness + clean corpus); vocab/**; modules/**; schema/types; compose/**; standardize/**; extract/**; verify/**; assist/** (behind BAA + field gate); byteaudit/** (re-seal after adding tenant/encounter fields to the contract); client/{autosaveMachine, useAutosave (generic resource URL), draftBackup (encrypted)}; state/noteReducer; tickets/**; scope/authorCapabilities; packs/**; digest/{digest, similarity, filingRollup}; learning/redact.ts (standard redactor for every analytics/support path); law/{tn-law, license-scope} (gain a jurisdiction key); dictation/** (behind the engine seam); components/builder/{NoteForm, AuditPanel, PasteIntake, Odontogram (extended to editable), fields/*}; theme/**, design-tokens.json, docs/brand.md; e2e/*.mjs; .github/workflows/ci.yml version guards. Rewritten: ddl.ts/client.ts bootstrap (drizzle-kit migrations), schema.ts (tenant_id everywhere, new entities), BuilderShell.tsx (decomposed into chart-context panels), middleware matcher (adds portal realm), PHI rule severities re-scoped to outbound paths, ~100 'EDR' strings, ADMIN_PASSWORD_RESET break-glass, SharedTabletIdleLock (server-enforced). Deleted: gamify/gpa/stats/sparkle, requests/gauntlet UI, edr/product.ts, wishes as-is (rebuilt with PHI gate as incident intake), risk/RiskManagement.tsx static content, law/watch.ts as a product feature.

HOW PRECOG CODE MIGRATES. Copied into `packages/controls-engine/` as a pure TypeScript package with zero app imports (enforced by a test the same way byteaudit is): sod/conflict-rules.ts verbatim; sod/detect.ts with `people`/`buildAssignments` replaced by a `RoleAssignment[]` parameter fed from the real users/entitlements tables; controls/dual-release.ts with `personById`/`listEligibleApprovers` taking a repository interface, waive_dual Infinity replaced by a discriminated `unbounded` flag, and policies persisted in `control_policies`; scoring/weights.ts verbatim; scoring/residual-engine.ts with id-substring factor derivation replaced by typed fields on a `ControlRecord` (fraud_opportunity_class, asset_exposure, duty_count, segregated); coso.ts with `assessCoso(state: PracticeControlState)` parameterized; scoring/variable-cascade.ts + dynamic-variables.ts with the timeline sign convention fixed and asserted in one direction (p50 = time to material impact; stronger controls stretch it); ml/leading-indicators.ts renamed `signals/` (it is a weighted threshold composite, not ML); rag/corpus.ts + retrieve.ts as in-product guidance; practice-profile.ts DecisionEntry as the `decision_journal` table shape; threat-scoring.ts deriveRoe() copy retained, target-deck unification retained, military vocabulary removed; coach/context-pack.ts reshaped to send role labels only. Deleted: routes/, components/ (rebuilt as PMS dashboards in the dental design system), lib/auth/**, lib/db.ts, lib/multiplayer/**, llm/{multi-agent, johari-applications, meta-analysis UI, reasoning/* until bugs fixed and tests exist}, demo-data.ts (becomes a test fixture only), map-vision.ts skin, AGENTS.md, scripts/. Golden-value tests are written for every lifted scoring function before the first real transaction flows through it.

## Data model outline

CONVENTIONS. Every table: `id` (uuid v7), `tenant_id` (uuid NOT NULL, RLS), `created_at`, `created_by` (uuid, no FK) plus `created_by_name` (frozen). No user-facing serials: per-tenant `sequences(tenant_id, kind, next)` mint ticket/claim/statement numbers. Money is `amount_cents bigint` + `currency char(3)`. Times are `timestamptz`; frozen local renderings are stored as text alongside, with the zone taken from `locations.timezone`, not hard-coded Eastern. Soft-delete is not used on clinical or financial data; corrections are new rows.

TENANCY & IDENTITY. tenants(name, plan, timezone_default, settings). locations(tenant_id, name, address, timezone, npi, permit registry refs). users(tenant_id, username, email, pass_hash, active, role[admin ladder], clinical_role, mfa_enabled, mfa_secret_enc, password_changed_at, sessions_revoked_at, notice_ack_at, hire_date). sessions(user_id, device_profile, last_seen_at, idle_timeout_s, revoked_at, ip, ua). role_templates(tenant_id, name, entitlements[]) seeded from precog ROLE_TEMPLATES. user_entitlements(user_id, entitlement, granted_by, granted_at) — the 14 precog entitlements are the financial-authority axis; grant/revoke emits an outbox event that re-runs SoD detection. user_locations(user_id, location_id) (ordering; `location_grants` reserved for group tier). credentials(user_id, kind[LA, N2O, restorative, radiography, sedation_permit...], number, expires_at). auth_throttle, password_reset_tokens (lifted).

PATIENTS. patients(tenant_id, mrn per-tenant, name, dob, sex, contact, preferred_language, guardian refs, primary_location_id, status). guarantor_accounts(tenant_id, guarantor_patient_id|external_party) and account_members(account_id, patient_id). patient_alerts(patient_id, kind[allergy, premed, anticoagulant, latex, behavioral, guardianship, financial_hold, critical_note], text, active, entered_by frozen) — surfaced on selection, cannot be collapsed away. medical_history(patient_id, encounter_id, structured fields, reviewed_by, reviewed_at). medications(patient_id, name, dose, route, active). consents(patient_id, encounter_id, kind, decision[agreed|declined|deferred|other_option], consenting_party, relationship, interpreter, questions_text, scope[clinical|marketing]). documents(tenant_id, patient_id, encounter_id, kind, object_key, sha256, mime, size, scanned_at, retention_class). retention_holds(patient_id, reason, placed_by, released_at).

SCHEDULING. operatories(location_id, name, color_token). providers = users with clinical_role; provider_schedules(user_id, location_id, weekday, start, end, effective range). appointment_types(tenant_id, name, default_procedures[], duration, color_token, shape_token). appointments(tenant_id, location_id, operatory_id, patient_id, provider_id, hygienist_id, type_id, starts_at, ends_at, status[scheduled|confirmed|arrived|seated|completed|no_show|cancelled], supervision_level[direct|general|none], supervision_validated_at, eligibility_check_id). recall_rules, recall_due(patient_id, kind, due_on, scheduled_appointment_id). waitlist.

ENCOUNTERS & CLINICAL RECORD. encounters(tenant_id, patient_id, location_id, appointment_id, date_of_service, attending_dentist_id, performing_staff_ids[], kind[exam|hygiene|restorative|emergency|tele|...], status[open|signed|amended], signed_at, signed_by frozen). clinical_note_drafts(encounter_id NOT NULL, owner_id, version, note_state jsonb, selected_module_ids, status, last_submission_id) [from drafts]. clinical_note_revisions (ring, keep 20) [from draft_revisions]. clinical_notes_filed(encounter_id, ticket, note_markdown frozen, audit_report frozen, audit_status, ruleset_version, gpa removed, author frozen, filing_dentist frozen, amends_note_id, amendment_reason_code, attestations jsonb) [from submissions; immutable by REVOKE UPDATE/DELETE + BEFORE UPDATE trigger]. chart_events(patient_id, encounter_id, tooth, surfaces[], kind[condition|procedure|existing|missing|watch], status[existing|planned|completed|referred], cdt_code, material, provider_id, occurred_at, source[manual|note_extract|import]) — append-only; `chart_current` is a materialized view. perio_exams(patient_id, encounter_id, examiner_id, exam_type) and perio_sites(exam_id, tooth, site[6], pd, gm, cal generated, bop, sup, plaque, mobility, furcation, mgj). images(patient_id, encounter_id, tooth refs, modality, dicom_meta jsonb, object_key, interpreted_by, interpretation_text, interpreted_at).

PROCEDURES, PLANS, FEES. cdt_codes(code, description, category, licence_year). fee_schedules(tenant_id, name, carrier_plan_id?, provider_id?) and fee_schedule_items(schedule_id, cdt_code, fee_cents). procedures(tenant_id, patient_id, encounter_id?, treatment_plan_phase_id?, cdt_code, tooth, surfaces[], quadrant, provider_id, status[proposed|planned|accepted|completed|referred|declined], fee_cents, fee_schedule_id, completed_at, chart_event_id). treatment_plans(patient_id, name, presented_at, presented_by, accepted_at, signature_document_id) and treatment_plan_phases(plan_id, ordinal, label). coverage_estimates(procedure_id, coverage_id, est_insurance_cents, est_patient_cents, rule_trace jsonb) — a projection, recomputed, never a ledger row.

INSURANCE. carriers(payer_id, name, edi ids, attachment rules). insurance_plans(carrier_id, group, plan_type, fee_schedule_id, coverage_rules jsonb[category %, deductible, annual max, frequencies, downgrades, waiting periods]). patient_coverage(patient_id, plan_id, ordinal[1|2], subscriber ref, member_id, effective_from, effective_to). eligibility_checks(coverage_id, requested_at, response_270_271 jsonb, benefits_snapshot, status). claims(tenant_id, patient_id, encounter_id, coverage_id, claim_number per-tenant, kind[primary|secondary|preauth], status, total_cents, submitted_at, clearinghouse_id, frozen_837 text). claim_lines(claim_id, procedure_id, cdt_code, tooth, surfaces, fee_cents, narrative). claim_events(claim_id, at, kind[created|scrubbed|rejected|submitted|acknowledged|denied|paid|appealed|closed], payload jsonb, actor frozen) — append-only status history. era_remits(tenant_id, trace_number, payer, total_cents, received_at, raw_835 object_key, posted_at, posting_status) and era_lines(remit_id, claim_id?, claim_line_id?, paid_cents, allowed_cents, adjustment_codes jsonb, matched[auto|manual|unmatched]). edi_enrollments(payer_id, status, submitted_at, active_at).

LEDGER (the readable one). ledger_entries(tenant_id, account_id, patient_id, encounter_id?, procedure_id?, claim_id?, era_line_id?, kind[charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer_out|transfer_in|reversal], amount_cents signed by kind, reason_code_id (FK to reason_codes; REQUIRED for adjustment/write_off/refund/transfer/reversal), reverses_entry_id, posted_at, effective_date, posted_by (uuid) + posted_by_name frozen, approval_request_id? (REQUIRED when the control gate said needs_second), payment_method, processor_ref, memo). payment_allocations(payment_entry_id, charge_entry_id, amount_cents) with a constraint job asserting sum(allocations) = payment amount and each charge never over-allocated. reason_codes(tenant_id, kind, code, label, requires_approval bool, active) — every adjustment type is named and countable. account_balances is a VIEW: patient_due = sum(charges) - sum(allocated patient payments) - sum(adjustments/write-offs) - sum(insurance payments allocated), pending_insurance = sum(open claim expected), estimated_write_off = sum(coverage_estimates.contractual) — three separate numbers, shown as three separate numbers. ledger_explanations is a function returning, for an account, the ordered list of (charge -> its allocations -> its adjustments) that produced the balance: the 'why does this patient owe this' view. statements(account_id, statement_number, period, balance_snapshot, object_key). deposit_batches(location_id, business_date, expected_cents from day sheet, entries[]), bank_accounts, bank_transactions(imported via feed or statement, amount, posted_on, description, external_id), reconciliation_runs(business_date, matched_cents, variance_cents, status, closed_by, closed_at) and reconciliation_matches / reconciliation_variances(reason, resolved_by, resolution_note). Ledger and claim_events and audit tables all get the append-only role treatment.

CONTROLS. control_policies(tenant_id, version, dual_release_policy jsonb [precog DualReleasePolicy], rulebook_version, effective_from, approved_by frozen) — a new row per change, never updated. control_exceptions(policy_id, kind[raise|lower|force|waive], scope fields, amount band, effective window, approved_by, residual_note) [precog ThresholdException]. approval_requests(tenant_id, channel, amount_cents, subject_kind, subject_id, requested_by, eligible_second_roles[], status[pending|approved|declined|expired], decided_by, decided_at, decision_reason REQUIRED on decline, evaluation jsonb [the evaluateRelease verdict frozen]) with compare-and-set transitions. approvals_log append-only. sod_findings(tenant_id, computed_at, rule_id, person_a, person_b, entitlement_a, entitlement_b, severity, score, mitigated_by[], residual_accepted_decision_id, rulebook_version) — recomputed on every entitlement change; history kept. control_findings(tenant_id, detector, severity, subject refs, practice_level bool, window, evidence jsonb, status, decision_id) — outputs of after-hours/refund-threshold/retroactive-edit/duplicate/Benford detectors; person-scoped rows are readable only by the designated reviewer role. controls_registry(tenant_id, control_id, typed factors, segregated, compensating[], owner, monitoring_cadence) [replaces demo controls]. risk_scores(tenant_id, computed_at, subject, inherent, effectiveness, residual, band, drivers jsonb, scoring_version). coso_assessments(tenant_id, computed_at, components jsonb, principles jsonb, overall). decision_journal(tenant_id, subject_kind, subject_id, kind[remediate|accept_residual|monitor|insure], note, review_by, residual_at_decision, scoring_version, decided_by frozen, evidence_document_ids[]) — append-only; a decision is superseded by a new decision, never edited.

AUDIT & EVENTS. audit_log(tenant_id, at, actor_id, actor_name frozen, action (namespaced: auth.*, ledger.*, claim.*, chart.*, control.*, export.*, disclosure.*), target, detail bounded, ip, user_agent, prev_hash, row_hash) — append-only role; nightly verifier recomputes the chain per tenant and writes `audit_chain_checks`. phi_access_log(tenant_id, at, actor_id, patient_id, resource_kind, resource_id, purpose[treatment|payment|operations|break_glass], ip) written by a repo-layer read hook; break-glass reads require a justification string validated by isValidPhiAttestation. disclosures(tenant_id, patient_id, at, channel[print|export|email|fax|portal|sms|clipboard], recipient, actor frozen, document_id) for the accounting-of-disclosures obligation. outbox(tenant_id, event_type, payload, created_at, processed_at) for reliable fan-out to controls, detectors, recall, webhooks. Immutability is enforced three ways: an `app_append_only` Postgres role with REVOKE UPDATE, DELETE on the frozen tables; BEFORE UPDATE/DELETE triggers that RAISE on clinical_notes_filed, ledger_entries, claim_events, approvals_log, decision_journal, audit_log; and the per-row HMAC chain on audit_log so tampering by a superuser is detectable even if not preventable.

## Ux blueprint

INFORMATION ARCHITECTURE. Three top-level workspaces chosen by role, one persistent patient rail, one command palette. (1) Board — schedule by operatory, check-in, recall, waitlist, per-chair documentation status strip. (2) Chart — patient rail + tabs: Overview (alerts, balance in three numbers, last visit, open items), Odontogram, Perio, Notes/Encounters, Images, Treatment Plans, Ledger, Insurance/Claims, Documents. (3) Office — Claims worklist, ERA posting, Day sheet & Reconciliation, Approvals queue, Reports, Practice health (controls/COSO), Settings (roles, fee schedules, reason codes, control policy). The patient rail (Curve Sidekick pattern) is the primary navigation object: select a patient once and every module is one click away, with hover flags for alerts, insurance status, forms, and balance, plus a privacy toggle that hides names for open operatories. A command palette (Cmd/Ctrl-K) jumps to any patient, appointment, claim or report by typed fragment. Nothing lands on a dashboard of cards; each role lands on its work.

HOME SCREEN PER PERSONA. Front desk / coordinator: the Board for today, with the per-chair documentation strip (seated, note open, note signed, checked out — shapes + words, no PHI), an arrivals list with eligibility badge, and a 'ready to check out' queue. Hygienist: the Chart of the seated patient opened straight to Perio if today's appointment type is hygiene, with the prior exam ghosted for comparison and the note pre-scaffolded from the appointment type; dentist-owned sections are collapsed into a single handoff strip, not shown as the hygienist's unfinished homework. Dentist: an Exams-to-sign queue (encounters with hygiene data collected awaiting diagnosis/plan) plus the seated patient's chart; the note opens on Assessment/Plan with killer items hoisted to a 3-row strip. Biller / office manager: the Claims worklist (unsent, scrubber-blocked, rejected, aging >30, unposted ERAs) with counts, then Approvals pending for their role, then Day sheet. Owner: 'Is yesterday reconciled?' as one large shape+word status, open variances, pending approvals that need the owner, open SoD findings, the practice-health score with its top three drivers — every number linking to the rows behind it. No person is ranked anywhere on any screen.

TOP 5 DAILY TASKS, FEWEST CLICKS. (1) Check a patient in with eligibility: Board -> click appointment card -> 'Arrive' (1 click). Eligibility ran automatically on the day's appointments at 6am and re-ran on arrival; the badge shows active/inactive/unknown, the benefits drawer opens with a second click if needed. Forms status and alerts are on the card. (2) Schedule an appointment: Board -> click empty operatory slot -> patient search (type 3 letters) -> pick appointment type (duration and default procedures pre-fill) -> Save: 3 interactions. Supervision validator blocks a hygiene appointment that would violate the supervision rule with one line ('New patient: needs a dentist exam before hygiene') and one control ('Add exam'). (3) Complete a hygiene visit: seat -> Perio tab opens with auto-advance (keyboard 1-9, space for BOP, arrow to skip; 168 sites in one continuous entry) -> 'Save exam' writes the periodontal module fields -> Note shows Fast Lane pack for the visit type -> fill/accept scaffolds -> 'Hand off to dentist' (the transfer rail; the killer strip shows what is still missing). One screen change total. (4) Post payment and check out: Chart -> Ledger -> 'Checkout' opens the encounter's completed procedures with fees and coverage estimates already applied -> patient portion shown -> take card (tokenized terminal) or cash/check -> allocations auto-proposed oldest-charge-first and editable -> 'Post' (3 clicks). Any write-off or adjustment above threshold shows one line and one control: 'Request approval' — the posting is held, not silently allowed. Claims for the encounter are created as a side effect, ready in the worklist. (5) Submit the day's claims and reconcile the day: Office -> Claims -> 'Send all ready' (scrubber has already blocked the ones with missing tooth/surface/narrative, each with a link to the exact field) -> one click. Then Day sheet -> deposit batch totals by method -> Reconciliation compares to imported bank transactions -> matched lines are green squares, variances are amber triangles with a required resolution note -> 'Close day'. The owner sees the closed day the next morning.

HOW 'VERY INTUITIVE' IS ACHIEVED (rules, not adjectives). Home is the work: no landing dashboards. One canonical view per fact: one ledger (no invoice-vs-ledger split), one balance shown as three labeled numbers, the same metric shows the same value on every screen. Structural correctness over user vigilance: notes attach to encounters by foreign key; planned procedures become completed only through encounter completion; impossible surfaces are disabled in the picker; supervision is validated at scheduling. One verb line plus one control at every blocking gate; explanations live behind a disclosure; policy prose never appears on the finish path. Validation is silent until blur or sentence boundary (live only after a field's first error) — no grading mid-sentence. Severity is encoded three ways at once (shape, short word, monotonic luminance) with hue as the third channel, so a deuteranopic biller can rank a queue in grayscale. 44px targets with 8px gaps on every pointer type; glove mode is the default, not a media query. Named omission licences on every required field ('not assessed', 'not applicable', 'unknown') so a blank is never forced into a fabrication and the shortcut is counted. Read-back for high-stakes tokens (tooth, surface, dose, amount, payer) on any bulk or AI-assisted transformation and on migration acceptance. Learnable in a day: role-based first-run tours, a public temp-staff quick start, free self-serve certification, and a search that finds every action by its plain name (the market's #5 must-have, hiring-pool familiarity, is neutralized rather than met). Warm at the edges, calm in the middle: dental's brand doctrine — retro-future geometry in the mark and chrome, never on clinical or financial surfaces. Discoverable acceleration: Fast Lane packs, shortcut charting macros and quick picks are always visible and role-filtered, because the adoption gap identified against Curve was discoverability, not capability.

## Internal controls integration

EVENT FEED. Every business write in the PMS repo layer appends a domain event to the `outbox` table inside its own transaction (role.granted/revoked, user.deactivated, ledger.posted (with kind/amount/reason/poster/after-hours flag), ledger.reversed, claim.submitted/denied/written_off, vendor.created/changed, payment.released, deposit.batched, reconciliation.closed, encounter.signed, chart.event, export.performed, disclosure.recorded, control_policy.changed). pg-boss workers deliver these to the controls-engine package and to detectors. This is the 'live PMS events' feed; the engine never reads demo data and never reads the browser.

SEGREGATION OF DUTIES FROM REAL GRANTS. `user_entitlements` IS the RoleAssignment[] input to precog's detectSodConflicts (parameterized). It runs synchronously on every role.granted/revoked event and nightly; results are written to `sod_findings` with rulebook version and the mitigating dual-release rules currently enabled (mitigatedSodRuleIds from the active control_policy). Where enforced: the role-grant API refuses to grant an entitlement that would create a `critical` conflict unless the actor is the owner and supplies a decision_journal entry (accept_residual with review date) in the same request — the refusal is the control; the journal entry is the documented exception COSO expects. COSO Principle 9 ('assess change') and Principle 11 ('technology general controls') flip from hard-coded weak to continuously monitored because every role change is an observed event.

DUAL RELEASE ENFORCED IN THE TRANSACTION. Every money-moving repo function (postAdjustment, postWriteOff, postRefund, reverseEntry, releaseVendorPayment, createVendor/changeVendorBankDetails, batchDeposit, approvePayrollHours if payroll is integrated) calls `postGuarded(channel, request)` BEFORE writing. postGuarded loads the tenant's active control_policy, runs precog's evaluateRelease with the actor's entitlements and a repository-backed eligible-seconds list, and: on approved_single/below_threshold writes the row; on needs_second/blocked_missing_second inserts an `approval_requests` row with the frozen evaluation, writes NOTHING to the ledger, and returns 202 with one line and one control; on blocked_same_person/blocked_role/blocked_policy_off rolls back and returns 403 with the reasons[] from the verdict. When the second approver approves (compare-and-set on status='pending', distinct-person check re-run server-side), the original posting is executed by the worker with approval_request_id stamped on the ledger row. Exceptions (raise/lower/force/waive) are only creatable by owner-role actors, require a residual note, are date-bounded, and the 'expiring soon' and 'active waivers' summaries appear on the owner home so a temporary raise cannot quietly become permanent. Owner overrides exist (management-override controls) but are themselves ledger-annotated, appear in the owner digest AND in the CPA export, and lower the practice's Control Activities score — they are never silent.

INDEPENDENT RECONCILIATION. `independentBankRec` stops being a self-asserted boolean. It is measured: a reconciliation_run is 'independent' only if closed_by holds no custody/recording entitlement for that day's postings (checked against user_entitlements); detection lag is measured as days between posting and matched bank transaction. Both feed residual-engine's controlEffectiveness (monitoringCadence, independentReconciliation) as measured values, so the residual portfolio and COSO map reflect operating effectiveness, not configuration. Variances that stay open beyond N days raise a control_finding.

DETECTORS (control_findings). Nightly and event-driven jobs over the real tables: refunds above the channel threshold that lack approval_request_id (should be impossible; its presence is a chain-integrity alarm), postings outside location business hours, ledger reversals/adjustments dated more than N days before posted_at (retroactive edits), adjustments by reason code per role trending against the practice baseline, duplicate patient payments, deposit batch vs bank total gaps, void/delete counts on appointments and charges, users with sole ownership of a critical process (SPOF from credentials + entitlements), first/second-digit Benford and round-number screens on adjustments and refunds (framed as 'worth a look' signals). Every finding is practice-level unless a designated reviewer role (owner or an external CPA seat) opens the person-scoped detail; dental's digest rules apply — batched, minimum sample sizes, and SYSTEMIC_SHARE re-scoping so a finding that flags most of the practice is reported as a practice-standard problem with names dropped. No detector output is ever phrased as an accusation.

RESIDUAL RISK, COSO, JOURNAL. controls_registry rows (typed factors) + measured effectiveness + derived StaffComposition (team size from active users, sole-owner count from SPOF detection, tenure from hire_date, segregation score from detectSodConflicts.segregationHealth — the hand-entered fields and their inconsistencies are gone) feed portfolioSummary and assessCoso nightly and on control_policy change, stamped with SCORING_VERSION. Every finding, score and COSO principle carries a DeepLinkTarget to the rows. The decision_journal is the append-only record of remediate/accept/monitor/insure with residual_at_decision, review_by, and evidence documents; review_by dates surface on the owner home when due; the COSO Principle 17 view is literally 'open findings without a decision'.

WHERE CONTROLS ARE ENFORCED (not just recorded): (1) role-grant API refuses critical SoD conflicts without an owner decision; (2) postGuarded refuses or holds write-offs, refunds, adjustments, reversals, vendor changes and payment releases inside the DB transaction; (3) approval decisions require a distinct approver with an eligible role, verified server-side with compare-and-set; (4) reconciliation 'independent' status is computed, not declared; (5) exceptions require owner role, a residual note, and a date; (6) integrations are disabled until a BAA document is on file (v2 compliance module); (7) export/disclosure of ledger or patient lists is gated by the same predicate as the screen and metered; (8) MFA and unique identities are mandatory so the audit trail cannot be defeated by a shared login (the QuickBooks failure mode); (9) immutability of ledger/claim_events/audit/journal is enforced by database role and triggers, with a hash chain for detection. Everything else — scores, heat maps, forecasts, coach — is advisory and says so.

## Roadmap


### Item 1
- **phase**: Phase 0 — Foundation & Repo Surgery
**scope**

Create the merged monorepo from the dental repo. Add tenants/locations, tenant_id on every table, RLS policies, SET LOCAL per transaction, drizzle-kit migrations replacing ddl.ts/SCHEMA_BOOT_VERSION, per-tenant sequences. Lift dental auth stack verbatim and extend: server-side sessions table with idle timeout, MFA mandatory for clinical/financial roles with recovery codes, dual-control break-glass replacing ADMIN_PASSWORD_RESET, encrypted mfa_secret, withGuard() default-deny wrapper + CI route-guard test, Origin/Content-Type checks. Audit log gains ip/ua/hash chain + append-only role + triggers; phi_access_log and disclosures tables and read hook. Lift precog domain layer into packages/controls-engine with demo-data replaced by parameters and golden-value tests for every score; fix timeline sign, counterfactual vars bug, beam status-quo bug, waive_dual Infinity. Container deployment (ECS/Fly) + pg-boss worker + managed Postgres with BAA + S3 with BAA + status page. CI: eslint, npm audit, secret scan, coverage floor, dental e2e probes + postgres-durability in the blocking job, version-stamp guards extended with SCORING_VERSION and CONTROL_RULEBOOK_VERSION. Delete gamify/store/sparkle/gauntlet UI/EDR seam/precog app shell/multiplayer/military skin.

**exit criteria**

Two tenants seeded; an RLS test proves a missing WHERE clause cannot leak rows across tenants; route-guard test passes on 100% of handlers; MFA enrollment forced on first login for a dentist role; audit chain verifier passes and detects a tampered row in test; controls-engine package has zero app imports (enforced by test) and 100% of lifted scoring functions have golden tests; restore-from-backup drill completed and documented; production refuses to boot without POSTGRES_URL, KMS key, and object-storage config.

- **dependencies**: None. Decisions required first: tenancy = shared DB + RLS; hosting = container; auth = NextAuth Credentials + sessions table; BAAs signed with DB, object storage, email/SMS providers.
- **duration estimate**: 6–8 weeks

### Item 2
- **phase**: Phase 1 — Patients, Board, Encounters & Clinical Record
**scope**

patients/accounts/alerts/consents/documents; scheduling (operatories, appointment types, provider schedules, board UI, check-in, supervision validator, recall rules); encounters with structural note attachment; Smile Notes builder integrated into the chart (modules, audit engine, autosave with encrypted mirror, atomic filing, byteaudit re-sealed, addendum chain, PHI rules re-scoped to outbound-only, EDR strings removed, BuilderShell decomposed); editable odontogram with chart_events and planned/completed layers; keyboard-first six-point perio with prior-exam compare; images bridge-and-store with DICOM export; CDT codes, fee schedules, procedures, treatment plans with estimate engine; reason_codes; jurisdiction key on TN rules. Persistent patient rail, role home screens for hygienist/dentist/front desk, glove-first tokens.

**exit criteria**

A design-partner practice runs a full clinical day in parallel with its incumbent PMS: every appointment scheduled and checked in, every hygiene visit perio-charted and noted by one hygienist inside the appointment, every dentist exam signed with killers hard-blocked, every completed procedure on the odontogram; zero notes without an encounter (constraint); chairside median time-to-sign within +20% of the incumbent baseline by week 4; zero wrong-author events on shared tablets; PHI access log records every chart open; usability sessions observed with at least one hygienist and one assistant, not only dentists.

- **dependencies**: Phase 0. ADA CDT licence. A design-partner practice willing to parallel-run (Cornerstone is the obvious candidate).
- **duration estimate**: 10–12 weeks

### Item 3
- **phase**: Phase 2 — Ledger, Payments, Controls Enforcement, Reconciliation
**scope**

Append-only ledger with explicit allocations, reason codes, three-number balance, ledger_explanations view, statements, day sheet, tokenized card processing; property-test suite for dual-coverage and partial-payment allocation written before code; postGuarded() enforcing precog's evaluateRelease inside every money-moving transaction; approval_requests queue with compare-and-set; control_policies/exceptions editor; SoD detection wired to user_entitlements with grant-time refusal; bank statement import (CSV/OFX) + deposit batches + reconciliation runs + variance queue; detectors for after-hours/retroactive/refund-threshold/duplicates; owner home; reports v1 (AR aging split, production, collections vs deposits, adjustments by reason). Practice-health (residual/COSO/decision journal) as owner-only surface if time allows (v1-nice).

**exit criteria**

Design partner posts a full month of patient payments and adjustments; a biller and the practice's CPA independently read the same ledger and agree on every balance in a scripted usability probe; every write-off above threshold in the month has an approval_request_id or was refused; an attempt to grant a critical SoD conflict is refused without an owner decision; 30 consecutive business days reconciled to the bank with variances resolved; zero ledger rows updated or deleted (trigger + role test); allocation property tests green including secondary-insurance and partial-payment cases.

- **dependencies**: Phase 1 (procedures and encounters exist). Payment processor account and BAA/PCI SAQ-A scoping. CPA reviewer engaged for the ledger probe.
- **duration estimate**: 10–12 weeks

### Item 4
- **phase**: Phase 3 — Insurance: Eligibility, Claims, ERA (v1 becomes sellable)
**scope**

Clearinghouse integration (DentalXChange or Vyne): 270/271 eligibility at 6am batch and on arrival, cached benefits drawer; insurance plans/coverage with primary/secondary COB; scrubber rules; 837D generation with frozen claim bytes and atomic claim + claim_events; claims worklist; attachments; pre-auths; 835 ERA import with auto-post through postGuarded (insurance_payment + contractual write-off by reason code), denial worklist linking to encounter/chart; EDI enrollment tracker; secondary claim auto-generation on primary EOB; justification/completeness rules as pre-submission pre-flight. Open Dental importer with conversion cockpit and 'what does not convert' list. Reminders/confirmations via Twilio BAA.

**exit criteria**

Design partner switches OFF the incumbent for billing: 95%+ of claims accepted by the clearinghouse on first submission over 60 days; ERA auto-post rate >= 80% of remit lines with the remainder in a worklist; eligibility available at check-in for >= 90% of insured patients; a second (paying) practice converted from Open Dental with a published fixed price and a signed-off conversion checklist; published rate card, exit/export terms, and status page live; first-line chairside support SLA defined and staffed.

- **dependencies**: Phase 2 (ledger exists for posting). Clearinghouse contract and per-payer EDI enrollment (up to 30 business days — start enrollments in Phase 2). Rate card and pricing decision (one inclusive per-location price, unlimited users).
- **duration estimate**: 10–14 weeks

### Item 5
- **phase**: Phase 4 — Hardening, Compliance Program & GA
**scope**

Security: third-party penetration test, own SOC 2 Type 2 readiness (controls documented; audit period begins), HIPAA Security Risk Analysis performed on the product itself, nonce-based CSP if intake HTML exists, key rotation runbook, incident response drill. Compliance module (SRA questionnaire, tailored policies, training with certificates, BAA registry that gates integrations, incident log with TN/HIPAA clocks, sterilizer log) after counsel review of content. Practice-health surface (residual/COSO/cascade/decision journal) if not shipped in Phase 2. Bank feed via Plaid/Finicity replacing statement import. Two-way texting, online booking, intake forms. Perio voice via on-device Whisper or BAA STT once the WER eval corpus exists. Reporting filter builder and scheduled reports. Dentrix/Eaglesoft CSV+image importers. Marketing that never claims 'HIPAA compliant' as a product property, 'lawsuit-proof', or 'AI-powered'.

**exit criteria**

Pen test findings closed; SOC 2 observation period started; three paying practices live with 90-day retention; published uptime >= 99.9% over the prior quarter with incident post-mortems; compliance content reviewed by TN dental counsel; owner-panel buy gates met (<= 90 min paid training per writer, >= 70% of eligible charts in the product by week 4, median time-to-finish within guardrail); no per-person ranking anywhere (walkout falsifier holds).

- **dependencies**: Phase 3. Counsel review. Auditor engagement for SOC 2.
- **duration estimate**: 10–12 weeks

### Item 6
- **phase**: Phase 5 — Growth Path: Multi-location, API, Portal, eRx, AI
**scope**

Location as authorization boundary with deliberate cross-location grants; consolidated + per-site reporting; org/region pack catalog; SAML/OIDC + SCIM for groups; per-tenant sequences and tenant-salted locks audited under load. Public REST API with OAuth client credentials, webhooks, full-export job, FHIR R4 subset. Patient portal with delivery gate and guardian voice; eRx via certified vendor with medication-safety pre-flight. Caged AI assist behind BAA with field-level minimum-necessary gate and verifyMeaning on every surface (note assist, claim narrative, controls coach with role labels only). Bounded offline capture (queued writes with explicit reconciliation) designed and shipped only if the degraded-mode telemetry shows demand. Native imaging acquisition evaluated as a regulatory project.

- **exit criteria**: First 2–9 location group live with location-scoped access and consolidated reconciliation; API used by at least one external accountant/partner; portal sends gated by plain-language findings; AI assist refusal-rate and drift instrumented with zero PHI in provider logs (verified by redaction test); offline decision recorded in an ADR with measured outage minutes as the input.
- **dependencies**: Phase 4 GA. BAA with model provider and eRx vendor. Group design partner.
- **duration estimate**: ongoing; first group live 12–16 weeks after GA

## Risks and tradeoffs

- Clearinghouse/claims is the #1 buying criterion and the single largest build risk; it is deliberately sequenced third so the ledger it posts into exists first, which means the product is not sellable as a full replacement until roughly month 8–9. Mitigation: start payer EDI enrollments and the clearinghouse contract in Phase 2, and run design-partner pilots in parallel with the incumbent for Phases 1–2.
- Keeping Next.js/NextAuth (dental) over TanStack/better-auth (precog) forgoes better-auth's built-in organizations and session primitives; the trade is made because dental's auth is tested, hardened and running while precog's protects nothing and does not build. Sessions table and tenant scoping are added by hand.
- Shared-database multi-tenancy with RLS is cheaper and faster than database-per-tenant but concentrates blast radius (the Henry Schein pattern). Mitigation: RLS as a mandatory backstop tested in CI, per-tenant sequences, tenant-salted locks, and a documented path to schema-per-tenant for large groups if ever needed.
- Abandoning the hand-rolled SCHEMA_BOOT_VERSION mechanism for drizzle-kit migrations loses a mechanism the owner understands and has CI guards for; it is required because a PMS needs destructive and data-transforming migrations with history. The version-stamp discipline is kept for rules/prompts/scoring.
- The ledger is the signature feature and four incumbents each shipped a ledger their own trained users hate; the observed base rate of success is zero. Mitigation: write the allocation property tests and run the biller-plus-CPA readability probe (RPT D.8 Phase 4 usability protocol) before the ledger UI is considered done, and keep exactly one ledger view.
- Enforcing dual release inside transactions will be experienced as friction the first week (the $150 write-off rule gets disabled at the first practice that finds it annoying). Mitigation: ship precog's scoped, dated, owner-approved exceptions from day one, surface expiring/active waivers on the owner home, and default thresholds per the CPA guidance rather than at zero.
- Re-scoping the PHI rules from 'block filing' to 'outbound boundary only' removes the whole-app de-identification premise that every safety argument in the dental knowledge base rests on. Every 'we hold no PHI' answer must be replaced by a real technical control (tenant isolation, read logging, MFA, encryption, BAAs). This is accepted deliberately and Phase 0 is sized for it.
- Not promising offline in v1 leaves the market's #4 complaint partly unanswered. The trade is honesty over a promise a legal-record system cannot safely honor; read-only degraded mode, durable autosave, a status page and an SLA are shipped instead, and offline capture is a v2 decision driven by measured outage minutes.
- Imaging as bridge-and-store rather than native acquisition means 'X-rays never work' remains a risk on flaky TWAIN bridges and a competitor can claim native imaging. Native acquisition with FDA-cleared measurement is a regulatory project that would sink the MVP timeline; contractual free DICOM export is the differentiator chosen instead.
- Hiring-pool familiarity (Dentrix/Eaglesoft) is a must-have a new entrant structurally cannot meet. Mitigation is design (learnable in a day, free certification, temp quick-start), not a feature; it may still block adoption and is a stated open risk.
- The controls engine's multipliers, healthy priors and insurance discounts are illustrative and self-labelled as such; showing them as anything but directional estimates invites liability for an attorney-owned product. Golden tests pin the math; copy keeps the 'educational, not actuarial' framing until calibrated against real transaction history.
- Precog's forensic suite (Benford etc.) is a README with no code; it is the highest-value control for a system holding real ledger data and also the one most easily misread as an accusation. It ships in Phase 2 as practice-level 'signals' with the no-accusation framing enforced in copy and in the person-scoped access restriction.
- TN-only legal content (supervision, CSMD, teledentistry, retention) is hard-coded and limits commercial reach to Tennessee at launch. A jurisdiction key is added in Phase 1, but per-state content is a legal-research cost outside the engineering roadmap; sell in TN first.
- Third-party LLM egress is a live competitive attack line and a PHI risk; AI is sequenced to v2 behind a BAA and a field-level gate, which cedes the 'ambient AI' hype lane to incumbents in the short term. The deterministic engine is the moat; that trade is accepted.
- Solo-owner development capacity: the phase durations assume one primary developer with AI assistance plus contracted help for clearinghouse integration and pen testing; slippage compounds because Phases 2 and 3 are sequential by necessity. The durations are estimates, not commitments, and each phase has an exit criterion rather than a date.
- The design-partner practice (likely Cornerstone) is a three-location, ~30-staff practice — larger than the 1–3 dentist target. Its complexity is useful for testing SoD and multi-location seams early but risks pulling scope toward group features before the solo-practice core is proven. Pilot with one location first.
- SOC 2 Type 2 requires an observation period and cannot exist at launch; early buyers will be asked to trust a pen test, a documented SRA and a published incident policy instead. This is a real sales handicap for roughly a year.

## What to drop

- Points economy, clinic store, badges, ranks, GPA and rollingGpa (dental src/lib/gamify/**, src/lib/gpa/**, store routes, points_ledger/store_items/redemptions tables) — a staff currency redeemable for value with single-role approval is a segregation-of-duties finding the product would flag in its own customer; extract the append-only ledger pattern first, then delete.
- Sparkle mascot and character set on clinical/financial surfaces (dental src/lib/stats/sparkle.ts, 18 call sites, public/characters) — keep the seeded-deterministic copy technique and the ethics test; retire the character to marketing/pediatric portal material at most.
- Data Hygiene Gauntlet as a customer-facing screen (dental src/lib/requests/gauntlet.ts, GauntletForm.tsx, /requests) — keep the five cycles as internal engineering process prose.
- EDR paste-target abstraction and everything premised on it (dental src/lib/edr/product.ts, edrProductName in copy, 'identifiers live in the EDR' strings, Copy-for-Curve clipboard as primary egress, plaintext .md download fallback, CORPORATE_EMAIL note export via Resend) — the merged product IS the record; export is a logged disclosure through in-app signed downloads.
- Whole-app de-identification premise as a compliance story, including PHI S0 blocking of legitimate identifiers in the record and the attested override-as-waiver flow for in-record names/dates — replaced by outbound boundary gates and real access controls.
- ADMIN_PASSWORD_RESET environment-variable break-glass and the default-off MFA feature flag (dental mfaFeature.ts) — replaced by mandatory MFA with recovery codes and a dual-control one-shot recovery path.
- Hand-rolled SCHEMA_BOOT_VERSION + idempotent DDL array (dental src/lib/db/ddl.ts) and the stale drizzle/0000_init.sql — replaced by drizzle-kit migrations with history.
- Unencrypted IndexedDB/localStorage draft mirror as shipped (dental src/lib/client/draftBackup.ts) — rebuilt encrypted with a session-derived key and a shared-device profile that disables it.
- Law-watch as a product feature (dental src/lib/law/watch.ts, weekly cron) — TN-only keyword-presence scraping with no test; keep as an internal ops script if at all.
- Static provisional risk-management page with localStorage checklists (dental src/components/risk/RiskManagement.tsx) — replaced by the precog-derived controls surface and server-side attestations.
- Persona agents' IQ and generation fields (dental src/lib/training/persona-agents.ts) — keep archetypes as internal test fixtures with those fields removed.
- The entire precog application shell: TanStack Start routes, components, better-auth wiring, Kysely/PGLite db.ts, localStorage practice-context, Grok Build AGENTS.md, scripts, vite plugins, the committed PREVIEW_CLIENT_SECRET (rotate and never carry the git history forward).
- precog src/lib/multiplayer/** (dead WebRTC), Predator/Terminator vision modes and all military vocabulary (map-vision.ts skin, threat-assessment page, WHITE HOT/AO/ROE labels), Johari panel, meta-analysis UI (keep its gap list as a backlog document), advanced-reasoning panel as a user-facing screen, the 'multi-agent' and 'agent loop' framing, and the 'ml/' directory name (rename to signals).
- Grok/xAI as the LLM provider and auth.grok.me as identity — neither will sign a BAA.
- Dental's single fixed Cornerstone identity in code (src/lib/practice/config.ts with real addresses) — becomes tenant seed data.
- Per-use AI metering as a pricing model, and any marketing claim of 'HIPAA compliant' as a product property, 'lawsuit-proof', 'board-proof', 'AI-powered', or indemnity ROI.
- Any per-person ranking, leaderboard, letter grade, andon wall, or 'top writer' digest — including as temporary engagement experiments.
