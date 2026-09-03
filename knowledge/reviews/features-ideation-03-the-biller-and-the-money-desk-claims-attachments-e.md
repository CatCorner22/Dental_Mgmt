# Feature ideation 3: The biller and the Money Desk: claims, attachments, ERA posting, denials and appeals, the readable ledger, statements, payment plans, and the CPA month-end

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, the-biller-and-the-money-desk-claims-attachments-e

## Summary

12 candidate features from the The biller and the Money Desk: claims, attachments, ERA posting, denials and appeals, the readable ledger, statements, payment plans, and the CPA month-end lens, 7 marked non-obvious.

## Lens

The biller and the Money Desk: claims, attachments, ERA posting, denials and appeals, the readable ledger, statements, payment plans, and the CPA month-end

## Features


### Item 1
- **name**: Record-bound claim pre-flight (procedure-to-finding binding)

#### personas
- biller
- dentist
- hygienist
- office manager
- **problem**: The biller queues a D4341, D2740, or D7210 and learns 30-45 days later that the payer wanted a perio chart, a radiograph interpretation, or a patient-specific indication. Today the scrubber checks form fields (NPI, subscriber id, tooth number) but never asks whether the chart supports the line, so the biller becomes the person who re-reads notes after a denial.
- **evidence**: /home/user/catcorner22/dental/knowledge/sources/adversarial-insurance-auditor-hate.md, fix 2: 'Procedure↔finding binding before Ready — When a module/procedure family is active (crown, SRP, extraction, endo, implant), require named, patient-specific indication fields (site + finding class + why now), not free-text keyword luck. No indication → no Ready → no Copy.' Also /home/user/Dental_Mgmt/knowledge/sources/ada-hpi-levin-zentist-surveys-2025.md: '78% report rising denials'.
- **interaction**: Money Desk → Claims tab → a row in 'Needs pre-flight' reads 'D4341 UR quadrant: no perio site ≥4 mm recorded on this encounter' (WHAT/WHY in one line) with one control 'Open perio exam' that deep-links to the encounter page at that quadrant (1 click). The scrubber rule is deterministic and versioned: SRP requires perio_sites with depth ≥4 mm or bleeding in the billed quadrant on the same encounter; crown requires a chart_event finding class (fracture, caries into dentin, failed restoration) on that tooth; extraction requires a finding plus an imaging interpretation row. Passing lines show a green square 'Supported'; failing lines a filled square 'Blocked'. Clean claims move to 'Queued' with no click. A blocked line cannot be queued; it can be released to 'patient responsibility' only with a reason code, which is a reversible action styled as such.
- **why intuitive**: Structural correctness over vigilance: the rule reads the perio_sites and chart_events tables that already carry a NOT NULL encounter FK, so the biller never has to remember which payer wants what. One verb line plus one control at the gate. Recognition over recall: the row names the exact missing fact. Fewer denials means fewer rows on the Denials tab, which is the only metric that matters to the biller.
- **why innovative**: The corpus praises Dentrix for 'insurance/eClaims depth' and CareStack for a 'claims tracker' (report v3 A.6.2), and Denticon for 'Batch claims; automatic 835 posting' (A.3), but every incumbent scrubs the claim form, not the clinical record; the auditor panel's whole attack is that 'two systems, one story tailored for pay' is possible because no product 'matching code↔finding' exists. Only a PMS that owns perio_sites and chart_events can bind them at claim assembly.
- **phi and controls**: No PHI leaves the tenant; the rule runs server-side on tenant rows. The pre-flight finding is written to preflight_findings and stamped with RULESET_VERSION so a later rule change never regrades a queued claim. Explicitly refuses the auditor's trap: no AI drafts indication language from the CDT line; the deterministic rule is the only twin and there is no model twin for necessity. Release-to-patient-responsibility is a reason-coded ledger event visible in the digest by reason, never by person.
- **phase**: Phase 3
- **effort**: M
- **risks**: False blocks on legitimate care if finding classes are too narrow (mitigate: the omission-licence pattern, a named 'clinical judgement' indication field the dentist fills, and the precision harness); perio data does not exist until Phase 3 so the SRP rule ships then while the attachment-presence rule ships in Phase 2; payer requirements vary and the rulebook must be versioned per payer.
- **surprise**: True

### Item 2
- **name**: Attachment assembled from the encounter

#### personas
- biller
- front-desk coordinator
- **problem**: When a payer requires an attachment the biller leaves the claim, opens the imaging app, exports a JPEG, screenshots the perio chart, names files, and uploads them to NEA or Vyne one by one. Wrong-patient and wrong-date uploads are common because nothing ties the file to the claim.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 2: 'A claim-attachment vendor (NEA FastAttach or Vyne) chosen with the clearinghouse, with attachment presence a scrubber rule for attachment-required CDT codes (SRP, crowns, most appeals).' Report v3 A.6.1 #1: 'review language clusters on eClaims, fee schedules, dual insurance, ERA posting, and checkout clicks.'
- **interaction**: Money Desk → Claims tab → row 'D4341: attachment required by Delta' → one control 'Attach from visit' (1 click). A drawer lists what the encounter already holds, pre-checked by rule: the perio exam rendered as a chart image, the radiographs from the encounter's imaging study, the filed-note excerpt for the billed module, the pre-authorization if one exists. The biller unchecks anything not wanted and presses 'Send with claim' (1 click; irreversible identity). A row with no eligible artifact says 'No radiograph on this visit' with one control 'Request from Dr. Reagan' that creates a row on the dentist's Exams-to-sign queue. Total: 2 clicks for the common case, zero file naming.
- **why intuitive**: Recognition over recall: the drawer shows what exists instead of asking the biller to remember. Attachment is structural: the artifact is chosen by encounter FK, so wrong-patient attachments are impossible by construction. One verb line plus one control at the gate; the missing-artifact case is a routed request, never a dead end.
- **why innovative**: Curve bundles 'Unlimited eClaims/ERA/eligibility (DentalXChange, Vyne remain partners)' and Open Dental has '20+ clearinghouses' (report v3 A.3), but attachments in every incumbent are a file-upload step from a separate imaging store; Dentrix keeps images 'outside the database' in an 'image path' (A.4) and Eaglesoft x-rays 'cannot be bridged', so none can assemble an attachment from structured perio and imaging rows on the encounter.
- **phi and controls**: Each send is a disclosure row (purpose: payment; destination: the attachment vendor; artifact ids and byte hashes, never rendered PHI in the event payload). The attachment vendor stays disabled at the integration_registry until a countersigned BAA row exists. The self-pay-restricted flag on a procedure blocks attachment assembly the same way it blocks claim assembly. The frozen attachment bytes are stored beside the frozen 837 so an appeal can prove what was sent.
- **phase**: Phase 3
- **effort**: M
- **risks**: Depends on the imaging import (Phase 3) for radiographs; Phase 2 ships the same drawer with document uploads only. Vendor API limits on image size and format. Payer-specific attachment expectations must be a versioned per-payer table, not hard-coded.
- **surprise**: False

### Item 3
- **name**: ERA posting with contract-variance detection

#### personas
- biller
- office manager
- owner
- **problem**: Automatic 835 posting in incumbents posts whatever the payer allowed and writes off the difference as contractual, so a payer paying below its own fee schedule is never noticed. The biller only sees underpayment when a patient calls about a balance that should not exist, months later.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 21: 'fee schedules per plan per provider in one place ... automatic 835 posting with line-item match'. /home/user/Dental_Mgmt/docs/04-ux-blueprint.md flow 5: 'matched lines green (already posted), unmatched amber with a proposed match → Post matched (1 click) → resolve exceptions with Post / Write-off (reason) / Appeal'.
- **interaction**: Money Desk → ERA tab → a batch row 'Delta 835 · 41 lines · 37 posted'. Matched lines were posted by the worker before the biller opened the batch, each insurance_payment and contractual write_off entry linking to the era_line, the 835 CLP/SVC segment, the claim line, and the fee-schedule row used. Four lines sit amber: 'Paid $412; contract allows $460 (Delta PPO, Dr. Reagan, D2740)' with one control 'Dispute' (creates an appeal row carrying the fee-schedule citation) and a secondary reversible 'Accept as contractual (reason)'. Tolerance is a tenant setting under maker-checker (default $5 or 2%). Every posted entry offers 'Why did this post?' on tap: a four-line trace, not a report.
- **why intuitive**: Deterministic first: allowed vs contracted is arithmetic over rows the PMS already holds. The compliant path is the fastest: green lines need zero clicks, the exception is the only thing on screen. Severity by shape, word, and luminance so a biller can rank the batch in grayscale. Home is the work: the ERA tab is the three-worklist Money Desk, not a report to run.
- **why innovative**: Denticon's 'automatic 835 posting' and Curve's bundled ERA (report v3 A.3) post allowed amounts without comparing them to the plan's fee schedule; Dentrix Ascend reviewers report 'fee-schedule workarounds' (A.6.2), meaning the schedule is not even reliably in one place to compare against. No product in the corpus is described as flagging underpayment at posting; that work is done by outside RCM services (Zentist's report is itself a vendor of that service).
- **phi and controls**: ERA files arrive only through the BAA-covered clearinghouse adapter; the 835 bytes are frozen. The contractual write-off derived from an ERA is a distinct kind from a discretionary write-off and is exempt from dual release only because its amount is computed from the frozen 835 and fee-schedule rows, not typed; 'Accept as contractual' on a variance line is a discretionary reason-coded write-off and routes through evaluateRelease above threshold. Disputes appear in the digest aggregated by payer and reason code, never by biller.
- **phase**: Phase 2
- **effort**: M
- **risks**: Fee schedules are often stale or missing at conversion; the feature must degrade to 'no contract on file' amber rather than false green. Payers' allowed amounts legitimately vary by downgrade rules (alternate benefit), so the CARC on the line must suppress the variance when it explains it.
- **surprise**: True

### Item 4
- **name**: Secondary claim fires from the primary ERA posting

#### personas
- biller
- **problem**: Dual coverage is the scenario billers name most; today the secondary claim is a manual re-key after the primary EOB arrives, with the primary payment typed into COB fields by hand, and it is the step most often forgotten.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 21: 'primary/secondary coordination with automatic secondary claims'. Report v3 A.6.2 CareStack complaints: 'dual-insurance glitches'; A.6.1 #5: 'No harvested review praises any product for AR clarity after dual coverage and partial payments.'
- **interaction**: When an era_line posts against a claim whose patient has coverage rank 2 with effective dates covering the service date, the worker assembles the secondary claim in 'queued' with COB segments filled from the frozen 835 (primary paid, allowed, adjustment reasons) and the primary ERA as an attachment where the payer requires it. Money Desk → Claims tab shows 'Secondary ready — MetLife — $142 remaining on D2740' with one control 'Send' (1 click). If the secondary needs pre-flight (an attachment or a missing subscriber id) the row is a pre-flight row instead. The ledger shows ins_ar_primary drop and ins_ar_secondary rise as two labeled numbers on the Patient Rail, never a transfer adjustment.
- **why intuitive**: Zero recall: the biller never has to remember that a secondary exists; the coverage row makes it structural. The balance remains readable because accounts receivable is split by bucket, so 'pending secondary' is a labeled number, not a mystery credit. One verb line plus one control.
- **why innovative**: CareStack 'auto-generates transfer adjustment lines' that its users' 'accounting team HATES' (revup-dental-pms-reviews-2026.md) precisely because dual coverage is modeled as transfers between ledgers; Open Dental's 'allocated/unallocated/hidden payments' complaint is the same failure. Assembling the secondary from the frozen 835 rather than re-keyed EOB figures is not described for any incumbent in the corpus.
- **phi and controls**: The secondary is an 837 through the same BAA-covered clearinghouse; frozen bytes and a claim_event 'assembled_from_era' row link it to the primary ERA. The self-pay-restricted flag blocks assembly. No new controls; the insurance_payment entry still requires claim + coverage by DB invariant.
- **phase**: Phase 2
- **effort**: M
- **risks**: Coverage rank and effective dates must be correct at conversion (a public 'what does not convert' item). Some payers reject electronic COB without the paper EOB; the attachment path covers that. Birthday-rule and dependent-order edge cases need the property-test suite scenario already planned for dual coverage.
- **surprise**: False

### Item 5
- **name**: Denial worklist with plain-language CARC, deterministic next action, and record-built appeal packet

#### personas
- biller
- office manager
- dentist
- **problem**: A denial arrives as CARC 16 / RARC N4 and the biller decodes it, decides whether to fix and resubmit, appeal, or bill the patient, then builds an appeal letter by copying from the chart. Appeal windows are missed, and the quiet path is to write it off.
- **evidence**: /home/user/Dental_Mgmt/docs/05-internal-controls-module.md line 20: 'Denial suppression: a write-off whose claim events show a denial with no appeal routes through dual release regardless of amount, and the person who submitted the claim cannot post it.' /home/user/Dental_Mgmt/knowledge/sources/ada-hpi-levin-zentist-surveys-2025.md: '78% report rising denials'.
- **interaction**: Money Desk → Denials tab. Each row: patient, amount, one line in plain words from a versioned CARC/RARC table ('Denied: perio chart not received — Delta') with an appeal-by date, and one primary action chosen deterministically by the same table: 'Attach and resubmit', 'Appeal', 'Correct and resubmit', or 'Bill patient'. 'Appeal' (1 click) opens the appeal packet drawer pre-filled from the record: the filed note excerpt for the billed module, perio sites for the quadrant, the images, the frozen 837 and 835, the fee-schedule row, and a letter shell with the CARC restated; the biller adds nothing but a checkbox review and presses 'Send appeal' (irreversible identity). 'Write off' exists only as a secondary reversible-styled control and, because the claim has a denial with no appeal, always shows the inline dual-release card naming the second approver. A separate deterministic rule proposes per-payer scrubber additions: after three denials for the same CARC and CDT family from one payer in 90 days, the Claims tab shows a proposal row 'Delta denied 3 D4341 for missing perio chart — add pre-flight rule?' with Accept (maker-checker, versioned) or Dismiss (reason).
- **why intuitive**: Recognition over recall: the code is translated once by the table, not by every biller. Every row has exactly one primary action. The compliant path is fastest: appeal is one click with the packet built; write-off is the slow lane with a second approver. Learned rules are shown where the cause is (the payer's next claim), not in a settings page.
- **why innovative**: CareStack has a 'claims tracker' and Dentrix 'insurance/eClaims depth' (report v3 A.6.2), but neither is described as translating CARC to an action or building an appeal from structured perio and chart rows; the adversarial auditor panel notes offices 'wave GPA/stamp; still lose' because appeals cite prose, and asks for 'Durable indication fields cited in appeals'. The per-payer rule proposal is a deterministic feedback loop no incumbent in the corpus offers; Abyde-class products run questionnaire-to-policy loops only for HIPAA.
- **phi and controls**: Each appeal send is a disclosure row (payment purpose, payer destination, artifact hashes). The appeal packet is assembled from frozen artifacts so the practice can prove what was sent. Denial suppression is enforced in postGuarded, not recorded. Denial counts aggregate by payer, CARC, and CDT family only; there is no per-biller denial rate anywhere, and the digest's SYSTEMIC_SHARE rule re-scopes any pattern to the practice. Rule proposals are versioned under CONTROL_RULEBOOK_VERSION-style stamping and require a human accept.
- **phase**: Phase 2
- **effort**: L
- **risks**: The CARC→action table needs a payer-specific overlay and a maintainer; wrong 'Bill patient' mappings shift payer denials onto patients, so that action should require the CARC to be a patient-responsibility group code (PR) and otherwise fall back to 'Review'. Appeal windows vary by payer and plan; the date is shown only when the payer table has one.
- **surprise**: True

### Item 6
- **name**: Statement is 'Explain this balance', with hold reasons

#### personas
- biller
- front-desk coordinator
- owner
- **problem**: Patients call because the statement shows a number with no story; the front desk reads a different screen than the biller and gives a different answer; statements go out on balances that are still waiting on insurance and are then reversed.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 31: "'Explain this balance' renders one plain sentence per open procedure." and line 23: 'A ledger clinicians and accountants can both read (the clearest whitespace; no harvested review praises any product for AR clarity after dual coverage and partial payments)'. Report v3 A.6.1 #5: 'Curve partial-payment posting and invoice-vs-ledger'.
- **interaction**: Money Desk → Statements due tab. Each row: guarantor, amount, and either 'Ready' or a hold reason in one line ('Held: Delta claim pending 18 days on D2740'). The statement body is the ledger_explanations view rendered as sentences: 'Crown, tooth 30, Mar 12 — fee $1,200. Delta paid $650 on Apr 2. Your share: $550. Nothing on this statement is an estimate.' Estimated portions never appear on a statement; if a claim is pending, the procedure is listed under 'Waiting on insurance' with no dollar figure attached to the patient. 'Send' (1 click, irreversible identity) freezes the statement as an artifact with a statement id; 'Preview' is reversible-styled. The Patient Rail's balance shows the same three labeled numbers, and 'Explain' on the Rail renders the same sentences the patient received, so front desk and biller read identical text.
- **why intuitive**: One canonical view per fact: the statement and the Rail explanation are the same view. Recognition over recall for the patient too. Fewer words: a sentence per procedure, no running-balance column to decode. Hold reasons replace silent skipping so 'Why didn't Mrs. Smith get a statement?' has a visible answer.
- **why innovative**: Curve is 'invoice-based' and Oryx's 'AR includes estimated write-offs' (report v3 A.4, A.6.2), so their statements either fragment the ledger into invoices or print estimates as debt; Open Dental's 'allocated/unallocated/hidden payments' complaint means the statement cannot explain itself. DentiMax's 'real accounting' ledger is the closest praise and it says nothing about patient-facing explanation. Weave and RevenueWell send statements as a comms layer over whatever the PMS ledger says (practicesignal-dental-pricing-2026.md), so they inherit the confusion.
- **phi and controls**: Every statement send is a disclosure row by channel (print, mail vendor, portal, SMS link) with the frozen statement id; mail and SMS vendors gate at the BAA registry. The portal copy passes the plain-language delivery gate; the standardize pass is disabled for patient-audience text. Statement text never includes clinical narrative, only procedure names and dates. The statement artifact is INSERT-only.
- **phase**: Phase 1
- **effort**: M
- **risks**: Some guarantors want a running-balance layout; the D.8 reaction test on running vs itemized decides the default and the alternative is a print option, not a second ledger. Hold logic must have a maximum hold age so pending claims do not suppress statements forever; the aging worklist surfaces claims over 30 days regardless.
- **surprise**: False

### Item 7
- **name**: Point-in-time ledger ('As of')

#### personas
- biller
- office manager
- owner
- **problem**: A patient calls about a statement from six weeks ago; the ledger has since posted an ERA, a reversal, and a payment, and the biller cannot reconstruct what the patient was looking at. In incumbents the balance is a stored number, so history is gone once it changes.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 2: 'The ledger is a journal, not a balance. Balances are sums over append-only entries; corrections are reversal plus repost'. /home/user/Dental_Mgmt/knowledge/sources/revup-dental-pms-reviews-2026.md: Curve complaints on 'partial insurance payments' and Open Dental 'ledger allocation logic'.
- **interaction**: Patient Rail → Ledger (1 tap) → a date chip 'As of today' at the top of the single ledger view. Tap it, pick a date or pick a statement from the list of frozen statements (1 tap); the ledger re-renders as the sum over entries posted on or before that instant, the three labeled numbers change, and a strip 'What changed since' lists the entries posted afterward, each with kind, reason code, and frozen poster name. 'Back to today' is one tap. No export, no report; the same screen.
- **why intuitive**: Exactly one ledger view; the date chip is the only addition. Recognition over recall: the biller picks the statement the patient is holding instead of reconstructing it. It removes the vigilance of 'remember what it looked like' because append-only entries make the past a query.
- **why innovative**: No incumbent in the corpus is described as offering a point-in-time ledger; CareStack's auto-generated 'transfer adjustment' lines and Open Dental's 'hidden payments' (report v3 A.6.1 #5, D.6) exist because those ledgers mutate balances in place and then paper over the change. tab32 users report 'unreconciled, mismatched reports' for the same reason. The feature is free once the ledger is a journal with a posted_at timestamp and frozen statement artifacts.
- **phi and controls**: Read-only over tenant rows; a phi_access_log row with purpose 'payment' as for any ledger open. The frozen poster name is the snapshot taken at write time, so a renamed or deactivated user still appears correctly. No new write paths.
- **phase**: Phase 1
- **effort**: S
- **risks**: Effective-dated vs posted-dated entries must be shown by posted date for 'what the patient saw' and by effective date for the CPA view; the chip must say which it is using. Performance at group scale needs the monthly partitions already planned.
- **surprise**: True

### Item 8
- **name**: ERA EFT tied to the bank line by trace number

#### personas
- biller
- owner
- office manager
- **problem**: The largest deposits are payer EFTs covering dozens of patients; the day sheet shows insurance payments by patient and the bank shows one EFT, so the owner's daily 'Tied?' question fails on insurance days and the variance is noise the biller must explain by hand.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 3: 'The bank is the only independent ground truth. Daily deposit-to-day-sheet reconciliation runs against data the PMS did not generate.' /home/user/Dental_Mgmt/knowledge/sources/zeldent-dental-fraud-detection.md: 'It is independent reconciliation, the daily comparison of ledger to bank, performed by something that sits outside the system being checked.'
- **interaction**: When an ERA batch posts, the era_payment's TRN (trace number, payer id, amount, effective date from the 835 BPR/TRN segments) becomes a deposit line of tender 'EFT' automatically; the biller does nothing. Daily Close → the owner's 'Yesterday reconciled?' matcher pairs bank_transactions to deposit lines by amount and TRN, so an EFT of $4,812.33 matches in one step and its 41 patient lines are already explained. If the bank EFT differs from the 835 total (a payer-side offset or a recoupment), the variance row reads 'Delta EFT $4,612.33 vs 835 $4,812.33 — $200 recoupment on claim 1187' with one control 'Investigate' for the owner and, for the biller, a Money Desk row 'Recoupment: post $200 reversal on claim 1187'. Paper checks in an 835 create a deposit line of tender 'check' awaiting the physical deposit slip.
- **why intuitive**: Removes vigilance: the biller no longer explains insurance days to the owner. One shape+word status stays honest because the match is on payer data plus bank data, neither typed by staff. The recoupment case becomes a worklist row with one action rather than a mystery.
- **why innovative**: Zeldent reconciles bank to PMS from outside because incumbents do not; Denticon and Curve post 835s but the corpus does not describe any PMS matching the 835 trace number to a bank feed line. Dental Intelligence and Jarvis (docs/09-naming.md) sell huddle reports over PMS data and never touch the bank. The controls literature (smb-accounting-internal-controls.md) names reconciliation as the primary control and treats it as a CPA service, not a posting-time event.
- **phi and controls**: Bank data enters through the aggregator (under DPA/BAA review) or statement import; the deposit line carries payer id and TRN, not patient names, so the reconciliation screen is PHI-minimal. The named runtime SoD block applies: whoever posted the ERA that day cannot clear that day's variance. Recoupment reversals are ledger reversals with a reason code and link to the era_line; over-threshold ones route through dual release.
- **phase**: Phase 2
- **effort**: M
- **risks**: Some payers batch multiple 835s into one EFT or split one 835 across EFTs; the matcher needs many-to-one tolerance and must fall back to amber, never force a match. Statement-import tenants get match by amount and date only, and the 'independent' score stays capped as the roadmap already states.
- **surprise**: True

### Item 9
- **name**: Credit-balance refund worklist

#### personas
- biller
- office manager
- owner
- **problem**: After an ERA posts, patients who prepaid the estimate end up in credit; the credit sits invisible in a stored balance until the patient notices or the state unclaimed-property clock runs. In incumbents these credits are the 'unallocated' and 'hidden' payments billers complain about.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 2: 'Accounts receivable splits into patient / primary insurance / secondary insurance / unapplied so estimated write-offs can never contaminate a balance.' /home/user/Dental_Mgmt/knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md D.6: "r/Dentistry on Open Dental's ledger: 'the allocated/unallocated/hidden payments in the ledger.'"
- **interaction**: Money Desk → Unallocated credits tab (already one of the biller's rows) gains an age column and a per-row proposal: 'Smith — $85 credit, 12 days — no open charges' with one primary control 'Refund' or, when open charges exist, 'Apply to Mar 12 crown'. 'Refund' opens the refund form with the amount pre-filled from the unapplied_credit bucket; above the tenant threshold the inline dual-release card names the eligible second approver and 'Request approval' is the single control. Credits older than 60 days move to the top with a filled-square 'Aging' mark. Applying is reversible-styled; refunding is irreversible-styled.
- **why intuitive**: The credit is a row, never a number to notice. Every row has one primary action. Two visual identities keep apply and refund distinct. Nothing requires the biller to run an 'unapplied credit report' from memory.
- **why innovative**: Open Dental's allocation complaint and CareStack's transfer adjustments (report v3 A.6.1 #5) show incumbents let credits hide inside balances; no product in the corpus is described as aging unapplied credits into a worklist with refund routed through a second approver. Refund controls are exactly what Zeldent alerts on from outside ('refunds above threshold, after-hours transactions').
- **phi and controls**: Refund is a money-moving channel through postGuarded; evaluateRelease runs in the posting transaction and an after-hours refund pages the owner (one of the six named hard events). The refund to card goes through the processor's hosted vault by token; no card data is held. Refund counts aggregate by reason code, not by person.
- **phase**: Phase 2
- **effort**: S
- **risks**: Refund-to-original-tender rules for card networks; patients who prefer to hold credit for planned treatment need a reason-coded 'hold by patient request' that itself ages. Duplicate-patient-payment detection (already a detector) should feed this tab rather than the digest alone.
- **surprise**: False

### Item 10
- **name**: Payment and membership plans on adjudicated balances, with a deferred-revenue schedule for the CPA

#### personas
- biller
- office manager
- owner
- CPA seat
- **problem**: Payment plans set up on estimated portions collapse when insurance pays differently, producing refunds and re-plans; membership fees collected annually are booked as revenue on receipt, so the CPA restates them; discount-plan write-downs appear as unexplained adjustments.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 1: 'In-house membership plans ... recurring payment plans (`payment_plans`: schedule, auto-charge through the processor token) ... are in the ledger property-test suite from the start, because they are the daily events that produce the "transfer adjustment" confusion the research describes and the signature ledger would otherwise fail on the first uninsured patient.' Report v3 A.6.2 CareStack: "Ledger transfer adjustments ('accounting team HATES it')".
- **interaction**: Patient Rail → Ledger → 'Start payment plan' (1 tap). The form lists only charges in the patient_ar bucket (adjudicated or self-pay); charges still in ins_ar are shown greyed with 'Waiting on Delta' and cannot be included. Schedule, first date, and the stored processor token are three controls; 'Start plan' is irreversible-styled and writes the plan plus a patient-consent disclosure row. A missed auto-charge becomes a Money Desk row 'Card declined — Smith — $85' with one control 'Retry' and a secondary 'Message patient' through the BAA-covered channel. Membership plan fees post as a `membership_fee` entry with a revenue schedule; the CPA month-end package shows a deferred-revenue roll-forward (opening, collected, recognized, closing) alongside the AR roll-forward. Discount-plan write-downs post as adjustments with reason code 'membership_discount' and are visible on the Rail's 'Explain' as 'Membership discount applied: -$120'.
- **why intuitive**: Structural correctness: a plan cannot be built on an estimate because the form only offers adjudicated charges. Recognition over recall on the missed-payment event. The owner and CPA read the same three labeled numbers plus one deferred line instead of interpreting transfer lines.
- **why innovative**: CareStack's transfer adjustments and Oryx's estimated write-offs in AR (report v3 A.4, A.6.2) are exactly the artifacts that arise from plans built on estimates; no incumbent in the corpus is described as producing a deferred-revenue schedule for membership fees, and the accounting-team hatred quoted in revup-dental-pms-reviews-2026.md is the evidence that the CPA is not a persona for any of them.
- **phi and controls**: Auto-charge runs on the processor token inside the hosted vault; the consent to recurring charge is a disclosure/consent row with date and channel. Plan creation and edits are domain events; a plan written down or forgiven is a reason-coded write-off through evaluateRelease. The CPA seat sees the roll-forward with aggregate figures only.
- **phase**: Phase 1
- **effort**: M
- **risks**: Some practices want to start plans before adjudication for large cases; offer 'Plan on patient estimate' as a separate, explicitly labeled pre-authorization-backed path that recomputes on adjudication and emits an event, rather than allowing estimates into the plan silently. Deferred-revenue treatment should be confirmed with the pilot CPA and made a tenant setting (cash-basis practices may not want it).
- **surprise**: True

### Item 11
- **name**: CPA month-end package with tie-out sheet and prior-period lock

#### personas
- CPA seat
- owner
- office manager
- biller
- **problem**: The outside accountant receives a day-sheet PDF and an AR aging that do not sum to each other or to the bank, re-keys deposits, and cannot tell whether anything changed in a month after it was closed.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 1: 'A month-end accounting package for the CPA seat: a general-ledger journal export mapped from `gl_bucket` and reason codes to QuickBooks and Xero import formats, a deposit register, and an AR roll-forward, so the independent reconciler has something to review without re-keying.' Report v3 A.6.1 #7: "tab32 'unreconciled, mismatched reports'".
- **interaction**: Daily Close → 'Close month' appears on the first business day after the last day close of the month (irreversible-styled, 2 clicks with confirmation). It freezes a month_close artifact containing: the GL journal (QBO and Xero formats), deposit register with bank match status per line, AR roll-forward by bucket (opening + charges - payments - adjustments - write-offs = closing, each figure linking to its ledger view), deferred-revenue roll-forward, the reason-code summary of adjustments and write-offs with approval counts, and a one-page tie-out sheet where every total shows the automated check 'reconciles to ledger view: yes'. The CPA seat downloads it from Practice → Reports with a row-count line. Any ledger entry later effective-dated into a closed month is refused unless it carries reason code 'prior_period' and posts with today's posted date; it appears in the next package under 'Prior-period adjustments' and fires the existing 'retroactive-dated entry' hard event to the owner.
- **why intuitive**: Every number links to its rows and the same metric shows the same value everywhere, so the CPA's first question ('does this tie?') is answered on the sheet. The close is two clicks and the lock is structural, so nobody has to watch for backdated entries.
- **why innovative**: No incumbent in the corpus reconciles reporting to the bank (D.4 #10 'Reporting that matches the bank' is an unmet must-have); Dentrix Ascend reporting is '77% negative among mentions', Curve reports 'often take tech support', Eaglesoft custom reports cost '~$5,000' (report v3 A.6.1 #7). Zeldent supplies reconciliation as an outside product and QuickBooks' audit trail is 'defeated by shared Administrator logins' (smb-accounting-internal-controls.md); a PMS that hands the CPA an import-ready, tied-out package with a period lock has no described equivalent.
- **phi and controls**: The package is PHI-minimal by design: journal lines carry gl_bucket, reason code, amounts, dates, and payer or tender, never patient names; the deposit register lists payer ids and TRNs. Where a CPA needs patient-level detail it is a separate export that is a disclosure row with row count under the CPA's BAA. The month_close artifact is INSERT-only and hash-chained. The prior-period refusal is enforced in the posting service, not recorded.
- **phase**: Phase 1
- **effort**: M
- **risks**: Practices that never close months will accumulate an open period; the owner home should show 'Month open 34 days' as one line. Mapping reason codes to the CPA's chart of accounts needs a maker-checker mapping table per tenant set up with the CPA at onboarding. Cash vs accrual presentation must be a labeled choice, not inferred.
- **surprise**: True

### Item 12
- **name**: Claims aging with status re-check and exact-bytes resend

#### personas
- biller
- office manager
- **problem**: A claim sits 'submitted' for 40 days; the biller calls the payer, is told it was never received, and re-creates the claim by hand, sometimes with different lines than the first submission, which the payer then treats as a duplicate.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md line 21: 'a claims tracker with age/status/next action'; line 79: '`submissions.ts` (claim + ticket + freeze in one transaction; resend exact bytes)'. /home/user/Dental_Mgmt/knowledge/sources/revup-dental-pms-reviews-2026.md, Curve: '2025 outages of 6+ hours and claims failures'.
- **interaction**: Money Desk → Claims tab → Aging groups 14 / 30 / 60 days as three headers with counts (shape and word, not color alone). Each row: patient, payer, amount, one-line state from the claim_events stream ('Acknowledged Aug 3; no 835 in 31 days'), and one primary action derived from the last event: 'Check status' (runs a 276 through the clearinghouse and writes a claim_event; 1 click), 'Resend' (re-transmits the frozen 837 bytes with a new interchange control number; 1 click, irreversible-styled), or 'Open denial' when a 277 reports a rejection. A payer with a documented processing window (versioned payer table) suppresses the row until the window passes so the biller sees only claims that are actually late.
- **why intuitive**: Home is the work: aging is a tab with counts, not a report. One primary action per row, chosen for the biller by the event stream. Recognition over recall: the state sentence says what happened last and how long ago. Frozen bytes remove the vigilance of 'did I rebuild it the same way'.
- **why innovative**: CareStack's 'claims tracker' is the only tracker praised in the corpus and Dentrix's eClaims is an add-on (report v3 A.3, A.6.2); neither is described as resending the identical frozen 837 or driving the next action from an append-only claim event stream, and Curve's 'claims-sending failures' during outages are the failure this design absorbs, since a queued claim's bytes survive and resend unchanged.
- **phi and controls**: 276/277 and resends go only through the BAA-covered clearinghouse adapter; each is a claim_event and a disclosure row. Throttle namespaces meter 276 calls per tenant so the button cannot run up clearinghouse fees. Nothing about the biller's queue is scored; counts are per payer and age band.
- **phase**: Phase 2
- **effort**: M
- **risks**: Not every clearinghouse exposes 276/277 for dental; the button degrades to 'Check payer portal' with the payer's URL, never a fake status. Resend must be blocked while a 277 acknowledgment is pending to avoid creating true duplicates.
- **surprise**: False
