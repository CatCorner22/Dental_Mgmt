# Feature judge 1: Office manager who has run Dentrix, Eaglesoft, and Curve and watched two conversions die: one on a ledger the billers could not read, one on staff who could not find yesterday's work on day three. I weight daily minutes saved at the desk, the Money Desk, and the chair, and intuitiveness measured as taps on the five daily flows. Anything that adds a tap to check-in, perio, chart-and-file, checkout, or ERA-and-close loses points regardless of how principled it is; anything that removes a phone call, a hallway walk, a re-key, or an owner question gains them. Screens nobody asked for (settings, toggles, telemetry cards, fake alarms) are penalized. Doctrine fit is scored against the plan's rules: deterministic first, no person scoring, controls enforced in the transaction, PHI only through a BAA-gated boundary, home is the work, one verb line plus one control, structural correctness over vigilance. Innovation is scored against the corpus (Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack, and the bolt-ons), not against the plan itself; features that merely restate the plan's module map get a middling innovation score even when they are essential.

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, judge, office-manager-who-has-run-dentrix-eaglesoft-and-c

## Summary

Scored 100 features on five criteria; 5 killed; 11 duplicate groups; top 25 listed.

## Judge lens

Office manager who has run Dentrix, Eaglesoft, and Curve and watched two conversions die: one on a ledger the billers could not read, one on staff who could not find yesterday's work on day three. I weight daily minutes saved at the desk, the Money Desk, and the chair, and intuitiveness measured as taps on the five daily flows. Anything that adds a tap to check-in, perio, chart-and-file, checkout, or ERA-and-close loses points regardless of how principled it is; anything that removes a phone call, a hallway walk, a re-key, or an owner question gains them. Screens nobody asked for (settings, toggles, telemetry cards, fake alarms) are penalized. Doctrine fit is scored against the plan's rules: deterministic first, no person scoring, controls enforced in the transaction, PHI only through a BAA-gated boundary, home is the work, one verb line plus one control, structural correctness over vigilance. Innovation is scored against the corpus (Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack, and the bolt-ons), not against the plan itself; features that merely restate the plan's module map get a middling innovation score even when they are essential.

## Scored


### Item 1
- **name**: Chairs card: what changed, what is due
- **lens**: hygienist
- **intuitiveness**: 5
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Zero-tap delta strip removes three screen visits per patient; diff only clinically typed fields or it becomes noise.

### Item 2
- **name**: Six-point grid with a personal probing path and any-HID pedal
- **lens**: hygienist
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: The one-operator perio answer without a voice add-on; driverless pedal and per-user path are what hygienists ask for and no incumbent ships.

### Item 3
- **name**: Glove pad: touch-only perio entry at 44 px
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Cheap fallback when the keypad is out of reach; eats 30% of a 10-inch tablet so it must stay a fallback, not the default.

### Item 4
- **name**: Screening lane with named omission licences
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Turns the blank chart into a twelve-keystroke record and routes full chart due into recall; the compliant path is faster than skipping.

### Item 5
- **name**: Save exam derives the note, the SRP quadrant evidence, and the claim attachment
- **lens**: hygienist
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 24
- **note**: Removes three rounds of retyping and the biller's perio-chart chase; the single best time saver across three personas.

### Item 6
- **name**: For-dentist tags: a licence-scoped handoff object
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Structures the handoff that today lives in prose; long-press is a hidden gesture, so give it a visible control too.

### Item 7
- **name**: Ready-for-exam queue with patient-scoped position
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Same object as the dentist's Exams-to-sign queue seen from the chair; merge, keep the 'Not today' unlock so notes are never held hostage.

### Item 8
- **name**: Recall prescribed at the chair, booked at checkout
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: One confirm tap at Save and one button at checkout stops the 6-month prophy default swallowing perio patients.

### Item 9
- **name**: Perio never loses a probe (durable autosave and honest reconnect)
- **lens**: hygienist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 19
- **note**: Honest offline for the one screen where re-doing the work is unacceptable; session-key survival across re-login is the hard part.

### Item 10
- **name**: Schedule honesty: documentation time versus the appointment template
- **lens**: hygienist
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Right lever (the template) and refuses the per-hygienist split by CI constraint; owners will still ask, and small practices rarely reach sample.

### Item 11
- **name**: Temp hygienist one-shift perio path and synthetic-mouth drill
- **lens**: hygienist
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 19
- **note**: Grammar strip is the first-shift rail; a fake patient card on a live Chairs list is a confusion risk, so fold the drill into the public certification.

### Item 12
- **name**: Voice perio, when it ships, is push-to-talk with quadrant read-back
- **lens**: hygienist
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 2
- **doctrine fit**: 5
- **total**: 17
- **note**: Correct posture (PTT, read-back, absent not greyed) but Phase 5, L effort, gated on a WER corpus and a BAA; the pedal grammar is the real product.

### Item 13
- **name**: Checkout queue with structural chips and a Filed-later lane
- **lens**: front-desk
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 24
- **note**: Ends the note-cop role: the coordinator checks out, the claim holds, and the pressure lands on the dentist's queue instead of the window.

### Item 14
- **name**: Open-the-day readiness strip
- **lens**: front-desk
- **intuitiveness**: 5
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Zero rows means zero taps; catches the lab case, the stale tablet author, and the unset temp before 8:00; cap it to today's chair-blockers.

### Item 15
- **name**: Eligibility at booking that shapes the reminder
- **lens**: front-desk
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: No added booking clicks and the reminder carries 'bring your card'; watch clearinghouse per-query fees with the 72-hour skip rule.

### Item 16
- **name**: Emergency booking contract with a provisional patient
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Three fields to book a swollen face, two-identifier rule enforced at chart open instead; provisional records need the 24-hour Money Desk row or they become duplicates.

### Item 17
- **name**: Location- and licence-aware slot validator
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 2
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 21
- **note**: Provider-at-other-location is standard in Dentrix; the supervision rule at booking with one control is the real delta and already in the plan.

### Item 18
- **name**: Degraded-mode paper day and reconnect catch-up worklist
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 3
- **feasibility**: 3
- **doctrine fit**: 4
- **total**: 18
- **note**: Bounded and honest; a printed sheet with estimates on the front desk is a PHI surface, default to initials; Phase 4.

### Item 19
- **name**: Temp first shift: named identity with an end date and an in-surface fast path
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Duplicate of the day pass plus the first-shift rail; keep its one-day default expiry.

### Item 20
- **name**: Shared-desk author PIN on Post
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Adds one field to Post only on shared desks; merge into the author bar but keep the PIN-on-the-Post-control placement so checkout stays inside 4 clicks.

### Item 21
- **name**: Checkout closes with a typed collection decision
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Collect is default so the common path adds nothing; the uncollected portion becomes a row the Money Desk sees today rather than an aging surprise.

### Item 22
- **name**: Waitlist fill from a cancellation, ranked deterministically
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 2
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 19
- **note**: ASAP lists exist everywhere; validating candidates through the booking gate is the modest, correct delta.

### Item 23
- **name**: Book from the plan card
- **lens**: front-desk
- **intuitiveness**: 4
- **innovation**: 1
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 18
- **note**: Dentrix, Eaglesoft, and Curve all schedule from the treatment plan; the FK carry-through is baseline plumbing, not a feature.

### Item 24
- **name**: Explain this balance at the window
- **lens**: front-desk
- **intuitiveness**: 5
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: The coordinator reads instead of guessing or waiving; duplicate of the two-voice Explain, keep the 'Show patient' flip and 'Send to biller' row.

### Item 25
- **name**: Record-bound claim pre-flight (procedure-to-finding binding)
- **lens**: biller
- **intuitiveness**: 4
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 22
- **note**: Only a PMS that owns perio_sites can do this; false blocks on legitimate care are the risk, so the clinical-judgement indication field and precision harness are mandatory.

### Item 26
- **name**: Attachment assembled from the encounter
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 21
- **note**: Two clicks and zero file naming replaces the NEA upload dance; radiographs wait on Phase 3 imaging import and the vendor BAA.

### Item 27
- **name**: ERA posting with contract-variance detection
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Green lines cost zero clicks and underpayment becomes a row instead of a patient call months later; degrade to 'no contract on file' amber when fee schedules are missing.

### Item 28
- **name**: Secondary claim fires from the primary ERA posting
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 2
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 20
- **note**: Dentrix auto-generates secondaries; the delta is COB filled from frozen 835 bytes and AR split by bucket rather than transfer lines. Required, not novel.

### Item 29
- **name**: Denial worklist with plain-language CARC, deterministic next action, and record-built appeal packet
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 22
- **note**: Appeal in one click with the packet built and write-off as the slow lane; the CARC-to-action table needs a maintainer and 'Bill patient' must require a PR group code.

### Item 30
- **name**: Statement is 'Explain this balance', with hold reasons
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Same sentences on the statement, the Rail, and the phone; hold reasons answer 'why didn't she get a statement' without a report. Needs a maximum hold age.

### Item 31
- **name**: Point-in-time ledger ('As of')
- **lens**: biller
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: One date chip on the only ledger view; free once the ledger is a journal, and it ends the 'what were they looking at' reconstruction.

### Item 32
- **name**: ERA EFT tied to the bank line by trace number
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 24
- **note**: Kills the insurance-day variance noise that makes owners stop reconciling; recoupments become one worklist row. Needs many-to-one tolerance.

### Item 33
- **name**: Credit-balance refund worklist
- **lens**: biller
- **intuitiveness**: 4
- **innovation**: 2
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 21
- **note**: Unapplied-credit reports exist; the aging row with refund routed through dual release is the correct Money Desk shape and already a planned tab.

### Item 34
- **name**: Payment and membership plans on adjudicated balances, with a deferred-revenue schedule for the CPA
- **lens**: biller
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Plans cannot be built on estimates by construction; deferred revenue must be a tenant setting because cash-basis practices will not want it.

### Item 35
- **name**: CPA month-end package with tie-out sheet and prior-period lock
- **lens**: biller
- **intuitiveness**: 4
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Two clicks to hand the accountant something that ties; the lock is structural. GL mapping per tenant is onboarding labor with the CPA.

### Item 36
- **name**: Claims aging with status re-check and exact-bytes resend
- **lens**: biller
- **intuitiveness**: 5
- **innovation**: 2
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 20
- **note**: The must-have tracker; exact-bytes resend and payer processing windows are the useful deltas. Degrade honestly when 276 is unavailable.

### Item 37
- **name**: Independence-graded Tied status
- **lens**: owner
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: The owner's one question with an honest half-circle when the same hands posted and closed; copy must describe the process, never the closer.

### Item 38
- **name**: Variance sentence with proposed match
- **lens**: owner
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Turns the three-report hunt into one sentence and two controls; cap subset-sum to same-tender rows in a two-day window or it invents matches.

### Item 39
- **name**: Held-posting phone card
- **lens**: owner
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Without this dual release is waived in week one; the denial-no-appeal line on the card is the dental-specific piece. iOS push needs home-screen install.

### Item 40
- **name**: Walk-over second signer
- **lens**: owner
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Replaces 'lean over and type my password' with two attributed identities in three taps; the most realistic dual-release path in a six-person office.

### Item 41
- **name**: Business-hours scope on dual release
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Converts the after-hours detector into a hold using existing machinery; per-location, per-weekday windows or evening clinics will waive it.

### Item 42
- **name**: Sealed closed day with visible corrections
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Yesterday cannot silently change; exempt late ERA postings from the 'changed after close' count or the line is always non-zero.

### Item 43
- **name**: Reconciliation drill
- **lens**: owner
- **intuitiveness**: 2
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 2
- **total**: 17
- **note**: Plants a fake bank line into the one tile whose doctrine is 'the bank is the only ground truth'; cry-wolf on the Tied status. The planted-skim test belongs in the simulated month.

### Item 44
- **name**: Decision review with measured effect
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Neglect tightens instead of loosens and the journal fills itself from gates; batch reviews monthly so it is one card, not five.

### Item 45
- **name**: Reason-code drift, practice-scoped
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Appears only when a detector fires and withholds the person dimension in code; link fee-schedule and plan changes in the window or it false-alarms.

### Item 46
- **name**: Sole-operator duty rotation
- **lens**: owner
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 20
- **note**: Names the duty, not the human, and closes on observed use; a two-person office cannot rotate and staff will still read it as suspicion.

### Item 47
- **name**: CPA seat with questions and attestations
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Gives the affordable independent reviewer a home and an honest external/attested column; the GL mapping must be editable or the first import fails.

### Item 48
- **name**: Tip channel with owner-exclusion routing
- **lens**: owner
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 19
- **note**: Routing around the owner is the right answer to management override; HR and defamation exposure means findings must cite rows, and a footer control on every home is a lot of chrome.

### Item 49
- **name**: Vendor and bank-detail change quarantine
- **lens**: owner
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: The fictitious-lab scheme becomes a state the payment path reads; the Friday-afternoon emergency vendor needs a 24-hour waiver.

### Item 50
- **name**: Delivery gate on patient-audience text
- **lens**: patient
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 19
- **note**: Adds a hold on File in Phase 3 before a portal exists; keep the refusal of empty-summary-with-claimed-delivery, defer word-level holds to the portal send.

### Item 51
- **name**: Plainer pass replaces Standardize on patient fields
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Removing the wrong tool from the box beats warning about it; pediatric dictionary needs a pediatric dentist's review.

### Item 52
- **name**: Family handoff: 'what helped' travels to the chair card and the summary
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Zero extra taps because the module comes with the appointment type; the chair-card line must never carry a behavior label.

### Item 53
- **name**: Estimate card the patient can read, frozen when shared
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: Duplicate of the plan card rule trace; keep the freeze-on-share and the 'estimate until your plan pays' header.

### Item 54
- **name**: Statement and portal balance that explain themselves
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 20
- **note**: Duplicate of the statement with hold reasons; keep the per-family-member labeling and adult-dependent confidentiality rules.

### Item 55
- **name**: Consent is a decision, not a signature
- **lens**: patient
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: Right legal object (decision, party, minor licences) but a chairside slowdown if every procedure demands it; scope by appointment-type contract and wait for counsel.

### Item 56
- **name**: Guardian access derived from relationships, with age-out
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 21
- **note**: One relationship row drives portal scope, release eligibility, and the 18th-birthday job; Phase 5 and jurisdiction-dependent.

### Item 57
- **name**: Intake that confirms, not re-asks, and lands as proposals
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 19
- **note**: Proposals with human accept is the doctrine; 'Still true' invites confirmation bias on meds and allergies, so those need explicit re-confirmation. Phase 5.

### Item 58
- **name**: Send path refuses a message without matching consent scope
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: The refusal costs the same tap as the send and lists the excluded 41; the PMS is the only place TCPA scope can be enforced. TCPA reading needs counsel.

### Item 59
- **name**: Records request: the clock starts on the writing, the bundle is a button
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: No balance-hold exists to bypass and the exit export doubles as the patient bundle; fee figures are unverified and DICOM bundles need streaming. Phase 4.

### Item 60
- **name**: Don't bill my insurance for this — one toggle at checkout
- **lens**: patient
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 24
- **note**: Zero clicks when unused, appears only when the fee is paid in full, and the scrubber refuses structurally; the cheapest real HIPAA right in the set.

### Item 61
- **name**: 'Where my record went' in the portal
- **lens**: patient
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 19
- **note**: Honest and novel, but routine payment disclosures will generate front-desk calls; purpose wording must be read-aloud tested. Phase 5.

### Item 62
- **name**: Why your plan paid less, in plain words
- **lens**: patient
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Answers the most common billing call with the same sentence on both sides of the desk; the honest 'we can't explain' fallback must stay.

### Item 63
- **name**: Event-verified first-shift rail
- **lens**: learnability
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Points at the live control and retires itself from real events; no tour modal, no homework. Anchor to the first card and honor reduced motion.

### Item 64
- **name**: Command palette with incumbent-vocabulary translation
- **lens**: learnability
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: 'Walkout' finds the statement and teaches the canonical word at the moment of use; the only answer to the Dentrix hiring pool that costs nothing per shift.

### Item 65
- **name**: Keys layer: inline single-key accelerators with a keyboard-only gate in CI
- **lens**: learnability
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: P/W/A on 200 ERA lines saves real minutes; the keyboard e2e suite is expensive and must stay blocking only for the five flows.

### Item 66
- **name**: Shape pack with a top-bar grayscale glance and a luminance test in CI
- **lens**: learnability
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 19
- **note**: The tokens and CI ordering test are Phase 0 work and correct; a Grayscale switch on every screen is chrome nobody asked for.

### Item 67
- **name**: Device-profile glove floor with miss-recovery
- **lens**: learnability
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: Server-known profile beats the pointer heuristic and the 44px CI check is structural; a 44px odontogram on a 10-inch tablet forces a quadrant zoom.

### Item 68
- **name**: Who's-charting PIN author bar with chair-strip initials
- **lens**: learnability
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Wrong-author is a pilot kill and this makes the author a server session with initials the coordinator can see from the Board; autosave must land first.

### Item 69
- **name**: Temp day pass from the Board readiness strip
- **lens**: learnability
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 24
- **note**: Three fields the night before from the strip where the gap shows, licence-templated, no money entitlements, self-revoking; the anti-shared-login.

### Item 70
- **name**: Free public certification drills verified by the production engines
- **lens**: learnability
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 2
- **doctrine fit**: 4
- **total**: 18
- **note**: Right idea and pass/not-yet only, but L effort, sandbox cost against a free offering, Phase 4, and owners will read the certificate as a credential.

### Item 71
- **name**: Accessible refusal contract: reasons and next steps as one spoken line
- **lens**: learnability
- **intuitiveness**: 5
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: One component for every refusal so staff learn the shape once; 'Held' as shape and word instead of a 40% fade is the plan's own rule made real.

### Item 72
- **name**: Gate-copy, type-floor, and terminology lint in CI
- **lens**: learnability
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 21
- **note**: Invisible to users but the reason the same word appears everywhere; the eight-word limit will fight counsel on some gates.

### Item 73
- **name**: Practice-scoped first-run friction card
- **lens**: learnability
- **intuitiveness**: 2
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 2
- **total**: 15
- **note**: A card nobody asked for and '3 of 4 new writers' names a person by elimination in a small office; keep the PHI-free pipeline, drop the card.

### Item 74
- **name**: In-place confirm for irreversible actions with object read-back
- **lens**: learnability
- **intuitiveness**: 2
- **innovation**: 2
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 2
- **total**: 16
- **note**: Adds a tap to every File, Post, and Close day against the 4-click and 10-tap budgets; delta-only readbacks and two visual identities already cover the mis-tap.

### Item 75
- **name**: Explain this balance, two voices from one row set
- **lens**: ai
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: Biller, patient, and CPA read the same rows three ways so they cannot disagree; fail CI when a reason code has no template.

### Item 76
- **name**: Claim narrative pre-flight bound to CDT lines at checkout
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Duplicate of record-bound pre-flight; its contribution is showing the satisfying evidence span at checkout while the patient is still in the building.

### Item 77
- **name**: Narrative by quotation
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Kills narrative retyping and the second version of the truth with no model at all; refusing to invent the missing sentence is the control.

### Item 78
- **name**: Chart, note, and claim contradiction stop with side-by-side spans
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 22
- **note**: Denial preventer and wrong-site control in one gate; a false S0 on SRP quadrants would teach staff to tap through, so the claim-line corpus must exist first.

### Item 79
- **name**: Readback on bulk ERA posting, scoped to what differs
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: Clean batches stay one click and only the surprising lines ask; the delta threshold and eight-item cap need pilot ERA files to tune.

### Item 80
- **name**: Section-scoped suggested blocks rail
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 2
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 21
- **note**: This is the plan's 'ranked, role-filtered starters always visible' with a golden test; essential, not novel. Never pre-check assertions.

### Item 81
- **name**: Check-your-note finish summary with killer hoist
- **lens**: ai
- **intuitiveness**: 3
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 3
- **total**: 18
- **note**: Adds a step to File that the killer-strip-plus-one-button gate already covers; a clean note must cost one tap, not two. Merge.

### Item 82
- **name**: Scoped readback on Accept for standardize and assist proposals
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Silent unless a tooth, dose, or laterality changed; refuse proposals that change more than eight high-stakes tokens rather than paging.

### Item 83
- **name**: Could-not-read spans and tenant vocabulary proposals
- **lens**: ai
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 4
- **total**: 20
- **note**: Honest and versionable, but dotted underlines while typing edge toward spellcheck noise and validating before blur; density threshold per role.

### Item 84
- **name**: Gate-side controls explainer
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Duplicate of the refusal contract; its 'Why' paragraph rendering the live threshold from the policy row is worth keeping.

### Item 85
- **name**: Owner controls coach over role labels with read-only tools
- **lens**: ai
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 2
- **doctrine fit**: 4
- **total**: 17
- **note**: Deterministic simulator first is right; the model half is Phase 5 behind a BAA and inherits directional numbers owners may mistake for CPA advice.

### Item 86
- **name**: Verifier-gated narrative and note rewrite with named refusals
- **lens**: ai
- **intuitiveness**: 3
- **innovation**: 4
- **phi safety**: 3
- **feasibility**: 2
- **doctrine fit**: 5
- **total**: 17
- **note**: Named refusals beat 'no suggestion' and the twin is always present; provider BAA and false-refusal rate on real notes are unproven. Phase 5.

### Item 87
- **name**: AI switch that shows its twin
- **lens**: ai
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: A settings page, but the one that makes 'included or off, never metered' visible and CI-enforced; cheap and it answers the tab32 fear directly.

### Item 88
- **name**: Exams-to-sign queue ordered by chair wait, framed by hygiene findings
- **lens**: dentist
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: The dentist lands on who is waiting and why; rows leave only by filing. Keep wait as plain duration with no color escalation.

### Item 89
- **name**: Paint once, write four records
- **lens**: dentist
- **intuitiveness**: 5
- **innovation**: 5
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 23
- **note**: Four entries of the same fact become one gesture with FK parents; L effort and the central correctness surface of the clinical port.

### Item 90
- **name**: Temporality selector: today, planned, or existing work, set by a human
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 23
- **note**: Default follows the appointment type so the common case is zero taps; Existing creates no charge by construction, which closes an upcoding path.

### Item 91
- **name**: Scoped readback at File with chart mirror
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 21
- **note**: Same S0 as the contradiction stop rendered as a six-row list plus mirror; merge, keep the dose and carpule rows.

### Item 92
- **name**: Plan card with three-number estimate and a one-sentence rule trace
- **lens**: dentist
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 23
- **note**: The front desk can finally defend an estimate; the trace must say 'not returned by carrier' rather than guess frequency limits.

### Item 93
- **name**: Case presentation that records the decision, including the refusal
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 21
- **note**: Informed refusal as a record instead of a case-acceptance scoreboard; the decline field must be one-tap-editable or Decide later swallows everything.

### Item 94
- **name**: Dollar amounts in note text are a finding with a one-control fix
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 5
- **feasibility**: 5
- **doctrine fit**: 5
- **total**: 22
- **note**: Silent until blur, one control moves the quote to the plan card; require a currency cue or '#14 3 mm' false-fires.

### Item 95
- **name**: Referral packet with four required slots and a specialist-facing preview
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 3
- **phi safety**: 4
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 20
- **note**: One card, no wizard, and the missing interpretation is a hold not a blank; the send path is print-and-fax until the eFax BAA in Phase 4.

### Item 96
- **name**: Referral loop closure through inbound report intake and a dentist disposition
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: Receipt is not closure and only a licence can close the loop; overdue rows need per-type due dates or they get ignored.

### Item 97
- **name**: Lab case spawned from the paint gesture and enforced at the seat booking
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 4
- **doctrine fit**: 5
- **total**: 22
- **note**: 'Case not back' on the Board card before seating plus lab invoices through the vendor channel; the booking gate must be a hold with override.

### Item 98
- **name**: Filing gate: killer strip of at most three rows, one File button, licence-locked sections
- **lens**: dentist
- **intuitiveness**: 5
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 22
- **note**: The hygienist builds, the dentist signs past three rows and one button; the killer list is a policy lock that must be frozen with counsel.

### Item 99
- **name**: Amendment as replace-never-edit, with token changes propagating as correction rows
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 5
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 21
- **note**: The claim correction is created by the addendum, not remembered by the biller; late entries must show entry time and DOS distinctly.

### Item 100
- **name**: Imaging interpretation from the tooth, queued until a dentist owns it
- **lens**: dentist
- **intuitiveness**: 4
- **innovation**: 4
- **phi safety**: 4
- **feasibility**: 3
- **doctrine fit**: 5
- **total**: 20
- **note**: Ends '4 BWs taken' with no read; tooth tagging must be a fast hygienist tap or the queue row loses its tooth. Depends on Phase 3 import.

## Duplicates


### Item 1
- **keep**: Explain this balance, two voices from one row set

#### merge
- Explain this balance at the window

### Item 2
- **keep**: Statement is 'Explain this balance', with hold reasons

#### merge
- Statement and portal balance that explain themselves

### Item 3
- **keep**: Exams-to-sign queue ordered by chair wait, framed by hygiene findings

#### merge
- Ready-for-exam queue with patient-scoped position

### Item 4
- **keep**: Who's-charting PIN author bar with chair-strip initials

#### merge
- Shared-desk author PIN on Post

### Item 5
- **keep**: Temp day pass from the Board readiness strip

#### merge
- Temp first shift: named identity with an end date and an in-surface fast path

### Item 6
- **keep**: Event-verified first-shift rail

#### merge
- Temp hygienist one-shift perio path and synthetic-mouth drill

### Item 7
- **keep**: Record-bound claim pre-flight (procedure-to-finding binding)

#### merge
- Claim narrative pre-flight bound to CDT lines at checkout

### Item 8
- **keep**: Plan card with three-number estimate and a one-sentence rule trace

#### merge
- Estimate card the patient can read, frozen when shared

### Item 9
- **keep**: Accessible refusal contract: reasons and next steps as one spoken line

#### merge
- Gate-side controls explainer

### Item 10
- **keep**: Chart, note, and claim contradiction stop with side-by-side spans

#### merge
- Scoped readback at File with chart mirror

### Item 11
- **keep**: Filing gate: killer strip of at most three rows, one File button, licence-locked sections

#### merge
- Check-your-note finish summary with killer hoist

## Kill list


### Item 1
- **name**: In-place confirm for irreversible actions with object read-back
- **reason**: Adds a second tap to every File, Post, and Close day, which breaks the ≤4-click checkout and ≤10-tap restorative budgets on three of the five daily flows. The plan's answer to mis-taps is two visual identities plus readbacks that appear only when a high-stakes token differs (ERA delta readback, chart/note/claim stop); a confirm on every commit is the modal-by-reflex problem in a new shape.

### Item 2
- **name**: Practice-scoped first-run friction card
- **reason**: A digest card nobody asked for, and in a four-to-six-person office '3 of 4 new writers needed the rail for Checkout' identifies the fourth person by elimination, which is a per-person signal under the no-scoreboard doctrine. The PHI-free metrics pipeline is already a Phase 0 deliverable for the vendor; ship that, not an office-manager-facing card.

### Item 3
- **name**: Reconciliation drill
- **reason**: Plants a synthetic bank line into the owner's 'Yesterday reconciled?' tile, the one surface whose rule is that the bank is the only independent ground truth and green is never a self-assertion. A fake variance trains the owner and manager to distrust 'N variances' and wastes the manager's morning. The planted-skim detection test already exists as a Phase 1 exit criterion in a simulated month, which is where it belongs.

### Item 4
- **name**: Book from the plan card
- **reason**: Table stakes dressed up: Dentrix, Eaglesoft, and Curve all schedule directly from the treatment plan with duration and provider. The FK from appointment to plan item is baseline plumbing that the Board and plan modules must have anyway, not a differentiating feature; fold it into the scheduling baseline and stop counting it.

### Item 5
- **name**: Shape pack with a top-bar grayscale glance and a luminance test in CI
- **reason**: The shape+word+luminance tokens and the CI ordering test are correct and already Phase 0 work. The user-facing half, a 44 px Grayscale switch in the top bar of every screen, is chrome nobody asked for that duplicates a check the build runs; keep the tokens and the test, remove the toggle from the proposal.

## Top 25

- Checkout queue with structural chips and a Filed-later lane
- ERA posting with contract-variance detection
- Denial worklist with plain-language CARC, deterministic next action, and record-built appeal packet
- ERA EFT tied to the bank line by trace number
- Explain this balance, two voices from one row set
- Held-posting phone card
- Walk-over second signer
- Independence-graded Tied status
- Variance sentence with proposed match
- Six-point grid with a personal probing path and any-HID pedal
- Save exam derives the note, the SRP quadrant evidence, and the claim attachment
- Paint once, write four records
- Filing gate: killer strip of at most three rows, one File button, licence-locked sections
- Exams-to-sign queue ordered by chair wait, framed by hygiene findings
- Record-bound claim pre-flight (procedure-to-finding binding)
- Open-the-day readiness strip
- Eligibility at booking that shapes the reminder
- Who's-charting PIN author bar with chair-strip initials
- Command palette with incumbent-vocabulary translation
- Statement is 'Explain this balance', with hold reasons
- Chairs card: what changed, what is due
- Checkout closes with a typed collection decision
- Temp day pass from the Board readiness strip
- CPA month-end package with tie-out sheet and prior-period lock
- Point-in-time ledger ('As of')
