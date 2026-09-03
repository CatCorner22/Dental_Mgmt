# Design judge 3: commercial defensibility, HIPAA readiness, and fit with the research evidence (winner: controls-trust)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 15 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, judge, commercial-defensibility-hipaa-readiness-and-fit-w

## Summary

Scored the four design lenses from the commercial defensibility, HIPAA readiness, and fit with the research evidence viewpoint; winner controls-trust.

## Judge lens

commercial defensibility, HIPAA readiness, and fit with the research evidence

## Scores


### Item 1
- **design lens**: mvp-sequencing
- **score 0 10**: 7

#### strengths
- Best-argued reuse plan: lifts dental's tested auth/audit/note engine verbatim and precog's pure-TS domain layer only; verified against the repos (precog shell is a 32-byte placeholder, committed PREVIEW_CLIENT_SECRET, MFA default-off, plaintext draftBackup) so the 'retire precog shell' call is evidence-based, not taste.
- Directly operationalizes the report's cheapest differentiators (A.6.1 #2, D.5): published rate card, year-two price, exit/export terms, uptime history, no per-use AI; and its 'what to drop' list is the most complete and specific of the four.
- Open Dental importer first with a published fixed conversion price and a 'what does not convert' list matches A.5.3 (Open Dental publishes $1,450 conversion; secondaries/preauths need manual cleanup) and the price-sensitive switcher profile.
- HIPAA posture is sound: RLS backstop with SET LOCAL, hash-chained audit with append-only role + triggers, separate phi_access_log via repo read hook, a first-class disclosures table (accounting-of-disclosures obligation), MFA mandatory, KMS-encrypted mfa_secret, and an explicit ban on 'HIPAA compliant / lawsuit-proof / AI-powered' marketing (FTC/Dentrix G5 precedent).
- Honest about SOC 2 Type 2 being unavailable at launch and about offline being read-only degraded mode in v1 — matches the research's finding that no cloud PMS documents an offline mode and avoids over-promising.

#### weaknesses
- Not sellable as a PMS until Phase 3 (~month 8-9) and generates zero revenue before then; a solo-owner build with three strictly sequential phases has no early falsifier for the commercial thesis.
- Under-weights the one confirmed market gap the owner uniquely fills (B.7): the residual-risk/COSO/decision-journal surface is 'v1-nice' and the HIPAA/OSHA compliance program is v2, while BAA-gated integration registry is deferred to that v2 module even though clearinghouse, Twilio and payments connectors ship in v1 — a recorded-vs-enforced inconsistency the report (B.4) names as the dividing line.
- Single-region us-east hosting is weaker business-continuity posture than the other three designs for a product whose #4 complaint theme is cloud outages.
- Insurance workflow — the #1 must-have and 'daily test' — is sequenced third; the pilot practice cannot switch off its incumbent for the thing it complains about most until the end of the roadmap.
- Design partner (Cornerstone, 3 locations, ~30 staff) is larger than the 1-3 dentist target; acknowledged but the mitigation ('pilot one location first') is an aside, not a gate.

### Item 2
- **design lens**: persona-ux
- **score 0 10**: 7

#### strengths
- Only design that schedules the report's own D.8 research plan (24-30 persona interviews, office-manager weighted, ledger-reading usability probes on incumbents) inside Phase 0 and makes it gate the ledger design — the most honest response to D.7's 'evidence is thin and dentist-weighted'.
- Markets and demos to the office manager and hygienist, which D.5 labels a 'cultural, not technical' gap no vendor fills; persona home screens map one-to-one onto the D.3 jobs-to-be-done table.
- Strongest records-management detail for HIPAA/TN: retention_until computed from last contact and patient age (TN 7y adult/10y minor), legal_hold blocking purge, destruction_log, hash chain anchored nightly to S3 Object Lock, per-tenant KMS envelope keys, disclosure accounting, BAA-gated connectors, two-region hosting.
- Distinguishes control DESIGN effectiveness from OPERATING effectiveness (measured share of over-threshold write-offs with a second approver, days-to-reconcile) — the COSO-correct framing a CPA or carrier will accept.
- Pilot exit criteria are the owner-panel buy gates (>=70% eligible charts by week 4, <=90 min training, median time-to-file within +20%), i.e. measurable, not asserted.

#### weaknesses
- Longest time to revenue of the four: controls enforced only in Phase 3 (weeks 40-52) and live pilot at weeks 52-68; the confirmed B.7 gap — the product's only unfilled market — arrives last of the differentiators.
- Offline strategy puts an encrypted PGlite/IndexedDB PHI replica on operatory devices in v1 with queued clinical capture; mitigated by shared-device profile but it is the largest device-side PHI surface of the four and conflicts with the design's own 'no local draft backup on shared tablets' principle unless the profile is enforced server-side.
- HIPAA/OSHA compliance program and patient comms are v2 despite B.4 showing the Abyde/Patient Protect price band ($39-$115/mo) is an existing budget line the product could absorb at launch.
- Leaves the BullMQ/Redis-vs-pg-boss choice open, adding a possible Redis subprocessor (another BAA) for no stated benefit.
- Commercial pricing section correctly notes the controls ceiling (~$100/mo adjacent-market band) but then offers no wedge or earlier-revenue path — controls are 'the reason to switch' only after a 15-month build.

### Item 3
- **design lens**: domain-data-model
- **score 0 10**: 8

#### strengths
- Most CPA-defensible money model: a double-entry, append-only journal with GL accounts that split patient AR / primary-insurance AR / secondary-insurance AR / unapplied credit, with database-enforced invariants (balanced entries, allocation <= payment, reversal mirrors original, approval-required entries must carry an approved request, re-checked by trigger). This structurally forbids the exact failure modes in A.6.1 #5 (Oryx estimated write-offs in AR, CareStack transfer adjustments, Open Dental hidden/unallocated payments).
- Puts the report's own 'recorded vs enforced' table (B.4) on the Controls screen so the owner sees which controls refuse and which merely surface — the sharpest possible positioning against Abyde-class tools and against incumbents.
- Strongest technical HIPAA stack: non-owner DB role so RLS is not bypassable, separate append-only role + BEFORE triggers, per-tenant envelope encryption for SSN/member IDs/TOTP/bank IDs, monthly-partitioned phi_access_log, WORM export, nonce-based CSP for portal, BAA row read before any egress, records-request full-record export with SLA clock, retention + legal hold, SRA performed on the product itself, and an explicit documented choice that names/DOB stay cleartext for search — the kind of honesty an OCR reviewer rewards.
- Fit with evidence is meticulous: cites report sections by number (A.6.1 #5, C.2, B.4, D.5 #12), argues #10 'reconciles to the bank' up per D.4, adds an SoD rule that the variance clearer cannot hold post_payments/prepare_deposit (Zeldent thesis made operational).
- Commercial defensibility details others miss: UUIDv7 so identifiers never leak cross-tenant volume; CDT content loaded per tenant under ADA licence and never redistributed; controls packaged as the reason to switch rather than a sub-$100 SKU; migration as a product with a status page.

#### weaknesses
- Scope is the largest of the four (full PMS + controls platform + compliance program + eRx + portal) and the design itself concedes a solo team cannot ship it; pilot does not begin until Phase 5 (~44-52 weeks) and there is no revenue or thesis test before then.
- Full double-entry with GL accounts is the most defensible model but also the hardest to make readable to a front-desk biller; the design answers with a DOS-grouped view and an 'Explain' sentence, but the base rate the report cites (four vendors, zero praised ledgers) means this needs the D.8 usability probe as a hard gate, which is listed as an exit criterion but only in Phase 2 after the model is built.
- Compliance program is 'v1-nice' with counsel review unbudgeted; the Abyde-class questionnaire→policy→remediation loop that B.4 shows practices already pay for is not a launch feature.
- Two regions plus PgBouncer plus partitioned logs plus per-request fresh reads is a real ops burden for a one-developer company; acknowledged but not costed.
- Voice perio deferred to Phase 6 behind on-device/BAA STT, ceding the D.5 'perio at hygiene speed' window to HS1 Voice Perio and Curve Perio+.

### Item 4
- **design lens**: controls-trust
- **score 0 10**: 8.5

#### strengths
- Only design with a revenue-and-thesis wedge before the full PMS exists: Phase 1 ships the readable ledger + enforced dual release + bank reconciliation + SoD detection + decision journal as a financial layer beside the incumbent PMS (day-sheet/AR import, Zeldent-shaped). This targets exactly the B.7 gap that no product fills, has the lowest switching cost (ADA HPI: only 16.9% of owners plan a software purchase, so a PMS switch is a hard sell but an owner-fear add-on is not), and produces a falsifier (AR tie-out to the cent for 30 days, real SoD conflict closed by a decision) by ~week 24.
- Operationalizes the embezzlement evidence most completely: 17%/83% detection, ~40% of fraud via tips (a PHI-gated anonymous tip channel lifted from wishes.ts), denial-suppression detection (write-off after denial with no appeal routes through dual release regardless of amount), detection lag shown in days, and the realistic concession that full SoD is impossible in a six-person office so only a small 'critical' rule set hard-blocks at runtime (e.g. the day's payment poster cannot clear that day's reconciliation) while the rest require a dated decision.
- Strongest operational HIPAA discipline: three database roles (app_rw / app_append / app_migrate), envelope encryption, daily chain heads to Object Lock, access_log purpose enum that folds print/fax/portal/export/ai into one accounting-of-disclosures stream, break-glass justification before the row is returned, scheduled restore drill that writes its own audit row, subprocessor list with BAA status on the public Trust page, SOC 2 auditor engaged at Phase 2, and 'no PHI yet held' as an explicit Phase 0 exit state.
- Trust Page and Commercial Terms is a v1-core MODULE answering all six C.1 buyer-checklist questions (billing unit, year-two rate, exit/export, base inclusions, enterprise-agreement override, incident history) — the report's cheapest differentiator treated as a shipped artifact, not a marketing intention.
- Ledger readability is given a real acceptance test (D.8 usability probe with billers, not dentists) and is piloted beside an incumbent so failure is cheap; 'the compliant path has no faster alternative because there is no override' is the most defensible control posture for an attorney-owned product.

#### weaknesses
- Defers the clinical record — the most mature, tested asset in either repo (Smile Notes engine, 201 test files) — to Phase 3 (~week 46-60), and voice perio to v1-nice; this idles the strongest existing code for a year and cedes the perio window.
- The Phase 1 wedge weakens two of its own controls: SoD detection runs over the new tool's role_grants, not the incumbent PMS's real permissions (so it partially regresses to Precog's questionnaire model until the PMS exists), and the 'readable ledger' is tested on imported day-sheet data rather than as the system billers actually post into.
- Insurance/claims — the #1 must-have and the daily test — is Phase 2 (~week 38-40); the product sells to the owner's fear first and the biller's daily pain second, which the D.3 persona table says is the buyer/user split that already distorts the market.
- Phase 1 ARPU is capped by the adjacent-market controls band ($39-$115/mo product-led, $499-$1,200/yr) the design itself cites, so the wedge validates the thesis but funds little; the design does not price the wedge.
- 5-minute operatory idle lock and mandatory MFA step-up on every second approval are correct for HIPAA but the friction cost in a two-person front office is asserted as manageable, not measured.

## Winner lens

controls-trust

## Graft ideas

- From domain-data-model: split AR by GL account (patient AR / primary-insurance AR / secondary-insurance AR / unapplied credit) with database-enforced invariants — balanced entries, allocation <= payment, reversal mirrors original, and a trigger that re-checks any approval-required entry carries an approved approval_request so no code path can bypass postGuarded/evaluateRelease.
- From domain-data-model: render the report's 'recorded vs enforced' table on the Controls screen itself, listing which controls refuse a transaction and which merely surface a finding.
- From domain-data-model: UUIDv7/opaque per-tenant display ids (no cross-tenant volume leak), CDT content loaded per tenant under ADA licence and never redistributed in vocab, and an SRA performed on the product itself that documents the cleartext name/DOB-for-search decision.
- From domain-data-model and controls-trust jointly: SoD rule that whoever posted payments or prepared the deposit for a business day cannot clear that day's reconciliation variance; independentBankRec becomes a measured value (share matched within 48h, median lag), never a self-asserted boolean.
- From persona-ux: run the report's D.8 Phase 1 interviews (24-30, office-manager weighted) and ledger-reading usability probes on three incumbent platforms during Phase 0, and make probe results a gate on the ledger UI design, not a post-hoc exit criterion.
- From persona-ux: distinguish control DESIGN effectiveness (configuration) from OPERATING effectiveness (measured: share of over-threshold write-offs with a second approver, days-to-reconcile, distinct-signer rate) in both the residual engine and the UI.
- From persona-ux: retention_until computed from last professional contact and patient age (TN 7y adult / 10y minor, longer wins), legal_hold blocks purge, destruction_log records group-level detail; and the pilot buy gates (>=70% eligible charts by week 4, <=90 min paid training per writer, median time-to-file within +20%, zero wrong-author events on shared devices) as instrumented exit criteria.
- From persona-ux: market, demo and run usability sessions with the office manager and hygienist, not only the dentist (D.5: 'a PMS office managers and hygienists would choose — none market to them').
- From mvp-sequencing: Open Dental importer first with a published fixed conversion price and an explicit public 'what does not convert' list (insurance benefits, in-flight secondaries, preauths); start clearinghouse contract and per-payer EDI enrollment one phase before claims ship (up to 30 business days per payer).
- From mvp-sequencing: a first-class disclosures table (print/export/fax/portal/sms/clipboard with recipient and actor) for the accounting-of-disclosures obligation; per-tenant sequences for user-visible ticket/claim/statement numbers; CI version-stamp guards extended with SCORING_VERSION and CONTROL_RULEBOOK_VERSION; module field-id deprecation registry with round-trip test for older drafts.
- From mvp-sequencing: the explicit marketing prohibition list ('HIPAA compliant' as a product adjective, 'lawsuit-proof', 'board-proof', 'AI-powered', indemnity ROI) and the rule that the 3-location design partner pilots one location first.
- From mvp-sequencing and domain-data-model: BAA registry that gates connector enablement must ship in Phase 0/1 alongside the first integration, not in the v2 compliance module — a connector with no countersigned BAA row is disabled at the registry.
- From controls-trust (must survive any synthesis): the Trust Page as a v1-core module answering all six C.1 buyer-checklist questions with a real status page and published post-incident reports; the PHI-gated anonymous tip/observation channel; denial-suppression detection routing post-denial write-offs through dual release regardless of amount; SoD hard blocks limited to a named 'critical' rule set with everything else requiring a dated control_decision; SOC 2 auditor engaged by Phase 2; scheduled restore drill that writes its own audit row.
- From all four (consensus, keep): no person-ranking/letter grades/points economy anywhere; every score shows RiskDrivers and a deep link to rows; Precog constants labeled directional/educational until calibrated; offline never includes financial postings or claims; AI included in price or off, never metered.

## Disagreements between designs

- Go-to-market sequencing: controls-trust ships a financial layer (ledger + dual release + reconciliation + SoD) beside the incumbent PMS in Phase 1 for early revenue and thesis validation; mvp-sequencing and domain-data-model build the clinical record first (Smile Notes asset), then ledger, then claims; persona-ux builds chairside first, money second, controls third with pilot at week 52-68. Revenue-first wedge vs. leverage-the-mature-code-first vs. daily-user-first is a human decision.
- Ledger model: single-entry append-only ledger_entries with typed kind + explicit payment_allocations (mvp-sequencing, persona-ux, controls-trust) vs. full double-entry journal_entry/journal_line with GL accounts and balanced-entry triggers (domain-data-model). Trade: CPA defensibility and structural AR separation vs. implementation weight and front-desk readability.
- When the HIPAA/OSHA compliance program (SRA questionnaire → tailored policies → training → BAA registry → incident clocks) ships: v2 (mvp-sequencing, persona-ux) vs. v1-nice/Phase 4 (domain-data-model, controls-trust). Related: whether BAA-gated connector enablement is a Phase 0/1 primitive (domain-data-model, controls-trust, persona-ux) or arrives with the v2 compliance module while integrations already run (mvp-sequencing).
- Priority of the Precog risk-scoring/COSO/decision-journal surface: v1-nice, ship in Phase 2 'if time allows' (mvp-sequencing) vs. v1-core in every other design.
- Hosting topology: single region us-east on ECS/Fly (mvp-sequencing) vs. two regions active/passive (persona-ux, domain-data-model); controls-trust unspecified.
- Job queue: pg-boss in Postgres, no new subprocessor (mvp-sequencing, domain-data-model, controls-trust) vs. BullMQ on Redis or pg-boss left open (persona-ux).
- Offline scope in v1: read-only degraded mode only, queued writes deferred to v2 pending measured outage minutes (mvp-sequencing) vs. encrypted device replica plus queued clinical-note/perio capture in v1 (persona-ux, domain-data-model) vs. degraded mode deferred to Phase 5 (controls-trust). All agree money and claims are never offline.
- SoD enforcement mechanics: refuse a critical-conflict grant unless the owner supplies an accept_residual decision in the same request (mvp-sequencing, persona-ux) vs. grant sits 'pending' until a second admin decides (domain-data-model) vs. a small named critical set hard-blocked at runtime on the action (e.g. poster cannot clear own reconciliation) with all other conflicts requiring only a dated decision (controls-trust).
- Perio/voice timing: six-point perio v1-core with keyboard-first and voice behind the DictationEngine seam once on-device Whisper or BAA STT exists (mvp-sequencing, persona-ux, domain-data-model) vs. perio v1-nice arriving in Phase 3 (controls-trust).
- Imaging: bridge-and-store with DICOM export as v1-nice (mvp-sequencing) vs. v2 (persona-ux, domain-data-model, controls-trust).
- AI assist timing: v2 behind BAA and field-level gate (mvp-sequencing, controls-trust) vs. v1-nice (persona-ux, domain-data-model). All agree on the cage, deterministic twins and no per-use metering.
- Location as an authorization boundary in v1 (persona-ux, domain-data-model for financial/roster data, controls-trust) vs. location as provenance/scheduling scope only in v1 with location_grants reserved for the group tier (mvp-sequencing).
- Identifier scheme: UUIDv7 (mvp-sequencing, domain-data-model) vs. ULID for user-visible ids (controls-trust) vs. internal serials with per-tenant opaque display ids (persona-ux).
- Break-glass replacement for ADMIN_PASSWORD_RESET: dual-control one-shot recovery code (mvp-sequencing) vs. mandatory second owner at setup plus time-boxed dual-control code (persona-ux) vs. two-admin recovery ceremony (domain-data-model, controls-trust).
- SOC 2 auditor engagement timing: Phase 4 GA hardening (mvp-sequencing) vs. observation period begins at pilot Phase 5 (domain-data-model) vs. auditor engaged at Phase 2 with fieldwork in Phase 4 (controls-trust); persona-ux unspecified.
- Operatory idle timeout: 15 minutes (mvp-sequencing, domain-data-model sessions) vs. 10-minute lock (domain-data-model UX) vs. 5 minutes (controls-trust).
- Whether the pilot runs in parallel with the incumbent PMS (mvp-sequencing Phases 1-2; controls-trust Phase 1 as import-based financial layer) or only after the full build (persona-ux, domain-data-model).
- Pricing of the controls capability: packaged only as the reason to switch, never a SKU (domain-data-model, persona-ux) vs. a standalone financial-layer product in Phase 1 whose price in the $39-$115/mo or $499-$1,200/yr adjacent band is left undecided (controls-trust).
- Maker-checker on reason_codes and fee_schedule_lines edits (controls-trust) vs. plain owner-editable settings with version stamps (others).
- Whether the HIPAA/OSHA/financial controls are presented as one 'Practice risk' module on one budget line (mvp-sequencing, controls-trust) vs. separate Controls and Compliance modules (persona-ux, domain-data-model).
- Design partner: named 3-location Tennessee practice (Cornerstone) piloting one location first (mvp-sequencing, domain-data-model implies same) vs. unnamed pilot practice recruited via D.8 (persona-ux, controls-trust).
