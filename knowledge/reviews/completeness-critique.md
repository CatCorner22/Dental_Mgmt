# Completeness critique (gaps, contradictions, unverified claims, strongest points)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 44 (Critique phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, critique, gaps

## Summary

21 gaps, 12 contradictions, 15 unverified claims and 9 strongest points found in the whole package; every gap and contradiction is resolved in the approved plan and summarized in docs/11.

## Gaps


### Item 1
- **area**: Data conversion — the design partner's actual PMS
**what is missing**

Cornerstone Dental Arts runs Curve Hero (dental/knowledge/sources/cornerstone-dental-arts-practice-profile.md; the entire Smile Notes EDR seam is Curve-shaped), yet the roadmap's Phase 1 'report-import ETL of day sheets/AR/patient headers' names only Open Dental and Dentrix, the Phase 2 full importer is Open Dental, and Dentrix/Eaglesoft come in Phase 4. There is no Curve Hero import path anywhere, even though voice-to-text-landscape.md already documents Curve's authenticated REST integration shape.

- **why it matters**: The only pilot practice cannot be onboarded to the Phase 1 financial layer or converted in Phase 2 without it. The parallel-run exit criterion ('opening AR ties to the incumbent to the cent for 30 days') is unachievable against a system with no importer.
- **suggested action**: Add a Curve Hero report-export ETL (day sheet, AR aging, patient/coverage headers, deposit slips) to Phase 1 and a Curve conversion mapper to Phase 2; obtain Curve's export/API documentation and data-exit terms (90-day notice, remaining term owed per the report) before Phase 0 ends, or recruit a second design partner on Open Dental.

### Item 2
- **area**: Imaging during the clinical pilot
- **what is missing**: Phase 3 asks the pilot to chart, diagnose and sign notes in the new product, but the sensor bridge and viewer are Phase 4 (v1-nice). The completeness rule 'imaging without interpretation' and the CBCT entire-volume rule both presuppose images the clinician can open. Nothing says how a dentist views radiographs chairside during Phase 3 (stay in Curve imaging? dual screens? no images?).
- **why it matters**: A clinical record without images is not a chart of record; Phase 3's exit criterion 'restorative visit charted and signed in ≤10 taps' silently assumes a second application is open, recreating the two-app hop the merge exists to remove, and TN Rule 0460-02-.12 counts radiographs and their interpretations as record components.
- **suggested action**: Either pull the bridge/viewer (or at minimum a DICOM/JPEG import + reference viewer) into Phase 3, or write the Phase 3 pilot as 'clinical notes and perio only, imaging remains in incumbent' with an explicit interpretation-linking workaround and a dated exit.

### Item 3
- **area**: Multi-location pilot design
**what is missing**

The design pilots 'one Cornerstone location' while the dental repo's own insight (offices.ts, product_insights) is that office is a per-ENCOUNTER property because staff rotate and patients are seen at any of the three sites. Nothing addresses patients who appear at the pilot location and a non-pilot location in the same month, staff who work both, or how the shadow ledger tie-out handles cross-location payments.

- **why it matters**: A one-location pilot of a three-location practice will produce ledger and reconciliation variances that are artifacts of the pilot boundary, not control findings — contaminating the exact metric Phase 1 is supposed to validate.
- **suggested action**: Decide before Phase 1: pilot all three Cornerstone locations under one tenant (tests location scoping early), or recruit a true single-location 1–3 dentist practice for the financial-layer pilot and keep Cornerstone for the Phase 5 group tier.

### Item 4
- **area**: Lab case management
- **what is missing**: No lab-case module anywhere: lab slips, outbound case tracking, due-date vs appointment linkage, shade/material, lab fees on the ledger, and the 'lab case not back' scheduling check.
- **why it matters**: Every crown, bridge, denture and implant restoration in a general practice passes through a lab; a seat appointment scheduled before the case returns is one of the most common daily front-desk failures, and lab invoices are a recurring AP fraud vector (fictitious vendor rule already exists in Precog).
- **suggested action**: Add lab_cases (encounter/procedure FK, lab vendor, sent/due/received, fee) to Phase 3 with a Board warning when a seat appointment precedes the due date; wire lab vendors into the vendor-master dual-release channel.

### Item 5
- **area**: Referrals, correspondence and fax
- **what is missing**: The knowledge corpus has an entire OMFS-recipient panel and a four-slot referral packet gate, but the design has no referrals module (inbound/outbound, specialist directory, records forwarded, loop closure), no letters/correspondence generation (Curve 'Files & Letters'), and fax appears only as a disclosure enum with no eFax vendor or BAA.
- **why it matters**: Referral loop closure is a named malpractice pattern in litigation-documentation-research.md; specialists and many payers still receive records by fax; each send is a disclosure the accounting must capture.
- **suggested action**: Add referrals + referral_packets (the OMFS panel's four slots) and a letters/merge module to Phase 3; register a BAA-covered eFax vendor in the registry in Phase 4.

### Item 6
- **area**: Medicaid / TennCare and program-integrity
- **what is missing**: No mention of Medicaid dental (TennCare via DentaQuest/MCOs): eligibility rules, MCO-specific claim requirements, prior-auth, EPSDT for pediatrics, record-keeping and audit obligations under Medicaid FWA, or Medicaid recoupment exposure. The compliance bundle lists 'Medicaid fraud-waste-abuse' only as a training topic.
- **why it matters**: Pediatric and many rural Tennessee practices are Medicaid-heavy; Medicaid audits are the most common program-integrity exposure for small dental offices and drive documentation requirements stricter than commercial payers.
- **suggested action**: Scope TennCare claims and documentation rules into the Phase 2 clearinghouse/scrubber work, or explicitly exclude Medicaid-heavy practices from the launch segment and say so on the trust page.

### Item 7
- **area**: In-house membership plans, payment plans and third-party financing
- **what is missing**: Fee schedules cover PPO/UCR but not in-house membership/discount plans (now common for uninsured patients), recurring payment plans, or third-party financing (CareCredit, Sunbit) with their merchant-fee write-offs and refund mechanics.
- **why it matters**: These are daily ledger events that produce exactly the 'transfer adjustment' and 'estimated write-off' confusion the report says no PMS handles; leaving them out means the signature ledger fails on the first uninsured patient.
- **suggested action**: Add membership_plans (fee, renewal, covered procedures, discount rules) and payment_plans (schedule, auto-charge via processor token) to the Phase 1 ledger property-test suite; treat financing merchant fees as typed, reason-coded adjustments.

### Item 8
- **area**: Provider and payer credentialing; claim attachments
- **what is missing**: Claims need rendering vs billing provider, NPI/TIN/taxonomy, per-payer participation status (in/out of network) and credentialing expiries; edi_enrollments is tracked but provider-payer credentialing is not. Claim attachments (radiographs, perio charts, narratives) require an attachment vendor (NEA FastAttach/Vyne) with a BAA — claim_attachments exists as a table but no vendor is scoped.
- **why it matters**: Out-of-network posting under an in-network fee schedule mis-states patient responsibility and estimated write-offs; attachments are required for SRP, crowns and most denials appeals — the exact narratives justification.ts already checks.
- **suggested action**: Add provider_payer_credentials with expiries to Phase 2 alongside fee_schedules; register an attachment vendor in the clearinghouse decision; make attachment presence a scrubber rule for attachment-required CDT codes.

### Item 9
- **area**: Existing patient-communication vendors during Phases 2–4
- **what is missing**: Reminders/recall ship in Phase 4 and two-way texting/online booking in Phase 5, but practices switching in Phase 2 already depend on Weave/RevenueWell/NexHealth, which read and write the PMS schedule. The Phase 2 read-only API is scoped only for 'the practice's accountant' — there is no schedule read/write integration path for a comms vendor.
- **why it matters**: A practice that converts in Phase 2 either loses confirmations (a must-have #7 regression and a no-show cost) or cannot switch; comms vendors are also BAs that need registry entries.
- **suggested action**: Extend the Phase 2 API to schedule/patient-contact read plus confirmation write-back for at least one comms partner, gated by the BAA registry, or move first-party reminders into Phase 2.

### Item 10
- **area**: Accounting export to the CPA
- **what is missing**: The report makes the CPA/bookkeeper a first-class persona ('ledger both clinicians and accountants can read', bank as ground truth), but the design offers only a read-only API and 'a derived GL export if a CPA insists.' No QuickBooks/Xero journal export, no chart-of-accounts mapping, no month-end close package.
- **why it matters**: The CPA is the independent reconciler the anti-embezzlement thesis relies on; if the day-sheet cannot be dropped into the practice's books, reconciliation stays manual and the 'reviewer seat' has nothing to review.
- **suggested action**: Add a month-end package (GL journal CSV/IIF/QBO mapping from gl_bucket + reason codes, deposit register, AR roll-forward) to Phase 1 exit; it is small and directly serves the reviewer seat.

### Item 11
- **area**: Payroll and time as a data source
- **what is missing**: Payroll appears as a dual-release channel (enter_payroll/approve_payroll entitlements, ghost-hours rule) but the product has no time clock, no payroll integration (Gusto/ADP), and no payroll data model — the channel would gate nothing.
- **why it matters**: An enforced control with no data behind it is exactly the 'recorded vs enforced' theater the plan warns against, and would appear as a false green on the recorded-vs-enforced table.
- **suggested action**: Either scope a payroll-provider read integration (approval events pulled via API) into Phase 4, or mark the payroll channel 'external / attested' in the recorded-vs-enforced table and exclude it from scores until data exists.

### Item 12
- **area**: Accessibility program
- **what is missing**: Contrast CI and 44px targets are covered, but there is no automated a11y testing (axe/pa11y) in the blocking CI, no keyboard-only traversal tests, no screen-reader pass, no VPAT/accessibility statement, and no CVD-simulation snapshot test — all gaps the dental corpus itself lists (adversarial-a11y-advocate-hate.md, adversarial-cvd-dyslexia-hate.md).
- **why it matters**: A PMS is a workplace tool; staff with disabilities are protected under the ADA/Title I, DSO buyers and state programs increasingly ask for a VPAT, and the perio keyboard grammar is only a speed win if it is genuinely operable without a pointer.
- **suggested action**: Add axe-core to the Playwright probes in Phase 0's blocking job, a keyboard-only e2e for the five daily flows in Phases 2–3, and a VPAT at Phase 4 GA.

### Item 13
- **area**: Support operations and on-call
- **what is missing**: Must-have #8 and unmet need #5 (chairside support SLA) are adopted as promises, but nothing plans who answers the phone during clinical hours, the ticketing system (needs a BAA if PHI appears), escalation paths, an on-call rotation, or the support_grants workflow's staffing — for a product currently built by one person.
- **why it matters**: From Phase 2 the pilot bills and files claims in the product; a same-day payer rejection with no one to call is the exact failure (Denticon ticket-only, Dentrix update windows) the research says drives churn, and an SLA with credits is a liability without staff behind it.
- **suggested action**: Write a support operations plan before Phase 2: hours, channels, BAA-covered ticketing, on-call, published targets; defer the contractual SLA to GA as the design already does, but staff the pilot explicitly.

### Item 14
- **area**: Unit economics, funding and team
- **what is missing**: No cost model (clearinghouse per-claim and per-eligibility fees, SMS, KMS/S3/RDS, LLM tokens, processor fees, SOC 2 and pen-test, counsel, vCISO, cyber/E&O premiums, ADA CDT licence) against the proposed one-per-location published price; no hiring or contractor plan for a roadmap the design itself sizes at 18–24 months for 'a small team'; no funding source.
- **why it matters**: The published rate card is the cheapest differentiator only if it is sustainable; a solo owner cannot execute Phases 2 and 3 sequentially on the stated durations, and every security-plan cadence item (monthly log review, quarterly tabletop, annual pen test) is unstaffed labor.
- **suggested action**: Produce a 24-month budget and staffing plan (at minimum a second engineer and a fractional compliance/vCISO by Phase 2) before committing to Phase 1 durations; price the Phase 1 financial layer only after the cost model exists.

### Item 15
- **area**: Go-to-market and pilot recruitment
- **what is missing**: No sales motion, channel (CPA/bookkeeper partnerships, Prosperident-style fraud examiners, dental associations, DSO ops), marketing site, demo environment with synthetic tenants, onboarding playbook, or customer-success plan; the D.8 primary research is placed in Phase 0 'in parallel' with no budget or recruiter named.
- **why it matters**: Phase 1's stated purpose is 'earn revenue and a falsifier'; without a channel the standalone controls product has no second customer, and the ledger-default decision is gated on interviews that have no owner.
- **suggested action**: Assign owner, budget and timeline to the D.8 interviews now; draft a one-page GTM for the Phase 1 financial layer (target list of 20 practices, CPA referral partners, pricing sheet, demo tenant) as a Phase 0 deliverable.

### Item 16
- **area**: Legal and commercial paperwork
- **what is missing**: BAA form, MSA/terms, SLA credits, exit/export terms, subprocessor notice, and privacy policy are referenced as requirements but not scheduled as deliverables; the RPC 5.7 opinion, company entity/ownership structure separate from the law practice, and insurance binding are listed as open questions without dates.
- **why it matters**: The Phase 1 pilot cannot legally receive PHI without the countersigned BAA the security plan requires; the trust page promises published exit terms that do not yet exist.
- **suggested action**: Add a Phase 0 'legal pack' deliverable: BAA, pilot agreement (with the shadow-ledger enforcement disclosure), terms, privacy policy, RPC 5.7 opinion request, entity and insurance binding.

### Item 17
- **area**: Mobile and device strategy
- **what is missing**: No decision on owner mobile access (schedule/approvals/alerts on a phone), operatory hardware (iPad vs Windows tablets, MDM enrollment, kiosk mode, PIN unlock feasibility), or the second-approver's mobile one-tap flow that the controls module assumes.
- **why it matters**: Dual release depends on a second approver responding within minutes; the approver is usually the owner, who is in a different operatory or offsite. Without a mobile approval surface the control becomes a bottleneck and gets waived.
- **suggested action**: Specify a responsive/PWA approvals + alerts surface with step-up MFA as part of Phase 1, and an MDM/device-profile recommendation list for operatory tablets in Phase 3.

### Item 18
- **area**: Pilot instrumentation and analytics
- **what is missing**: The buy gates (median ready→filed ≤ baseline +20%, ≥70% adoption by week 4, ≤90 min training, perio <8 min, zero wrong-author events) require product analytics, but the plan bans third-party analytics without a BAA and specifies no first-party event pipeline, baseline measurement in the incumbent, or dashboard.
- **why it matters**: Every phase exit criterion is unfalsifiable without a measured baseline and a way to compute the metric; the dental corpus already warns that 'everything else waits on' pilot instrumentation.
- **suggested action**: Define a first-party, PHI-free usage-metrics pipeline (domain_event derived, redacted) in Phase 0 and measure incumbent baselines (time-to-note, perio completion, checkout clicks) during the D.8 interviews.

### Item 19
- **area**: Perio speed target evidence
- **what is missing**: The Phase 3 exit criterion 'full-mouth perio by one operator in under 8 minutes' has no stated derivation; the underlying 60%-skip / 11%-chart-every-visit figures are a vendor survey (Alta Voice) with undisclosed n.
- **why it matters**: An unsourced threshold either passes trivially or blocks GA arbitrarily; the hygienist persona is the one no vendor markets to, so this metric carries the differentiation claim.
- **suggested action**: Time 5–10 hygienists on the incumbent during the D.8 usability probes and set the target relative to that baseline (e.g., ≤ incumbent median) rather than an absolute minutes figure.

### Item 20
- **area**: Naming and trademark clearance
- **what is missing**: Of 30 candidate names, 24 are 'unchecked' (search budget exhausted), 3 are high/medium collision (Chairside, Morning Huddle, Cusp), 'Daybook' appears twice with different rationales, and no USPTO/state/common-law search was performed for any name — including the current 'Smile Notes' mark, which brand.md flags as unsearched.
- **why it matters**: Every roadmap artifact (trust page, BAA form, domain, status page) needs the name; renaming mid-build is exactly the drift brand.ts warns about.
- **suggested action**: Shortlist five names from the exploration (e.g., Denote, Indelible, Onefold, Wellkept, Gumption), run TESS/TSDR in Classes 9/42/44 plus domain checks, and obtain a trademark attorney's clearance before Phase 1 GTM materials are drafted; treat Chairside/Morning Huddle/Cusp as eliminated.

### Item 21
- **area**: Roadmap consistency with the security plan's Phase 0 gate
- **what is missing**: The design's Phase 0 exit criteria say 'no PHI yet held' and omit the vendor SRA, pilot BAA, phi_access_log and IR plan as exit items, while the security plan insists all of them must be live before the first Phase 1 import because a shadow ledger of names and balances is PHI.
- **why it matters**: Whichever document the engineer follows determines whether the pilot begins as a HIPAA violation.
- **suggested action**: Amend the roadmap's Phase 0 exit criteria to include the vendor SRA signed by the Security Official, countersigned pilot BAA, phi_access_log and disclosures live, IR plan and breach-clock module skeleton, and the legal pack.

## Contradictions

- Session lifetime: the dental-knowledge-docs exploration and the adversarial IT panel state sessions are '~30 days on a JWT cookie', but src/lib/auth/auth.config.ts line 32 (verified) sets maxAge 12h / updateAge 15min and the auth exploration says so; the knowledge corpus is stale on this point and the design correctly builds on 12h.
- LLM provider posture: the design synthesis' stack_decision and what_to_drop still say 'Grok-federated better-auth that no BAA will cover' and 'Grok/xAI ... neither will sign a BAA', while the security plan's corrections_applied refutes this (xAI offers a BAA via questionnaire + ZDR-Enabled API). The two documents must be reconciled; the auth-shell deletion stands on architectural grounds, the provider exclusion does not.
- Conversion partner: the roadmap imports from 'Open Dental and Dentrix' in Phase 1 and builds an Open Dental importer in Phase 2, but the exploration establishes the design partner runs Curve Hero; no Curve path exists in any phase.
- Phase 0 PHI status: design roadmap Phase 0 exit criterion 'no PHI yet held' vs security plan 'the shadow ledger is PHI, SRA/BAA/access-log must be live before the first Phase 1 import' — the security plan is right and the roadmap's exit criteria have not been updated.
- Minors' record retention: the dental knowledge corpus (tennessee-dental-law-summary.md line 46, verified) recommends a 10-year floor from a Department of Health manual; the security plan rejects that as unverified and implements max(last_contact+7y, dob+19y). Neither side has read the primary sources in this environment, so the disagreement is unresolved rather than resolved.
- Ten-working-day copy deadline: the dental-knowledge-docs exploration attributes it to Board Rule 0460-02-.12; the corpus itself (line 44) and the security plan attribute it to Tenn. Code Ann. 63-2-101. The exploration mis-cites; the plan is consistent with the corpus.
- Precog dead code vs reuse: the dental-peripheral exploration marks src/lib/risk/categories.ts as dead code with zero importers, while the design lists it as a reuse_from for the findings register — consistent only if the design acknowledges it is unwired today (it does not).
- Wishes intake: exploration flags src/app/api/wishes/route.ts as an ungated 4,000-char free-text PHI hole readable practice-wide (verified: no runPhiRule reference in the file), and the design reuses it as the anonymous tip channel; the design says 'PHI-gated' but the code it names has no gate — it is a rewrite, not a reuse.
- Offline stance vs pilot reality: the design says the read-only degraded cache is disabled on operatory devices, yet the outage scenario the research describes (Curve six-hour outages) bites hardest in the operatory; the 'emergency mode' for chairside staff is therefore a printed card, which the roadmap does not say plainly.
- Judging provenance: the design justifies option A with 'two of three judges chose it' and the stack decision cites 'judges' repeatedly, but no judge outputs are included in the material provided; the claim is unsupported within this package.
- Name list: 'Daybook' is proposed in two different angles with two different taglines and rationales, and the trust-precision angle's 'Sextant' rationale ('every hygienist already uses the word') conflicts with the name-check note that the same descriptiveness weakens the mark.
- Target segment vs design partner: the product vision targets 1–3 dentist independents at launch, but the only named design partner is a ~30-staff, three-location group; the decisions_for_owner section acknowledges the tension, the roadmap durations and exit criteria do not.

## Unverified claims

- 'Two of three judges chose' the financial-layer-first sequencing — no judge outputs are present in the provided material.
- All Tennessee legal parameters beyond the retention rule: 63-2-102 fee caps, 47-18-2107 subsection lettering and HIPAA exemption, PC 1107 (2026) chapter/act list/effective date (tn-law.ts cites only the capitol.tn.gov homepage — verified), 63-5-108/-115 supervision limits, 53-10-310 CSMD triad, EPCS mandate citation, PC 991 scope, TIPA thresholds, RPC 5.7 text — all listed unverified by the security plan itself.
- Vendor BAA statuses (Neon Scale-only + 15% surcharge, Fly.io ~$99 add-on, Resend Enterprise Order Form, Twilio edition, Plaid DPA/BAA, Anthropic 30-day-retention-no-ZDR, xAI BAA + ZDR API, AWS per-model Bedrock exclusions) — asserted by unseen 'verifiers', several marked as confirmed by one and unreachable for another.
- HIPAA Security Rule NPRM status ('no final rule as of 2026-09-03; Unified Agenda July 2027; withdrawal request Dec 2025') and the 90 FR 898 pin cite — from search retrieval, not primary reads; the '48-hour RPO / monthly backup test' figures are explicitly not found.
- Market statistics: Alta Voice 60% skip / 11% chart-every-visit and Zentist 71%/78% (vendor surveys, n undisclosed); Curve '$200M R&D', '40% of vendors gone in 36–48 months', '3.5x faster charting', '~30% case acceptance' (vendor marketing per the report's own labels); IBM $6.64M breach cost (second-hand).
- Embezzlement figures: 48% victimization is an ADA respondent survey (2020 release) and the 17%/83% split is Prosperident's re-analysis, both secondary and labeled as such in the report (line 298, verified); they are the product's headline and should be cited with those caveats.
- Phase exit thresholds with no stated derivation: perio <8 minutes, ≥95% first-pass clearinghouse acceptance, 85–90% ERA auto-post, ≥90–95% eligibility by 6am, ≤4-click checkout, 10 taps to sign — plausible targets, not measured baselines.
- Phase durations (8–10, 12–14, 14–16, 14–16, 12–14 weeks) — estimates for an unspecified team size; the risks section itself says 18–24 months for a small team.
- 'Code comments are a written record of bugs found on a running server' (dental auth exploration) — both repos have exactly one commit (verified), so no fix can be bisected; the tests and e2e probes are the only evidence.
- Dental repo Tailwind version ('stay on the existing v3 pipeline') and the exact next-auth beta to pin — not checked in this review.
- All 'known_conflicts_from_memory' in the names section and all 'unverified prior knowledge' in the name checks are model recollection; only Cusp, Daybook, Chairside, Wellkept and Morning Huddle have URL evidence (GitHub/npm), and none has a USPTO search.
- AWS operational specifics used as design constraints (RDS 5-minute log shipping → RPO ≤5 min; 35-day PITR max; Object Lock/Vault Lock semantics) — consistent with AWS documentation as I recall it but not read in this session.
- The security plan's assertion that the FTC Henry Schein order was $250,000 'monetary relief under Section 5' with Docket C-4575 and final order May 23, 2016 — confirmed by one verifier only.
- ADA CDT license terms and the currently adopted CDT version at 45 CFR 162.1002 — not read.
- The claim that a shared-schema RLS design with NULLIF policies is 'fail closed' on pooled connections — the reasoning is sound but is asserted without a running test; it is only true once the specified CI negative tests exist.

## Strongest points

- The exploration is accurate where it is checkable: precog src/routes/index.tsx is a 32-byte placeholder, precog has no .github and zero test files, dental has 201 test files and zero tenant_id references, both repos have one commit, PREVIEW_CLIENT_SECRET is committed, assessCoso() is argument-free, dual-release leaks Number.POSITIVE_INFINITY, session maxAge is 12h, MFA is default-off, supervision.ts hard-codes 2027-01-01 — all verified in this review.
- The central thesis is grounded in the owner's own research, not asserted: report line 177 ('No harvested review praises any product for AR clarity after dual coverage and partial payments'), line 310 (no SMB product tailors financial controls interactively), and line 319 ('A ledger that staff cannot read is a ledger an owner cannot audit') exist verbatim, and the design builds the readable append-only ledger + enforced dual release + bank reconciliation directly on them.
- Structural-correctness principles are concrete and testable rather than aspirational: NOT NULL encounter FK on every clinical row (eliminates Curve's orphaned-note class), balances as sums over append-only entries with DB-enforced allocation and approval triggers, evaluateRelease inside the posting transaction, RLS with NULLIF and SET LOCAL inside BEGIN, INSERT-only role plus triggers, sealed independent verifier — each with a named CI negative test.
- The security plan demonstrably did verification work: it refutes its own inputs (xAI BAA exists; Anthropic BAA requires 30-day retention and excludes ZDR; Tennessee retention runs from last contact, minors are max(last_contact+7y, dob+19y), incompetent patients indefinite), fixes two real Postgres gotchas, corrects HIPAA terminology (standards vs addressable), and publishes an honest unverified_items list instead of papering over gaps.
- The drop list is decisive and well-argued: retiring the points economy/store because 'a staff currency redeemable for value with single-role approval is a segregation-of-duties finding the product would flag in its own customer', deleting the precog shell and not carrying its git history because of the committed secret, and refusing 'HIPAA compliant / lawsuit-proof / AI-powered' claims with the Henry Schein FTC precedent as the reason.
- Sequencing tests the unproven thesis first: piloting the ledger + controls beside the incumbent produces a paid falsifier by month ~6 while deferring the lowest-risk asset (Smile Notes' 201-test clinical core) — and the design states the cost plainly (clinicians idle for a year; shadow-ledger enforcement is a mirror).
- Reuse is specific to the file: the design names the exact modules to lift verbatim (roles.ts MANAGE_CEILING, throttle.ts, hashGate.ts, clientIp.ts, sessionWatermark.ts, postgresUrl.ts, byteaudit/*, conflict-rules.ts, dual-release.ts, weights.ts) with the single mechanical refactor each needs, which makes the plan executable rather than conceptual.
- The dental adversarial panels are converted into acceptance criteria (shared-device author lock, MFA-on, clipboard as disclosure, local-mirror wipe, chairside session lifetime, no-scoreboard doctrine), and the no-scoreboard rule is treated as a liability posture and walkout trigger rather than a preference — consistent across design, security plan and UX blueprint.
- The roadmap's exit criteria are mostly falsifiable (AR ties to the cent for 30 days; planted $300 skim surfaces within one business day; zero rows updated on append-only tables; RLS leak test; planted chain tamper detected; restore drill writes its own audit row) — the weak ones are named above.
