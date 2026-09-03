# Feature catalog critique

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, critique

## Summary

8 gaps, 12 doctrine conflicts, 9 over-promises, 10 strongest points.

## Gaps


### Item 1
- **area**: Owner / office manager — multi-location Daily Close
- **missing**: The Phase 1 pilot is mandated as one tenant covering all three Cornerstone locations (docs/08 dependencies and contingency), yet every close/reconciliation feature (Independence-graded Tied status, Variance sentence, Sealed closed day, EFT-by-TRN) is written for one practice, one bank account, one closer. Staff rotate between sites, a payment taken at location A is often deposited from B, and locations.hours is the only per-location field the catalog adds. Without location-scoped closes the reconciliation metric Phase 1 exists to validate is contaminated by pilot-boundary artifacts, which is exactly what docs/08 warns about.
- **suggested feature**: Location-scoped close (Phase 1, S/M): day_closes, deposits, and reconciliation_runs keyed by (location, bank_account); the owner's Tied tile renders one row per location that collapses to a single glyph when all tie; a cross-location deposit is a typed inter-location transfer row with both frozen actors, never a variance; the runtime SoD rule (poster/depositor cannot clear) evaluates per location-day; hours scope already per location so the same key works.

### Item 2
- **area**: After-hours / emergency dentist (panel R)
- **missing**: The catalog's only emergency item ('Emergency booking contract with a provisional patient') was parked to docs/11. Nothing addresses the swollen-face walk-in at 21:40: no appointment-type behavior contract for emergency that pre-selects the emergency, imaging, and medication modules with starters visible on open, no one-motion path from the Board to a chart for a patient who has no record yet, and no answer to a solo dentist on a shared tablet with no coordinator to absorb the delay. The filing gate's ≤3-row strip helps only after the dentist has already shopped modules.
- **suggested feature**: Emergency visit contract (Phase 3, S): appointment_types.behavior_contract kind 'emergency' opens the encounter with the emergency module set pre-selected and ranked starters visible with zero taps, orders fields chief problem → airway/swelling screen → site → working diagnosis → what was done → escalation, and resolves the two-identifier rule for a walk-in by minting a provisional patient from name + DOB entered at the door (merge-as-event later). Killers stay hard; no soft mode.

### Item 3
- **area**: Referring dentist, coordinator, and receiving specialist (panel K)
- **missing**: docs/01 lists referrals with the four-slot packet gate and loop closure as v1-core and docs/08 puts them in Phase 3, and the changes_to_plan mention 'imaging-without-interpretation on referral send', but no catalog feature specifies the flow. The specialist's daily reconstruction tax ('Referral placed', no ask, no urgency, no interpretation, no loop) and the GP office's forgotten-fax pattern are both unaddressed on any surface.
- **suggested feature**: Referral packet from the encounter (Phase 3, M): 'Refer' on the plan card opens four required slots (to whom from the specialist directory, clinical ask as finding → requested action, urgency, records forwarded pre-checked from the encounter's documents and interpreted images); Send refuses while an attached image lacks a dentist interpretation; the send is a disclosure row; a referrals row with a due date lives on the Board's worklist until the specialist's report is attached or a reason-coded closure is recorded.

### Item 4
- **area**: Front-desk coordinator and biller — eligibility as a typed object
- **missing**: Report A.6.1 #1 and D.4 #1 make real-time eligibility the primary daily challenge (71% in Zentist), yet the catalog's only eligibility touches are a 'Re-run' row on the readiness strip and a 'Benefits verified 2 Sep' line on the plan card. The 'Eligibility at booking' feature was rejected as core scope without any spec for how a 271 populates deductible remaining, annual max remaining, frequency history, waiting periods, and coverage rank, or how those feed the checkout patient portion and the plan-card estimate that the Explain sentences quote.
- **suggested feature**: Eligibility snapshot as the estimate's typed input (Phase 2, M): 271 parsed into a versioned eligibility_snapshots row (deductible/max remaining, frequency limits with last-service dates, waiting periods, network status, coverage rank), rendered as the benefits drawer the docs promise and consumed by the estimate engine's rule trace; unreturned fields state 'not returned by carrier'; the Board badge, checkout estimate column, and plan card all read the same snapshot id.

### Item 5
- **area**: Clinician who cannot type (RSI panel Q) and the chairside DA (panel S)
- **missing**: Voice is Phase 5 and every voice item in the catalog was rejected. Between GA and Phase 5 a dentist or hygienist with RSI has no accommodation: 168 perio keystrokes, free-text narrative, and a 44 px pad all assume hands that can type. The DA's 'caret stays put' demand (no validation or navigation stealing focus mid-word while the drill runs) is also unstated; 'validation silent until blur' covers findings but not audit jumps, palette recents, or chip inserts.
- **suggested feature**: Typed-object composition path and focus-retention rule (Phase 3, S): every module's common visit can be completed from ranked starters, pickers, and pedal/keys navigation with zero free typing (a CI test per module); the gate contract adds a Playwright assertion that no control moves focus while a field is dirty except by the user's own 'Go to' action; and the Phase 3 speech-engine decision is brought forward with the honest label 'browser speech unavailable on PHI fields; on-device engine pending'.

### Item 6
- **area**: Office manager / team lead — the weekly coaching instrument (panels X, H fix #5)
- **missing**: docs/05 describes a weekly digest with acknowledgment stamping, but no catalog feature gives the office manager the '90-second practice coach card' both the QA-lead and front-desk panels demanded: which one practice-level pattern to fix this week (open killer categories, licence-usage mix, statement holds, notes filed after checkout, reason-code drift) with one action that changes a starter, template, policy row, or appointment-type contract. Without it the digest is the 'unread oversight cosplay' the panels name.
- **suggested feature**: Practice coach card (Phase 3, S): the digest opens on ≤3 practice-scoped rows under SYSTEMIC_SHARE and minimum-sample gating, each with one control that edits the cause (starter, module preselection, control policy, template) under maker-checker; ack stamps the row; no row ever carries a person, and the query layer has no provider dimension (CI-tested, same as the schedule-honesty constraint).

### Item 7
- **area**: Everyone during an outage (report A.6.1 #3 and #4)
- **missing**: Cloud reliability and support-during-failure are the #3 and #4 complaints in the corpus and 'documented degraded mode' is a named unmet need, yet the catalog contains nothing for the moment the Board or Money Desk cannot reach the server with a full lobby. The read-only degraded mode is Phase 3 and the paper-day feature was rejected to Phase 4, so Phase 2 (when the Board becomes the daily surface) ships with no specified outage state.
- **suggested feature**: Andon outage state (Phase 2, S): the top-bar Andon slot's server-unreachable state says what still works ('Board read-only from 9:41 cache; no payments, no filing'), shows the status page incident id and the printed support line and SLA already promised in-app, and the Board renders from the last successful fetch with a stamped age; nothing writes.

### Item 8
- **area**: Guardian of a minor (panel O)
- **missing**: The patient-voice templates in Explain → Show patient, statements, and the case-presentation Present view all address 'you' ('your plan pays', 'We cleaned your teeth'). For a pediatric patient the reader is the guardian, and the parent panel's core complaint is a template that forgot who is reading. Pediatric plain words (pulpotomy, SSC, SDF, sealant, space maintainer) are recorded only as a docs/11 review item.
- **suggested feature**: Audience 'guardian' in the patient-voice template set (Phase 3, S): when the account's patient is a minor the audience parameter resolves to guardian-addressed copy ('here is what we found for your child'), the pediatric plain-word table is required before any pediatric appointment-type contract can be enabled, and the stigma list gains the kid/parent-blame register as a delivery stop on patient-audience text.

## Doctrine conflicts


### Item 1
- **feature**: Business-hours scope on dual release × ERA posting (matched lines already posted) × Sealed closed day
- **conflict**: The hours scope holds every write-off outside business hours 'regardless of amount', excluding only processor-initiated refunds. The ERA feature has the worker post insurance payments and computed contractual write-offs overnight, before the biller sits down. Read together, every overnight 835 produces dozens of needs_second write-offs, so either nothing auto-posts or the owner's phone fills with held postings at 2 am. The same overnight write-offs are not excluded from 'Yesterday changed after close' (only insurance_payment entries are), so the count is never zero on insurance days.
- **fix**: State that the hours scope and the changed-after-close count apply only to human-actor postings (domain_event actor is a user, not the pg-boss worker) and that computed contractual write-offs carry actor=worker plus era_line FK; add a CI test that an overnight 835 fixture produces zero approval_requests and zero changed-after-close rows.

### Item 2
- **feature**: Sealed closed day with visible corrections × Checkout queue Filed-later lane × principle 2
- **conflict**: Principle 2 says 'corrections are reversal plus repost'; the catalog introduces a third pattern, a single kind='correction' entry with corrects_entry_id. Worse, the correction spec redirects any posting whose effective date falls in a closed day, and the Filed-later lane releases charges when the note is filed, which for a patient checked out at 5:50 pm is usually the next morning with effective date = date of service. Every late-filed encounter would demand a reason code from the dentist at File and inflate the owner's 'Yesterday changed after close' tile, normalising the very count that is supposed to catch retro-dated edits.
- **fix**: Define a correction as a reversal entry plus a repost entry both carrying corrects_entry_id (or amend principle 2 explicitly); exempt charge releases whose encounter DOS equals the closed day and whose actor is the File event (they are first postings, not corrections), and count them separately as 'Charges released after close: N' at practice scope.

### Item 3
- **feature**: CPA month-end package and CPA seat
- **conflict**: The CPA is an outside firm. The package itself is PHI-minimal, but the seat is granted patient-level drill-down as 'a logged payment-purpose read under the CPA's BAA' with nothing gating the seat on a BAA row. Principle 15 and the Phase 0 registry primitive require a countersigned BAA row before any connector is enabled; an external human seat that can open ledgers is the same boundary.
- **fix**: Split the seat: aggregate package + question + attest need no BAA and carry payer ids and TRNs only; the drill-down and bank_reconcile-with-names entitlements are refused at grant time until a BAA row for the firm exists in integration_registry, with the refusal rendered through the same Refusal component ('Needs a countersigned BAA for Smith & Co — Add BAA').

### Item 4
- **feature**: Temp day pass and the event-verified first-shift rail
- **conflict**: The temp 'signs in on her own phone via magic link plus TOTP and lands on the Board for this location', a surface listing patient names, balances, and coverage. That is PHI on an unmanaged personal device by design, the IT panel's 'browser = unmanaged PHI workstation class' kill, and it bypasses the device registry, privacy mode, and the wipe-on-switch controls the PIN-author feature builds. first_run_state is also a per-person step-completion table, which is fine only if it is never readable by anyone but that user.
- **fix**: The personal phone is the authenticator, not the workstation: the magic link enrols identity and TOTP; the Board opens only on a registered desk or operatory device where the temp enters her PIN (same path as the author bar), or on a personal device in privacy mode with initials only and no chart open. Put first_run_state under an RLS policy scoped to the owning user and exclude it from every aggregate.

### Item 5
- **feature**: Checkout closes on a typed collection decision
- **conflict**: 'Post is disabled until one is chosen; Collect with $0 is not allowed.' A patient whose portion is $0 (fully covered prophy, membership prepaid, prior credit) has no valid choice: Send statement writes a statement_due for $0 and Payment plan is absurd. That is a dead end at the gate and an added forced tap on flow 4, both of which principle 11 and the ≤4-click acceptance forbid.
- **fix**: Derive a fourth state: when the patient portion is $0 the control renders 'Nothing due today' pre-selected and Post is enabled at zero extra taps; the typed decision row records reason 'zero_due' so the practice-level 'Not collected at window' line stays honest.

### Item 6
- **feature**: Record integrity: chart/note/claim contradiction stop
- **conflict**: 'A dentist may record a reason-coded override' of the S0 contradiction. killers.ts and verifyMeaning.ts say wrong-site is an S0 STOP everywhere with 'no checkbox ack escape', and the catalog's own Filing gate hard-blocks killers. An override leaves a filed record whose note, chart, and claim disagree, which is the plaintiff exhibit the feature exists to prevent.
- **fix**: Remove the override. The only exits are the three 'Use this' controls (each corrects one source through its normal path) and the CDT quadrant/multi-tooth mapping that prevents false fires; if a legitimate case cannot be expressed, it becomes a rule change under RULESET_VERSION, not a per-note escape.

### Item 7
- **feature**: Save exam derives the note and the recall prescription
- **conflict**: The Next visit strip is 'pre-filled from the tenant's rule (interval 3/4/6 months, type Prophy or Perio maintenance)' from exam values. Pre-selecting Perio maintenance (D4910) from pocket depths is a softer version of the 'tap a quadrant to add D4341' line the attorney killed: software proposing a billable service class from numbers. It also adds a confirm tap to flow 2, whose acceptance is 'Save exam (1 tap)'.
- **fix**: Pre-fill interval and imaging due from the labelled practice rule, default the type to the current appointment's type (recognition), and offer Perio maintenance as an unselected option that the hygienist chooses or the dentist's plan sets; apply the strip on Save with edit optional so the common path stays one tap.

### Item 8
- **feature**: Plan card with a rule-traced estimate; case presentation
- **conflict**: Present renders 'what happens if we wait / other options including no treatment' in patient voice. Unless those sentences are dentist-authored or dentist-selected from a counsel-reviewed per-procedure library, the software is stating prognosis, which implies clinical judgment ('deterministic first, model second, human always' does not license the PMS to say what happens without treatment). The patient also taps and signs on the clinician's authenticated operatory session, with no described hand-off mode.
- **fix**: Consequences-of-waiting and alternatives come only from a tenant library the dentist picks and edits per item (stamped, versioned, labelled provisional until TN counsel review), never derived; Present runs in a patient hand-off mode that locks every control except the decision buttons and signature, and returns to the clinician's session only through the author chip PIN.

### Item 9
- **feature**: Who's-charting PIN author bar (desk profile: PIN on Post)
- **conflict**: On a shared desk the session belongs to whoever logged in with MFA (coordinator A); coordinator B posts money by typing a 4-digit PIN into A's session, and the frozen poster becomes B. A financial posting's attribution then rests on 10,000 combinations entered into someone else's authenticated session, weaker than the operatory path (≥6 digits, new session) and weaker than the unique-identity and MFA promises in docs/05 and docs/06.
- **fix**: Use the same mechanism as the operatory: the desk PIN (≥6 digits, argon2id, throttled) resumes or mints B's own server session for the single posting (the 60-second single-entitlement session already designed for walk-over approvals), so the frozen poster is a session owner, not a PIN annotation on A's session.

### Item 10
- **feature**: Record-bound claim pre-flight and narrative by quotation
- **conflict**: 'The biller may delete a quoted clause but typing requires Edit freely.' Deleting a contraindicating or qualifying clause from a verbatim quotation is selective quotation, the insurance auditor's 'story tailored for pay' through omission, and it leaves the narrative labelled quoted rather than manual.
- **fix**: Deletion of any clinical clause flips narrative_kind to manual exactly as typing does; only fixed connectives may be removed while keeping the quoted flag; the 837 flag and the practice-level denial-by-narrative-kind comparison then stay honest.

### Item 11
- **feature**: Second approver from a phone or the next desk
- **conflict**: docs/01's reconciliation row says 'hard events are the only push notifications the PMS sends'; this feature adds a second push class (approval requests). The Phase 1 scope in docs/08 wants a phone approval within minutes, so the two documents already disagree and the catalog silently picks one.
- **fix**: Amend the docs/01 sentence to 'hard events and approval requests are the only push notifications', keep the payload to a request id, and record it as a principle 14 change in changes_to_plan rather than leaving the contradiction for the pilot agreement.

### Item 12
- **feature**: One ledger view: statements
- **conflict**: Adult dependents' procedure names are withheld from the guarantor statement only 'when confidential-communication preferences say so'. The default should be minimum necessary: an adult on a parent's account has not authorized procedure-level disclosure to the guarantor by being on the account.
- **fix**: Default adult-dependent lines on guarantor statements to amount and date only, with procedure names shown only when a recorded authorization or the dependent's own preference allows; the self-pay-restricted exclusion already works this way.

## Over promises


### Item 1
- **feature**: Signature moments 'Tied by 7:42' and 'The $410 write-off' as Phase 1 experiences
- **why**: Phase 1 is a shadow ledger fed by report import from Curve Hero; refunds and write-offs are still posted in the incumbent (docs/08 risk table and pilot agreement), 835s do not enter the PMS until Phase 2, and the aggregator feed is enabled 'when its agreement is signed' with statement import as the floor. So in Phase 1 the Delta EFT is not matched by trace number, the $410 write-off in Curve is not held, and with monthly statement import the Tied tile is 'stale_import' most mornings.
- **honest version**: Phase 1: the owner sees an independence-graded Tied status over imported day sheets and deposits with EFTs matched manually or by amount; dual release holds postings entered in the PMS's own ledger; 'changed after close' means 'import delta since last import'. The moments as written become Phase 2 exit demonstrations.

### Item 2
- **feature**: Record-bound claim pre-flight and narrative by quotation (Phase 2)
- **why**: The rules read chart_events, perio_sites, imaging interpretations, and filed-note spans, none of which exist until Phase 3 (odontogram, perio, and the Smile Notes core all port in Phase 3). In Phase 2 the only satisfiable rule is attachment presence, which is core scrubber scope. Narrative by quotation has no filed note to quote.
- **honest version**: Phase 2 ships the CDT-triggered scrubber with attachment-presence and form rules stamped RULESET_VERSION; record-bound rules (SRP perio evidence, crown finding class, extraction imaging) and Build-narrative-from-note land in Phase 3 with the clinical record, gated on the claim-line corpus.

### Item 3
- **feature**: Six-point perio: 'every keystroke autosaves to the encrypted session-bound draft mirror'
- **why**: The same feature says the draft mirror is disabled on shared devices, and operatory tablets are shared by definition (the PIN author bar exists because of it). Server-side autosave per keystroke is 168 guarded, RLS-scoped, hash-chained writes per exam; a wifi blip mid-quadrant loses unsynced probes, which is the rejected 'never loses a probe' feature's exact problem.
- **honest version**: Autosave to the server per tooth (six sites) with an on-screen 'saved to tooth #N' stamp; the local mirror exists only on personal devices; a reconnect resumes at the last saved tooth and says which sites must be re-probed.

### Item 4
- **feature**: Gate contract in code and CI (Phase 1): Playwright runs the five daily flows pointer-disabled; density from sessions.device_profile
- **why**: In Phase 1 only fragments of flows 4 and 5 exist (no Board, no encounter, no perio), and the device registry that device_profile depends on is a Phase 3 table in the same catalog. The keyboard-only five-flow test is already a Phase 3 exit criterion in docs/08.
- **honest version**: Phase 1 ships the Refusal component, tokens, copy lint, and bounding-box check on the ledger and approvals inbox; the five-flow pointer-disabled run completes at Phase 3; density is per-user preference plus viewport until the device registry exists.

### Item 5
- **feature**: Second approver phone card: push, 'target median under five minutes'
- **why**: iOS web push requires home-screen installation and notification permission; a dentist's personal phone in an operatory is often silenced or pocketed; the Eng judge already noted the inbox fallback. The Phase 1 exit criterion is one approval under five minutes in a simulated month, which the median claim quietly generalises.
- **honest version**: Push where the installed web app supports it, an SMS/email nudge carrying only the request id as the fallback, and the approvals inbox with visible age as the floor; the measured metric is median time-to-decision reported at practice scope, with the five-minute figure a Phase 1 pilot target, not a promise.

### Item 6
- **feature**: Open-the-day readiness strip and signature moment 'The temp at 7:50': 'Tomorrow: front desk has no coordinator', '1 chair with no writer'
- **why**: Knowing that a chair or the front desk is uncovered tomorrow requires a staff shift roster per role per location per day. Nothing in docs/03 or the catalog's data-model changes adds one; provider templates cover dentists' operatory time only, and hygiene columns are inferred from appointments, not staff.
- **honest version**: The strip can flag a provider template with no operatory and a hygiene appointment whose provider has no active entitlement at that location; 'front desk has no coordinator' waits for a staff_shifts table, or the day pass is created from Practice → Roles on the manager's own knowledge.

### Item 7
- **feature**: Thesis: 'the only green is a bank line'
- **why**: The catalog itself paints green squares on 'Supported' pre-flight lines and docs/04 flow 5 shows 'matched lines green (already posted)'; the shape pack also encodes claim states with fills. The line is rhetoric the product contradicts on its first insurance day.
- **honest version**: 'Tied is never self-asserted: the Tied glyph requires a bank_transactions row from a feed or statement import.' Drop the colour claim or make the shape pack reserve the filled-circle-plus-Tied word for bank-backed states only.

### Item 8
- **feature**: Gate copy catalog CI lint (≤8 words, verb-first) versus the catalog's own gate strings
- **why**: Several specified gate lines fail the lint they define: 'D4341 UR quadrant: no perio site ≥4 mm recorded on this encounter' (11 words, not verb-first), 'Note not filed — Dr. K' is fine but 'Denied: perio chart not received — Delta · appeal by Oct 3' is a row, not a verb line. Either the lint is looser than stated or half the catalog's copy is rewritten at build time.
- **honest version**: Apply the ≤8-word verb-first rule to the refusal verb line only; worklist rows and finding titles follow a separate row grammar (object · state · one action), and the pre-flight examples are rewritten to 'Add perio evidence — UR quadrant' with the WHAT/WHY/HOW behind Why.

### Item 9
- **feature**: Save exam renders the exam as a chart image 'byte-reproducible from frozen rows'
- **why**: Rasterized PNG output depends on the renderer, fonts, and platform; byte-identical reproduction is realistic for SVG generated from rows, not for a PNG the attachment vendor requires.
- **honest version**: Store the deterministic SVG plus the frozen row set as the reproducible artifact; the PNG sent to the payer is a rendered derivative whose hash is recorded on the disclosure row.

## Strongest

- Sealed closed day with visible corrections: append-only role, CHECK-enforced corrects_entry_id, and a correction that is a row on today's screen turn the Prosperident/Zeldent retro-edit pattern into something the database refuses rather than a detector that notices; once the actor exclusion above is added it is the cleanest Phase 1 control in the catalog.
- Checkout closes on a typed collection decision plus the self-pay restriction toggle: S effort, no added click on the common path, and two structural wins (the uncollected portion becomes a row, the 164.522 restriction becomes a scrubber refusal) that no incumbent in the corpus has; fix the $0 state and it is exemplary.
- Second approver from a phone or the next desk: the single-entitlement 60-second approval session is the right answer to the shared-password workaround and keeps two identities distinct without elevating the requester's session; the denial-no-appeal line on the card is the dental-specific touch that makes the approver useful rather than a rubber stamp.
- ERA EFT tied to the bank line by trace number: removes the largest source of false variances with data neither party typed, is PHI-minimal by construction, and degrades to amber rather than forcing a match, which is exactly what principle 3 demands.
- Paint once with human-set temporality and File as the only release of charges: FK parents on all four records, impossible surfaces disabled at the control, and the refusal to infer Planned→Today by time of day closes Curve's auto-conversion and orphaned-note classes structurally rather than by vigilance.
- For-dentist tags: a bounded observation vocabulary with no diagnosis words, a disposition-gated Sign, and no per-hygienist counts is the only design in the catalog that resolves the licence-scope handoff the RDH, DA, and Board-investigator panels all attacked, and it does so with a typed object rather than a permission on prose.
- One ledger view with Explain in three voices and the As-of chip: the same row ids rendered for biller, patient, and CPA is the central bet made concrete, and the As-of chip turns the six-weeks-later dispute into a query; statement hold reasons with a maximum hold age are the honest version of 'do not bill while insurance is pending'.
- Gate contract in code and CI: converting principle 11 into build-time refusals (Refusal component consuming only server verdicts, luminance ladder from token metadata, bounding-box assertions) is what stops the drift every a11y and CVD panel documented in Smile Notes; it is the feature most likely to still be true in year three.
- Independence-graded Tied status: the half-circle 'same hands' state and the absent Clear control for the day's poster are the honest downgrade the doctrine requires; it grades the process, not the person, and cannot show green without a bank row.
- Narrative by quotation and the CDT-triggered pre-flight (once re-phased to Phase 3): quoting verbatim spans with source underlines instead of drafting is the only approach that survives the insurance auditor's 'story tailored for pay' attack and the charter's ban on invented clinical facts at the same time.
