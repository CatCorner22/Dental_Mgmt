# Design judge 1: daily-user intuitiveness and adoption (office manager, hygienist, dentist) (winner: persona-ux)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 13 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, judge, daily-user-intuitiveness-and-adoption-office-manag

## Summary

Scored the four design lenses from the daily-user intuitiveness and adoption (office manager, hygienist, dentist) viewpoint; winner persona-ux.

## Judge lens

daily-user intuitiveness and adoption (office manager, hygienist, dentist)

## Scores


### Item 1
- **design lens**: mvp-sequencing
- **score 0 10**: 8.5

#### strengths
- Cleanest information architecture of the four: three role workspaces (Board / Chart / Office) plus one persistent patient rail plus a Cmd-K command palette that finds any patient, claim, appointment or action by its plain name — directly neutralizes the 'hiring pool already knows Dentrix' must-have by making the product searchable rather than memorized.
- Hygienist home is the strongest of any design: seated patient's chart opens straight to Perio when the appointment type is hygiene, prior exam ghosted for comparison, note pre-scaffolded from appointment type, dentist-owned sections collapsed into a single handoff strip (exactly the chairside-DA panel fix). Perio is keyboard-first in v1 (1-9 depths, space for BOP, arrows, 168 sites continuous) so hygienist speed does not depend on an unbuilt STT engine.
- Explicit, testable intuitiveness rules rather than adjectives: one canonical view per fact (no invoice-vs-ledger split; balance as three labeled numbers), structural correctness over user vigilance (notes attach by FK, planned→completed only via encounter completion, impossible surfaces disabled), one verb line + one control at every gate, validation silent until blur, shape+word+luminance severity, 44px glove-first default, named omission licences, read-back on high-stakes tokens.
- Learnability treated as a product line item: role-based first-run tours, a PUBLIC temp quick start, free self-serve certification, shared-tablet device profile with PIN author switch that wipes drafts. Exit criteria explicitly require usability sessions with a hygienist and an assistant, not only dentists, and a 'zero wrong-author events on shared tablets' gate.
- Front-desk flows are honest and cheap: check-in is 1 click with eligibility already run at 6am and re-run on arrival; scheduling is 3 interactions; supervision validator blocks with one line and one control ('Add exam'); per-chair documentation strip carries no PHI across the desk. Biller home is the claims worklist with counts, one click from a denial to the note and chart.
- Discoverability is named as THE adoption gap versus Curve, and Fast Lane packs, charting macros and quick picks are required to be always visible and role-filtered.

#### weaknesses
- Sequencing makes the office manager wait longest: ledger lands in Phase 2 and insurance/claims (the daily test for the biller) in Phase 3, roughly month 8-9. The persona that most often kills or saves a PMS pilot gets the least-finished surface for the longest time, while running a parallel incumbent for billing — a two-app tax for the OM that the front-desk panel names as pilot poison.
- Voice perio is deferred to v1.x with no committed STT decision in Phase 0; HS1/Curve/Denticon are shipping voice perio now, so the hygienist 'no second person' promise is keyboard-only at launch.
- Does not fully close the Curve Favorites gap: Fast Lane still adds modules (structure), and the design does not commit to one-tap attested sentence blocks as first thumb targets for temps with an empty personal library (the recruiter panel's fix #4).
- Perio module has no explicit completion-time acceptance metric (D3 commits to under 8 minutes; D4 to ≥80% of hygiene visits); 'inside the appointment' is asserted, not gated.
- Digest-only owner alerts (never per-event) mean an after-hours refund or waived dual control waits for a batch; for the owner persona that is a trust gap other designs cover with a small hard-event channel.
- Reporting is v1-core but patient reminders/confirmations (market must-have #7, daily front-desk labor) are only v1-nice.

### Item 2
- **design lens**: persona-ux
- **score 0 10**: 9

#### strengths
- Only design that starts from the daily user and builds outward: five persona homes (Board, Money Desk, Chairs, Chairs+Queues, Daily Close & Controls) plus a temp/new-hire variant with a one-shift fast path rendered inside the work surface — directly answers the temp-recruiter kill list (role-before-work at provisioning, readiness strip before open, no training-as-homework).
- Money Desk is the best biller home of the four: three worklists as tabs with counts (ERA exceptions where auto-matched lines are already posted, claims aging with next action, denials), approvals waiting on me, unposted encounters, variances I own — every row has one primary action and a blocked write-off names the second approver instead of dead-ending.
- Sequencing keeps the OM's pain shortest: ledger, checkout, eligibility, 837D with pre-flight, 835 auto-posting and the claims tracker ship together in Phase 2 (weeks 24-40) rather than splitting ledger and insurance across two phases.
- Perio is a first-class two-tap flow (Chairs → Perio) with voice-or-keys single-operator entry, prior exam ghosted with ≥2mm deltas highlighted, and the STT dependency is called out as a Phase 0 start; the exit criterion is a timed 50-minute hygiene simulation completed by one operator.
- Buy gates are instrumented as UX metrics before features ship: median ready→filed ≤ baseline +20%, perio completion rate, checkout ≤4 taps, ERA auto-post rate, days-to-tie, ≥70% eligible-chart adoption by week 4, zero wrong-author events, ≤90 minutes paid training per writer.
- Runs the owner's own RPT D.8 primary research (24-30 persona interviews, office-manager weighted; ledger-reading probes on three incumbent platforms) in Phase 0 so the ledger layout is chosen from measured preference (running vs itemized), not from the team's taste. Explicitly measures rather than asserts intuitiveness.
- Adopts Radix primitives for select/dialog/combobox to close the a11y gap both repos share; Andon slot in the top bar is one verb line + one control; Patient Rail with un-collapsible critical-alert channel and privacy mode; 'the compliant path must be the fastest path' and 'setup IS the assessment' turn controls into workflow rather than a settings pilgrimage.
- Guards the walkout criteria structurally: no letter grades on chairside surfaces, practice-level metrics with SYSTEMIC_SHARE re-scoping, person-scoped signals only to owner/coach — written as principles with panel citations.

#### weaknesses
- Perio speed at launch is contingent on an on-device Whisper WASM engine or a BAA STT vendor that does not exist yet; if that slips, the design has no explicit keyboard grammar spec as the baseline (D1 does).
- Does not name a one-tap canned-prose answer to Curve Favorites/QuickText; 'verified blocks ranked and offered but always human-inserted' is correct on honesty but the discoverability fix (pinned practice packs as first thumb targets) is not spelled out.
- Dentist home carries five queues (exams, plans, notes to file, imaging without interpretation, Rx pending CSMD) — more surface than D1's single Exams-to-sign queue; risk of a card-grid creeping back in for the one persona who tolerates it least.
- No 'explain this balance' plain-language sentence renderer for the front desk (D3/D4 have it); the ledger explainer is named but not specified as a sentence-per-open-procedure output.
- Imaging (must-have #4) and patient communications (must-have #7) both land in Phase 4/v2; reporting is v1-nice. Front desk and owner wait on those.
- Phase 0 is 10 weeks and Phase 1 is 14 weeks before any money surface exists; the pilot practice runs two systems for most of a year.

### Item 3
- **design lens**: domain-data-model
- **score 0 10**: 7

#### strengths
- 'Explain this balance' is the single most front-desk-friendly idea in any design: one plain sentence per open procedure ('Crown #14 on 3/12: charged $1,180; Delta paid $590 on 4/2; contractual adjustment $190; you owe $400') with a running-balance toggle beside it — zero clicks to understand, one to print.
- Ledger view explicitly offers BOTH DOS-grouped itemized and running balance as a toggle over the same rows, matching the research's own reaction-test design (running vs itemized) instead of betting on one.
- 'One gesture, many records': painting a procedure on the odontogram writes tooth_condition, procedure, note scaffold and the pending charge, so staff never re-enter facts; anatomically impossible surfaces disabled at the control.
- Concrete tap budgets as acceptance tests: restorative visit charted and signed in ≤10 taps, checkout 4-6 clicks on one screen, full-mouth perio single-operator under 8 minutes in usability testing, ERA review-then-post never silent.
- Structural attachment (encounter NOT NULL on every clinical row) and GL-separated AR (patient vs insurance vs unapplied) mean the balance a biller sees can never be contaminated by estimates — the Oryx complaint is impossible by construction.
- Reporting numbers come from one set of views so totals never disagree across screens (Ascend 77% reporting-negative addressed).

#### weaknesses
- The front-desk Board is deferred to Phase 2 (weeks ~16-28): Phase 1 ships encounters, notes, odontogram and perio without scheduling, so the coordinator — the persona who owns chair turns and kills pilots when the board is not the front door — has nothing for the first ~6 months, and clinicians create encounters by hand.
- Double-entry journal with GL accounts, debit/credit lines and reason-coded reversals is the right skeleton for the CPA but a real readability risk for a front-desk temp if any debit/credit vocabulary leaks into the UI; the design asserts the patient view hides it but does not gate that with a usability probe until Phase 2's five-biller test.
- UX blueprint is the thinnest of the four relative to its data model: no command palette, no Radix/a11y commitment, no temp quick start or certification path, no per-role first-run spec, and hiring-pool familiarity is addressed only by 'one-day learnability' assertion.
- Perio voice is effectively absent until Phase 6 (browser dictation forbidden on PHI, on-device/BAA STT deferred), so the hygienist gets keyboard/pedal for the entire v1 life while incumbents ship voice perio.
- Variance clearance SoD ('the person posting payments cannot clear variances') is enforced as a hard rule — in a two-person office the office manager posts payments every day, so the owner must personally clear every variance or the control is disabled week one.
- Imaging bridge, compliance program, AI assist and reporting are all v1-nice; migration/interop is v2 — the first practice to switch has no conversion product.

### Item 4
- **design lens**: controls-trust
- **score 0 10**: 6

#### strengths
- Best answer to 'where do controls live' for daily users: the dual-release card appears inline on the refund/write-off form naming the eligible second approvers ('Dana or Dr. Reagan — request now'), the SoD conflict and one-sentence fraud path appear at the moment a role is granted, and 'this is your 3rd unapproved write-off this month' is an inline note with no name broadcast. The COSO heat map is explicitly 'the last screen an owner needs, not the first'.
- 'Recognition over recall via ranked, role-filtered starters (verified blocks, appointment types, reason codes) that are always visible, never behind a chip' is the only design that states the Curve Favorites discoverability fix as a rule.
- Two visual identities for irreversible record-committing actions (file, post, close) versus reversible transport actions (print, preview, copy) — lifted from the dental tokens and applied to money, which reduces wrong-button anxiety at checkout.
- Owner home is the most legible: 'Yesterday reconciled?' with three tender rows, one variance figure, one clear/investigate action, and detection lag shown in days; hard events (after-hours refund, waived dual control, new device) are the ONLY push notifications the product ever sends.
- Conversion tie-out-or-refuse go-live (opening AR must equal the incumbent to the cent) protects the biller from inheriting a ledger they cannot explain on day one.
- Setup wizard uses ROLE_TEMPLATES and shows the SoD conflicts each default creates before the first login — setup is the first assessment, no separate questionnaire.

#### weaknesses
- Sequencing is owner-first and clinician-last: Phase 1 is a financial layer run BESIDE the incumbent PMS (double entry of every payment for the OM for 12-14 weeks — the exact two-app tax the front-desk panel calls pilot poison), scheduling and claims arrive in Phase 2, and the clinical record (notes, odontogram, perio, treatment plans) does not exist until Phase 3, roughly month 12+. Hygienists and dentists have nothing to adopt for a year.
- Odontogram/perio and treatment plans are marked 'v1-nice' — contradicting the market's #2 must-have (labor-saving perio/notes), the hygienist JTBD, and the 60%-skip statistic the other three designs treat as core.
- Friction budget is heavier for daily flows: check-in requires a two-identifier confirmation tap (2 clicks vs 1), every second-approver tap requires MFA step-up, and hard SoD blocks ('a user who posted payments today cannot clear today's reconciliation') will lock out the office manager in a 1-owner/1-OM practice, forcing the owner into daily clerical work or disabling the control.
- 5-minute idle lock on operatory devices that actually kills the session is the shortest of the four and will fire mid-procedure while a DA has gloves on; the chairside panel's caret/focus complaints become session-loss complaints.
- Ledger default is a running view with itemized toggle, but the design never runs the D.8 ledger-reading probe until Phase 1's exit (after the ledger is built); primary interviews run in parallel rather than before.
- Communications, portal, imaging and AI are all Phase 4-5; reporting has no module and is folded into reconciliation — the OM's 'reports that match the bank AND the doctor's questions' is only half answered.

## Winner lens

persona-ux

## Graft ideas

- From mvp-sequencing: hygienist home opens directly into Perio when today's appointment type is hygiene, with the prior exam ghosted and the note pre-scaffolded from the appointment type; dentist home is a single 'Exams-to-sign' queue plus the seated chart, killer items hoisted to a ≤3-row strip.
- From mvp-sequencing: a keyboard perio grammar shipped in v1 regardless of STT status (1-9 depth, space = BOP, arrow = skip, undo-by-key, 168 sites in one continuous auto-advance pass) so hygienist speed never depends on an unbuilt voice engine; voice layers on through the DictationEngine seam.
- From mvp-sequencing: Cmd/Ctrl-K command palette that jumps to any patient, appointment, claim, report or ACTION by its plain name — the mechanism that neutralizes 'the hiring pool already knows Dentrix'.
- From mvp-sequencing: learnability as a product line — role-based first-run inside the work surface, a PUBLIC temp quick-start page, free self-serve certification drills verified by the real engine, and exit criteria that require observed usability sessions with at least one hygienist and one assistant.
- From mvp-sequencing: exactly one ledger view (never invoice-vs-ledger) and the balance always shown as three labeled numbers (patient due / pending insurance / estimated write-off), the same value on every screen.
- From mvp-sequencing: scheduled procedures pre-select note modules (structure only, never values); supervision validator refuses a hygiene booking with one line and one control ('New patient: needs a dentist exam before hygiene' → 'Add exam'); eligibility runs at 6am for the day and re-runs on arrival so check-in is a glance.
- From domain-data-model: 'Explain this balance' renders one plain-language sentence per open procedure from the allocation rows ('Crown #14 on 3/12: charged $1,180; Delta paid $590 on 4/2; contractual adjustment $190 (Delta PPO); you owe $400') — zero clicks to understand, one to print the statement.
- From domain-data-model: patient ledger offers DOS-grouped itemized AND running-balance as a toggle over the same rows, and the choice of default is made from the D.8 reaction test, not by the team.
- From domain-data-model: 'one gesture, many records' — a paint on the odontogram writes tooth condition + procedure + note scaffold + pending charge; anatomically impossible surfaces disabled at the control; adjacent-tooth mistap has one-tap undo.
- From domain-data-model: concrete tap/time budgets as phase exit criteria — restorative visit charted and signed in ≤10 taps, checkout on one screen in ≤4 clicks, full-mouth perio single-operator under 8 minutes, ERA review-then-post never silent with unmatched lines surfaced amber.
- From domain-data-model: a visible 'recorded vs enforced' table on the Controls screen so the owner and OM know exactly which controls will refuse and which merely report.
- From controls-trust: controls live inline in the workflow, never on a dashboard — dual-release card on the refund/write-off form naming eligible second approvers with one 'Request approval' control; SoD conflict + one-sentence fraud path + compensating control shown at the moment of role grant; 'your 3rd unapproved write-off this month' as an inline, un-broadcast note; heat map is the last owner screen, not the first.
- From controls-trust: recognition over recall — ranked, role-filtered starters (verified blocks, practice packs, appointment types, reason codes) always visible as first thumb targets, never behind a chip panel; this is the honest answer to Curve Favorites/QuickText for temps with an empty personal library.
- From controls-trust: two visual identities for irreversible record-committing actions (file, post, close day) versus reversible transport actions (print, preview, copy), applied to money surfaces as well as notes.
- From controls-trust: owner home reads 'Yesterday reconciled?' with three tender rows, one variance number, one clear/investigate action and detection lag in days; hard events (after-hours refund, retroactive edit, waived dual control, chain failure, new device on a financial role) are the ONLY push notifications the product sends — everything else is the batched digest.
- From controls-trust: conversion tie-out-or-refuse go-live (opening AR equals the incumbent to the cent) and setup-wizard-as-first-assessment using ROLE_TEMPLATES with conflicts shown before the first login is issued.
- From persona-ux (winner, keep as spine): Money Desk three-worklist biller home with one primary action per row; per-persona homes including the temp one-shift fast path; instrumented buy gates (ready→filed, perio completion, checkout taps, ERA auto-post, days-to-tie, ≥70% adoption, zero wrong-author); D.8 persona interviews and incumbent ledger-reading probes run in Phase 0 before the ledger is designed; Radix primitives for a11y; Andon slot = one verb line + one control.

## Disagreements between designs

- Phase sequencing by persona: clinical-record-first (mvp-sequencing, persona-ux, domain-data-model) vs money-and-controls-first with clinical in Phase 3 (controls-trust). Decides which daily user waits a year — the biller or the hygienist/dentist.
- When the front-desk Board ships: Phase 1 (mvp-sequencing, persona-ux, controls-trust Phase 2) vs deferred to Phase 2 after the clinical record (domain-data-model). A practice cannot run a day without the board.
- Whether ledger and insurance/claims ship in one phase (persona-ux bundles ledger + eligibility + 837D + 835 in Phase 2) or two sequential phases (mvp-sequencing and domain-data-model: ledger Phase 2, claims Phase 3), i.e. whether the OM is sellable at month ~9 or month ~11.
- Perio priority: v1-core (mvp-sequencing, persona-ux, domain-data-model) vs v1-nice (controls-trust). Odontogram and treatment plans likewise v1-core vs v1-nice.
- Perio voice at launch: voice-or-keys in Phase 1 contingent on an on-device/BAA STT started in Phase 0 (persona-ux) vs keyboard-first v1 with voice in v1.x (mvp-sequencing) vs keyboard/pedal only until Phase 6 (domain-data-model) vs unspecified (controls-trust).
- Ledger UI model: exactly one running view with allocation expanders (mvp-sequencing, persona-ux) vs running/itemized-by-DOS toggle over the same rows (domain-data-model, controls-trust). The owner's research proposes testing both; only persona-ux schedules that test before building.
- Ledger data model exposed to staff: double-entry journal with GL accounts and debit/credit lines (domain-data-model) vs single-entry append-only ledger_entries + explicit allocations (mvp-sequencing, persona-ux, controls-trust). Affects whether any accounting vocabulary can reach a front-desk screen.
- Pilot shape: financial layer run beside the incumbent PMS for 12-14 weeks (controls-trust) vs parallel-run of a full clinical day (mvp-sequencing, persona-ux) vs pilot only after Phases 1-4 (domain-data-model). Controls-trust's shape imposes the two-app tax the front-desk panel names as pilot poison.
- Check-in click budget: one tap 'Arrive' (mvp-sequencing, persona-ux) vs a required two-identifier confirmation tap making it two clicks (controls-trust); domain-data-model 1-2.
- Approval friction: one-tap approve with reason required only on decline (persona-ux, mvp-sequencing) vs MFA step-up on every second-approver tap (controls-trust).
- Hard SoD blocks in small offices: 'whoever posted payments today cannot clear today's reconciliation / variances' enforced as a refusal (controls-trust, domain-data-model) vs detect-and-require-a-decision with refusal only for critical role grants (mvp-sequencing, persona-ux). In a 1-owner/1-OM practice the hard rule forces the owner into daily clerical work or gets disabled.
- Operatory-device idle lock: 5 minutes with session kill (controls-trust) vs 10 minutes (domain-data-model) vs 15 minutes (mvp-sequencing); persona-ux unspecified 'shorter absolute session'. Shorter locks fire mid-procedure for gloved staff.
- Owner alerting: digest-only, never per-event (mvp-sequencing; persona-ux weekly digest) vs a small hard-event push channel for after-hours refunds, waived dual control, retroactive edits and new devices (controls-trust; domain-data-model partially via daily worklist).
- Primary user research timing: 24-30 persona interviews and incumbent ledger-reading probes in Phase 0 before the ledger is designed (persona-ux) vs interviews in parallel with Phase 1 build (controls-trust) vs no scheduled primary research, relying on pilot usability sessions (mvp-sequencing, domain-data-model).
- Dentist home density: one 'Exams-to-sign' queue plus seated chart (mvp-sequencing) vs killer-only finish queue (controls-trust) vs five queues — exams, plans to present, notes to file, imaging without interpretation, Rx pending CSMD (persona-ux); domain-data-model two queues.
- Command palette (Cmd-K to any patient/claim/action by plain name): included (mvp-sequencing) vs absent (all others).
- Accessible primitives: adopt Radix for select/dialog/combobox (persona-ux, controls-trust) vs not mentioned (mvp-sequencing, domain-data-model).
- Free self-serve certification and a public temp quick-start page (mvp-sequencing) vs in-product one-shift fast path only, no certification (persona-ux, controls-trust, domain-data-model).
- Patient reminders/confirmations (market must-have #7): v1 (mvp-sequencing v1-nice with reminders in v1) vs v2/Phase 4 (persona-ux, domain-data-model, controls-trust).
- Imaging bridge-and-store (must-have #4): v1-nice (mvp-sequencing, domain-data-model) vs v2 (persona-ux, controls-trust).
- Reporting: v1-core standalone module (mvp-sequencing) vs v1-nice (persona-ux, domain-data-model) vs no module, folded into reconciliation (controls-trust).
- AI assist: v1-nice with deterministic twins (persona-ux, domain-data-model) vs v2 (mvp-sequencing, controls-trust).
- Offline behavior for clinicians during an outage: read-only degraded mode, no writes (mvp-sequencing) vs read cache plus queued clinical note/perio capture reconciled on reconnect (persona-ux, domain-data-model, controls-trust).
- Pilot practice: Cornerstone three-location practice, one location first (mvp-sequencing; domain-data-model uses the same practice) vs unspecified single practice (persona-ux, controls-trust). Affects whether v1 UX is tuned for a 30-staff group or a 1-3 dentist office.
- Owner-visible person-scoped signals: viewable by owner and a coach/CPA seat (mvp-sequencing, persona-ux, domain-data-model) vs owner-private only (controls-trust). All agree on no ranking; they differ on who may open the person-scoped detail.
