# Feature ideation 2: The hygienist at the chair: perio charting at hygiene speed, gloved and voice-free operation, hygiene-to-dentist handoff, recall, and the Chairs home. Every proposal is deterministic-first, scores nothing about a person, keeps money out of note text, and honors the RDH walkout list (no scoreboards, no ambient capture, no unpaid catch-up queues).

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, the-hygienist-at-the-chair-perio-charting-at-hygie

## Summary

12 candidate features from the The hygienist at the chair: perio charting at hygiene speed, gloved and voice-free operation, hygiene-to-dentist handoff, recall, and the Chairs home. Every proposal is deterministic-first, scores nothing about a person, keeps money out of note text, and honors the RDH walkout list (no scoreboards, no ambient capture, no unpaid catch-up queues). lens, 4 marked non-obvious.

## Lens

The hygienist at the chair: perio charting at hygiene speed, gloved and voice-free operation, hygiene-to-dentist handoff, recall, and the Chairs home. Every proposal is deterministic-first, scores nothing about a person, keeps money out of note text, and honors the RDH walkout list (no scoreboards, no ambient capture, no unpaid catch-up queues).

## Features


### Item 1
- **name**: Chairs card: what changed, what is due

#### personas
- hygienist
- front-desk coordinator
- **problem**: Before seating, the hygienist opens three or four screens to learn whether the medical history changed, when perio was last charted, whether bitewings are due, and whether a premed alert exists. Under a packed recall column that reading time is skipped, and the visit starts blind.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md, Hygienist home row: "Today's patients in order with alerts, last perio date and delta, recall due; two buttons per card (Perio, Note)". /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md line 367: "Hygienist | Complete full-mouth perio and notes inside the appointment | Perio speed, voice entry, odontogram simplicity | Lag, extra hands required, skipped charting".
- **interaction**: Chairs (mine) lists today's patients in seat order. Each card: name (hidden in privacy mode), chair, appointment type, and two 44 px buttons, Perio and Note. A one-line 'since last visit' strip on the card renders only deltas computed from stored rows: 'Med hx changed: new anticoagulant (intake 2 days ago)' from the medical-history snapshot diff; 'Perio 14 mo ago, 6 sites ≥2 mm worse' from perio_exams; 'BWX due (last 13 mo)' from imaging study dates and the tenant's interval rule; 'Premed' from the un-collapsible critical-alert channel. Tap the strip (1 tap) to expand the full list; tap Perio (1 tap) to land at UR site 1. No tap is required when nothing changed: the strip reads 'No changes since 03/2026'.
- **why intuitive**: Home is the work (principle 10); recognition over recall (the card says what changed rather than making her remember to look); one canonical view per fact (the same deltas the dentist sees). Removes three or four screen visits per patient and the vigilance of remembering to check.
- **why innovative**: The corpus records Curve's Sidekick rail as the pattern for a persistent patient sidebar but no incumbent computes a since-last-visit diff for the hygienist; the Chairs home itself is novel because, per report D.5, 'A PMS office managers and hygienists would choose ... None market to them', and Dentrix, Ascend, and Denticon are cited for 'too many clicks'.
- **phi and controls**: PHI stays on the tenant; privacy mode hides names on operatory glass; every card open writes a phi_access_log row with purpose treatment. The strip is derived from existing rows (medical-history snapshots, perio_exams, imaging studies, alerts), never from AI. No person-level metric appears; card order is seat order.
- **phase**: Phase 3
- **effort**: M
- **risks**: Diff noise if intake forms change trivially (whitespace, reformatted phone); mitigate by diffing only clinically typed fields (medications, allergies, conditions). Interval rules for radiographs must be tenant-configured and labeled as the practice's rule, not a clinical recommendation.
- **surprise**: False

### Item 2
- **name**: Six-point grid with a personal probing path and any-HID pedal

#### personas
- hygienist
- **problem**: Full-mouth perio takes a second person or a voice add-on because native grids demand mouse clicks per site and follow a fixed cursor order that rarely matches how the hygienist actually probes. Gloved hands cannot touch a keyboard cleanly, so the chart is skipped when the schedule slips.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md line 182: "60% skip full-mouth perio when behind; 11% chart it every visit ... Voice-perio add-ons exist because native perio modules are slow." /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 3: "Six-point perio with the keyboard/foot-pedal grammar and prior-exam deltas". /home/user/catcorner22/dental/knowledge/sources/adversarial-rsi-dictation-hate.md: "No hold-to-talk / foot-pedal / external mic story in product UI."
- **interaction**: Chairs → Perio (1 tap). The grid opens on the correct dentition with the cursor at UR site 1 and the prior exam ghosted in grey. Grammar: digits 1–9 record depth and advance one site; 0 then a digit records ≥10 mm; space toggles bleeding on the site just entered; S toggles suppuration; Backspace undoes the last entry and steps back; arrow keys skip. Any HID device that emits keystrokes works with no driver: a $15 presentation clicker or a foot pedal mapped in a Perio settings drawer that shows 'Last key pressed: PageDown → Next site' so mapping is confirmed by pressing, not by reading. Probing path (facial all the way around then lingual; or quadrant by quadrant; or arch by arch) is a per-user preference chosen once from three diagrams; the cursor follows it thereafter. A keypad in a barrier sleeve plus a pedal for bleeding is the intended voice-free, one-operator setup. Save exam (1 tap) writes perio_exams and perio_sites in one transaction.
- **why intuitive**: Structural correctness over vigilance: the cursor is always where the probe is, so there is no site hunting. Recognition over recall: the ghosted prior value is beside each cell. Fewer words, bigger targets: the whole exam is 168 keystrokes plus bleeding taps with zero pointer work. Learnable by a temp in one shift because the grammar is five keys.
- **why innovative**: The corpus lists HS1 Voice Perio, Curve Perio+ (paid add-on), Bola, and Alta as the incumbents' answer, all voice and all metered or add-on; Denticon and Ascend advertise 'AI Voice Perio'. No incumbent in the corpus offers a driverless pedal/clicker path or a per-user probing path; Open Dental is praised for 'perio speed (hygienist quotes)' but is the only one, and it is keyboard-only with a fixed order.
- **phi and controls**: No PHI leaves the tenant: keystrokes are local input; no audio. The exam carries NOT NULL encounter_id and frozen clinical-performer attribution; on a shared tablet the PIN author switch must be the hygienist before Save is enabled (zero wrong-author events is a Phase 3 exit criterion). Probing-path preference is a UI setting with no server-side per-person metric.
- **phase**: Phase 3
- **effort**: M
- **risks**: HID key codes vary across cheap clickers; the pairing drawer that echoes the last key mitigates this. Skipping sites with arrows must be recorded as 'not probed' rather than zero (see the omission-licence feature). Acceptance depends on the D.8 baseline measurement being done in Phase 0.
- **surprise**: False

### Item 3
- **name**: Glove pad: touch-only perio entry at 44 px

#### personas
- hygienist
- **problem**: On the operatory tablet there is often no keyboard within reach, and existing chip-sized controls are sized for a mouse. A gloved fingertip hits the neighbouring site and the wrong depth enters a legal record.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-a11y-advocate-hate.md: "Cells `h-8 min-w-8` + `gap-1`; comment in `ToothPicker.tsx` admits adjacent mistap is 'a documentation error in the legal record.'" and fix 2: "Clinical controls ≥44×44 always + ≥8px gap". /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-chairside-da.md hate 1: "My glove is fat. Your chip is not. I do not get a second try while the handpiece is in enamel."
- **interaction**: In Perio, tapping the grid (or the pad icon, 1 tap) opens the Glove pad along the bottom edge of the tablet: a 3×4 pad of 44 px keys with 8 px gaps (1–9, Bleed, Skip, Undo) plus a 56 px 'Next tooth' bar. Above the pad the active site is drawn enlarged (tooth number, site name, prior value ghosted), so the hygienist reads one big cell rather than scanning a 168-cell grid. Each tap records and advances exactly as the keyboard grammar does. Undo steps back one site and shows the value it removed for two seconds. The pad hides when a keyboard key or pedal event arrives, so mixed entry is seamless.
- **why intuitive**: 44 px targets with 8 px gaps is the glove floor (principle 11); one enlarged active cell is recognition over recall; Undo makes a mistap recoverable instead of a silent error. Validation is silent until Save; nothing pops mid-exam.
- **why innovative**: The corpus's incumbent perio grids (Dentrix, Eaglesoft unchanged 'since 2015', Open Dental 'dated UI', Curve tablet Perio+ via voice) are mouse or voice; none in the corpus offers a glove-sized numeric pad with an enlarged active site and one-step undo as the default touch path.
- **phi and controls**: Same tenant-bound write path as the grid; no new PHI surface. Depth entries above 15 mm are refused at the control (impossible values disabled), which is a structural control rather than a warning. On a shared tablet the pad is disabled until the PIN author switch identifies the hygienist.
- **phase**: Phase 3
- **effort**: S
- **risks**: The pad consumes roughly 30% of a 10-inch tablet; landscape layout and collapsing the ghosted grid to the current arch mitigate. Wet-glove capacitive misses remain possible; the pedal path is the fallback.
- **surprise**: False

### Item 4
- **name**: Screening lane with named omission licences

#### personas
- hygienist
- front-desk coordinator
- dentist
- **problem**: When the column runs late, 60% of hygienists skip full-mouth perio entirely and the record holds nothing. The honest alternative, a six-sextant screening or a partial chart with a stated reason, has no fast path, so the choice is 'full chart or blank'.
- **evidence**: /home/user/catcorner22/dental/src/lib/modules/periodontal.ts chart-status options: "Screening probing only; no full chart at this visit." and "Charting was not completed at this visit."; header comment: "A note could satisfy the entire periodontal record by pointing somewhere else." /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md line 182: "60% skip full-mouth perio when behind".
- **interaction**: Perio opens with a segmented control at top: Full chart | Screening. Screening (1 tap) shows six sextant boxes; the hygienist enters one code 0–4 per sextant plus an asterisk key for furcation/mobility/recession, twelve keystrokes at most, then Save (1 tap). Any code of 3 or 4 automatically creates a 'Full chart due' row on the recall queue with a due date from the tenant's rule and a 'Full chart due' badge on the patient's next Chairs card. In Full chart mode, Skip on a site or tooth opens no dialog; the site is stored as 'not probed' and at Save the hygienist picks one licence for the skipped set from a 44 px list: implant, third molar, patient intolerance, time (screening completed instead), other with text. The derived note summary states exactly which of the periodontal.ts chart-status sentences is true; a blank never becomes 'full chart recorded'.
- **why intuitive**: Named omission licences instead of forced blanks (principle 11); the compliant path is the fastest path (principle 12) because screening is faster than skipping and then explaining in a note; structural correctness because an unprobed site can never read as 0 mm.
- **why innovative**: The corpus's incumbents answer slowness only with voice add-ons ('Voice-perio add-ons exist because native perio modules are slow'); none in the corpus routes an incomplete or screening chart into recall or records a per-site reason for omission. Smile Notes' own periodontal module already refuses the 'it's in the EDR' dodge, which this feature completes inside the PMS that owns the chart.
- **phi and controls**: Screening codes and omission reasons are stored on perio_exams and perio_sites with NOT NULL encounter_id and frozen attribution; the recall row is a domain event in the same transaction. Completion rate is reported practice-wide only (SYSTEMIC_SHARE rule); the licence chosen is never aggregated per hygienist on any surface.
- **phase**: Phase 3
- **effort**: S
- **risks**: A cheap 'time' licence could become the default; mitigate by making 'Full chart due' the structural consequence so the visit is not lost, and by showing the practice-level screening share to the owner as a schedule-design lever (see Schedule honesty), never as a person finding. Sextant coding conventions vary; label the code set and version-stamp it.
- **surprise**: True

### Item 5
- **name**: Save exam derives the note, the SRP quadrant evidence, and the claim attachment

#### personas
- hygienist
- dentist
- biller
- **problem**: After probing, the hygienist re-types deepest pocket, bleeding count, mobility and furcation into the note; the dentist then counts sites per quadrant to decide D4341 vs D4342; the biller later chases a perio chart PDF because the payer requires an attachment. Three people redo the same arithmetic and the claim still gets denied for missing evidence.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts line 32: "Scaling and root planing is documented without the periodontal evidence carriers require." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md perio row: "`periodontal.ts` (summary fields become derived outputs), SRP justification rule". /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 2: "attachment presence a scrubber rule for attachment-required CDT codes (SRP, crowns, most appeals)".
- **interaction**: Perio → Save exam (1 tap). In the same transaction the PMS: (a) computes the periodontal module's measurement fields (deepest depth, bleeding sites, greatest mobility, greatest furcation, chart-status sentence) and shows them read-only in the hygiene note with a 'from exam 10:42' link, never as editable text; (b) computes per-quadrant counts of teeth with ≥1 site ≥4 mm plus bleeding or attachment loss and writes them to the encounter as evidence facts; (c) renders the exam as a dated chart image stored as a document on the encounter. On the dentist's Exams to sign row the quadrant facts appear as one line: 'UR 5 teeth, UL 2, LL 4, LR 1 meet the tenant's SRP evidence rule'. The dentist taps a quadrant (1 tap) to add D4341 or D4342 to the treatment plan; the plan card carries the fee. When the biller assembles the claim, the scrubber's attachment rule is already satisfied by the rendered chart, so the SRP pre-flight line reads green with no extra step.
- **why intuitive**: One canonical view per fact: the exam is the source and the note, plan, and claim read from it. Money never inside note text: the fee sits on the plan card. Removes three rounds of retyping and the biller's recall of which payers want charts. Deterministic first: the counts are arithmetic over perio_sites with the rule version stamped.
- **why innovative**: No incumbent in the corpus binds exam → justification → attachment; Curve, Denticon, and Ascend sell voice perio as a data-entry convenience, and the report's insurance theme cites 'claim scrubbing' as a separate unmet workflow. Smile Notes shipped the SRP justification rule as a note audit; moving it to derived exam facts is what only a PMS that owns the chart can do.
- **phi and controls**: All derivation is server-side inside the tenant. The rendered chart is a document row; if it is later sent with a claim, that send is a disclosure row (purpose payment). The quadrant rule is a versioned tenant constant labeled 'evidence threshold, not a diagnosis'; the dentist's tap is the only thing that creates a planned procedure, so the hygienist never plans treatment (licence scope enforced at the API). No AI.
- **phase**: Phase 3
- **effort**: M
- **risks**: Payer evidence thresholds differ; the rule must be labeled as the practice's configured threshold and never phrased as 'qualifies for reimbursement'. Rendering the chart image must be byte-reproducible from frozen exam rows to survive an audit.
- **surprise**: True

### Item 6
- **name**: For-dentist tags: a licence-scoped handoff object

#### personas
- hygienist
- dentist
- **problem**: The hygienist sees a suspected carious lesion or a fractured margin but must not write a diagnosis; incumbents give her only a free-text note, so findings are either buried in prose the dentist never reads or written as diagnoses under the wrong licence. Meanwhile the locked Assessment/Plan sections show as her unfinished work.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-hate-chairside-da.md hate 4: "I document what happened. Diagnosis is not my license. Your locked Assessment still looks like a section I failed." and fix 4: "Collapse dentist-owned sections by default for auxiliaries into a single 'Waiting for dentist — Transfer when ready' strip." /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: enforced "note-signing gates (killers, licence scope, supervision corroboration)".
- **interaction**: On the hygienist's Chart or Perio screen, long-press or pedal-hold on a tooth (1 action) opens a 44 px list of bounded observations: suspected caries (surface picker), fractured restoration, recession ≥3 mm, mobility, soft-tissue lesion (site), other observation. Choosing one (1 tap) creates a for_dentist_tag row (tooth, surface, observation, hygienist attribution, timestamp) that renders as a coloured pin on the odontogram and as a row on the dentist's Exams to sign card. The hygiene note shows dentist-owned sections as one collapsed strip: 'Waiting for dentist'. When the dentist opens the exam, the tags are a checklist at the top of Assessment/Plan; each tag has two controls: 'Chart it' (writes a chart_event or plan item) or 'Seen, no treatment' (writes the disposition with the dentist's attribution). No tag can be left undispositioned at exam sign; the sign gate names the count ('2 observations need a disposition').
- **why intuitive**: Structural correctness over vigilance: an observation cannot be written as a diagnosis because the vocabulary has no diagnosis words, and the dentist cannot forget a tag because sign refuses. Recognition over recall for the dentist (a checklist, not a prose hunt). Removes the false 'incomplete' chrome from the hygienist's surface.
- **why innovative**: The corpus shows incumbents' notes as free text with role permissions at the section level at best; none in the corpus has a typed hygienist-observation object that the dentist must disposition, and Alta Voice's 72% vs 29% confidence gap between dentists and hygienists is exactly the handoff no product structures.
- **phi and controls**: Tags live on the encounter with NOT NULL encounter_id and frozen author; licence scope is enforced at the API (a hygienist cannot write a chart_event of diagnostic type). Dispositions are appended, never edited. No counts of tags per hygienist appear anywhere; the only aggregate is practice-level 'observations dispositioned same day', shown to the owner as a control-design measure.
- **phase**: Phase 3
- **effort**: M
- **risks**: Over-tagging could slow the dentist; bound the list to a small tenant-versioned vocabulary and let the dentist disposition several at once with one 'Seen, no treatment' on multi-select. State licence rules vary; the vocabulary must be labeled observation-only and reviewed by counsel for Tennessee first.
- **surprise**: True

### Item 7
- **name**: Ready-for-exam queue with patient-scoped position

#### personas
- hygienist
- dentist
- front-desk coordinator
- **problem**: The hygienist finishes scaling, walks the hall to find the dentist, and the patient waits with no one knowing how many chairs are ahead. Filing her note waits on an exam that has not been requested anywhere the dentist looks.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md Dentist home: "Hygiene data awaiting diagnosis and plan; notes needing my filing authority ... all as rows in one queue". /home/user/catcorner22/dental/knowledge/sources/adversarial-rdh-surveillance-labor.md hate 3: "Waiting-for-dentist banners. Ready that is not ready ... Fix the blocker. Do not decorate my failure."
- **interaction**: On Chairs, the seated card shows a third button once the exam or note has content: Ready for exam (1 tap). It appends an appointment event (in_chart → exam_requested), places the patient on the dentist's Exams to sign queue ordered by request time, and turns the Chairs card's status into 'Exam: 2nd in queue' with the ≤3-row strip the dentist will see (for-dentist tags, perio deltas, med-hx change). The Board strip shows the same state as a shape+word chip with initials and chair only. When the dentist taps Sign exam, the encounter's dentist-owned sections lock, the hygienist's note File button enables, and the Chairs card reads 'Exam signed, file note'. If the dentist instead taps 'Not today' with a reason (patient declined, reschedule exam), the same unlock happens with the reason on the encounter, so the note is never held hostage.
- **why intuitive**: One verb line plus one control at every gate; the blocker is fixed by the button rather than decorated by a banner. Home is the work for both personas: the request appears in the dentist's queue, not in a chat. Zero recall: nobody remembers who asked first.
- **why innovative**: Incumbents in the corpus have per-chair status colours on the schedule (Dentrix, Eaglesoft) but no request object that orders the dentist's work and gates note filing; Curve and Denticon rely on messaging or physical flags. The plan's encounter state machine makes exam_requested a first-class, append-only event.
- **phi and controls**: The Board chip carries initials and chair only (no PHI on hall screens). Queue position is a fact about the patient's wait, computed from request timestamps; wait durations are never aggregated per dentist or per hygienist on any report, and the state chip is never coloured by lateness. Sign exam is the supervision-corroboration gate already enforced at the API.
- **phase**: Phase 3
- **effort**: S
- **risks**: Two dentists in a practice need a 'which dentist' choice on request (default the appointment's supervising dentist; one extra tap otherwise). A 'Not today' path must not become a routine bypass of exams; the reason code is aggregated at practice level for the owner as a control finding, never per person.
- **surprise**: False

### Item 8
- **name**: Recall prescribed at the chair, booked at checkout

#### personas
- hygienist
- front-desk coordinator
- dentist
- **problem**: The hygienist knows the patient needs 4-month perio maintenance with bitewings next time, writes it in the note, and the front desk books a 6-month prophy because that is the default. The perio patient is lost to the wrong appointment type and the insurance frequency limits are missed.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md scheduling row: "recall, waitlist ... supervision refusal is one line + one control". /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.3 hygienist fire triggers: "Lag, extra hands required, skipped charting"; line 95 lists recall as a feature every incumbent covers, with no praise for it anywhere in the complaints or highlight sections.
- **interaction**: On Save exam (or Save note), a Next visit strip appears under the Save confirmation, prefilled from the exam: interval (3, 4, 6 months as 44 px segments), type (Prophy or Perio maintenance, pre-selected from the tenant rule on the exam's findings), imaging due (BWX, FMX, none). The hygienist confirms with one tap or changes one segment; this writes a recall_prescription on the encounter. At checkout, the Board card's checkout screen shows one control: 'Book 4-mo perio maint + BWX' which opens the scheduler already filtered to that appointment type and provider for the target week (1 tap to open, 1 tap on a slot). If the patient leaves unbooked, the recall row on the front desk's recall worklist already carries the correct type and interval, and the patient's Chairs card next time shows 'Perio maint (prescribed 05/2026)'. Supervision validation at booking refuses a perio maintenance slot when the tenant's exam-interval rule is unmet and offers 'Add exam' inline.
- **why intuitive**: Recognition over recall for the front desk (the type is on the button); the compliant path is the fastest path (one control books the right thing); structural correctness because supervision is validated at booking rather than discovered at the chair.
- **why innovative**: Every incumbent in the corpus 'covers' recall but as a front-desk list keyed on last-visit date; none binds a clinician's prescription of interval, type, and imaging to the checkout control. The report's affinity map puts hygienists' pain at 'time in the chair' and the front desk's at clicks; this removes a handoff both feel.
- **phi and controls**: The prescription is an encounter row with frozen clinical attribution; booking emits appointment events. Reminder sends (Phase 2 messaging) are disclosure rows through the BAA-gated vendor. No insurance frequency data is asserted as fact; the checkout shows the eligibility badge already fetched. Nothing is scored per person.
- **phase**: Phase 3
- **effort**: S
- **risks**: Tenant rules for when perio maintenance applies must be versioned and labeled as the practice's policy. If the hygienist's interval conflicts with the dentist's plan, the dentist's plan card wins and the prescription shows 'superseded' rather than silently changing.
- **surprise**: False

### Item 9
- **name**: Perio never loses a probe (durable autosave and honest reconnect)

#### personas
- hygienist
- **problem**: Cloud PMS outages of six-plus hours are a top complaint; a hygienist mid-way through 168 sites when the connection drops either loses the exam or keeps probing while the screen spins, and re-probing a patient is not acceptable.
- **evidence**: /home/user/Dental_Mgmt/knowledge/semantic-memory.md PATTERN: "Cloud-only platforms convert reliability into a business-continuity risk with no local fallback; 2025 Curve outages (6+ hours)". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 20: "Honest, bounded offline. v1 ships durable autosave plus a read-only degraded mode ... encrypted with a session-derived key, disabled on shared devices."
- **interaction**: Every keystroke or pad tap in Perio writes to the encrypted, session-bound draft mirror before it is sent; a small 'Saved 10:43:12' stamp under the grid updates per site. If the server is unreachable, the grid keeps accepting entries and a single banner replaces the stamp: 'Offline — probing saved on this device. Save exam will finish when connected.' Save exam is disabled (one visual identity for the irreversible write). On reconnect, a card appears: 'Exam for chair 3, 168 sites, entered 10:31–10:46 — Save now' with one control; the hygienist taps it (1 tap) and the exam writes with its original entry timestamps. On a shared device (mobile-device profile flag) the mirror is disabled and the banner instead says 'Offline — use paper chart; nothing is saved on this device', which is honest rather than silently lossy.
- **why intuitive**: Honest, bounded offline: the banner says exactly what still works. Two visual identities for the irreversible Save versus the reversible local capture. Removes the vigilance of watching a spinner.
- **why innovative**: Per the report, 'No cloud product documents an offline mode' and Curve's minimum-bandwidth page tells practices not to use wireless. A keystroke-level encrypted mirror scoped to the perio grid is the smallest honest offline the corpus's cloud incumbents do not offer.
- **phi and controls**: The mirror holds PHI only under a session-derived key on a device the tenant has marked personal, never on shared devices (zero cleartext PHI after logout is a Phase 3 exit criterion). The final write is the normal server transaction with NOT NULL encounter_id and frozen attribution; the queued-perio path with explicit reconciliation is the Phase 5 offline decision, so Phase 3 ships only autosave-and-resume within the same session.
- **phase**: Phase 3
- **effort**: M
- **risks**: A session that expires during the outage must still allow the resume after re-authentication by the same user; the mirror key derivation has to survive a re-login by the same account or the exam is lost, which must be stated in the banner. Never extend this to money or claims.
- **surprise**: False

### Item 10
- **name**: Schedule honesty: documentation time versus the appointment template

#### personas
- owner
- office manager
- hygienist
- **problem**: Perio gets skipped because the hygiene template allots 40 minutes for a visit whose measured work is 52. Owners respond by asking for per-hygienist speed reports, which the RDH panel names as the surveillance that kills adoption. The real lever is the template, and no product shows it.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-rdh-surveillance-labor.md W4: "If Smile Notes adds median ≥X minutes vs Curve QuickText, the pilot dies unless chairs are cut or paid doc blocks exist. Instrument the delta; do not gaslight." and X1 walkout: "Peer scoreboards / ranked GPA / 'top hygienist' digest". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 13: "Never score people; score control design and residual risk."
- **interaction**: In Practice → Practice health (owner and office manager only), one card per appointment type reads: 'Perio maintenance: template 40 min; measured seat-to-checkout median 49 min; documentation inside the visit median 11 min; full chart completed 61% of eligible visits (practice)'. The figures are practice-wide over a minimum sample (min-sample gating), never split by provider. One control: 'Adjust template' opens the appointment-type behaviour contract. On Chairs, the hygienist may enable a private on-device stopwatch for her own exam (a toggle in the Perio drawer) that is never transmitted; the server stores only encounter timestamps that already exist.
- **why intuitive**: Structural correctness over vigilance: the fix is a template change, not a reminder to hurry. Home is the work: the card sits where the owner already designs the schedule. Signals are batched and practice-scoped (principle 14).
- **why innovative**: The corpus's incumbents and analytics add-ons frame hygiene productivity as per-provider dashboards; the report's D.5 puts 'A PMS office managers and hygienists would choose' as unmet because none market to them. A product that refuses per-hygienist time and instead scores the template is the differentiator the RDH panel asks for in W3 and W4.
- **phi and controls**: Computed from domain_event timestamps (seated, exam_saved, note_filed, checked_out) already in the outbox; no PHI in the card. SYSTEMIC_SHARE re-scoping and minimum sample size are enforced by the digest rules; the query layer has no provider dimension for this metric, which is a CI-tested constraint, not a UI choice. Person-scoped detail does not exist for this measure even for the owner.
- **phase**: Phase 4
- **effort**: S
- **risks**: Owners will ask for the per-person split; the roadmap already lists 'Hold the line' as the mitigation and the review checklist 'no per-person ranking anywhere' is a Phase 4 exit criterion. Small practices may never reach minimum sample for rare types; the card then says 'not enough visits yet'.
- **surprise**: True

### Item 11
- **name**: Temp hygienist one-shift perio path and synthetic-mouth drill

#### personas
- hygienist
- office manager
- **problem**: A temp RDH who knows Dentrix arrives at 7:45 and must chart perio by 8:30 in software she has never seen. Hiring-pool familiarity is the one must-have a new entrant cannot buy, and a slow first exam means a skipped one.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 22: "Learnable by a temp in one shift. Role set at provisioning; role-scoped first run inside the work surface; a public temp quick-start; free self-serve certification drills verified by the real engine." Report D.4 item 5: "A hiring pool already trained on the software."
- **interaction**: The temp's role is set when the office manager creates the account (Practice → Roles, one form), so her first login lands on Chairs (mine) with today's column already assigned. Opening Perio the first three times shows a one-row grammar strip above the grid: '1–9 depth · space bleeding · backspace undo · arrows skip · pedal = next' with a 'Hide' control; it collapses permanently after the third Save or on Hide. Before the first patient, the Chairs card list starts with one synthetic card, 'Practice mouth (not a patient)', whose Perio opens a full grid with pre-set expected values; the drill accepts her entries, compares against the key, and shows 'Drill complete: 168 sites' with no score, time, or grade, then removes the card. The same drill is the public certification: it runs against the real perio engine on a demo tenant and issues a dated completion, not a rank.
- **why intuitive**: Role before work means the first beat is never 'you are not allowed'; the grammar strip is recognition over recall placed inside the work surface, not in a manual; the drill is learn-by-doing on a fake patient with zero PHI.
- **why innovative**: Incumbents in the corpus win on familiarity (Dentrix and Eaglesoft 'win hiring'); Open Dental training is billed at $80/hour online and $3,650 for an on-site day per the fee schedule. A free, in-surface, engine-verified drill on a synthetic mouth is the corpus's stated only answer to hiring-pool friction and none of the eleven offers it.
- **phi and controls**: The synthetic card carries no PHI and is flagged non-patient so it never enters the chart, ledger, recall, or reports; the drill writes a training-completion row (server-verified) with the person's name, which is a credential record, not a performance score, and shows no time or accuracy figure. Role provisioning emits the SoD check at grant time.
- **phase**: Phase 4
- **effort**: S
- **risks**: A synthetic card on a live Chairs list must be visually unmistakable (distinct shape and word, no chair assignment) so it is never confused with a patient. The grammar strip must not reappear for experienced users after a device change; store the dismissal server-side per user.
- **surprise**: False

### Item 12
- **name**: Voice perio, when it ships, is push-to-talk with quadrant read-back

#### personas
- hygienist
- dentist
- **problem**: Voice perio is the incumbents' answer to hygiene speed, but ambient or always-on capture records the whole operatory, mis-hears half of dental terms, and invents values the hygienist must police. A voice path that helps the one-operator exam has to lose to noise on purpose and confirm before it writes.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/voice-to-text-landscape.md: "generic STT mis-transcribes roughly half of dental procedure names without domain boosting". /home/user/catcorner22/dental/docs/voice-dictation-architecture.md rule 5: "There is no dictate-and-file." /home/user/catcorner22/dental/knowledge/sources/adversarial-rsi-dictation-hate.md: "The RSI fix is reliable, on-device, push-to-talk dictation — not a microphone that never stops." /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 5: "Voice perio ... once the on-device engine or a BAA speech vendor clears the frozen word-error-rate corpus."
- **interaction**: In Perio, a 56 px Hold-to-talk control (or a pedal held down) is the only microphone state; releasing stops capture. The hygienist speaks digits and 'bleed' per site; interim values show in the enlarged active cell in grey and commit only on silence of 300 ms, following the grammar exactly (a heard '3 2 4' fills three sites). At the end of each quadrant the grid pauses and reads back on screen (and optionally by on-device speech) 'UR facial: 3 2 4 · 3 3 3 · ...' with two 44 px controls: Accept quadrant / Redo quadrant. Nothing writes to perio_sites until Accept; Save exam follows the same path as keyboard entry. If the tenant has not enabled a speech engine that passed the frozen dental corpus, the control is absent, not greyed, and the pedal grammar remains the primary path.
- **why intuitive**: Deterministic first, model second, human always: the grammar is fixed, the read-back is the human check on high-stakes tokens, and the keyboard twin always exists. One verb line plus one control at the quadrant gate. Two visual identities: grey interim versus black committed.
- **why innovative**: Denticon 'AI Voice Perio', Ascend Voice Perio (June 2026), Curve Perio+ (paid add-on), Bola, and Dentrix 'Voice Notes (Ambient sold separately)' are the corpus's voice offerings; they are metered or add-on and none in the corpus describes a per-quadrant read-back gate or a push-to-talk-only policy. The plan's no-per-use-AI-metering rule makes this included or off, never billed per exam.
- **phi and controls**: Audio never becomes an artifact; with on-device Whisper WASM nothing leaves the tenant, and with a BAA vendor each session is a disclosure row (purpose treatment, codes and durations only) through the registry, which stays disabled until a countersigned BAA row exists. Browser SpeechRecognition is blocked on PHI fields. Enablement is gated by the frozen word-error-rate corpus; the WER figure is shown to the owner as an engine measure, never as a confidence percentage on the chart.
- **phase**: Phase 5
- **effort**: L
- **risks**: Handpiece and ultrasonic noise in the neighbouring operatory; the 300 ms silence commit and push-to-talk scope limit exposure but cannot eliminate it, which is why read-back is mandatory. Weight hosting under CSP for the on-device model and operatory tablet CPU limits; the pedal grammar remains the guaranteed path.
- **surprise**: False
