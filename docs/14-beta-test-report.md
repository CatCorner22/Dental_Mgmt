# Beta test of the clickable prototype with a 30-persona stakeholder panel

Status: thresholds pre-registered 2026-09-03 before any session ran (see the commit that introduced this file). Results are appended below the line "Results" once the panel has run; nothing above that line changes after it.

## Falsifiable claim

The merged PMS's UX, as specified in `docs/04-ux-blueprint.md` and `docs/13-innovation-and-intuitiveness.md`, is learnable and operable by all six professions (front-office administrative staff, back-office administrative staff, dentists, oral surgeons, dental hygienists, dental assistants) across the stated range of ages, health, and ability, at or under the click budgets, when exercised on a clickable prototype that implements the specifications faithfully.

The negation this exercise can return: personas in one or more professions fail their role's daily tasks, exceed the budgets, or hit gates they cannot get past, or an ability group is excluded by a control that does not meet the 44 px, contrast, or keyboard rules.

## Pre-registered thresholds (set 2026-09-03, before data)

**UI stable** means every row of `scripts/proto-check.mjs` passes:

| Check | PASS |
|---|---|
| routes | 0 console errors, 0 page errors, 0 event-log errors on every route × persona × theme |
| flows | 5 of 5 daily flows complete keyboard-only within budget (check-in 1 tap; perio 2 taps plus 168 keystrokes; chart+plan+note ≤10 taps; checkout ≤4 clicks; ERA post 1 click and close day 2 clicks) |
| targets | 100% of focusable controls ≥44×44 px; sibling gaps ≥8 px |
| contrast | 100% of text ≥4.5:1 (≥3:1 at ≥24 px), both themes |
| overflow | 0 horizontal overflow at 1280, 1024, and 820 px on every route |
| motion | 0 animated elements under reduced motion |
| focus | visible focus on 100% of controls; 0 keyboard traps |
| testids | 100% of elements with a handler carry a `data-testid` |
| shots | 8 persona homes × 2 themes captured |

**Beta passed** means all of:

- Task success ≥80% of all task attempts across the panel.
- Median would-choose ≥4 of 5 in every profession.
- No reproduced P0 defect open at the end of the fix rounds.
- ≥90% of budgeted tasks completed within budget.

**Rerun band**: task success between 65% and 80%, or any profession's median would-choose between 3 and 4. Action: one fix round, then re-run the affected personas' tasks only.

**Stop**: task success below 65%, or any profession's median would-choose below 3, or any P0 unresolved after the second round. Action: report FAIL and list the specification changes needed in `docs/04` and `docs/13`.

Severity: **P0** blocks a daily flow or excludes an ability group; **P1** misses a click budget or fails a target, contrast, or keyboard rule; **P2** causes confusion the persona quotes; **P3** is preference.

## Scope

In: the five daily flows and the six signature moments as rendered by `prototype/` (Board, Checkout, Chairs, Perio, Encounter, Money Desk, Daily Close, Roles, Patient Rail, palette, phone approvals). Out: imaging, portal and messaging, ePrescribing, migration, report builder, COSO heat map, CPA month-end, lab and referral detail beyond chips, real authentication, autosave, AI assist (each needs a backend or a vendor to mean anything).

## Roles

- **Runs it**: 30 persona agents, one per roster record in `knowledge/reviews/beta-panel-roster.json`, each driving the prototype through Playwright and Chromium under its own device profile and theme, then completing the structured interview.
- **Adversary**: two verifier agents per reported defect, drawn from a different profession, each writing its own reproduction script. A defect counts only when at least one verifier reproduces it with event-log evidence.
- **Grades**: a dedup-and-severity agent applies the severity definitions above; a synthesis agent drafts the results; a completeness critic checks that every persona and task appears, that thresholds were applied as written, and that negative results were kept.
- **Sponsor**: the repository owner, who does not grade.

## Declared constraints (and their effect on the conclusion)

| Constraint | Reason | Effect |
|---|---|---|
| Personas are language-model agents | No human panel is available in this session | They enact a trait's test behaviours; they cannot feel tremor, glare, fatigue, or pain. Findings about those traits are structural (target size, contrast, keyboard reach), not experiential |
| Synthetic data, one tenant | No PHI may exist here | Ledger and claim edge cases are the ones seeded; real payer behaviour is untested |
| Static prototype, simulated refusals | No backend exists yet | Latency, concurrency, autosave, and real dual-release timing are untested |
| No real gloves, pedals, or devices | Headless Chromium | Target sizes and key grammar are checked geometrically, not physically |
| Evidence rule: every finding cites `seq` ranges from `window.__events` | Prevents invented findings | Findings that cannot be tied to events are discarded, even if plausible |

## What this exercise cannot prove

- The 8-minute full-mouth perio target, or any time-on-task figure; event counts are a proxy for effort, not for minutes.
- Real-world learnability by a temp in one shift.
- Screen-reader usability; no assistive technology runs in this environment. Focus visibility, labels, and live regions are checked structurally.
- Payer, clearinghouse, or bank behaviour.
- Security properties; the prototype has no authentication.

## Recording plan

- `prototype/` and `scripts/proto-check.mjs` output (`report.json`, screenshots) in the scratch directory, summarized below.
- One session file per persona at `knowledge/reviews/beta-sessions/bp-NN.md`, validated by `scripts/beta/validate-session.mjs`, including negative results (failed tasks, would-choose below 3).
- Verifier files `knowledge/reviews/beta-sessions/verify-*.md`, the dedup file, the synthesis, and the critic's file.
- Results by profession and by task, defects fixed and open, and the verdict against the thresholds above, appended under "Results".

## Roster

Generated by `node scripts/gen-roster.mjs --seed 20260903` into `knowledge/reviews/beta-panel-roster.json` with one card per persona under `knowledge/reviews/beta-panel/cards/`. Six groups of five; gender identity 9 men, 11 women, 3 trans men, 3 trans women, 4 nonbinary people; ages 19 to 68 with every age band present in every profession; at least 12 personas carry an access-relevant note (low vision, deuteranopia, essential tremor, hard of hearing, ADHD, dyslexia, chronic back pain, wheelchair user, third-trimester pregnancy, non-native English) and no persona carries more than two notes; incumbent systems Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack, tab32, or none; tech comfort 1 to 5; device profiles desk, operatory, shared, and phone width.

Respect rules, enforced by a review pass on every card before the panel runs: a trait is context for what the persona tests, never the persona's identity or a punchline; no medical detail beyond what changes the interaction; pronouns are used consistently; every persona has a job, a history with a system, and a device.

---

## Results

### Verdict

**Round 1: rerun band.** Task success 84% cleared the 80% threshold, but four of six professions returned a median would-choose of 3 against a threshold of 4, and 83% of budgeted tasks finished within budget against a threshold of 90%. The registered response to that band is one fix round and a re-test of the affected personas, which is what followed.

**Round 2: the direction is right and the exercise does not claim a pass.** Six personas, one per profession, re-ran their scripts. Task success rose to 88% and the median would-choose for those six moved from 3 to 4 (their round-1 scores were 3, 3, 3, 3, 4, 4; their round-2 scores are 3, 3, 4, 4, 4, 4). Within-budget fell to 77%, most of it explained by a measurement error the panel itself found: the tap formula counted a space typed into a sentence as a tap, so any task whose work is writing prose could not meet its budget. That is corrected in `prototype/CONTRACTS.md` §5, but the round-2 numbers above are reported as measured, not recomputed after the fact.

**Round 2 is a six-persona re-test, not a second panel, so it cannot return "beta passed" for the panel as a whole.** Two of six professions still sit at a median of 3, and the registered threshold asks for 4 in every profession across the full panel. What round 2 does support is narrower and still worth having: on the professions and devices re-tested, the fixes landed, nothing that was working broke, and the personas who could not finish their day in round 1 now can.

### The funnel

| Stage | Count |
|---|---|
| Defect reports filed by the 30 sessions | 213 |
| Distinct root causes after grouping | 38 |
| Reproduced under mechanical adversarial verification | 28 |
| Not reproduced on a clean run | 10 |
| Additional defects taken from the per-trait accessibility findings | 4 |
| Fixed in the round-1 fix round | 32 |
| New root causes found by round 2 (including regressions from those fixes) | 13 |
| Reproduction checks now guarding the product | 43, all clean |

### Round 1 and round 2 by profession

| Profession | R1 tasks | R1 budget | R1 median | R2 tasks | R2 budget | R2 median |
|---|---|---|---|---|---|---|
| Front-office administrative staff | 25/30 (83%) | 90% | 4 | 5/6 | 100% | 4 |
| Back-office administrative staff | 23/30 (77%) | 67% | 4 | 5/6 | 67% | 4 |
| Dentists | 25/25 (100%) | 88% | 3 | 5/5 | 80% | 4 |
| Oral surgeons | 23/25 (92%) | 88% | 3 | 4/5 | 80% | 3 |
| Dental hygienists | 30/32 (94%) | 85% | 3 | 6/6 | 80% | 4 |
| Dental assistants | 15/25 (60%) | 80% | 3 | 4/5 | 50% | 3 |
| **All** | **141/167 (84%)** | **83%** | **3** | **29/33 (88%)** | **77%** | **4** |

Round 1 is thirty personas, five per profession. Round 2 is six, one per profession, chosen to stress the changed screens: a phone coordinator, a phone biller, a grayscale dentist on reduced motion, a grayscale surgeon on a shared tablet, a hygienist on a dark operatory tablet, and a new-hire assistant on an operatory tablet.

### What round 2 said, in their words

> "I would run my window on this now — the money on the screen finally matches the money in the store and the log counts my hands honestly — but I still cannot reach Samir's self-pay toggle without a 308 pixel drag." — bp-05, treatment coordinator, phone

> "The phone is a real desk now and the second approver finally has one name I can act on, so I would run my morning in this." — bp-09, accounts receivable, phone

> "I would run my day in this — the duplicate charge I asked for is refused, the note keeps every procedure and the gray chips finally rank." — bp-15, prosthodontist, grayscale

> "Everything I complained about on the shared tablet is genuinely fixed — the PIN speaks, the chip counts once, the note keeps both procedures, privacy covers the gate, and the queue reads in gray — but a new rule now refuses to let me sign a surgical note." — bp-20, oral surgery resident, shared tablet

> "Yes — with the cursor now following me down the lower arch, the pad on the screen where my hand is, and a screening that writes a screening into the note, I would run a hygiene day in this." — bp-25, hygienist, operatory

> "Everything I do with my hands got better — the pad is where my thumb is, the page stops moving under me, the temp's rail is finally the temp's — but the tablet still cannot say my name, so I would work in this all morning and still not sign what I charted." — bp-29, assistant, operatory

### What round 2 cost: three defects my own round-1 fixes caused

The most useful thing the re-test produced was evidence against the fixes, not for them.

- **P0.** Round 1 stopped charting whole-patient services against a tooth. The contradiction check still compared the note's tooth to every chart event, so an intravenous-sedation event with no tooth held File forever behind a control that did nothing, and the empty tooth printed as "#null" in the spoken line and the read-back. bp-20 could not sign a surgical note at all. The check now compares only tooth-scoped events.
- **P1.** Round 1 made the PIN pad refuse an account with no charting session, which was right in shape. The seed had no assistant persona, so the one assistant in the practice was refused every time and could never be the author of what she charted. bp-29 hit it on her first task. Assistants now have a session of their own.
- **P2.** Collapsing the phone top bar to one row clamped its buttons, so at 420 px the labels overlapped their neighbours and every pair sat 6 px apart, inside the 8 px floor. bp-05 and bp-09 found it independently.

### Two corrections to the harness the panel forced

- **The tap formula counted typing as tapping.** A space typed into a sentence was counted as a tap, so a task whose work is writing prose could not meet its budget. bp-15 and bp-29 found this independently. `CONTRACTS.md` §5 now excludes keys pressed inside a text field.
- **The targets check swept one width.** Sizes and gaps were measured at 1280 px only, which is why a 6 px gap in a bar that collapses below 640 px went unseen. It now sweeps 1280, 1024, 820, and 420.

Three round-1 verdicts of mine were also wrong, and the dedup file records the correction: R27, R28, and R30 were reported as "not reproduced" because the probes accepted evidence that did not mean what I took it to mean. All three were real.

### Fixed after round 2, verified mechanically but not by a person

These nineteen are fixed and guarded by reproduction checks, but no persona has driven them. They are not evidence of usability; they are evidence that a specific defect no longer occurs.

The P0 contradiction and the null tooth; the assistant's session; the seeded Filed-later decision and its allocation intent; the duplicate guard comparing surfaces; the duplicate refusal's control that undid nothing; privacy in the read-back detail line; the addendum's link to the exam it amends; the invisible skipped site; appealed claims staying on the worklist; the statement's in-place confirmation; the appeal drawer's Close; the ERA write-off amount on the visible row; focus following the tab it selects; the phone top bar's gaps and labels; the palette row that hid the word it found; the write-off gate on every worklist; the pressed mark on a tooth; the refusal-code list; and Space belonging to the perio grammar rather than to whatever holds focus.

That last one deserves naming. bp-25 reported that Space, the bleeding key, activated the irreversible Save when focus rested on it, losing the bleeding mark. My round-1 probe had called it not reproduced, because it pressed Space on an empty chart where Save refused for a different reason. She was right and the probe was wrong.

### Open after round 2

The registered cap is two rounds. These were reported in round 2 and are not fixed. They are listed rather than chased.

**Layout and reach.** Self-pay toggles and the estimate column sit off the right edge at 420 px; the ledger's Amount column does the same; the ERA read-back rows are tall enough that one of three is on screen at a time; the read-back's control lands just below the fold at 1280 × 900; the perio settings drawer opens off-screen; the first Arrive on an operatory tablet is 1062 px down the page; the surgery card sits below a readiness list that is not the surgeon's.

**Focus and keyboard.** Focus drops to the page body after "Move to plan card"; Seat moves focus off the card to the chair strip; the Patient Rail does not take focus when it opens; the active-site line leaves the screen once the grid auto-scrolls.

**Copy and vocabulary.** Half of the incumbent vocabulary a Dentrix biller types still finds nothing (family file, guarantor, aging, account, claim, appeal, denial); the palette lands on the last-used Money Desk tab rather than the one it named; the product's own nouns are still on screen (killer strip, note scaffold, byteaudit); the `depth_gt_15` verb runs to nine words against the eight-word rule; the omission gate takes four taps; the PIN hint warns a new hire about wiped drafts before her first digit.

**Gates and states.** The read-back gate still shows three buttons for one gate and fires on a desk profile where the author never changes; focus after a killer parks on Held rather than the fix control; a filed exam's Screening button still looks live; the screening lane still shows full-chart hints; money in a note is only caught at File, not on blur; the plan card carries no allowed amount, annual maximum, or frequency limit; the perio tag prefills the deepest pocket instead of the tooth being tagged; rail chips no longer carry their retired attribute.

**Contrast and shape.** In grayscale a required killer row and an informational read-back row still measure the same on the left rail, and refusal rows carry no glyph; two Board rails differ only by glyph and word.

**Not attempted, and why.** The incumbent-vocabulary catalog is tenant-editable content by design (`docs/13` feature 28). Filling it now would flatter the next round rather than test anything.

