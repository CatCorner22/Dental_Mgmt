# Design lens 3: domain-data-model

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 11 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, domain-data-model

## Summary

A cloud dental practice management system for independent and small-group general practices (1-9 locations, 5-40 staff), sold to the owner-dentist but designed for the office manager, biller and hygienist who live in it. It replaces Dentrix/Eaglesoft/Open Dent…

## Lens

domain-data-model

## Product vision

A cloud dental practice management system for independent and small-group general practices (1-9 locations, 5-40 staff), sold to the owner-dentist but designed for the office manager, biller and hygienist who live in it. It replaces Dentrix/Eaglesoft/Open Dental/Curve for scheduling, charting, notes, treatment planning, ledger, insurance/claims and imaging, and replaces the separate HIPAA/OSHA compliance subscription (Abyde, Patient Protect) and the bookkeeper-only fraud controls (Zeldent, Prosperident checklists). It wins on one structural idea the incumbents cannot retrofit: the ledger is a double-entry, append-only journal whose every balance is a sum over visible, reason-coded, approver-attributed entries, and the internal-controls engine (Precog's SoD rulebook, dual-release policy, COSO assessment) consumes the PMS's own event stream and role grants, so controls are ENFORCED inside the posting transaction rather than recorded in a questionnaire. Add Smile Notes' deterministic clinical-note engine (odontogram readback, ADA notation, medication-safety and completeness rules, PHI-gated AI), published pricing and exit terms, and a bank-to-ledger reconciliation the owner can read in one screen, and the product answers the three findings the market research ranks highest: insurance workflow is the daily test, no ledger is readable after dual coverage and partial payments, and only 17% of dental embezzlement is caught by designed controls.

## Guiding principles

- The ledger is a journal, not a balance. Balances are never stored; they are sums over append-only, balanced journal entries. Corrections are reversing entries that stay visible. This is the single design decision that makes the money readable by a biller and auditable by an owner (report A.6.1 #5, C.2).
- Every state change emits a domain event in the same transaction (transactional outbox). The audit log, PHI access log, controls engine, anomaly detectors and notifications are all consumers of that stream; nothing is logged by convention at call sites.
- Controls are enforced where money moves, not recorded where it is described. evaluateRelease() runs server-side inside the posting transaction and can refuse; SoD detection runs on real role grants, not a questionnaire (report B.4 'recorded vs enforced').
- Frozen attribution everywhere: any actor or place name that appears on a record is snapshotted at write time with no FK dependency, so a rename, merge or deletion can never rewrite history (dental schema.ts convention; mergeUsers never re-attributes filed submissions).
- Structural attachment beats labels: a clinical note has a NOT NULL encounter FK, a charge has a NOT NULL procedure FK, an allocation has payment and procedure FKs. The Curve failure where a 'Clinical History' tag does not actually attach to the visit cannot occur.
- Estimates never enter the ledger. Insurance estimates, PPO write-off estimates and expected patient portion live on the treatment plan and the claim; only actual charges, payments, adjustments and reversals post. AR is split by GL account (patient AR, primary insurance AR, secondary insurance AR, unapplied credit) so 'estimated write-offs' can never contaminate a balance (Oryx complaint).
- Tenant on every row, RLS as the backstop. tenant_id is a column on every table, every index and every advisory-lock key; Postgres row-level security keyed on SET LOCAL app.tenant_id catches the missing WHERE clause. Location is an authorization axis for financial and roster data, and a provenance stamp on encounters.
- Default-deny API. Every route handler and server action passes through one guard wrapper that resolves session, fresh user row, tenant, location scope and clinical role, sets the RLS context, and writes the PHI read log. A CI test globs route files and fails on any handler outside the wrapper (the bytestar unguarded-GET post-mortem must not recur).
- Two authorization axes plus a third: administrative rank (dental roles.ts), clinical licence scope (dental clinicalRoles.ts), and financial entitlement (precog ENTITLEMENTS). Segregation of duties is a query over the third axis.
- Refuse rather than score, and never rank people. No confidence percentages on clinical output, no letter grades on chairside surfaces, no peer scoreboards; person-scoped control signals go to the owner and the coach only, and any finding that flags most of the practice is re-scoped to the practice (digest SYSTEMIC_SHARE rule).
- Server authoritative, client advisory. The audit engine, gates, licence tiers, attestations and approval verdicts are all re-derived on the server from fresh database rows; the client copy exists for latency only.
- PHI leaves the tenant only through named, BAA-gated, logged egress. The Smile Notes PHI gate inverts from 'the app holds no PHI' to 'this field may cross this boundary'; a connector or AI provider is disabled until a countersigned BAA row exists.
- Publish the price, the exit terms, the uptime and the SLA. These are product decisions, not builds (report D.5), and they are the cheapest differentiation in the category.
- Hard-won reliability rails ship as product features: refuse to boot without a real database, without TLS, without encryption keys, without a backup target; refuse to run an ephemeral database in production (dental backend.ts pattern extended).
- Versioned rules, versioned scoring, versioned schema, all stamped onto the records they produced (RULESET_VERSION, SCORING_VERSION, migration id), with CI guards that fail an unbumped change.

## Modules


### Item 1
- **name**: Identity, Tenancy and Authorization
- **purpose**: Tenants (practice organizations), locations, users, server-side sessions with idle timeout, mandatory TOTP MFA with recovery codes, role grants scoped by location, clinical licence scope, credential registry with expiries, and the single default-deny guard wrapper that sets RLS context and writes PHI access rows.
**reuse from**

/home/user/catcorner22/dental/src/lib/auth/guards.ts (pattern), roles.ts (verbatim, rename roles), clinicalRoles.ts, approval.ts, throttle.ts, hashGate.ts, clientIp.ts, sessionWatermark.ts, totp.ts, password.ts, resetToken.ts, issueResetLink.ts, loginFormState.ts, freshUser.ts, mfaFeature.ts (invert default), /home/user/catcorner22/dental/src/lib/db/repo/users.ts (isCreatureOf, mergeUsers, last-admin guard), /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts (Fetch-Metadata same-site check as a pattern only), /home/user/catcorner22/precog/src/lib/precog/sod/detect.ts ROLE_TEMPLATES as default PMS roles

- **build new**: tenant, location, user_role_grant(role, location_id nullable=all), staff_credential(kind, number, expires_at), session table (server-side, idle 15 min operatory profile, absolute 12h), recovery codes, break-glass dual-control unlock replacing ADMIN_PASSWORD_RESET, withTenantGuard() wrapper, RLS policies, CI route-guard test, CSRF Origin/Sec-Fetch-Site check
- **priority**: v1-core
- **ux notes**: Role set at provisioning, never day-of (temp recruiter panel). Shared operatory device profile: badge/PIN author switch that wipes local cache, 10-min idle lock that actually kills the session cookie. 'Nobody at the practice can see or set your password' preserved as a product promise.

### Item 2
- **name**: Patient and Account
- **purpose**: Patient demographics, guardians and responsible parties, family/guarantor billing accounts, critical alerts (allergy, premed, anticoagulant, latex, behavioral, financial hold), recall status, consent scopes, and the persistent patient rail that every other module hangs off.
- **reuse from**: new; PHI field detection from /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts becomes the outbound-boundary classifier; masking from maskPhi.ts for de-identified exports
- **build new**: patient, patient_alert (always-visible channel), patient_relationship, account (guarantor; many patients), account_member, patient merge with frozen history, privacy mode for open operatories, per-tenant envelope encryption for SSN/member-id columns
- **priority**: v1-core
- **ux notes**: Curve Sidekick pattern: one patient selection, persistent rail with Appointments/Insurance/Recare/Balance/Alerts, 1-2 clicks to any module. Critical alerts cannot be collapsed. Two-identifier confirmation becomes a real technical control because the PMS owns the chart.

### Item 3
- **name**: Scheduling
- **purpose**: Appointments, operatories, provider schedule templates, appointment types with colors, supervision-level validation (TN general vs direct), recall and ASAP lists, confirmations, coordinator board with per-chair documentation status.
- **reuse from**: /home/user/catcorner22/dental/src/lib/law/license-scope.ts and src/lib/audit/rules/supervision.ts (effective-dated PC1107 rule) as a scheduling constraint; color/shape rules from /home/user/catcorner22/dental/docs/design-tokens.md and knowledge/sources/color-theory-uiux.md
- **build new**: appointment (state machine: scheduled, confirmed, arrived, seated, completed, no_show, cancelled), appointment_procedure (planned CDT lines), operatory, schedule_template, recall, waitlist, supervision validation at booking (provider presence, last exam date, delegated act)
- **priority**: v1-core
- **ux notes**: The board is the front desk's front door. Color by appointment type with shape+word redundancy for CVD. Documentation-status strip per chair with no PHI leak across the desk (front-desk panel fix).

### Item 4
- **name**: Encounter and Clinical Notes
- **purpose**: The encounter is the anchor for all clinical documents (location, DOS, attending provider, supervising dentist). Notes are Smile Notes modules attached to an encounter by NOT NULL FK, audited by the deterministic engine, signed with frozen artifacts and RULESET_VERSION, amended only by linked addenda.
**reuse from**

/home/user/catcorner22/dental/src/lib/schema/types.ts, src/lib/modules/* (all 33), src/lib/vocab/*, src/lib/audit/engine.ts and rules/*, src/lib/audit/omissions.ts, attestation.ts, src/lib/compose/composeNote.ts, src/lib/standardize/*, src/lib/extract/*, src/lib/readback/readbackClass.ts, src/components/builder/NoteForm.tsx, AuditPanel.tsx, PasteIntake.tsx, fields/*, src/lib/db/repo/submissions.ts fileSubmissionAtomic (becomes signNoteAtomic), src/lib/client/autosaveMachine.ts + useAutosave.ts, src/lib/db/repo/drafts.ts OCC + revision ring, skill/assets/dental-note-templates.md as the normative spec

**build new**

encounter, clinical_note (encounter_id NOT NULL, note_state jsonb, status draft/signed/amended, frozen note_markdown/audit_report/ruleset_version, entry_author, clinical_performer, reviewing_dentist as three identities), note_amendment (amends_note_id, reason_code), module schema migration registry (field-id deprecation map + round-trip test), decomposition of BuilderShell.tsx (2,127 LOC) into shell/state/gates/export, PHI rules re-scoped from S0 block to boundary-only, jurisdiction parameter on TN rules

- **priority**: v1-core
- **ux notes**: Home is the note. Prose and structured fields coexist; named omission licences on every required field; killer items hard-block signing with one verb line and one control; procedure mode where the caret is never stolen; 44px targets on all pointer types.

### Item 5
- **name**: Chart of Record (Odontogram) and Procedure Log
- **purpose**: Per-tooth, per-surface conditions with existing/planned/completed status and effective dates; the performed-procedure log with CDT code, teeth, surfaces, provider, fee and encounter; painting gestures that propagate one gesture into plan, note and charge.
- **reuse from**: /home/user/catcorner22/dental/src/lib/vocab/teeth.ts (verbatim), vocab/surfaces.ts, src/lib/extract/chart.ts (chartMarks, CONTRADICTORY_PAIRS), src/components/builder/Odontogram.tsx (glyph geometry and paint policy; becomes editable), fields/ToothPicker.tsx, SurfacePicker.tsx, src/lib/audit/rules/anatomy.ts (wrong-site guard), rules/justification.ts (narrative supports the code)
**build new**

tooth_condition (patient, tooth, surfaces[], condition_code, status, source_encounter, recorded_by frozen, effective_at), procedure (encounter, patient, provider, cdt_code, teeth, surfaces, quadrant, fee_cents, status per PROCEDURE_STATES, treatment_plan_item_id, charge_entry_id), cdt_code reference table (licensed CDT content loaded per tenant, not redistributed), shortcut macros (multi-tooth/multi-code), cross-surface contradiction as a blocking finding (odontogram vs note vs claim)

- **priority**: v1-core
- **ux notes**: Charting is a painting gesture with macro buttons; anatomically impossible surfaces disabled at the control; FDI shown as secondary display only; severity colors never used on the chart.

### Item 6
- **name**: Periodontal Charting
- **purpose**: Six-site full-mouth perio exam completable by one operator inside a hygiene appointment: pocket depth, recession/CAL, BOP, suppuration, mobility, furcation, plaque; prior-visit delta; voice entry with confirmation.
- **reuse from**: /home/user/catcorner22/dental/src/lib/dictation/engine.ts (DictationEngine seam), normalize.ts, availability.ts, enrollment.ts; modules/periodontal.ts summary fields become derived from the exam; docs/voice-dictation-architecture.md phases
- **build new**: perio_exam (encounter, examiner), perio_site (exam, tooth, site 1-6, pd_mm, gm_mm, bop, sup, plaque), perio_tooth (mobility, furcation), auto-advance grammar, on-device Whisper engine (Phase 2) or BAA STT before PHI audio, delta view, SRP justification auto-check against justification.ts
- **priority**: v1-core
- **ux notes**: Top-3 unmet need (60% skip full-mouth perio when behind). Voice with audible readback of the READBACK_CLASS tokens, undo-by-voice, foot-pedal fallback, completion target under 8 minutes measured in pilot.

### Item 7
- **name**: Treatment Planning
- **purpose**: Multiple concurrent plans per patient with phases, per-item CDT/tooth/provider/fee, insurance and patient estimates, presentation and acceptance capture; conversion to encounter procedures gated on a human individualizing the note.
- **reuse from**: PROCEDURE_STATES from /home/user/catcorner22/dental/src/lib/modules/shared.ts; consent decision enum from skill/references/terminology-and-style.md
- **build new**: treatment_plan, treatment_plan_phase, treatment_plan_item (estimates only, never ledger), case_presentation (presented_by, accepted/declined/deferred, patient questions), plan-to-procedure conversion with completeness gate
- **priority**: v1-core
- **ux notes**: Curve Treatment Plan Cards pattern with money on the plan surface, kept out of the clinical note surface. Checkout auto-conversion is gated, not automatic.

### Item 8
- **name**: Ledger and Payments
- **purpose**: Double-entry, append-only patient/insurance AR with explicit allocation, visible unapplied credit, reason-coded and approval-gated adjustments, reversals instead of edits, statements, day sheet, deposits and tokenized card processing.
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts (append-only ledger, sum balances, partial unique index idempotency, pg_advisory_xact_lock spend serialization, refund-by-append), repo/submissions.ts fileSubmissionAtomic (claim+freeze in one tx), src/lib/export/csv.ts, src/lib/http/*, frozen-attribution convention from schema.ts
- **build new**: journal_entry, journal_line, gl_account, payment_allocation, reason_code (controlled list), deposit, deposit_line, statement (frozen render), day_sheet view, balance-explainer query, property-test suite over invariants (balanced entries, allocation <= payment, no UPDATE/DELETE), processor integration via hosted fields (PCI SAQ-A), per-account advisory lock salted by tenant
- **priority**: v1-core
- **ux notes**: Signature feature. Patient ledger shows DOS-grouped itemized view AND running balance, toggleable; every line drills to its entry, reversal chain and approver. 'Explain this balance' renders a plain-language sentence for the front desk. Post-payment is the reversible teal action; post-adjustment is the record-committing navy action.

### Item 9
- **name**: Insurance, Eligibility and Claims
- **purpose**: Payers, plans, fee schedules per plan per provider, coverage with primary/secondary rank, real-time eligibility snapshots, claim scrubber, 837D submission via clearinghouse, claim tracker, 835/ERA auto-posting with line-item match, automatic secondary claims, denials and appeals.
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts and completeness.ts as the claim-narrative pre-flight; src/lib/verify/verifyMeaning.ts governs any AI-drafted narrative
- **build new**: payer, insurance_plan, fee_schedule, fee_schedule_line, coverage (rank, effective dates), eligibility_check (frozen response), claim (state machine), claim_line, claim_attachment, preauthorization, era_file, era_payment, era_line (CARC/RARC), scrubber rule set, clearinghouse adapter interface (DentalXChange/Vyne first), secondary auto-generation with primary EOB, denial worklist
- **priority**: v1-core
- **ux notes**: Ranked #1 must-have. Eligibility at booking and check-in, not a PDF. Claims tracker shows age/status/next action. ERA posting is a review-then-post batch with unmatched lines surfaced, never silent. Checkout closes in one screen.

### Item 10
- **name**: Event Stream, Audit and PHI Access Log
- **purpose**: Transactional outbox of every domain event, hash-chained and append-only, plus a separate high-volume PHI read log with purpose and break-glass flag; the single source for compliance review, anomaly detection and the controls engine.
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts (bounded writes, marked truncation, frozen actor, no unknown-username logging, security filter), src/lib/db/repo/practicePacks.ts event-log shape (from/to version, diffJson, decisionNote), src/lib/byteaudit/ seal pattern for tamper-evidence of the verifier itself
- **build new**: domain_event (tenant, occurred_at, actor frozen, ip, user_agent, aggregate_type/id, event_type, payload codes-only, prev_hash, hash), phi_access_log partitioned monthly, REVOKE UPDATE/DELETE via append-only role, nightly chain verification job, WORM export (S3 Object Lock), plain-sentence audit rendering (Annex 11 style), 6-year retention with legal hold
- **priority**: v1-core
- **ux notes**: Owner sees 'who looked at whom' and 'who changed what' in plain sentences; monthly review is itself an audited act.

### Item 11
- **name**: Internal Controls Engine (Precog)
- **purpose**: Segregation-of-duties detection from live role grants, dual-release approval enforced in the posting path, threshold exceptions, residual-risk scoring with drivers, COSO 17-principle assessment from live state, leading indicators, decision journal, and anomaly alerts over the event stream.
**reuse from**

/home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts (verbatim), sod/detect.ts (remove demo-data import, feed RoleAssignment[] from user_role_grant), controls/dual-release.ts (remove people import; evaluateRelease, matchExceptions, resolveEffectiveThreshold, mitigatedSodRuleIds), scoring/weights.ts, scoring/residual-engine.ts (parameterize; replace id-substring factors with typed control fields), coso.ts (parameterize assessCoso), scoring/dynamic-variables.ts, scoring/variable-cascade.ts, ml/leading-indicators.ts (rename signals), practice-profile.ts DecisionEntry, rag/corpus.ts, components/precog/sod-panel, dual-release-panel, residual-radar, coso-heatmap, decision-journal, cascade-panel (port to Next); dental digest SYSTEMIC_SHARE rule from src/lib/digest/digest.ts; similarity.ts copy-forward discriminator

**build new**

role_entitlement_map, control_policy (versioned dual-release policy per tenant), approval_request, approval_decision, control_exception, sod_finding, risk_decision (server-side, append-only), control_assessment_snapshot (scoring_version), anomaly_alert (after-hours posting, retroactive edit, refund over threshold, void velocity, adjustment ratio per user, deposit variance), derived StaffComposition from roster, golden and property tests, fix timeline sign bug, counterfactual vars bug, beam-search status-quo bug

- **priority**: v1-core
- **ux notes**: Neutral vocabulary (drop Predator/Terminator/WHITE HOT). Three verbs: remediate / compensate / accept-on-purpose. Every score shows its drivers and a deep link to evidence. Never labels a person as a threat; person-scoped signals visible to owner and coach only.

### Item 12
- **name**: Bank Reconciliation
- **purpose**: Daily ledger-to-deposit-to-bank comparison performed against data the PMS did not generate (bank feed or statement import), with a variance queue the owner must clear and a reason on every clearance.
- **reuse from**: Zeldent thesis from the knowledge base (the bank is the only independent ground truth); anomaly patterns from precog leading indicators
- **build new**: bank_account, bank_transaction (Plaid/Finicity feed or OFX/CSV import), reconciliation_match (deposit <-> bank_transaction, status, variance_cents), variance_clearance (reason_code, cleared_by frozen), SoD rule: the person posting payments cannot clear variances
- **priority**: v1-core
- **ux notes**: One owner screen: yesterday's production -> collections -> adjustments -> deposits -> bank, with every arrow drillable. This is the report that reconciles to the bank (must-have #10, argued up).

### Item 13
- **name**: Documents and Imaging
- **purpose**: Object storage for scanned consents, EOBs, letters and images with DICOM metadata, signed URLs, virus scan, retention class, and interpretation linked to the encounter; native viewer and DICOM export in v2.
- **reuse from**: skill/references/sedation-and-imaging.md universal imaging record and per-structure status enum
- **build new**: document (object_key, kind, phi, retention_class), imaging_study, image (DICOM tags, sensor), image_interpretation (encounter, dentist, per-structure status), bridge adapters to existing sensor software first, one-click full-history DICOM export
- **priority**: v1-nice
- **ux notes**: Images live in the chart, not in an 'image path'. Export is contractual and free.

### Item 14
- **name**: Compliance Program (HIPAA/OSHA)
- **purpose**: Guided security risk analysis producing tailored policies and remediation tasks, BAA registry that gates integrations, training with certificates, sterilizer biological-monitoring log, incident intake, records-request export within ten working days, retention clocks and legal hold.
**reuse from**

/home/user/catcorner22/dental/knowledge/sources/adversarial-it-hipaa-security.md and adversarial-privacy-hipaa-attorney-hate.md as acceptance criteria; skill/references/tennessee-dental-law-summary.md retention and records rules; src/lib/wishes/wishes.ts as the low-friction incident/observation intake (with PHI gate and tenant scoping added); src/lib/requests/gauntlet.ts pure cycles as internal change governance only

- **build new**: compliance_task, policy_document (versioned, generated), baa (vendor, signed_at, controls named, gates connector enablement), training_record, sterilizer_log, incident, records_request (SLA clock, full-record export not summary), retention_policy, legal_hold
- **priority**: v1-nice
- **ux notes**: Same interactive loop as Abyde/SmarterRisk: question -> score -> tailored tasks -> tracked remediation -> evidence report. Provisional content is labelled provisional.

### Item 15
- **name**: AI Assist (caged)
- **purpose**: Optional, BAA-gated LLM assistance for note normalization, SOAP structuring, extraction, claim-narrative drafting and the controls coach, every output verified deterministically and pinned to evidence; field-level PHI boundary decides what may leave the tenant.
- **reuse from**: /home/user/catcorner22/dental/src/lib/assist/service.ts, tier.ts, prompts.ts, extraction.ts, drift.ts, non-goals.ts, src/lib/verify/*, src/lib/audit/rules/phi-secondary.ts (additive-only merge), src/lib/bytestar/{config,escape,ladder,one-way,router}.ts (cage); precog coach/context-pack.ts and agent-loop.ts local deterministic path (drop the Grok fetch; names replaced by role labels)
- **build new**: provider adapter behind a BAA row, field-level egress classifier, per-tenant opt-in, inference cost in base price (no per-use metering), retire ambient-dictation non-goal only when on-device or BAA STT exists
- **priority**: v1-nice
- **ux notes**: Refuse, do not score. Every AI clinical fact carries a verbatim source span and requires individual acceptance.

### Item 16
- **name**: Reporting
- **purpose**: Curated canned reports (production, collections, AR aging by GL account, adjustments by reason and user, claims aging, recall, schedule utilization) that reconcile to the ledger and the bank, with a visual filter builder and scheduled delivery.
- **reuse from**: /home/user/catcorner22/dental/src/lib/export/csv.ts, src/app/api/export/[table]/route.ts (authorization mirrors the screen), src/lib/stats/computeStats.ts ops metrics (time to sign, after-hours rate)
- **build new**: report definitions as SQL views over journal and events, saved filters, scheduled exports, practice-level-only staff metrics
- **priority**: v1-nice
- **ux notes**: Every number on every screen comes from the same view so totals never disagree (Ascend 77% negative on reporting).

### Item 17
- **name**: Migration and Interop
- **purpose**: Conversion tooling from Open Dental first (MySQL, documented), then Dentrix/Eaglesoft; documented non-converting items; EDI re-enrollment run for the practice; documented REST API with webhooks; FHIR export once codes and encounter ids exist.
- **reuse from**: /home/user/catcorner22/dental/src/lib/edr/product.ts inverted into an interop source label; src/components/builder/PasteIntake.tsx pattern for human-reviewed legacy note import; src/lib/extract/* for legacy prose to structured facts
- **build new**: import pipelines with dry-run diff, imaging conversion path, published fixed price and timeline, API keys and webhooks over domain_event
- **priority**: v2
- **ux notes**: Migration is a product feature with a status page, not a services engagement.

### Item 18
- **name**: Patient Portal and Communications
- **purpose**: Two-way texting, reminders, online booking, digital intake writing into the chart, statements and payments online, plain-language visit summaries gated for portal delivery.
- **reuse from**: /home/user/catcorner22/dental/src/lib/vocab/plain-language.ts, audience:'patient' field marker, audit plain-language and stigma rules, src/lib/email/threading.ts (random ticket threading, header-injection-safe)
- **build new**: message, conversation, reminder schedule, intake_form, portal identity, portal-delivery gate (open plain-language findings block send)
- **priority**: v2
- **ux notes**: Guardian-addressed phrasing for minors; stigma escalates to blocking when audience is patient.

### Item 19
- **name**: ePrescribing and Medication Safety
- **purpose**: Medication list, allergies, interaction flagging, EPCS via a certified vendor, TN CSMD/PMP check documentation.
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/medication-safety.ts (12 curated interactions, kg rule, dose reconciliation, opioid gate), vocab/abbreviations.ts do-not-use list
- **build new**: medication, allergy, prescription, eRx vendor adapter (DoseSpot/DrFirst), per-state PMP rule switch
- **priority**: v2
- **ux notes**: Flags, never prescribes or computes a dose.

### Item 20
- **name**: Points Economy, Store, Mascot, Gauntlet UI, Threat/Johari/Meta-analysis panels
- **purpose**: Retired. The points-redeemable-for-value economy approved by a single lead is itself a segregation-of-duties finding; the tactical skin and epistemology panels are the wrong register for a clinical buyer; the five-cycle Gauntlet is engineering governance, not a customer form.
- **reuse from**: /home/user/catcorner22/dental/src/lib/gamify/*, src/lib/stats/sparkle.ts, src/components/requests/GauntletForm.tsx, /home/user/catcorner22/precog/src/lib/precog/threat-scoring.ts, map-vision.ts, llm/johari-applications.ts, llm/meta-analysis.ts (content extracted to the integration backlog only)
- **build new**: nothing; keep sparkle's deterministic seeded-copy mechanism and ethics tests for empty/confirmation states without the character
- **priority**: drop
- **ux notes**: Meta-analysis known-unknowns list becomes the data-feed onboarding checklist that raises assessment confidence.

## Architecture

STACK. Next.js 15 / React 19 / TypeScript monorepo (pnpm workspaces) carrying forward the dental repo's hardened runtime; TanStack Start, better-auth, Kysely and the Grok sandbox scaffolding are retired. Reason: the dental auth, throttle, session-watermark, header and reliability code is production-grade and tested (201 test files, e2e probes), while precog's domain layer is pure TypeScript with zero framework coupling and lifts either way; only precog's auth/db/multiplayer are framework-bound and none of it is wired. Auth stays NextAuth v5 Credentials + TOTP, extended with a server-side `session` table (idle timeout, per-device revocation, operatory profile) and the existing watermark kept as belt-and-braces; MFA becomes mandatory with recovery codes and a dual-control break-glass (two admins) replacing ADMIN_PASSWORD_RESET. Drizzle ORM over Postgres remains; PGlite remains for unit tests and the browser-side encrypted read cache.

DATABASE AND TENANCY. One Postgres cluster (Neon or RDS; sslmode pinned to verify-full by /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts), shared-schema multi-tenancy: `tenant_id uuid NOT NULL` on every table, in every unique constraint and index, and salted into every advisory-lock key (the FNV pattern from gamify.ts userSpendLockKey; the global ADMIN_GUARD_LOCK constant is replaced). Row-level security is enabled on every table with policies keyed on `current_setting('app.tenant_id')`; the application connects as a non-owner role so RLS is not bypassable, and a separate append-only role owns journal, domain_event and phi_access_log with UPDATE/DELETE revoked and BEFORE UPDATE/DELETE triggers as a second lock. Field-level envelope encryption (KMS data key per tenant, AES-GCM) for SSN, insurance member ids, TOTP secrets, bank account numbers and portal credentials; DOB and names stay in cleartext columns because they must be searched, protected by RLS, disk encryption and the PHI access log. Identifiers are UUIDv7 (time-ordered, opaque) — serial ints and DN-0001-style tickets are dropped because they leak cross-tenant volume. Money is `bigint` cents with a currency column; time is `timestamptz` with a per-location IANA zone and frozen rendered local-time text on legal artifacts (the dental submitted_at_et idea, parameterized).

MIGRATIONS. drizzle-kit generates SQL migrations applied by a runner with a history table, one transaction per file, dry-run against a shadow database in CI, and a check that fresh-DB and migrated-DB schemas are identical. The hand-rolled ddl.ts / SCHEMA_BOOT_VERSION mechanism is retired; the CI guard idea survives as 'schema.ts changed without a new migration file fails the build'. RULESET_VERSION, ASSIST_PROMPT_VERSION and precog's SCORING_VERSION guards are carried over verbatim from /home/user/catcorner22/dental/.github/workflows/ci.yml.

HOSTING AND JOBS. Long-lived Node containers (Fly.io or ECS Fargate, two regions, HIPAA-eligible services with BAAs), not Vercel serverless: the product runs background work continuously (ERA ingestion, claim batches, eligibility polling, recall runs, bank feed sync, controls re-scoring, audit chain verification, statement generation). Queue is pg-boss so jobs are enqueued in the same transaction as the ledger write (outbox). Object storage is S3 with Object Lock for the WORM audit export and signed URLs for documents. Public status page, published uptime and a chairside-severity SLA are launch commitments.

OFFLINE STRATEGY. Honest and bounded, not 'offline mode'. Each operatory device holds an encrypted read cache (PGlite in the browser over OPFS, key derived from the server session and discarded at logout, disabled entirely in shared-device profile) of today's schedule, the charts and alerts of today's patients, and reference vocabularies. During an outage staff can view schedule and charts and capture clinical notes and perio into an outbox that reconciles through the normal OCC autosave path (dental useAutosave + draftBackup patterns, now encrypted and principal-bound). No financial posting, no claims and no prescribing happen offline; those require the server and the controls check. This satisfies the HIPAA contingency requirement without promising what a legal-record system cannot safely honor.

API AND ENFORCEMENT. Default-deny. Every route handler and server action is wrapped by `withTenantGuard(minRole, {location?, entitlement?, clinicalScope?, phiRead?})` which: resolves the session row, re-reads the user row (fresh role, active, watermark, MFA state), resolves tenant and location scope, opens a transaction, executes `SET LOCAL app.tenant_id / app.user_id`, writes a phi_access_log row when phiRead names patient/account ids, and returns typed 401/403 refusals. A 20-line CI test globs `src/app/api/**/route.ts` and `**/*.action.ts` and fails on any exported handler not passing through the wrapper. State-changing routes require Origin/Sec-Fetch-Site same-origin and a JSON Content-Type (dental readJsonRecord extended). Security headers and the wire-level probe (next.config.mjs, e2e/headers.mjs) carry over; script-src moves to a per-request nonce because the portal renders user content. External egress is an allowlist: clearinghouse, processor, bank aggregator, eRx vendor, model provider — each enabled per tenant only when a countersigned `baa` row exists.

EVENT STREAM. `domain_event` is the transactional outbox: every repo mutation inserts an event row in the same transaction (aggregate type/id, event type, actor frozen, ip/ua, payload of ids and codes only, prev_hash and hash chained per tenant). pg-boss consumers fan events to: the controls engine (re-run SoD on role.granted/revoked/user.deactivated; anomaly detectors on ledger.entry.posted, ledger.entry.reversed, refund.posted, deposit.created, reconciliation.variance), notifications (batched digests, never per-event supervisor alerts), analytics views, and the nightly chain-verification and WORM export job.

HOW DENTAL CODE MIGRATES. Lift verbatim into packages/: `vocab/*`, `schema/types.ts`, `modules/*`, `audit/*`, `standardize/*`, `extract/*`, `verify/*`, `assist/*`, `dictation/*`, `readback/*`, `auth/*` (guards.ts rewritten against the new user table; roles.ts renamed), `db/backend.ts`, `db/postgresUrl.ts`, `http/*`, `export/csv.ts`, `email/threading.ts`, `version.ts`. Adapt: `repo/submissions.ts` fileSubmissionAtomic becomes signNoteAtomic keyed on encounter; `repo/drafts.ts` OCC and revision ring apply to notes, perio exams and treatment plans; `repo/auditLog.ts` becomes the domain_event writer; `repo/gamify.ts` ledger shape becomes journal_entry/journal_line; `repo/practicePacks.ts` maker-checker becomes approval_request/approval_decision; components/builder/* are decomposed and re-hosted inside the encounter view; Odontogram.tsx gains editing and a history layer. The PHI rules invert from filing block to egress classifier; TN law content gains a jurisdiction key; the module registry gains a field-id deprecation map. Dropped: gamify, store, sparkle character, Gauntlet UI, edr/product.ts, ddl.ts, localStorage draft mirror, email-as-export.

HOW PRECOG CODE MIGRATES. Copy `sod/conflict-rules.ts` verbatim; in `sod/detect.ts` delete the `people` import and make `buildAssignments` read `user_role_grant` joined to `role_entitlement_map`; in `controls/dual-release.ts` delete the `people` import and inject an approver repository, persist DualReleasePolicy and ThresholdException as `control_policy`/`control_exception` rows, and call `evaluateRelease` from the ledger posting service inside the transaction; parameterize `assessCoso()`, `findKnowledgeRisks()`, `portfolioSummary()` on an injected PracticeModel derived from roster, grants, policy and reconciliation status; replace id-substring risk factors with typed fields on `control`; move `weights.ts` constants and the COSO/SoD/threat magic numbers into one versioned table; fix the three identified bugs (timeline sign convention, counterfactual ignoring vars, beam search dropping status quo) with golden and monotonicity tests before any port; rename `ml/` to `signals/`; port the six keeper panels to Next components; drop auth/, db.ts, multiplayer/, threat-scoring skin, johari, meta-analysis UI, the Grok fetch (replaced by the BAA-gated provider adapter feeding the same local deterministic brief).

## Data model outline

TENANCY AND IDENTITY. tenant(id, name, timezone default, plan, published_price_id) -> location(tenant_id, id, name, address, timezone, npi_group) ; user(tenant_id, id, username, display_name, pass_hash, active, mfa_enabled, mfa_secret_enc, recovery_codes_hash[], password_changed_at, sessions_revoked_at, clinical_role, created_by_id) ; session(tenant_id, id, user_id, device_profile operatory|desk, last_seen_at, expires_at, revoked_at, ip, ua) ; user_role_grant(tenant_id, user_id, role, location_id nullable, granted_by frozen, effective_from, effective_to) ; role_entitlement_map(tenant_id, role, entitlement_id from precog EntitlementId, version) ; staff_credential(tenant_id, user_id, kind license|permit|cert, number, state, expires_at). Three authorization axes: rank (role), clinical scope (clinical_role, derived not stored per dental clinicalRoles.ts), financial entitlement (derived view user_entitlement = grants x map).

PATIENT AND ACCOUNT. patient(tenant_id, id, mrn opaque, names, dob, sex, ssn_enc, contact, primary_location_id, status, guardian_required bool) ; patient_relationship(patient_id, related_patient_id or party_id, kind guardian|spouse|responsible, consent_scope) ; patient_alert(patient_id, kind allergy|premed|anticoagulant|latex|behavioral|financial_hold|custom, text, severity, entered_by frozen, active) ; account(tenant_id, id, guarantor_party_id, statement_cycle, hold) ; account_member(account_id, patient_id). Relationship: one account has many patients (family); a patient belongs to exactly one active account at a time; every journal line carries both account_id and patient_id.

INSURANCE. payer(tenant_id, id, name, payer_id_edi, address) ; insurance_plan(tenant_id, id, payer_id, group_number, plan_type, fee_schedule_id, coverage_rules jsonb, frequency_limits jsonb) ; fee_schedule(tenant_id, id, name, effective_from) ; fee_schedule_line(fee_schedule_id, cdt_code, provider_id nullable, amount_cents) ; coverage(tenant_id, id, patient_id, plan_id, subscriber_party_id, member_id_enc, rank primary|secondary|tertiary, effective_from, effective_to, verified_at) ; eligibility_check(coverage_id, requested_at, response_frozen jsonb, source clearinghouse|manual, remaining_max_cents, deductible_met_cents). Coverage rank plus effective dates is the only place dual coverage is modelled; claims derive from it.

PROVIDER AND SCHEDULE. provider(tenant_id, id, user_id nullable, npi, license, specialty, active) ; operatory(tenant_id, location_id, id, name) ; schedule_template(provider_id, location_id, weekday, blocks) ; appointment(tenant_id, id, patient_id, provider_id, hygienist_id, operatory_id, location_id, start_at, end_at, type_id, status enum, supervision_level direct|general|none, supervising_dentist_id, confirmed_at, arrived_at, seated_at, completed_at, created_by frozen) ; appointment_procedure(appointment_id, cdt_code, teeth[], surfaces[], treatment_plan_item_id) ; recall(patient_id, kind, due_at, scheduled_appointment_id).

ENCOUNTER AND CLINICAL RECORD. encounter(tenant_id, id, patient_id, appointment_id nullable, location_id, dos date, attending_provider_id, supervising_dentist_id, kind visit|tele|phone, status open|closed, created_by frozen) is the anchor: every clinical row below has encounter_id NOT NULL. clinical_note(id, encounter_id, module_ids[], note_state jsonb, version int (OCC), status draft|signed|amended, entry_author_id+name, clinical_performer_id+name, reviewing_dentist_id+name, signed_at, frozen_markdown, frozen_audit_report, ruleset_version, assist_provenance jsonb) ; note_revision (working-copy ring, capped, not legal history) ; note_amendment(id, amends_note_id, encounter_id, reason_code, text, author frozen, at) ; tooth_condition(id, patient_id, tooth ToothId, surfaces Surface[], condition_code, status existing|planned|completed|extracted|missing, source_encounter_id, procedure_id nullable, recorded_by frozen, effective_at, superseded_by_id) — the odontogram of record is the current set of non-superseded rows, history is the full set; procedure(id, encounter_id, patient_id, provider_id, cdt_code, teeth[], surfaces[], quadrant, description frozen, fee_cents, status per PROCEDURE_STATES, treatment_plan_item_id nullable, charge_entry_id nullable, completed_at) ; perio_exam(id, encounter_id, examiner_id frozen) ; perio_site(exam_id, tooth, site 1-6, pd_mm, gm_mm, bop, suppuration, plaque) ; perio_tooth(exam_id, tooth, mobility, furcation) ; consent(encounter_id, procedure_ids[], decision agreed|declined|deferred|other_option, consenting_party_id, relationship, interpreter, questions_text, discussed_by frozen, signed_document_id) ; medication, allergy, medical_history_snapshot(encounter_id, jsonb) ; prescription ; anesthesia_record(encounter_id) with anesthesia_event(at real timestamp, kind vitals|drug|milestone, values) ; imaging_study(encounter_id) -> image(object_key, dicom_tags) -> image_interpretation(dentist frozen, per-structure status) ; document(tenant_id, id, patient_id, encounter_id nullable, kind, object_key, phi bool, retention_class).

TREATMENT PLAN. treatment_plan(patient_id, id, name, status draft|presented|accepted|declined|superseded, version) -> treatment_plan_phase -> treatment_plan_item(cdt_code, teeth, surfaces, provider_id, fee_cents, est_insurance_cents, est_patient_cents, priority, status) ; case_presentation(plan_id, presented_by frozen, at, outcome, patient_questions). Estimates live here only.

LEDGER (double-entry, append-only, event-sourced). gl_account(tenant_id, code: patient_ar, ins_ar_primary, ins_ar_secondary, unapplied_credit, undeposited_funds, bank_deposit, production_revenue, contractual_adjustment, courtesy_adjustment, bad_debt, refund_payable, processor_fee) ; reason_code(tenant_id, code, kind adjustment|writeoff|refund|reversal|variance, label, requires_approval bool, active) ; journal_entry(tenant_id, id, account_id, patient_id, posted_at, effective_date, entry_type charge|patient_payment|insurance_payment|adjustment|write_off|refund|transfer|reversal|deposit, source_type procedure|claim|era_line|payment|manual, source_id, reason_code nullable, memo, created_by_id, created_by_name frozen, approval_request_id nullable, reverses_entry_id nullable, reversed_by_entry_id nullable (set by trigger on the reversal), location_id, idempotency_key unique) ; journal_line(entry_id, seq, gl_account_code, patient_id, procedure_id nullable, claim_id nullable, coverage_id nullable, debit_cents, credit_cents) ; payment_allocation(id, payment_line_id, procedure_id, amount_cents, allocated_by frozen, at, reversed_by_id nullable) ; deposit(tenant_id, id, location_id, business_date, prepared_by frozen, expected_cents, status open|closed|reconciled) ; deposit_line(deposit_id, payment_entry_id) ; statement(account_id, id, period, frozen_render, sent_at).
Ledger invariants, enforced in the database: (1) sum(debit)=sum(credit) per entry — deferred constraint trigger; (2) journal_entry, journal_line, payment_allocation are INSERT-only for the app role, REVOKE UPDATE/DELETE plus BEFORE triggers; (3) a reversal entry must reference an unreversed original of the same account and mirror its lines exactly — trigger; (4) sum(payment_allocation.amount) for a payment line <= that line's credit — trigger; (5) an entry of type adjustment|write_off|refund whose reason_code.requires_approval is true, or whose amount exceeds the channel threshold, must carry an approval_request_id in status approved_dual|approved_single|approved_exception — enforced by the posting service inside the transaction via evaluateRelease and re-checked by trigger; (6) charge entries require procedure_id and cdt_code on the debit line; insurance_payment and contractual_adjustment require claim_id and coverage_id; (7) balances are views: account_balance = sum over patient_ar; insurance_expected = sum over ins_ar_*; unapplied = sum over unapplied_credit — never columns; (8) effective_date more than N days before posted_at raises a retroactive-edit anomaly event; (9) every journal_entry insert inserts a domain_event in the same transaction; (10) statement renders and day sheets are frozen artifacts stamped with the last entry id they include, so a statement can be reproduced exactly.
Readability model: the patient ledger view groups lines by DOS and procedure, shows for each procedure the charge, each allocated payment (who paid, from which coverage, when), each adjustment with reason and approver, and the residual; a running-balance toggle is derived from the same rows. 'Explain this balance' composes one sentence per open procedure from those rows. Because estimates are not in the journal, 'what the patient owes today' and 'what we expect from insurance' are different sums over different GL accounts and are never blended.

CLAIMS. claim(tenant_id, id, encounter_id, patient_id, coverage_id, rank, status draft|scrubbed|submitted|acknowledged|pended|paid|denied|appealed|closed|voided, claim_number, submitted_at, clearinghouse_ref, primary_claim_id nullable for secondaries, attachments[]) ; claim_line(claim_id, procedure_id, cdt_code, billed_cents, allowed_cents, paid_cents, patient_resp_cents, carc[], rarc[], status) ; preauthorization(patient_id, coverage_id, items, response_frozen) ; era_file(tenant_id, id, received_at, raw_object_key, parsed jsonb, status) ; era_payment(era_file_id, check_or_eft, payer_id, amount_cents, posted_entry_ids[]) ; era_line(era_payment_id, claim_id matched, claim_line_id matched, paid, allowed, adjustments[], match_status matched|unmatched|manual). Posting an ERA line creates one insurance_payment entry and one contractual_adjustment entry per claim line, both linked back to era_line and claim_line, both reversible.

CONTROLS AND RISK. control_policy(tenant_id, version, dual_release jsonb DualReleasePolicy, effective_from, approved_by frozen) ; control_exception(tenant_id, id, ThresholdException fields, approved_by frozen, residual_note, effective_from/to) ; approval_request(tenant_id, id, channel, amount_cents, payee, requester_id frozen, evaluation jsonb ReleaseEvaluation, status per ReleaseStatus, first_approver, second_approver, decided_at, resulting_entry_id) ; approval_decision(request_id, approver frozen, decision, reason, at) ; sod_finding(tenant_id, id, rule_id, person_ids[], entitlements[], severity, score, scoring_version, status open|mitigated|accepted|resolved, first_seen, last_seen, decision_id) ; risk_decision(tenant_id, id, subject_type, subject_id, kind accept_residual|remediate|monitor|insure, note, review_by, residual_at_decision, decided_by frozen, at) — append-only ; control_assessment_snapshot(tenant_id, period, coso jsonb, portfolio jsonb, indicators jsonb, scoring_version) ; anomaly_alert(tenant_id, id, kind, subject, evidence_event_ids[], severity, status open|explained|escalated, cleared_by frozen, reason) ; bank_account, bank_transaction(imported, amount, posted_date, description, external_id unique), reconciliation_match(deposit_id, bank_transaction_id, variance_cents, status), variance_clearance(match_id, reason_code, cleared_by frozen, note).

AUDIT AND EVENTS. domain_event(tenant_id, id uuidv7, occurred_at, actor_user_id, actor_name frozen, ip, ua, session_id, aggregate_type, aggregate_id, event_type, payload jsonb codes-and-ids-only, prev_hash, hash) partitioned monthly, INSERT-only ; phi_access_log(tenant_id, id, at, actor frozen, patient_id, account_id, resource_type, resource_id, purpose, break_glass bool, justification) partitioned monthly, INSERT-only ; audit_chain_check(tenant_id, day, ok, head_hash) ; baa(tenant_id, vendor, kind, signed_at, controls_named jsonb, document_id, active) — connectors read this before any egress ; retention_policy, legal_hold(patient_id or account_id, reason, placed_by frozen, released_at). Immutability pattern is uniform: append-only tables, reversal rows for corrections, frozen names, hash chain for events, versioned frozen artifacts (notes, statements, assessments) stamped with the rule or scoring version that produced them.

## Ux blueprint

INFORMATION ARCHITECTURE. Two front doors and one rail. The front desk's front door is the Board (schedule by operatory with per-chair documentation status); the clinician's front door is the Encounter (chart, note, perio, plan in one view for the seated patient); the owner's front door is the Money screen (yesterday's production -> collections -> adjustments -> deposits -> bank, plus open approvals and alerts). The persistent Patient Rail (Curve Sidekick pattern) appears on patient selection everywhere: alerts (uncollapsible), next/last appointment, coverage and eligibility status, balance split into patient vs insurance vs unapplied, open plan, recall, and 1-click jumps to Chart, Notes, Perio, Plan, Ledger, Claims, Images, Documents. Global search is patient-first. Settings, Controls, Compliance and Reports sit under a role-gated menu; nothing clinical is more than two clicks from the rail.

HOME SCREEN PER PERSONA. Front desk / coordinator: the Board with eligibility flags per appointment, arrival/seat buttons, a documentation-status strip per chair (green signed, amber open, red killer open) that shows no PHI across the desk, and a checkout queue. Biller / office manager: worklists — unposted ERAs, claims aging by status, denials needing action, unallocated credits, statements due, pending approvals I can second — each row opens the exact record. Hygienist: today's patients with perio due flag, one-tap 'start perio' and 'start hygiene note', prior perio delta view. Dentist: today's patients with 'needs my signature' and 'needs exam/diagnosis' queues, chart with planned vs completed, killer-only finish path. Owner: the Money screen, controls summary (COSO overall with drivers, open SoD findings, approval queue, anomaly digest), decision journal items due for review, compliance tasks due. Temp / new staff: same screen as their role with a one-shift quick-start overlay; role was set at provisioning so the first beat is never 'you are not allowed yet'.

TOP 5 DAILY FLOWS, FEWEST CLICKS. (1) Check-in with eligibility: Board -> tap appointment -> Arrive (1 click); eligibility was polled at booking and re-checked at 6am, so the card already shows coverage status and remaining maximum; if stale, one 'Re-verify' button; total 1-2 clicks. (2) Chart and sign a visit: from the seated chair, Encounter opens with the planned procedures pre-loaded from appointment_procedure; tap each 'Complete' (or paint on the odontogram), the note module rail is pre-selected from the procedure set, the dentist adds Assessment/Plan prose or chips, killer strip shows at most three rows, Sign; typical 6-10 taps for a restorative visit, and one gesture on the chart writes tooth_condition, procedure, note scaffold and the pending charge. (3) Checkout: Encounter -> Checkout shows charges (from procedures), coverage split estimate, patient portion, Take Payment (hosted card field or cash/check), Create Claim (pre-scrubbed, one click), Schedule Next; 4-6 clicks and no second screen. (4) Post an ERA: Biller worklist -> ERA batch -> review screen shows matched lines green and unmatched amber with proposed matches -> Post Matched (1 click) -> resolve unmatched individually; every posted line shows the resulting entries. (5) Explain a balance: patient rail -> Ledger -> 'Explain' renders one sentence per open procedure ('Crown #14 on 3/12: charged $1,180; Delta paid $590 on 4/2; contractual adjustment $190 (Delta PPO); you owe $400') with the running-balance toggle beside it; zero clicks to understand, one to print the statement. Owner bonus flow: Money screen shows yesterday's variance; tap variance -> matched deposits and bank lines side by side -> Clear with reason or Escalate; two clicks.

HOW 'VERY INTUITIVE' IS ACHIEVED. Fewer words, bigger targets at every gate: blocking messages are one verb line plus one control, explanations behind progressive disclosure, 44px targets with 8px gaps on all pointer types, no 0.65rem type on anything that gates. Validation is silent until blur or sentence boundary, never while typing. Escape hatches are named and counted (omission licences) instead of closed, so a busy person always has a truthful fast path. Compliance and controls are visible without being obstructive: detectors write signals and digests; only money-moving thresholds and clinical killers block. The compliant path is always the fastest path (mask before waive; one-click verified blocks before free text). One gesture, many records: painting a procedure updates chart, plan, note and charge, so staff never re-enter facts. Numbers agree everywhere because every screen reads the same views. Colors follow the luminance ladder plus shape plus word so the CVD front-desk lead reads urgency the same as everyone else. No letter grades, no scoreboards, no mascots on clinical surfaces; warmth lives in login, empty states and the portal ('geometry, not costume'). Role-based onboarding is inside the product and free, and the design is tested with billers and hygienists in the pilot, not only dentists (report D.5 #12).

## Internal controls integration

EVENT SOURCES. The controls engine never asks a questionnaire for facts the PMS already knows. It consumes: user_role_grant changes (role.granted, role.revoked, user.deactivated, credential.expired); every journal_entry (ledger.entry.posted with entry_type, amount, reason_code, actor, effective vs posted dates); payment_allocation, refund and reversal events; deposit.created/closed and reconciliation.variance events; claim.voided, procedure.deleted, appointment.deleted events; vendor/payee master changes; approval_request lifecycle events; phi_access_log volume per user; login and MFA events. All arrive through the domain_event outbox, so the engine's view is complete and tamper-evident.

SEGREGATION OF DUTIES (live, from grants). precog `detectSodConflicts(assignments)` runs with RoleAssignment[] built from user_role_grant x role_entitlement_map (the 14 EntitlementIds in conflict-rules.ts map onto PMS permissions: post_payments, prepare_deposit, bank_reconcile, approve_writeoffs, post_adjustments, submit_claims, create_vendor, approve_vendor, release_payment, enter/approve_payroll, pms_admin_roles, collect_cash, view_reports_only). It re-runs on every grant event and nightly, upserting sod_finding rows keyed on (rule_id, person set), closing findings that no longer exist and reopening ones that recur. COSO Principle 9 (assess change) and Principle 11 (technology general controls) therefore become continuously monitored instead of hard-coded weak. ENFORCED, not just recorded: granting a role that would create a critical conflict requires a second admin and a risk_decision (accept_residual with review date) before the grant activates — the grant sits in pending until then.

DUAL RELEASE (enforced in the posting path). The ledger posting service is the only writer of journal_entry. For entry types adjustment, write_off, refund, and for vendor/ACH/payroll channels, it constructs a ReleaseRequest (channel, amount, payee, requester, first approver) and calls precog `evaluateRelease(policy, request)` with the tenant's control_policy and control_exception rows, INSIDE the transaction. Verdicts: below_threshold or approved_single -> post; needs_second -> insert approval_request (status needs_second) and do not post; approved_dual/approved_exception (a second, distinct, role-eligible approver has decided) -> post with approval_request_id; blocked_same_person, blocked_role, blocked_missing_second, blocked_policy_off -> 403 with reasons[] and nextSteps[] from the evaluation. A trigger re-checks that any approval-required entry carries an approved request so a code path cannot bypass the service. Waive/raise/lower/force exceptions are rows with approver, residual note and effective dates; activeExceptionSummary surfaces expiring and standing exceptions to the owner monthly. Turning a channel on lowers the linked SoD finding scores via mitigatedSodRuleIds, exactly as in precog, but now against real findings.

ANOMALY DETECTION (recorded, batched). Consumers over ledger and deposit events produce anomaly_alert rows: refunds above threshold, adjustments posted outside business hours, entries whose effective_date is more than N days before posted_at (retroactive edits), void or reversal velocity per user, adjustment-to-production ratio per user relative to the practice, deposits that do not match undeposited funds, unmatched bank transactions older than 48 hours, copy-forward narrative similarity for the same procedure family (digest similarity.ts). Alerts never fire per event to a supervisor; they batch into the owner's weekly digest and the biller's daily worklist, with the dental digest rule applied: a signal that would flag most staff is re-scoped to the practice and the names dropped.

BANK RECONCILIATION (the independent ground truth). bank_transaction rows come from a Plaid/Finicity feed or statement import — data the PMS did not generate. reconciliation_match pairs closed deposits with bank lines; variances become alerts and cannot be cleared by anyone holding post_payments or prepare_deposit (an SoD rule added to the rulebook: reconcile_bank conflicts with clearing one's own deposits). independentBankRec in the residual and COSO models changes from a self-asserted boolean to a measured fact (percentage of deposits matched within 48 hours, median lag), and detection lag in the scenario model uses the practice's actual reconciliation lag.

SCORING AND COSO (recorded, explained, versioned). StaffComposition is derived (team size from active users, sole-owner knowledge from the credential/knowledge map, segregation score from segregationHealth of live findings, dual control and bank rec from measured facts). residual-engine and assessCoso run nightly and on demand against that derived model, stamped with SCORING_VERSION into control_assessment_snapshot; every score carries RiskDrivers and a deep link to the sod_finding, approval queue, reconciliation screen or grant that drives it. tornadoSensitivity and the cascade simulator become the 'what if I turn on dual approval for write-offs' preview in settings, with premium and cost-of-risk framed explicitly as directional estimates until calibrated.

DECISIONS AND EVIDENCE. risk_decision (accept_residual/remediate/monitor/insure) is server-side, append-only, attributed and stamped with residual_at_decision and review_by; overdue reviews appear on the owner home. Every enforcement or acceptance is itself a domain_event, so an auditor, carrier or investigator gets a plain-sentence trail: 'On 2027-03-04 M. Ortiz requested a $640 write-off (reason: hardship); policy required a second approver; Dr. Reagan approved at 14:12; entry J-0193 posted; SoD finding rule-writeoff-self was mitigated by channel writeoff.'

WHERE ENFORCED VS RECORDED. Enforced: dual release on money-moving entries; grant of conflicting roles pending second admin; BAA-gated connector enablement; PHI egress classifier on AI and export; note signing gates (killers, licence scope, supervision corroboration); variance clearance SoD; append-only journals and event chain at the database role. Recorded and surfaced: SoD findings, anomaly alerts, COSO and residual scores, leading indicators, decision journal, compliance tasks, PHI access review. The product states this table on the Controls screen so the owner knows which is which — the 'recorded vs enforced' distinction the research identified as the competitive dividing line.

## Roadmap


### Item 1
- **phase**: Phase 0 - Foundation and hardening
**scope**

Monorepo on Next 15 with lifted dental auth/security/reliability packages; tenant/location/user/session/grant schema with RLS and append-only roles; drizzle-kit migrations with history table and shadow-DB check; withTenantGuard default-deny wrapper and CI route-guard test; domain_event outbox with hash chain, phi_access_log, nightly chain verification and WORM export; mandatory MFA with recovery codes and dual-control break-glass; per-tenant envelope encryption; pg-boss jobs; container deployment in two regions with status page; port precog pure engines into packages/controls with demo-data imports removed, the three engine bugs fixed, golden and monotonicity tests, and a versioned constants table; adopt the adversarial-panel controls C1-C5 as acceptance tests.

**exit criteria**

Zero routes outside the guard (CI); RLS negative tests prove cross-tenant reads return nothing; security e2e probes (headers, lockout, MFA no-oracle, session revoke on next request, idle timeout) run in the blocking CI job; audit chain verifies across a simulated tamper; precog engines pass golden tests and monotonicity properties (adding a control never raises residual; timeline sign asserted one way); production refuses to boot without DB, TLS, KMS key and backup target; restore drill from backup documented and executed once.

- **duration estimate**: 6-8 weeks
- **dependencies**: None; gates everything else.

### Item 2
- **phase**: Phase 1 - Patient, encounter and clinical record
**scope**

Patient, account, alerts, relationships and the persistent rail; encounter as anchor; clinical_note with Smile Notes modules attached by FK, signNoteAtomic with frozen artifacts and RULESET_VERSION, amendments, three identities; BuilderShell decomposition; module field-id deprecation registry and round-trip test; odontogram of record (tooth_condition) with editable Odontogram and history layer; procedure log with CDT reference; six-site perio exam with keyboard/pedal entry and browser dictation behind the engine seam (no PHI audio to vendors until Phase 5); consent, medications, allergies; PHI rules re-scoped to egress boundary; documents in object storage with signed URLs.

**exit criteria**

A hygienist completes full-mouth perio single-operator in under 8 minutes in usability testing; a restorative visit charts and signs in under 10 taps; every signed note reproduces byte-identical from frozen artifacts; wrong-site and contradiction findings fire across chart/note; a draft saved under an older module set round-trips; shared-device profile leaves zero cleartext PHI on the device after logout (verified by inspection).

- **duration estimate**: 8-10 weeks
- **dependencies**: Phase 0.

### Item 3
- **phase**: Phase 2 - Scheduling, ledger and payments
**scope**

Board, appointments, operatories, templates, recall, supervision validation; double-entry journal with all invariants as triggers, gl accounts, reason codes, allocation, reversals, deposits, statements, day sheet, balance explainer; hosted-field card processing (SAQ-A) with tokenized refunds; controls hooks: posting service calls evaluateRelease, approval_request lifecycle, SoD findings from live grants, anomaly detectors for after-hours, retroactive, refund threshold and void velocity; owner Money screen v1 (without bank feed).

**exit criteria**

Property-test suite over 10,000 generated ledger scenarios (dual payer, partial payments, reversals, refunds, transfers) never produces an unbalanced entry, an over-allocation, a stored balance, or a mutated row; every balance on every screen equals sum over journal views; a write-off above threshold cannot post via the API without a distinct second approver (e2e); granting a conflicting role sits pending until a second admin decides; five billers complete the ledger-reading usability probe (explain a balance after dual coverage and a partial payment) with higher task success than on their current PMS.

- **duration estimate**: 10-12 weeks
- **dependencies**: Phase 1 (procedures produce charges).

### Item 4
- **phase**: Phase 3 - Insurance and claims
**scope**

Payers, plans, fee schedules per plan/provider, coverage with rank and dates, clearinghouse adapter (DentalXChange or Vyne first) for real-time eligibility with frozen snapshots at booking and check-in, claim scrubber with justification/completeness pre-flight, 837D submission, claims tracker, ERA/835 ingestion and review-then-post with line-item match producing insurance_payment and contractual_adjustment entries, automatic secondary claims, denial and appeal worklists, preauthorizations, checkout screen.

- **exit criteria**: Dual-coverage plus partial-payment scenario posts end to end and the ledger explainer renders it in plain language; ERA auto-match rate above 90% on pilot payer mix with every unmatched line surfaced; eligibility shown on the Board for 95% of tomorrow's appointments by 6am; checkout in one screen; claim state machine has no dead states; EDI enrollment runbook executed for the pilot practice.
- **duration estimate**: 10-12 weeks
- **dependencies**: Phase 2 (ledger, payments), clearinghouse contract.

### Item 5
- **phase**: Phase 4 - Controls, reconciliation and compliance (parallel with Phase 3 from its midpoint)
**scope**

Bank feed via aggregator and statement import, reconciliation matching and variance clearance with SoD; derived StaffComposition; nightly residual and COSO snapshots with drivers and deep links; leading indicators; decision journal server-side; cascade 'what-if' preview in settings; control_policy editor with exceptions and expiry summary; owner weekly digest with systemic re-scoping; HIPAA SRA questionnaire generating compliance_task rows and versioned policies; BAA registry gating connector enablement; training records; sterilizer log; incident and observation intake (wishes lifted with PHI gate and tenant scope); records-request export with SLA clock; retention policies and legal hold; canned reporting library over journal views.

**exit criteria**

A deposit variance surfaces on the owner screen within 24 hours and cannot be cleared by the depositor; COSO P9/P11 flip from static to computed from grant events; enabling a connector without a signed BAA row is refused (e2e); records request exports the full record as PDF plus structured data within the workflow; every report total reconciles to journal views in an automated check; six keeper precog panels ported and the tactical vocabulary removed.

- **duration estimate**: 8 weeks
- **dependencies**: Phase 2; bank aggregator BAA.

### Item 6
- **phase**: Phase 5 - Pilot at the founding practice and hardening
**scope**

Open Dental-first conversion tooling with dry-run diff and documented non-converting items; imaging bridge to existing sensor software; encrypted offline read cache and clinical outbox; published rate card, exit terms, uptime page and SLA; role-based in-product onboarding under 90 minutes per writer; instrumented pilot at the three-location Tennessee practice with a hygienist, an assistant and a biller in the cohort; TN counsel review of legal content; SOC 2 Type 2 observation period begins; annual SRA performed on the product itself.

**exit criteria**

Owner-panel buy gates met by week 4: median time-to-sign within baseline +20%, at least 70% of eligible charts in the product, open killer-gap rate at signing down versus a two-week baseline, zero wrong-author events on shared devices; day-sheet-to-bank reconciles daily for 30 consecutive days; no P1 outage without a degraded-mode read path exercised; restore drill passed again; counsel sign-off on TN content.

- **duration estimate**: 8-10 weeks
- **dependencies**: Phases 1-4.

### Item 7
- **phase**: Phase 6 - Expansion (v2)
**scope**

Native imaging viewer and one-click DICOM export; ePrescribing with EPCS via certified vendor and medication-safety flags; patient portal and two-way communications with the portal-delivery language gate; Dentrix and Eaglesoft conversions; documented REST API with webhooks and FHIR export; on-device Whisper or BAA STT enabling voice perio and BAA-gated AI assist in the base price; per-state jurisdiction packs beyond Tennessee; DSO features (org-level control catalog inheritance, SSO/SCIM, regional rollups); specialty modules only if a specialty is chosen deliberately.

- **exit criteria**: Each item ships behind its own acceptance test set; AI features clear the deterministic baseline and the verifier before enablement; second and third practices onboarded via the migration product without services engagement; SOC 2 Type 2 report issued.
- **duration estimate**: Ongoing, 6-9 months
- **dependencies**: Phase 5 pilot results; vendor BAAs (STT, eRx, model provider).

## Risks and tradeoffs

- Clearinghouse dependency is the largest build and business risk: eligibility, 837D and 835 all ride a third party (DentalXChange/Vyne/Change), incumbents process ~100M claims a year, EDI re-enrollment takes up to 30 business days per practice, and a partial-quality claims module reproduces the exact complaint the product targets. Mitigation: adapter interface from day one, one clearinghouse first, ERA review-then-post never silent.
- The ledger is hard for a reason — four vendors with trained billers shipped ledgers those billers hate. Double-entry with visible allocation is the right skeleton but the readability bet is unproven; the ledger usability probe with billers in Phase 2 is a real go/no-go gate, not a checkbox.
- Holding PHI is a step-change in liability from Smile Notes' de-identified posture: breach economics ($6.64M average), OCR and TN 45-day notification, FTC exposure on every security claim (Dentrix G5 precedent), PCI scope if card data is mishandled. Mitigation: hosted-field tokenization, per-tenant envelope encryption, SOC 2 Type 2 observation from pilot, published claims matched to implementation.
- Enforced dual release trades friction for control; if thresholds and exceptions are wrong the first week, staff route around the system (report: alert override 87.6%). The exception system, expiring temporary raises and the owner's monthly exception summary exist to keep the control alive; thresholds must be set with the CPA at onboarding.
- Precog's scoring constants, insurance multipliers and healthy prior are illustrative, not calibrated; presenting them as actuarial is a liability for an attorney-owned product. Keep the 'directional estimate' framing, calibrate against ACFE/ADA/Prosperident figures, and never label people as threats.
- RLS plus a fresh user read plus a PHI access log on every request is measurable overhead; at PMS request volumes it needs a short-TTL session cache invalidated on revocation events, partitioned log tables and connection pooling (PgBouncer). Offset by never trusting the token for role or active state.
- Field-level encryption versus searchability: encrypting SSN and member ids is straightforward; names and DOB remain cleartext for search and are protected by RLS and access logging — a defensible but explicit choice that must be documented in the SRA.
- Hiring-pool familiarity favors Dentrix/Eaglesoft and cannot be matched; the only counter is genuine one-day learnability with free role-based onboarding and temp quick-starts, measured in pilot.
- Migration is the acquisition cost: imaging conversion, in-flight secondary claims and non-converting insurance benefits break every switch. Open Dental first is the pragmatic wedge; Eaglesoft's proprietary imaging may be unbridgeable.
- Offline is deliberately bounded to read cache plus clinical outbox; practices burned by cloud outages may want more. Promising financial or claims work offline would compromise the controls model and the legal record, so the product must say so plainly.
- Single-jurisdiction legal content (Tennessee) limits commercial reach; per-state supervision, retention, PMP and teledentistry packs are legal-research cost, not engineering, and require counsel review before sale outside TN.
- Scope: this design is a full PMS plus a controls platform plus a compliance program; a solo-founder team cannot ship all of it. The phase gates are ordered so that Phases 0-2 alone produce a usable clinical and financial core with enforced controls; anything after Phase 3 should be resequenced against pilot data rather than built on faith.
- AI: including inference in the base price avoids the tab32 per-use churn trigger but puts model cost against gross margin; the cage (PHI gate, verifier, refusal codes, drift log) keeps it defensible, and the ambient-dictation non-goal can only be retired with on-device or BAA STT.
- The market's pricing anchor is low ($149-$700/month per location) and only 16.9% of owners plan a software purchase in a given year; the controls module cannot carry standalone ARPU above ~$100/month, so it is packaged as the reason to switch, not a separate SKU, and the published rate card must be sustainable at that band.
- Both source repos have effectively no commit history (dental: one squashed commit; precog: one broken commit), so 'battle-tested' claims about individual fixes cannot be verified by bisecting; the test suites and e2e probes are the evidence, and the precog engines have none until Phase 0 adds them.

## What to drop

- Points economy, clinic store, badges, GPA and rank titles (/home/user/catcorner22/dental/src/lib/gamify/*, src/lib/gpa/*, src/lib/stats/badges.ts, /store, /api/store): an app-tracked currency redeemable for gift cards approved by one lead is a segregation-of-duties finding the controls engine would itself flag, and the RDH/faculty/carrier panels all reject scoring staff.
- Sparkle mascot and characters on any work surface (src/lib/stats/sparkle.ts content, 18 call sites, public/characters); keep the seeded deterministic copy mechanism and ethics tests for empty and confirmation states only.
- Data Hygiene Gauntlet as a customer-facing screen (src/components/requests/GauntletForm.tsx, /requests); keep the five cycles as internal engineering governance prose.
- EDR paste-target abstraction and clipboard-as-egress (src/lib/edr/product.ts, 'Copy for Curve', .md download fallback, CORPORATE_EMAIL export): the merged product is the record; egress becomes print/statement/portal/records-request, each a logged disclosure.
- Hand-rolled ddl.ts / SCHEMA_BOOT_VERSION migrations and the stale drizzle/0000_init.sql; replaced by generated migrations with a history table and shadow-DB CI check.
- Unencrypted localStorage/IndexedDB draft mirror (src/lib/client/draftBackup.ts as written); replaced by a session-key-encrypted cache wiped on logout and disabled in shared-device profile.
- MFA default-off deployment flag and the ADMIN_PASSWORD_RESET env break-glass; replaced by mandatory MFA with recovery codes and dual-control unlock.
- Serial integer primary keys and DN-#### tickets visible to users; replaced by UUIDv7 and per-tenant opaque display ids.
- Vercel serverless assumptions (max:1 pool, 60s maxDuration, weekly cron as the only background work); replaced by long-lived containers and pg-boss.
- Provisional risk-management reference page and src/lib/risk/categories.ts as dead code; the failure taxonomy content folds into the controls register and coverage heat map.
- Law-watch scraper as a product feature (src/lib/law/watch.ts); it detects presence not change, is TN-only and untested — internal ops tool at most until a real change-detection design exists.
- Ambient-dictation non-goal stays until on-device Whisper or a BAA STT vendor exists; the browser SpeechRecognition engine (offDevice: true) must not hear PHI.
- From precog: src/lib/auth/** (Grok-federated better-auth with a committed client secret), src/lib/db.ts, src/lib/multiplayer/** (dead WebRTC), Predator/Terminator/WHITE HOT threat skin and threat-scoring.ts vocabulary, johari-applications.ts and meta-analysis.ts UI panels, advanced-reasoning panel as a user-facing screen, layers panel, the 'ml' label, the direct api.x.ai fetch in agent-loop.ts, persona IQ fields in dental's training/persona-agents.ts, AGENTS.md and all Grok Build sandbox scaffolding, and the broken src/routes/index.tsx which is not recoverable.
- localStorage-persisted PracticeProfile and decision journal; all control state moves server-side and append-only.
- The hardcoded Cornerstone practice identity in src/lib/practice/config.ts and the office-as-ordering-only tenancy model; replaced by tenant/location with location as an authorization axis for financial and roster data.
- Tennessee-specific rule bodies as hardcoded literals (2027-01-01 supervision date, CSMD gate) without a jurisdiction key; the rules survive, the hardcoding does not.
- Any marketing claim of 'HIPAA compliant', 'lawsuit-proof', 'board-proof', 'AI-powered' or indemnity ROI; the owner panel bans them and the FTC precedent makes them exposure.
