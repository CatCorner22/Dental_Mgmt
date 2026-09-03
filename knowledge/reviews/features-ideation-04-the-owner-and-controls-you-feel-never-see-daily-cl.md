# Feature ideation 4: The owner and "controls you feel, never see": Daily Close, dual release from a phone, bank reconciliation, anomaly signals, the decision journal, and the CPA seat, with no person ever scored or ranked.

- **Source**: Claude Code feature workflow `wf_9011b632-d5f` (read-only agent; no web access); inputs: docs/01, 04, 05, 08, the dental repository adversarial panels and UX research, knowledge base v3
- **Type**: analysis
- **Author/Origin**: planning agent, reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: features, ideation, the-owner-and-controls-you-feel-never-see-daily-cl

## Summary

13 candidate features from the The owner and "controls you feel, never see": Daily Close, dual release from a phone, bank reconciliation, anomaly signals, the decision journal, and the CPA seat, with no person ever scored or ranked. lens, 6 marked non-obvious.

## Lens

The owner and "controls you feel, never see": Daily Close, dual release from a phone, bank reconciliation, anomaly signals, the decision journal, and the CPA seat, with no person ever scored or ranked.

## Features


### Item 1
- **name**: Independence-graded Tied status

#### personas
- owner
- office manager
- **problem**: The owner's morning question is 'did yesterday's money reach the bank?' Today the answer comes from a day sheet the same person who posted it can edit, so 'tied' is a self-assertion. The owner has to remember who closed and whether that person also posted.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md line 17: Owner home is "'Yesterday reconciled?' as one large shape+word status; three tender rows expected vs bank; one variance number with one clear/investigate action; detection lag in days". /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: "reconciliation_runs.independent is computed (the closer held no custody or recording activity that day)". /home/user/Dental_Mgmt/knowledge/sources/zeldent-dental-fraud-detection.md: "It is independent reconciliation, the daily comparison of ledger to bank, performed by something that sits outside the system being checked."
- **interaction**: Daily Close (owner home) opens on one tile, 44 px tall type, three states only: a filled circle + 'Tied · independent' (bank line matched, closer held no custody/recording that day); a half circle + 'Tied · needs a second look' (matched, but the closer also posted or prepared the deposit, or the source is statement import older than 48 h); a triangle + 'N variances'. No green exists without a bank_transactions row from a feed or statement import. Tap 1 expands three tender rows (cash, check, card) as expected vs bank with the gap in the right column. Tap 2 on a variance row goes to the variance card (see 'Variance sentence'). The clear button is simply not rendered for a user who posted or prepared the deposit that day; the tile says 'Dana closed; you or the CPA seat can clear' instead. Nothing else is on the screen above the fold.
- **why intuitive**: Home is the work (principle 10): the owner lands on the one fact that matters and one action. Severity by shape + word + luminance (principle 11) so the half-circle state reads in grayscale. Structural correctness over vigilance: the SoD rule (poster/depositor cannot clear) is enforced by withGuard and shown by absence of the control, not by a warning the owner must notice. Recognition over recall: the tile names who can clear so the owner never has to remember the rule.
- **why innovative**: The report (A.6.1 #7) records tab32 'unreconciled, mismatched reports', 77% of Ascend reviewers calling reporting inconsistent, and D.4 #10 'reporting that matches the bank' as a must-have the author would move up; no PMS in the corpus reconciles to the bank at all. Zeldent does bank-to-PMS comparison but sits outside the PMS with unpublished pricing and cannot know who posted, so it cannot grade independence. Dentrix/Open Dental day sheets are self-asserted totals.
- **phi and controls**: Tile shows amounts and tender totals only; no patient identifiers. Variance rows show initials and account number until expanded (payment/operations purpose logged). Touches the enforced runtime SoD set ('whoever posted payments or prepared the deposit for a business day cannot clear that day's reconciliation variance') and the measured independent-reconciliation metric that feeds operating effectiveness. For one-owner/one-OM practices the rule degrades to owner-only clearance and the degraded state is itself a finding, never a hidden downgrade. Bank data enters through the aggregator or statement import under its DPA/BAA review; nothing leaves the tenant.
- **phase**: Phase 1
- **effort**: M
- **risks**: A statement-import-only practice may never see 'Tied · independent' if the closer is the only money person; must show the honest half-circle rather than nag. Owners may read 'needs a second look' as an accusation of the closer; copy must describe the process ('same hands posted and closed'), never the person.
- **surprise**: False

### Item 2
- **name**: Variance sentence with proposed match

#### personas
- owner
- office manager
- biller
- **problem**: When bank and day sheet disagree, the owner or manager has to open three reports and hunt. Most gaps are timing (card settlement batches, refunds after 6 pm, a check deposited a day late), and the hunt is what makes owners stop reconciling.
- **evidence**: /home/user/Dental_Mgmt/docs/04-ux-blueprint.md flow 5: "Next morning the owner sees 'Tied' or 'N variances' (1 click to clear with reason or escalate)". Roadmap Phase 1 exit: "the owner clears reconciliation daily with median variance investigation under 10 minutes". Report A.6.1 #5: "No harvested review praises any product for AR clarity after dual coverage and partial payments"; D.6 quote on Open Dental: "the allocated/unallocated/hidden payments in the ledger."
- **interaction**: Variance card (reached from Daily Close in 1 tap) renders one deterministic sentence in the ledger-explanation voice: 'Bank shows $1,240.00 card settlement dated 9/2. Day sheet expected $1,310.00 in cards for 9/1. Gap $70.00. Two card refunds posted 9/1 at 6:40 pm total $70.00.' Below it, the candidate rows the matcher used are listed with a checkbox each (already checked). Two controls only: 'Match these' (reversible identity, blue) and 'Investigate' (opens a finding with the same rows attached and routes to the Money Desk 'variances I own' tab). If no candidate set sums to the gap, the sentence says so ('No combination of yesterday's rows explains $70.00') and only 'Investigate' and 'Clear with reason' appear; clearing requires a reason code from a short list. Every sentence links each number to its rows.
- **why intuitive**: Deterministic first, model second, human always: the matcher is exhaustive subset-sum over the day's rows with a published rule trace; no model, no confidence percentage. One verb line plus one control at the gate. Explanations behind progressive disclosure (rows below the sentence). Every number links to its rows (reporting rule). The compliant path (match or investigate) is faster than 'clear with reason', which is the slow lane with a reason code that is aggregated.
- **why innovative**: Zeldent claims 'automatic deposit matching' but from outside the PMS, so it cannot cite the refund rows or the claim that caused the gap. CareStack's ledger generates 'transfer adjustments' its accounting teams hate; Open Dental's has 'hidden payments'; Curve's partial-payment posting is a named complaint. None renders a variance as a sentence over ledger rows, because none has an explicit-allocation ledger to render from.
- **phi and controls**: The sentence uses amounts, tender, times, and row ids; patient names appear only on expansion with a logged payment-purpose read. Matching writes reconciliation_matches under the runtime SoD guard (poster/depositor of that day cannot match); 'Clear with reason' is a reason-coded event that enters the weekly digest as a practice-level count. The matcher lives in the sealed verifier package so the system policing itself is tamper-evident.
- **phase**: Phase 1
- **effort**: M
- **risks**: Subset-sum over a busy day can produce spurious combinations; cap candidates to same-tender rows within a two-day window and require the owner's confirmation. Sentence grammar for multi-location deposits needs care.
- **surprise**: False

### Item 3
- **name**: Held-posting phone card

#### personas
- owner
- office manager
- biller
- **problem**: Dual release dies the first week if the second approver has to find a workstation. The owner is in an operatory or offsite; the biller is stuck at checkout with a patient waiting; the practice waives the control to unblock the desk.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 1: "A responsive approvals-and-alerts surface (installable web app) with step-up MFA, so the second approver, usually the owner in another operatory or offsite, can act from a phone within minutes; without it dual release becomes a bottleneck and gets waived." Risk table: "a rigid threshold gets disabled the first week". /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts lines 720-731: `blocked_same_person` with reason "Same person cannot be first and second signer".
- **interaction**: Biller hits Post on a $410 write-off; postGuarded returns needs_second; the checkout screen shows one line 'Needs a second approver — Dana or Dr. Reagan' and one control 'Request approval'. The eligible approvers' phones show a card (installed web app, not SMS): patient initials + account number, amount, reason code, requester name, the frozen ledger sentence for the balance ('Crown #14 charged $1,180 on 8/12; primary paid $650 on 8/29; patient owes $530'), and, when the claim events show a denial, one more line 'Denied 8/29, no appeal filed'. Two controls, 44 px, 8 px gap: 'Approve' (irreversible identity, dark) and 'Send back' (reversible; opens a one-line reason). Above the high-value band, 'Approve' asks for TOTP first. There is no 'Approve all' anywhere; each card is one request. On approve, the worker executes the held posting and the biller's screen flips from 'Waiting on Dana' to 'Posted' without reload. Median target under five minutes (Phase 1 exit criterion).
- **why intuitive**: One verb line plus one control at the gate; the card carries the frozen evaluation so the approver never opens the ledger to decide (recognition over recall). Two visual identities for irreversible vs reversible. MFA step-up only above the high-value band so the compliant path stays fast. The blocked posting is never a dead end: the requester sees who can unblock it.
- **why innovative**: No dental PMS in the corpus has a second-approver flow on write-offs; incumbents ship permission flags and an audit trail that Zeldent's own blog calls 'not enough'. Prepare-vs-approve separation exists only in accounting systems (smb-accounting-internal-controls.md: 'Sage Intacct: named-user roles, prepare-vs-approve separation'). The denial-no-appeal line on the card is the dental-specific piece: conflict-rules.ts rule-claims-writeoff names the fraud path 'Write off denied claims instead of appealing'.
- **phi and controls**: Card shows minimum necessary: initials, account number, amount, reason, claim state; full name only after tap, logged as a payment-purpose PHI read. Push payload carries no PHI (request id only; the card fetches after authentication). Approval is compare-and-set against approval_requests with CHECK requester ≠ approver, distinct person re-checked server-side, and a BEFORE INSERT trigger on ledger_entries requiring an approved request. Denial-suppression rule routes any post-denial write-off here regardless of amount and excludes the claim submitter as approver.
- **phase**: Phase 1
- **effort**: M
- **risks**: Approval fatigue turns into rubber-stamping; mitigate with the practice-scoped weekly count on the owner home ('14 held postings this week, 14 approved, median 3 min') and no batch action. Push delivery on iOS requires home-screen install; fall back to the approvals inbox with a visible age.
- **surprise**: False

### Item 4
- **name**: Walk-over second signer

#### personas
- owner
- office manager
- biller
- front-desk coordinator
- **problem**: In a six-person office the second approver is often standing three feet away. The habitual workaround is the manager leaning over and typing her password into the biller's session, which destroys attribution and is exactly the shared-login failure the CPA guidance warns about.
- **evidence**: /home/user/Dental_Mgmt/knowledge/sources/smb-accounting-internal-controls.md: "audit-trail report that cannot be turned off; shared 'Administrator' logins defeat it". /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts rule-admin-writeoff compensating default: "Separate admin account from daily billing login". /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 3: "Shared-device profile with PIN author switch"; docs/01 principle 7: "Authorization derives per request from a fresh database row".
- **interaction**: On the biller's held-posting line ('Needs a second approver — Dana or Dr. Reagan') a second control appears when the device is a registered shared/desk device: 'Second signer is here'. Tap opens a full-screen sheet on the same terminal with the request summary and a PIN + TOTP field. Dr. Reagan enters her PIN and code (two fields, no username typing; the eligible-approver list is already narrowed to the two names). The server mints a 60-second session scoped to a single entitlement (approve this request id) and executes the same compare-and-set as the phone card. The sheet closes to the biller's session, which now shows 'Posted · approved by Dr. Reagan'. The biller's own session is never elevated; the approval session cannot navigate anywhere. If the biller and the second signer are the same identity the server returns blocked_same_person and the sheet says 'You requested this; someone else must second it.'
- **why intuitive**: Removes the vigilance requirement ('do not share your password') by making the correct path the shortest one: three taps and a PIN, no walk to another machine. Recognition over recall: the two eligible names are already shown. Two identities stay structurally distinct because the approval session is a separate, minimal-entitlement row, not an unlock of the current one. Learnable by a temp in one shift: the sheet needs no explanation beyond 'ask Dana to step over'.
- **why innovative**: Incumbent override flows in the corpus reduce to permission passwords and audit trails; the report's complaint themes never mention a two-identity approval at the point of sale, and Zeldent's thesis is that anyone with access can manipulate the PMS. QuickBooks' control is defeated by shared logins per Consero; this makes the shared-terminal case produce two attributed identities instead of one blurred one.
- **phi and controls**: No new PHI exposure: the sheet shows what the biller's screen already showed. Approval session is a sessions row with a single-request scope and 60-second expiry, written with frozen approver name; a new-device login is not triggered because the device is registered. Enforced: requester ≠ approver CHECK, role eligibility from user_entitlements, compare-and-set. The event stream records 'approved on requester's terminal' so the owner's digest can show the practice-level share of walk-over vs phone approvals (a design-effectiveness signal, not a person metric).
- **phase**: Phase 2
- **effort**: M
- **risks**: Shoulder-surfing of the PIN on a front-desk terminal; require TOTP with PIN and disable on operatory glass. Coercion (a requester pressuring a nearby approver) is a human risk the digest can only surface as a practice pattern.
- **surprise**: True

### Item 5
- **name**: Business-hours scope on dual release

#### personas
- owner
- office manager
- biller
- **problem**: After-hours refunds and adjustments are the classic cover move. Today the best available control is an alert the next morning, after the money moved; the owner then has to chase a completed posting.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 14: "Six named events page the owner individually (after-hours refund, retroactive-dated entry, waived dual control...)". /home/user/Dental_Mgmt/knowledge/sources/zeldent-dental-fraud-detection.md: "alerts for refunds above threshold, after-hours transactions, retroactive edits". /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts lines 32-37: ExceptionScope is "payee" | "person" | "role" | "channel" | "amount_band" with no time-of-day scope; /home/user/catcorner22/dental/src/lib/stats/computeStats.ts line 32: "Filed outside 7am–6pm Eastern".
- **interaction**: Controls screen, refund/write-off channel card gains one row: 'Outside location hours (7:00–18:00): Hold for a second approver' with a toggle, on by default. At 8:40 pm a refund of $60 (below the $150 threshold) hits Post; postGuarded evaluates a force_dual exception whose scope is the location's business-hours window and returns needs_second; the poster sees one line 'After hours: needs a second approver — Dr. Reagan' and 'Request approval'. The owner's phone card shows the same held-posting card with one extra line, 'Posted at 8:40 pm, location closed at 6:00 pm'. Approve or Send back as usual. The next-morning owner page for 'after-hours refund' still fires, but now reads 'held, approved by you at 8:52 pm' or 'held, still waiting', never 'posted'.
- **why intuitive**: Controls in the transaction path, not a report: the after-hours money move is held by the same gate that holds a large write-off, so the poster learns one behavior. The compliant path is the fastest (post during hours); the override is a request, not a settings change. The owner feels the control as one card at 8:40 pm and never sees a rule.
- **why innovative**: Zeldent, the only dental control product in the corpus, alerts after the fact; no PMS in the report holds an after-hours money move. Precog's own exception model (the shipped code) has amount, payee, person, role, and channel scopes but no hours scope; adding time as a first-class scope turns a detector into an enforced control using machinery that already exists.
- **phi and controls**: Reuses the held-posting card (initials, account, amount, reason). The hours window comes from location settings, evaluated server-side from the transaction timestamp, never the client clock. The exception is a force_dual row in control_policies, versioned; turning it off requires the owner role and writes a control decision with a review date, so the owner home shows 'After-hours hold: off since 3/2, review due 6/1'. Excluded from any per-person view; the digest reports the practice-level count of after-hours holds.
- **phase**: Phase 1
- **effort**: S
- **risks**: Practices with evening hours or Saturday clinics need per-location, per-weekday windows or the hold fires constantly and gets waived. Card refunds initiated by the processor at settlement time must be excluded (they are not human postings).
- **surprise**: True

### Item 6
- **name**: Sealed closed day with visible corrections

#### personas
- owner
- office manager
- biller
- **problem**: Retro-dated edits are how a short deposit is made to match the books. Any ledger that lets a closed day be edited in place makes the owner's morning check meaningless, and the owner has no way to know yesterday changed after they looked.
- **evidence**: /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 2: "corrections are reversal plus repost; every row carries a typed kind, a reason code, a frozen poster name". /home/user/Dental_Mgmt/docs/04-ux-blueprint.md flow 5: "day sheet frozen atomically". /home/user/Dental_Mgmt/docs/05-internal-controls-module.md detectors: "reversals or adjustments dated more than N days before posting". /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts rule-deposit-post fraudPath: "Deposit short; books adjusted to match".
- **interaction**: Once Close day runs, that business day's ledger view shows a lock glyph and the word 'Closed 9/1 6:14 pm by Dana'. Any attempt to post with an effective date inside a closed day is not refused; it posts into today's open day as a typed 'correction' entry with a required reason code and a NOT NULL reference to the closed-day row it corrects. The closed day's view gains a footer row 'Corrected on 9/3: see entry #5121' (link); the open day's row reads 'Corrects #4412 from 9/1'. Daily Close for the owner shows a fourth line under the tender rows: 'Yesterday changed after close: 0' or '2 corrections' (tap opens the two rows). A correction dated more than N days back pages the owner as the retroactive-dated hard event.
- **why intuitive**: Structural correctness over vigilance: the owner does not have to remember to re-check yesterday, because yesterday cannot silently change; if it is corrected the correction is a row on today's screen. One canonical view per fact: the closed day is what the owner saw, forever. Fewer words at the gate: the poster is not blocked, only redirected into today with a reason.
- **why innovative**: The report's incumbent complaints center on ledgers whose numbers move: tab32 'unreconciled, mismatched reports', Ascend reporting 'inconsistent', Open Dental 'hidden payments'. No incumbent in the corpus offers an append-only day close with cross-linked corrections; Zeldent flags 'retroactive edits' precisely because the PMSes it monitors permit them.
- **phi and controls**: No additional PHI; corrections carry the same patient scope as the row they correct. Enforced at the database: ledger_entries is INSERT-only for the app role; day_closes freezes the day's totals with an HMAC chain head; the correction kind requires a reason code and a reference FK by CHECK. The 'changed after close' count is a practice-scoped fact on the owner home; per-poster detail is behind the owner/reviewer seat.
- **phase**: Phase 1
- **effort**: M
- **risks**: Accounting periods: the CPA export must present corrections in the period they were posted with a memo reference to the original date, or month-end will not tie to the day sheets. Legitimate late ERA postings will generate many corrections unless insurance payments are exempted from the 'after close' count (they are not human corrections).
- **surprise**: False

### Item 7
- **name**: Reconciliation drill

#### personas
- owner
- **problem**: Only 17% of dental thefts are caught by designed controls, and the reason is usually that the control exists on paper and nobody actually looks. The owner has no way to know whether their own morning check would catch a $300 skim until it is real.
- **evidence**: /home/user/Dental_Mgmt/knowledge/sources/dental-embezzlement-ada-prosperident.md: "only 17% of embezzlement was discovered through the systems employed by practices, with a staggeringly high 83% revealed through unpredictable events." /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 1 exit: "a planted $300 skim (deposit short + after-hours adjustment) surfaces as a variance and a finding within one business day in a simulated month". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md principle 16: "Restore drills are scheduled jobs that write their own audit row."
- **interaction**: Practice > Controls has one row 'Reconciliation drill: quarterly (owner opt-in)'. When enabled, once a quarter at an unannounced date the drill job inserts a synthetic bank line (marked drill=true in reconciliation_drills, never in bank_transactions) that creates a plausible $200-$400 variance for one tender. The owner's Daily Close shows 'N variances' exactly as it would for a real gap. The moment the owner taps the variance row, the card reveals itself: 'Drill. This variance was planted at 6:00 am; you opened it at 7:42 am. Detection lag: same day.' One control: 'Done'. The drill writes its own audit row and a control_finding of kind 'drill passed / drill missed after 3 business days'. Missed drills appear as one line on the owner home and in the CPA month-end package as measured operating effectiveness for the reconciliation control.
- **why intuitive**: Measured, not asserted: the owner's own control is tested the way restore drills test backups, without anyone having to remember to test it. The owner feels nothing different on a drill morning (that is the point) and learns the result in one sentence with one control. No policy prose on the finish path.
- **why innovative**: Vanta, Drata, Abyde, and Patient Protect prove the questionnaire → tailored policy → tracked remediation loop (report B.7), but none tests whether a financial detective control actually operates. Zeldent monitors; it does not drill. Prosperident sells a 'PMS-report monitoring checklist' as a service. No product in the corpus measures the owner's detection lag against a planted signal.
- **phi and controls**: Zero PHI: drills carry synthetic amounts only and never touch ledger_entries, deposits, or bank_transactions; the variance matcher reads a union view so real and drill lines are indistinguishable until opened. Owner-only, opt-in, and the drill event stream is visible to the CPA seat as a control-test result. It measures a control's operation (reconciliation), never a person; the finding is scoped to the practice.
- **phase**: Phase 2
- **effort**: S
- **risks**: Cry-wolf erosion if too frequent; cap at quarterly and reveal at first touch. A practice where the OM, not the owner, clears variances will 'pass' the drill through the OM, which is honest but must be labelled 'cleared by OM, not owner'. Must be excluded from the independent-reconciliation match-rate metric.
- **surprise**: True

### Item 8
- **name**: Decision review with measured effect

#### personas
- owner
- compliance lead
- **problem**: A temporary threshold raise for vacation cover becomes permanent because nobody comes back to it; an accepted SoD conflict from setup is never re-examined. The owner cannot remember what they decided or why, and the CPA finds a standing exception nobody can explain.
- **evidence**: /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: "the active-exception summary surfaces expiring and standing exceptions on the owner home and in the monthly digest so a temporary raise cannot quietly become permanent" and "COSO Principle 17 is literally 'open findings without a decision.'" /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts ex-temp-om-writeoff residualNote: "Time-bound; auto-expires. Review all write-offs on return."
- **interaction**: Every control decision is born at the gate, never on a settings page: when the owner waives, raises a threshold, or accepts a conflict from the inline card, the card's last field is 'Review on' pre-filled with 90 days (30 for waivers) and a one-line 'why'. On Daily Close, under approvals, a row 'Decisions due for review: 2' appears only when non-zero. Tap opens a card per decision: the original one-line reason, and one measured sentence generated deterministically from the event stream since the decision: 'Since this raise on 6/1: 14 lab ACH payments single-released totalling $21,400; 0 variances; 0 findings on this payee.' Three controls: 'Keep 90 more days' (reversible), 'Tighten' (opens the policy card with the base value pre-selected), 'Retire' (irreversible identity). Nothing auto-renews: an expired decision with no review becomes a control_finding and the exception stops applying at midnight of the review date.
- **why intuitive**: Recognition over recall: the owner is shown what happened, not asked to remember what they meant. One card, three controls, no prose. The compliant path (review) takes one tap; the lazy path (ignore) tightens the control instead of loosening it, so neglect is safe. The decision journal fills itself from the gates the owner already uses.
- **why innovative**: coso-acfe-fraud-risk-tools.md describes the frameworks as 'documents and templates, not interactive software'; smb-accounting-internal-controls.md says tailoring 'is delivered by CPAs and frameworks'. No PMS in the corpus has a control register at all, and the shipped Precog code auto-expires an exception but has no review loop or measured effect sentence.
- **phi and controls**: Decisions reference policies, payees, roles, and amounts; no patient data. control_decisions is append-only and owner-attributed with frozen names; the review writes a new row rather than editing. Expiry enforcement lives in evaluateRelease (isDateActive) so an unreviewed exception cannot apply. The measured sentence is computed from domain_event and is practice/payee-scoped; a person-scoped exception (raise for one OM) shows its counts only to the owner and reviewer seat.
- **phase**: Phase 1
- **effort**: S
- **risks**: Too many 90-day reviews for a practice with several accepted conflicts; batch them into one monthly review card while keeping one decision per row. The measured sentence must say 'directional' when the sample is under the digest minimum.
- **surprise**: True

### Item 9
- **name**: Reason-code drift, practice-scoped

#### personas
- owner
- **problem**: Owners who suspect theft ask for a per-employee adjustment report, which is both a liability posture and the wrong signal. What they need is to know that the mix of adjustments changed against the practice's own history, and where to look, without naming anyone.
- **evidence**: /home/user/Dental_Mgmt/docs/05-internal-controls-module.md detectors: "adjustment-to-production ratio per reason code per role against the practice baseline". /home/user/catcorner22/dental/src/lib/digest/digest.ts line 276: "if (input.flagged.length / input.total >= DIGEST_RULES.SYSTEMIC_SHARE)" re-scopes to practice. /home/user/Dental_Mgmt/docs/08-roadmap.md risk table: "Owners suspecting theft will ask for per-person adjustment reports; the no-scoreboard doctrine reads as a missing feature".
- **interaction**: Daily Close, below the tender rows, one collapsed line appears only when a detector fires: 'Adjustments this month: courtesy 2.1% of production (practice baseline 0.8%)'. Tap opens a card with the reason codes as horizontal bars, each labelled with its share and baseline, no names, no columns per person. One control per bar: 'Show the rows' (the adjustment entries, oldest first, each linking to its ledger row and any approval). A second, owner-only control at the bottom, 'Reviewer detail', is present only for the owner and the designated reviewer seat and opens the same rows with poster names, gated by the digest minimum sample size and SYSTEMIC_SHARE (if most posters are involved, the card says 'practice-wide; likely a policy or fee-schedule change' and no per-person view exists). Acknowledging the card stamps the digest.
- **why intuitive**: Severity by shape + word + luminance on the bars; no red/green judgement. Home shows the line only when there is something to see (silent until it matters). Every number links to its rows. The owner never has to run a report or remember a baseline.
- **why innovative**: The analytics layer the corpus names (Dental Intelligence, Jarvis Analytics, Practice by Numbers in docs/09-naming.md) sells huddle and production reporting by provider, and Open Dental's answer to 'where did the money go' is custom SQL (report A.6.2). No incumbent reports adjustment mix against the practice's own baseline with the person dimension withheld by rule; Zeldent alerts on thresholds, not on reason-code drift.
- **phi and controls**: Bars carry amounts and reason codes only; the rows view is a payment-purpose PHI read. Person-scoped detail exists only behind the owner/reviewer seat and is gated by minimum sample and SYSTEMIC_SHARE re-scoping in code, not by policy. Baselines are versioned constants stamped SCORING_VERSION; nothing here is an enforced control, and the card says 'signal' so the recorded-vs-enforced table stays honest.
- **phase**: Phase 1
- **effort**: M
- **risks**: A new membership plan or fee-schedule change legitimately shifts the mix; the card must link to policy changes in the same window ('fee schedule updated 8/15') to avoid false alarm. Owners may still demand the per-person leaderboard; hold the line and cite the liability posture in the trust page FAQ.
- **surprise**: False

### Item 10
- **name**: Sole-operator duty rotation

#### personas
- owner
- office manager
- **problem**: In a small office one person prepares every deposit or posts every payment for years. The embezzlement literature's red flags (reluctance to cross-train, territorial about the desk) are exactly this, but flagging a person is forbidden and useless; what the owner can act on is the duty, not the human.
- **evidence**: /home/user/Dental_Mgmt/knowledge/sources/dental-embezzlement-ada-prosperident.md: "Behavioral red flags: reluctance to cross-train (~50% of respondents), territorial about workspace (>25%)". /home/user/Dental_Mgmt/docs/05-internal-controls-module.md detectors: "sole ownership of a critical process". /home/user/Dental_Mgmt/knowledge/sources/smb-accounting-internal-controls.md: "mandatory vacations and duty rotation; least-privilege access".
- **interaction**: The nightly detector finds a critical entitlement (prepare_deposit, post_payments, bank_reconcile, release_payment) exercised by exactly one identity for more than N consecutive business days. Daily Close shows one line under findings: 'Deposit prep has had one set of hands for 94 business days'. Tap opens a card naming the duty, not the person, with one control: 'Add cover'. The owner picks a second staff member from a list already filtered to those whose existing grants would not create a critical conflict (conflicts shown inline as one sentence each if they would). Save grants the entitlement for a time-boxed window (default 30 days), writes the control decision with a review date, and the finding closes when the second identity has actually exercised the duty (an event, not the grant). A companion 'On leave' switch on a staff profile suspends that person's money entitlements for the leave window and shows the cover gaps the same way.
- **why intuitive**: Findings surface where the cause is and carry their fix: one tap from finding to a compliant grant. Recognition over recall: the eligible-cover list is pre-filtered by the SoD engine so the owner cannot create a worse conflict by accident. Structural: the finding closes on observed use, so a grant that is never used does not fake coverage.
- **why innovative**: Prosperident and every CPA checklist in report B.6 recommend rotation and mandatory leave as advice; QuickBooks offers screen-level restrictions but no notion of duties over time. No PMS in the corpus models who actually exercises a duty, so none can detect sole operation or offer a conflict-safe cover grant.
- **phi and controls**: No PHI; operates on user_entitlements and domain_event counts. The finding names a duty and a count; the identity behind it is visible only to the owner and reviewer seat. Grant-time refusal of critical conflicts without a decision is enforced; the cover grant is an append-only user_entitlements row with an expiry; the leave switch is enforced by withGuard (login allowed, money routes return one line 'On leave until 9/14').
- **phase**: Phase 2
- **effort**: M
- **risks**: A two-person office cannot rotate; the card must offer 'owner takes the duty for a week' or 'CPA seat performs reconciliation' and record the residual honestly. Staff may read 'one set of hands' as suspicion; the copy is about resilience (what happens when Dana is sick), and the finding also fires for the owner's own duties.
- **surprise**: True

### Item 11
- **name**: CPA seat with questions and attestations

#### personas
- owner
- CPA / reviewer seat
- office manager
- **problem**: The independent reviewer a small practice can afford is its CPA, who today gets a PDF day sheet and a bank statement and re-keys both. Payroll and vendor payments live outside the PMS, so the owner's control table either lies (green) or is blank.
- **evidence**: /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 1: "A month-end accounting package for the CPA seat: a general-ledger journal export mapped from gl_bucket and reason codes to QuickBooks and Xero import formats, a deposit register, and an AR roll-forward, so the independent reconciler has something to review without re-keying." /home/user/Dental_Mgmt/docs/05-internal-controls-module.md: "A channel whose data the PMS does not yet hold (payroll...) is shown as external / attested, never as enforced". /home/user/Dental_Mgmt/knowledge/sources/smb-accounting-internal-controls.md: "CPAs recommend forensic fraud risk assessments and outsourced accounting to achieve segregation where headcount is too small."
- **interaction**: The owner invites a CPA seat from Practice > Roles in three fields (name, email, firm); the seat carries only view_reports_only plus bank_reconcile and a 'question' verb, and the SoD preview shows it creates no conflict. The CPA lands on a Month-end home: one row per month with 'Package ready' and one control 'Download' (journal CSV for QuickBooks/Xero, deposit register, AR roll-forward, control register, active exceptions, open decisions, drill results, chain-verification status). Any line in the package has a 'Question' control; the question becomes a variance-shaped row on the owner's Daily Close ('CPA asks: why did courtesy adjustments double in August?') with the linked rows attached, and the owner answers with one line; the thread is append-only. A second tab, 'Attest', lists the external channels (payroll, vendor payments until integrated) with one control each, 'Reviewed this month', which writes a dated attestation row so the recorded-vs-enforced table can show 'external / attested 9/3 by CPA seat' instead of a false green. The CPA seat can also clear reconciliation variances when the owner cannot (it never posts or deposits, so it is always independent).
- **why intuitive**: One home per persona: the CPA lands on the month, not on a PMS. Every number links to its rows so a question is asked from the row, not by email. The owner receives questions in the shape they already know (a variance row with one action). Attestation is one control per channel, and its absence is visible rather than assumed.
- **why innovative**: Report D.5 lists 'A ledger both clinicians and accountants can read' as the clearest whitespace with 'nobody universally' close; Open Dental answers with custom SQL, Eaglesoft custom reports run ~$5,000, Curve reports 'often take tech support'. No incumbent gives the accountant a seat with an independent-reconciler role, a question channel into the owner's worklist, or an honest attested/enforced distinction.
- **phi and controls**: The package is PHI-minimal by construction: journal lines carry account numbers and amounts, no names; the deposit register carries tender totals; AR roll-forward is aggregate. Row drill-down by the CPA is a payment-purpose PHI read logged against the seat. Export shows the row count rendered and writes a disclosure row. The seat's entitlements make it structurally independent (no custody, no recording), so its variance clearances count as independent in reconciliation_runs. Attestations are recorded, labelled attested, and excluded from scores per the doctrine.
- **phase**: Phase 1
- **effort**: M
- **risks**: CPAs use many general-ledger charts; the gl_bucket mapping must be editable under maker-checker or the import fails on the first non-standard chart. A seat that never logs in makes the attestation column stale; show 'last attested' with age rather than assuming coverage.
- **surprise**: False

### Item 12
- **name**: Tip channel with owner-exclusion routing

#### personas
- owner
- office manager
- hygienist
- front-desk coordinator
- CPA / reviewer seat
- **problem**: Tips catch more fraud than any control, yet a staff member who notices something has nowhere to put it except the owner's ear, and if the concern is about the owner or the owner's spouse at the desk there is nowhere at all. Management override is over half of fraud cases.
- **evidence**: /home/user/Dental_Mgmt/knowledge/sources/zeldent-dental-fraud-detection.md: "ACFE discovery mix ~40% tips, ~15% internal audit, ~12% management review". /home/user/Dental_Mgmt/knowledge/sources/smb-accounting-internal-controls.md: "ACFE 2024: over half of fraud cases linked to weak controls or management override". /home/user/Dental_Mgmt/docs/01-product-vision-and-scope.md module map: "wishes.ts rewritten as the tip intake (the shipped route has no PHI gate and practice-wide reads, so this is a rewrite, not a lift)".
- **interaction**: Every staff home has the same small footer control, 'Raise a concern', 44 px, present on the Board, Chairs, and Money Desk alike. It opens one text field, one optional 'attach a row' picker (a ledger entry, deposit, or vendor the tipper can search by plain name), and one switch, 'This concerns the owner'. Submit routes to the owner and the reviewer seat; with the switch on, it routes only to the CPA/reviewer seat and the owner's copy is withheld, with the owner home showing only 'A concern is with your reviewer' and no content. The recipient sees the tip as a row on their home with one control, 'Acknowledge', which stamps the digest; acting on it opens a finding with the attached rows. The tipper's identity is stored encrypted with a separate key and revealed only by a two-party ceremony (reviewer seat plus a second admin) recorded as an event. Tips appear in the monthly digest as a count only ('2 concerns raised, 2 acknowledged').
- **why intuitive**: Recognition over recall: the control is in the same place on every home so a temp finds it in one shift. Attaching a row instead of describing it removes the 'which payment do you mean' loop. One verb, one field, one switch. The owner feels the channel exists only as a count on the digest until something arrives.
- **why innovative**: Prosperident sells investigation as a service and Zeldent offers monitoring; no PMS or control product in the corpus has an in-product tip channel, and none addresses management override by routing around the owner. The shipped Precog wishes route had practice-wide reads and no PHI gate, so this is the first version that can lawfully carry a concern that references a patient row.
- **phi and controls**: Free text passes the PHI egress classifier and is stored only in the tenant; attached rows are references, not copies, and are read under an operations purpose when opened. Tipper identity encrypted under a distinct KMS key with a two-party reveal ceremony; the reveal writes a break-glass justification row. No enforced control changes; the tip creates a finding that follows the normal decision path. The owner-exclusion switch is enforced server-side by the routing rule, not by UI.
- **phase**: Phase 2
- **effort**: S
- **risks**: HR and defamation exposure if tips are treated as evidence; the UI must call them concerns and the finding must cite rows, not the tip text. A practice with no reviewer seat has nowhere to route an owner-excluded tip; show that gap on the recorded-vs-enforced table and offer the CPA seat as the fix.
- **surprise**: True

### Item 13
- **name**: Vendor and bank-detail change quarantine

#### personas
- owner
- office manager
- **problem**: The fictitious lab or the changed remit-to bank account is the standard small-office payables fraud, and lab invoices are the most frequent vendor payment a dental office makes. Today a manager can add a payee and pay it the same afternoon.
- **evidence**: /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts rule-vendor-create-pay: "Classic fictitious vendor scheme", fraudPath "Create fake lab/vendor; pay self". /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts ex-force-new-vendor-pay: "Force dual on any first ACH to new payee band". /home/user/Dental_Mgmt/knowledge/sources/smb-accounting-internal-controls.md: "restrict who can change bank details". /home/user/Dental_Mgmt/docs/08-roadmap.md Phase 3: "lab invoices are a recurring fictitious-vendor fraud vector".
- **interaction**: Vendor master (reached from the lab case or Practice > Vendors) treats two fields as sealed: payee legal name and remit-to bank details. Creating a vendor or editing either field saves immediately but puts the vendor in a 'Quarantined until 9/6 or owner approval' state shown as a hatched badge on the vendor card and on any lab case that names it. Payments to a quarantined vendor evaluate as needs_second regardless of amount (the shipped force_dual exception, now scoped to the vendor state), so the release screen shows 'New payee: needs Dr. Reagan' with 'Request approval'. The owner's phone card shows vendor name, the changed field with old and new values side by side, who changed it, and the first invoice amount; Approve lifts quarantine early. The first payment after any bank-detail change is always dual, even for an approved long-standing lab. The monthly digest lists 'new or changed payees this month: 3' with one 'Review' control that opens them as rows.
- **why intuitive**: The compliant path is fast (legitimate labs are approved from the phone in a minute); the fraud path is slow by structure (a waiting period the manager cannot shorten alone). The control appears where the cause is (on the vendor card and lab case), not in a settings page. One line, one control.
- **why innovative**: smb-accounting-internal-controls.md reports 'most small-business fraud is check tampering (Consero)' and that Positive Pay is not native to QuickBooks Online; no dental PMS in the corpus has a vendor master at all, let alone a change quarantine. Precog's shipped rules name the scheme and default 'Owner signs every new vendor before first payment', but as advice; here it is a state machine the payment path reads.
- **phi and controls**: No patient PHI; vendor bank details are encrypted like other bank identifiers and shown masked except last four on the approval card. Enforced: vendor_new and ACH/check channels run through postGuarded; the quarantine state is a column the evaluator reads inside the transaction; self-approval of vendor master changes is in the hard runtime SoD set. Changes are append-only vendor events with frozen actor names, so old and new values are always reconstructable for the CPA package.
- **phase**: Phase 3
- **effort**: S
- **risks**: Emergency lab or repair vendor on a Friday afternoon: the owner must be reachable by phone card or the quarantine gets waived by exception; make the waiver expire in 24 hours. Until a payment-rail integration exists, the 'payment' the PMS gates is the recorded release, and the recorded-vs-enforced table must say 'enforced on recorded releases; bank rail external'.
- **surprise**: False
