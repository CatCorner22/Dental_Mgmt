# Feature ideation 8: The dentist from exam to plan to note to case presentation: the exams-to-sign queue, one paint gesture writing four records, plan cards with readable estimates, case acceptance and informed refusal, referrals with loop closure, lab cases as Board dependencies, and the filing gate as the single irreversible verb.

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, the-dentist-from-exam-to-plan-to-note-to-case-pres

## Summary

13 candidate features from the The dentist from exam to plan to note to case presentation: the exams-to-sign queue, one paint gesture writing four records, plan cards with readable estimates, case acceptance and informed refusal, referrals with loop closure, lab cases as Board dependencies, and the filing gate as the single irreversible verb. lens, 6 marked non-obvious.

## Lens

The dentist from exam to plan to note to case presentation: the exams-to-sign queue, one paint gesture writing four records, plan cards with readable estimates, case acceptance and informed refusal, referrals with loop closure, lab cases as Board dependencies, and the filing gate as the single irreversible verb.

## Features


### Item 1
- **name**: Exams-to-sign queue ordered by chair wait, framed by hygiene findings

#### personas
- dentist
- hygienist
- front-desk coordinator
- **problem**: Between operatories the dentist has no single place that says who is seated and waiting for an exam, which hygiene findings need a diagnosis, which images have no interpretation, and which notes need a licensed signature. Today this lives in the hygienist's head, a hallway flag, and a scroll through the schedule.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md line 16: "Dentist | Exams to sign | Hygiene data awaiting diagnosis and plan; notes needing my filing authority; imaging awaiting interpretation, all as rows in one queue; the seated chart opens on Assessment/Plan with killers hoisted to a ≤3-row strip". /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md, mapping table: "Finding without disposition | complete.finding-no-disposition | S2".
- **interaction**: Dentist logs in and lands on Exams to sign (0 clicks). Rows are ordered by how long the patient has been in the chair in the in_chart state, not by name or by hygienist. Each row shows chair, patient initials (privacy mode) or name, one phrase naming what is waiting ("Perio: 4 sites ≥2 mm deeper, BOP 18%"; "2 BWX, no interpretation"; "Hygiene note ready for your signature"), and exactly one primary action, "Open exam" (44 px). Tap 1 opens the seated chart on Assessment/Plan with the hygienist's findings-needing-disposition hoisted above the odontogram, the ghosted prior perio beside today's, and images for named teeth one tap away. Rows leave the queue when the encounter is filed, never by dismiss. A hygienist's Chairs card shows "Waiting for dentist 6 min" as the same encounter state.
- **why intuitive**: Home is the work, not a dashboard (principle 10); every row has exactly one primary action; recognition over recall because the queue tells the dentist what hygiene found instead of requiring them to re-read a chart; structural correctness because rows are derived from encounter state and unresolved finding-no-disposition rules, so nothing depends on the hygienist remembering to flag the dentist.
- **why innovative**: Curve's Sidekick is patient-centric, not queue-centric: /home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md describes "select a patient once and get 1–2 click access to Charting, Notes, Perio" but no dentist worklist derived from encounter state. Dentrix, Ascend, and Denticon are cited in the report (A.6.1 #6) for "too many clicks", and the report finds that no vendor markets to hygienists or designs the dentist/hygienist handoff (D.5: "none market to them"). The Board strip in the blueprint is the only per-chair readiness surface in the corpus, and this queue is its dentist-side mirror.
- **phi and controls**: Rows carry initials-only in privacy mode; full names appear only after two-identifier confirmation on chart open, which writes a phi_access_log row (purpose: treatment). No disclosure rows because nothing leaves the tenant. No per-hygienist counts or timing anywhere; wait time is per encounter, not aggregated per person. Filing authority is enforced by clinicalRoles.ts at the API, so a hygienist cannot make a row disappear by filing.
- **phase**: Phase 3
- **effort**: M
- **risks**: Chair-wait ordering could read as pressure on the dentist; mitigate by showing wait as a plain duration with no color escalation below a practice-set threshold. Requires the encounter state machine from Phase 2 to be reliable on shared tablets.
- **surprise**: False

### Item 2
- **name**: Paint once, write four records

#### personas
- dentist
- hygienist
- biller
- **problem**: In incumbent charting the dentist paints the tooth, then re-types the tooth and surfaces into the note, then someone rebuilds the plan line, then the front desk posts the charge from memory. Four entries of the same fact means four chances for #14 to become #41 and a note that does not match the claim.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 77: "One painting gesture writes chart, plan, note scaffold, and pending charge; impossible surfaces disabled at the control; money lives on the plan card and ledger, never in note text". /home/user/catcorner22/dental/src/components/builder/Odontogram.tsx: "A surface the note named that this tooth cannot have. Marked, never silently dropped — the audit engine decides what it means."
- **interaction**: Rail → Chart (1 tap). Tap tooth #14 (44 px glyph, 8 px gaps). Surface zones light up; drag across M-O (the D and I zones are disabled on a molar because impossible surfaces are disabled at the control, not flagged afterward). A ranked, role-filtered procedure strip appears ("Composite 2-surf D2392", "Amalgam", "Crown prep"), ordered by this practice's frequency for that tooth type. Tap one. One server transaction writes: a chart_event (tooth, surfaces, category, temporality), a procedure row with NOT NULL encounter FK and a pending charge from the fee schedule, a treatment-plan item with an estimate, and a note scaffold that pre-selects the restorative module and fills tooth/surface facts as structured fields (not prose). The odontogram immediately shows the mark in the restorative brand color with its shape; the plan card and the note module count update in the same frame. Undo within the encounter is one tap and writes a reversing chart_event. Three taps total for the common restorative case.
- **why intuitive**: Attachment is structural, never a label (principle 9): the charge, plan item, and note all point at the same procedure and encounter by FK. Impossible surfaces disabled at the control is poka-yoke control rather than warning. 44 px targets and 8 px gaps for gloved fingers. Recognition over recall via the ranked procedure strip. It is the core of daily flow 3 in the blueprint: restorative visit charted and signed in ≤10 taps.
- **why innovative**: Curve paints procedures and "auto-populate[s] the Treatment Plan Card with ADA/CDT code, description, site, surfaces" (/home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md) but its notes are separate tagged objects where "notes created generically in the Notes module or Sidekick may NOT attach even if tagged 'correctly'", and the charge is posted at checkout by conversion. No incumbent in the corpus writes the note scaffold and the pending charge from the same gesture with database-enforced parent keys; the insurance-auditor panel names the resulting gap: "Curve holds the CDT line; Smile Notes holds the pretty narrative. Offices can align language to the fee ticket without your product ever matching code↔finding."
- **phi and controls**: All writes stay inside the tenant; one domain_event per record in the same transaction. The pending charge is not a ledger entry until File releases it, so an estimate can never enter the balance. Fee comes from the per-plan, per-provider fee schedule under maker-checker; the dentist cannot type a fee on the chart. Money is written to the plan card and never into note text.
- **phase**: Phase 3
- **effort**: L
- **risks**: The ranked procedure strip must never auto-select; a wrong default becomes a wrong charge. The four-record transaction is the central correctness surface of the clinical port and needs the property-test approach used for the ledger.
- **surprise**: False

### Item 3
- **name**: Temporality selector: today, planned, or existing work, set by a human

#### personas
- dentist
- hygienist
- **problem**: A crown another dentist placed years ago, a crown planned for next month, and a crown seated today look identical on most odontograms until someone reads the history list. Software that guesses which one you meant produces claims for work never done and plans for work already present.
- **evidence**: /home/user/catcorner22/dental/src/lib/extract/chart.ts header: "A crown someone else placed in 2019 and a crown planned for next month must not look like a crown placed today." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 77: "append-only chart_events with a human-set historical flag (the extractor refuses to guess temporality)". Odontogram.tsx: "COLOUR IS NEVER THE ONLY SIGNAL. Every mark also has a shape (filled, outlined, hatched)".
- **interaction**: When the dentist paints a procedure, a three-segment control sits directly under the procedure strip: Today · Planned · Existing (each ≥44 px). It defaults to Planned during an exam encounter type and to Today during a restorative encounter type, taken from the appointment type's behavior contract, and the chosen value is shown in words on the mark's tooltip and in the list beside the chart. Today marks are filled; Planned are outlined; Existing are hatched and carry a "by another practice" toggle. A Planned mark can become Today only by being performed in an encounter and filed; there is no drag from one state to another. Choosing Existing writes a chart_event with historical=true and creates no plan item, no charge, and no note module. The extractor that reads note prose back onto the chart draws anything it can only infer as historical or hypothetical faintly at 0.45 opacity and never promotes it.
- **why intuitive**: Named choice instead of a forced blank: the three states are the whole domain and the default follows the encounter type, so the common case is zero extra taps. Severity by shape plus word plus luminance is reused for temporality without borrowing the audit palette. Structural correctness: planned → completed only through encounter completion, so nobody has to remember to convert.
- **why innovative**: Curve models this as "two modes: Planning (new/future work, typically shown red) and History (completed work, this-practice vs. other-practice color coding)" with "Auto-conversion on checkout" (/home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md), which converts by time of day rather than by a filed record of the act, and uses red, the universal stop color, for planned work. No incumbent in the corpus refuses to infer temporality; the deterministic-first doctrine makes the refusal a feature rather than a limitation.
- **phi and controls**: Tenant-internal. The historical flag is part of the append-only chart_event and stamped with the frozen author name. An Existing mark is excluded from claims by construction (no procedure row), which removes one upcoding path the insurance-auditor panel describes. Cross-surface contradiction (chart says Existing, note says performed today) fires as S0 at File.
- **phase**: Phase 3
- **effort**: S
- **risks**: Defaults by appointment type will be wrong for mixed visits (exam plus same-day filling); the control must stay visible, not hidden behind a mode switch, or users will file Planned work as Today.
- **surprise**: True

### Item 4
- **name**: Scoped readback at File with chart mirror

#### personas
- dentist
- hygienist
- **problem**: A transposed tooth number is invisible in prose. "#14" and "#41" both look plausible in a sentence, and a full-text diff review is a wall nobody reads at 4:50 pm. The wrong-site error survives to the claim and to the next visit.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/high-stakes-documentation-patterns.md §1: "Define a READBACK_CLASS — tooth numbers, surfaces, quadrants, drug names, doses and units, anaesthetic carpules, times, laterality — and on accepting any AI rewrite make the clinician confirm those tokens only, rendered as a short list rather than a paragraph." /home/user/catcorner22/dental/src/lib/extract/chart.ts: "On a chart, a transposed tooth number is not a subtle difference in a string; it is a mark in the wrong quadrant".
- **interaction**: On the encounter page the dentist taps File (1 tap). Above the killer strip a readback list of at most six rows appears: tooth and surfaces per procedure, anesthetic agent and carpules, any dose, any laterality word, drawn from the structured procedure rows and from the note prose by the extractor. Beside it, a small odontogram shows the marks as painted (filled) and any tooth the prose names that the chart does not (a red-ringed outline in the wrong quadrant). If the two agree, the list is green-checked in shape and word and File proceeds on the same tap with no extra confirmation. If they disagree, File is held with one line, "Note says #41, chart says #14", and one control with two options, "Chart is right" or "Note is right", each of which writes the correction as a new event; there is no auto-fix. Confirmation is scoped to these tokens only; the rest of the note is never re-shown.
- **why intuitive**: Read-back for high-stakes tokens is in the blueprint's definition of intuitive. One verb line plus one control at the gate. The chart mirror makes the error visible without asking the dentist to look for it, which is structural correctness over vigilance. Validation is silent until File, not during typing.
- **why innovative**: The corpus's incumbents have no readback at all: Curve's charting and notes are separate objects (/home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md) and its required fields are "red asterisks that block saving", presence checks rather than consistency checks. high-stakes-documentation-patterns.md states "No study was found applying readback/hearback ... specifically to clinical documentation software", so the mechanism is imported from ICAO Annex 10 rather than from any PMS.
- **phi and controls**: Runs server-side inside signNoteAtomic in the same transaction as the filing, so a client cannot skip it. Wrong-site is S0 and refuses filing (an enforced note-signing gate per docs/05). The chosen correction is a reason-coded event with frozen attribution. No PHI leaves the tenant.
- **phase**: Phase 3
- **effort**: M
- **risks**: False positives on legitimate multi-tooth prose ("#14 and #15 checked, #14 restored") will train dentists to tap through; the extractor's negation and hint handling must be tested against the 34-note corpus before this can hold File.
- **surprise**: True

### Item 5
- **name**: Plan card with three-number estimate and a one-sentence rule trace

#### personas
- dentist
- front-desk coordinator
- biller
- **problem**: Treatment plan estimates are opaque numbers the front desk cannot explain and the dentist cannot defend chairside; when the estimate is wrong nobody knows whether the fee schedule, the deductible, or a frequency limit caused it, and incumbents let estimated write-offs leak into the balance.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 #5: "Oryx AR including estimated write-offs. No harvested review praises any product for AR clarity after dual coverage and partial payments." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 77: "treatment plans / phases / items (estimates only), case presentations, estimate engine with rule trace".
- **interaction**: Each plan item on the Plan tab shows three labeled numbers: Fee, Insurance est., Your est. Tapping "Why" on any line (1 tap) opens a drawer with one plain sentence per rule the estimate engine applied, in order: "Delta PPO fee schedule for Dr. Reagan: $312. Deductible remaining $50 applied. Covered at 80%. Annual maximum remaining $1,100, not reached. Benefits verified 2 Sep." Each sentence names the row it came from. Stale inputs are stated, not colored: "Benefits last verified 41 days ago — Re-verify" is one line and one control that runs a 270. Phase totals sum the same three numbers. The dentist can drag items between phases; estimates recompute in place. Nothing on the card can be typed as a dollar figure; fees change only through the fee-schedule maker-checker flow.
- **why intuitive**: Explanations behind progressive disclosure with policy prose never on the finish path. The same "Explain" pattern the ledger uses for balances is reused for estimates, so staff learn one gesture. Honest, bounded: the trace states what it does not know instead of implying precision.
- **why innovative**: Curve's "Treatment Plan Cards ... with insurance/patient/total estimates and PPO write-offs" (/home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md) show numbers without a trace, and the report's D.5 table finds nobody offers a ledger both clinicians and accountants can read. Estimates that live in a separate table and can never touch the balance are the structural answer to Oryx's complaint.
- **phi and controls**: Coverage and eligibility snapshots are PHI held in-tenant; the trace is rendered from stored snapshot rows and logs a phi_access_log read. Estimates never enter ledger_entries (DB-enforced). Fee schedules are under maker-checker so the plan card cannot be used to negotiate a fee off-record.
- **phase**: Phase 3
- **effort**: M
- **risks**: Frequency limits and downgrades require plan-benefit data that 271 responses often omit; the trace must say "not returned by carrier" rather than guess, or the honest sentence becomes a wrong one.
- **surprise**: False

### Item 6
- **name**: Case presentation that records the decision, including the refusal

#### personas
- dentist
- front-desk coordinator
- **problem**: Plans are presented verbally, acceptance is a signature or nothing, and a declined recommendation vanishes from the record. Years later the patient alleges they were never told about the disease or the consequence of waiting, and the chart shows cleaning visits only.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md §5: "Informed refusal silence ... recommendation or referral offered verbally; chart shows cleaning visits only. Patient later alleges never informed of periodontal disease or consequences of refusal." and §2: "informed consent is a process, not a signature. 'Consented patient' and 'patient consented' are explicitly insufficient."
- **interaction**: From the Plan tab the dentist taps Present (1 tap). The screen flips to patient voice: the plain-language pass renders each phase as "what we found / what we recommend / what happens if we wait / other options including no treatment", with the three estimate numbers per phase and the dentist's clinical rationale carried from the note, not retyped. Tablet is handed to the patient or shown on the operatory screen. For each recommended item there are three equal 44 px controls: Accept, Decide later, Decline. Accept opens the Board slot search inline (3 interactions to schedule) or a payment-plan/membership option. Decline requires one tap on a reason chip (cost, time, wants second opinion, does not want treatment) and shows the dentist a one-line "Risks of declining discussed" field with starters that must be edited or confirmed, then writes an informed-refusal record with a follow-up date that surfaces as a Rail row and a recall entry. The presentation, decisions, and reasons are stored on the case_presentation row; the note receives a pointer sentence, "Treatment plan P-1043 presented; decisions recorded on plan", never the dollar figures.
- **why intuitive**: Two visual identities: Accept and Decline are both reversible-styled because both are recordable decisions, and File remains the only irreversible verb. Named choice instead of a forced blank: Decide later is a first-class state. Recognition over recall via reason chips. Money stays on the plan card.
- **why innovative**: Curve markets "case-acceptance improvements up to ~30% attributed to patient-friendly visuals" and CareStack lists "Tablet case presentation" (report A.3), but neither treats a decline as a clinical record; the corpus's litigation research shows the RCDSO panel found "no documented diagnosis, no referral, no refusal documentation despite claimed conversations". Recording the refusal with its risks discussed is the inverse of the case-acceptance scoreboard products like Dental Intelligence sell.
- **phi and controls**: Patient-audience text goes through the plain-language and stigma gate before display; the standardize pass is disabled on patient-audience fields. If the presentation is sent to the portal or printed, that is a disclosure row (purpose: portal or print). No per-dentist acceptance rate exists anywhere; the only aggregate is a practice-level "accepted, not scheduled" worklist for the front desk. Consent language blocks are verbatim-locked.
- **phase**: Phase 3
- **effort**: M
- **risks**: Dentists may find the decline field slower than saying nothing; the starters must be genuinely one-tap-editable or the field gets skipped via Decide later. Counsel review of refusal language is a Phase 3–4 dependency.
- **surprise**: True

### Item 7
- **name**: Dollar amounts in note text are a finding with a one-control fix

#### personas
- dentist
- hygienist
- biller
- **problem**: Clinicians type "pt quoted $1,200 for crown" into the clinical note because there is nowhere else convenient. The figure is then wrong when benefits change, it appears in a records request or a Board file, and it invites the chart to be read as a fee ticket.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 77: "money lives on the plan card and ledger, never in note text". /home/user/catcorner22/dental/knowledge/sources/tn-board-investigator-hate.md line 100: "The Board reads the chart." /home/user/catcorner22/dental/knowledge/sources/adversarial-insurance-auditor-hate.md: "Paste/copy is the perfect crime scene: two systems, one story tailored for pay."
- **interaction**: While the dentist types, nothing happens. On blur of a note field containing a currency token ("$", "USD", "dollars", or a bare amount next to "quoted/fee/cost"), a single finding row appears in the strip: "Money in note — move to plan" with one control, "Move to plan card". Tapping it opens the plan item picker pre-filtered to procedures named in the same sentence; the sentence is rewritten deterministically to "Fee discussed; see plan P-1043" and the amount is shown on the plan card as a "quoted to patient" annotation with the date, not as an estimate override. The dentist can instead choose the named omission licence "Patient quote, keep verbatim", which keeps the text and stamps the licence. The finding is S1: it does not block File on its own, but it is counted in the practice-level filing rollup.
- **why intuitive**: Validation silent until blur. One verb line plus one control. Named omission licence rather than forced deletion. Recognition over recall: the picker shows the plan items already on this encounter instead of asking the user to find them.
- **why innovative**: No incumbent in the corpus separates clinical prose from money by rule; Curve's note tags include a "Billing" tag as a labeling convention (/home/user/catcorner22/dental/knowledge/sources/curve-hero-pms-clinical-documentation.md, "~24 default note tags"), which is exactly the label-not-structure pattern principle 9 rejects. The high-stakes patterns doc's ICAO idea of "a term that is permitted only in one section" is the imported mechanism.
- **phi and controls**: Tenant-internal. The moved amount is written to the plan card as an annotation, not to the ledger and not to the estimate table. Records-request exports therefore carry the clinical record without quoted fees unless the plan is explicitly included. The omission licence is stamped and countable, never a free-text override.
- **phase**: Phase 3
- **effort**: S
- **risks**: False positives on clinical numbers ("#14 3 mm"); the detector must require a currency cue, not a bare number. Over-zealous rewriting would violate deterministic-first, so the rewrite is a fixed template, never generated.
- **surprise**: True

### Item 8
- **name**: Referral packet with four required slots and a specialist-facing preview

#### personas
- dentist
- front-desk coordinator
- **problem**: Outbound referrals read "Referred to oral surgery" with no named practice, no clinical ask, no urgency, and films sent without the dentist's read. The specialist re-images, re-consents, and delays surgery, and the GP's chart becomes evidence of a careless handoff.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-omfs-referral.md, fix #1: "require four explicit slots: to whom, clinical ask (finding → requested action), urgency, records forwarded (imaging + note). ... refuse None. as a filled referral." and hate #3: "Sending the file does not send the read."
- **interaction**: From the Plan tab or the odontogram, tap Refer on a tooth or finding (1 tap). A single card shows four slots stacked: To (typeahead over the specialist directory; adding a new specialist is inline), Ask (finding pre-filled from the chart mark and note extract; requested action is a chip set: extract, evaluate, biopsy, consult, treat), Urgency (routine / soon / urgent, shape and word), Records (checkboxes for today's images, the filed note, the perio exam; each image shows whether it has a dentist interpretation). If any attached image lacks an interpretation, the Send control is held with one line, "2 BWX need your interpretation", and one control, "Interpret now", which opens the image from the tooth. Below the slots is a plain preview in the order the recipient reads: tooth/site, interpretation as written, ask, urgency, records list, what the patient was told. Send (1 tap) writes the referral row with a due date for the report back and a disclosure row per channel (fax via BAA vendor in Phase 4, print, or portal). The text is the note's words reordered, never rewritten.
- **why intuitive**: One card, no wizard. Recognition over recall: the ask is a chip set and the finding comes from the chart. The gate is one verb line plus one control. The preview is the check-answers pattern the corpus ranks as the cheapest high-value UI item.
- **why innovative**: The corpus's specialist persona (report D.3) lists "referral management" as an unmet hire criterion, and the OMFS panel finds even the existing Smile Notes rule "accepts weak cues ('specialist', 'for evaluation', a specialty noun)". Curve's referral handling is a letters/Files module with no packet gate. The trap the panel names, "Do not auto-author the specialty narrative", is respected: nothing is generated.
- **phi and controls**: Every send is a disclosure row (purpose: fax / print / portal) naming the recipient, the records forwarded, and the row count. The fax connector stays disabled until a countersigned BAA row exists (Phase 4). Imaging-without-interpretation is a hard stop on the referral path, an enforced control, not a recorded one. The specialist directory holds business contact data only.
- **phase**: Phase 3
- **effort**: M
- **risks**: Fax remains the channel most specialists actually use; until the eFax BAA vendor lands in Phase 4 the send path is print-and-fax with a manual disclosure confirmation, which is honest but slower.
- **surprise**: False

### Item 9
- **name**: Referral loop closure through inbound report intake and a dentist disposition

#### personas
- dentist
- front-desk coordinator
- **problem**: Referrals go out and nothing tracks whether the specialist reported back; when a report does arrive by fax it is scanned into Documents and nobody with a licence reads it or records what happens next. The open loop is a named malpractice pattern.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 82: "A referral without a closed loop is a worklist row, not a forgotten fax; every send is a disclosure row". /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md §6: "documentation still failed to show earlier findings, patient counseling, or follow-up."
- **interaction**: Each referral carries a report-due date set at send. When the date passes with no report, a row appears on the front-desk coordinator's Board side panel, "No report from Dr. Patel — #17 extraction — 16 days", with one control, "Request report", which sends a templated request as a disclosure row and resets the due date once. When a document arrives (inbound fax, upload, or scan), the intake screen shows candidate open referrals matched on two identifiers plus the specialist name; the coordinator taps the matching referral (1 tap) and the document attaches to it. This does not close the loop. Instead a row appears in the dentist's Exams-to-sign queue, "Specialist report to review — #17", and opening it shows the report beside the original ask. The dentist records one disposition line with starters ("Extraction completed, healing, no further action"; "Follow-up needed: schedule post-op check"; "Recommendation received, present to patient") and taps Close loop (1 tap), which files the disposition as an addendum-class entry on the referral and, if a follow-up was chosen, creates the recall or plan item. Only a dentist's disposition closes the loop; receipt alone leaves it open in a distinct "received, unreviewed" state.
- **why intuitive**: Structural correctness over vigilance: the due date is set at send, the row appears without anyone remembering, and the loop cannot be closed by the wrong role. Each row has exactly one primary action. Recognition over recall via disposition starters that must be confirmed, not silently inserted.
- **why innovative**: The OMFS panel calls the incumbent state "you printed a shrug": the Smile Notes advisor `byte.referral-loop` is "Coaching only — specialist never sees it", and no PMS in the corpus treats an inbound specialist report as an item requiring a licensed read and disposition rather than a filed document. Curve's Files & Letters module stores correspondence but has no loop state.
- **phi and controls**: Inbound documents are PHI held in object storage with signed URLs; matching to a referral logs a phi_access_log read (purpose: treatment). The outbound request is a disclosure row. The disposition is licence-gated at the API through clinicalRoles.ts. No per-specialist scoring; overdue reports are a worklist, not a rating.
- **phase**: Phase 3
- **effort**: M
- **risks**: Inbound fax without an eFax vendor means scanning; matching quality depends on the coordinator naming the specialist correctly at send. Too many overdue rows will be ignored, so the due-date default must be per referral type (OMFS 14 days, ortho consult 30).
- **surprise**: True

### Item 10
- **name**: Lab case spawned from the paint gesture and enforced at the seat booking

#### personas
- dentist
- front-desk coordinator
- office manager
- **problem**: The crown is prepped, the impression goes to the lab, and two weeks later the patient is seated for a crown that has not come back; nobody knew until the assistant opened the drawer. Meanwhile lab invoices are paid on sight, which is a recurring fictitious-vendor fraud vector.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 81: "'Case not back' is visible on the Board card before the patient is seated; lab invoices pass through the same vendor controls as any payee". /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 3: "lab vendors wired into the vendor-master dual-release channel (lab invoices are a recurring fictitious-vendor fraud vector)".
- **interaction**: When the dentist paints a prosthodontic procedure marked Today (crown prep, bridge, denture), the encounter page shows a lab-case stub under the procedure: Lab (typeahead over lab vendors from the vendor master), Shade, Material, Due. Shade and material are chip sets from the practice's catalog; Due defaults from the vendor's stated turnaround. Tap Send to lab (1 tap) when the case leaves; the slip prints with the patient's two identifiers and the case number. On the Board, when the coordinator books the seat appointment, choosing a slot before the due date is held with one line, "Lab case due 18 Sep", and one control, "Book after due date" (or "Call lab" which just shows the number). The Board card for the seat appointment shows a "Case not back" chip (shape and word) until Received is tapped on the case (1 tap, from the Board card or the encounter). When the lab invoice arrives, it is entered against the case's vendor and procedure; the payment goes through postGuarded on the vendor channel, so a new vendor or an over-threshold invoice needs a distinct second approver inline, and a vendor with no case behind the invoice is a control finding.
- **why intuitive**: The case is created where the work happens, not in a separate module. Supervision-style refusal at booking: one line plus one control. The Board chip lets the front desk see the dependency without opening the chart. Recognition over recall via shade and material chips.
- **why innovative**: Report A.3 lists no lab-case module among the dimensions that decide fit and the specialist persona's "GP-shaped product" complaint includes lab and OR workflows. No incumbent in the corpus ties a lab case to the vendor-master dual-release channel; the corpus's fraud evidence ("only 17% of thefts were discovered through the practice's planned controls") is the reason the lab fee posting is a control point rather than an accounts-payable convenience.
- **phi and controls**: The lab slip is a disclosure row (purpose: print) listing the fields sent; a digital lab-portal connector would require a BAA row before enablement. The lab fee is a ledger entry with a procedure FK and a vendor reference; payment release runs evaluateRelease inside the transaction. Board chips carry no PHI beyond initials and chair.
- **phase**: Phase 3
- **effort**: M
- **risks**: Turnaround defaults will be wrong for rush cases; the gate must be a hold with an override, not a refusal, or coordinators will book seats without linking the case. Vendor-master onboarding of every lab is setup labor at conversion.
- **surprise**: False

### Item 11
- **name**: Filing gate: killer strip of at most three rows, one File button, licence-locked sections

#### personas
- dentist
- hygienist
- **problem**: Dentists sign hygiene-drafted notes without reading a long audit panel, or bypass to one-line templates because the finish path is a sermon. The three content gaps that dominate closed claims, findings, consent, and rationale, file anyway because the Ready chip looked green.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/killers.ts: "open killers hard-block Copy and File — no checkbox ack escape." /home/user/catcorner22/dental/knowledge/sources/adversarial-curve-power-user.md, concession 3: "DDS killer-only finish — ≤3 open litigation killers + fat Copy. Hygienist builds; dentist does not sit through the sermon." /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md: "clinical findings (68), informed consent (55), clinical rationale (51)".
- **interaction**: The hygienist drafts the note in the encounter during the appointment; Assessment and Plan fields are visibly locked to the dentist's licence (the hygienist sees them as read-only with the word "Dentist" beside them, enforced by clinicalRoles.ts at the API, not just in the UI). The dentist opens the encounter from Exams to sign; the cursor lands in Assessment. At the bottom is a strip of at most three rows, the open killer items only (imaging without interpretation, anesthetic amount missing, consent needs the conversation, clinical rationale missing, wrong-site S0, dose maximum), each with a short label and a Change link that jumps to the field. Below is one large File button in the irreversible visual identity. When the strip is empty, File is a single tap: signNoteAtomic runs the full audit server-side, freezes the text and its RULESET_VERSION, byteaudit-verifies, stamps the three identities (entry author, clinical performer, reviewing dentist), flips the Board chip to note_filed, converts the encounter's Planned marks that were performed to Today, and releases the pending charges to the checkout queue. Everything not in the strip, S2 and below, lives in a collapsed "Other suggestions" disclosure that never blocks. On a shared tablet, File requires the dentist's PIN author switch.
- **why intuitive**: Killer strip ≤3 rows plus one File button is the blueprint's own finish rule. Two visual identities: File is irreversible; Preview and Print are reversible. Explanations behind progressive disclosure. Home is the note: the cursor lands where the dentist's work begins. Structural correctness: File is the only path from planned to completed and the only trigger for charges, so no vigilance is required at checkout.
- **why innovative**: Curve's finish is "Save on the visit. Done." with enforcement described as "Thin: templates + required clicks; vague phrases and recycled Planning language still file" (/home/user/catcorner22/dental/knowledge/sources/adversarial-curve-power-user.md). The insurance-auditor panel's L1 loophole, "S2 killers never block Copy/export", is closed here by making killers hard-block File while keeping the strip at three rows, which no incumbent's required-field asterisks do.
- **phi and controls**: Filed notes are written by the INSERT-only role and hash-chained; note-signing gates (killers, licence scope, supervision corroboration) are enforced controls per docs/05. Filing emits a domain_event consumed by the Board, controls engine, and claim pre-flight. The PIN author switch and encrypted-or-disabled draft mirror prevent wrong-author events on shared devices. Nothing leaves the tenant.
- **phase**: Phase 3
- **effort**: L
- **risks**: The killer list is a policy lock: too long and it becomes the sermon again; too short and the plaintiff-attorney panel's "false confidence" hate returns. The list must be confirmed with counsel and frozen per RULESET_VERSION.
- **surprise**: False

### Item 12
- **name**: Amendment as replace-never-edit, with token changes propagating as correction rows

#### personas
- dentist
- biller
- **problem**: After filing, the dentist notices the note says #30 and the crown was on #31. Incumbents either let the note be edited in place (spoliation exposure) or leave the note wrong while the chart and claim drift apart. Nobody remembers to fix the claim.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/high-stakes-documentation-patterns.md §6: "replace, never edit-in-place — and a cumulative view. ... render a cumulative view (what the note says now) alongside a sequence list (how it got there)." and "Reason for change is a hard requirement, not a nicety." /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md §7: "late entries, metadata showing backdating, or rewritten entries ... credibility damage independent of clinical quality; spoliation arguments."
- **interaction**: On a filed note the only edit control is Add addendum (1 tap). A reason code is required from a short list (corrected tooth or surface, late entry, additional finding, clarification, patient-requested correction) plus optional free text. The dentist writes the addendum; if it names a readback-class token that differs from the frozen note (tooth, surface, dose, laterality), the readback list appears exactly as at File, and confirming it writes the addendum as a new sequence with a pointer to the superseded span. The original bytes never change. The Notes tab shows the cumulative view by default with the superseded span struck and the replacement inline, and a sequence list beneath ("Addendum 1, Dr. Reagan, 4 Sep 4:12 pm, reason: corrected tooth number"). In the same transaction, a tooth or surface change opens two linked rows: a chart correction event (visible immediately on the odontogram as the new mark with the old one shown as superseded) and, if a claim was already submitted, a "Claim needs correction — #30 → #31" row on the biller's Money Desk with one action, "Prepare corrected claim". The addendum cannot be filed without those rows being created.
- **why intuitive**: Named reason codes rather than free text. The cumulative view answers "what does the record say now" without making a reader reconstruct it. Structural correctness: the claim correction is created by the amendment, not remembered by the biller. Irreversible identity on Add addendum.
- **why innovative**: The corpus's incumbents expose an audit trail (Dentrix "Image audit trail", Denticon "granular audit trail", report A.3) but none renders a cumulative-plus-sequence view or propagates a token correction to chart and claim. The mechanism is imported from eCTD lifecycle operations and EU GMP Annex 11, which high-stakes-documentation-patterns.md notes the dental knowledge base lacked: "the reviewer-facing presentation, which is the part that is missing."
- **phi and controls**: Addenda are INSERT-only, hash-chained, and stamped with frozen author name and RULESET_VERSION. The reason code is aggregable in the practice-level digest (copy-forward and late-entry clusters) without per-person display outside the owner and reviewer seat. The corrected-claim row goes through the claim state machine with frozen 837 bytes; the original submission is retained. No PHI egress.
- **phase**: Phase 3
- **effort**: M
- **risks**: Late-entry addenda are legally sensitive; the UI must show the entry timestamp and the date of service distinctly and never allow the effective date to be set to the past. Claim correction rules vary by payer and need the Phase 2 clearinghouse adapter.
- **surprise**: True

### Item 13
- **name**: Imaging interpretation from the tooth, queued until a dentist owns it

#### personas
- dentist
- hygienist
- **problem**: Bitewings are taken by the hygienist and stored, and the record shows "4 BWs taken" with no findings and no interpreter. Tennessee counts radiographs and their interpretations as record components, and the referral and filing gates both need the read.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 3 exit criteria: "a radiograph imported into an encounter opens from the tooth on the odontogram and carries a dentist's interpretation". /home/user/catcorner22/dental/knowledge/sources/litigation-documentation-research.md §4: "'4 BWs taken' with no findings, interpreter, or pending-interpretation owner. ... TN rule cites radiographs and interpretations as record elements."
- **interaction**: When images are imported or acquired into the encounter (DICOM/JPEG import in Phase 3, sensor bridge in Phase 4), each image is tagged to the teeth it covers, either from DICOM metadata or by the hygienist tapping the teeth on the odontogram (44 px). A small image glyph appears on those teeth. The encounter enters the dentist's Exams-to-sign queue as "2 BWX, no interpretation". On the chart the dentist taps the tooth (1 tap) and the image opens in the reference viewer beside an interpretation field with structured starters that are selected and edited, never inserted silently ("No caries or periapical pathology noted", "Interproximal radiolucency, distal #14, into dentin", "Bone level within normal limits"). Saving the interpretation (1 tap) freezes it as dentist-attributed text on the imaging study, marks the image glyph as read, and clears the imaging killer for both File and the referral packet. An image with no interpretation at File shows as one killer row with a Change link that opens the image; the named omission licence "Interpretation deferred to Dr. X, due date" is available and creates a queue row for that dentist instead of leaving a blank.
- **why intuitive**: Images open from the tooth, which is where the dentist is already looking; one tap, no module switch. Recognition over recall via starters. Named omission licence instead of a forced blank. The queue removes the need to remember which films are unread.
- **why innovative**: The corpus's imaging complaints are about lock-in and bridges, not interpretation: "Eaglesoft proprietary x-rays cannot be bridged; Dentrix images outside the database; Curve 'X-rays never work' and reviewers bridging to Apteryx" (report A.6.1 #8). No incumbent in the corpus tracks an interpretation owner or blocks a referral on a missing read; Curve's Image note tag is again a label. The universal imaging record with per-structure status is lifted from the dental repo's sedation-and-imaging spec, per docs/01 line 86.
- **phi and controls**: Images are PHI in object storage with SHA-256 and signed URLs; each open logs a phi_access_log read. Interpretations are dentist-frozen and hash-chained. Imaging-without-interpretation is an enforced gate on the referral path and a killer at File. DICOM export on demand is the exit-terms promise and needs no ticket. No AI read is offered in this phase; when the caged AI ships in Phase 5 it proposes with source spans and the dentist's frozen text remains the record.
- **phase**: Phase 3
- **effort**: M
- **risks**: Tooth tagging from DICOM is unreliable for bitewings; the hygienist tap step must be fast or images will be untagged and the queue row will say "images, no interpretation" without a tooth. Viewer makes no measurement claims until regulatory review.
- **surprise**: False
