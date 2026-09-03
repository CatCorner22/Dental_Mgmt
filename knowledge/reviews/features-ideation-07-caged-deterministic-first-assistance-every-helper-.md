# Feature ideation 7: Caged, deterministic-first assistance: every helper has a shipped deterministic twin, model output (where any) is refused by verifyMeaning and the grounding guard before a human sees it, every proposal shows the source span it came from, nothing is metered, and PHI reaches a model only through the BAA-gated integration_registry boundary with a disclosure row. 11 of 13 features use no model at all; 2 are the Phase 5 predictive layer on top of twins that already ship.

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, caged-deterministic-first-assistance-every-helper-

## Summary

13 candidate features from the Caged, deterministic-first assistance: every helper has a shipped deterministic twin, model output (where any) is refused by verifyMeaning and the grounding guard before a human sees it, every proposal shows the source span it came from, nothing is metered, and PHI reaches a model only through the BAA-gated integration_registry boundary with a disclosure row. 11 of 13 features use no model at all; 2 are the Phase 5 predictive layer on top of twins that already ship. lens, 6 marked non-obvious.

## Lens

Caged, deterministic-first assistance: every helper has a shipped deterministic twin, model output (where any) is refused by verifyMeaning and the grounding guard before a human sees it, every proposal shows the source span it came from, nothing is metered, and PHI reaches a model only through the BAA-gated integration_registry boundary with a disclosure row. 11 of 13 features use no model at all; 2 are the Phase 5 predictive layer on top of twins that already ship.

## Features


### Item 1
- **name**: Explain this balance, two voices from one row set

#### personas
- biller
- office manager
- front-desk coordinator
- owner
- **problem**: Billers cannot explain a balance after dual coverage and a partial payment; the patient at checkout and the CPA at month-end both get a number nobody can narrate, so trust in the ledger collapses and adjustments get used to make it 'look right'.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md: '"Explain this balance" renders one plain sentence per open procedure.' and the module row 'Exactly one ledger view; balance shown as three labeled numbers'. /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 #5: 'No harvested review praises any product for AR clarity after dual coverage and partial payments.' D.6: r/Dentistry on CareStack: 'My accounting team HATES it with the passion of 1,000 suns.'
- **interaction**: Patient Rail shows balance as three labeled numbers (patient / primary / secondary) with one 'Explain' control (1 tap). A drawer renders one deterministic template sentence per open procedure: 'Crown #19 on 8/12: charge $1,180; Delta paid $590 on 9/1 (ERA 4412); contractual write-off $118 (reason: PPO fee); you owe $472.' Every amount and reference in the sentence is a link that highlights the exact ledger_entries / payment_allocations rows below it (1 tap). A 'Say it to the patient' toggle on the checkout screen re-renders the same rows through the audience:'patient' plain-language templates (no reason codes, no CARC text). The month-end package for the CPA renders the same rows a third way, keyed by gl_bucket and reason code. All three voices are generated from the same row ids, so they cannot disagree. Zero model calls.
- **why intuitive**: Exercises 'The ledger is a journal, not a balance', 'One canonical view per fact', and recognition over recall: the biller never reconstructs an allocation in their head; the sentence points at the rows. Removes the vigilance of checking whether a statement matches the ledger, because both are renderings of the same entries. Explanation sits behind progressive disclosure (one control), never on the finish path.
- **why innovative**: The corpus records Open Dental's 'allocated/unallocated/hidden payments' complaint, CareStack's auto-generated 'transfer adjustment' lines, Curve's invoice-vs-ledger confusion, and Oryx AR that includes estimated write-offs (report A.4 Ledger model row, A.6.1 #5). None renders the balance as pinned sentences, and none gives the patient-voice and CPA-voice from the same rows; DentiMax is praised for a 'real accounting' ledger but not for explanation.
- **phi and controls**: Reads only rows the requesting user is already authorized to see (withGuard + RLS); the patient-voice rendering on a statement is a disclosure row only when sent. No PHI leaves the tenant; no model. Estimates are never in the sentence because they are never in the ledger. The templates are versioned (stamped with the ledger explanation template version) so a wording change never rewrites a past statement.
- **phase**: Phase 1
- **effort**: M
- **risks**: Template coverage for unusual entry kinds (financing merchant fees, membership write-downs) must be complete before pilot or the drawer shows a gap; mitigated by generating the sentence set from the reason_codes table and failing CI when a reason code has no template.
- **surprise**: False

### Item 2
- **name**: Claim narrative pre-flight bound to CDT lines at checkout

#### personas
- biller
- office manager
- dentist
- hygienist
- **problem**: Claims go out with a narrative that never states the fact the carrier's criteria require (probing depths for SRP, retention narrative for a buildup), and the denial arrives weeks later when the note is cold and the fix is expensive.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts: 'Insurance denials for dental work are routinely upheld not because the work was wrong but because the NARRATIVE never states the facts the carrier's criteria require.' /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md insurance row: 'pre-flight failures phrase WHAT / WHY / HOW and deep-link to the note field'. Report A.6.1 #1: Zentist 2026 '78% report rising denials'.
- **interaction**: Checkout screen (Board card → Checkout, 1 tap) lists completed procedures with a per-line pre-flight chip (shape + word: 'Ready' / 'Needs evidence'). The rule trigger is the CDT code on the claim line, not a regex on procedure words, so it never misfires on a procedure that was only discussed. Tapping 'Needs evidence' (1 tap) shows WHAT ('SRP documented without periodontal evidence'), WHY ('carriers require 4 mm+ depths or attachment loss'), HOW ('point at the perio exam'), and one control 'Open note field' that deep-links into the encounter's objective section with the cursor placed (1 tap). If the perio_exams row for this encounter already contains sites at 4 mm or deeper, the chip shows the satisfying evidence span from the exam instead of asking. Money Desk claims tab shows the same chip per claim before batch submission. No model.
- **why intuitive**: Structural correctness over vigilance: the trigger is the coded line, so the biller is never asked to remember which codes need narrative. One verb line plus one control at the gate; the explanation is behind one tap. Recognition over recall: the deep link lands on the field, not on the note. Fixes happen while the patient is still in the building, which is the cheapest moment.
- **why innovative**: The corpus praises Dentrix for eClaims depth and CareStack for a claims tracker, but the scrubbers described check format and attachment presence; no incumbent in the report binds a documentation rule to a CDT line and deep-links into the note. Curve's Care+ generates a SOAP draft but does not check it against carrier criteria (builder-text-blocks-predictive-ux.md §1).
- **phi and controls**: Runs server-side inside the tenant on the encounter's note and perio rows; no egress. Failures are S2 fix-or-attest, and an attestation carries a reason code so the owner digest can count attest rates at practice scope (never per person). Rule ids and RULESET_VERSION are stamped onto the claim event so a later rule change never regrades a submitted claim.
- **phase**: Phase 2
- **effort**: M
- **risks**: Rule set is written against Tennessee-common carriers; per-payer criteria vary, so the rules are labelled provisional until the denial worklist supplies measured denial reasons per payer. Over-firing would train billers to attest reflexively; CI precision harness must show zero blocking false positives on the note corpus.
- **surprise**: False

### Item 3
- **name**: Narrative by quotation

#### personas
- biller
- office manager
- **problem**: When pre-flight says 'needs evidence' but the evidence is already in the note or perio exam, the biller retypes it into the claim narrative, introducing transcription errors (wrong tooth, wrong depth) and a second version of the truth.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts: 'the periodontal charting exists; the narrative has to point at it.' /home/user/catcorner22/dental/src/lib/verify/grounding.ts: 'every clinical word the model writes must trace back to a word the writer typed, or to the practice's own standard vocabulary, or it is an invention.'
- **interaction**: On a claim line whose pre-flight rule is satisfied, the narrative field shows one control: 'Build narrative from note' (1 tap). The deterministic extractor stitches the narrative entirely from verbatim clauses that matched the rule's satisfiedBy pattern plus structured perio_sites values ('Probing depths 5–6 mm at #19 MB, DB; 5 mm at #30 ML'), each clause shown with a colored underline linking to its source span in the filed note or exam. Nothing is paraphrased; connective words come only from a fixed template list. The biller may delete a quoted clause but cannot type into the narrative without switching to 'Edit freely', which drops the span links and is recorded as a manual narrative. If no satisfying clause exists, the control is absent and only the deep link to the note remains; the tool never fills the gap.
- **why intuitive**: Removes retyping (the main source of narrative errors) and the recall burden of finding the sentence in a long note. The span underline is the evidence; there is nothing to verify because nothing was generated. Two visual identities: quoted text (locked, linked) versus free text (editable, unlinked).
- **why innovative**: No incumbent in the corpus composes the claim narrative from the filed note's own spans; Curve's AI SOAP writes text for the provider to review, and Dentrix/Eaglesoft narratives are free-text boxes. The model charter's Gate 1 baseline ('zero invented teeth across the corpus', 94.6% clause coverage) is the property this feature relies on and no vendor in the report claims.
- **phi and controls**: Pure in-tenant text assembly from rows the biller can already read; no model, no egress. The 837 carries the narrative as frozen bytes with a flag 'quoted' vs 'manual' on the claim event, so the denial worklist can later compare denial rates by narrative kind at practice scope. Readback-class tokens (tooth, surface, depth) are shown but need no confirm because they are copied byte-for-byte, not transformed.
- **phase**: Phase 2
- **effort**: S
- **risks**: Carriers sometimes want a sentence the note does not contain (e.g., 'patient is not a candidate for X'); the tool must refuse to invent it and route back to the dentist, which is slower than typing it. That slowness is the control, but it needs to be measured in the pilot's denial-to-appeal cycle.
- **surprise**: True

### Item 4
- **name**: Chart, note, and claim contradiction stop with side-by-side spans

#### personas
- dentist
- biller
- owner
- **problem**: A note says #19 MOD composite, the chart event says #20, the claim line says D2393 on #19 with surfaces MO; nobody sees all three at once, so the wrong-tooth claim ships and is either denied or paid wrongly.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md odontogram row: 'cross-surface contradiction (chart vs note vs claim) as blocking S0' and 'extract/chart.ts (contradictory pairs), anatomy.ts (wrong-site S0)'. /home/user/catcorner22/dental/src/lib/verify/verifyMeaning.ts: 'Wrong-site is an S0 STOP everywhere else in this application'.
- **interaction**: Runs deterministically at two gates: File note (encounter page) and Submit claim (Money Desk). On a mismatch the gate shows one verb line ('Tooth differs: note says #19, chart says #20') and one control ('Show both'). 'Show both' (1 tap) opens a two-column card: the note clause with the tooth token highlighted, the chart_event row with its tooth, and the claim line; each column has one 'Use this' control that writes the corrected value through its own normal path (chart event with human-set flag, note amendment, or claim line edit), never silently. Filing or submitting is refused until the three agree or a dentist records a reason-coded override. The extractor never guesses which one is right.
- **why intuitive**: Structural correctness over vigilance: the contradiction is computed, not remembered. Severity by shape + word + luminance (S0 stop). The fix is one tap on the correct column, keeping the compliant path the fastest path. Nothing asks the biller to open three screens.
- **why innovative**: The report's incumbents (Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack) all hold chart, note, and claim in one database yet none in the corpus cross-checks them before submission; Curve's documented failure class is orphaned notes (docs/01 principle 9). This is simultaneously a denial preventer and an upcoding/wrong-site control, and it runs on the deterministic extractor with zero invented teeth.
- **phi and controls**: In-tenant, no model. The override is a reason-coded, dentist-attributed event that feeds the weekly digest at practice scope (SYSTEMIC_SHARE rule), never a per-person tally. The S0 evaluation runs server-side inside the same transaction as fileSubmissionAtomic / claim submission, so a client cannot bypass it.
- **phase**: Phase 3
- **effort**: M
- **risks**: Legitimate multi-tooth or quadrant procedures (SRP D4341) must map cleanly or the stop fires falsely; the rule set needs the 34-note corpus plus a claim-line corpus before it blocks. False S0 stops erode trust faster than misses.
- **surprise**: True

### Item 5
- **name**: Readback on bulk ERA posting, scoped to what differs

#### personas
- biller
- office manager
- **problem**: 'Post matched' commits dozens of insurance payments and contractual write-offs in one click; when a payer, amount, or CARC differs from what the claim expected, the difference disappears into a green batch and is discovered at reconciliation, or never.
- **evidence**: /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts: 'Scoped safety tokens for Accept-path readback (ICAO-style)... confirmed on Apply, not inferred as clinical facts.' /home/user/Dental_Mgmt/docs/04-ux-blueprint.md: 'Read-back for high-stakes tokens (tooth, surface, dose, amount, payer) on bulk, AI, and migration transformations.' Report A.6.1 #5 and per-platform: CareStack 'dual-insurance glitches', Curve 'partial-payment posting'.
- **interaction**: Money Desk → ERA batch → 'Post matched' (1 click). Before the write, a deterministic diff compares each matched line against the claim's expected values (payer id, billed amount, allowed, CARC set, patient responsibility). Lines with no deltas post immediately. Lines with deltas appear as a readback checklist capped at eight items, each one line: 'Line 14 · #19 crown · expected Delta paid $590, ERA says $540 · CARC 45'. Each item has one control 'Confirm' (44 px) and the batch's second control is 'Hold these'. Nothing in the batch posts until every delta item is confirmed or held; held lines route to the exceptions tab with the delta pre-filled. Over-threshold write-offs produced by a confirmed line still route through postGuarded dual release inline.
- **why intuitive**: Reduces vigilance to a bounded checklist of only the surprising tokens instead of asking the biller to eyeball a hundred green rows. Silent until there is a delta (the equivalent of validation silent until blur). Two identities: irreversible 'Confirm' versus reversible 'Hold'. One primary action per row.
- **why innovative**: Aviation readback applied to money: the corpus shows incumbents auto-posting ERAs silently (Open Dental allocation complaints, CareStack transfer adjustments, tab32 'unreconciled, mismatched reports'); Zeldent watches the bank after the fact but cannot intercept the posting. Nobody in the report scopes the confirm to deltas so the batch stays one click when nothing is surprising.
- **phi and controls**: In-tenant, no model. Each confirmation writes an approvals_log-style event with the frozen delta, attributed to the confirmer, and the posting itself goes through postGuarded inside the transaction, so dual release cannot be skipped by the batch path. Practice-scoped delta rates feed the digest; no per-person count is shown.
- **phase**: Phase 2
- **effort**: M
- **risks**: A clean batch must post in one click or billers will resent the gate; the cap of eight items and the threshold for 'delta' (e.g., ignore rounding under $1) need tuning against pilot ERA files. Payer-level fee-schedule drift will produce many legitimate deltas until fee schedules are maintained.
- **surprise**: True

### Item 6
- **name**: Section-scoped suggested blocks rail

#### personas
- hygienist
- dentist
- temp / new hire
- **problem**: Verified attested scaffolds (consent, LA, radiographs, postop) exist but appear only inside a focused textarea behind a closed chip, so in a ninety-second turnover staff never find them and type from memory or copy forward.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/builder-text-blocks-predictive-ux.md §2: 'Chip appears only on the focused textarea; closed by default; labeled "Verified block" — easy to never notice in a ninety-second turnover'; §3: '"Predictive" here means ranking and offering attested scaffolds — not autocomplete of clinical truth.'
- **interaction**: Encounter page opens cursor-ready with modules pre-selected from the scheduled procedures. Above the active section a rail shows 2–4 chips ranked deterministically from (selected modules, clinical role, open section, practice pack): restorative → 'Local anesthetic', 'Consent', 'No complications'; hygiene → 'Medical history reviewed', 'Postop instructions'. Tap a chip (1 tap) to insert the block with its assertion checkboxes unchecked and its <placeholders> open; filing stays blocked while any placeholder remains. Dentist-owned blocks never appear as insertable to a hygienist (role filter at the API, not the UI). Three personal 'My blocks' can be pinned to the rail. No model; ranking is a pure function with a golden test.
- **why intuitive**: Recognition over recall: the right scaffold is visible, not remembered. Named omission licences keep 'not assessed' first-class so a blank is never forced into a fabrication. 44 px chips, one tap. The temp sees the same rail as the veteran, which is the one-shift learnability path.
- **why innovative**: Curve's advantage is 'favorite templates + required clicks' (builder-text-blocks §5) and Dentrix/Eaglesoft ship templates that copy forward; the corpus notes ADA guidance that templates are acceptable only when patient-specific. Ranking attested blocks by module and role while refusing pre-checked assertions is what none of them does; Curve's Treatment Planning notes can auto-convert to the legal DOS note unindividualized.
- **phi and controls**: Blocks contain no PHI and never DOS or identifiers; the rail runs client-side on module ids and role. Insert events are recorded so the practice filing rollup can measure verified-block insert rate versus residue-rule failures at practice scope, never per writer. Licence scope enforced server-side on file.
- **phase**: Phase 3
- **effort**: S
- **risks**: Ranking that is wrong feels like noise and gets ignored; the initial weights must come from pack usage in the pilot and be labelled provisional. Must not drift into practice-authored free-form fields (the audit-blind dialect non-goal).
- **surprise**: False

### Item 7
- **name**: Check-your-note finish summary with killer hoist

#### personas
- dentist
- hygienist
- temp / new hire
- **problem**: Staff clear a live findings strip under time pressure and file a note whose consent, anesthetic amount, or imaging interpretation is missing, because the chip says Ready and there is no reconstructible confirm step.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/check-your-note-ux-research.md: 'Staff still clear a live findings strip under time pressure and paste into the EDR without a reconstructible confirm step. That is the WCAG 3.3.4 / GOV.UK check-answers gap this codebase has not closed.' and 'Tag ~8–12 rules killer: true (wrong-site / dose / consent thin or no-decision / anesthetic amount / imaging interpretation / clinical rationale)'.
- **interaction**: Encounter page → File (1 tap) opens one step, not a modal wall: modules used, the killer rows first (each one line: 'Anesthetic amount not stated' with a 'Change' control that jumps to the field), open S0/S1 stops, and the omission-licence count ('2 not-assessed'). Confirm is disabled while any killer is open; there is no attest path for wrong-site or dose. When the list is empty the step is a single line 'Nothing outstanding' with the File control, so a clean note costs one extra tap. Filing then runs the audit server-side, freezes, byteaudit-verifies, and flips the Board chip. Deterministic; the row builder is a pure helper over AuditReport + omissions + modules.
- **why intuitive**: One verb line per row plus one control (Change). Explanations behind progressive disclosure. Severity ordered by shape + word + luminance so the list reads in grayscale. The killer hoist converts vigilance into a bounded, ordered checklist at the only moment that matters.
- **why innovative**: The corpus's litigation research shows insufficient documentation dominated by findings, consent, and rationale; no incumbent in the report ships a check-answers step at signing. Curve's required fields block save but only on template fields the practice authored; Dentrix/Eaglesoft notes have no completeness engine at all.
- **phi and controls**: Runs on the draft in-tenant; no model. The filed note carries the killer tags and RULESET_VERSION so a later rule change never regrades it. Omission-licence counts and Change-link usage feed the practice filing rollup at practice scope; no per-writer scores.
- **phase**: Phase 3
- **effort**: M
- **risks**: If the killer list is too long the step becomes a wall and gets clicked through; keep it to the counsel-reviewed 8–12 rules. Guardrail from the research: median ready→filed must not rise more than 20%.
- **surprise**: False

### Item 8
- **name**: Scoped readback on Accept for standardize and assist proposals

#### personas
- dentist
- hygienist
- dental assistant
- **problem**: Accepting a standardized or model-proposed rewrite asks the clinician to re-read the whole paragraph, so they skim and a changed laterality or dose slips through with the wording fix.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/check-your-note-ux-research.md backlog #2: 'Scoped READBACK_CLASS on Standardize / assist Accept — Confirm changed teeth/doses/laterality only'. /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts: 'This module is the human checklist: tooth, surface, laterality, drug, dose, unit — confirmed on Apply, not inferred as clinical facts.'
- **interaction**: Encounter page, any field with a proposed rewrite (deterministic standardize in Phase 3; verifier-passed model rewrite in Phase 5). 'Apply' (1 tap) first shows a readback diff limited to readback-class tokens that were added or removed: '#19 → #19 (unchanged)' is hidden; 'lower left → lower right' appears as one row with the before/after spans highlighted in the text. Each row has one 'Confirm' control; the Apply control activates when all rows are confirmed (max eight rows). If no readback-class token changed, Apply proceeds with no interstitial. Formatting-only changes never trigger it (isFormattingOnly). Rejected proposals show the verifier's named reason ('digits-changed: 2 carpules → 3 carpules') rather than 'no suggestion'.
- **why intuitive**: Silent until something high-stakes changed. Recognition over recall: the clinician confirms a handful of highlighted tokens instead of re-reading prose. Two identities: Apply is the irreversible action; Preview stays reversible.
- **why innovative**: Curve's AI SOAP requires 'provider must review before save' but review is the whole draft (builder-text-blocks §1); no incumbent in the corpus diffs the proposal for tooth/dose/laterality tokens and asks only about those. The non-goals file explicitly rejects confidence scores in favor of a binary verifier plus human readback.
- **phi and controls**: The diff is computed in-tenant on text the writer already owns; no egress. When the proposal came from a model (Phase 5), the call already passed the five BAA/registry conditions and wrote its disclosure row; the readback confirmation is stamped onto the accept event with ASSIST_PROMPT_VERSION. Confirm counts are practice-scoped only.
- **phase**: Phase 3
- **effort**: S
- **risks**: Token regexes miss vocabulary the practice uses (e.g., Palmer notation); coverage must be tested against the corpus, and a missed token is a silent failure. Cap at eight rows means a proposal that changes more than eight high-stakes tokens should be refused outright rather than paged.
- **surprise**: False

### Item 9
- **name**: Could-not-read spans and tenant vocabulary proposals

#### personas
- hygienist
- dentist
- office manager
- owner
- **problem**: Every note assistant either silently ignores shorthand it cannot parse or guesses at it; the writer never learns which phrases the engine cannot see, and the practice's dialect never becomes vocabulary the audit can check.
- **evidence**: /home/user/catcorner22/dental/docs/model-charter.md §3: 'On the 5.4% the parser cannot read, the current behaviour is to say so and show the writer the phrase — which is not a failure mode a model obviously improves on, because the honest alternative to "I could not read this" is not "here is a guess."' §4.2: 'Labels are questions, never chart facts.'
- **interaction**: Encounter page: after a pause in typing, clauses the extractor could not read get a dotted gray underline (not a finding, no severity color). Hover or tap (1 tap) shows 'Could not read this phrase' with two controls: 'Leave as written' (default, one tap, records nothing about the writer) and 'Propose as vocabulary' which opens a one-line form: phrase → controlled expansion, sent to the tenant's vocabulary queue. Practice → Settings → Vocabulary lists proposals clustered by surface variant (postop / post-op) with counts at practice scope; the office manager or clinical lead accepts one (1 tap), which bumps the tenant RULESET_VERSION and stamps future notes. No model anywhere; classification uses the frozen unparsed-routing eval categories.
- **why intuitive**: Honesty as a UX property: the tool says what it cannot see instead of pretending. Recognition over recall: the writer sees the exact phrase. The compliant path is the fastest (Leave as written is default). Learnable by a temp because there is nothing to configure.
- **why innovative**: The corpus's incumbents either have no extraction (Dentrix, Eaglesoft, Open Dental free-text notes) or generate text (Curve Care+, tab32 AI); none shows the writer the unreadable residue or turns it into a versioned, diffable vocabulary change. The model charter argues this is 'the form of learning this product can version, diff, revert, and defend', and no vendor in the report offers versioned rules at all.
- **phi and controls**: Underlines are computed client-side on the draft; the proposal form sends only the phrase and expansion (the egress classifier runs on it and refuses if it contains an S0 identifier) to the tenant's own queue, never off-tenant. Proposal counts are practice-scoped; no per-writer 'unread rate' is ever shown, which keeps it inside principle 13.
- **phase**: Phase 3
- **effort**: S
- **risks**: Dotted underlines on every unread clause could feel like spellcheck noise for writers who use heavy prose; needs a per-role density threshold and must never escalate to a finding. Vocabulary accepted carelessly becomes an audit-blind dialect, so acceptance should require the clinical lead.
- **surprise**: True

### Item 10
- **name**: Gate-side controls explainer

#### personas
- biller
- office manager
- front-desk coordinator
- temp / new hire
- **problem**: When dual release or a runtime SoD rule refuses a posting, the person refused experiences a dead end and either waits, works around it, or asks the owner to waive; the owner-facing controls page never reaches them at that moment.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md: 'a blocked posting says "Needs a second approver — Dana or Dr. Reagan" with one "Request approval" control, never a dead end'. /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: 'blocked_same_person, blocked_role, blocked_missing_second, blocked_policy_off | roll back, return 403 with reasons[] and nextSteps[]'. Report B.7: 'the controls practices believe they have are not working.'
- **interaction**: Refund / write-off / variance-clear form, any screen. On a needs_second or blocked verdict the inline card shows one verb line from nextSteps[] ('Needs a second approver — Dana or Dr. Reagan') and one control ('Request approval', 44 px). A small 'Why' link (progressive disclosure, 1 tap) expands a deterministic paragraph keyed by (verdict code, rule id) from the controls corpus: what the rule prevents in one sentence, the practice's own threshold and who set it, and the date it was last reviewed, each linking to the control_policies row. The paragraph never names anyone as a threat and never mentions the requester's history. For a temp the same card includes 'This is normal here; approvals usually take a few minutes' with the live median approval time at practice scope. No model; the corpus lookup is a table keyed by rule id.
- **why intuitive**: One verb line plus one control at the gate with policy prose off the finish path. Recognition over recall: the eligible approvers are named. The compliant path (Request approval) is the fast lane; the override stays the slow lane. A temp learns the control by hitting it once.
- **why innovative**: Zeldent and Prosperident in the corpus observe after the fact; Abyde-class HIPAA tools coach the owner. No product in the report explains a financial control to the person it just refused, at the transaction, with a link to the practice's own policy row. Incumbents (Dentrix, Open Dental) have permission denials that read as errors.
- **phi and controls**: The verdict is computed server-side by evaluateRelease inside the transaction; the explainer only renders reasons[] and nextSteps[] the server already returned, so nothing client-side is authorization. No patient data in the explanation. The 'Why' open event is recorded so the owner can see how often gates are explained at practice scope; never who asked.
- **phase**: Phase 1
- **effort**: S
- **risks**: A paragraph per rule must be written and counsel-reviewed; stale text after a policy edit would mislead, so the paragraph must render the live threshold from the row, not a hardcoded number.
- **surprise**: True

### Item 11
- **name**: Owner controls coach over role labels with read-only tools

#### personas
- owner
- compliance lead
- **problem**: Owners cannot translate a residual-risk score or a COSO principle into 'what should I turn on next and what will it cost me', so controls stay recommended and never enabled.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md: 'any tool the coach can call is a read-only result over already-authorized data; no tool moves money, grants roles, or sends messages. The controls coach receives role labels only, never names.' /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: 'tornadoSensitivity and the cascade simulator become the settings-page "what if I turn on dual approval for write-offs" preview with dollar deltas labelled directional until calibrated.' /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts builds the coach input from portfolioSummary/assessCoso.
- **interaction**: Practice → Controls, a 'Ask about this' control beside any finding, score, or principle (1 tap). The deterministic twin runs first and always: the cascade simulator renders 'If dual approval on write-offs is enabled: 3 SoD findings reclassify, Control Activities moves from Weak to Adequate, directional exposure change −$X' with links to the rows. When the tenant has AI enabled (owner-attested, BAA row live), the owner may type one question; the coach receives the context pack with people replaced by role labels ('office manager', 'associate dentist'), calls only the read-only tools (assessCoso, portfolioSummary, tornadoSensitivity, retrieveKnowledge), and answers in at most three sentences, each ending in a citation chip to a control_snapshot row or corpus entry. Sentences without a citation are refused by the grounding guard and not shown. One control on the answer: 'Preview this change' (opens the simulator, never applies). The coach cannot enable anything.
- **why intuitive**: Home is the work: the coach lives beside the finding, not in a chat page. Deterministic first: the simulator answers before any model. Evidence spans, no confidence percentage. Nothing ranks a person; the coach literally cannot see names.
- **why innovative**: Report B.7: 'no mainstream product for small businesses interactively assesses the owner's operation and then recommends and tailors financial and operational internal controls'; the pattern exists only in cyber (Vanta, Drata), HIPAA (Abyde, Patient Protect), and safety (SmarterRisk). Zeldent monitors the bank but does not tailor controls. Running the coach over role labels with read-only tools and a deterministic simulator twin is what none of those do.
- **phi and controls**: The context pack contains no PHI and no names (role labels only); the model call still goes through integration_registry (kind llm, BAA row active, zero-retention endpoint), the egress classifier, and writes a disclosures row (purpose ai) plus a codes-only drift row. Tools are read-only over already-authorized rows. Output never authorizes anything; enabling a control is a separate maker-checker action with its own control_decision. Included in the price; no per-question metering.
- **phase**: Phase 5
- **effort**: M
- **risks**: Precog scoring constants are labelled directional until calibrated, so the coach's dollar sentences inherit that label and must say so. Owners may treat a cited three-sentence answer as advice from a CPA; the fixed disclaimer under the panel and the refusal of uncited sentences are the mitigations.
- **surprise**: False

### Item 12
- **name**: Verifier-gated narrative and note rewrite with named refusals

#### personas
- dentist
- hygienist
- biller
- **problem**: A quoted narrative or shorthand-expanded note is correct but reads badly; the only way to get clean prose today is to retype it, and any assistant that rewrites it risks adding 'consent obtained' or 'tolerated well' that nobody wrote.
- **evidence**: /home/user/catcorner22/dental/src/lib/verify/verifyMeaning.ts: 'Every rejection is typed and loud. A silent fallback would teach users that the AI "sometimes does nothing"; a stated rejection teaches them the tool checks its own work.' /home/user/catcorner22/dental/src/lib/verify/grounding.ts: 'A red-team probe of fifteen attacks got fifteen through, and the ones that mattered were all the same shape — the model did not alter anything, it ADDED something.' /home/user/catcorner22/dental/src/lib/assist/non-goals.ts: 'A refusal does not negotiate, and it cannot be waved through by someone who is tired.'
- **interaction**: Encounter page (note section) or Money Desk (claim narrative): a 'Tidy wording' control (1 tap), present only when the tenant has AI enabled and the writer's licence tier is predictive; otherwise the same control runs the deterministic standardizer and is labelled 'Standardize'. The proposal appears beside the original with every sentence carrying a colored underline to the source span it was derived from; the readback diff (feature above) gates Apply. If verifyMeaning or the grounding guard refuses, the panel shows the typed reason and the offending words ('Refused: added "consent", "uneventful"') with one control 'Keep mine'. No confidence number anywhere. AI off never removes the control; it changes its label.
- **why intuitive**: Recognition over recall: the writer compares spans, not paragraphs. A refusal that names words is diagnosable; 'no suggestion' is not. Two identities: Apply irreversible after readback, Preview reversible. The deterministic twin means the temp's first shift is identical with AI on or off.
- **why innovative**: Curve Care+ and tab32's AI produce drafts with provider review as the only gate (builder-text-blocks §1; report A.6.2 tab32 'per-use AI fees'); no incumbent in the corpus runs a deterministic meaning verifier and fabrication guard that refuses model output before a human sees it, and none shows the refusal reason.
- **phi and controls**: All five conditions from docs/06 apply: llm registry row enabled only with an active BAA (zero-retention endpoint), tenant opt-in, per-capability field allowlist (note body sections and CDT codes only; never name, DOB, MRN, member id, balance), egress classifier with maskPhi pseudonymization or refusal, and a disclosures row plus codes-only drift row per call. Output is untrusted data: verifyMeaning, grounding, and readback before any write; connect-src 'self' so the browser never talks to the provider. Included in the price; refusal rate has a denominator from the drift rows.
- **phase**: Phase 5
- **effort**: L
- **risks**: Provider BAA and zero-retention terms are separate approvals for at least one candidate (docs/06), so the boundary may not exist when the code is ready. The verifier's neutralize() step forgives only licensed shorthand; a high false-refusal rate on real notes would make the control feel broken and must be measured on the frozen corpus before enablement.
- **surprise**: False

### Item 13
- **name**: AI switch that shows its twin

#### personas
- owner
- office manager
- compliance lead
- **problem**: Owners fear that turning AI off (or never being approved for a BAA) means losing features, and that turning it on means per-use bills; both fears in the corpus drove practices off a PMS.
- **evidence**: /home/user/catcorner22/dental/src/lib/assist/tier.ts: 'So "AI is off" has never meant "the feature is gone" here — it means the deterministic half runs.' /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.6: owner who left tab32: per-use AI 'when you multiply by 40 patients a day would be prohibitive.' /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 17: 'AI is included in the price or off, never metered.'
- **interaction**: Practice → Settings → Assistance: one toggle ('Model assistance: on / off') that requires the owner role and records an owner-attested policy decision. Beneath it a fixed two-column table generated from the capability registry, one row per capability: 'Tidy wording — with model: verified rewrite; without: deterministic standardize', 'Claim narrative — with model: verified polish; without: narrative by quotation', 'Controls coach — with model: cited answers; without: what-if simulator'. A third column shows the provider, BAA status, and retention term pulled live from integration_registry and the baas table, and a fourth column reads 'Price change: none' as a literal string the trust page also renders. If no BAA row is active the toggle is disabled with one line: 'Needs a countersigned BAA for the model provider' and one control 'View registry'. The same table is on the public trust page. A CI test fails if any capability lacks a deterministic twin row.
- **why intuitive**: Recognition over recall: the owner sees exactly what changes, not a marketing description. Refuse to start rather than silently degrade: the toggle cannot be flipped without the boundary. Honesty as a design rule, and one control at the gate.
- **why innovative**: The corpus records tab32's per-use AI fees as a switch-away reason and Open Dental's AI imaging at $199/month as a separate line; HS1 sells AI in packages and Curve Care+ is paid. No vendor in the report publishes a capability-by-capability 'with / without model' table or ties the switch to a visible BAA row.
- **phi and controls**: Reads integration_registry and baas rows (no PHI). The toggle writes tenants.settings.ai_enabled as a control_decision with owner attribution and a review date, which feeds the compliance program's BAA-expiry tasks; if the BAA row expires the trigger disables the connector and the table flips to 'without' automatically. No metering anywhere; the drift rows count calls for refusal-rate denominators only.
- **phase**: Phase 5
- **effort**: S
- **risks**: Keeping the 'without' column honest requires every future model capability to ship its twin first, which slows feature velocity; that is the intended constraint but it must be defended in roadmap reviews. Trust-page wording about the provider and retention must be counsel-reviewed.
- **surprise**: True
