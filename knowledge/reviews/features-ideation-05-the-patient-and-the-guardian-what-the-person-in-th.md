# Feature ideation 5: The patient and the guardian: what the person in the chair (or the parent reading the portal at 9 p.m.) receives, signs, is asked, is charged, and can take with them — every send a disclosure row, no send that the reader cannot use.

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, the-patient-and-the-guardian-what-the-person-in-th

## Summary

13 candidate features from the The patient and the guardian: what the person in the chair (or the parent reading the portal at 9 p.m.) receives, signs, is asked, is charged, and can take with them — every send a disclosure row, no send that the reader cannot use. lens, 7 marked non-obvious.

## Lens

The patient and the guardian: what the person in the chair (or the parent reading the portal at 9 p.m.) receives, signs, is asked, is charged, and can take with them — every send a disclosure row, no send that the reader cannot use.

## Features


### Item 1
- **name**: Delivery gate on patient-audience text

#### personas
- patient
- guardian
- dentist
- hygienist
- front-desk coordinator
- **problem**: The family receives the chart voice. A summary written for a colleague, a stigmatizing label, or no summary at all ships to the portal or the printer because plain-language and stigma findings are Style-only and the patient box is skippable.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/rules/plain-language.test.ts line 19: it("is always STYLE, never a block, and points at its field"). /home/user/catcorner22/dental/src/lib/modules/universal-core.ts, section "Written for the patient": "composeNote omits an empty section entirely, so a note that skips this costs nothing." /home/user/catcorner22/dental/knowledge/sources/adversarial-parent-portal-language-hate.md, hate 1: "You built a dictionary, then graded it 'wording only.'"
- **interaction**: Encounter page, 'Written for the patient' box. Clinician sets 'How the patient received this summary' to portal / printed / read aloud and taps File (1 tap). If the audience:patient text has open plain.* findings, the killer strip shows one row — 'Held: 2 words a patient can't use' — with one control 'Explain'; tapping it opens one chip per word, each with 'Use plain word' or 'Keep and explain' (inserts 'term (plain explanation)') — 1 tap per word, then File again. A stigma hit in patient-audience text is an S1 stop with the control 'Say what happened instead' and no auto-rewrite. An empty summary with a claimed delivery is refused: 'Write it, or mark not yet given.' When the patient is a minor (from patient_relationships), openers switch to 'Here is what we found for your child' with no toggle. A successful portal or print delivery writes the disclosure row in the filing transaction and the Board card gains a 'told' chip.
- **why intuitive**: One verb line plus one control at the gate; validation silent until File; recognition (chips) over recall (a dictionary in a reference page); structural correctness — delivery cannot be claimed without content and without a disclosure row, so nobody has to remember to check; severity by shape + word (S1 stop vs S3 style) so the strip ranks in grayscale.
- **why innovative**: The corpus describes Curve presenting plans 'print/email/text with eSign', Denticon's MyTooth portal, and CareStack's built-in portal as delivery channels that send whatever the record says; no incumbent gates a patient send on readability or stigma. Smile Notes itself today is S3-only ('never a block'), so this is new even relative to the merged code.
- **phi and controls**: Portal and print sends are disclosure rows (channel, recipient, record ids, frozen actor) written in the same transaction as filing. The portal is offered by the practice through its business associate and BAA-gated at the registry. The gate is enforced (refuse), appears on the recorded-vs-enforced table, and never rewrites meaning — it blocks until a human replaces the label with behavior and what was tried. No PHI leaves the tenant for the check; it is deterministic.
- **phase**: Phase 3
- **effort**: M
- **risks**: Friction on the finish path when the clinician is behind; false positives on terms used correctly (mitigated by explainedInText and the 'keep and explain' form); the owner must decide guardian-addressed vs child-addressed voice for minors (open question in the hate doc).
- **surprise**: False

### Item 2
- **name**: Plainer pass replaces Standardize on patient fields

#### personas
- dentist
- hygienist
- patient
- guardian
- **problem**: One click on Standardize turns 'we filled a cavity' back into 'restoration', and pediatric procedures (pulpotomy, stainless steel crown, SDF, sealant, space maintainer) have no plain twin at all, so parents Google nerve death.
- **evidence**: /home/user/catcorner22/dental/src/lib/modules/universal-core.ts helpText: "Standardize still works here if you want it — it rewrites toward clinical wording, which is usually the wrong direction for this box." /home/user/catcorner22/dental/src/lib/vocab/plain-language.ts PLAIN_WORDS contains extraction, restoration, prophylaxis and no entry for pulpotomy, pulpectomy, sealant, stainless steel crown, silver diamine fluoride, or space maintainer. adversarial-parent-portal-language-hate.md hate 5: "zero entries for pulpotomy, pulpectomy, stainless steel crown, silver diamine fluoride, sealant, space maintainer".
- **interaction**: In the 'Written for the patient' box the Standardize control is not rendered. In its place is 'Plainer' (44 px, reversible visual identity). Tap once: a deterministic pass lists every PLAIN_WORDS hit as a chip — 'pulpotomy → we treated the nerve inside the baby tooth and sealed it' — with Accept or Keep-and-explain per chip (1 tap each). Nothing applies without a tap; Undo restores the prior text in one tap. Procedure names pulled from the encounter's procedures render by friendly name, never CDT number. The pediatric dictionary ships with caregiver wording and primary/permanent tooth phrasing.
- **why intuitive**: Recognition over recall (the plain twin is shown, not looked up); two visual identities (Plainer is preview-class; File is the irreversible one); no policy prose; the wrong tool is removed from the box rather than warned about.
- **why innovative**: The corpus's note tools — Dentrix and Ascend Voice Notes, Curve Care+ Notes+, Denticon AI Assist — generate or standardize clinical prose; none has a patient-audience dictionary. Smile Notes has the dictionary but runs the wrong tool on the box; inverting the tool on audience:patient fields is not in any product in the corpus.
- **phi and controls**: Deterministic, in-tenant, no egress and no model call; the dictionary is versioned and stamped (RULESET_VERSION) on the filed note. If an AI draft is later offered for this box (Phase 5), it sits behind the BAA-gated provider with a per-call disclosure row and verifyMeaning; Plainer remains the shipped deterministic twin.
- **phase**: Phase 3
- **effort**: S
- **risks**: A plainer word can change the clinical claim ('lesion' is not 'sore'), so per-chip acceptance is mandatory and the dictionary must be reviewed by a pediatric dentist; coverage gaps will show up in read-aloud tests.
- **surprise**: False

### Item 3
- **name**: Family handoff: 'what helped' travels to the chair card and the summary

#### personas
- guardian
- hygienist
- dentist
- front-desk coordinator
- **problem**: A child's fear is asked at intake and stored nowhere; the next clinician re-asks from scratch, and the parent reads a behavior label ('uncooperative') instead of what calmed their child.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-parent-portal-language-hate.md hate 4: "My kid told intake they were terrified of the drill. That answer had 'nowhere to live' until you built this module — then you left it off the visit type that needs it." /home/user/catcorner22/dental/src/lib/presets/quickPicks.ts: only assistant-chairside carries moduleIds ["direct-restorative", "imaging", "anxiety-comfort"]; there is no pediatric pick. /home/user/catcorner22/dental/src/lib/modules/anxiety-comfort.ts helpText: "This is the list the next clinician reads before the patient sits down."
- **interaction**: The pediatric appointment type's behavior contract pre-selects the pediatric and anxiety-comfort modules when the encounter opens (0 taps). On Chairs, a returning child's card shows one line from the last filed 'what helped' field ('Stop signal + counting; sunglasses'). On File, the patient-summary scaffold pre-drafts 'What helped today: …' from that field; the free-text 'Patient response' (behavior) is not audience:patient and never enters portal text. If behavior guidance is filled and anxiety-comfort is empty, the strip asks for a named omission licence ('not assessed — reason') rather than accepting a blank.
- **why intuitive**: Structural rather than vigilant: the module comes with the appointment type, not with a Quick Pick someone must remember; recognition on the chair card; named omission licence so a blank is never forced into a fabrication; the default path produces the handoff with zero extra taps.
- **why innovative**: The corpus records pediatric depth as a gap ('pediatric on Denticon and CareStack' in A.6.1 item 13) and 'pediatric image-quality complaints' on CareStack; no incumbent carries a comfort handoff across visits or into the family's summary. It exercises Smile Notes' unused anxiety-comfort module for the reader who needs it.
- **phi and controls**: Stays inside the tenant until the summary is delivered, which writes a disclosure row. Chair cards in privacy mode show initials and chair only. No per-person metric of who fills the module is ever shown — completion is practice-scoped under the SYSTEMIC_SHARE rule. The module's rule that anxiety never infers sedation is kept.
- **phase**: Phase 3
- **effort**: S
- **risks**: Over-asking anxiety at every visit; the owner must decide whether anxiety-comfort is required on every pediatric encounter or only when behavior guidance or stabilization is used; the chair-card line must never carry a label, only the comfort measures.
- **surprise**: True

### Item 4
- **name**: Estimate card the patient can read, frozen when shared

#### personas
- patient
- guardian
- front-desk coordinator
- office manager
- dentist
- **problem**: Patients cannot tell what they will owe or why, and incumbents blur estimates into receivables so the number changes without explanation.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 item 5: "No harvested review praises any product for AR clarity after dual coverage and partial payments." A.4 ledger row: "Oryx AR including estimated write-offs". /home/user/Dental_Mgmt/knowledge/reviews/design-synthesis.md line 234: "'Why this estimate' expands to the exact coverage rules applied."
- **interaction**: Patient Rail → Plan (1 tap). Each plan item shows three columns: fee / your plan pays about / you'd owe about. A 'Why' chevron opens one sentence per rule from the rule trace — 'Your plan covers crowns at 50% after a $50 deductible; you have $50 of deductible and $900 of yearly maximum left' — with the eligibility snapshot date. 'Share' (1 tap) → Print or Portal → the estimate is frozen as a versioned estimates row and a disclosure row is written; the shared page carries 'This is an estimate until your plan pays' in the header and never a balance. When the claim adjudicates, the statement shows estimate vs paid side by side (see 'Why your plan paid less').
- **why intuitive**: One canonical view per fact (the estimate lives on the plan card and nowhere else); explanations behind progressive disclosure; irreversible vs reversible identities (Share prints; Post is elsewhere and looks different); money never inside note text.
- **why innovative**: Curve 'treatment plan presented (print/email/text with eSign)' and Dentrix's 'ledger tied to checkout' are the corpus patterns; Oryx puts estimates into AR. No incumbent in the corpus shows the coverage rules that produced the number or freezes the version the patient saw.
- **phi and controls**: Print and portal shares are disclosure rows. Estimates live in their own table and are never joined into a balance (DB invariant). The rule trace is stamped with the estimate engine version. Out-of-network cases render from provider_payer_credentials so the patient portion is not mis-stated.
- **phase**: Phase 3
- **effort**: M
- **risks**: Accuracy depends on 271 detail and payer frequency rules; patients may read 'about' as a promise — wording tested in the D.8 probes; requires the Phase 2 credentialing table.
- **surprise**: False

### Item 5
- **name**: Statement and portal balance that explain themselves

#### personas
- patient
- guardian
- biller
- office manager
- **problem**: Statements show one number nobody can reconcile; a parent with three children cannot see whose visit produced which line or what the insurer has already paid.
- **evidence**: Report D.6 quotes: r/Dentistry on Open Dental "the allocated/unallocated/hidden payments in the ledger" and on CareStack "My accounting team HATES it with the passion of 1,000 suns." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md Bet 1: "'Explain this balance' renders one plain sentence per open procedure."
- **interaction**: Statement (print or portal) header: three labeled numbers — You owe / Waiting on your insurance / Credit on your account. Body: one sentence per open procedure, rendered by the same ledger_explanations renderer the biller sees: 'Mar 3 — filling, tooth 19 (Maya): fee $210; your plan paid $126 on Mar 20; you paid $40 at the visit; $44 remains.' 'What changed since your last statement' lists only appended entries. Portal 'Pay' (1 tap) → hosted card field → Post allocates oldest-open and shows the allocation. The guarantor sees each account member's lines labeled by first name.
- **why intuitive**: Same sentence, same fact on both sides of the desk (one canonical view); three numbers instead of one ambiguous total; recognition of each line's story; no balance is ever stored, so nothing can drift.
- **why innovative**: A.6.1 item 5 says no reviewed product is praised for AR clarity; Curve is invoice-based, CareStack auto-generates transfer adjustments, Open Dental hides payments. None renders allocation to the patient. DentiMax's 'real accounting' ledger is praised but is not patient-facing.
- **phi and controls**: Statement sends (print, mail, portal) are disclosure rows; statements are frozen renders. Portal payments go through the hosted vault (PCI SAQ-A). Family visibility is scoped by guarantor_accounts and account_members and by relationship consent scope; an adult member's procedure names are withheld from the guarantor when confidential-communication preferences say so. Self-pay-restricted lines never mention a plan. Each portal view is a phi_access_log row with purpose portal.
- **phase**: Phase 1
- **effort**: M
- **risks**: Statement length for large families; privacy of adult dependents on a family account; the running-vs-itemized default must follow the D.8 measured preference.
- **surprise**: False

### Item 6
- **name**: Consent is a decision, not a signature

#### personas
- patient
- guardian
- dentist
- front-desk coordinator
- **problem**: A signed form with no record of the discussion; the note asserts 'consented'; for a minor nobody records who consented or on what authority.
- **evidence**: /home/user/catcorner22/dental/src/lib/audit/rules/completeness.ts rule complete.consent-thin-assertion: "A signature or \"patient consented\" is not the conversation." /home/user/catcorner22/dental/skill/references/tennessee-dental-law-summary.md: "Do not use a form as a substitute for the discussion." /home/user/Dental_Mgmt/docs/03-data-model.md: consents (decision agreed | declined | deferred | other_option, consenting party and relationship, interpreter, clinical vs marketing scope).
- **interaction**: Plan card → Consent (1 tap) → tablet view with five slots pre-filled from the plan item: what we found, your options including no treatment, main risks, your questions, your decision. The text passes the same plain-language gate. The patient or guardian taps one of four 44 px choices — Agree / Decline / Wait / Another option — and signs. Consenting party, relationship, and interpreter are recorded; for a minor the party must be a relationship with consent scope (Tenn. Code § 63-1-176), with emancipated, mature-minor (14–18, provider judgment), and emergency as named licences rather than blanks. Saving without a decision is refused: 'Record the decision — Agree, Decline, or Wait.' The procedure flips planned → consented; the note's consent field fills structurally; a printed copy is a disclosure row.
- **why intuitive**: Structural correctness (the state machine's consented state comes only from a consent object); recognition (four decisive choices, not a paragraph); named omission licences; the form cannot substitute for the discussion because the discussion is the form's content.
- **why innovative**: The corpus pattern is forms plus eSign — Curve's plan presentation 'with eSign', Curve Forms, HS1's 22 million digital forms. No incumbent records decision plus discussion as a typed object or refuses a signature that carries no decision.
- **phi and controls**: Shared tablet runs a session-bound view with no local mirror. The consent row requires decision and party at the API (enforced). Copies handed or sent are disclosure rows. Marketing-photo consent is a separate scope and never bundled. Content is labelled provisional until Tennessee counsel review.
- **phase**: Phase 3
- **effort**: M
- **risks**: Chairside slowdown if every minor procedure demands the full flow — appointment-type contracts should scope which procedures require it; mature-minor judgment remains the provider's; state variations for later jurisdiction packs.
- **surprise**: False

### Item 7
- **name**: Guardian access derived from relationships, with age-out

#### personas
- guardian
- patient
- front-desk coordinator
- compliance lead
- **problem**: Proxy portal access is set up once and never revoked; parents keep reading adult children's records; the front desk guesses who may receive records.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md control 26: "portal access scope and records-release eligibility derive from the relationship; two-identifier verification recorded on release". tennessee-dental-law-summary.md: "Tenn. Code § 63-1-176 requires parental consent, with exceptions for emancipated minors, mature minors (14–18) by provider judgement, and emergencies." docs/06 line 264: minors' retention computed as max(last_professional_contact + 7 years, date_of_birth + 19 years).
- **interaction**: Profile → Relationships: adding a guardian is one row (relationship; scopes: clinical, financial, portal, records-release). 'Invite' (1 tap) issues the guardian's portal identity from that row — there is no separate portal-admin screen. The guardian's portal shows a person switcher. On the minor's 18th birthday a job ends the guardian's clinical and portal scope, writes a domain event, and sends both parties a plain notice; the new adult gets their own invite; financial scope persists only while they remain guarantor. At the desk, the Rail shows 'May receive records: Jane (mother), Tom (father)'; releasing writes the two-identifier verification with one 'Verified' tap.
- **why intuitive**: Recognition (who may receive is listed where the release happens); structural (scope derives from one relationship row rather than per-screen settings); nothing to remember on a birthday; a temp can release records correctly on day one.
- **why innovative**: The corpus lists a portal as universal ('All eleven cover ... a patient portal') and names Denticon's MyTooth and CareStack's portal as features, but records no incumbent modeling proxy scope by relationship or ending it at majority.
- **phi and controls**: Every guardian view is a phi_access_log row (purpose portal) with the relationship frozen; age-out is a domain event; the portal is a separate identity realm with encrypted tokens; records-release eligibility is computed, not typed; the release itself is a disclosure row.
- **phase**: Phase 5
- **effort**: M
- **risks**: Minors' confidential services and custody orders may need finer scope; age of majority differs by state (jurisdiction pack); the guardian may still be guarantor after age-out and see financial lines — the statement rules above decide what those lines say.
- **surprise**: True

### Item 8
- **name**: Intake that confirms, not re-asks, and lands as proposals

#### personas
- patient
- guardian
- front-desk coordinator
- hygienist
- dentist
- **problem**: Patients re-type their history every visit; forms either write straight into the chart or sit as PDFs nobody reads; the anxiety answer disappears.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md migration module: "Nothing auto-fills a clinical field without a human accept". Report A.5.1 Open Dental: "eClipboard $45 (+$20 OCR)". adversarial-parent-portal-language-hate.md hate 4: the intake answer had "nowhere to live".
- **interaction**: The reminder link (or lobby tablet) opens intake pre-filled from the last medical-history snapshot; the patient taps 'Still true' per section or edits (44 px targets, 8 px gaps). Consent toggles are separate rows — appointment texts, email, clinical photos, marketing photos — never bundled. SSN is never asked on a public form. Submit creates a proposal set. On Chairs the hygienist's card shows 'Intake: 2 changes' → tap → accept or decline per change, with read-back confirmation for medications, allergies, and doses; accepted changes create a new snapshot. 'What worries you about today?' writes to anxiety-comfort concerns and appears on the chair card before seating.
- **why intuitive**: Read-back for high-stakes tokens; recognition (changes, not a whole form, are reviewed); forms status already lives in the Board card expander; the patient confirms rather than retypes.
- **why innovative**: Auto-population is the corpus norm — Curve Smart Forms 'auto-populate chart', Dentrix 'Digital Forms AI', HS1's 22 million forms — and Open Dental sells eClipboard as a paid add-on with OCR. None in the corpus documents human-accept proposals or unbundled consent scopes.
- **phi and controls**: The intake link is a BAA-gated messaging or portal channel with an opaque token; each link send is a disclosure row. Submitted data is PHI inside the tenant; consents are stored with channel, scope, timestamp, and source. Lobby tablets run as shared devices with no local mirror.
- **phase**: Phase 5
- **effort**: M
- **risks**: 'Still true' confirmation bias — medications and allergies require explicit re-confirmation rather than a section-level tap; digital forms for a practice that still wants paper.
- **surprise**: False

### Item 9
- **name**: Send path refuses a message without matching consent scope

#### personas
- patient
- front-desk coordinator
- office manager
- compliance lead
- owner
- **problem**: Recall and marketing texts go to people who consented only to appointment reminders; STOP is handled by a vendor rather than the record; communications vendors are the breach surface.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md TCPA row: "Per-patient SMS and email consent with channel, scope (treatment vs marketing), timestamp, source; honor STOP in-stream; message templates carry no clinical detail; marketing texts require prior express written consent; every send is a disclosure row". docs/06 OCR row: MMG Fusion, "a business associate supplying patient-communication and marketing tools to dental practices, settled in March 2026". tennessee-dental-law-summary.md: photography requires "separate explicit consent for marketing".
- **interaction**: Every outbound — reminder, recall campaign, statement, marketing — carries a scope. The send service checks sms_email_consents inside the same transaction that writes the message row. A mismatch is refused with one line and one control: 'No marketing consent for 41 of 200 — Send to 159' (the 41 are listed, never silently dropped). An inbound STOP flips consent in-stream and writes the event. A template containing a procedure word fails the template lint at save (silent until blur). Every send is a disclosure row with channel, recipient, and template version.
- **why intuitive**: The compliant path is the fastest path — the refusal costs the same tap as the send; one verb line and one control; nothing to audit later because the check happened in the write.
- **why innovative**: The corpus prices Weave at $279–$349, RevenueWell, and Solutionreach as bolt-on communication vendors and lists Curve GRO, Ascend, and Denticon messaging as included features; none documents a consent-scope refusal. Abyde and Patient Protect record the policy; the PMS is the only place it can be enforced.
- **phi and controls**: Enforced in the transaction path (refuse) and listed on the recorded-vs-enforced table. The SMS vendor sits behind a BAA row (Twilio Security Edition or AWS End User Messaging). Templates carry no clinical detail; every send is a disclosure row.
- **phase**: Phase 2
- **effort**: S
- **risks**: The TCPA healthcare-exemption reading is labelled UNVERIFIED in docs/06 and needs counsel; over-refusal frustrates campaigns, which the listed exclusions make correctable in one pass.
- **surprise**: True

### Item 10
- **name**: Records request: the clock starts on the writing, the bundle is a button

#### personas
- patient
- guardian
- front-desk coordinator
- office manager
- compliance lead
- owner
- **problem**: Requests arrive by phone and sit in a drawer; fees are guessed; records are held for balances; x-rays cannot leave the vendor's format.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md control 23: "Records-request workflow with both clocks, a fee calculator, and a full-record export bundle; never gated on balance ... fee = the lower of the Tennessee cap and HIPAA's cost-based fee, zero when the deadline is missed". Report A.6.1 item 9: "tab32 data withheld pending contract payout"; A.4: "Eaglesoft x-rays are proprietary and cannot be bridged".
- **interaction**: Desk: Patient Rail → Docs → 'Records request' (1 tap) → scan or upload the written request; its receipt timestamp sets due_at = +10 working days, with the HIPAA +30 date shown as a second line → pick scope (everything / date range / images only) and destination (patient's portal, another dentist via BAA eFax, secure link) → the fee is computed and shown before 'Send bundle' (irreversible identity). Send bundle assembles notes, chart, perio, DICOM, ledger, claims, and consents, writes the disclosure row with row counts, and marks fulfilled. There is no balance-hold control anywhere in the flow. Portal: 'Get my records' (1 tap) runs the same bundle to the patient's own portal at no charge. Overdue requests appear as one row on the owner's Daily Close home.
- **why intuitive**: One request row with one action; structural (no hold exists to bypass, no summary can be substituted); the owner sees overdue without opening a report; a temp can fulfil a request on day one.
- **why innovative**: The corpus documents data-hostage patterns (tab32's exit dispute, Eaglesoft's proprietary x-rays, Curve's remaining-term obligation). Reusing the PMS's no-fee self-service exit export as the patient's own export — DICOM included — appears in no incumbent in the corpus.
- **phi and controls**: Fulfilment is a disclosure row (records-request purpose) with identity verification recorded; eFax only through a registry vendor with a live BAA (Phase 4); the bundle is stored as a document with SHA-256; a summary never satisfies the right of access; the fee rule is enforced by the calculator, not by staff memory.
- **phase**: Phase 4
- **effort**: M
- **risks**: The § 63-2-102 fee figures are UNVERIFIED and need counsel; large DICOM bundles need object-storage streaming; identity verification for portal-originated requests must be at least two identifiers.
- **surprise**: True

### Item 11
- **name**: Don't bill my insurance for this — one toggle at checkout

#### personas
- patient
- front-desk coordinator
- biller
- **problem**: A patient who pays in full and asks that a procedure stay off their insurance record still gets a claim filed, because nothing in the checkout or claims flow can stop it.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md control 25: "`procedures.self_pay_restricted` (set at checkout when the patient pays the full fee and asks) hard-blocks inclusion in the scrubber and in any payment-purpose disclosure to the plan, while leaving treatment disclosures and legally required disclosures unaffected; statements for restricted procedures never mention insurance".
- **interaction**: Checkout screen, procedure line: a 44 px toggle 'Paid in full — don't send to insurance' appears only when the tender covers the full fee. Post writes the flag in the same transaction as the charge and payment. Claim assembly refuses the procedure; ERA matching ignores it; the statement line never mentions a plan; the Patient Rail shows a small 'restricted' glyph on that procedure. Lifting the flag later requires the patient's request recorded as a consent object (1 tap 'Patient asked to bill').
- **why intuitive**: A right offered at the only moment it can be exercised, so no one has to recall a rule; structural refusal in claim assembly rather than a note on the account; zero extra clicks when unused.
- **why innovative**: The corpus documents no incumbent enforcing the 164.522(a)(1)(vi) restriction; insurance modules — Dentrix eClaims, Curve's unlimited eClaims, Denticon's batch claims — are built to send everything.
- **phi and controls**: Enforced hard-block in the scrubber and in payment-purpose disclosures; treatment and legally required disclosures unaffected; the accounting of disclosures filters the restricted procedure from payment purpose; the flag change is a domain event.
- **phase**: Phase 2
- **effort**: S
- **risks**: Bundled or global-fee procedures; secondary coverage where the primary was paid by the patient; a patient who later wants it billed after a timely-filing window.
- **surprise**: True

### Item 12
- **name**: 'Where my record went' in the portal

#### personas
- patient
- guardian
- compliance lead
- office manager
- **problem**: Patients cannot see who received their information; the accounting of disclosures is a 60-day paper exercise nobody wants to run.
- **evidence**: /home/user/Dental_Mgmt/docs/06-security-and-hipaa-plan.md control 22: "Every print, export, fax, SMS, email, portal send, records-request fulfilment, and AI call is a disclosure row; per-patient report for 6 years". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 15: "Every AI call, export, print, fax, SMS, and portal send is a disclosure row."
- **interaction**: Portal → 'Where my record went' (1 tap): a chronological list rendered from the disclosures table — 'Mar 4: claim sent to Delta Dental (2 procedures)', 'Apr 2: x-rays faxed to Dr. Ortiz for your referral', 'May 1: a copy of your records sent to you'. Each row is recipient, channel, what (kinds and counts, never content), and why in plain purpose words. 'Request the full accounting' (1 tap) opens the 164.528 task with its 60-day clock on the compliance lead's Practice risk home. Internal staff views are never shown: that is an access log, and displaying it would rank people.
- **why intuitive**: One list of sentences, no PDF; recognition; the statutory report becomes a filter over what the patient already sees.
- **why innovative**: No portal in the corpus (Denticon MyTooth, CareStack, Curve) exposes disclosure accounting to the patient; compliance platforms (Abyde, Patient Protect) log for the practice, not for the person whose record moved.
- **phi and controls**: Reads the disclosures table only (codes and counts); the portal view is itself a phi_access_log row with purpose portal; the formal accounting applies the nine statutory exclusions; no staff names or view counts appear; AI-call disclosure rows are shown as 'used to draft your summary' with the provider named.
- **phase**: Phase 5
- **effort**: S
- **risks**: Routine payment and treatment disclosures may alarm patients — the purpose wording must be tested in read-alouds; a referral recipient's name is itself PHI-adjacent and must respect confidential-communication preferences.
- **surprise**: True

### Item 13
- **name**: Why your plan paid less, in plain words

#### personas
- patient
- guardian
- biller
- front-desk coordinator
- **problem**: The most common billing call — 'you said $44, why do I owe $190?' — is answered with a CARC code nobody at the desk can translate.
- **evidence**: /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md A.6.1 item 1: "78% report rising denials"; item 5: "No harvested review praises any product for AR clarity after dual coverage and partial payments." /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md insurance module: "claim lines with CARC/RARC".
- **interaction**: When an ERA line posts with a CARC or RARC that raises patient responsibility above the frozen shared estimate, the statement line gains one sentence from a versioned deterministic dictionary: 'Your plan paid less than we estimated: it counts this as a frequency limit (one cleaning every 6 months).' An unknown code renders honestly: 'Your plan gave a reason we can't explain — tap to ask us.' On Money Desk the biller's ERA exception row shows the same sentence with two controls: 'Appeal' or 'Explain to patient' (adds the sentence to the next statement).
- **why intuitive**: Same fact, same sentence on both sides of the desk; recognition over a code lookup; one control; the estimate freeze makes the comparison honest rather than defensive.
- **why innovative**: The corpus credits Dentrix's eClaims depth, Denticon's automatic 835 posting, and Curve's unlimited ERA, yet billers still call ledgers unreadable; no incumbent renders adjudication reasons for the patient.
- **phi and controls**: Statement sends are disclosure rows; the CARC dictionary is versioned and stamped on the rendered statement; deterministic, no model; self-pay-restricted lines are excluded by construction.
- **phase**: Phase 2
- **effort**: S
- **risks**: CARC semantics vary by payer and RARC often carries the real reason; over-simplified sentences could mislead — the dictionary needs a biller review pass and the 'can't explain' fallback must stay honest.
- **surprise**: True
