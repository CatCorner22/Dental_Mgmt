# Function-by-function audit of the clickable prototype

Status: rules and inventory registered 2026-09-05 before any audit agent ran (see the commit that introduced this file). Results are appended below the line "Results"; nothing above that line changes after it.

## Why this audit exists

`docs/14-beta-test-report.md` records a 30-persona beta test that landed in the rerun band and a six-persona re-test that improved the professions it touched without returning a pass. After that report merged, the owner asked for the next step in plain terms: continue reviewing and testing; the UI and UX must be intuitive and very clear; double check every function to ensure that each function is consistent and operational.

"Every function" is taken literally. The prototype's JavaScript contains 497 named functions across 19 files, as listed by `node scripts/audit/inventory.mjs`. (The first count handed to the audit agents was 489: the scratch parser missed eight one-line shorthand methods in `events.js`, `router.js`, and `shell.js`. The repository script found them; they were added to the agents' unit list so the completeness critic would flag them, and they are audited by hand under Results.) Each gets one row in the table under Results, with how it is reached, what state it was found in, and the evidence. "Consistent" and "operational" are given the definitions below so that the audit can fail: a function whose behaviour cannot be exercised is recorded as a gap, never as a pass.

## The three questions asked of every function

**Operational** (rules A1–A8). Reaching the function through the UI raises no page or console error. It does what its name and its control's label promise: the store changes, or the DOM changes, in the way the label says. A mutation writes one `write` event per table it changes; a gate writes one `refusal` event with code, verb, and control. A repeated press does not double-write. An Undo returns the store to its prior observable state without deleting anything. Every route renders for every persona. A number on screen moves when the state behind it moves. A pure helper returns correct values on ordinary, boundary, and null inputs.

**Consistent** (rules B1–B12). Every element with a handler carries a `data-testid` in the `screen.object[.id].control` form from `prototype/CONTRACTS.md` §4, and the DOM and §4 agree in both directions. Every gate renders through the one shared Refusal component: verb-first, at most eight words, exactly one 44 px control, a Why disclosure, a code from §6, and a primary button that switches to the Held identity rather than dimming. The same verb carries the same button identity on every screen, and an irreversible verb never executes from a key without its gate. One concept has one word across screens, refusals, announcements, and labels. Severity is shown three ways at once. Money passes through one formatter; dates through one; privacy mode leaks nothing; per-user state is per user; focus lands where the rule says; targets are 44 px with 8 px gaps at four widths; the event log keeps its schema.

**Clear** (rules C1–C8). Every screen has one `h1` that names the place in plain words. Every row has one primary action labelled with a verb. No product-internal noun or raw id is on screen unless the specification shows it. Empty states say why and what to do next. Every number has a label, and one fact has one value everywhere it appears. Policy prose stays behind Why. Validation is silent until blur. Announcements are one verb line.

The full rule text with ids, as the agents read it, is reproduced in the appendix to this file.

## Status vocabulary

| Status | Meaning |
|---|---|
| operational | Reached through the UI, or a pure helper exercised through a reached path or a direct call, and A1–A3 hold |
| broken | Reached, and an A rule fails; a finding is cited |
| unreachable | Referenced in code, but no persona × route × state the auditor could produce reaches it |
| dead | Referenced nowhere in `prototype/js`, including string-keyed dispatch |
| not_exercised | Not driven; the reason is stated. A gap in the audit, never a pass |

## Method

1. **Inventory.** `scripts/audit/inventory.mjs` lists every function declaration, arrow assignment, function expression, and object method in `prototype/js`, with file and line: 497 functions, grouped into 13 audit units (one per screen file; the foundation files together). `scripts/verify-docs.sh` regenerates the list and fails if this file's total or its results table disagrees with the code.
2. **Per-file audit.** One agent per unit reads its files and CONTRACTS.md, then writes and runs a Playwright script that drives every function through the UI from a named start hash, taking `window.__proto.state()` before and after, reading the write and refusal events in the `seq` range, pressing each mutating control twice, exercising each Undo, measuring every rendered control's size and gaps at desk, operatory, and phone widths, and recording focus after each action. Pure helpers are called directly with ordinary, boundary, and null inputs. Screens that show names or severity are re-driven in privacy mode and in grayscale.
3. **Eight cross-cutting lenses**, run alongside, each looking across files for what no single-file audit sees: refusal codes against §6 in both directions, with every code driven to the screen; test ids against §4 in both directions, with listener instrumentation to find handlers that lack an id; vocabulary, harvesting every visible string into a catalog and proposing a glossary; event-log integrity, diffing the store against the write events for every mutation and computing taps for the five flows; keyboard reach and focus, including Tab order per route, dialog focus, and the Space rule on the perio grid; one-fact-one-value, reading each shared fact from every rendering and the store before and after mutations; dead, unreachable, and duplicated code, from a reference graph and browser-run drift cases; and clarity for a first-day temp, at three widths in both themes, including produced empty states.
4. **Dedup.** One agent groups the raw findings into root causes by code-level cause, keeping the strongest reproduction and the cause's own file and line.
5. **Adversarial verification.** One verifier per cited file, whose default position is refuted, writes a probe per root cause that takes the measurement the claim depends on and states its negative control. A root cause counts only when the measurement shows the breach. The four round-1 probes that were wrong (`knowledge/reviews/beta-sessions/dedup-round1.md`) are required reading.
6. **Completeness critic.** One agent matches every inventoried function to exactly one row, counts statuses, lists every `not_exercised` row with its reason, and lists what each lens did not cover.
7. **Fix round.** Every confirmed root cause is fixed in `prototype/` and gains a regression check in `scripts/beta/audit/<file>.mjs`, loaded by `scripts/beta/reproduce.mjs`. Then the three harnesses run to green: `node scripts/beta/reproduce.mjs`, `node scripts/proto-check.mjs`, `bash scripts/verify-docs.sh`.

## Rules of evidence

A finding cites a rule id, a `file:line`, a start hash, a `data-testid` sequence, expected, observed, and a `seq` range from `window.__events` or a measured DOM value, plus the script that produced it. Without a measurement it is not a finding. The default position at every stage is "no finding"; the verifiers' default is "refuted". Severity: P0 throws, writes wrong data, or blocks a daily flow; P1 breaches a contract or misleads about state; P2 confusion a persona would quote; P3 preference. Items already listed under "Open after round 2" in `docs/14` are reported again and marked as known, so that this audit's count of them is honest.

## Declared constraints

| Constraint | Effect |
|---|---|
| Auditors are language-model agents driving headless Chromium | They measure structure (sizes, focus, events, text); they do not experience the interface |
| Static prototype, synthetic seed | Only the seeded states exist; payer, bank, and backend behaviour are out of scope |
| A function is "reached" through the seeded UI | A function that only a state the seed cannot produce would reach is `unreachable` here even if a real practice would reach it |
| Four CPUs; agents run two at a time | Coverage is bounded by what each agent drove; the critic's gap list is part of the result |

## What this audit cannot prove

Real usability, learnability in one shift, screen-reader behaviour, time on task, payer or clearinghouse behaviour, and any security property. It can prove that a named function, reached in a named way, did or did not do what its label says on the seeded data, and that the prototype's screens do or do not agree with their own contracts.

## Inventory

| File | Functions |
|---|---|
| `app.js` | 2 |
| `events.js` | 7 |
| `router.js` | 6 |
| `seed.js` | 5 |
| `store.js` | 44 |
| `ui.js` | 14 |
| `screens/board.js` | 30 |
| `screens/chairs.js` | 27 |
| `screens/checkout.js` | 22 |
| `screens/dailyclose.js` | 39 |
| `screens/encounter.js` | 56 |
| `screens/moneydesk.js` | 38 |
| `screens/palette.js` | 31 |
| `screens/perio.js` | 54 |
| `screens/phone.js` | 28 |
| `screens/rail.js` | 43 |
| `screens/roles.js` | 38 |
| `screens/shell.js` | 10 |
| `screens/signin.js` | 3 |
| **Total** | **497** |

---

## Results

Registered 2026-09-05, completed 2026-09-08. Nothing above the line changed after the audit ran.

**The three harnesses are green.** `node scripts/beta/reproduce.mjs` reports 0 of 294 reproduced with 0 unmeasured; `node scripts/proto-check.mjs` exits 0 with all nine rows PASS; `bash scripts/verify-docs.sh` passes every check.

### What the audit found, in one paragraph

Every function in `prototype/js` was inventoried, driven or called, and given a status with its evidence. The per-file audits and the eight lenses raised 341 findings; dedup grouped them into 251 root causes; an adversarial verifier whose default position was "refuted" wrote a probe per root cause and confirmed 248, refuted 3, and lowered 6 severities. Every confirmed root cause was fixed, and every probe was kept as a permanent regression check in `scripts/beta/audit/`, loaded by `scripts/beta/reproduce.mjs`. The three harnesses run green.

### The fix round, and what it cost

The fixes landed in two waves. Wave 1 took the 52 root causes in the shared layer — the store, the shared components, the seed, the router, the boot harness and the stylesheet — because every screen depends on them and fixing a screen against a broken store means fixing it twice. Wave 2 took the 196 in the twelve screen files, one agent per file, each restricted to its own file and required to re-run its own checks plus `proto-check` before reporting.

Three of the twelve screens produced a defect that a later full run caught and that no per-file check had been asked to look for. They are recorded here rather than quietly folded into the totals, because they are the strongest argument for running the whole suite after a fix round rather than trusting the per-file reports:

| Regression | Cause | Where it showed |
|---|---|---|
| Checkout footed a stored estimate after the ledger moved | The screen read `S.estimates[aid]` as the amount to collect | A $410 write-off approved from the phone took Patient due to $0.00 while the same visit still footed "$410.00 est.", prefilled Collect 410.00 and offered a live Post |
| An amount became computed while the sentence beside it stayed fixed | Only half the row was moved off its literal | The Money Desk open-balances row read "$0.00 open · patient portion outstanding since 9/1" |
| Two PIN pads, two key grammars | The phone step-up gained typed digits; the author pad did not | Four keystrokes filled one pad and left the other empty, and Go then refused a PIN nobody had failed to type |

### What the fix round found about the audit itself

This is the finding with the longest reach, and it is about the instrument rather than the product.

**Six times, a check reported "not reproduced" without having measured anything.** A check that cannot fail is worse than no check, because it is trusted. Each was found by a fixer reporting an inconvenience — never by the harness going red. The six shapes:

1. **The probe crashed.** A Playwright timeout inside a check was caught by the runner, filed as `reproduced: false`, and printed as `no` beside the genuine refutations. One such crash sat inside a run whose page was not rendering at all, so a whole file read clean.
2. **A control was renamed.** Collapsing the perio licence step removed `perio.licence.confirm`; six probes, a task script and half of a shared-component check named it. The ones that did not crash simply stopped scoring.
3. **A check carried its own copy of the contract.** Five separate modules read only their own screen's row of CONTRACTS §4 — one had the row pasted into its source as a string literal — so once §4 grew its cross-cutting rows, a screen fully obeying the contract could never make those checks report clean.
4. **A predicate demanded a shape the rules had replaced.** One asked for a single word across the gated primary's identity and an unrelated action label, when the glossary requires those two to differ. One asked for one dismissal word across three deliberately distinct concepts. A product obeying the rule measured as a breach.
5. **A fix removed the precondition its own check needed.** Narrowing who may clear a bank variance left the store's gate check pressing a button that no longer rendered for its persona, so it pressed nothing and measured no gate.
6. **A fix elsewhere removed the state another check needed.** Teaching `requestApproval` to dedupe meant the phone's Simulate control re-opened the same request, so two pending approvals could not coexist — and the check comparing the Andon's count with the phone's had been passing for want of a second request. When Simulate was taught to play the next scenario, the check went red and named a real disagreement between four surfaces.

Shapes 1 and 2 are now impossible to miss: a check that throws, or that finishes without recording a result, is its own outcome — printed as `CRASH` or `NOTHING`, listed with its reason, and enough on its own to make the run exit non-zero. The fix-state deriver treats both as **open**, where it would previously have recorded them as fixed. This was verified by planting a check that times out on a control that does not exist and one that returns without recording: both report as unmeasured, the run exits 1, a healthy check still exits 0.

Shapes 3 through 6 have no mechanical guard. Every one of them was found because a fixer was told to report an inconvenient check rather than edit it, and did. That instruction is the control, and it is the part of this method most worth keeping.

### Two errors made while fixing, both caught by the harness

Recorded because a report that lists only the defects it found in others is not an honest one.

- Removing a screen's private 12-hour clock left seven call sites referring to a name that no longer existed, and every route threw on load. `proto-check` went from nine PASS to sixteen route failures. The audit checks in that same run reported almost entirely "no" against a page that was not rendering — shape 1 above, in yet another costume.
- Capping the checkout estimate by the ledger balance alone zeroed the estimate for work not yet charged and broke the checkout flow. The cap is now the prior open balance plus this visit's uncharged procedures.

Both were caught before the push, by `proto-check` rather than by reading the diff.

### Vocabulary decided during the audit

The vocabulary lens harvested every visible string and proposed a glossary; the decisions below were taken against `docs/04` and `docs/13` feature 29 ("one canonical word per fact"). The owner can overrule any of them.

The largest was the disclosure family. Fifteen controls explain how a number on screen was derived, and seven of them opened with "How", "What" or "The" rather than "Why" — one concept reading seven ways. All fifteen now open with "Why" and name their subject. Two neighbouring families were deliberately **not** forced into line: a disclosure that explains a mechanism (`palette.how`, how search matches) and one that is a reference (`perio.settings.grammar`, the key legend) are different concepts, and giving all three the same opener would read worse, not clearer.

The others: the word `Held` belongs to the gated primary's identity and to nothing else; `Cancel` dismisses a dialog that would otherwise commit, `Close` a read-only surface, `Back to <place>` leaving a place; the approver's negative decision is `Send back` / `Sent back` everywhere; a room is a `Chair`; `Write-off` is one word with a hyphen. The full table is in the fix notes accompanying this audit.

### One rule, one owner

A recurring cause underneath the findings was the same rule living in more than one file, the copies drifting apart, and two screens then answering one question differently. Each is now a single shared function:

| Rule | Was | Now |
|---|---|---|
| A 12-hour clock | Six private copies; the Patient Rail had none and printed the raw 24-hour time | `Proto.ui.time` |
| Which codes want a claim attachment | A table in the Board and another in Checkout, drifted apart | `Proto.store.needsAttachment` |
| Which approvals a person is waiting on | Four surfaces, three different answers | `Proto.store.pendingApprovalsFor` |
| What a patient owes, and the sentence explaining it | Two independent computations that disagreed for 14 of 40 patients | `Proto.store.allocate`, read by both |
| Whether a procedure has been billed | A flag the seed did not set | `Proto.store.charged`, which reads the ledger |

### What this audit still does not prove

Everything the pre-registered section above says it cannot: real usability, learnability in one shift, screen-reader behaviour, time on task, payer behaviour, and any security property. Two more, specific to how the fixes were made:

- **The regression suite is only as good as its probes.** Six of them were found measuring nothing. The guard added here catches two of those six shapes mechanically; the other four were caught by human-style judgement and could recur.
- **A fix verified by the check written for it is not independently verified.** The probe and the fix were written against the same understanding of the defect. Where that understanding was wrong, both are wrong together, and the check will report clean.

### A static read after the harnesses were green (2026-09-08)

The paragraph above is not hypothetical. With all 294 checks reporting clean, a read of `prototype/js` against the contract and the seed found five defects, each confirmed live in the browser before it was fixed, and none of which any check had been asked to look for:

| Defect | Where | How it hid |
|---|---|---|
| Tighten and Retire on a decision due for review wrote the `controlDecisions` row and moved the threshold, then threw `T is not defined` | `dailyclose.js decisions()` | An earlier fix removed the `const T` with the date helper it served; Keep never read `T`, and Keep was the only action a check pressed |
| A valid PIN for the assistant (Jo Ramirez) wrote the session row and then landed on sign-in with no author chip | `router.js PERSONAS`, `shell.js openPinPad()` | `seed.personaUser` knew the persona; the router did not; no check typed 3333 |
| The owner's Andon strip printed "1 approval waiting" beside an empty sentence | `shell.js renderAndon()` | It read `frozenSentence`, a field no approvals row carries since the sentence moved to `approvalSentence`; the Andon checks compared counts, not sentences |
| After Post wrote the write-off request, the held gate still offered "Request approval": pressing it wrote nothing | `moneydesk.js postWriteoff()` | The checks measured that the request was written and that the gate rendered; none pressed the control and looked for a write |
| `approvalsLog` minted ids from the `al` counter that `allocations` use, so the log row was `al-1` and the first allocation `al-2` | `store.js decideApproval()` | No check read an id's prefix as the name of its table |

Each has a check in `scripts/beta/audit/misc-2.mjs`, written first and shown to report YES on the tree before the fix and no after it. The harness now carries 299 checks. The three harnesses also gained a `package.json`, because they had been looking for Playwright at the paths of the machine they were written on and writing their reports to a scratch directory that exists nowhere else: on any other checkout, `reproduce.mjs` ran all 294 checks and then threw on the final write.

### Five beta storms after the harnesses were green (2026-09-10)

With 299 checks reporting clean, the prototype was handed to a beta storm: agents testing in parallel, one per area, each forbidden to fix anything and required to file only what it had measured twice in the running page, with an executable probe per finding — a function over the shared driver that returns true while the defect is present and false once it is gone. Storm 1 ran seven testers (board-checkout, chairs-perio, encounter, invariants, moneydesk-ledger, owner-controls, shell-nav) and confirmed 119 findings, every one with a probe. The fixes landed in three waves of fixers with file-disjoint ownership — a fixer edits only the files it owns, reports what it needs elsewhere, and never touches git — and check-first: write the regression check in `scripts/beta/audit/storm-<owner>.mjs`, see it print YES on the tree, fix the cause, see it print no, re-run the storm's probe. Wave 2a was six fixers (store, chairs, owner, shell, board, money) and left 88 guards; the full run after it reported 6 of 387 reproduced — two owner checks and one Andon check waiting on store verbs another fixer owned (`disclose`, the redacted approval sentence), the claim-row actions, a contract row and a 420 px layout — which wave 2b (two fixers, encounter and words, 27 guards), wave 2c (one fixer, ledger, 6 guards), the contract commit and round 2 then took: 121 guards in `storm-*.mjs`.

Storm 3 re-tested the hardened tree (round 2) with five testers and the twists the first round had not driven: a shared device with wrong, right and another user's PINs, the outage toggled on and off mid-flow, after hours, privacy, keyboard-only with a double Enter, a reset mid-flow, 420 × 860 and 1024 × 768 with the rail open. It confirmed 68 findings and deferred 6 Money-Desk-only items to the fixer who owned that file. Its fixes were five fixers (store 17, board 16, encounter 10, owner 10, shell 7 guards), then three (ledger 16, controls 9, and a checks fixer who added no guard but repaired five earlier checks whose phone step-up path had stopped measuring once the store began matching the approver's own PIN), then one (polish, 3): 88 guards in `storm2-*.mjs`. The full run after the second of those waves reported 0 of 505 reproduced with one check printed as CRASH (A-storm-board-9 timed out waiting for the phone card's reason field: the store's new write-off cap had refused the $410 request the check relied on, so the check was re-pointed at a $300 request the cap allows) — the outcome the fix round's guard was built to print rather than a quiet no. Storm 4 (round 3) ran three testers (money, clinical-day, shell-owner) and confirmed 27 findings; its seeded random walks — 68 seeds × 50 steps, 3,400 steps over nine personas, 24 routes, twelve flag combinations and three viewports — found no page error, no table change without a write event, no undefined or NaN field and no horizontal overflow, and the ten walk violations that did survive replay were focus on body, an Enter-twice write and a gate left un-shadowed under a dialog, all filed. Its fix wave was four fixers (store 13, money 9, owner 9, shell 7) plus one coordinator check for a leftover the fixers reported under "Needs elsewhere" (the held Checkout request carried the whole form, PIN included, into the approvals row): 39 guards in `storm3-*.mjs`. The full run after the round-3 wave reported 0 of 547 reproduced with no CRASH and no NOTHING, `proto-check` nine of nine PASS, and `verify-docs` all PASS.

Storm 5 (round 4) began by replaying every probe from the first three rounds against the tree as it then stood: all read absent except a handful whose expectation the fixes had made stale (a control that now routes away, a palette row that no longer opens, a probe that asserts the front desk may reach Roles). It then ran three testers aimed at the round-3 rules themselves — money after the write-off cap and the settled amount, a shared day with two passes and the phone step-up, and seeded random walks over the clinical screens (84 seeds × 50 steps, clean on page errors, unlogged writes, NaN and overflow) — and confirmed 16 findings. Two were S1: an 835 payment posted by Post matched carried no charge, so `allocate()` handed the insurer's money to an exam filed the same day; and `chartUndo` withdrew the last note line instead of the line the named paint had appended. The rest were the same families a fourth time: the settled amount printed as the requested amount on four surfaces, a second statement raised for a balance whose statement had gone out that morning, a second day pass that silently superseded the first so the first temp's PIN counted as a miss against the whole desk, an Undo with no clinician gate, the phone step-up pad keeping the pre-round-3 Enter grammar, File landing focus on a control that leaves or on a killer row that writes, `set()` dropping focus to body, and a click on a dialog's verb line escaping the modal. Its fix wave was three fixers (store 8, desk 4, shell 6): 18 guards in `storm4-*.mjs`, plus a rewrite of A-screens-shell-8 against the pad grammar both pads now share. The harness now carries 565 checks (43 R-checks and 522 A-checks); the full run after the round-4 wave reported 0 of 565 reproduced with no CRASH and no NOTHING, `proto-check` nine of nine PASS, and `verify-docs` all PASS.

Four rounds of findings resolved into a small number of root-cause families, and the same families surfaced on every screen the storms reached. They are recorded here because they say more about how the prototype was built than any single defect does:

| Family | What it looked like | What holds it now | Guards, for example |
|---|---|---|---|
| A gate that outlived its cause | Post stayed Held after the outage ended; the temp's entitlement gate stood after the pass was issued; a tooth_required gate stood after a tooth was picked; an after-hours gate outlived the clock; a dentist's entitlement gate held the owner | Every screen prunes on render, and a press on a Held primary re-evaluates before it focuses a control; the cause list grew each round: outage, pass, field edited, clock, author | A-storm-board-1, A-storm2-board-2, A-storm2-enc-5, A-storm2-enc-6, A-storm2-owner-3, A-storm3-money-2, A-storm3-owner-2, A-storm3-owner-4, A-storm3-shell-5 |
| Focus handed to the next primary | After Arrive, focus on Seat; after Confirm, the next Confirm; after File, the read-back's own Confirm; after Ready, Write note; after Keep, Close day; after Raise, Send — so Enter twice fired two verbs | Focus lands on the fired control's stamp or the section heading, never on another primary or a control that leaves the screen | A-storm2-board-6, A-storm2-board-7, A-storm2-board-13, A-storm2-ledger-1, A-storm2-ledger-3, A-storm2-enc-10, A-storm2-owner-9, A-storm2-owner-10, A-storm3-money-6, A-storm3-owner-6, A-storm4-shell-2, A-storm4-shell-4, A-storm4-shell-5 |
| A rule copied into screens instead of owned by the store | The support line in two wordings across six files; type, status and eligibility word tables drifted; each screen matched PINs itself with no miss count; Perio carried its own who-may-chart rule; the write-off cap lived only where the request was made; two allocations disagreed; four surfaces printed the requested amount where the store had settled less; Undo skipped the clinician gate every other chart verb ran; only the newest day pass verified; two pads kept two Enter grammars | `Proto.ui.support`, `TYPE`/`STATUS`/`ELIG`, `store.verifyPin`/`requirePin`, `store.clinician`, `store.writeoffCap`, `store.needs`/`bills`, one `allocate` split by side, `store.settledCents` through `approvalSentence`, `store.clinician` in `chartUndo`, `store.livePasses` in `verifyPin`, one pad grammar | A-storm-words-1, A-storm-words-2, A-storm-words-4, A-storm-store-5, A-storm2-store-6, A-storm2-shell-1, A-storm2-polish-2, A-storm2-store-13, A-storm-store-15, A-storm2-store-3, A-storm3-store-6, A-storm2-store-1, A-storm3-store-2, A-storm4-store-2, A-storm4-desk-1, A-storm4-store-8, A-storm4-store-6, A-storm4-desk-4 |
| A control whose label promised an action it did not do | "Support line" ran `() => {}`; "Open Roles" went to the Board; "Open the day" had no handler; "Set aside" switched tab; Fix, Attach and Call payer only announced; Show name and Investigate promised a logged read and logged nothing | The store hands a control word and the screen acts on it, or the store's verb writes the row the label names | A-storm-chairs-4, A-storm-enc-7, A-storm-board-4, A-storm-owner-3, A-storm-owner-6, A-storm-owner-7, A-storm-money-5, A-storm-money-6, A-storm2-controls-1 to -9, A-storm2-ledger-4, A-storm2-ledger-10, A-storm3-owner-8, A-storm3-store-13 |
| A table that read seed rows instead of deriving from the ledger | "37 posted before you sat down" with no ledger row behind it; the Credits tab listed `S.credits`; a statements row printed its frozen amount at a zero balance; "Balance before today" read `appointment.balanceCents`; Checkout footed `S.estimates`; an ERA row carried no charge so its money fell to whatever was posted next; the note kept its own line list beside the chart events; the 835 header EFT and three seeded claims had no ledger behind them | Counts, credits, statements, balances and the window estimate are computed from ledger rows, and the seed no longer pre-marks lines as posted; ERA rows carry `chargeIds`, the note's lines are rebuilt from live chart events, and the seed's EFT and claims reconcile to ledger rows | A-storm-money-2, A-storm-ledger-6, A-storm2-ledger-9, A-storm2-ledger-12, A-storm2-board-12, A-storm2-board-15, A-storm3-money-7, A-storm3-store-8, A-storm4-store-1, A-storm4-store-7, A-storm4-store-4, A-storm4-store-5, A-storm4-store-3, A-storm4-desk-3 |

What the storms did not prove is the same as before, with one addition. The random walks and the probes measure structure — events, state, focus, geometry — and a family that recurred four times is likely to recur a fifth in a screen or state the walks did not reach. The testers' own lists of what held up (in their `agent_notes`) are a record of what was driven, not of what is correct.

### Coverage

| Measure | Count |
|---|---|
| Functions in `prototype/js` (`scripts/audit/inventory.mjs`) | 713 |
| Of those, from the registered audited universe of 497 | 486 |
| Registered functions the fix round removed or renamed | 10 |
| Registered functions the five storms removed | 1 |
| Functions the fix round introduced, audited by hand, still present | 76 |
| Functions the fix round introduced that the storms removed | 2 |
| Functions the five storms introduced, audited by hand | 151 |
| Functions with no row | 0 |
| Per-file audits returned | 13 of 13 |
| Lenses returned | 8 of 8 |
| Raw findings | 341 |
| Root causes after dedup | 251 |
| Root causes reproduced by an adversarial verifier | 248 of 251 verified |
| Reproduced root causes fixed | 248 |

### Status of every function

| Status | Functions |
|---|---|
| operational | 659 |
| broken → fixed | 53 |
| not_exercised | 1 |

Functions the fix round introduced, which the audit could not have seen because they did not exist when it ran. Each was driven by hand after the fixes landed and carries its own evidence in the table below: `router.js:unescape`, `screens/board.js:frontDeskCover`, `screens/board.js:weekday`, `screens/board.js:outageRefusal`, `screens/board.js:pruneStaleGates`, `screens/board.js:focusGate`, `screens/board.js:holdStrip`, `screens/board.js:checkout`, `screens/board.js:practiceLine`, `screens/chairs.js:practiceLine`, `screens/checkout.js:gate`, `screens/checkout.js:procName`, `screens/checkout.js:chargeName`, `screens/checkout.js:cadenceWord`, `screens/dailyclose.js:entWords`, `screens/dailyclose.js:pairWords`, `screens/dailyclose.js:cap`, `screens/dailyclose.js:orList`, `screens/dailyclose.js:monthlyDue`, `screens/dailyclose.js:table`, `screens/dailyclose.js:standing`, `screens/encounter.js:byLine`, `screens/encounter.js:focusFirst`, `screens/encounter.js:minutesOf`, `screens/encounter.js:waitMinutes`, `screens/encounter.js:rank`, `screens/encounter.js:practiceLine`, `screens/encounter.js:renderUndo`, `screens/moneydesk.js:plural`, `screens/moneydesk.js:sentLine`, `screens/palette.js:myRecents`, `screens/palette.js:daysInMonth`, `screens/palette.js:focusRow`, `screens/palette.js:moneyTab`, `screens/palette.js:goMoney`, `screens/palette.js:name`, `screens/perio.js:openAmendGate`, `screens/perio.js:focusGateControl`, `screens/perio.js:mayChart`, `screens/perio.js:closeInline`, `screens/perio.js:focusCursor`, `screens/phone.js:st`, `screens/phone.js:cardSentence`, `screens/phone.js:focusOn`, `screens/phone.js:nextSim`, `screens/phone.js:simWords`, `screens/phone.js:gate`, `screens/phone.js:renderNotFound`, `screens/rail.js:syncOpeners`, `screens/rail.js:done`, `screens/rail.js:label`, `screens/rail.js:word`, `screens/rail.js:rowRef`, `screens/rail.js:explainEmpty`, `screens/rail.js:openMoneyDesk`, `screens/roles.js:onControl`, `screens/shell.js:refocus`, `screens/shell.js:onPadKey`, `seed.js:netOwed`, `seed.js:statementFor`, `store.js:touch`, `store.js:offline`, `store.js:notFound`, `store.js:allocate`, `store.js:claimFor`, `store.js:expected`, `store.js:charged`, `store.js:requestApproval`, `store.js:approvalSentence`, `store.js:chartUndo`, `store.js:dismissTag`, `store.js:needsAttachment`, `store.js:openSession`, `store.js:pendingApprovalsFor`, `ui.js:resetGates`, `ui.js:dateParts`, `ui.js:dateTime`, `ui.js:time`.

Audit rows that match no inventoried function (renamed or mis-lined): `screens/board.js:clock12@34`, `screens/chairs.js:fmtTime@32`, `screens/chairs.js:clock12@33`, `screens/encounter.js:clock12@46`, `screens/perio.js:clock12@25`, `screens/phone.js:to12h@25`, `screens/phone.js:redactedSentence@27`, `screens/phone.js:focusTestid@45`, `screens/rail.js:sendBiller@168`, `screens/roles.js:clock12@47`.

Rows the five storms of 2026-09-10 retired, because the function no longer exists: `screens/rail.js:sumsFrom@53` (registered; the As-of totals now come from `Proto.store.allocate(pid, asOf)`, the same pass Explain reads — 008927f, guarded by A-storm-ledger-3), `screens/perio.js:mayChart@185` (fix-round function; the screen's private copy of the who-may-chart rule, replaced by `store.js:clinician` — f3014fb, A-storm2-polish-2) and `store.js:expected@54` (fix-round function; inlined when the allocation was split by side — 33c8fce, A-storm2-store-1).

Functions the five storms introduced, which neither the audit nor the fix round could have seen. Each carries a row below whose Reached by column names the storm check(s) in `scripts/beta/audit/storm*.mjs` that drive it, and whose Evidence names what it does and the finding it answers: `app.js:focusHead`, `app.js:repaintCanvas`, `screens/board.js:windowDecision`, `screens/board.js:paidAtWindow`, `screens/board.js:windowWord`, `screens/board.js:stale`, `screens/board.js:dropGates`, `screens/board.js:openRoles`, `screens/board.js:raise`, `screens/board.js:heldPress`, `screens/board.js:reverifyAll`, `screens/board.js:held`, `screens/chairs.js:heldReady`, `screens/checkout.js:focusPin`, `screens/checkout.js:removeWriteoff`, `screens/checkout.js:focusField`, `screens/checkout.js:openRoles`, `screens/checkout.js:selfPayFor`, `screens/checkout.js:afterWriteoff`, `screens/checkout.js:postedRows`, `screens/checkout.js:byId`, `screens/checkout.js:waiting`, `screens/dailyclose.js:shared`, `screens/dailyclose.js:extras`, `screens/dailyclose.js:posted`, `screens/dailyclose.js:openDay`, `screens/dailyclose.js:focusPin`, `screens/dailyclose.js:gate`, `screens/dailyclose.js:onControl`, `screens/dailyclose.js:stale`, `screens/dailyclose.js:heldGate`, `screens/dailyclose.js:live`, `screens/dailyclose.js:heldPress`, `screens/dailyclose.js:disclose`, `screens/dailyclose.js:scan`, `screens/dailyclose.js:candidates`, `screens/dailyclose.js:refuse`, `screens/dailyclose.js:doMatch`, `screens/dailyclose.js:doClear`, `screens/dailyclose.js:review`, `screens/dailyclose.js:confirm`, `screens/dailyclose.js:pinGates`, `screens/dailyclose.js:pinField`, `screens/dailyclose.js:wroteWords`, `screens/encounter.js:focusGateVerb`, `screens/encounter.js:reveal`, `screens/encounter.js:gateNode`, `screens/encounter.js:staleGate`, `screens/encounter.js:sentToExams`, `screens/encounter.js:isSent`, `screens/moneydesk.js:viewFor`, `screens/moneydesk.js:shared`, `screens/moneydesk.js:post`, `screens/moneydesk.js:focusEl`, `screens/moneydesk.js:focusPin`, `screens/moneydesk.js:removeWriteoff`, `screens/moneydesk.js:gate`, `screens/moneydesk.js:outageOver`, `screens/moneydesk.js:isPinGate`, `screens/moneydesk.js:dropPinGates`, `screens/moneydesk.js:pinField`, `screens/moneydesk.js:landing`, `screens/moneydesk.js:due`, `screens/moneydesk.js:waitingEnc`, `screens/moneydesk.js:creditRows`, `screens/moneydesk.js:claimAct`, `screens/perio.js:siteDepth`, `screens/perio.js:fitGrid`, `screens/phone.js:stale`, `screens/phone.js:nameDisclosed`, `screens/phone.js:pin_no_match`, `screens/phone.js:pin_locked`, `screens/phone.js:NOTICE`, `screens/phone.js:notice`, `screens/rail.js:shared`, `screens/rail.js:focusPin`, `screens/rail.js:storeGate`, `screens/roles.js:now`, `screens/roles.js:endBadText`, `screens/roles.js:passAsSeat`, `screens/roles.js:refreshAfterBlur`, `screens/roles.js:staleSave`, `screens/roles.js:dropStaleGate`, `screens/shell.js:minimumSentence`, `screens/shell.js:lockedOut`, `screens/shell.js:localLock`, `screens/shell.js:verifyPin`, `screens/shell.js:showStoreRefusal`, `screens/shell.js:retype`, `screens/shell.js:refreshAndon`, `store.js:ledgerRow`, `store.js:shared`, `store.js:lockedOut`, `store.js:verifyPin`, `store.js:pinLockout`, `store.js:requirePin`, `store.js:poster`, `store.js:noPass`, `store.js:needs`, `store.js:bills`, `store.js:writeoffCap`, `store.js:afterHours`, `store.js:insSide`, `store.js:take`, `store.js:pinned`, `store.js:forIns`, `store.js:insurerMoney`, `store.js:allocationRows`, `store.js:at`, `store.js:visitEstimate`, `store.js:windowEstimate`, `store.js:clinician`, `store.js:wholePatient`, `store.js:liveEvents`, `store.js:sameSurfaces`, `store.js:same`, `store.js:ce`, `store.js:dentistLike`, `store.js:expectedFor`, `store.js:settleBatch`, `store.js:patientRecords`, `store.js:IN_REVIEW`, `store.js:claimAction`, `store.js:disclose`, `store.js:raiseStatement`, `store.js:reconciles`, `ui.js:support`, `ui.js:typeWord`, `ui.js:dialogRoot`, `ui.js:topDialog`, `ui.js:landFocus`, `ui.js:shadowGates`, `ui.js:closeDialogs`, `screens/encounter.js:switchAuthorWithDraft`, `screens/encounter.js:focusId`, `screens/moneydesk.js:hasStatement`, `screens/moneydesk.js:postedCents`, `screens/roles.js:passChip`, `screens/shell.js:keepFocus`, `store.js:passEnds`, `store.js:passState`, `store.js:passLive`, `store.js:livePasses`, `store.js:passUser`, `store.js:tempSeat`, `store.js:settledCents`, `store.js:noteLine`, `store.js:noteLines`, `store.js:claimCharges`, `store.js:eraTargets`, `store.js:openStatement`.

### By file

| File | Functions | Operational | Broken | Fixed | Unreachable | Dead | Not exercised | Findings |
|---|---|---|---|---|---|---|---|---|
| `app.js` | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 3 |
| `events.js` | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0 |
| `router.js` | 7 | 6 | 0 | 1 | 0 | 0 | 0 | 1 |
| `screens/board.js` | 47 | 44 | 0 | 3 | 0 | 0 | 0 | 27 |
| `screens/chairs.js` | 27 | 24 | 0 | 3 | 0 | 0 | 0 | 15 |
| `screens/checkout.js` | 35 | 32 | 0 | 3 | 0 | 0 | 0 | 23 |
| `screens/dailyclose.js` | 68 | 65 | 0 | 3 | 0 | 0 | 0 | 23 |
| `screens/encounter.js` | 68 | 63 | 0 | 5 | 0 | 0 | 0 | 30 |
| `screens/moneydesk.js` | 56 | 51 | 0 | 5 | 0 | 0 | 0 | 26 |
| `screens/palette.js` | 37 | 33 | 0 | 4 | 0 | 0 | 0 | 17 |
| `screens/perio.js` | 59 | 57 | 0 | 2 | 0 | 0 | 0 | 34 |
| `screens/phone.js` | 38 | 35 | 0 | 3 | 0 | 0 | 0 | 23 |
| `screens/rail.js` | 51 | 49 | 0 | 2 | 0 | 0 | 0 | 24 |
| `screens/roles.js` | 44 | 39 | 0 | 5 | 0 | 0 | 0 | 20 |
| `screens/shell.js` | 19 | 17 | 0 | 2 | 0 | 0 | 0 | 17 |
| `screens/signin.js` | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 3 |
| `seed.js` | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 5 |
| `store.js` | 93 | 85 | 0 | 7 | 0 | 0 | 1 | 39 |
| `ui.js` | 25 | 20 | 0 | 5 | 0 | 0 | 0 | 9 |

### Lenses

| Lens | Findings | Coverage | Gaps |
|---|---|---|---|
| clarity | 13 | Phase A (matrix.cjs, unmutated seed): 8 personas (frontdesk, biller, hygienist, dentist, surgeon, owner, compliance, temp) × 12 routes (board, money, chairs, exams, close, risk, roles, checkout/a-1044, perio/enc-9001, e… | Matrix fold numbers for personas after frontdesk at 420×860 are confounded: the Patient Rail opened by the frontdesk ledger hop stayed open through the rest of that context (rail persists across hash changes until sign-… |
| deadcode | 12 | Static: every file under prototype/js (19 files, 4,070 lines) read in full; a reference graph built for all 497 inventoried functions (graph.cjs → graph.json) covering same-file identifiers, export-object properties, cr… | 1) Not driven: dark theme; phone and operatory device profiles; privacy=1, outage=1, grayscale, reduced motion, afterHours; the compliance persona; the perio grid keys; the roles day-pass form; the temp persona beyond t… |
| events | 6 | Headless Chromium over file:// via lib.cjs, desk viewport 1280×900, light theme, no query flags (no privacy, outage, afterHours, grayscale, reduced motion). Personas driven: frontdesk (board, checkout, palette), hygieni… | Devices operatory/shared/phone, dark theme, and the privacy, outage, afterHours, grayscale and reduced-motion flags were not driven, so the refusal-shape check covers only the 9 codes raised on the desk/light path; afte… |
| keyboard | 6 | Driven in headless Chromium over file:// with lib.cjs, light theme unless stated. Tab order: 131 fresh-load crawls = signin + 8 personas × 13 routes (board, money, chairs, exams, close, risk, checkout/a-1044, perio/enc-… | Devices: operatory and shared profiles were not crawled (only shared for the checkout PIN path); dark theme measured for one route sample only (board, 4 stops); privacy=1, outage=1, grayscale, reduced motion not driven … |
| refusals | 12 | Static enumeration of every gate in prototype/js (store.js refuse/evaluateRelease/noteKillers, every Proto.ui.refusal call in 12 screen files, every hand-rolled gate: removed control, bare paragraph, hint text, announce… | Codes not rendered: note_unfiled and consent_scope (no occurrence in prototype/js — nothing to drive); notfound (store returns it; no screen renders it as a refusal — five not-found routes measured, 0 refusal events); s… |
| state | 13 | Cross-file "one fact, one value" lens (C5, A7) over the 13 units. Static read of every renderer of the named facts (store.js balances/closeDay/matchVariance/decideApproval/requestWriteoff/addDayPass; board.js, checkout.… | Not driven, so not covered: the p-306 write-off requested from the Checkout screen (checkout.writeoff.add path) rather than Money Desk, and therefore the checkout Held→Post flip after approval and the Money Desk card wh… |
| testids | 7 | Instrumented crawl (page.addInitScript wrapping EventTarget.prototype.addEventListener for click/keydown/keyup/pointerdown/change/input; every element that received one is marked data-audit-handler). Phase A, unmutated:… | (1) Devices: only desk (1280x900) and phone (420x860) were crawled; operatory (1024x768) was never driven and shared only for the two PIN gates (checkout.pin, perio pin_required), so ids that appear only on those profil… |
| vocabulary | 22 | Driven headless Chromium over file:// with lib.cjs (harvest.cjs): 1198 rendered states, 2308 distinct strings, 64,963 string→location rows in catalog.json. Phase A (unmutated): all 8 personas × 25 routes (board, chairs,… | Not driven: the post-control states of the palette DOB retry and the PIN-pad "Clear and retype" (page.click on refusal.control inside those dialogs timed out in both runs, 4 step failures in analysis.json tables.step_fa… |

### Root causes

| Id | Sev | Kind | Where | Root cause | Members | State |
|---|---|---|---|---|---|---|
| RC-1 | P0 | operational | `store.js:108` | postCheckout re-charges seeded pr-431 already on the ledger (seed lacks charged flag) | 2 | fixed · A-store-1-1 |
| RC-2 | P0 | operational | `screens/encounter.js:262` | Undo never trims notes[enc].procedures; undone procedures stay in the scaffold, repaint doubles the line, and it is frozen into the filed n… | 2 | fixed · A-screens-encounter-1-1 |
| RC-25 | P0 | operational | `screens/dailyclose.js:67` | todayTotals (dailyclose.js:67) and closeDay (store.js:264) count yesterday's repost le-4431 as Check $120.00 collected today and freeze it … | 2 | fixed · A-screens-dailyclose-1-1 |
| RC-3 | P1 | operational | `screens/encounter.js:257` | Undo splices chartEvents/procedures/planItems/tag disposition in place; no reversal row | 2 | fixed · A-screens-encounter-1-2 |
| RC-4 | P1 | consistency | `store.js:154` | frozenSentence carries the full patient name into Andon, Daily Close and Money Desk under privacy mode | 6 | fixed · A-store-1-2 |
| RC-5 | P1 | operational | `store.js:243` | fileNote releases only completed_pending_charge; seeded completed uncharged procedures never charge, credit never applies | 1 | fixed · A-store-1-3 |
| RC-6 | P1 | operational | `store.js:121` | postCheckout pushes credits and flips appointment status without write() | 3 | fixed · A-store-1-4 |
| RC-7 | P1 | consistency | `store.js:140` | Store raises codes blocked_same_person and stepup not in CONTRACTS s6 | 2 | fixed · A-store-1-5 |
| RC-8 | P1 | consistency | `store.js:263` | closeDay returns control null for already_closed; refusal renders with zero controls | 4 | fixed · A-store-1-6 |
| RC-9 | P1 | consistency | `store.js:93` | tender_required refusal has no Why | 1 | fixed · A-store-1-7 |
| RC-10 | P1 | operational | `screens/checkout.js:51` | Checkout withControl default routes unknown codes to Board; 'Open the ledger' opens the Board | 2 | fixed · A-screens-checkout-1-1 |
| RC-11 | P1 | operational | `seed.js:59` | Seed generates p-320 twice; Aiko Tanaka aggregates another patient's balance | 1 | fixed · A-seed-1 |
| RC-12 | P1 | operational | `store.js:54` | explain() relates every later payment to every earlier charge; 14 of 40 patients disagree with Patient due | 1 | fixed · A-store-1-8 |
| RC-13 | P1 | clarity | `store.js:199` | duplicate_paint verb interpolates the procedure name (10 words) | 3 | fixed · A-store-1-9 |
| RC-14 | P1 | clarity | `store.js:285` | sod_conflict uses the seed fraudPath sentence as the verb | 2 | fixed · A-store-1-10 |
| RC-15 | P1 | consistency | `screens/board.js:247` | Board A key executes Arrive (irreversible identity) with no gate | 2 | fixed · A-screens-board-1-1 |
| RC-16 | P1 | operational | `screens/board.js:85` | ping_rate refusal built without onControl; 'Open the chart' does nothing | 1 | fixed · A-screens-board-1-2 |
| RC-17 | P1 | operational | `store.js:83` | pingChair rate limit checks only the last two messages overall; bypassed by pinging another chair | 2 | fixed · A-store-2-1 |
| RC-18 | P1 | consistency | `screens/board.js:151` | Board card Balance reads the estimate / appointment.balanceCents, not the ledger | 4 | fixed · A-screens-board-1-3 |
| RC-19 | P1 | operational | `screens/chairs.js:21` | Chairs practice line 71% is a string constant | 1 | fixed · A-screens-chairs-1 |
| RC-20 | P1 | operational | `screens/chairs.js:98` | Chairs outage gate never clears; Ready stays Held and does nothing | 1 | fixed · A-screens-chairs-2 |
| RC-21 | P1 | consistency | `screens/chairs.js:175` | Chairs R key executes Ready for exam (irreversible identity) with no gate | 1 | fixed · A-screens-chairs-3 |
| RC-22 | P1 | consistency | `screens/board.js:10` | STATUS/ELIG word tables copied into board.js, chairs.js and rail.js have drifted: seated is 'In chart' / 'Seated' / '(seated)', green is 'E… | 5 | fixed · A-screens-board-1-4 |
| RC-23 | P1 | operational | `screens/checkout.js:62` | Checkout cents() plus store fallback accept 0/blank/text/negative amounts and post the estimate or a positive payment | 1 | fixed · A-screens-checkout-1-2 |
| RC-24 | P1 | consistency | `screens/dailyclose.js:135` | Clear with reason offered to and accepted from any non-closer | 1 | fixed · A-screens-dailyclose-1-2 |
| RC-26 | P1 | operational | `ui.js:52` | Proto.ui.refusal logs and announces on every construction; screens rebuild persisted gates each re-render | 5 | fixed · A-ui-1 |
| RC-27 | P1 | operational | `screens/encounter.js:361` | Send to Exams to sign calls readyForExam on every press | 1 | fixed · A-screens-encounter-1-3 |
| RC-28 | P1 | consistency | `screens/encounter.js:153` | Dismiss gate raises reason_required, not in s6 | 1 | fixed · A-screens-encounter-1-4 |
| RC-29 | P1 | consistency | `screens/encounter.js:323` | Read-back gate renders three 44px controls | 1 | fixed · A-screens-encounter-1-5 |
| RC-30 | P1 | consistency | `screens/moneydesk.js:124` | Money Desk writeoffCard nulls st.woRefusal when a request is pending; refusal swallowed, focus to body | 3 | fixed · A-screens-moneydesk-1-1 |
| RC-31 | P1 | operational | `store.js:253` | buildAppeal appends a packet on every press | 2 | fixed · A-store-2-2 |
| RC-32 | P1 | operational | `store.js:249` | Post matched flips batch status with no write event and posts nothing | 3 | fixed · A-store-2-3 |
| RC-33 | P1 | consistency | `screens/moneydesk.js:136` | amount_required, reason_required, packet_incomplete codes not in s6 | 1 | fixed · A-screens-moneydesk-1-2 |
| RC-34 | P1 | operational | `screens/moneydesk.js:26` | Money Desk cents() strips sign and exponent: '-50' posts $50, '1e3' -> $13 | 1 | fixed · A-screens-moneydesk-1-3 |
| RC-35 | P1 | consistency | `screens/palette.js:9` | Palette Recents is one module-scope list across users | 1 | fixed · A-screens-palette-1-1 |
| RC-36 | P1 | operational | `screens/perio.js:172` | Perio pin_required gate never clears after PIN switch; Save stays Held | 1 | fixed · A-screens-perio-1-1 |
| RC-37 | P1 | operational | `screens/perio.js:174` | Start an addendum never passes extras.amending; a plain exam is written | 2 | fixed · A-screens-perio-1-2 |
| RC-38 | P1 | consistency | `screens/perio.js:173` | screening_incomplete code not in s6 | 1 | fixed · A-screens-perio-1-3 |
| RC-39 | P1 | consistency | `screens/perio.js:340` | Perio segment buttons set aria-pressed after btn(); no pressmark | 1 | fixed · A-screens-perio-1-4 |
| RC-40 | P1 | operational | `screens/phone.js:111` | Send back reason never written; decideApproval takes no reason | 1 | fixed · A-screens-phone-1-1 |
| RC-41 | P1 | operational | `screens/phone.js:145` | Show name fires a disclosures write event but writes no row | 1 | fixed · A-screens-phone-1-2 |
| RC-42 | P1 | consistency | `screens/phone.js:168` | Phone Approve keeps irreversible identity after a refusal | 1 | fixed · A-screens-phone-1-3 |
| RC-43 | P1 | consistency | `screens/phone.js:21` | Phone card state is module-global, not per user | 2 | fixed · A-screens-phone-1-4 |
| RC-44 | P1 | operational | `screens/rail.js:168` | Send to biller changes no state, no event, announces a Money Desk row | 1 | fixed · A-screens-rail-1-1 |
| RC-45 | P1 | operational | `screens/rail.js:180` | Send statement without statementsDue row sends nothing and re-sends | 1 | fixed · A-screens-rail-1-2 |
| RC-46 | P1 | consistency | `screens/rail.js:178` | statement_held code not in s6 | 1 | fixed · A-screens-rail-1-3 |
| RC-47 | P1 | consistency | `screens/signin.js:26` | signin.afterhours not in s4 | 1 | fixed · A-misc-1-8 |
| RC-48 | P1 | consistency | `screens/shell.js:28` | nav.<route>, notfound.home, skip.canvas not in s4 | 1 | fixed · A-screens-shell-1 |
| RC-49 | P1 | consistency | `screens/checkout.js:151` | Six Checkout testids not in s4 | 1 | fixed · A-screens-checkout-1-3 |
| RC-50 | P1 | consistency | `screens/dailyclose.js:188` | Four Daily Close testids not in s4 | 1 | fixed · A-screens-dailyclose-1-3 |
| RC-51 | P1 | consistency | `screens/moneydesk.js:184` | Seven Money Desk testids not in s4 | 1 | fixed · A-screens-moneydesk-1-4 |
| RC-52 | P1 | consistency | `screens/palette.js:88` | palette.close/how/confirm.go/confirm.back not in s4 | 1 | fixed · A-screens-palette-1-2 |
| RC-53 | P1 | consistency | `screens/perio.js:340` | Eleven Perio testids not in s4 | 1 | fixed · A-screens-perio-1-5 |
| RC-54 | P1 | consistency | `screens/rail.js:77` | Rail summary ids and entire Ledger screen have no s4 entry | 1 | fixed · A-screens-rail-1-4 |
| RC-55 | P1 | consistency | `screens/signin.js:28` | 'Open my home' carries the irreversible identity though sign-in is reversible | 1 | fixed · A-misc-1-9 |
| RC-101 | P1 | consistency | `screens/moneydesk.js:234` | Approvals row concatenates STATUS 'Sent back' with raw 'declined by'; write-off card shows no sent-back state | 2 | fixed · A-screens-moneydesk-1-5 |
| RC-197 | P1 | operational | `screens/roles.js:196` | Roles name/shift-end blur calls refreshPreview(force), which replaces the Issue day pass button under the pointer: the first mouse press is… | 2 | fixed · A-screens-roles-1 |
| RC-198 | P1 | operational | `store.js:290` | addDayPass records the SoD control decision against pv.conflicts[0] (seed order), not the critical conflict that held the save; one row for… | 1 | fixed · A-store-2-4 |
| RC-199 | P1 | consistency | `screens/roles.js:176` | Roles gate codes name_required and shift_end_required are not in CONTRACTS §6 | 1 | fixed · A-screens-roles-2 |
| RC-200 | P1 | consistency | `screens/roles.js:231` | Four Roles test ids (roles.daypass.signin, roles.daypass.expiry.why, roles.daypass.extra.why, roles.row.<userId>.why) are not in CONTRACTS … | 1 | fixed · A-screens-roles-3 |
| RC-203 | P1 | operational | `store.js:283` | Only arrive (store.js:74) and postCheckout (store.js:90) check S.outage; eraConfirm, sendStatement, savePerio, closeDay, fileNote, addDayPa… | 2 | fixed · A-store-2-5 |
| RC-209 | P1 | consistency | `screens/checkout.js:184` | Under a gate the primary keeps the irreversible identity on Checkout (postRow), Money Desk (writeoff Post) and the PIN pad (Go); seven othe… | 1 | fixed · A-screens-checkout-1-4 |
| RC-210 | P1 | consistency | `ui.js:28` | ui.btn accepts any label for kind:"held", so held primaries read "Close day", "Choose a reason above", "Held — confirm the read-back", "Hel… | 2 | fixed · A-ui-2 |
| RC-211 | P1 | consistency | `prototype/CONTRACTS.md:96` | CONTRACTS §6 and the product disagree both ways: nine raised codes are unlisted (reason_required, amount_required, screening_incomplete, na… | 2 | fixed · A-misc-1-1 |
| RC-212 | P1 | consistency | `screens/board.js:122` | Hand-rolled gates: Board outage removes Arrive/Seat/Ping and shows a bare span while the A key only announces; the closer's clear_not_indep… | 1 | fixed · A-screens-board-1-5 |
| RC-213 | P1 | consistency | `store.js:94` | Refusal verb lines are noun-, pronoun- or gerund-first at 19 of 39 rendered gates ("This visit is already checked out", "Server unreachable… | 2 | fixed · A-store-2-6 |
| RC-215 | P1 | consistency | `ui.js:54` | Proto.ui.refusal uses fixed ids refusal.verb/control/why, so two gates on one page collide: the contract selector resolves to the occluded … | 1 | fixed · A-ui-3 |
| RC-216 | P1 | consistency | `screens/encounter.js:188` | renderOdontogram renders enc.surface.0.<m\|o\|d\|b\|l> whenever no tooth is selected ((x.tooth \|\| 0)); tooth segment outside the §4 patte… | 1 | fixed · A-screens-encounter-1-6 |
| RC-217 | P1 | consistency | `ui.js:89` | Every Proto.ui.dialog backdrop (div.overlay) carries a click-to-close handler with no data-testid; the closing click is logged with no test… | 1 | fixed · A-ui-4 |
| RC-220 | P1 | consistency | `prototype/CONTRACTS.md:50` | CONTRACTS §4 never absorbed 174 of 868 rendered ids across 13 screens (whole Ledger screen, .rail/.why families, nav.*, palette.*, perio.*,… | 1 | fixed · A-misc-1-2 |
| RC-231 | P1 | operational | `screens/encounter.js:257` | Screen files bypass Proto.store: encounter undo splices four tables and logs a non-row id, dismissTag edits a seed row and calls Proto.even… | 2 | fixed · A-screens-encounter-1-7 |
| RC-233 | P1 | operational | `app.js:43` | app.js render stamps tabindex="-1" on the first h1-or-[data-testid] in the canvas; on Daily Close that is the close.tied.tile button, which… | 1 | fixed · A-misc-1-4 |
| RC-236 | P1 | consistency | `screens/rail.js:247` | The Patient Rail re-renders only on hashchange (rail.js:247); after Post on Checkout the open rail still reads Credit $0.00 while the canva… | 1 | fixed · A-screens-rail-1-5 |
| RC-237 | P1 | consistency | `screens/checkout.js:231` | Checkout takes the patient portion from the S.estimates literal (seed.js:132) and never re-derives it from the ledger: a-1047 still foots "… | 1 | fixed · A-screens-checkout-1-5 |
| RC-238 | P1 | consistency | `store.js:258` | matchVariance sets rr.state = "tied" but records no settlement against the bank line, so Hillsboro reads "Tied · independent" while its Car… | 1 | fixed · A-store-2-7 |
| RC-243 | P1 | consistency | `screens/checkout.js:9` | Two copies of the attachment-CDT table drift (board.js:18 includes d7210, checkout.js:9 does not): a filed D7210 is "Needs: attachment" on … | 1 | fixed · A-screens-checkout-1-6 |
| RC-56 | P2 | operational | `screens/shell.js:103` | Single pointTimer: earlier show-me ring never clears | 1 | fixed · A-screens-shell-2 |
| RC-57 | P2 | consistency | `screens/shell.js:52` | Andon count filters by entitlement/requester while phone lists every card | 3 | fixed · A-screens-shell-3 |
| RC-58 | P2 | operational | `screens/shell.js:38` | Privacy/theme toggles rebuild top bar and re-render without restoring focus | 2 | fixed · A-screens-shell-4 |
| RC-59 | P2 | operational | `screens/signin.js:12` | Sign-in paint() replaceChildren drops focus | 1 | fixed · A-misc-1-10 |
| RC-60 | P2 | operational | `screens/shell.js:94` | Rail Hide/Show toggle drops focus | 1 | fixed · A-screens-shell-5 |
| RC-61 | P2 | clarity | `screens/shell.js:69` | PIN pad verbs noun-first | 1 | fixed · A-screens-shell-6 |
| RC-62 | P2 | operational | `router.js:13` | router decodeURIComponent unguarded; malformed escape throws in all listeners | 1 | fixed · A-misc-1-7 |
| RC-63 | P2 | clarity | `store.js:134` | needs_second verb interpolates approver list; 9 tokens | 1 | refuted |
| RC-64 | P2 | operational | `store.js:137` | decideApproval has no already_decided guard; re-posts write-off | 2 | fixed · A-store-2-9 |
| RC-65 | P2 | operational | `store.js:296` | RAIL_STEPS save/find never retired | 1 | fixed · A-store-2-10 |
| RC-66 | P2 | operational | `store.js:37` | balances() counts every charge as patientDue with insurancePending only from submitted/pended claims; covered visit shows $183 | 1 | fixed · A-store-3-1 |
| RC-67 | P2 | consistency | `seed.js:24` | Seed threshold $150 vs decision card $300; Tighten/Retire copy disagrees | 2 | fixed · A-seed-2 |
| RC-68 | P2 | consistency | `seed.js:209` | statementsDue amounts do not match ledgers | 1 | fixed · A-seed-3 |
| RC-69 | P2 | operational | `store.js:101` | Approval row written at Post; 'Request approval' is a no-op | 2 | fixed · A-store-3-2 |
| RC-70 | P2 | clarity | `store.js:259` | clear_not_independent: 12-13 word noun-first verb, control null | 2 | fixed · A-store-3-3 |
| RC-71 | P2 | consistency | `screens/encounter.js:366` | Encounter re-mount after mutations finds no focus target (File, Undo, Dismiss, Move to plan, Use chart tooth, fixes) _(known, docs/14)_ | 3 | fixed · A-screens-encounter-1-8 |
| RC-72 | P2 | operational | `screens/board.js:96` | Call lab / Sign out change boardUi with no write event | 1 | fixed · A-screens-board-1-6 |
| RC-73 | P2 | consistency | `screens/board.js:224` | Outage Board still offers Checkout on Filed-later queue row | 1 | fixed · A-screens-board-1-7 |
| RC-74 | P2 | clarity | `screens/board.js:263` | 'Median ready -> filed today: 22 min' literal | 1 | fixed · A-screens-board-1-8 |
| RC-75 | P2 | clarity | `screens/board.js:73` | Seat moves focus to chair strip | 1 | fixed · A-screens-board-1-9 |
| RC-76 | P2 | clarity | `screens/board.js:157` | Raw lab id 'lab-op3' on card | 1 | fixed · A-screens-board-1-10 |
| RC-77 | P2 | consistency | `screens/chairs.js:32` | Chairs fmtTime drops meridiem; three time formats across screens | 2 | fixed · A-screens-chairs-4 |
| RC-78 | P2 | consistency | `seed.js:55` | Seed puts guardian's full name in alert text; Chairs and rail print it under privacy | 2 | fixed · A-seed-4 |
| RC-79 | P2 | clarity | `screens/chairs.js:107` | Ready-for-exam announcement two sentences | 1 | fixed · A-screens-chairs-5 |
| RC-80 | P2 | consistency | `screens/chairs.js:146` | Chairs .why/.rail/chairs.empty.board not in s4 | 1 | fixed · A-screens-chairs-6 |
| RC-81 | P2 | consistency | `screens/chairs.js:16` | Eligibility/unfiled/exam-requested/recall vocab varies across Chairs, Board, rail | 1 | fixed · A-screens-chairs-7 |
| RC-82 | P2 | clarity | `screens/chairs.js:183` | Literal 'Chairs . mine' while mine() returns all hygiene chairs for non-hygienists | 1 | fixed · A-screens-chairs-8 |
| RC-83 | P2 | consistency | `screens/chairs.js:99` | Chairs outage verb noun-first | 1 | fixed · A-screens-chairs-9 |
| RC-84 | P2 | consistency | `ui.js:52` | Proto.ui.refusal has no glyph; severity is border colour only _(known, docs/14)_ | 6 | fixed · A-ui-5 |
| RC-85 | P2 | clarity | `screens/checkout.js:194` | Raw ids/codes on Checkout posted card and announcements | 2 | fixed · A-screens-checkout-1-7 |
| RC-86 | P2 | consistency | `screens/checkout.js:10` | Reason-code/decision wording differs across Checkout, Phone, store | 2 | fixed · A-screens-checkout-1-8 |
| RC-87 | P2 | operational | `screens/dailyclose.js:232` | Practice health score/levers literal | 1 | fixed · A-screens-dailyclose-1-4 |
| RC-88 | P2 | operational | `screens/dailyclose.js:276` | Risk row Renew/Assign/Start write nothing and re-announce | 1 | fixed · A-screens-dailyclose-1-5 |
| RC-89 | P2 | clarity | `screens/dailyclose.js:222` | Daily Close announcements multi-sentence | 1 | fixed · A-screens-dailyclose-1-6 |
| RC-90 | P2 | clarity | `screens/dailyclose.js:194` | Entitlement codes, raw decision id, table name in exception rows | 1 | fixed · A-screens-dailyclose-1-7 |
| RC-91 | P2 | clarity | `screens/dailyclose.js:218` | Policy prose on Close day confirm path and approvals section | 2 | fixed · A-screens-dailyclose-2-1 |
| RC-92 | P2 | operational | `screens/encounter.js:60` | mount() restores focus by testid across encounters; blur fires killer strip on new encounter | 1 | fixed · A-screens-encounter-1-9 |
| RC-93 | P2 | operational | `screens/encounter.js:25` | Exams list practice line, BWX chip, wait minutes are literals | 3 | fixed · A-screens-encounter-1-10 |
| RC-94 | P2 | consistency | `screens/encounter.js:110` | Encounter vocab drift: Sign vs File, not-found headings, tooth_required verbs, patient identity | 1 | fixed · A-screens-encounter-2-1 |
| RC-95 | P2 | consistency | `screens/encounter.js:120` | enc.back reversible on not-found, quiet on live encounter | 1 | fixed · A-screens-encounter-2-2 |
| RC-96 | P2 | operational | `store.js:215` | chartPaint flips tag disposition with no tags write event | 1 | fixed · A-store-3-4 |
| RC-97 | P2 | operational | `store.js:234` | fileNote accepts second filing of a signed encounter | 1 | fixed · A-store-3-5 |
| RC-98 | P2 | clarity | `screens/moneydesk.js:125` | Element.append(null) renders 'null' text twice in Open balances card | 1 | fixed · A-screens-moneydesk-1-6 |
| RC-99 | P2 | clarity | `screens/moneydesk.js:224` | Money Desk announcements multi-sentence with raw ids | 1 | fixed · A-screens-moneydesk-1-7 |
| RC-100 | P2 | clarity | `screens/moneydesk.js:49` | Tab badges count finished rows on Statements/Denials but 0 on ERA | 2 | fixed · A-screens-moneydesk-1-8 |
| RC-102 | P2 | consistency | `screens/moneydesk.js:243` | Bare P and A keys execute Post matched and buildAppeal with no gate | 2 | fixed · A-screens-moneydesk-1-9 |
| RC-103 | P2 | operational | `screens/palette.js:173` | Palette routes to money without a tab; lands on last-used tab | 2 | fixed · A-screens-palette-1-3 |
| RC-104 | P2 | clarity | `screens/palette.js:194` | Gated palette rows say 'opens its gate' but only navigate | 1 | fixed · A-screens-palette-1-4 |
| RC-105 | P2 | operational | `screens/palette.js:159` | Home/End move highlight not focus; Enter opens focused row | 1 | fixed · A-screens-palette-1-5 |
| RC-106 | P2 | consistency | `screens/palette.js:247` | Chart open writes event for nonexistent phiAccessLog table | 1 | fixed · A-screens-palette-1-6 |
| RC-107 | P2 | consistency | `screens/palette.js:263` | confirmDob swapGo replaces focused button; focus to body | 1 | fixed · A-screens-palette-1-7 |
| RC-108 | P2 | consistency | `screens/palette.js:70` | renderSearch never focuses the new input (steer rows, Back) | 1 | fixed · A-screens-palette-1-8 |
| RC-109 | P2 | consistency | `app.js:33` | router.render() on unchanged path never sets focus | 2 | fixed · A-misc-1-5 |
| RC-110 | P2 | consistency | `screens/rail.js:47` | rail.open() never takes focus; palette chart open leaves focus on Search | 2 | fixed · A-screens-rail-1-6 |
| RC-111 | P2 | operational | `screens/perio.js:320` | Perio rerender returns early when active element has no testid; first key / Start addendum drop focus | 1 | fixed · A-screens-perio-1-6 |
| RC-112 | P2 | operational | `screens/perio.js:173` | pin_required/screening_incomplete gates rerender without focusing the control | 1 | fixed · A-screens-perio-1-7 |
| RC-113 | P2 | consistency | `screens/perio.js:363` | Sticky glove pad covers grid cells incl. active cell | 1 | fixed · A-screens-perio-1-8 |
| RC-114 | P2 | operational | `screens/perio.js:342` | Screening lane pad toggle shows pressed but pad renders only in full mode | 1 | fixed · A-screens-perio-1-9 |
| RC-115 | P2 | clarity | `screens/perio.js:341` | Segments stay live after save; silent no-op | 1 | fixed · A-screens-perio-1-10 |
| RC-116 | P2 | clarity | `screens/perio.js:338` | Screening lane shows full-chart key hints and legend | 1 | fixed · A-screens-perio-2-1 |
| RC-117 | P2 | consistency | `screens/perio.js:98` | depth_gt_15 verb 9 words; it and exam_sealed noun-first _(known, docs/14)_ | 1 | fixed · A-screens-perio-2-2 |
| RC-118 | P2 | consistency | `screens/perio.js:302` | Perio vocab drift saved/filed, licence/reason, bleed terms, skip/not probed | 3 | fixed · A-screens-perio-2-3 |
| RC-119 | P2 | consistency | `screens/perio.js:335` | Unknown encounter renders perio-local not-found page | 1 | fixed · A-screens-perio-2-4 |
| RC-120 | P2 | consistency | `screens/perio.js:172` | Perio author gate checks only device==='shared'; frontdesk saves exam on desk | 1 | fixed · A-screens-perio-2-5 |
| RC-121 | P2 | clarity | `screens/perio.js:181` | doSave sets tagTooth to deepest tooth | 1 | fixed · A-screens-perio-2-6 |
| RC-122 | P2 | operational | `screens/perio.js:176` | Omission gate costs four taps vs s7 budget of one | 1 | fixed · A-screens-perio-2-7 |
| RC-123 | P2 | operational | `screens/phone.js:71` | openStepup/onDecline rerender with no focus id | 1 | fixed · A-screens-phone-1-5 |
| RC-124 | P2 | consistency | `prototype/css/components.css:442` | .pinpad 64px columns vs 72px min-width at <=640px; keys touch | 1 | fixed · A-misc-1-3 |
| RC-125 | P2 | operational | `screens/phone.js:197` | Phone empty-state figures literal | 1 | fixed · A-screens-phone-1-6 |
| RC-126 | P2 | clarity | `screens/phone.js:204` | Internal wording: 'signature moment 2', 'CHECK requester_id <> second_approver_id.' | 1 | fixed · A-screens-phone-1-7 |
| RC-127 | P2 | clarity | `screens/shell.js:73` | Refusal names Dana but personaUser map lacks Dana; her PIN refused | 1 | fixed · A-screens-shell-7 |
| RC-128 | P2 | operational | `screens/rail.js:73` | renderRail replaces children; summary tabs drop focus | 1 | fixed · A-screens-rail-1-7 |
| RC-129 | P2 | operational | `screens/rail.js:165` | Explain Rows rerender without focus testid | 1 | fixed · A-screens-rail-1-8 |
| RC-130 | P2 | clarity | `screens/rail.js:61` | Rail tab announcements are prose summaries | 1 | fixed · A-screens-rail-1-9 |
| RC-131 | P2 | consistency | `screens/rail.js:103` | Last filed note shows raw ISO timestamp | 1 | fixed · A-screens-rail-1-10 |
| RC-132 | P2 | consistency | `screens/rail.js:30` | Ledger view state led[pid] survives persona switch | 1 | fixed · A-screens-rail-1-11 |
| RC-133 | P2 | consistency | `screens/rail.js:58` | Rail button aria-pressed only computed at host render; stays false | 1 | fixed · A-screens-rail-2-1 |
| RC-134 | P2 | operational | `screens/rail.js:120` | At 420px open rail is 895px tall; canvas 32px | 1 | fixed · A-screens-rail-2-2 |
| RC-140 | P2 | clarity | `ui.js:65` | initials() counts honorific: Dr. Hana Kim -> 'DH' | 2 | fixed · A-ui-6 |
| RC-148 | P2 | clarity | `screens/board.js:262` | First Arrive 1062px down on tablet _(known, docs/14)_ | 2 | fixed · A-screens-board-2-1 |
| RC-163 | P2 | clarity | `screens/encounter.js:315` | Internal nouns and raw ids on Encounter screen _(known, docs/14)_ | 3 | fixed · A-screens-encounter-2-3 |
| RC-178 | P2 | clarity | `screens/perio.js:185` | Announcements are prose across screens: 55 of 121 distinct aria-live texts are two or more sentences (Perio save 34 words; Andon 15 words w… | 3 | fixed · A-screens-perio-2-8 |
| RC-201 | P2 | clarity | `screens/roles.js:143` | One SoD gate renders two refusal groups and five controls: the preview gate (Remediate + Remediate/Compensate/Accept buttons) and the store… | 1 | fixed · A-screens-roles-4 |
| RC-202 | P2 | clarity | `screens/roles.js:238` | Closing the day-pass form resets nothing: values, pressed role/location/extras, preview and touched flags survive close/reopen, so the hint… | 2 | fixed · A-screens-roles-5 |
| RC-204 | P2 | consistency | `screens/roles.js:18` | Roles vocabulary variants: Issue day pass / Save / Add day pass / Close day pass form; "Write off" (ENT_LABEL) vs write-off everywhere else… | 2 | fixed · A-screens-roles-6 |
| RC-206 | P2 | clarity | `screens/roles.js:64` | Roles decisionFor/grantsPanel print entitlement codes ("post_payment + refund") and the raw decision id ("control decision d-0"); the same … | 2 | fixed · A-screens-roles-7 |
| RC-214 | P2 | consistency | `screens/perio.js:172` | One refusal code carries different verb lines and controls on different screens: pin_required ("Enter your PIN" vs "Switch author to the hy… | 1 | fixed · A-screens-perio-2-9 |
| RC-218 | P2 | consistency | `screens/board.js:94` | Id segments synthesised in UI code, not the seed: board.readiness.row.{elig,device,temp} and risk.row.{baa-lab,training,logreview,audit,clo… | 1 | fixed · A-screens-board-2-2 |
| RC-219 | P2 | consistency | `screens/checkout.js:167` | checkout.writeoff.add is reused for the "Remove write-off" control, so the control segment names the opposite action | 1 | fixed · A-screens-checkout-1-9 |
| RC-222 | P2 | consistency | `screens/board.js:197` | The same room is "Op 1" (column h2), "Operatory 1" (region aria-label) and "Chair 1" (chair strip, Chairs, Exams, Rail, announcements) | 1 | fixed · A-screens-board-2-3 |
| RC-223 | P2 | clarity | `screens/phone.js:80` | "Re-verify" names the eligibility re-check on the Board and Rail and the PIN challenge on the phone step-up; the amber chip says "Verify" b… | 1 | fixed · A-screens-phone-2-1 |
| RC-224 | P2 | consistency | `screens/perio.js:172` | The control that opens the PIN pad is "Switch author" (Encounter, Phone, dialog aria-label) but "Who is charting?" (Perio pin_required cont… | 1 | fixed · A-screens-perio-2-10 |
| RC-225 | P2 | consistency | `screens/dailyclose.js:115` | Chip words drift to lowercase on Daily Close ("tied", "gap −$312.40", "critical", "high", "directional"), Practice risk ("past review", "du… | 1 | fixed · A-screens-dailyclose-2-2 |
| RC-226 | P2 | consistency | `ui.js:51` | Proto.ui.refusal announces verb + ". " + control label, so every gate is read as two lines and a verb ending in a period is announced with … | 1 | fixed · A-ui-7 |
| RC-232 | P2 | consistency | `store.js:75` | store.write() logs appended rows only: 23 of 41 driven steps edit a row in place (appointments, eraLines, tags, reconciliation, variances, … | 1 | fixed · A-store-3-6 |
| RC-234 | P2 | consistency | `screens/shell.js:84` | Two PIN pads, two keyboard grammars: the author pad (shell.js) ignores typed digits; the phone step-up accepts them but Enter on the landin… | 1 | fixed · A-screens-shell-8 |
| RC-239 | P2 | consistency | `screens/board.js:98` | The Board readiness row "Tomorrow: front desk has no coordinator" tests !s.dayPasses.length, so any pass (an RDH pass for Hillsboro) clears… | 1 | fixed · A-screens-board-2-4 |
| RC-240 | P2 | consistency | `store.js:30` | The Temp persona signs in as a literal default user ("Alex Rivera · Front desk", post_payment) with no day pass in the store; Roles never l… | 1 | fixed · A-store-3-7 |
| RC-244 | P2 | consistency | `store.js:60` | store.explain mixes longDate and shortDate in one sentence, and fileNote stores filedAt as "today + time" ISO text that Encounter and the R… | 1 | fixed · A-store-3-8 |
| RC-247 | P2 | clarity | `screens/encounter.js:123` | The Encounter h1 is the patient's name in all 48 states; the place ("Encounter"/"Exam") appears nowhere in the heading | 1 | fixed · A-screens-encounter-2-4 |
| RC-248 | P2 | clarity | `screens/checkout.js:247` | Finish controls below the fold: checkout.post and close.closeday at every width (desk 1098/1190 px vs 900), enc.file and ledger.statement.s… | 1 | fixed · A-screens-checkout-2-1 |
| RC-250 | P2 | clarity | `screens/board.js:232` | renderQueue has one empty-state literal, "Nobody is out of the chair yet.", shown after every patient is checked out and every note filed | 1 | fixed · A-screens-board-2-5 |
| RC-251 | P2 | consistency | `screens/perio.js:55` | Perio skipped-site count disagrees: gate says 165 sites not probed, the licence chooser it opens asks "Why were 0 sites not probed?" (skipp… | 1 | fixed · A-screens-perio-3-1 |
| RC-135 | P3 | consistency | `screens/shell.js:78` | Author switch logs write to nonexistent 'sessions' table | 1 | fixed · A-screens-shell-9 |
| RC-136 | P3 | operational | `ui.js:59` | ui formatters mis-handle null/undefined and datetime shape | 1 | fixed · A-ui-8 |
| RC-137 | P3 | consistency | `app.js:18` | __proto.reset() drops store outage flag while Andon still says read-only | 1 | fixed · A-misc-1-6 |
| RC-138 | P3 | clarity | `screens/shell.js:33` | Top-bar announcements prose | 1 | fixed · A-screens-shell-10 |
| RC-139 | P3 | consistency | `screens/shell.js:38` | Privacy/theme control vocab drift | 1 | fixed · A-screens-shell-11 |
| RC-141 | P3 | consistency | `seed.js:131` | Samir estimate $168 vs s8 $180 | 1 | fixed · A-seed-5 |
| RC-142 | P3 | clarity | `screens/shell.js:61` | PIN pad hint warns about wiped drafts before first digit | 1 | fixed · A-screens-shell-12 |
| RC-143 | P3 | consistency | `ui.js:33` | ui.btn drops dataset option; chips never get data-retired | 1 | fixed · A-ui-9 |
| RC-144 | P3 | consistency | `store.js:82` | Store mutations throw on unknown ids and accept impossible inputs | 1 | fixed · A-store-3-9 |
| RC-145 | P3 | consistency | `screens/board.js:184` | Board .rail/.queue.why/.readiness.handled ids not in s4 | 1 | fixed · A-screens-board-2-6 |
| RC-146 | P3 | consistency | `screens/board.js:40` | Readiness strip collapsed flag global | 2 | fixed · A-screens-board-2-7 |
| RC-147 | P3 | consistency | `screens/board.js:259` | Board h1 date literal | 1 | fixed · A-screens-board-2-8 |
| RC-149 | P3 | operational | `screens/chairs.js:40` | monthsAgo throws on null, NaN on non-ISO | 1 | fixed · A-screens-chairs-10 |
| RC-150 | P3 | consistency | `screens/checkout.js:229` | Checkout-local not-found page | 2 | fixed · A-screens-checkout-2-2 |
| RC-151 | P3 | clarity | `screens/checkout.js:154` | Policy prose on Checkout Payment card and write-off hint | 1 | fixed · A-screens-checkout-2-3 |
| RC-152 | P3 | clarity | `screens/checkout.js:73` | Checkout announcements prose with plural slip | 1 | fixed · A-screens-checkout-2-4 |
| RC-153 | P3 | consistency | `screens/checkout.js:114` | Self-pay toggles/estimate off-edge at 420px | 1 | refuted |
| RC-154 | P3 | consistency | `screens/checkout.js:18` | dollars() ASCII hyphen vs money() minus | 2 | fixed · A-screens-checkout-2-6 |
| RC-155 | P3 | clarity | `screens/checkout.js:120` | Empty procedures state gives no next step | 1 | fixed · A-screens-checkout-2-7 |
| RC-156 | P3 | consistency | `screens/dailyclose.js:188` | Daily Close vocab: Open phone card/Open approvals; Cancel/Close/Back | 2 | fixed · A-screens-dailyclose-2-3 |
| RC-157 | P3 | consistency | `screens/dailyclose.js:176` | Mixed date formats in Daily Close card/list | 1 | fixed · A-screens-dailyclose-2-4 |
| RC-158 | P3 | operational | `screens/dailyclose.js:36` | Daily Close helpers throw on null | 1 | fixed · A-screens-dailyclose-2-5 |
| RC-159 | P3 | clarity | `screens/dailyclose.js:133` | Match/Keep text hardcode Hillsboro, basis, 12/2 | 1 | fixed · A-screens-dailyclose-2-6 |
| RC-160 | P3 | operational | `screens/dailyclose.js:276` | Risk row numbers literal | 1 | fixed · A-screens-dailyclose-2-7 |
| RC-161 | P3 | consistency | `screens/encounter.js:180` | Charted tooth state is border colour alone | 1 | fixed · A-screens-encounter-2-5 |
| RC-162 | P3 | operational | `screens/encounter.js:40` | shortName(undefined) renders 'undefined' | 1 | fixed · A-screens-encounter-2-6 |
| RC-164 | P3 | clarity | `screens/encounter.js:225` | Encounter announcements multi-sentence | 1 | fixed · A-screens-encounter-2-7 |
| RC-165 | P3 | consistency | `screens/encounter.js:319` | Four date shapes on Encounter | 1 | fixed · A-screens-encounter-2-8 |
| RC-166 | P3 | clarity | `screens/encounter.js:200` | Policy prose on Encounter finish path | 1 | fixed · A-screens-encounter-2-9 |
| RC-167 | P3 | consistency | `screens/encounter.js:125` | enc.back/rail/tag.reason/plan.why not in s4 | 1 | fixed · A-screens-encounter-2-10 |
| RC-168 | P3 | operational | `screens/moneydesk.js:81` | '37' literal in Post matched helper and Why | 1 | fixed · A-screens-moneydesk-2-1 |
| RC-169 | P3 | clarity | `screens/moneydesk.js:79` | Raw seed ids in Money Desk text | 1 | fixed · A-screens-moneydesk-2-2 |
| RC-170 | P3 | consistency | `screens/moneydesk.js:100` | Money Desk vocab variants | 1 | fixed · A-screens-moneydesk-2-3 |
| RC-171 | P3 | clarity | `screens/moneydesk.js:78` | Plural drift '1 deltas', '1 items' | 2 | fixed · A-screens-moneydesk-2-4 |
| RC-172 | P3 | consistency | `screens/moneydesk.js:244` | W key after posting re-renders to missing field; focus to body | 1 | fixed · A-screens-moneydesk-2-5 |
| RC-173 | P3 | clarity | `screens/palette.js:115` | '8 results' hides store's silent cap | 1 | fixed · A-screens-palette-2-1 |
| RC-174 | P3 | clarity | `screens/palette.js:112` | 'Your last three' with one recent | 1 | fixed · A-screens-palette-2-2 |
| RC-175 | P3 | clarity | `screens/palette.js:91` | 'How search works' promises DOB/last-4 rows show neither | 1 | fixed · A-screens-palette-2-3 |
| RC-176 | P3 | operational | `screens/palette.js:48` | parseDob accepts 02/30, 04/31 | 1 | fixed · A-screens-palette-2-4 |
| RC-177 | P3 | consistency | `screens/palette.js:259` | 'Date of birth does not match' noun-first | 1 | fixed · A-screens-palette-2-5 |
| RC-179 | P3 | clarity | `screens/perio.js:302` | Raw ids on perio saved card / not-found | 1 | fixed · A-screens-perio-3-2 |
| RC-180 | P3 | clarity | `screens/perio.js:211` | Shared tagTouched marks untouched Observation invalid | 2 | fixed · A-screens-perio-3-3 |
| RC-181 | P3 | consistency | `screens/perio.js:308` | Clear Recall chip beside 'Full chart due' | 1 | fixed · A-screens-perio-3-4 |
| RC-182 | P3 | clarity | `screens/perio.js:282` | 'Tag for Dr. Kim' literal fallback | 1 | fixed · A-screens-perio-3-5 |
| RC-183 | P3 | clarity | `screens/perio.js:364` | Settings drawer below fold | 1 | fixed · A-screens-perio-3-6 |
| RC-184 | P3 | consistency | `screens/phone.js:169` | Phone vocab: Decline/Send back/Sent back/declined; Approvals variants | 1 | fixed · A-screens-phone-2-2 |
| RC-185 | P3 | consistency | `screens/phone.js:151` | Two time formats on one phone card | 1 | fixed · A-screens-phone-2-3 |
| RC-186 | P3 | consistency | `screens/phone.js:205` | Literal '$410' in Simulate label | 1 | fixed · A-screens-phone-2-4 |
| RC-187 | P3 | consistency | `screens/phone.js:145` | Six Phone testids not in s4 | 1 | fixed · A-screens-phone-2-5 |
| RC-188 | P3 | operational | `screens/phone.js:184` | Unknown /phone id renders Approvals | 1 | fixed · A-screens-phone-2-6 |
| RC-189 | P3 | clarity | `screens/phone.js:58` | Step-up dialog policy prose on open | 1 | fixed · A-screens-phone-2-7 |
| RC-190 | P3 | consistency | `screens/rail.js:224` | Send to biller reversible vs other Sends irreversible | 1 | fixed · A-screens-rail-2-3 |
| RC-191 | P3 | operational | `screens/rail.js:156` | Ledger Amount column off-edge at 420px | 1 | refuted |
| RC-192 | P3 | clarity | `screens/rail.js:139` | Raw ids and GL codes on ledger/rail | 1 | fixed · A-screens-rail-2-5 |
| RC-193 | P3 | clarity | `screens/rail.js:119` | Rail Explain empty block; empty states lack next step | 2 | fixed · A-screens-rail-2-6 |
| RC-194 | P3 | consistency | `screens/rail.js:213` | Ledger-local not-found page | 1 | fixed · A-screens-rail-2-7 |
| RC-195 | P3 | consistency | `screens/rail.js:29` | openClaims excludes 'scrubbed'; rail says none open after filing | 1 | fixed · A-screens-rail-2-8 |
| RC-196 | P3 | clarity | `screens/rail.js:202` | As-of announcement '1 rows' | 1 | fixed · A-screens-rail-2-9 |
| RC-205 | P3 | consistency | `screens/roles.js:64` | Two date formats in adjacent Roles chips: "review 10/1" (shortDate) vs "expires 6/30/2027" (longDate); prose "10/1/2026"; issued chip liter… | 1 | fixed · A-screens-roles-8 |
| RC-207 | P3 | clarity | `screens/roles.js:211` | Policy prose on the Roles finish path: four explanatory paragraphs around Issue day pass, not behind Why | 1 | fixed · A-screens-roles-9 |
| RC-208 | P3 | clarity | `screens/roles.js:110` | Remediate on one conflict strips every offending extra (Refund and Write off) and announces "Extra entitlement removed" in the singular | 1 | fixed · A-screens-roles-10 |
| RC-221 | P3 | consistency | `screens/palette.js:90` | The "how this was derived" disclosure is .why on fifteen ids but palette.how, perio.settings.grammar and board.readiness.handled elsewhere;… | 1 | fixed · A-screens-palette-2-6 |
| RC-227 | P3 | consistency | `screens/palette.js:88` | Dialogs are dismissed by "Cancel" (PIN pad, step-up), "Close" (search) and "Close preview" (statement preview) | 1 | fixed · A-screens-palette-2-7 |
| RC-228 | P3 | consistency | `screens/moneydesk.js:217` | Statement send verb and done-word differ: "Send statement" / "Sent" on Ledger and Checkout, "Send" / "Statement sent" on Money Desk | 1 | fixed · A-screens-moneydesk-2-6 |
| RC-229 | P3 | consistency | `screens/checkout.js:219` | The patient-voice toggle swaps its label to "Show staff" on Checkout but stays "Show patient" (aria-pressed) on Ledger | 1 | fixed · A-screens-checkout-2-8 |
| RC-230 | P3 | consistency | `screens/board.js:224` | "Filed later" (chip, lane) vs "Filed-later lane" (prose); "Front-desk coordinator" (sign-in) vs "Front desk" (Roles, gates) | 1 | fixed · A-screens-board-2-9 |
| RC-235 | P3 | consistency | `screens/perio.js:274` | The four inline confirm/forms (Close day confirm, perio licence chooser, perio tag form, day-pass form) ignore Escape and let Tab walk out;… | 1 | fixed · A-screens-perio-3-7 |
| RC-241 | P3 | consistency | `screens/moneydesk.js:123` | Eligible second approvers render three ways: three names on the phone card, two in the needs_second verb (store.js:134 slices), and a liter… | 1 | fixed · A-screens-moneydesk-2-7 |
| RC-242 | P3 | clarity | `screens/moneydesk.js:109` | Money Desk Open balances appends the literal "patient portion outstanding since 9/1" to a computed amount, so it reads "$0.00 open … outsta… | 1 | fixed · A-screens-moneydesk-2-8 |
| RC-245 | P3 | clarity | `screens/perio.js:18` | Dead code: perio MEANING table is unreferenced (its meanings are re-typed inline with different wording); palette.isOpen and rail.render ar… | 1 | fixed · A-screens-perio-3-8 |
| RC-246 | P3 | consistency | `screens/rail.js:93` | Two months-ago implementations (chairs.monthsAgo calendar months vs rail.js:93 days/30.44) disagree by a month on ordinary dates; the seed … | 1 | fixed · A-screens-rail-2-10 |
| RC-249 | P3 | clarity | `screens/chairs.js:150` | Rows without one primary verb: Board queue rows carry two equal actions (Ping chair, Checkout), Chairs cards two nouns (Perio, Note), in-ch… | 1 | fixed · A-screens-chairs-11 |

### Every function

One row per function in `prototype/js`, in file order. Status is the audited state; "broken → fixed" means every root cause behind the row was reproduced and fixed in this round, with its check named in the root-cause table. Evidence is the auditor's own measurement, clipped; the full text is in the audit's result files under `knowledge/reviews/function-audit/`. Line is re-read from `scripts/audit/inventory.mjs` each time this table is reconciled with the code, so it names where the function stands now, not where the auditor found it. Rows added after the four storms of 2026-09-10 carry the storm check ids that drive the function under Reached by, and under Evidence a clause naming what it does and the finding it answers.

| Function | File | Line | Status | Reached by | Evidence |
|---|---|---|---|---|---|
| `applyQuery` | `app.js` | 40 | operational | Every route load with a query string (app.js render → applyQuery). | raw.json S1-app.applyQuery.*: __proto {theme:dark, device:phone, outage:true, privacy:true, motion:reduced, g… |
| `focusHead` | `app.js` | 47 | operational | A-storm3-shell-4, A-storm2-shell-5 | Puts the keyboard on the canvas h1 (tabindex −1) after a same-path repaint; skipped while a dialog stands, so a flag set under the pad never lands focus on the hidden heading |
| `repaintCanvas` | `app.js` | 50 | operational | A-storm2-shell-4, A-storm2-shell-5, A-storm3-shell-4 | Re-renders the route for __proto.set/reset and lands focus in the top dialog or on the heading, never body; set({outage}) now repaints the Andon and the canvas together |
| `render` | `app.js` | 56 | operational | window hashchange and boot. | raw.json S2-routes.summary {combos:1096, withErrors:0, bodyFocus:0, h1CountNot1:0}; focus after route change … |
| `ctx` | `events.js` | 9 | operational | Every record() call. | raw.json S10-events.ctxBeforePersona seq 1 {route:'/signin', persona:'none', theme:'light', device:'desk'}; e… |
| `record` | `events.js` | 19 | operational | click/keydown/focusin/hashchange/error listeners and Proto.events.write/refusal. | events.json: kinds {write,route,focus,error,click,refusal,key}; no non-monotonic context; 308 plain clicks, 1… |
| `testidOf` | `events.js` | 26 | operational | click/keydown/focusin listeners. | raw.json S10-events.testidOf: seq 3 click testid 'signin.persona.owner'; seq 4 click with no testid field. En… |
| `refusal` | `events.js` | 58 | operational | Proto.ui.refusal (ui.js:50) on every gate; page.evaluate. | events.json S5-pin-desk seq 39, 47 {kind:'refusal', code:'pin_no_match', verb, control:'Clear and retype'}, s… |
| `write` | `events.js` | 59 | operational | store.write on every mutation; shell.js:78 author switch; page.evaluate. | events.json S9-rail1-desk seq 12 {table:'appointmentEvents', id:'ae-1'}, seq 13 {table:'firstRunState', id:'f… |
| `reset` | `events.js` | 60 | operational | __proto.reset() (app.js:18); page.evaluate. | raw.json S1-app.reset.outage.after.eventsLen 0 and reset.state.seq 2 after two post-reset writes (seq restart… |
| `all` | `events.js` | 61 | operational | __proto.events(), store.retireChip (byEvent count), lib.events. | raw.json S10-events.api {isCopy:true, len:28} (all() !== window.__events, same length); S9 retire.railState b… |
| `parse` | `router.js` | 11 | broken → fixed | router.render/current on every render; page.evaluate for boundary inputs. | raw.json S3-router.parse: all ordinary/boundary cases correct ('#/biller' → route 'money' via HOME; bare 'pri… |
| `unescape` | `router.js` | 17 | operational | Internal to parse(); reached by every navigation carrying a query string | a malformed escape ("%E0%A4%A") now parses to "%E0%A4%A" and the rest of the query survives (ok=1, route=boar… |
| `go` | `router.js` | 29 | operational | nav.<route> buttons (shell.js:28), notfound.home, screen back buttons; page.evaluate for … | raw.json S3-router.go: nav click → hash #/frontdesk/money, h1 'Money Desk', aria-current=page on nav.money, o… |
| `on` | `router.js` | 38 | operational | 14 registrations at module load (grep router.on: board, phone, money, signin, exams, enco… | raw.json S2-routes.h1ByRoute: all 12 contract routes plus 'nope' → 'Nothing here'; withErrors 0 over 1096 com… |
| `render` | `router.js` | 39 | operational | app.js render, P.reset, screens' rerender(). | raw.json S2-routes.h1ByRoute: each route renders exactly one h1; 'nope' → 'Nothing here'. Handlers registered… |
| `current` | `router.js` | 46 | operational | app.js render, shell Ctrl+K handler, screens' rerender(), rail/palette hashchange listene… | raw.json S6-topbar-*.ctrlK {paletteOpen:true}; S2-routes summary withErrors 0. Inherits F-foundation-14: with… |
| `announce` | `router.js` | 47 | operational | Proto.ui.refusal, pulseFor, topbar.location, andon Support line, PIN switch, screens. | raw.json S3-router.announce 'Test line'; S4-ui.refusal.live '' immediately then liveAfter 'V. C' (verb + cont… |
| `S` | `screens/board.js` | 28 | operational | Every render and action on #/frontdesk/board. | evidence.json base.render {clock:'08:40', appts:25}; evidence2.json helpers.todaysCount=25, subCount='25'. |
| `P` | `screens/board.js` | 29 | operational | card(), queueRow(), renderReadiness(), onKey(). | evidence.json privacy.operatory cardText '9:00 am · MV◆Arrived', leaksText []; outage.render arriveButtons []… |
| `byTime` | `screens/board.js` | 30 | operational | todays().sort(byTime) in readinessRows, renderColumns, renderLane, renderQueue, onKey. | evidence2.json helpers.byTime {order:'a-3,a-1,a-2', equal:1, nullTime:-1}; evidence.json queue.rows order; ke… |
| `todays` | `screens/board.js` | 31 | operational | Every render section and onKey. | evidence2.json helpers.todaysCount 25 / subCount '25'; evidence.json base.render sub '… 25 appointments …'. |
| `minutesBetween` | `screens/board.js` | 34 | operational | card() under outage. | evidence.json outage.render stamps[0] 'As of 7:58 am · 42 min old · read-only'; evidence2.json helpers.minute… |
| `provInitials` | `screens/board.js` | 35 | operational | renderChairs, doSeat announcement, queueRow note chip. | evidence.json base.status.a-1043 chairs2 'Chair 2 · HKDDS'; seat.first chair1 'Chair 1 · BLRDH'; evidence2.js… |
| `noteFiled` | `screens/board.js` | 36 | operational | queueRow() Note/Claim chips and Ping visibility. | evidence2.json helpers.noteFiledFacts. |
| `needsAttachment` | `screens/board.js` | 39 | operational | queueRow() claim chip when the note is filed. | evidence.json queue.rows a-1047 '… Claim \| ◆ \| Needs: attachment'; evidence2.json needsAttachment.live {bef… |
| `windowDecision` | `screens/board.js` | 44 | operational | A-storm2-board-5 | The visit's collectionDecisions row, read for the Filed-later stamp instead of a fixed sentence |
| `paidAtWindow` | `screens/board.js` | 45 | operational | A-storm2-board-5, A-storm-store-10 | True only when the decision was Collect and an allocation intent waits for the visit; a Send statement with no payment no longer reads "Paid at the window" |
| `windowWord` | `screens/board.js` | 46 | operational | A-storm2-board-5 | The stamp word for a lane visit from its decision: Paid at the window, Statement due, Payment plan set up, Nothing due today, else Checked out |
| `uiState` | `screens/board.js` | 49 | operational | readinessRows, handledLines, renderReadiness. | evidence2.json helpers.boardUi '{collapsed:false,labCalled:null,deviceReset:null,eligRerun:0}'; evidence.json… |
| `frontDeskCover` | `screens/board.js` | 51 | operational | flow · check in and seat; surface · outage and after hours; surface · shell toggles | V8 recorded 44 executions across 5 driven legs (flow · check in and seat; surface · outage and after hours; s… |
| `weekday` | `screens/board.js` | 52 | operational | flow · check in and seat; surface · outage and after hours; surface · shell toggles | V8 recorded 11 executions across 5 driven legs (flow · check in and seat; surface · outage and after hours; s… |
| `outageRefusal` | `screens/board.js` | 53 | operational | surface · board outage gate and hold strip; surface · readiness row during an outage | V8 recorded 2 executions across 2 driven legs (surface · board outage gate and hold strip; surface · readines… |
| `syncStore` | `screens/board.js` | 55 | operational | render() → after window.__proto.reset(). | evidence.json syncStore.reset {expanded1042:'false', expanded1060:'false', eventsLen:0}. |
| `stale` | `screens/board.js` | 58 | operational | A-storm2-board-2, A-storm-board-1 | A gate is stale when its cause is gone: outage over, or the pass issued; read by pruneStaleGates on every render |
| `pruneStaleGates` | `screens/board.js` | 59 | operational | flow · check in and seat; surface · outage and after hours; surface · shell toggles | V8 recorded 11 executions across 5 driven legs (flow · check in and seat; surface · outage and after hours; s… |
| `dropGates` | `screens/board.js` | 67 | operational | A-storm2-board-14, A-storm2-shell-7 | Drops every standing gate of a code before a new one of that code is raised, so a second refused Arrive leaves one outage gate, not two |
| `after` | `screens/board.js` | 76 | operational | doArrive, doSeat, doReverify, doPing, readiness row actions. | evidence.json arrive.first focused board.card.a-1042.seat, seq 1-5; temp.rail.retire chipBefore 'Arrive' → ch… |
| `openRoles` | `screens/board.js` | 84 | operational | A-storm2-board-1, A-storm2-polish-1 | The "Open Roles" control routes to #/owner/roles, the seat that issues a pass, not the pass-less temp's own Roles |
| `gateFor` | `screens/board.js` | 88 | operational | doArrive/doSeat/doReverify when the store refuses. Store only refuses Arrive during outag… | evidence.json gate.arrive.outage seq 1-4 refusal seq 3; gate.arrive.outage.second refusal seq 6, refusalNodes… |
| `raise` | `screens/board.js` | 93 | operational | A-storm2-board-14, A-storm2-board-1 | Drops same-code gates then stores the wrapped refusal for a card or row; every code has a control that acts |
| `focusGate` | `screens/board.js` | 94 | operational | surface · board outage gate and hold strip; surface · readiness row during an outage | V8 recorded 2 executions across 2 driven legs (surface · board outage gate and hold strip; surface · readines… |
| `heldPress` | `screens/board.js` | 97 | operational | A-storm2-board-2, A-storm-board-7 | A press on a Held primary re-renders first: if the gate fell the press acts, else it lands on the gate's control |
| `doArrive` | `screens/board.js` | 100 | operational | board.card.<id>.arrive, key A, Proto.screens.board.arrive. | evidence.json arrive.first seq 1-5 writes [{seq:3,appointmentEvents,ae-1},{seq:4,firstRunState,frs-u-fd-1-arr… |
| `doSeat` | `screens/board.js` | 108 | operational | board.card.<id>.seat, key S, Proto.screens.board.seat. | evidence.json seat.first seq 9-13 writes ae-2, frs-u-fd-1-seat; focused board.chair.1; seat.second added 0. |
| `doReverify` | `screens/board.js` | 116 | operational | board.card.<id>.reverify; Proto.screens.board.reverify. | evidence.json reverify.card seq 1-4 write el-100; reverify.second.via.export writes el-101. |
| `goCheckout` | `screens/board.js` | 125 | operational | board.card.<id>.checkout, board.queue.row.<id>.checkout, key C. | evidence.json card.checkout, queue.checkout.unfiled, queue.checkout.filed, key.c (seq 10-11). |
| `doPing` | `screens/board.js` | 133 | broken → fixed | board.queue.row.<id>.ping. | evidence.json ping.first seq 1-4 write msg-1; ping.second refusal seq 7; ping.refusal.control.click seq 9-10 … |
| `holdStrip` | `screens/board.js` | 144 | operational | surface · readiness row during an outage | V8 recorded 1 execution across 1 driven leg (surface · readiness row during an outage) |
| `readinessRows` | `screens/board.js` | 148 | broken → fixed | renderReadiness. | evidence.json readiness.rows; readiness.reverifyAll seq 7-10 write el-102; readiness.callLab seq 11-13 writes… |
| `reverifyAll` | `screens/board.js` | 151 | operational | A-storm2-board-4 | Counts only the re-runs the store accepted; when every one was refused the refusal shows instead of "Re-ran 2 eligibility checks: all active" |
| `handledLines` | `screens/board.js` | 168 | operational | renderReadiness when rows are empty (all four handled; day pass added via store). | evidence.json readiness.handled handledLines ['1 eligibility check re-run','Called Ridge Lab · 8:40 am','Tabl… |
| `renderReadiness` | `screens/board.js` | 176 | operational | render(). | evidence.json readiness.toggle.hide/show; readiness.toggle.otherPersona bodyHidden true under temp; outage.re… |
| `renderChairs` | `screens/board.js` | 204 | operational | render(); board.chair.<n>. | evidence.json seat.first chair1; chair.open/chair.close/chair3.open. |
| `details` | `screens/board.js` | 220 | operational | board.card.<id>.expand. | evidence.json expand.a-1044, arrive.first.details, expand.a-1060, expand.lab; evidence2.json c5.a-1044/a-1046… |
| `card` | `screens/board.js` | 234 | operational | renderColumns, renderLane. | evidence.json base.arrive.identity, expand.a-1044, collapse.a-1044, rail.button, outage.render, privacy.opera… |
| `held` | `screens/board.js` | 242 | operational | A-storm2-board-2, A-storm-board-7 | Wraps each card action so a Held press goes through heldPress for that card's gate; Re-verify under the outage switches to Held like Arrive and Seat |
| `renderColumns` | `screens/board.js` | 270 | operational | render(). | evidence.json a7.counts op3Count '7 today', laneCards ['board.card.a-1050','board.card.a-1044']. |
| `renderLane` | `screens/board.js` | 280 | operational | render(). | evidence.json a7.counts laneBefore '◆1 waiting on a note' → laneAfter '◆2 waiting on a note', laneStamp. |
| `queueRow` | `screens/board.js` | 290 | broken → fixed | renderQueue. | evidence.json queue.rows; outage.render a1050cardCheckout false, a1050queueCheckout true; outage.queue.checko… |
| `checkout` | `screens/board.js` | 304 | operational | flow · check in and seat; surface · outage and after hours; surface · shell toggles | V8 recorded 40 executions across 5 driven legs (flow · check in and seat; surface · outage and after hours; s… |
| `renderQueue` | `screens/board.js` | 310 | operational | render(). | evidence.json queue.rows chip; queue.why box {w:186,h:44}; queue.why.open open true. |
| `practiceLine` | `screens/board.js` | 326 | operational | flow · check in and seat; surface · outage and after hours; surface · shell toggles | V8 recorded 11 executions across 5 driven legs (flow · check in and seat; surface · outage and after hours; s… |
| `onKey` | `screens/board.js` | 342 | operational | document keydown on #/frontdesk/board. | evidence.json key.a (seq 1-4), key.s (5-8), key.s.none (9), key.c (10-11), key.a.offBoard writes [], key.a.in… |
| `render` | `screens/board.js` | 359 | operational | Proto.router.on('board'); every persona × device × theme × outage. | evidence.json a6.matrix total 132 withErrs []; evidence2.json a7.literals; b10.queryOnlyRerender/b10.privacyT… |
| `S` | `screens/chairs.js` | 22 | operational | #/hygienist/chairs render; every card derivation | result-raw.json s1_baseline.cards testids = [a-1050,a-1042,a-1073,a-1070,a-1071,a-1076] == expectedMine; errs… |
| `P` | `screens/chairs.js` | 23 | operational | card(), doReady(), render() subtitle | s5 who = ['7:30 · DP','9:00 · MV',...], fullNamesInCanvas []; s4 sub contains 'read-only during the outage', … |
| `byTime` | `screens/chairs.js` | 24 | operational | mine() | s1_baseline.cards who = ['7:30 · Devon Price','9:00 · Marisol Vega','11:00 · Wes Price','14:00 · Carmen Price… |
| `ordinal` | `screens/chairs.js` | 27 | operational | card() line 124, doReady() line 107 | s3 ready1042 chip '◆Exam: 1st in queue', keyR_executes chips1073 '◆Exam: 2nd in queue'; drive2 t1 ready.live … |
| `isHygienist` | `screens/chairs.js` | 28 | operational | mine(), render() subtitle | s8 hygienist sub '… 6 chairs · yours …'; dentist/frontdesk/biller/surgeon/owner/compliance/temp sub '… all hy… |
| `syncStore` | `screens/chairs.js` | 30 | operational | render() after window.__proto.reset() | s4 expandedBeforeReset 'true' → afterReset {expanded:'false', ready1073:false, heldAnywhere:0, refusals:0, ev… |
| `monthsAgo` | `screens/chairs.js` | 35 | broken → fixed | deltas(), recallDue(); page.evaluate | s1 monthsAgo {'2025-07-01':14,'2026-09-03':0,'2026-09-04':0,'2025-09-04':11,'2025-09-03':12,'2026-08-03':1,'2… |
| `mine` | `screens/chairs.js` | 43 | operational | render(), onKey() | s1 cards == expectedMine (6); s9 dentist cards (16) == expected, providers [u-hy-1,u-dr-2,u-hy-2] |
| `perioToday` | `screens/chairs.js` | 48 | operational | deltas(), canReady() | s2 strip1042 gained '●Perio charted today168 sites probed, deepest 3 mm'; readyAfterPerio.exists true while s… |
| `lastPerio` | `screens/chairs.js` | 49 | operational | deltas(), recallDue() | s1 strip1042 '◆Perio14 mo ago'; strip1073 'Since last visitNo changes since last visitMore' |
| `hasNote` | `screens/chairs.js` | 54 | operational | canReady() | s1 readyButtonsAtLoad 0; s2 readyAfterPerio.exists true with status 'confirmed' |
| `canReady` | `screens/chairs.js` | 55 | operational | card(), doReady(), onKey('r') | s1 readyButtonsAtLoad 0; s3 readyButtons [a-1042.ready, a-1073.ready] class 'btn irreversible'; s2 ready.read… |
| `queuePosition` | `screens/chairs.js` | 56 | operational | card() chip, doReady() announcement | drive3 chairsQueueChips a-1073 '1st', a-1042 '2nd'; exams rows 'Wes Price … exam requested, 1st in queue', 'M… |
| `rank` | `screens/chairs.js` | 59 | operational | queuePosition() sort | drive3 queueEvents [a-1073,a-1042] → a-1073 (11:00) '1st', a-1042 (9:00) '2nd' |
| `deltas` | `screens/chairs.js` | 63 | operational | card() line 131 | s1 strip1042 'Since last visit■Med hx changedNew anticoagulant (apixaban), intake 2 days ago◆Perio14 mo ago◆B… |
| `recallDue` | `screens/chairs.js` | 80 | operational | card() line 123 | s1 chips1042 includes '◆Recall due'; chips1050 and s3 chips1073Seated do not |
| `practiceLine` | `screens/chairs.js` | 84 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 560 executions across 10 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `after` | `screens/chairs.js` | 93 | operational | doReady() success | s2 ready.focus {testid:'chairs.card.a-1042.note'}; drive2 t1 ready.live 'Wes Price ready for exam: 1st in que… |
| `gateFor` | `screens/chairs.js` | 106 | operational | doReady() under outage or a store refusal | s4 gate: refusal event seq 14 {code:'outage', verb:'Server unreachable — nothing writes', control:'Support li… |
| `goPerio` | `screens/chairs.js` | 115 | operational | chairs.card.<id>.perio; key P | s1 goPerio hash '#/hygienist/perio/enc-9001', h1 'Perio · Marisol Vega', events click→route (seq 13–15); keyP… |
| `goNote` | `screens/chairs.js` | 116 | operational | chairs.card.<id>.note; key N | s1 goNote hash '#/hygienist/encounter/enc-9010', h1 'Devon Price' (seq 17–19); keyN '#/hygienist/encounter/en… |
| `doReady` | `screens/chairs.js` | 119 | broken → fixed | chairs.card.<id>.ready; key R; Proto.screens.chairs.ready | s2 ready seq 181–183: click → write appointmentEvents/ae-1 + firstRunState/frs-u-hy-1-ready, status confirmed… |
| `heldReady` | `screens/chairs.js` | 131 | operational | A-storm2-board-16, A-storm2-controls-8 | Held Ready re-renders and acts when the gate has fallen; before it only focused a stale outage control after the outage ended |
| `toggleExpand` | `screens/chairs.js` | 132 | operational | chairs.card.<id>.expand | s1 expand1 {ariaExpanded:'true', detailsHidden:false, more:'Less', focus expand}; expand2 {ariaExpanded:'fals… |
| `card` | `screens/chairs.js` | 135 | operational | render() for every appointment in mine() | s1 chips all glyph+word (allChipsHaveGlyphAndWord []); s7/drive4 targets: no control <44 px and no chairs-to-… |
| `onKey` | `screens/chairs.js` | 193 | operational | document keydown after render() | s1 keyP route perio/enc-9001 (seq 21–22), keyN encounter/enc-9001, keyR_noneReady writes [] statusesUnchanged… |
| `render` | `screens/chairs.js` | 214 | broken → fixed | Proto.router.on('chairs'); router.js HOME hygienist; shell NAV hygienist/dentist | s8 throwing [], 64 combos h1 'Chairs · mine', unknown route h1 'Nothing here'; s1 focusAfterRoute H1; s10 emp… |
| `dollars` | `screens/checkout.js` | 22 | operational | fresh() → paymentCard Amount input value on every checkout open. | evidence.json S1_flow4_a1044.amountValue='44.00'; S13_helpers.prefillNegValue='-44.00', moneyNeg='−$44.00' |
| `cents` | `screens/checkout.js` | 26 | broken → fixed | doPost form.amountCents/writeoffCents; covers(); amount onInput self-pay visibility. | evidence.json S13_helpers.cents[3] input '-50' amountCents 5000 ledger −5000; cents[6] input '0' amountCents … |
| `pressed` | `screens/checkout.js` | 27 | operational | Every toggle/segment button in the screen. | S1 cardPressedAfter='true', cashPressedAfter='false', pressmarkOnCard=true; S4 tog1Pressed/tog2Pressed/tog3Pr… |
| `fresh` | `screens/checkout.js` | 29 | operational | render() on first open of each appointment and after a store reset. | S1 collectPressed='true'; S3 zeroPressed='true', amountPresent=false; S1 afterResetPosted=false, afterResetAm… |
| `lineEstimates` | `screens/checkout.js` | 34 | operational | proceduresCard; exposed as Proto.screens.checkout.lineEstimates. | evidence.json S13_helpers.lineEstimates; S1 estCol |
| `snapshot` | `screens/checkout.js` | 39 | operational | doPost. | S4 postedText lists le-5000, le-5001, le-5002, al-1, al-2, de-1 (pr-421), cd-1 = S4 delta |
| `diff` | `screens/checkout.js` | 40 | operational | doPost on ok. | S3b stmtPosted 'Statement due $228.00 · window deferred · sd-3'; planPosted 'Payment plan $168.00 biweekly · … |
| `rerender` | `screens/checkout.js` | 44 | operational | Every control handler in the screen. | S1 tenderCard.focus, post.focus; S2 post1.focus; S4 tog1.focus; S5 add.focus, ownerAndon |
| `focusPin` | `screens/checkout.js` | 50 | operational | A-storm-board-2, A-storm2-board-9 | Lands the keyboard on checkout.pin for the pin_required and pin_no_match controls |
| `removeWriteoff` | `screens/checkout.js` | 51 | operational | A-storm2-controls-2 | The store's "Remove the write-off" control closes the block and clears amount, reason and gate; it used to go Back to Board |
| `focusField` | `screens/checkout.js` | 52 | operational | A-storm2-controls-1 | The store's "Go to amount" control focuses the named field instead of routing to the Board |
| `openRoles` | `screens/checkout.js` | 53 | operational | A-storm-board-4, A-storm2-board-3 | The entitlement gate's "Open Roles" routes to the owner's Roles; it fell to the default branch and routed to the Board |
| `withControl` | `screens/checkout.js` | 57 | broken → fixed | doPost on a non-held refusal (zero_collect_refused, pin_required, tender_required, outage… | S2 refusal seq 3 code already_decided control 'Open the ledger'; click seq 9-10 → hash '#/frontdesk/board', h… |
| `gate` | `screens/checkout.js` | 85 | operational | surface · checkout amount gate | V8 recorded 3 executions across 1 driven leg (surface · checkout amount gate) |
| `selfPayFor` | `screens/checkout.js` | 91 | operational | A-storm-board-3 | Only restrictions the tender still covers are sent with Collect; a hidden toggle no longer posts a restriction with no payment |
| `afterWriteoff` | `screens/checkout.js` | 96 | operational | A-storm3-money-3, A-storm3-store-7 | The statement or plan body bills what the typed write-off leaves, the same number the store writes |
| `doPost` | `screens/checkout.js` | 100 | broken → fixed | checkout.post (click, or Enter in checkout.pin on a shared desk). | S5 seedChargesFor431 le-4508 charge 118000; writesAtPost2 seq 52 ledger le-5001 charge 118000; threeAfter '$7… |
| `threeNumbers` | `screens/checkout.js` | 151 | operational | render(), top of every checkout. | S1 threeBefore/threeAfter; S5 threeBefore/threeMid/threeAfter; S5 ledgerScreenThree |
| `n` | `screens/checkout.js` | 152 | operational | threeNumbers. | S1 threeBefore = ['$0.00 \| Patient due','$0.00 \| Waiting on insurance','$0.00 \| Credit'] |
| `proceduresCard` | `screens/checkout.js` | 156 | operational | render(). | S1 totalsRow, estCol, estWhyOpen=true; S4 selfpayAt80, tog1Mark; S10.byWidth['420'].selfpayBoxes, tableScroll… |
| `field` | `screens/checkout.js` | 187 | operational | paymentCard (card, amount), writeoffBlock (amount), postRow (PIN). | S1 invalidBeforeBlur=false, invalidAfterBlur=true, cardShortHint, cardOkHint; S5 woInvalidBeforeBlur=false, w… |
| `paymentCard` | `screens/checkout.js` | 194 | operational | render() until posted. | S3 segs, seg1Again.sendPressedAgain='true', cadences, zeroProse, sendProse, planProse; S1 tenderCashKey; S14 … |
| `writeoffBlock` | `screens/checkout.js` | 235 | operational | paymentCard. | S5 add, remove, woOpenAfterRemove=false, courtesyAfter/hardshipAfter, approvedChip, writeoffRowsTotal=1; S5b … |
| `postRow` | `screens/checkout.js` | 249 | operational | render() until posted. | S2 postClass, postDisabled=null; S5 postLabel 'Held', postClass, held1/held2, writesDuringHeld=0, requestedCh… |
| `postedRows` | `screens/checkout.js` | 279 | operational | A-storm2-board-15, A-storm2-board-11 | The Posted card reads the live ledger, intents and decisions for the visit, so a decided visit (cd-0) shows its record and the credit sentence moves when the note files |
| `byId` | `screens/checkout.js` | 280 | operational | A-storm2-board-15 | Resolves the snapshot's row ids against the live tables inside postedRows |
| `postedCard` | `screens/checkout.js` | 292 | operational | render() after a successful Post. | S1 postedText, receiptShown1=true, receiptShown2=false, receiptPressed2='false', canvasIdsPosted ['le-5000','… |
| `li` | `screens/checkout.js` | 294 | operational | postedCard. | S4 postedText 7 lines |
| `procName` | `screens/checkout.js` | 297 | operational | surface · checkout gates and payment plan | V8 recorded 3 executions across 1 driven leg (surface · checkout gates and payment plan) |
| `chargeName` | `screens/checkout.js` | 298 | operational | flow · checkout | V8 recorded 1 execution across 1 driven leg (flow · checkout) |
| `cadenceWord` | `screens/checkout.js` | 299 | operational | surface · checkout gates and payment plan | V8 recorded 1 execution across 1 driven leg (surface · checkout gates and payment plan) |
| `waiting` | `screens/checkout.js` | 300 | operational | A-storm2-board-15 | An unapplied-credit row reads "held as credit" only while the note is unfiled |
| `explainCard` | `screens/checkout.js` | 320 | operational | render() (bottom of every checkout). | S1 explain1, explainText, showpatient, showpatientLabel '✓Show staff', showstaffLabel 'Show patient', explain… |
| `render` | `screens/checkout.js` | 334 | operational | Proto.router.on('checkout') from board.card.<id>.checkout / board.queue.row.<id>.checkout… | S9 combos 128, errors []; S11 h1, leak* []; S8 h1, testids ['checkout.back'], h1NotfoundRoute 'Nothing here';… |
| `covers` | `screens/checkout.js` | 364 | operational | proceduresCard toggle.hidden on each render. | S4 selfpayVisible, selfpayAt80, selfpayAt168 |
| `entWords` | `screens/dailyclose.js` | 18 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 170 executions across 12 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `pairWords` | `screens/dailyclose.js` | 19 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 85 executions across 12 driven legs (route sweep · frontdesk; route sweep · biller; route sweep ·… |
| `fresh` | `screens/dailyclose.js` | 26 | operational | renderClose/renderRisk whenever Proto.store.get() identity changes (first render, __proto… | evidence.json close.initial tile.expanded 'false', detailHidden true; fresh.afterReset tile 'false', decision… |
| `priv` | `screens/dailyclose.js` | 27 | operational | pname() on Investigate rows and pair sentences. | evidence.json privacy.operatory investigateRows 'MV · card payment…', 'BS …', changedItems '…reposted it to F… |
| `shared` | `screens/dailyclose.js` | 28 | operational | A-storm3-owner-1, A-storm3-store-4 | Reads the shared-device flag; the PIN field and the PIN gates render only there |
| `extras` | `screens/dailyclose.js` | 30 | operational | A-storm3-owner-1 | Every posting verb here carries the PIN the field holds, so the store matches it and names the poster |
| `posted` | `screens/dailyclose.js` | 31 | operational | A-storm3-owner-1 | A posting spends the PIN: the field empties after Match, Clear, a decision or Close day |
| `bool` | `screens/dailyclose.js` | 32 | operational | tile(), locationRow(), line(). | evidence.json close.initial expanded 'false' → tile.click1 'true'; locationRow.loc-1 rows [['close.location.l… |
| `say` | `screens/dailyclose.js` | 33 | operational | Match, Clear, decision actions, Close day confirm, refusal control, risk row actions. | evidence2.json say.match 'Matched: $312.40 card settlement timing. Hillsboro now ties.'; say.closeday 'Day cl… |
| `pname` | `screens/dailyclose.js` | 34 | operational | varianceCard Investigate rows, pairSentence. | evidence.json investigate.on rows 'Maya Vega · card payment $280.00 …'; evidence2.json inject.pname.plain thi… |
| `shortName` | `screens/dailyclose.js` | 35 | operational | pairSentence, lateSentence, decisions card, closed line. | evidence.json practiceLines changedItems 'Sam reversed …', lateItems 'Dr. Kim’s File on 9/2 …', closeday.conf… |
| `locOf` | `screens/dailyclose.js` | 36 | operational | locationRow, locationDetail, varianceCard, closeDaySection. | evidence.json locationDetail.loc-3 tableLabel 'Hillsboro tenders'; closeday.step1 h3 'Close Main Street for 9… |
| `days` | `screens/dailyclose.js` | 37 | operational | decisions() lateness, exceptions() days left. | evidence.json decision.keep decChips '◆Review was due 9/1 (2 days ago)'; exceptions.rows[0].text '… 28 days l… |
| `plural` | `screens/dailyclose.js` | 38 | operational | tile sub, location rows, overall, practice lines, exceptions. | evidence.json close.initial sub 'detection lag 1 day', word '1 variance'; helpers overall.twoVar '2 variances… |
| `cap` | `screens/dailyclose.js` | 39 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 34 executions across 12 driven legs (route sweep · frontdesk; route sweep · biller; route sweep ·… |
| `orList` | `screens/dailyclose.js` | 40 | operational | surface · the close card for a seat that may not clear | V8 recorded 2 executions across 1 driven leg (surface · the close card for a seat that may not clear) |
| `monthlyDue` | `screens/dailyclose.js` | 43 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 8 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · h… |
| `rerender` | `screens/dailyclose.js` | 45 | operational | Every control on both screens. | evidence.json investigate.on focused close.variance.v-1.investigate; clear.owner focused close.tied.tile; dec… |
| `openDay` | `screens/dailyclose.js` | 55 | operational | A-storm-owner-3, A-storm3-money-8 | The "Open the day" control on already_closed / already_decided opens the tile on the location; before it had no handler |
| `focusPin` | `screens/dailyclose.js` | 56 | operational | A-storm3-owner-1 | Lands the caret at the end of close.pin for a pin_* control |
| `gate` | `screens/dailyclose.js` | 59 | operational | A-storm-owner-1, A-storm-owner-3, A-storm3-owner-5, A-storm3-owner-8 | Renders a store refusal as the shared gate, each press its own (fresh) refusal so Keep, Tighten and Retire log three; every control word acts |
| `onControl` | `screens/dailyclose.js` | 60 | operational | A-storm-owner-3, A-storm3-owner-8 | Support line for outage, Open the day for a closed day, the PIN field for pin_*, Roles for entitlement, else the caller's fallback |
| `stale` | `screens/dailyclose.js` | 74 | operational | A-storm2-owner-3, A-storm2-owner-2 | A gate is stale when the outage ended, the author who raised an entitlement gate changed, or the PIN field was edited |
| `heldGate` | `screens/dailyclose.js` | 75 | operational | A-storm2-owner-3 | A held gate remembers which control raised it, who, and the PIN it was raised with, so stale() can re-evaluate it |
| `live` | `screens/dailyclose.js` | 76 | operational | A-storm2-owner-3 | Reads a gate slot and drops it when stale, so a Match refused under the outage reads Match after it ends |
| `heldPress` | `screens/dailyclose.js` | 77 | operational | A-storm2-owner-3, A-storm2-owner-9 | A press on a Held primary acts when its gate is stale, else re-renders onto the control |
| `disclose` | `screens/dailyclose.js` | 79 | operational | A-storm-owner-7 | Investigate rows print names as a logged payment-purpose read: the store writes the disclosures row the screen promised |
| `grade` | `screens/dailyclose.js` | 84 | operational | overall(), toggleTile(), locationRow(); exported as Proto.screens.dailyclose.grade. | evidence.json helpers grade.statementLag2 'tied', grade.statementLag3 'second', grade.feedLag3 'tied', grade.… |
| `table` | `screens/dailyclose.js` | 90 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 251 executions across 12 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `openVariances` | `screens/dailyclose.js` | 91 | operational | overall(), locationRow(), locationDetail(). | evidence.json tile.click1 locRows loc-3 '▲Hillsboro▲1 variance…'; match.owner locRow3 '●Hillsboro●Tied · inde… |
| `overall` | `screens/dailyclose.js` | 92 | operational | tile(); exported. | evidence.json close.initial word '1 variance' glyph '▲' → match.owner tile word 'Tied · needs a second look' … |
| `changedPairs` | `screens/dailyclose.js` | 98 | operational | practiceLines(); exported. | evidence.json helpers changedPairs.seed [{orig le-4429, rev le-4430, repost le-4431}, {orig le-4405, rev le-t… |
| `lateRows` | `screens/dailyclose.js` | 105 | operational | practiceLines(); exported. | evidence.json helpers lateRows.seed [le-4432 file_event, le-test-late user]; practiceLines.a7 close.late coun… |
| `pairSentence` | `screens/dailyclose.js` | 106 | operational | practiceLines() when 'Yesterday changed after close' is open. | evidence.json practiceLines changedItems 'Sam reversed check payment #le-4429 from 9/1 and reposted it to Fel… |
| `lateSentence` | `screens/dailyclose.js` | 111 | operational | practiceLines() when 'Postings into closed days' is open. | evidence.json practiceLines lateItems 'Dr. Kim’s File on 9/2 released a $260.00 charge dated 9/1'; practiceLi… |
| `todayTotals` | `screens/dailyclose.js` | 118 | broken → fixed | closeDaySection() confirm card. | evidence.json checkout.setup todayPayments [le-4431 −12000 check (repost of 9/1 row le-4429), le-5000 −4400 c… |
| `sodView` | `screens/dailyclose.js` | 130 | operational | exceptions(). | evidence.json exceptions.rows: 'Expires 10/1' accepted post_payment + refund; 'high' post_payment + write_off… |
| `scan` | `screens/dailyclose.js` | 132 | operational | A-storm-owner-8 | SoD exceptions scan day passes as well as current grants, so a pass issued with an accepted critical conflict shows on the owner home |
| `tile` | `screens/dailyclose.js` | 146 | operational | renderClose(); testid close.tied.tile. | evidence.json close.initial tile {word '1 variance', sub 'Yesterday 9/2 · 3 locations · detection lag 1 day ·… |
| `toggleTile` | `screens/dailyclose.js` | 155 | operational | tile() click and onKey() 'T'. | evidence.json tile.click1 locRows loc-3 expanded 'true' (variance first), focused close.tied.tile; onKey.T af… |
| `locationRow` | `screens/dailyclose.js` | 165 | operational | renderClose() when the tile is open; testid close.location.<locId>. | evidence.json locationRow.loc-1 rows [['close.location.loc-1','true'],['loc-2','false'],['loc-3','false']] fo… |
| `locationDetail` | `screens/dailyclose.js` | 175 | operational | locationRow() when open; testids close.tender.<t>. | evidence.json locationDetail.loc-3 tenders 'Card$2,380.85$2,068.45▲gap −$312.40' chip required, cash/check '●… |
| `varianceCard` | `screens/dailyclose.js` | 188 | operational | locationDetail() for each open variance; testids close.variance.v-1.{match,investigate,cl… | evidence.json match.owner v 'open'→'matched', rr 'variance'→'tied', write seq 6 reconciliationMatches rm-1, c… |
| `candidates` | `screens/dailyclose.js` | 196 | operational | A-storm-owner-1 | The ledger rows a proposed bank match would tie, read from the ledger for the variance's tender, location and date |
| `refuse` | `screens/dailyclose.js` | 199 | operational | A-storm-owner-1, A-storm2-owner-2 | One gate per variance card, raised by the control that pressed it; that control carries the Held identity |
| `doMatch` | `screens/dailyclose.js` | 204 | operational | A-storm-owner-1, A-storm3-owner-1, A-storm2-store-15 | Match posts through the store with the PIN, spends it and announces; a refusal (outage, entitlement, pin_*) renders as a gate instead of changing nothing |
| `doClear` | `screens/dailyclose.js` | 216 | operational | A-storm-owner-1, A-storm-store-19 | Clear posts with the PIN; a who-may-clear gate's way out opens the Investigate rows an independent seat would be handed |
| `practiceLines` | `screens/dailyclose.js` | 234 | operational | renderClose() when the tile is open; testids close.changed, close.late, close.counts.why. | evidence.json practiceLines lineCounts count '1'/'1' aria-label '1 rows'; practiceLines.a7 counts '2'/'2'; ev… |
| `line` | `screens/dailyclose.js` | 236 | operational | practiceLines() twice per render. | evidence.json practiceLines lineCounts text 'Yesterday changed after close1▾' expanded 'false'; focusAfterCha… |
| `decisions` | `screens/dailyclose.js` | 246 | operational | renderClose(); testids close.decision.d-1.{keep,tighten,retire,why}. | evidence.json decision.keep cardText '◆Review was due 9/1 (2 days ago)Decided 8/4/2026 by Dr. Reagan…', resul… |
| `review` | `screens/dailyclose.js` | 253 | operational | A-storm-owner-1, A-storm3-owner-5, A-storm2-owner-10 | Keep, Tighten and Retire post through the store with the PIN, each refusal its own event; focus rests on the Reviewed stamp, not on Close day |
| `act` | `screens/dailyclose.js` | 269 | operational | decisions() for keep/tighten/retire. | evidence.json decision.keep status 'review_due'→'keep', write seq 11 controlDecisions dec-2, threshold 15000→… |
| `approvals` | `screens/dailyclose.js` | 283 | operational | renderClose(); testid close.approval.<reqId>.open. | evidence.json approvals.empty text 'None waiting. Held postings appear here…'; approvals.pending section h2 '… |
| `exceptions` | `screens/dailyclose.js` | 293 | operational | renderClose(); testid close.sod.roles. | evidence.json exceptions.rows 3 rows with chips review/required/stop; exceptions.roles hash '#/owner/roles' h… |
| `closeDaySection` | `screens/dailyclose.js` | 302 | operational | renderClose(); testids close.closeday, close.closeday.confirm, close.closeday.cancel. | evidence.json closeday.step1 primary 'Close day' irreversible, confirm buttons confirm irreversible + Cancel … |
| `confirm` | `screens/dailyclose.js` | 311 | operational | A-storm2-owner-9 | Opens the Close day confirm group with focus on its question, so a repeated Enter does not close the day |
| `health` | `screens/dailyclose.js` | 345 | broken → fixed | renderClose() footer. | evidence.json health.before == health.after 'Practice health: 78 · top levers: bank feed for Hillsboro, secon… |
| `onKey` | `screens/dailyclose.js` | 363 | operational | document keydown while attachKeys() is active. | evidence.json onKey.T afterT1 'false' afterT2 'true' keys seq 4 't', seq 6 'T'; onKey.T.dialogOpen expandedBe… |
| `attachKeys` | `screens/dailyclose.js` | 369 | operational | renderClose(). | evidence.json onKey.T (first mount) and onKey.T.afterReturn tile 'false' (toggled after returning to close). |
| `detachKeys` | `screens/dailyclose.js` | 370 | operational | renderRisk(), onKey() off-route, hashchange listener (line 290). | evidence.json onKey.risk.T errs []; close.afterHop tile.expanded 'true' equals the value before leaving (matc… |
| `pinGates` | `screens/dailyclose.js` | 373 | operational | A-storm3-owner-1 | Whether any standing gate on the screen is a PIN gate; editing the PIN redraws the field only then, so the caret survives typing |
| `pinField` | `screens/dailyclose.js` | 374 | operational | A-storm3-owner-1, A-storm3-store-4 | close.pin on a shared desk: the PIN makes the typist the frozen poster for every posting on the screen |
| `renderClose` | `screens/dailyclose.js` | 382 | operational | Proto.router.on('close'); owner home; nav for biller/owner/compliance; risk.row.d-1.open … | evidence.json a6.summary combos 64 withErrors 0 h1Counts [1] h1 'Daily Close and Controls', focusTargets 'clo… |
| `wroteWords` | `screens/dailyclose.js` | 401 | operational | A-storm-owner-10, A-storm2-polish-3 | The audit sentence's verb per table, with a later approvals write read as the decision it was, and notes touches named |
| `auditSentences` | `screens/dailyclose.js` | 406 | operational | renderRisk(). | evidence.json risk.sentences.afterClose 'Dr. Reagan (owner) closed a business day #dc-loc-1-0903 at +2 s on /… |
| `renderRisk` | `screens/dailyclose.js` | 414 | broken → fixed | Proto.router.on('risk'); compliance home; owner nav. | evidence.json risk.initial h1 'Practice risk' focused H1, 4 rows; risk.d1.open hash '#/compliance/close'; ris… |
| `row` | `screens/dailyclose.js` | 419 | operational | renderRisk() for each due item. | evidence.json risk.initial rows chip '▲past review' btn risk.row.d-1.open 'Open' reversible, '◆21 days' Renew… |
| `standing` | `screens/dailyclose.js` | 428 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 24 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · … |
| `S` | `screens/encounter.js` | 27 | operational | Every render and lookup on #/dentist/exams and #/dentist/encounter/<id>. | evidence.json S1.rows.dentist, S1.queueRows.evaluate, S1.empty (rows 0 after every encounter noteFiled=true). |
| `P` | `screens/encounter.js` | 28 | operational | isSurgeon, privacy checks in renderExams/renderEncounter/renderGate. | evidence.json S1.privacy objs ['IO','TB','DP'] leaks []; S6.privacy h1 'TB'; S4.surgeon procs order d7210,d92… |
| `syncStore` | `screens/encounter.js` | 29 | operational | state() on every render. | evidence.json S3b.stateReset {tooth:null, surfaces:[], checked:false, tx:0, events:1}. |
| `state` | `screens/encounter.js` | 31 | operational | renderEncounter, onKey, exported Proto.screens.encounter.state. | evidence.json S2.chartTag.x, S3.fix.money.x; evidence3.json leak.before/after. |
| `isSurgeon` | `screens/encounter.js` | 34 | operational | queueRows, renderOdontogram, starters. | evidence.json S1.surgeon.rows, S4.surgeon.procs, S4.surgeon.starters, S4.dentist.procs. |
| `dentistLike` | `screens/encounter.js` | 35 | operational | renderNote (readonly), applyStarter. | evidence.json S4.hyg.locked ro true; S4.hyg.starter assessment '' live 'Assessment and Plan are the dentist's… |
| `apptOf` | `screens/encounter.js` | 36 | operational | renderEncounter head and referral card. | evidence.json S2.head.sub, S3.head.sub, S4.surgeon.referral. |
| `providerShort` | `screens/encounter.js` | 37 | operational | renderExams row line, renderEncounter sub. | evidence.json S1.rows.dentist[].small, S2.head.sub. |
| `shortName` | `screens/encounter.js` | 40 | broken → fixed | renderTag, whatWaits, renderTransactions, dismissed reason line. | evidence.json S1.shortName: user 'Bree L.'; two words 'Alex R.'; one word 'Cher'; undefined author renders 'p… |
| `byLine` | `screens/encounter.js` | 46 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 271 executions across 10 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `tagsOf` | `screens/encounter.js` | 47 | operational | renderTags. | evidence.json S2.tagRow, S3.head.tags, S3.paint.tag3.tagChip. |
| `openTags` | `screens/encounter.js` | 48 | operational | queueRows, renderOdontogram (tagged teeth), paint focus target, starterTooth. | evidence.json S1.queueRows.evaluate, S1.whatWaits.else, S2.tooth30.before.cls, S2.paint.tooth30cls. |
| `eventsOf` | `screens/encounter.js` | 52 | operational | renderOdontogram, renderTransactions, undo, starterTooth, renderGate. | evidence.json S2.txCard, S2.undoViaRefusal txCards 0, S2.starter.gateBeforeBlur '..., #30 OD'. |
| `filedOf` | `screens/encounter.js` | 53 | operational | renderEncounter → renderFiledCard. | evidence.json S2.file.card 'By Dr. Hana Kim at 2026-09-03 08:40 · nf-1'; S4.filedFallback card. |
| `referralLine` | `screens/encounter.js` | 54 | operational | whatWaits, renderEncounter referral card. | evidence.json S1.surgeon.rows[3].why '...; records forwarded'; S1.whatWaits.else.referralNotReceived '...; re… |
| `surfLabel` | `screens/encounter.js` | 56 | operational | renderOdontogram selected line and surface buttons. | evidence.json S3.surfLabel {t5:'O', t6:'I', t11:'I', t12:'O', t21:'O', t22:'I', t27:'I', t28:'O'}; S3.surfLab… |
| `scaffoldLine` | `screens/encounter.js` | 58 | operational | renderTransactions, undo, paint announcement. | evidence.json S2.txCard 'Composite, 2 surf posterior #30 OD'; S3.paint.planned.card '#20 MO (planned)'; S3.pa… |
| `mount` | `screens/encounter.js` | 69 | broken → fixed | renderExams, renderEncounter, every rerender. | evidence.json S2.surfD.confirm.focus, S3.tooth20.reset.focus; evidence3.json leak {before c2:false, after c2:… |
| `rerender` | `screens/encounter.js` | 76 | operational | Every mutation in the file. | evidence.json S2.paint, S3.*; *.pageErrors all []. |
| `focusFirst` | `screens/encounter.js` | 78 | operational | flow · chart and file; surface · dismiss a tag with a reason | V8 recorded 4 executions across 2 driven legs (flow · chart and file; surface · dismiss a tag with a reason) |
| `focusGateVerb` | `screens/encounter.js` | 84 | operational | A-storm2-enc-10, A-storm3-shell-6 | After File raises the read-back, focus lands on the gate's verb line, not on its Confirm, so a second Enter files nothing |
| `reveal` | `screens/encounter.js` | 86 | operational | A-storm2-enc-7 | Scrolls a field the gate points at above the pinned gate column below 1280 px, so the killer's Assessment field is hit at its centre |
| `minutesOf` | `screens/encounter.js` | 96 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 50 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · … |
| `waitMinutes` | `screens/encounter.js` | 99 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 25 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · … |
| `queueRows` | `screens/encounter.js` | 103 | operational | renderExams; exported as Proto.screens.exams.rows. | evidence.json S1.queueRows.evaluate, S1.surgeon.rows, S1.clock12 (tagged scheduled rows), S2.examsAfterFile r… |
| `rank` | `screens/encounter.js` | 114 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 54 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · … |
| `waitText` | `screens/encounter.js` | 117 | operational | renderExams. | evidence.json S1.waitText.ordinals ['Waiting 26 min · exam requested, 2nd in queue', '... 1st ...', '... 3rd … |
| `whatWaits` | `screens/encounter.js` | 124 | operational | renderExams. | evidence.json S1.rows.dentist[].why, S1.waitText.ordinals (perio + ready), S1.whatWaits.else.seated 'Seated, … |
| `practiceLine` | `screens/encounter.js` | 135 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 8 executions across 8 driven legs (route sweep · frontdesk; route sweep · biller; route sweep · h… |
| `renderExams` | `screens/encounter.js` | 139 | broken → fixed | router.on('exams'); dentist/surgeon home. | evidence.json S1.h1, S1.open, S1.targets.*, S1.privacy; S2.examsAfterFile practiceLine still '3 notes filed' … |
| `renderEncounter` | `screens/encounter.js` | 163 | operational | router.on('encounter'); exams Open; chairs Note; rail Chart/Notes/Plan. | evidence.json S5.matrix (56 combos, errs 0), S4.notfound, S4.filedFallback, S2.head. |
| `gateNode` | `screens/encounter.js` | 199 | operational | A-storm-enc-7, A-storm-enc-8, A-storm2-controls-6, A-storm2-enc-1 | Builds the gate for a store refusal with a control that acts: support line, Undo the named paint, Switch author opens the pad, Open Roles for the temp |
| `renderTags` | `screens/encounter.js` | 209 | operational | renderEncounter. | evidence.json S2.tagRow, S3.head.tags. |
| `renderTag` | `screens/encounter.js` | 214 | operational | renderTags. | evidence.json S2.paint.tagChip '●Charted'; S3b.dismiss.open; S3b.dismiss.empty refusal seq 7 code reason_requ… |
| `chartTag` | `screens/encounter.js` | 232 | operational | enc.tag.tag-1.chart. | evidence.json S2.chartTag; evidence2.json K.idempotent writes 0. |
| `dismissTag` | `screens/encounter.js` | 240 | operational | enc.tag.tag-1.dismiss. | events.json S3b seq 7 refusal reason_required, seq 14 write tags tag-1; evidence.json S3b.dismiss.done tag {d… |
| `renderOdontogram` | `screens/encounter.js` | 256 | operational | renderEncounter. | evidence.json S3.tooth19 (pressed 'true', ::after '✓'), S3.surface.noTooth.inOdont true, S4.surgeon.procs; ev… |
| `toothBtn` | `screens/encounter.js` | 261 | operational | renderOdontogram ×32. | evidence.json S2.tooth30.before, S2.paint.tooth30cls; evidence2.json G.charted30.unselected.aria. |
| `onClick` | `screens/encounter.js` | 267 | operational | enc.tooth.<n>. | evidence.json S3.tooth19, S3.tooth20.reset, S3.tooth20.samePress. |
| `toggleSurface` | `screens/encounter.js` | 293 | operational | enc.surface.<t>.<s>, onKey M/O/D/B/L. | evidence.json S2.surfD.confirm, S2.surfD.toggle; events.json S3 seq 3 and 6 refusal tooth_required; S3.surfac… |
| `paint` | `screens/encounter.js` | 299 | operational | enc.proc.<cdt>. | events.json S2 seq 18–20 writes, seq 23 refusal; evidence.json S2.paint, S3.paint.planned procsDelta 0, S3.pa… |
| `renderTransactions` | `screens/encounter.js` | 314 | operational | renderEncounter when chart events exist. | evidence.json S2.txCard, S3.paint.planned.card, S3.undoBtn txCards 0. |
| `renderPlanCard` | `screens/encounter.js` | 344 | operational | renderTransactions. | evidence.json S2.txCard.planNums, S3.paint.planned.planNums, S3.fix.money.quotedChip, S3b.planWhy. |
| `num` | `screens/encounter.js` | 352 | operational | renderPlanCard. | evidence.json S2.txCard.planNums ['$260.00 Fee', '$130.00 Your plan pays about', "$130.00 You'd owe about"]. |
| `renderUndo` | `screens/encounter.js` | 358 | operational | flow · chart and file | V8 recorded 2 executions across 1 driven leg (flow · chart and file) |
| `undo` | `screens/encounter.js` | 367 | broken → fixed | enc.undo, duplicate_paint refusal control, Proto.screens.encounter.undo. | evidence.json S2.undoViaRefusal (chartEvents 0, procedures 0, planItems 0, writes [seq 27 chartEvents ce-1:un… |
| `starterTooth` | `screens/encounter.js` | 381 | operational | applyStarter. | evidence.json S2.starter.assessment 'Caries #30 OD ...'; S3.starters {withTooth8:'... #8 ...', fromLastChartE… |
| `starterSurfaces` | `screens/encounter.js` | 382 | operational | applyStarter. | evidence.json S2.starter.assessment 'Caries #30 OD confirmed clinically and on BWX; ...'. |
| `starters` | `screens/encounter.js` | 383 | operational | renderNote. | evidence.json S2.starter.starterLabels, S4.surgeon.starters, S4.surgeon.sedation. |
| `renderNote` | `screens/encounter.js` | 384 | operational | renderEncounter. | evidence.json S2.repaint.noteReadonly, S4.hyg.locked. |
| `field` | `screens/encounter.js` | 386 | operational | renderNote ×2. | evidence.json S2.starter.assessment/plan, S3.fix.money.assessment; evidence2.json T.*.small []. |
| `onInput` | `screens/encounter.js` | 388 | operational | typing in a note field. | evidence2.json K.b12.field {xNote:'Hi #20 \n', taps:0, keys[].field:true}. |
| `applyStarter` | `screens/encounter.js` | 401 | operational | enc.note.starter.<n>. | evidence.json S2.starter {focus enc.note.field.assessment, caret true, writes []}; S4.hyg.starter. |
| `onNoteBlur` | `screens/encounter.js` | 409 | operational | blur of a note textarea. | evidence.json S2.blur.related, S2.blur.timeout swapped true. |
| `swap` | `screens/encounter.js` | 415 | operational | onNoteBlur. | evidence.json S2.blur.related.gate, S2.blur.timeout.swapped true. |
| `staleGate` | `screens/encounter.js` | 423 | operational | A-storm2-enc-5, A-storm2-enc-6 | An outage gate falls once the store says the server is back; the Held press then re-evaluates and acts |
| `sentToExams` | `screens/encounter.js` | 425 | operational | A-storm3-shell-6, A-storm2-enc-4 | Whether the chair is already in the dentist's queue, from the appointment status or its exam_requested event |
| `isSent` | `screens/encounter.js` | 426 | operational | A-storm3-shell-6 | The Send killer reads as done once sent, so its control does not offer "Send to a dentist to file" again |
| `renderGate` | `screens/encounter.js` | 427 | operational | renderEncounter, swap. | evidence.json S2.readback (3 buttons), S3.killers.four chip '▲3 of 4 to fix', S3.readbackThenKillers, S2.blur… |
| `killerRow` | `screens/encounter.js` | 472 | operational | renderGate. | evidence.json S3.killer.money refusalControlTid 0, S3.killer.contradiction cls 'refusal stop'; evidence2.json… |
| `fixKiller` | `screens/encounter.js` | 486 | broken → fixed | enc.killer.<i>.fix. | evidence.json S3.fix.money, S3.fix.contradiction, S3.fix.assessment, S4.hyg.fix.tag focus enc.tag.tag-1.chart… |
| `strip` | `screens/encounter.js` | 490 | operational | fixKiller money. | evidence.json S3.fix.money.assessment. |
| `fix` | `screens/encounter.js` | 501 | operational | fixKiller contradiction. | evidence.json S3.fix.contradiction. |
| `doFile` | `screens/encounter.js` | 524 | operational | enc.file, read-back refusal control. | events.json S2 seq 41 refusal readback, seq 55–57 writes; evidence.json S2.file, S2.heldPress writes [], S3.h… |
| `renderFiledCard` | `screens/encounter.js` | 536 | operational | renderEncounter for a filed encounter. | evidence.json S2.file.card, S4.filedFallback.card. |
| `onKey` | `screens/encounter.js` | 553 | operational | document keydown while mounted. | evidence.json S3.keys. |
| `attachKeys` | `screens/encounter.js` | 567 | operational | renderEncounter for an open encounter. | evidence2.json K.detach.afterRoundTrips surfaces [{s:'M'}]. |
| `detachKeys` | `screens/encounter.js` | 568 | operational | renderExams, not-found and filed branches, hashchange away from encounter, onKey route gu… | evidence2.json K.detach.onExams surfaces unchanged, K.filed.noOdont teeth 0, K.detach.afterRoundTrips. |
| `switchAuthorWithDraft` | `screens/encounter.js` | 41 | operational | A-storm4-shell-1 | Hands the read-back draft (note text, tooth and surfaces, read-back state) to the author the pad names, only when Switch author is pressed from the read-back gate; every other switch keeps drafts per author |
| `focusId` | `screens/encounter.js` | 98 | operational | A-storm4-shell-2, A-storm4-shell-4 | Lands the keyboard on a DOM anchor such as #enc-filed-head after File, so a second Enter reads the Filed card instead of leaving through enc.back |
| `fresh` | `screens/moneydesk.js` | 22 | operational | render() when Proto.store.get() identity changes (first render, __proto.reset()). | evidence.json s1.mdState all fields at defaults; s10.beforeReset writeoffOpen true, writeoffStr '410.00' → s1… |
| `viewFor` | `screens/moneydesk.js` | 23 | operational | A-storm-money-8 | View state keyed by user id: the biller's open write-off form and tab no longer carry into the owner's Money Desk |
| `priv` | `screens/moneydesk.js` | 25 | operational | pname() on every patient name the screen renders. | evidence.json s9.privacy true; s9.tabs.aging.objs ['NI','BS','WP','LF'], s9.readback.objs ['CF','HO','JT','LF… |
| `pname` | `screens/moneydesk.js` | 26 | operational | deltaRow, writeoffCard, denialRow, agingTab, statementsTab, creditsTab. | evidence.json s2.readbackRows[0].head 'Cole Fischer'; s9.readback.objs 'CF'; s3b.pnameFallback.obj 'p-999' (r… |
| `cdtName` | `screens/moneydesk.js` | 27 | operational | cdtLine(). | evidence.json s2.readbackRows[1].head 'D4341 SRP, 4+ teeth per quadrant'; s3.row.head 'D4341 SRP, 4+ teeth pe… |
| `cdtLine` | `screens/moneydesk.js` | 28 | operational | deltaRow, denialRow, agingTab. | evidence.json s2.readbackRows[0].head 'Line 14 · D2740 Crown, porcelain/ceramic · #19', [1] 'Line 22 · D4341 … |
| `cents` | `screens/moneydesk.js` | 32 | broken → fixed | writeoffCard blur validation (line 117) and postWriteoff (line 135). | evidence.json s4b.afterBlur invalid true for 'abc'; s4b.negBlur invalid false for '-50'; s4b.negPost ledger l… |
| `pressed` | `screens/moneydesk.js` | 33 | operational | tabs(), reason buttons, Preview button. | evidence.json s1.tabs era selected 'true', others 'false'; s1.walk.aging.selected 'true'; s4.courtesyControl.… |
| `plural` | `screens/moneydesk.js` | 34 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 215 executions across 13 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `say` | `screens/moneydesk.js` | 35 | operational | postMatched, handleLine, Held press, aging/credit/Fix buttons, openAppeal, Send, Statemen… | evidence.json s2.postMatched.live and .srlive both '3 lines differ from the claim. Read each back: Confirm, H… |
| `shared` | `screens/moneydesk.js` | 36 | operational | A-storm-ledger-1, A-storm2-ledger-13 | Reads the shared-device flag for the PIN field and the PIN gates |
| `post` | `screens/moneydesk.js` | 40 | operational | A-storm-ledger-1, A-storm2-ledger-2, A-storm2-ledger-13 | Every posting verb carries the PIN; a posting spends it, and a second wrong PIN is marked fresh so the redrawn gate logs as the second refusal it is |
| `focusEl` | `screens/moneydesk.js` | 41 | operational | A-storm2-ledger-10, A-storm2-ledger-1 | Focuses a test id or an #id landing; the default control no longer switches to the ERA tab |
| `focusPin` | `screens/moneydesk.js` | 42 | operational | A-storm2-ledger-2 | Lands the caret at the end of money.pin for a pin_* control |
| `removeWriteoff` | `screens/moneydesk.js` | 43 | operational | A-storm2-ledger-10, A-storm-store-15 | The store's "Remove the write-off" control closes the card's form and clears its gate |
| `gate` | `screens/moneydesk.js` | 49 | operational | A-storm-money-1, A-storm2-ledger-4, A-storm2-ledger-10, A-storm3-money-5, A-storm3-money-8 | Renders a store refusal beside the control that raised it, with every control word acting: support line, PIN field, Set aside holds the line, Go to amount, Open the claim, Open the day, Open Roles, Switch author |
| `outageOver` | `screens/moneydesk.js` | 71 | operational | A-storm3-money-2, A-storm2-ledger-5 | A gate is over when its cause is: outage ended, device no longer shared, clock past after hours, pass issued |
| `isPinGate` | `screens/moneydesk.js` | 77 | operational | A-storm2-ledger-2, A-storm2-ledger-13 | Whether a standing gate is a pin_* gate |
| `dropPinGates` | `screens/moneydesk.js` | 78 | operational | A-storm2-ledger-2, A-storm2-ledger-13 | pin_locked's Close empties the PIN and drops every PIN gate on the screen; a shared→desk flip leaves no pin_required gate |
| `pinField` | `screens/moneydesk.js` | 85 | operational | A-storm-ledger-1, A-storm2-ledger-13 | money.pin on a shared desk; the field is empty after a posting and across routes |
| `rerender` | `screens/moneydesk.js` | 91 | operational | Every control on the screen. | evidence.json s1.walk.*.focused the clicked tab; s2.postMatched.focused money.era.line.el-14.confirm; s2.conf… |
| `landing` | `screens/moneydesk.js` | 98 | operational | A-storm2-ledger-1, A-storm2-ledger-3 | Gives a heading or done-stamp an id and tabindex −1 so focus after a primary lands there, not on the next line's Confirm or Send |
| `eraView` | `screens/moneydesk.js` | 101 | operational | counts, eraTab, handleLine, onKey. | evidence.json s2.postMatched.chips '37 posted','3 deltas','1 denial'; s2.confirm14.chips '38 posted','2 delta… |
| `by` | `screens/moneydesk.js` | 103 | operational | eraView only. | evidence.json s2.confirm14.chips '38 posted' after one Confirm (37 seeded posted + el-14); s2.hold22.chips '1… |
| `denials` | `screens/moneydesk.js` | 110 | operational | counts, denialsTab, onKey (A). | evidence.json s3.row.label 'Denied claim c-88'; s3.send.claimAfter 'appealed' with s3.send.denialsCount 'Deni… |
| `aging` | `screens/moneydesk.js` | 111 | operational | counts, agingTab. | evidence.json s1.tabs.aging text 'Aging3'; s5.aging.rows three rows c-72, c-65, c-51; s1.walk.aging.h2s '14+ … |
| `due` | `screens/moneydesk.js` | 114 | operational | A-storm2-ledger-12 | The live patientDue behind a statements row; the row printed the frozen seed amount |
| `waitingEnc` | `screens/moneydesk.js` | 117 | operational | A-storm3-money-4 | A statement queued at the window on an unfiled visit waits for the note; it was on no tab and off the badge |
| `statements` | `screens/moneydesk.js` | 118 | operational | counts, statementsTab. | evidence.json s5.send2.sent both true, s5.send2.count 'Statements2', sendButtons [], rows show 'Statement sen… |
| `creditRows` | `screens/moneydesk.js` | 122 | operational | A-storm2-ledger-9 | Credits are what the ledger says: every account netting to money on hand, with the visit a payment waits for; the tab listed S.credits |
| `myVariances` | `screens/moneydesk.js` | 129 | operational | counts, variancesTab. | evidence.json s10 variances by persona: biller and owner show '▲Variance Hillsboro · card · $312.40'; frontde… |
| `counts` | `screens/moneydesk.js` | 134 | operational | tabs(). | evidence.json s1.tabs ERA1 Aging3 Denials1 Statements2 Credits1 Variances1 Approvals0; s2.dispute31.eraTabCou… |
| `tabs` | `screens/moneydesk.js` | 140 | operational | render(); money.tab.<code>. | events.json s1 seq 1–21 one focus+click+focus per tab, no write, no refusal; evidence.json s1.walk.* focused … |
| `postMatched` | `screens/moneydesk.js` | 149 | broken → fixed | money.era.era-1.postmatched; P key (onKey). | evidence.json s2.postMatched batchBefore 'review' → batchAfter 'deltas', ledgerBefore 114 = ledgerLen 114, ne… |
| `handleLine` | `screens/moneydesk.js` | 157 | operational | money.era.line.<id>.confirm\|hold\|dispute. | events.json s2 seq 4 click, 5 write ledger le-5000, 6 write ledger le-5001, 7 focus el-22.confirm; seq 9 clic… |
| `eraTab` | `screens/moneydesk.js` | 167 | operational | render() with tab 'era'. | evidence.json s1.eraHead 'Delta 835 · 41 lines · 37 posted before you sat down · EFT $4,812.33 …'; s1.postmat… |
| `deltaRow` | `screens/moneydesk.js` | 189 | operational | eraTab in read-back state. | evidence.json s2.readbackRows Confirm 'btn irreversible' with aria 'Confirm line 14: post $540.00 and a contr… |
| `writeoffCard` | `screens/moneydesk.js` | 213 | broken → fixed | render() on every tab. | evidence.json s1.writeoffRow '$410.00 open' = store balances(p-306).patientDue 41000; s4.needsSecond post {te… |
| `openWriteoff` | `screens/moneydesk.js` | 251 | operational | money.writeoff.p-306; W key. | events.json s4 seq 1 focus, 2 click money.writeoff.p-306, 3 focus money.writeoff.amount; evidence.json s4.ope… |
| `postWriteoff` | `screens/moneydesk.js` | 256 | broken → fixed | money.writeoff.post. | events.json s4 seq 6 refusal reason_required; seq 17 click, 18 write approvals ar-1, 19 refusal needs_second … |
| `claimAct` | `screens/moneydesk.js` | 277 | operational | A-storm-money-6, A-storm2-ledger-11, A-storm2-ledger-14 | Fix, Attach and resubmit, Call payer and Escalate post a claim event through the store and move the row to Aging; each used to announce and change nothing |
| `openAppeal` | `screens/moneydesk.js` | 285 | broken → fixed | money.denial.<id>.appeal; Bill patient refusal control; A key. | events.json s3 seq 8 write appealPackets ap-1, seq 12 write ap-2, seq 26 write ap-3, seq 34 write ap-4 (after… |
| `denialsTab` | `screens/moneydesk.js` | 293 | operational | render() with tab 'denials'. | evidence.json s1.walk.denials.h2s ['Denials','Open balances']; s3b.denialsEmpty text 'No open denials — Denie… |
| `sentLine` | `screens/moneydesk.js` | 299 | operational | surface · send an appeal | V8 recorded 2 executions across 1 driven leg (surface · send an appeal) |
| `denialRow` | `screens/moneydesk.js` | 300 | operational | denialsTab. | evidence.json s3.row buttons Appeal 'btn reversible', Fix 'btn quiet', Bill patient 'btn quiet'; s3.fix.live … |
| `appealDrawer` | `screens/moneydesk.js` | 322 | operational | denialRow when st.appealFor matches. | events.json s3 seq 28 click money.appeal.send, 29 write claimEvents cev-1, 30 write disclosures dis-1, 31 foc… |
| `agingAction` | `screens/moneydesk.js` | 346 | operational | agingTab. | evidence.json s1.agingActions ['money.aging.row.c-72.attach','money.aging.row.c-65.call','money.aging.row.c-5… |
| `agingTab` | `screens/moneydesk.js` | 347 | operational | render() with tab 'aging'. | evidence.json s5.aging.h3 ['14+ days · 1','30+ days · 1','60+ days · 1']; s5.agingClicks live 'Attach and res… |
| `statementsTab` | `screens/moneydesk.js` | 362 | operational | render() with tab 'statements'. | events.json s5 seq 10 click money.statement.sd-1.send, 11 write disclosures dis-1, 12 focus money.tab.stateme… |
| `creditsTab` | `screens/moneydesk.js` | 393 | operational | render() with tab 'credits'. | evidence.json s5.credits.rows 'Devon Price $95.00 credit Checked out unfiled: payment waiting for charges (a-… |
| `variancesTab` | `screens/moneydesk.js` | 401 | operational | render() with tab 'variances'. | events.json s5 seq 14 click, 15 route /biller/close, 16 focus; evidence.json s5.varianceOpen hash '#/biller/c… |
| `approvalsTab` | `screens/moneydesk.js` | 406 | operational | render() with tab 'approvals'. | evidence.json s5.approvalsEmpty 'None waiting — Held postings appear here with the frozen sentence the approv… |
| `onKey` | `screens/moneydesk.js` | 416 | operational | document keydown after attachKeys. | evidence.json s7.P batch 'deltas' from seq 1 key P (no click); s7.W focused money.writeoff.amount; s7.keysInI… |
| `attachKeys` | `screens/moneydesk.js` | 434 | operational | render(). | evidence.json s7.P seq 1 key P produced batch 'deltas' and focus el-14.confirm (listener attached by render);… |
| `detachKeys` | `screens/moneydesk.js` | 435 | operational | hashchange listener (line 265); onKey when the route changed. | evidence.json s7.keysOffRoute hash '#/biller/board', packets 0, newEvents seq 11 key A then seq 12–13 writes … |
| `render` | `screens/moneydesk.js` | 438 | operational | Proto.router.on('money') (line 268); rerender(). | evidence.json s10.combos 64 rows, 0 page/console errors, h1 'Money Desk' everywhere, focus on H1 after route … |
| `hasStatement` | `screens/moneydesk.js` | 121 | operational | A-storm4-desk-3 | An account with an unsent statement, or one sent today for the balance as it still is, is not offered Raise again; the store's openStatement owns the rule |
| `postedCents` | `screens/moneydesk.js` | 123 | operational | A-storm4-desk-1, A-storm4-desk-2 | A decided approval prints what posted (the lesser of the request and what was due), never the requested amount |
| `myRecents` | `screens/palette.js` | 15 | operational | surface · palette and search; surface · palette date of birth; surface · palette rows by … | V8 recorded 4 executions across 3 driven legs (surface · palette and search; surface · palette date of birth;… |
| `isOpen` | `screens/palette.js` | 23 | operational | Proto.screens.palette.isOpen(); shell.render checks rail.isOpen not palette; audit calls … | evidence.json s1.isOpenBefore false, s1.open.isOpen true; s3.esc/closeBtn/overlay/hashClose/apiClose isOpen f… |
| `privacy` | `screens/palette.js` | 24 | operational | rowLabel, renderConfirm, confirmDob announcement. | evidence.json s5_privacy {privacy:true, rows[0].label:"MV", who:"▬PatientMV · …0141 · MRN-301", live:"Chart o… |
| `device` | `screens/palette.js` | 25 | operational | showRecents(). | evidence.json s2.operatory {device:"operatory", rows:0, groups:null} vs s2.recents3 rows 3 on desk. |
| `showRecents` | `screens/palette.js` | 26 | operational | currentRows(). | evidence.json s2.operatory {rows:0, groups:null, hint:"Type three letters…", recentsApi:["Chairs","Roles","Mo… |
| `rowLabel` | `screens/palette.js` | 30 | operational | renderRow. | evidence.json s1.rows3[0].label, s5_privacy.rows[0].label "MV", s5_privacy.deskPrivRows ["IO","BS"], s3.delRo… |
| `rowSyn` | `screens/palette.js` | 35 | operational | renderRow. | evidence.json s1.rows3[0].syn "Confirm the date of birth to open the chart"; s3.daysheetRows[0].syn "day shee… |
| `rowChip` | `screens/palette.js` | 46 | operational | renderRow. | evidence.json s5_grayscale.chips [{cls:"chip info",glyph:"▬",word:"Action"},…,{cls:"chip review",glyph:"◆",wo… |
| `remember` | `screens/palette.js` | 53 | operational | activate (claim/action) and confirmDob (patient). | evidence.json s2.recents3.rows ["Chairs","Roles","Money Desk"], s2.recentsDedupe.rows ["Roles","Chairs","Mone… |
| `daysInMonth` | `screens/palette.js` | 63 | operational | surface · palette date of birth | V8 recorded 6 executions across 1 driven leg (surface · palette date of birth) |
| `parseDob` | `screens/palette.js` | 64 | broken → fixed | validateDob, confirmDob. | evidence.json s1.c7_blur invalid "true" (13/01), s1.invalidEnter (4/12/78, no refusal), s1.mismatch (04.13.19… |
| `open` | `screens/palette.js` | 74 | operational | topbar.search (shell.js:34), Ctrl/Cmd+K (shell.js:120), Proto.screens.palette.open(r) API… | evidence.json s1.open {isOpen:true, dialogs:1, focused:palette.input, label:"Search and actions"}; s2.ctrlKTw… |
| `onClose` | `screens/palette.js` | 84 | operational | Proto.ui.dialog close (Escape, overlay, palette.close, hashchange, activate). | evidence.json s3.esc {isOpen:false, dialog:false}, s3.hashClose {isOpen:false, dialog:false, hash:"#/frontdes… |
| `close` | `screens/palette.js` | 88 | operational | palette.close button (lines 88/217), activate, confirmDob, onHash, API. | evidence.json s3.closeBtn {isOpen:false, focused:topbar.search, text:"Close", closeAria:"Close search (Escape… |
| `onHash` | `screens/palette.js` | 89 | operational | window hashchange while open (redundant with Proto.ui.dialog's own hashchange listener). | evidence.json s3.hashClose {isOpen:false, dialog:false}. |
| `renderSearch` | `screens/palette.js` | 92 | operational | open(); activate() steer branches (180, 186); Back to results (223). | evidence.json s1.open {input:{role:"combobox",expanded:"true"}, placeholder, inputAria, howText, testids}; s4… |
| `onInput` | `screens/palette.js` | 101 | operational | Typing in palette.input. | evidence.json s1.hint1, s1.hint2, s1.hint3, s1.status3 "2 results", s1.keyEvents [{seq:4,key:"v",field:true},… |
| `currentRows` | `screens/palette.js` | 121 | operational | refreshList. | evidence.json s2.ctrlK {rows:0, groups:null} before any activation; s2.recents1 {groups:"Recents", rows 1}; s… |
| `refreshList` | `screens/palette.js` | 131 | operational | renderSearch, onInput. | evidence.json s1.open.hint, s2.recents1.hint, s1.hint1/hint2, s1.noMatch {hint:"Nothing matches \"zzq\"…", st… |
| `renderRow` | `screens/palette.js` | 152 | operational | refreshList. | evidence.json s1.rows3 [{testid:"palette.row.0", id:"palette-row-0", role:"option", selected:"false", chip, l… |
| `onClick` | `screens/palette.js` | 157 | operational | Mouse/tap on palette.row.n. | evidence.json s1.confirm.h2 "Confirm date of birth"; s3.daysheet.events [{seq:14,kind:"click",testid:"palette… |
| `onFocus` | `screens/palette.js` | 158 | operational | Keyboard Tab onto a row. | evidence.json s3.tab2 {testid:"palette.row.1"}, s3.tab2rows ["false","true"], s3.tab2input.activedesc "palett… |
| `syncSelection` | `screens/palette.js` | 164 | operational | refreshList, onFocus, move, onKey Home/End. | evidence.json s1.down1 {input.activedesc:"palette-row-0", rows:["true","false"]}, s1.down2 activedesc "palett… |
| `focusRow` | `screens/palette.js` | 173 | operational | surface · palette rows by keyboard | V8 recorded 2 executions across 1 driven leg (surface · palette rows by keyboard) |
| `move` | `screens/palette.js` | 181 | operational | onKey ArrowDown/ArrowUp. | evidence.json s1.down1/down2/up1/upWrap rows and activedesc; s1.down1.focused palette.input; s2.recentsSel ac… |
| `onKey` | `screens/palette.js` | 189 | broken → fixed | Keyboard inside the dialog (body onKeydown). | evidence.json s1.enterShort {hint:"Three letters first."}, s1.noMatchEnter unchanged, s2.boardEnter (Enter se… |
| `moneyTab` | `screens/palette.js` | 212 | operational | surface · palette and search | V8 recorded 1 execution across 1 driven leg (surface · palette and search) |
| `goMoney` | `screens/palette.js` | 221 | operational | surface · palette and search | V8 recorded 1 execution across 1 driven leg (surface · palette and search) |
| `name` | `screens/palette.js` | 224 | operational | surface · palette and search | V8 recorded 2 executions across 1 driven leg (surface · palette and search) |
| `activate` | `screens/palette.js` | 234 | broken → fixed | onClick, onKey Enter. | evidence.json s3.daysheet {hash:"#/frontdesk/close", live:"Daily Close"}, s3.closeday, s3.postmatched, s3.sid… |
| `renderConfirm` | `screens/palette.js` | 267 | operational | activate(patient row). | evidence.json s1.confirm {h2:"Confirm date of birth", who:"▬PatientMarisol Vega · …0141 · MRN-301", focused:p… |
| `onInput` | `screens/palette.js` | 275 | operational | Typing in palette.confirm.dob. | evidence.json s1.c7_typing {value:"13/01/1978", invalid:null, hint:"Second identifier…"}; s1.c7_live {value:"… |
| `onBlur` | `screens/palette.js` | 276 | operational | Focus leaving palette.confirm.dob. | evidence.json s1.c7_blur {invalid:"true", cls:"input pal-dob invalid", hint:"Use MM/DD/YYYY, for example 04/1… |
| `validateDob` | `screens/palette.js` | 296 | operational | onInput (touched), onBlur, confirmDob. | evidence.json s1.invalidEnter {refusal:null, events:[], focused:palette.confirm.dob}; s1.emptyGo {hint:"Enter… |
| `confirmDob` | `screens/palette.js` | 307 | broken → fixed | palette.confirm.go click; Enter in the DOB field. | evidence.json s1.mismatch (refusal seq 68, go Held), s1.heldTwice {events:[]}, s1.retryEnter (refusal seq 76)… |
| `onControl` | `screens/palette.js` | 329 | operational | refusal.control in the confirm step. | evidence.json s1.tryAgain {refusal:null, go:{text:"Open chart",cls:"btn reversible"}, dob:{value:"",focused:t… |
| `swapGo` | `screens/palette.js` | 338 | operational | confirmDob mismatch (true) and onControl (false). | evidence.json s1.mismatch.go {text:"Held", cls:"btn held", lockGlyph:"\"🔒\"", opacity:"1", disabled:false, c… |
| `S` | `screens/perio.js` | 21 | operational | every render, priorExam, savedCard, tagBlock | s1 cells {n:192, disabled:24, ghosts:168}; s3 savedCard.notes == state.notes['enc-9001'] (seq 172 write perio… |
| `P` | `screens/perio.js` | 22 | operational | renderInner (displayName), doSave (device === 'shared') | s8 privacy.h1 'Perio · MV', leaks []; s7 gate refusal seq 171 code pin_required; s7 deskFrontdesk refusals []… |
| `toothOf` | `screens/perio.js` | 24 | operational | siteLabel, stampTooth, nextTooth, active-site line, tag prefill | s1 activeLine 'Tooth 2 · site 1 · prior 3'; s2 cellClick 'Tooth 5 · site 4'; s10 apply_left_from_end 'Step ba… |
| `siteOf` | `screens/perio.js` | 25 | operational | siteLabel, active-site line | s1 k3 meaning 'Depth 3 mm at tooth 2 site 1'; s3 amend.changed 'Depth 5 mm at tooth 31 site 6' |
| `syncStore` | `screens/perio.js` | 28 | operational | stateFor, renderInner | s10 helpers.reset_clears_session {cur:0, sites:0}; s1 afterHop {cur:6, keystrokes:29, has9:false} |
| `priorExam` | `screens/perio.js` | 29 | operational | stateFor | s10 stateFor_9001 {priorDate:'2025-07-01', priorKeys:168, missing:[1,16,17,32]}; stateFor_9002 {priorKeys:0, … |
| `buildPath` | `screens/perio.js` | 32 | operational | stateFor, settings path buttons; exposed as Proto.screens.perio.buildPath | s10 helpers bp_default {len:168, first:[t2-s1,t2-s2,t2-s3], last:[t31-s5,t31-s6]}, bp_arch len 192, bp_all_mi… |
| `ok` | `screens/perio.js` | 33 | operational | buildPath run() | s10 bp_default len 168 first t2-s1; bp_all_missing len 0 |
| `run` | `screens/perio.js` | 34 | operational | buildPath | s2 pathFL.at45 't14-s4'; pathArch.at48 't4-s4'; pathQuadrant.first [t2-s1,t2-s2,t2-s3,t3-s1] |
| `stateFor` | `screens/perio.js` | 42 | operational | renderInner, onKey, exposed API | s10 stateFor_same_ref true; stateFor_9002 pathLen 192; stateFor_null 'throws: Cannot read properties of null … |
| `curKey` | `screens/perio.js` | 54 | operational | record, skip, cell, active-site line | s1 k3 activeLine 'Tooth 2 · site 2'; s3 entered.activeLine 'All 168 sites entered · Save exam'; keyAtEnd 'Eve… |
| `siteLabel` | `screens/perio.js` | 55 | operational | record, skip, undo, toggle | s1 undo.flash 'Undo: removed not probed at tooth 2 site 3'; toggle 'Bleeding on at tooth 2 site 1' |
| `total` | `screens/perio.js` | 56 | operational | count line, saved card status | s1 count0 'Sites recorded: 0/168'; s3 status 'recorded on 168 sites'; s10 stateFor_9002 pathLen 192 |
| `probedCount` | `screens/perio.js` | 57 | operational | count line | s1 count0 '0/168', k3.count '1/168', skip.count '2/168 · 1 not probed'; s4 entered.count '100/168 · 68 not pr… |
| `skippedCount` | `screens/perio.js` | 61 | operational | count line, licence chooser h2 | s1 skip.count; s4 entered.count and chooser.h2 (seq 177–179) |
| `deepest` | `screens/perio.js` | 62 | operational | recallLine, savedCard chip | s3 savedCard.next '▲Perio maintenance…4-month perio maintenance with BWX' (exam deepest 7); s4 saved.live '…6… |
| `advance` | `screens/perio.js` | 65 | operational | record, skip | s1 k3 before.cur 0 after.cur 1; s3 entered.cur 168, keyAtEnd 'Every site is entered. Save exam.' |
| `stampTooth` | `screens/perio.js` | 66 | operational | record, skip | s3 entered.stamp 'Saved to tooth #31 (draft, this session)'; drive2 p2 vocab.legend ends '…Saved to tooth #31… |
| `record` | `screens/perio.js` | 67 | operational | apply (digits, 0+digit), pad keys | s1 k3.after.site {depth:3}; zero.after.site {depth:12} (seq 10–11); s2 pad0.after {depth:13}; s3 keyAtEnd |
| `skip` | `screens/perio.js` | 74 | operational | ArrowRight/ArrowDown, pad → | s1 skip (seq 20–21) site {depth:null,skipped:true}, cellClass 'psite skipped'; s4 saved.exam skipped 68 |
| `undo` | `screens/perio.js` | 81 | operational | Backspace, pad ⌫ | s1 undo (seq 22–23) site null cur 2 flash 'Undo: removed not probed at tooth 2 site 3'; undo2 site {depth:3,b… |
| `toggle` | `screens/perio.js` | 89 | operational | Space, s/S, pad Bld/Pus | s1 space first true second false (seq 5–6), cellClassAfterOn 'psite bleed', cellDesc '3 mm, bleeding, prior 3… |
| `nextTooth` | `screens/perio.js` | 95 | operational | PageDown/PageUp, pad Next tooth | s1 pgdn {cur:3, curKey:'t3-s1'}, pgupAtStart 'Already at the first site'; s10 apply_pgdn_end 'Every site is e… |
| `flash` | `screens/perio.js` | 100 | operational | undo | s1 flashNow 'Undo: removed not probed at tooth 2 site 1', flashLater ''; undo.live equals flash |
| `depthGate` | `screens/perio.js` | 104 | operational | apply (0 then 6–9), pad | s1 gt15 refusal event seq 14 {code:'depth_gt_15', control:'Re-enter the depth'}, save {text:'Held', class:'bt… |
| `siteDepth` | `screens/perio.js` | 112 | operational | A-storm2-enc-8 | The depth the cursor's site kept; a refused 17 mm over a filled 3 mm site no longer leaves Save Held |
| `openAmendGate` | `screens/perio.js` | 114 | operational | surface · perio amend and cancel a reason | V8 recorded 1 execution across 1 driven leg (surface · perio amend and cancel a reason) |
| `apply` | `screens/perio.js` | 119 | operational | onKey, viaPad, exposed API | s1 unknownKey {before:22, after:22}; s10 apply_null_key null; s3 keyAfterSave events [{seq:175,key},{seq:176,… |
| `focusSextant` | `screens/perio.js` | 138 | operational | apply in screening mode | s5 k1.focused {testid:'perio.sextant.2'} |
| `applyScreening` | `screens/perio.js` | 139 | operational | apply when mode === 'screening' | s5 k1/star/k3 sextants ['1','*','3',…], k7ignored keystrokes [3,3], bs 'Undo: cleared sextant UL', extraKey '… |
| `onKey` | `screens/perio.js` | 148 | operational | keyboard on #/…/perio/<encId> | s1 spaceOnSave {perioExams:1, writes:[], lastBleed:true} seq 61–62; s6 keysInInput cur 7→7; s7 pinpad.keyIgno… |
| `viaPad` | `screens/perio.js` | 180 | operational | pad buttons | s2 key4 lastKey {key:'Pad 4'} site depth 4 (seq 4–6); pad0.after depth 13; skip 'Pad ArrowRight'; next 'Pad P… |
| `buildSites` | `screens/perio.js` | 183 | operational | doSave | s3 save.exam siteCount 168 skipped 0; s4 saved.exam skipped 68; s5 saved.exam siteKeys [sx1…sx6], sextantCode… |
| `mkGate` | `screens/perio.js` | 198 | operational | doSave (pin_required, screening_incomplete, omission_licence) | s4 gate refusal event seq 171 omission_licence, saveBtn {text:'Held', disabled:false}; s5 refusal event seq 4… |
| `focusGateControl` | `screens/perio.js` | 203 | operational | flow · perio; surface · perio amend and cancel a reason | V8 recorded 3 executions across 2 driven legs (flow · perio; surface · perio amend and cancel a reason) |
| `doSave` | `screens/perio.js` | 204 | broken → fixed | perio.save, perio.licence.confirm | s3 save.writes [{seq:172,perioExams,pe-2},{seq:173,firstRunState,frs-u-hy-1-perio}], focused perio.tag.add; d… |
| `recallLine` | `screens/perio.js` | 223 | operational | doSave announcement, savedCard | s4 saved.live ends '6-month recall'; s3 save.live ends '4-month perio maintenance with BWX'; s5 saved.next 'F… |
| `closeInline` | `screens/perio.js` | 228 | operational | surface · perio amend and cancel a reason | V8 recorded 1 execution across 1 driven leg (surface · perio amend and cancel a reason) |
| `saveTag` | `screens/perio.js` | 234 | operational | perio.tag.save | s6 saveEmpty writes 0 focused perio.tag.text aria-invalid true (seq 22–25); saveTag writes [{seq:46,tags,tag-… |
| `toothInvalid` | `screens/perio.js` | 249 | operational | validateTag | s6 blur99 toothInvalid 'true'; blurMissing1 'true'; blur30 toothInvalid null |
| `validateTag` | `screens/perio.js` | 250 | operational | input onBlur, saveTag | s6 typeTooth invalidBeforeBlur null; blur99 {toothInvalid:'true', textInvalid:'true', hint '…Tooth must be 1 … |
| `fitGrid` | `screens/perio.js` | 264 | operational | A-storm-chairs-12 | Sizes the grid to the viewport so the cursor scrolls inside it; the glove pad and the active-site line stay in view on a 1024×768 tablet |
| `scrollCursorIntoView` | `screens/perio.js` | 269 | broken → fixed | rerender | drive3 desk i=84 {active:'perio.grid.cell.t31-s1', cell.top 695, pad.top 655, underPad:true, hit:'perio.pad.k… |
| `focusCell` | `screens/perio.js` | 278 | operational | depthGate control | s1 gt15.afterControl focused perio.grid.cell.t2-s3 (seq 18–19); s2 pad19.afterControl same |
| `cell` | `screens/perio.js` | 279 | operational | grid | s2 missingCell {disabled:true, text:'x'}; cellClick {cur:72, padOpen:true} seq 41–43; s3 cellClickAfterSave c… |
| `onClick` | `screens/perio.js` | 285 | operational | perio.grid.cell.t<n>-s<n> | drive.cjs s2 cellClick {cur:72, curKey:'t5-s4', padOpen:true, activeLine:'Tooth 5 · site 4 · prior 3…', focus… |
| `grid` | `screens/perio.js` | 290 | operational | renderInner (mode full) | s10 matrix 88 rows cells 192 errs 0; s5 enter.gridGone true |
| `sextants` | `screens/perio.js` | 300 | operational | renderInner (mode screening) | s5 enter.sextantIds 6; clickSextant {scur:5} seq 35–37; star cls 'psite pe-sextant bleed'; s9 sextantBox {w:3… |
| `pad` | `screens/perio.js` | 307 | operational | perio.pad.toggle, cell click | s2 toggle.padIds (15); targetsPadDesk small []; s9 padBoxes k1 {44×44} next {252×56}; keyHidesPad padInDom fa… |
| `key` | `screens/perio.js` | 310 | operational | pad | drive2 p3 padLabels perio.pad.skip aria 'Skip site, not probed', perio.pad.undo 'Undo last entry' |
| `settings` | `screens/perio.js` | 317 | operational | perio.settings | s2 settings {expanded:'true', lastKeyLine 'Last key pressed: 5 → …', ksLine '…Keystrokes this exam: 13…'} seq… |
| `licenceChooser` | `screens/perio.js` | 337 | operational | omission_licence refusal control | s4 chooser.confirmEarly writes 0 focused perio.licence.implant (seq 180–182); choose pressed 'true' confirm {… |
| `tagBlock` | `screens/perio.js` | 345 | operational | renderInner, savedCard | s6 open {tagTooth:'4', focused perio.tag.tooth} seq 8–10; obs value {v:'Suspected caries #30 — surface: ', se… |
| `dentist` | `screens/perio.js` | 348 | operational | tagBlock | s6 open.h2 'Tag for Dr. Kim'; s3 tagAfterSave.h2 'Tag for Dr. Kim' |
| `savedCard` | `screens/perio.js` | 368 | operational | renderInner when st.saved | s3 savedCard.h2 'Full chart saved · exam pe-2', status 'Chart status: full-mouth six-point chart recorded on … |
| `rerender` | `screens/perio.js` | 391 | operational | every key/click handler | s2 focusFollowsCursor focused perio.grid.cell.t5-s5; s2 key4.focused perio.pad.key.4; s1 k3.focusAfterKey {ta… |
| `focusCursor` | `screens/perio.js` | 407 | operational | flow · perio; surface · perio amend and cancel a reason | V8 recorded 6 executions across 2 driven legs (flow · perio; surface · perio amend and cancel a reason) |
| `render` | `screens/perio.js` | 415 | operational | router.on('perio'), rerender | s10 matrix bad []; eventHygiene errors [] in all 12 logs |
| `renderInner` | `screens/perio.js` | 420 | operational | render | s1 h1 'Perio · Marisol Vega', sub 'Chair 1 · Prior exam 7/1/2025 ghosted · 28 teeth (x = missing: 1, 16, 17, … |
| `S` | `screens/phone.js` | 13 | operational | Every render, helper and decision on the screen. | S1: after write:approvals:ar-1 (seq 3) the card for ar-1 renders; after approvalsLog al-1 (seq 46) it moves t… |
| `P` | `screens/phone.js` | 14 | operational | simulate() swaps persona to biller around requestWriteoff. | S1 approvalsAfterSim.requestedById="u-bl-1", persona "owner"; S8 event seq 3 write:approvals persona "biller"… |
| `st` | `screens/phone.js` | 31 | operational | surface · phone approvals; surface · phone gate; surface · phone approval refused | V8 recorded 31 executions across 3 driven legs (surface · phone approvals; surface · phone gate; surface · ph… |
| `stale` | `screens/phone.js` | 37 | operational | A-storm2-owner-4, A-storm3-owner-2 | A card gate is stale when the outage ended or the clock is past after hours; Approve then reads its own label and the press opens the step-up |
| `nameDisclosed` | `screens/phone.js` | 38 | operational | A-storm2-owner-5, A-storm-owner-6 | Whether this approver's logged read of this request exists in disclosures; the shown name is derived from the row, not module memory |
| `pat` | `screens/phone.js` | 41 | operational | requestCard, redactedSentence, openStepup. | S1 requestedAt[0]="Patient \| LF · MRN-306 \| Show name"; S4 nullRow.text contains "— · —", err null. |
| `requestedAt` | `screens/phone.js` | 42 | operational | requestCard. | S1 requestedAt[2]="Requested at \| 8:40 am"; S4 nullRow.text "Requested at\n8:40 am" with no frozenSentence. |
| `cardSentence` | `screens/phone.js` | 44 | operational | surface · phone approvals; surface · phone gate; surface · phone approval refused | V8 recorded 11 executions across 3 driven legs (surface · phone approvals; surface · phone gate; surface · ph… |
| `denialLine` | `screens/phone.js` | 45 | operational | requestCard. No UI path: simulate is fixed to p-306 (no denied claim) and money.writeoff.… | S4 denial.lines[0]="▲Denial Denied 8/20, no appeal filed."; denialAfterAppeal has no Denial line; claim.submi… |
| `heldForHours` | `screens/phone.js` | 54 | operational | requestCard (After hours chip line). | S4 lines[0]="▬After hours Requested at 8:40 am, location closed at 5:30 pm."; S1 card has no After hours line… |
| `me` | `screens/phone.js` | 55 | operational | render sub line, requestCard, decisions. | S5 personas: "Signed in as Priya Raman · not an approver" … "Signed in as Dr. Blake Reagan · eligible second … |
| `iAmEligible` | `screens/phone.js` | 56 | operational | render (sub line), onApprove (needs_second gate). | S5 personas sub lines; S2 events seq 7-8 (approve → refusal:needs_second). |
| `say` | `screens/phone.js` | 57 | operational | simulate, step-up submit, onDecline. | S1 liveAfterSimulate="Request ar-1 is waiting for you", liveAfterApprove="Approved. Posted with your name as … |
| `focusOn` | `screens/phone.js` | 58 | operational | surface · phone approvals; surface · phone gate; surface · phone approval refused | V8 recorded 8 executions across 3 driven legs (surface · phone approvals; surface · phone gate; surface · pho… |
| `nextSim` | `screens/phone.js` | 63 | operational | surface · phone approvals; surface · phone gate; surface · phone approval refused | V8 recorded 45 executions across 3 driven legs (surface · phone approvals; surface · phone gate; surface · ph… |
| `simWords` | `screens/phone.js` | 67 | operational | surface · phone approvals; surface · phone gate; surface · phone approval refused | V8 recorded 12 executions across 3 driven legs (surface · phone approvals; surface · phone gate; surface · ph… |
| `rerender` | `screens/phone.js` | 69 | operational | All mutating handlers. | S1 andonAfterSim "1 approval waiting", andonAfterSim2 "2 approvals waiting", andonAfterApprove "1 approval wa… |
| `openStepup` | `screens/phone.js` | 78 | operational | onApprove for an eligible, distinct approver. | S1 events seq 46-47 (write:approvalsLog:al-1, write:ledger:le-5000) after click phone.stepup.submit seq 45; d… |
| `paint` | `screens/phone.js` | 82 | operational | state.add / state.back. | S1 dotsAfter2="••", dotsAfterBack="•", dotsAfterKeys="••••••"; S9 dotsAfterEnterOn1="•", dotsAfterType="••••". |
| `pin_no_match` | `screens/phone.js` | 127 | operational | A-storm2-owner-1, A-storm2-store-17 | The pin_no_match control reopens the step-up so the approver retypes their own PIN |
| `pin_locked` | `screens/phone.js` | 128 | operational | A-storm2-shell-1, A-storm2-store-6 | The pin_locked control drops the card's gate and lands focus back on Approve; the lock itself is the store's |
| `gate` | `screens/phone.js` | 130 | operational | surface · phone approval refused | V8 recorded 1 execution across 1 driven leg (surface · phone approval refused) |
| `NOTICE` | `screens/phone.js` | 136 | operational | A-storm-owner-2, A-storm2-owner-8 | The one-line notice for a request that is no longer waiting here |
| `notice` | `screens/phone.js` | 137 | operational | A-storm-owner-2, A-storm2-owner-8 | Names the missing request, announces it and lands focus on the notice, where a pad over a decided or reset request used to close silently |
| `onApprove` | `screens/phone.js` | 138 | operational | phone.request.<id>.approve (click and Enter). | S1 eventsOpenStepup (click → focus phone.stepup.1, no write); S2 seq 7-8 and 10-11 (two presses, two refusals… |
| `onDecline` | `screens/phone.js` | 152 | broken → fixed | phone.request.<id>.decline; Enter inside the reason input. | S1 eventsDeclineEmpty (no write); eventsDecline seq 58-59 (key Enter field:true → write:approvalsLog:al-3); d… |
| `simulate` | `screens/phone.js` | 170 | operational | phone.simulate. | S1 events seq 3 and 6 (write:approvals:ar-1, ar-2); simNote; liveAfterSimulate; S4 with afterHours=1 → held w… |
| `kv` | `screens/phone.js` | 183 | operational | requestCard grid. | S1 requestedAt: ["Patient \| LF · MRN-306 \| Show name","Requested by \| Sam Dawson","Requested at \| 8:40 am… |
| `requestCard` | `screens/phone.js` | 185 | broken → fixed | render for each pending approval. | S7 cards/cardsRefusalDecline small=[] close=[] at all widths; S1 classes approve "btn irreversible", decline … |
| `onInput` | `screens/phone.js` | 225 | operational | Typing in phone.request.<id>.reason. | S1 declineAfter.done[0]="Sent back: appeal first · …"; afterSendBackEmpty.status="pending". |
| `onBlur` | `screens/phone.js` | 226 | operational | Leaving phone.request.<id>.reason empty. | S1 declineOpen.hint.cls="hint" → hintAfterBlurEmpty.cls="hint ph-hint-warn", text "One line for the biller: w… |
| `onKeydown` | `screens/phone.js` | 227 | operational | Enter in phone.request.<id>.reason. | S1 events seq 58 {key:"Enter", field:true, testid:phone.request.ar-2.reason} → seq 59 write:approvalsLog:al-3. |
| `decidedCard` | `screens/phone.js` | 242 | operational | render for each non-pending approval (newest first). | S1 decidedChips ["chip clear\|●Approved"]; finalText "▲ Sent back … sent back by Dr. Blake Reagan at 8:40 am"… |
| `renderNotFound` | `screens/phone.js` | 255 | operational | surface · phone approvals | V8 recorded 1 execution across 1 driven leg (surface · phone approvals) |
| `render` | `screens/phone.js` | 264 | broken → fixed | Proto.router.on("phone") from #/phone/approvals, Andon "Open approvals", Daily Close "Ope… | S5 personas all h1 "Approvals", errs []; S5 combos errs []; S1 focusAfterRoute H1; S9 hashAfterAndon/h1AfterA… |
| `onKey` | `screens/phone.js` | 304 | operational | Any keydown while the phone screen is mounted and the pad is open. | S1 dotsAfterKeys "••••••"; S9 dotsAfterEnterOn1 "•", hintAfterEnterShort, eventsEnterSubmit seq 16-18 (one ke… |
| `attachKeys` | `screens/phone.js` | 315 | operational | render. | S9 eventsEnterSubmit: single approvalsLog + ledger pair after several renders; S1 dotsAfterKeys grew by exact… |
| `detachKeys` | `screens/phone.js` | 316 | operational | onKey when the route is no longer phone; hashchange listener. | S9 dialogBeforeHop=true, dialogAfterHop=false, h1AfterHop "Daily Close and Controls", stateAfterKeyOnOtherScr… |
| `P` | `screens/rail.js` | 24 | operational | Every render; privacy read at #/hygienist/ledger/p-301?privacy=1&device=operatory | S8 priv.railName 'MV', afterToggleOff.name 'Marisol Vega', afterToggleOn.name 'MV' |
| `S` | `screens/rail.js` | 25 | operational | Every helper below | S2 a7after.three[0].v '$360.00', railThree[0].v '$360.00' |
| `today` | `screens/rail.js` | 26 | operational | asOfBlock max, sendStatement local id, recallLine | S2 ao1, ss1, ao3 |
| `route` | `screens/rail.js` | 27 | operational | renderRail tab aria-current on #/frontdesk/ledger/p-301 | S1 afterLedger.ledgerTabCurrent 'page' |
| `announce` | `screens/rail.js` | 28 | operational | rail tabs, alert bar, sendBiller, sendStatement, as-of | drive2 rail.unknown 'Patient not found'; ledger.sendBiller 'Money Desk row created with the sentence attached' |
| `cdtName` | `screens/rail.js` | 29 | operational | ledger rows, explain sentences, plans, preview | S2 land.rows[2][3], S6 after302.plans |
| `numId` | `screens/rail.js` | 30 | operational | rowsFor tiebreak on equal posted date | S2 land.rows[0..1]; rowsHi.hi ['row-le-4510','row-le-4509','row-le-4508'] |
| `encsFor` | `screens/rail.js` | 31 | operational | Docs summary, plans, last note | S6 before302.docs 'Docs: 0 filed notes…' -> after302.docs 'Docs: 1 filed note…' |
| `encsToday` | `screens/rail.js` | 32 | operational | tabGo chart/notes/plan/perio | S1 afterChart.hash; S1b chartNoEnc.msg |
| `apptsToday` | `screens/rail.js` | 33 | operational | apptSummary, eligibilityChip, recallLine, imaging summary | S1 afterOpen.summaries[0].body; S1b afterOpen.summaries[0].body; S1b p304.summaries[0].body |
| `rowsFor` | `screens/rail.js` | 34 | operational | renderLedger | S2 land.rows; S6 r311.rows |
| `openClaims` | `screens/rail.js` | 37 | operational | rail.tab.claims | drive2 rail.claims315.msg; S6 after302.claims |
| `ledState` | `screens/rail.js` | 40 | operational | renderLedger | S5 s4.asofLine 'As of 9/2: 0 of 0 rows…' under persona frontdesk |
| `shared` | `screens/rail.js` | 45 | operational | A-storm-ledger-1, A-storm2-ledger-13 | Reads the shared-device flag for the Ledger's PIN field and gates |
| `humanize` | `screens/rail.js` | 46 | operational | reason column, status words | S2 land.rows[0][3]; S6 r311.rows[0][3] |
| `pressed` | `screens/rail.js` | 47 | operational | rail.explain, ledger.explain, ledger.showpatient, ledger.asof, Rail button | S1 exp0/exp1/exp2; S2 pv1.pressed 'true' |
| `identLine` | `screens/rail.js` | 50 | operational | rail head, ledger sub, profile tab, preview | S1 afterOpen.ids; S8 priv.railIds, priv.leaks [] |
| `boldAmounts` | `screens/rail.js` | 52 | operational | explain sentences, biller row, what-changed list | S2 ex1.sentences[0].bolds |
| `threeNum` | `screens/rail.js` | 53 | operational | rail Balance, ledger Balance, preview | S2 land.three, pv1.three; S6 r307.three credit '$95.00' |
| `eligibilityChip` | `screens/rail.js` | 57 | operational | rail Coverage summary | S1 afterOpen.eligChip; S1b p304.summaries[1]; S8 gray.chips[0] |
| `syncOpeners` | `screens/rail.js` | 62 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 10 executions across 10 driven legs (route sweep · frontdesk; route sweep · biller; route sweep ·… |
| `open` | `screens/rail.js` | 73 | operational | board.card.a-1042.rail, chairs.card.a-1042.rail, palette.confirm.go, renderLedger, Proto.… | S1 afterOpen (click seq 2); S1b unknown.live 'Patient not found'; S1b afterOpen.name 'Jonah Ortiz' after writ… |
| `close` | `screens/rail.js` | 82 | operational | rail.close; hashchange to #/signin | S1 afterClose (click seq 43), afterSignin |
| `isOpen` | `screens/rail.js` | 83 | operational | shell.render, hashchange listener, MutationObserver | S1 afterOpen.isOpen, afterClose.isOpen |
| `button` | `screens/rail.js` | 84 | operational | board.js:184, chairs.js:152, checkout.js:239, encounter.js:124 | S1 ariaLabelBtn, afterOpen.focused rail.close, pressedAfter 'false'; S1b api.btnTestid 'rail.open.p-301' |
| `summaryFor` | `screens/rail.js` | 89 | operational | rail.tab.imaging\|claims\|docs\|profile | S1 tabMsgs.profile.msg; drive2 rail['tab.docs'].text |
| `tabGo` | `screens/rail.js` | 98 | operational | rail.tab.* | S1 afterChart/afterPerio/afterLedger hashes; S1b p304.perioMsg, p304.hashAfterChart |
| `done` | `screens/rail.js` | 100 | operational | surface · patient rail and ledger | V8 recorded 4 executions across 1 driven leg (surface · patient rail and ledger) |
| `label` | `screens/rail.js` | 104 | operational | surface · patient rail and ledger | V8 recorded 28 executions across 1 driven leg (surface · patient rail and ledger) |
| `summary` | `screens/rail.js` | 108 | operational | rail.sum.appts\|coverage\|recall\|balance\|plans\|note | S1 apptsOpen1, exp1.apptsStillOpen; click seq 9 |
| `apptSummary` | `screens/rail.js` | 113 | operational | renderRail | S1 afterOpen.summaries[0]; S1b afterOpen.summaries[0]; S6 after302.appts |
| `prov` | `screens/rail.js` | 116 | operational | apptSummary | S1 afterOpen.summaries[0].body; S6 before302.appts |
| `word` | `screens/rail.js` | 117 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 13018 executions across 12 driven legs (route sweep · frontdesk; route sweep · biller; route swee… |
| `recallLine` | `screens/rail.js` | 123 | operational | renderRail | S6 recall0/recall1; S1b p304.recall; S1b afterOpen.summaries[2] |
| `plansBody` | `screens/rail.js` | 131 | operational | renderRail | S6 before302.plans, after302.plans |
| `lastNoteLine` | `screens/rail.js` | 136 | operational | renderRail | S6 after302.note |
| `renderRail` | `screens/rail.js` | 144 | operational | open, tabGo, Explain, hashchange, privacy MutationObserver | S1 afterOpen; S9 *.board.targets.small []; S8 afterToggleOff/On |
| `rowRef` | `screens/rail.js` | 181 | operational | surface · ledger reversal rows | V8 recorded 93 executions across 1 driven leg (surface · ledger reversal rows) |
| `reasonText` | `screens/rail.js` | 182 | operational | ledgerTable, what-changed list | S6 r311.rows[0][3], r312.rows[0][3]; S2 pv1.firstRow |
| `actorText` | `screens/rail.js` | 193 | operational | ledgerTable | S2 land.rows[0][4]; S6 r313.rows[2][4] |
| `ledgerTable` | `screens/rail.js` | 195 | operational | renderLedger | S2 land.head, pv1.head, ao4.rows; S6 r313.chips |
| `explainEmpty` | `screens/rail.js` | 208 | operational | surface · patient rail and ledger | V8 recorded 1 execution across 1 driven leg (surface · patient rail and ledger) |
| `explainBlock` | `screens/rail.js` | 209 | operational | ledger.explain, zero gate's Explain control | S2 ex1, rowsHi (seq 4-5), pv1.rowsBtns 0; S6 r307.explain |
| `openMoneyDesk` | `screens/rail.js` | 221 | operational | surface · statement held gate | V8 recorded 1 execution across 1 driven leg (surface · statement held gate) |
| `focusPin` | `screens/rail.js` | 225 | operational | A-storm2-ledger-2 | Lands the keyboard on ledger.pin for a pin_* control |
| `storeGate` | `screens/rail.js` | 226 | operational | A-storm-ledger-5, A-storm-money-7, A-storm2-ledger-2, A-storm2-ledger-5 | Wraps a store refusal for Send statement with a control that acts: the Andon's support line, the PIN field, Close on the lock empties the PIN and drops the gate; the outage gate falls when the outage ends |
| `sendStatement` | `screens/rail.js` | 243 | broken → fixed | ledger.statement.send on p-316 (store path), p-315 (held), p-303 (zero), p-306 (local) | S5 s1.events write seq 3; S3 refusals seq 3; S2 ssSeq [22,26] no write, ss2.sent identical, refusalPresent fa… |
| `previewStatement` | `screens/rail.js` | 254 | operational | ledger.statement.preview | S2 pr1/pr2/pr3; S8 priv.previewSub |
| `asOfBlock` | `screens/rail.js` | 267 | operational | ledger.asof -> ledger.asof.date / ledger.asof.statement.sd-1 / ledger.asof.back | S2 ao1-ao6 (seq 39-40 for the change); S5 s3 |
| `renderLedger` | `screens/rail.js` | 282 | broken → fixed | Proto.router.on('ledger') for all 8 personas x 4 devices x 2 themes | S7 anyErr []; S3 refusals [3,6,10,13,17,20] for two gate presses |
| `rerender` | `screens/rail.js` | 320 | operational | every ledger control | S2 ex1.focused, pv1.focused, sb1.focused, ss1.focused, ao1.focused, ao2.focused, ao5.focused |
| `S` | `screens/roles.js` | 12 | operational | Every render, lookup and preview on the screen. | Digest "Day passes issued this month: 3" → 4 after dp-1 (S4.digestAfter) → 5 after dp-2 (S6.digestAfterTwo); … |
| `P` | `screens/roles.js` | 13 | operational | Sign in as this temp sets persona temp. | S8.afterSignin persona="temp", hash "#/temp/board", author chip "Alex"; events.json S8 seq 12-13. |
| `now` | `screens/roles.js` | 15 | operational | A-storm-owner-15 | The store clock; a shift end is compared against it, not against the literal 08:40 |
| `freshState` | `screens/roles.js` | 47 | operational | state() on first render or after a store rebuild; doSave resets form to freshState().form. | S2.pressed0: role.frontdesk and location.loc-1 pressed, extras off; end value "17:30" (S5.reopenedFormEnd); a… |
| `state` | `screens/roles.js` | 50 | operational | Every function on the screen. | probe2.json persistence (name, role, location, extras survive close/reopen); S2.reopened (touched.name kept). |
| `template` | `screens/roles.js` | 52 | operational | buildPreview, remediate, issuedCard. | S4.afterRole preview "Will grant: Chart Perio Draft notes"; S5.save.dayPass.entitlements ["schedule","post_pa… |
| `roleLabel` | `screens/roles.js` | 53 | operational | issuedCard sentence and downgrade note. | S4.issuedCard "· RDH (hygienist) ·"; S5.issuedCard "· Front desk ·" and "not RDH (hygienist)". Fallback branc… |
| `entLabel` | `screens/roles.js` | 54 | operational | Chips in the table, preview, issued card; extras buttons. | S0.chips0 (Second approver, Post payments, Refund, Write off, Reconcile bank, Grant roles, Close day, Schedul… |
| `firstName` | `screens/roles.js` | 55 | operational | credentialChip "verified by …". | S1.rows.u-hy-1 chip "… verified by Dana"; helpers.json: ""/null/undefined→"", "Dr. Blake Reagan"→"Dr." (path … |
| `shortBy` | `screens/roles.js` | 56 | operational | decisionFor chip text. | S0.rows[6][3] "accepted by Dr. Reagan"; helpers.json: "Dana Whitfield"→"Dana", null→"", "Dr."→"Dr. Dr." (boun… |
| `validEnd` | `screens/roles.js` | 57 | operational | saveButton held state, doSave gate, end onBlur mark. | S3: "08:40"→invalid+Held, "08:41"→valid+Issue day pass, ""→invalid, "17:30"→valid; helpers.json: "24:00"→true… |
| `endBadText` | `screens/roles.js` | 58 | operational | A-storm-owner-15 | The shift-end hint names the current clock time |
| `q` | `screens/roles.js` | 59 | operational | refreshPreview (save button swap) and focusTestid. | S3.end_08:40 save "Held" → S3.end_08:41 "Issue day pass" (in-place swap at roles.js:163). |
| `focusTestid` | `screens/roles.js` | 60 | operational | rerender after every action. | Focus after: row toggle → roles.row.u-om-1 (S1); open → roles.daypass.name (S2); gate → refusal.control (S3 s… |
| `rerender` | `screens/roles.js` | 62 | operational | Every mutating control. | events.json S6 (focus rows after each click); S11 temp/light and temp/dark render and issue with no errors; S… |
| `passAsSeat` | `screens/roles.js` | 80 | operational | A-storm-owner-8, A-storm2-controls-9 | A day pass rendered as a seat in the People table, so an issued pass and its SoD decision are listed |
| `decisionFor` | `screens/roles.js` | 81 | operational | peopleTable chip, grantsPanel. | S0.rows: only u-om-1 has "◆ post_payment + refund accepted by Dr. Reagan, review 10/1"; 10 rows "—". |
| `credentialFor` | `screens/roles.js` | 90 | operational | grantsPanel. | S1.rows.u-hy-1.panel.chips; S1.rows.u-dr-3.panel.text "Licence DDS, OMS on the account; no credential row in … |
| `credentialChip` | `screens/roles.js` | 91 | operational | grantsPanel and buildPreview. | S1.rows.u-hy-1 "● Licence verified · RDH · TN · expires 6/30/2027 · verified by Dana"; S4.afterRole preview "… |
| `grantsPanel` | `screens/roles.js` | 93 | operational | peopleTable when a row is expanded. | S1.rows.* panel text; u-om-1 why.open=true, summary 236x44; u-cpa lists View reports and Reconcile bank; regi… |
| `peopleTable` | `screens/roles.js` | 110 | operational | render. | S1.rows.u-om-1 before "false" → after "true" → collapsed "false", panelGone; aria-label "Hide grants for Dana… |
| `previewKeyOf` | `screens/roles.js` | 129 | operational | buildPreview, refreshPreview. | S5.reemitOnNameType refusalEvents 0 over two typed keys; S5.reemitOnEndInput 3 rebuilds for 3 inputs (seq 16-… |
| `remediate` | `screens/roles.js` | 133 | operational | roles.sod.remediate, the preview refusal control, the save-gate control indirectly; expor… | S6.remediate: extras off, refusals [], "● No SoD conflicts", save "Issue day pass", focus roles.daypass.save,… |
| `decide` | `screens/roles.js` | 145 | operational | roles.sod.compensate, roles.sod.accept; exported. | S6.compensate pressed ✓ aria-pressed=true, chip "Compensating control recorded at save · review 10/3", save "… |
| `buildPreview` | `screens/roles.js` | 147 | broken → fixed | dayPassForm and refreshPreview once previewOn. | S4.afterRole (verified), S5.gate (licence_not_on_file, control retargeted to roles.daypass.credential.add 160… |
| `onControl` | `screens/roles.js` | 177 | operational | surface · roles gate control | V8 recorded 2 executions across 1 driven leg (surface · roles gate control) |
| `refreshPreview` | `screens/roles.js` | 196 | broken → fixed | name/end onInput and onBlur. | probe2.json swallow2.replacedDuringPress=true, zero events, focus BODY; S3.swallow; S5.swallowCredential (eve… |
| `refreshAfterBlur` | `screens/roles.js` | 208 | operational | A-storm3-owner-7 | Rebuilds the preview one tick after the Name field's blur, so focus moving onto the primary is not swallowed by the rebuild |
| `blocking` | `screens/roles.js` | 211 | operational | saveButton. | S6.refundOn save "Held"; S6.highOnly (write_off only) "Issue day pass"; after compensate "Issue day pass" (S6… |
| `staleSave` | `screens/roles.js` | 215 | operational | A-storm2-owner-7, A-storm3-owner-4 | The save gate is stale when the outage ended, the name or shift end it asked for was supplied, or the author who raised the entitlement gate changed |
| `dropStaleGate` | `screens/roles.js` | 216 | operational | A-storm2-owner-7, A-storm3-owner-4 | Removes a stale save gate before the primary is drawn, so Issue day pass is Held only under a live gate |
| `saveButton` | `screens/roles.js` | 217 | operational | dayPassForm, refreshPreview. | probe2.json heldStyle {text:"Held", cls:"btn held", opacity:"1", disabled:false, before:"🔒"}; S2.saveBtn0 "I… |
| `doSave` | `screens/roles.js` | 223 | broken → fixed | roles.daypass.save (mouse, Enter); exported as save. | events.json S4 seq 21-25 (write dayPasses/dp-1, userEntitlements/ue-1), S6 seq 62-67 (+controlDecisions/dec-2… |
| `gate` | `screens/roles.js` | 225 | operational | doSave refusal paths. | S3.nameGate (control 133x44, ann "Name the temp before issuing the pass. Go to name"), S3.nameGateSecond seq … |
| `dayPassForm` | `screens/roles.js` | 242 | broken → fixed | render when formOpen. | S2.addAfter formPresent, focus roles.daypass.name; S2.targetsForm small [] close []; probe2.json persistence;… |
| `nameBad` | `screens/roles.js` | 244 | operational | dayPassForm hints/marks, saveButton. | S7.nameInvalidInitial null; S7.nameAfterBlur invalid "true"; S7.nameAfterRetypeBlur invalid null, save "Issue… |
| `mark` | `screens/roles.js` | 248 | operational | name/end onBlur. | S7.nameAfterBlur cls "input invalid", hint "Enter the temp's full name…"; S3.endInvalidAfterBlur hint "Shift … |
| `onInput` | `screens/roles.js` | 250 | operational | Changing roles.daypass.end. | S4.clock12_* four values; S5.reemitOnEndInput seq 16-18. |
| `onBlur` | `screens/roles.js` | 251 | operational | Leaving roles.daypass.end. | S3.endInvalidBeforeBlur null → endInvalidAfterBlur "true" + Held; S3.end_08:40/08:41/empty/17:30. |
| `onInput` | `screens/roles.js` | 253 | operational | Typing in roles.daypass.name. | S5.alexLowercaseRdh gate [] after typing "alex rivera"; key events carry field:true (S4.typingEvents); S12.pr… |
| `onBlur` | `screens/roles.js` | 254 | broken → fixed | Leaving roles.daypass.name (Tab, click elsewhere, closing the form). | S7.nameInvalidAfterTypingEmpty invalid null → S7.nameAfterBlur "true"; probe2.json swallow2; S3.swallow; S2.r… |
| `seg` | `screens/roles.js` | 255 | operational | dayPassForm. | S4.afterRole pressed rdh ✓; S4.afterLocation loc-2 ✓, focus roles.daypass.location.loc-2; S7.spaceOnRole seq … |
| `issuedCard` | `screens/roles.js` | 276 | operational | render after a successful save. | S4.issuedCard chips [Issued, Chart, Perio, Draft notes]; S5.issuedCard "▲ Downgraded to Front desk"; S6.issue… |
| `render` | `screens/roles.js` | 293 | operational | Proto.router.on("roles") for every persona; nav.roles (frontdesk, biller, owner, complian… | S11 all 16 combinations h1 "Roles · Main Street", errs 0, focus H1; S0.digestBefore 3 → S4 4 → S6 5; S2.addBe… |
| `passChip` | `screens/roles.js` | 84 | operational | A-storm4-store-6 | Each pass row carries the store's state chip (live until, ended, revoked), so a second pass is never shown quietly superseding the first |
| `canvas` | `screens/shell.js` | 19 | operational | mount(), app.js render. | raw.json S2-routes: 1096 hops each with exactly one '#canvas h1'. |
| `mount` | `screens/shell.js` | 20 | operational | signin.render, notfound handler, every screen module (grep: 13 call sites). | raw.json S3-router.notfound.canvasText 'Nothing hereBack to home' (previous screen fully replaced); S2 h1Coun… |
| `refocus` | `screens/shell.js` | 23 | operational | surface · shell toggles | V8 recorded 3 executions across 1 driven leg (surface · shell toggles) |
| `renderTopbar` | `screens/shell.js` | 26 | operational | shell.render on every render. | raw.json S6-topbar-*: no small/close chrome targets at 1280/1024/420 (topbar scrolls inside itself at 420: sc… |
| `minimumSentence` | `screens/shell.js` | 56 | operational | A-storm-shell-17, A-storm2-ledger-15 | The Andon prints the store's redacted approval sentence (initials · MRN), so no home shows a full name without a logged tap |
| `renderAndon` | `screens/shell.js` | 58 | operational | shell.render and refreshAndon from every screen. | raw.json S7-andon.outage: '▲Server unreachable … Support line' (chip required, control 140×44 reversible); su… |
| `lockedOut` | `screens/shell.js` | 77 | operational | A-storm-shell-4, A-storm2-shell-1 | The pin_locked refusal the pad shows when no store rule exists; the store's verifyPin owns the lock otherwise |
| `localLock` | `screens/shell.js` | 78 | operational | A-storm-shell-4, A-storm2-shell-1 | Fallback lock for a store with no verifyPin; on this tree the store has one, so it reads false and the store's lock rules |
| `verifyPin` | `screens/shell.js` | 79 | operational | A-storm-shell-4, A-storm2-shell-1, A-storm3-shell-2 | The pad verifies through Proto.store.verifyPin: misses count per device, the third locks and writes a practice finding, and a day-pass PIN moves the author to the pass holder |
| `openPinPad` | `screens/shell.js` | 89 | operational | topbar.author. | raw.json S5-pin-*.opened: keys 72×56, pin.submit 'btn irreversible', pin.cancel 'btn quiet', no small/close c… |
| `showRefusal` | `screens/shell.js` | 103 | operational | submit() on a wrong PIN or a non-charting account. | raw.json S5-pin-*.wrongPin: refusalCount 1 after first and second miss; refusal events seq 39 and 47 (code pi… |
| `showStoreRefusal` | `screens/shell.js` | 106 | operational | A-storm-shell-12, A-storm3-shell-1, A-storm3-shell-2 | Renders the store's PIN refusal in the pad: pin_no_match refocuses the digits (fresh, so each miss logs), outage closes and announces the support line, else Close |
| `retype` | `screens/shell.js` | 107 | operational | A-storm3-shell-1 | The pin_no_match control returns the keyboard to the digit row |
| `submit` | `screens/shell.js` | 111 | broken → fixed | pin.submit ('Go'). | raw.json S5-pin-*.success: hash #/dentist/board, __proto.persona dentist, author chip 'Dr. Kim' (aria 'Who is… |
| `onPadKey` | `screens/shell.js` | 138 | operational | surface · author pad | V8 recorded 5 executions across 1 driven leg (surface · author pad) |
| `renderRail1` | `screens/shell.js` | 153 | operational | shell.render and refreshRail1 for persona temp. | raw.json S9-rail1-*.load: 5 chips + Hide, no small/close targets; retire: 'Arrive ✓' aria 'Arrive, done', rai… |
| `pulseFor` | `screens/shell.js` | 165 | broken → fixed | rail1.chip.<n>. | raw.json S9-rail1-*.pulse: Arrive → .pointed on board.card.a-1042.arrive, #live 'Tap Arrive on the first card… |
| `refreshAndon` | `screens/shell.js` | 183 | operational | A-storm-shell-6, A-storm2-shell-2, A-storm2-shell-4 | Repaints the Andon after every screen mutation and the top bar when the current user moved, so a PIN post on a shared desk shows the poster's chip |
| `render` | `screens/shell.js` | 186 | operational | app.js render on every route; topbar.privacy handler (shell.js:38). | raw.json S2-routes withErrors 0; S6-topbar-*.labels (signed-in bar), signout.topbarIds ['topbar.theme:Dark th… |
| `keepFocus` | `screens/shell.js` | 26 | operational | A-storm4-shell-5 | Refocuses the control with the same test id after a top-bar, Andon or first-shift rail repaint, so set() of theme, device or motion never drops the keyboard to body |
| `render` | `screens/signin.js` | 7 | operational | #/signin, topbar.signout, unknown persona hashes. | raw.json S8-signin-*.load: one h1 'Riverbend Dental', focus H1, role=radiogroup 'Who are you today?' with 8 b… |
| `paint` | `screens/signin.js` | 11 | operational | signin.persona.<p> click/Enter. | raw.json S8-signin-*.paint: biller aria-pressed=true with ✓, others false; second press keeps exactly one pre… |
| `opt` | `screens/signin.js` | 20 | operational | signin.theme.*, signin.device.*, signin.motion, signin.grayscale, signin.privacy, signin.… | raw.json S8-signin-*.opt: dark → data-theme=dark pressed ✓; phone → data-device=phone; motion reduced ↔ auto;… |
| `mulberry32` | `seed.js` | 5 | operational | build() at store.reset (boot and __proto.reset); not exported. | raw.json S11-seed.build: deterministic true, differentSeedsDiffer true, seedZeroIsDefault true (0 is falsy → … |
| `build` | `seed.js` | 19 | operational | Proto.store.reset() at boot and __proto.reset(). | raw.json S11-seed.build.counts {patients:40, appointments:55, encounters:55, ledger:114, eraLines:41, users:1… |
| `pick` | `seed.js` | 21 | operational | build() for names, types, providers, carriers, tenders. | raw.json S11-seed.build.pick {namesFromLists:true, typesValid:true, eligValid:true, tenders:[card,check,cash]… |
| `between` | `seed.js` | 22 | operational | build() for DOBs, fees, phones, patient indexes. | raw.json S11-seed.build.between {yMin:1948, yMax:2016, mMin:1, mMax:12, dMin:1, dMax:28, allValid:true}; char… |
| `L` | `seed.js` | 149 | operational | build() for every seeded ledger row. | raw.json S11-seed.build.L {first:'le-4400', last:'le-4513', unique:true, sequential:true, allHaveKind:true}; … |
| `netOwed` | `seed.js` | 226 | operational | Called while the seed builds statementsDue; its output is every statement amount on Money… | sd-1 on p-316: statement 8400 against 1 ledger rows netting 8400, balances().patientDue 8400; sd-2 on p-319: … |
| `statementFor` | `seed.js` | 227 | operational | Called while the seed builds statementsDue; one row per patient netOwed reports a balance… | 2 statement rows sampled, each carrying a patientId that resolves and an amount derived by netOwed; no statem… |
| `id` | `store.js` | 9 | operational | Internal: every write() row id in arrive, seat, reverify, pingChair, postCheckout, savePe… | events.json S1 writes appointmentEvents/ae-1, eligibilityChecks/el-100; S2 ledger/le-5000; S6 claimEvents/cev… |
| `reset` | `store.js` | 11 | operational | app.js:22 at boot; window.__proto.reset; page.evaluate Proto.store.reset(7) | measurements S6b.evaluate.reset_seed {seedName:"Omar Calloway", seed7Name:"Priya Price", differ:true, tables:… |
| `get` | `store.js` | 21 | operational | Every screen (28 call sites); __proto.state() deep-copies it | S6b.evaluate get_is_live true, state_is_copy true. |
| `write` | `store.js` | 22 | operational | Internal: every mutation | events.json all scenarios; e.g. S5 seq 14-19 chartEvents/ce-1, procedures/pr-500, planItems/pl-1. |
| `touch` | `store.js` | 25 | operational | Reached by every store function that edits a row in place; driven here through Send state… | sendStatement('sd-1') set sent in place: statementsDue length 2 → 2 (no new row) and the log carries statemen… |
| `refuse` | `store.js` | 26 | operational | Internal: every gate; exported but no external caller | S6b.evaluate.refuse {ok:false,code:"x",verb:"v",control:"c",why:"w"}. |
| `ledgerRow` | `store.js` | 29 | operational | A-storm3-store-5 | Every ledger write passes here: a row dated into a closed day is stamped postedAfterClose and closedDayId, so Daily Close's late count moves |
| `offline` | `store.js` | 33 | operational | Guards every posting verb; driven by setting the outage flag and calling three of them | sendStatement → ok false, code outage, verb "Wait for the server — statements cannot send", control "Support … |
| `shared` | `store.js` | 38 | operational | A-storm-ledger-1, A-storm2-store-6 | Reads the shared-device flag; requirePin asks for a PIN only there |
| `lockedOut` | `store.js` | 45 | operational | A-storm2-store-6, A-storm2-shell-1 | The pin_locked refusal: three misses in a row lock the device for five minutes |
| `verifyPin` | `store.js` | 46 | operational | A-storm-store-5, A-storm2-store-6, A-storm2-store-8, A-storm2-store-17, A-storm3-shell-2 | One PIN rule for every posting verb, the pad and the phone step-up: the digits name an account or the day-pass holder or refuse; misses count per device; forUserId binds the PIN to the approver |
| `pinLockout` | `store.js` | 57 | operational | A-storm2-store-6, A-storm2-shell-1 | The third miss writes the practice finding pin_failures_device and starts the five-minute lock |
| `requirePin` | `store.js` | 60 | operational | A-storm-ledger-1, A-storm3-store-4, A-storm2-store-5 | On a shared device every posting verb runs verifyPin on extras.pin; on a desk the current user posts |
| `poster` | `store.js` | 64 | operational | A-storm2-store-7, A-storm-store-5, A-storm3-store-3 | The PIN names the poster of these rows and nothing more: a posting session already ended is written, and the author chip does not move |
| `patient` | `store.js` | 70 | operational | board, checkout, chairs, encounter, rail, palette, phone, moneydesk (18 sites) | S6b.evaluate patient_ok true, patient_unknown undefined, patient_null undefined; probe_seed.cjs dups [["p-320… |
| `appt` | `store.js` | 71 | operational | board, chairs, checkout, store internals | S6b.evaluate appt_ok true, appt_unknown undefined. |
| `encounter` | `store.js` | 72 | operational | perio, encounter, board, checkout, store internals | S6b.evaluate encounter_ok true, encounter_unknown undefined. |
| `user` | `store.js` | 74 | operational | board chair strip, chairs, perio, rail, store internals | S6b.evaluate user_ok "Dana"; S3.chairStrip "Chair 1 · BLRDH◆Exam requested". |
| `carrierName` | `store.js` | 75 | operational | rail, chairs, checkout, store internals | S6b.evaluate carrierName ["Delta Dental","—","—","—"]. |
| `notFound` | `store.js` | 77 | operational | Direct call; raised by every store lookup that resolves an id from the address and finds … | notFound('patient') → code notfound, verb "Open patient from a list" (5 words, verb-first, no terminal period… |
| `currentUser` | `store.js` | 81 | operational | shell, encounter, chairs, phone, dailyclose, moneydesk, perio, store internals | S6b.evaluate currentUser_biller "u-bl-1", currentUser_temp_default {id:"u-temp", role:"frontdesk"}, currentUs… |
| `noPass` | `store.js` | 83 | operational | A-storm-store-6, A-storm2-store-13 | The pass-less temp is refused entitlement with "Open Roles" on every verb, clinical and money alike |
| `needs` | `store.js` | 85 | operational | A-storm3-store-6, A-storm2-store-5, A-storm2-store-15 | One entitlement rule: the seat carries one of the grants or the verb refuses and names a seat that does |
| `bills` | `store.js` | 89 | operational | A-storm3-store-6, A-storm2-store-5 | Money Desk, the Ledger and Checkout post money, so the seat carries a billing grant; a hygienist and a pass-less temp posted 37 ERA rows and a write-off |
| `writeoffCap` | `store.js` | 93 | operational | A-storm-store-15, A-storm2-store-3 | A write-off retires what the patient owes and no more, at request and at Checkout; $1,000 on a $410 balance hid a −$590 net, and $410 cash plus a $100 courtesy posted a credit nobody paid |
| `afterHours` | `store.js` | 100 | operational | A-storm-store-12, A-storm2-store-4, A-storm3-money-2 | One after-hours rule for refunds and write-offs, with the control the screen acts on; eraConfirm's contractual write-off bypassed it |
| `allocate` | `store.js` | 109 | operational | Direct call on the seed's busiest ledger from #/biller/ledger; also the sole source for b… | allocate('p-317') over 9 ledger rows (charge, patient_payment) → 5 charges, patientDue 169935, insurancePendi… |
| `claimFor` | `store.js` | 114 | not_exercised | Internal to allocate(); the fallback when an open charge carries no expected share but a … | 3 claim(s) rest submitted or pended (statuses present: denied, pended, submitted), but none has an open charg… |
| `insSide` | `store.js` | 119 | operational | A-storm2-store-1, A-storm-store-4 | The plan's side of a charge is what it is expected to pay less what it has paid; a $44 window payment no longer eats the insurer's share |
| `take` | `store.js` | 120 | operational | A-storm2-store-9, A-storm-store-7 | Applies n cents of a payment to a charge once and records the take, so a remainder is never pushed onto the last charge twice |
| `pinned` | `store.js` | 124 | operational | A-storm3-store-2 | The charges a payment is pinned to by its own chargeId or its allocation rows |
| `forIns` | `store.js` | 125 | operational | A-storm3-store-2 | Insurer money stays on the charge it was paid against, else a charge rendered by then; filing enc-9003 used to re-open the paid SRP for $217 |
| `insurerMoney` | `store.js` | 158 | operational | A-storm3-store-2, A-storm-store-16 | Insurance payments and contractual write-offs are the plan's side; hardship and courtesy are not |
| `balances` | `store.js` | 159 | operational | checkout three numbers, rail, ledger, moneydesk write-off card | S6b.evaluate balances_*; S2 balances {patientDue:0, credit:4400}; S2b balances 41000 → 118000. |
| `allocationRows` | `store.js` | 161 | operational | A-storm-store-7, A-storm2-store-2 | Writes the allocations rows a payment earned from the same pass the three numbers read; the $410 on a-1047 and the $95 intent on enc-9010 wrote none |
| `charged` | `store.js` | 167 | operational | Direct call; the release test inside postCheckout and every "has this been billed" test o… | procedure pr-411 has a ledger charge row → charged true (flag true); procedure pr-401 has none → charged false |
| `explain` | `store.js` | 168 | broken → fixed | rail Explain, ledger Explain/Send to biller/Preview, checkout Explain and receipt, moneyd… | S6b.explainConsistency mismatches 14/40 (p-308 explain $1,291.90 vs due $1,698.95); explain_unknown [], expla… |
| `at` | `store.js` | 179 | operational | A-storm-store-4, A-storm-store-16, A-storm-ledger-3 | The amount a payment took on this charge, for the Explain sentence that now reads the same allocation as the three numbers |
| `arrive` | `store.js` | 198 | operational | board.card.<id>.arrive, Board "A" key | S1 seq 4-8; S1.evaluate arrive_unknown/arrive_null notfound, arrive_outage code outage; S1b arriveControlExis… |
| `seat` | `store.js` | 208 | operational | board.card.<id>.seat, Board "S" key | S1 seq 13-17; S3.chairStrip; S1.evaluate seat_twice_store 2. |
| `reverify` | `store.js` | 209 | operational | board.card.<id>.reverify, board.readiness.row.elig.reverify-all | S1 seq 9-12 eligibilityChecks [{el-100, a-1042, active}]; seq 34-37 el-101; S1.evaluate reverify_unknown thre… |
| `pingChair` | `store.js` | 210 | broken → fixed | board.queue.row.<id>.ping | S1 seq 18-33; S1.evaluate pingChair_unknown threw. |
| `visitEstimate` | `store.js` | 230 | operational | A-storm3-store-8, A-storm3-money-7 | With no seeded estimate the visit's own procedures say what the patient owes: the released charge's expected share, else the plan card |
| `windowEstimate` | `store.js` | 242 | operational | A-storm3-store-8, A-storm3-money-7, A-storm-store-9 | The one estimate Checkout foots: the seeded or visit estimate capped by the prior open balance plus this visit's uncharged fees |
| `postCheckout` | `store.js` | 248 | broken → fixed | checkout.post (checkout.js:70) | S2, S2b, S2c, S2f events and state deltas; S2.postAgainStore already_decided. |
| `requestApproval` | `store.js` | 304 | operational | Direct call standing in for the biller's Request approval control on Money Desk and Check… | first press wrote ar-1 (1 approvals write event); an identical second press returned the same id with already… |
| `approvalSentence` | `store.js` | 318 | operational | Direct call on the row requestApproval wrote, read once in the clear and once in privacy … | clear: "Write-off $120.00 on Marisol Vega (courtesy) requested by Sam Dawson at 08:40"; privacy: "Write-off $… |
| `evaluateRelease` | `store.js` | 329 | operational | Internal: postCheckout and requestWriteoff; exported, no external caller | S6.evaluate.evaluateRelease; S2c seq 13 needs_second; S2f_afterhours seq 13 after_hours (verb 7 words). |
| `decideApproval` | `store.js` | 343 | operational | phone.stepup.submit (approve), phone.request.<id>.decline (decline), pre-check on phone.r… | S2c seq 37-43; S2d seq 12-15 and 26-28; S2c.decideAgainStore writeoffRowsForAr1 2. |
| `requestWriteoff` | `store.js` | 374 | operational | money.writeoff.post (moneydesk.js:138), phone.simulate (phone.js:119) | S2d seq 7-10; S6 seq 43-52 ledger/le-5002 −10000; S2d seq 33-36 approvals/ar-2; S6.evaluate requestWriteoff_*. |
| `savePerio` | `store.js` | 394 | operational | perio.save, perio.licence.confirm (perio.js:174) | S4 seq 173-187; S4b omission seq 101-115, screening seq 19-23; S4b.evaluate. |
| `clinician` | `store.js` | 433 | operational | A-storm2-store-13, A-storm2-polish-2, A-storm-enc-9 | One clinician rule for chartPaint, addTag, readyForExam and savePerio: a pass, then a licence or clinical entitlement, else licence_scope with Switch author; perio.js carried its own copy |
| `addTag` | `store.js` | 439 | operational | perio.tag.save (perio.js:196) | S4 seq 188-195; S4b.evaluate addTag_ok, addTag_unknownEnc ok:true. |
| `readyForExam` | `store.js` | 446 | operational | chairs.card.<id>.ready (chairs.js:102), encounter killer fix licence (encounter.js:361) | S3 seq 11-15; S5b_hyg seq 6-11; S3b refusal outage; S1.evaluate readyForExam_unknown threw. |
| `wholePatient` | `store.js` | 451 | operational | A-storm-enc-5 | Whole-patient codes (D0120, D1110, …) chart with no tooth; the screen no longer refuses tooth_required for a periodic exam |
| `liveEvents` | `store.js` | 452 | operational | A-storm-enc-4, A-storm-enc-2 | Chart events not reversed and not reversals, so an undone paint is no longer "already charted" |
| `sameSurfaces` | `store.js` | 453 | operational | A-storm-enc-14 | Surface sets compare sorted, so D2392 #30 OM after #30 DO is a second paint, not a duplicate |
| `chartPaint` | `store.js` | 454 | broken → fixed | enc.proc.<cdt> (encounter.js:213) | S5 seq 14-41; S5b seq 27-56; S5b.evaluate chartPaint_*. |
| `same` | `store.js` | 465 | operational | A-storm-enc-2, A-storm-enc-14 | One duplicate rule over live chart events and seeded procedures: code, tooth and surfaces |
| `chartUndo` | `store.js` | 500 | operational | flow · chart and file | V8 recorded 1 execution across 1 driven leg (flow · chart and file) |
| `ce` | `store.js` | 505 | operational | A-storm2-enc-1, A-storm2-store-12 | chartUndo reverses the named chartEventId, else the last live paint; the duplicate gate's Undo no longer reverses the wrong tooth |
| `dismissTag` | `store.js` | 522 | operational | surface · dismiss a tag with a reason | V8 recorded 2 executions across 1 driven leg (surface · dismiss a tag with a reason) |
| `needsAttachment` | `store.js` | 538 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 161 executions across 16 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `openSession` | `store.js` | 543 | operational | surface · author pad | V8 recorded 1 execution across 1 driven leg (surface · author pad) |
| `pendingApprovalsFor` | `store.js` | 555 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 218 executions across 34 driven legs (route sweep · frontdesk; route sweep · biller; route sweep … |
| `dentistLike` | `store.js` | 560 | operational | A-storm3-store-10, A-storm-enc-9 | Dentist, owner or surgeon may disposition a tag and file assessment and plan; a hygienist's killers put Send first |
| `noteKillers` | `store.js` | 561 | operational | encounter.js blur/paint/dismiss/fix/renderGate (8 sites) | S5 seq 42-55; S5b seq 1-11; S5b.evaluate noteKillers_*. |
| `fileNote` | `store.js` | 587 | broken → fixed | enc.file / refusal.control Confirm and file (encounter.js:321, 365) | S5 seq 56-64; S2 seq 28-35; S5b_surgeon seq 17-25; S5.fileAgainStore; S5b_privacy seq 17 verb "Filing as Dr. … |
| `expectedFor` | `store.js` | 612 | operational | A-storm-enc-11 | The released charge's insuranceExpectedCents from the paint's own plan card, so a $260 composite is not all Patient due |
| `eraPostMatched` | `store.js` | 634 | broken → fixed | money.era.era-1.postmatched, Money Desk "P" key (moneydesk.js:63) | S6 seq 1-4; S6.evaluate eraPostMatched_unknown threw. |
| `settleBatch` | `store.js` | 651 | operational | A-storm-store-17, A-storm2-ledger-7 | The ERA batch posts only when no line is open; a held line keeps it in deltas with a way to decide it |
| `eraConfirm` | `store.js` | 652 | operational | money.era.line.<id>.confirm (moneydesk.js:100) | S6 seq 5-8; S6.evaluate eraConfirm_twice_store 2, eraConfirm_unknown threw. |
| `eraHold` | `store.js` | 666 | operational | money.era.line.<id>.hold | S6 seq 9-12; S6.evaluate eraHold_unknown threw. |
| `eraDispute` | `store.js` | 669 | operational | money.era.line.<id>.dispute | S6 seq 13-16; S6.evaluate eraDispute_unknown threw. |
| `buildAppeal` | `store.js` | 679 | broken → fixed | money.denial.<id>.appeal, denial_suppression control, "A" key (moneydesk.js:151) | S6 seq 17-24; S6.evaluate buildAppeal_unknown threw. |
| `patientRecords` | `store.js` | 682 | operational | A-storm2-ledger-8 | The exam and note ids of the claim's patient for the appeal disclosure; sendAppeal hard-coded pe-1 and a row that did not exist |
| `IN_REVIEW` | `store.js` | 683 | operational | A-storm2-ledger-14 | Fix on an already-appealed claim refuses already_decided with "Open the claim" |
| `sendAppeal` | `store.js` | 684 | operational | money.appeal.send (moneydesk.js:190) | S6 seq 25-28; S6.evaluate sendAppeal_unknown threw. |
| `claimAction` | `store.js` | 688 | operational | A-storm-money-6, A-storm2-ledger-11, A-storm2-ledger-14 | Fix, Attach and resubmit, Call payer and Escalate write a claim event with the next action; a corrected claim goes back to the payer |
| `disclose` | `store.js` | 702 | operational | A-storm-enc-23, A-storm-owner-6, A-storm-owner-7 | Writes the disclosures row a logged read promises: the phone's Show name and Daily Close's Investigate rows wrote nothing |
| `sendStatement` | `store.js` | 706 | operational | money.statement.<id>.send (moneydesk.js:217), ledger.statement.send (rail.js:176) | S6 seq 36-39; S6b seq 1-7; S6.evaluate sendStatement_unknown threw. |
| `raiseStatement` | `store.js` | 722 | operational | A-storm-ledger-5, A-storm2-ledger-3 | Raises a statementsDue row for an account with a balance and no row, under PIN and entitlement; Send on p-306 was held with no way out |
| `reconciles` | `store.js` | 743 | operational | A-storm2-store-15, A-storm2-owner-2 | Match, Clear and a decision review need bank_reconcile or close_day; a pass-less temp tied the day and moved the threshold |
| `matchVariance` | `store.js` | 745 | operational | close.variance.<id>.match (dailyclose.js:133) | S7 seq 4-7; S7.evaluate matchVariance_unknown threw. |
| `clearVariance` | `store.js` | 758 | operational | close.variance.<id>.clear (dailyclose.js:136) | S7b_owner seq 4-7; S7b_compliance seq 11-14; S7b_frontdesk seq 4-7; S7b.biller.clearViaStore. |
| `reviewDecision` | `store.js` | 777 | operational | close.decision.<id>.<keep\|tighten\|retire> (dailyclose.js:171) | S7 seq 8-11; S7b_owner seq 8-11; S7.evaluate reviewDecision_retire_then_keep, reviewDecision_unknown threw. |
| `closeDay` | `store.js` | 786 | operational | close.closeday.confirm, close.closeday when closed (dailyclose.js:206, 221) | S7 seq 12-20; S7b_biller seq 4-9; S7b_compliance seq 2-7; S7.evaluate closeDay_*. |
| `previewDayPass` | `store.js` | 806 | operational | roles.js preview/save/blocking (4 sites) | S8.previewAlex; S8b.janePreview; S8b.tomPreview; S6b.evaluate.previewDayPass. |
| `addDayPass` | `store.js` | 817 | operational | roles.daypass.save (roles.js:178) | S8 seq 7-11; S8b_jane seq 8-12; S8b_tom seq 8-22; S8b.evaluate addDayPass_*. |
| `railSteps` | `store.js` | 845 | operational | shell.js:92 renderRail1 | S8 step "Sign in as temp" railSteps rdh; S6b.evaluate railSteps_biller; S8b.evaluate railSteps_owner. |
| `retireChip` | `store.js` | 846 | operational | arrive, seat, postCheckout, savePerio (store), chairs.js:105 ready, perio.js:198 tag | S1 railState {u-fd-1:{arrive, seat}}; S3 railState adds u-hy-1.ready; S8 railState u-temp; S8b.evaluate retir… |
| `railStateFor` | `store.js` | 853 | operational | shell.js:95 chip rendering | S8 chips after each step; S6b.evaluate railStateFor_biller {}. |
| `search` | `store.js` | 856 | operational | palette.js:98 | S9 q_* rows and hints; S9.privacyRows; S6b.evaluate.search. |
| `passEnds` | `store.js` | 89 | operational | A-storm4-store-6 | Shift end plus the grace period on the store clock: the minute a pass stops verifying |
| `passState` | `store.js` | 90 | operational | A-storm4-store-6 | live, ended or revoked — the one state verifyPin and the Roles chip both read |
| `passLive` | `store.js` | 91 | operational | A-storm4-store-6 | True while a pass is neither revoked nor past its grace |
| `livePasses` | `store.js` | 92 | operational | A-storm4-store-6 | Every live pass is a credential: verifyPin accepts each one's PIN, not only the newest |
| `passUser` | `store.js` | 93 | operational | A-storm4-store-6 | The temp seat as the holder whose PIN verified, with that pass's name, role and entitlements |
| `tempSeat` | `store.js` | 95 | operational | A-storm4-store-6 | The temp seat resolves only while its pass is live; currentUser and user('u-temp') read it |
| `settledCents` | `store.js` | 336 | operational | A-storm4-store-2, A-storm4-desk-2 | What a decided request posted; approvalSentence prints it, never the requested amount |
| `noteLine` | `store.js` | 511 | operational | A-storm4-store-7 | The procedure line one chart event contributes to the note |
| `noteLines` | `store.js` | 512 | operational | A-storm4-store-7 | Rebuilds notes[enc].procedures from the live chart events after each paint and undo, so undoing a named paint withdraws its own line |
| `claimCharges` | `store.js` | 661 | operational | A-storm4-store-1 | The ledger charges a claim bills |
| `eraTargets` | `store.js` | 662 | operational | A-storm4-store-1 | The charges an ERA line may settle: the claim's, else the patient's charges effective before the remit; a charge filed today never receives ERA money |
| `openStatement` | `store.js` | 752 | operational | A-storm4-store-3, A-storm4-desk-3 | The statement an account already has: an unsent row, or one sent today for the live balance; raiseStatement returns it or refuses already_decided |
| `h` | `ui.js` | 6 | operational | Every screen; page.evaluate with boundary attrs. | raw.json S4-ui.helpers.h.*: '<div class="a" data-testid="t.x" data-k="v" hidden="" aria-label="L">…</div>' (n… |
| `btn` | `ui.js` | 28 | operational | Every control in the prototype; page.evaluate for pressed variants. | raw.json S4-ui.helpers.btn.*: pressed true → aria-pressed="true" + <span class=pressmark>✓</span>; false → "f… |
| `chip` | `ui.js` | 50 | operational | Andon (shell.js:48,53) and every screen; page.evaluate for all six severities and an unkn… | raw.json S4-ui.helpers.chip.all: glyphs ■▲◆★▬● and '●' fallback for unknown, role=status, class 'chip stop bi… |
| `resetGates` | `ui.js` | 59 | operational | Called by the boot harness on reset; driven here by constructing the same gate three time… | three constructions of one gate logged 1 refusal event (a re-render is silent); after resetGates() the same g… |
| `refusal` | `ui.js` | 60 | operational | PIN pad refusals (shell.js:64) and every screen gate; page.evaluate with/without control … | raw.json S4-ui.refusal.one: role=group, data-code, exactly one refusal.verb, one refusal.control 177×44, summ… |
| `money` | `ui.js` | 88 | broken → fixed | Every amount on screen; page.evaluate. | raw.json S4-ui.helpers: money(-4400)='−$44.00', money(0)='$0.00', money(123456789)='$1,234,567.89', money(5)=… |
| `dateParts` | `ui.js` | 95 | operational | Internal to shortDate, longDate and dateTime; reached by every date on every screen | shortDate('2026-09-03') → "9/3", longDate → "9/3/2026", dateTime → "9/3/2026 at 08:40" all parse through it; … |
| `shortDate` | `ui.js` | 96 | broken → fixed | store.explain, moneydesk statements, dailyclose review dates, rail ledger; page.evaluate. | raw.json S4-ui.helpers: '9/3', '12/25' correct; '2026-09-03T06:10' → '9/NaN'; '' → 'NaN/NaN'; null → TypeErro… |
| `longDate` | `ui.js` | 97 | broken → fixed | store.explain, palette DOB row, dailyclose 'Decided …'; page.evaluate. | raw.json S4-ui.helpers: '9/3/2026', '1/30/1954' correct; '2026-09-03T06:10' → '9/NaN/2026'; undefined → TypeE… |
| `dateTime` | `ui.js` | 99 | operational | Direct call on ordinary, date-only, null and malformed inputs (A8) | '2026-09-03 08:40' → "9/3/2026 at 08:40"; date only → "9/3/2026"; null → "—"; malformed → "—" — one shape, an… |
| `time` | `ui.js` | 103 | operational | route sweep · frontdesk; route sweep · biller; route sweep · hygienist | V8 recorded 1170 executions across 24 driven legs (route sweep · frontdesk; route sweep · biller; route sweep… |
| `initials` | `ui.js` | 113 | broken → fixed | shell.js:30 author chip on operatory/shared, displayName, store.fileNote read-back; page.… | raw.json S4-ui.helpers: 'MV', 'A', 'AB', 'LS', '' for blanks; 'Dr. Hana Kim' → 'DH' (honorific counted) → F-f… |
| `displayName` | `ui.js` | 114 | broken → fixed | palette rows, board/chairs cards, rail; page.evaluate. | raw.json S4-ui.helpers: 'MV' / 'Marisol Vega' / 'Marisol Vega'; (null,false) → null; (null,true) → TypeError … |
| `support` | `ui.js` | 119 | operational | A-storm-words-1, A-storm-chairs-4, A-storm-enc-7 | The one support line, announced through the router; replaced six literals in two wordings and the "Support line" controls that ran () => {} |
| `typeWord` | `ui.js` | 130 | operational | A-storm-words-2, A-storm-board-8 | One word per appointment type from the shared TYPE table; Checkout's subtitle read the raw code "exam" beside the Board's "Exam" |
| `dialogRoot` | `ui.js` | 133 | operational | A-storm2-shell-3, A-storm3-shell-7 | The #dialogs host every dialog stacks in; read by topDialog and closeDialogs |
| `topDialog` | `ui.js` | 135 | operational | A-storm2-shell-3, A-storm3-shell-1, A-storm3-shell-4 | The top dialog owns the keyboard: the pad's key handler asks before taking a key, the palette refuses to open over the pad, a repaint keeps focus inside it |
| `landFocus` | `ui.js` | 138 | operational | A-storm2-shell-6, A-storm3-shell-7 | A closing dialog lands focus on its opener, the opener's replacement by test id, the dialog beneath, the heading or the first control — never body after a repaint detached the opener |
| `shadowGates` | `ui.js` | 150 | operational | A-storm2-shell-7, A-storm3-shell-4 | Renames gates beneath an open dialog to refusal.prior.* and back on close, so the contract selector resolves to the live gate; a repaint under the dialog keeps the shadow |
| `dialog` | `ui.js` | 154 | operational | topbar.author → openPinPad (shell.js:85), topbar.search → palette, phone step-up, rail di… | raw.json S5-pin-*.opened {role:dialog, aria-modal:true, label:'Switch author'}, focus pin.key.1; tabwrap forw… |
| `close` | `ui.js` | 161 | operational | Escape, Cancel, overlay click, hashchange, refusal control 'Keep current author', success… | raw.json S5-pin-desk.dana.afterControl {dialogOpen:false, focus:topbar.author}; S6-topbar-*.searchEscape {pal… |
| `onKey` | `ui.js` | 165 | operational | Any key while a dialog is open. | raw.json S5-pin-*.escape {dialogOpen:false}; tabwrap.forwardFromLast = pin.key.1, backFromFirst = pin.cancel. |
| `closeDialogs` | `ui.js` | 185 | operational | A-storm2-shell-5 | Closes every standing dialog through its own close on __proto.reset, so no pad stands over a store that no longer holds its request |
| `section` | `ui.js` | 187 | operational | Screen modules (24 uses in dailyclose, 16 in moneydesk, …); page.evaluate. | raw.json S4-ui.helpers.section: '<section class="card stack" aria-label="Title"><h2>Title</h2><p>x</p></secti… |
| `pageHead` | `ui.js` | 191 | operational | Screen modules; page.evaluate. | raw.json S4-ui.helpers.pageHead.*: h1 + p.sub + div.btnrow with two buttons; title only → no .sub, no .btnrow. |

## Appendix: the rules as the agents read them

### A. Operational

- **A1** Reaching the function through the UI raises no page error and no console error.
- **A2** It does what its name and the calling control's label promise: the store changes (`window.__proto.state()` before vs after) or the DOM changes in the way the label says.
- **A3** A mutation writes one `write` event per table it changes, with `table` and `id`; a gate writes one `refusal` event with `code`, `verb`, `control`.
- **A4** Repeating the same control does not double-write: the second press is refused (`already_decided`, `duplicate_paint`, `already_closed`, `exam_sealed`) or is a visible no-op with its reason.
- **A5** Where a control says Undo or reverses, the store returns to the prior observable state and the log shows a reversal row; nothing is deleted.
- **A6** Every route in CONTRACTS §2 renders for every persona; an unknown id lands on `notfound`; no persona × route × device × theme combination throws.
- **A7** A number on screen is computed from state: change the state through a mutation and the number moves; it is never a literal.
- **A8** Pure helpers return correct values on ordinary, boundary, and null inputs when called directly.

### B. Consistency

- **B1** Test ids: every element with a click or key handler carries `data-testid`, lowercase, dot-separated, `screen.object[.id].control`, id segment a seed id; §4 and the DOM agree both ways.
- **B2** Refusals render only through `Proto.ui.refusal`: verb-first, at most eight words, exactly one 44 px control, a Why disclosure, a §6 code, a severity from the six, and a primary button that switches to Held rather than dimming.
- **B3** Button identities: the same verb carries the same identity (irreversible, reversible, quiet, held) on every screen; an irreversible verb never executes from a keyboard accelerator without its gate.
- **B4** Vocabulary: one canonical word per concept across screens, refusals, announcements, and aria-labels; capitalization and hyphenation do not drift.
- **B5** Severity three ways: glyph + word + fill through `Proto.ui.chip`; a pressed control carries the check mark and `aria-pressed="true"`.
- **B6** Money passes through `Proto.ui.money`; the store holds cents; negatives one way.
- **B7** One date and time format per context; the seed's today is 2026-09-03.
- **B8** Privacy mode turns names into initials everywhere on operatory and shared devices; nothing leaks.
- **B9** Per-user state is keyed by user id, never global.
- **B10** Focus after a route change is on the h1 or first control; dialogs hold focus and Escape closes them; after a mutation focus lands on the next action or state line, never on `body`.
- **B11** Every rendered control is at least 44 × 44 px with at least 8 px to its neighbours at 1280, 1024, 820, and 420 px.
- **B12** Events: `kind` within the §5 enum; `seq` monotonic; `synthetic: true` on keyboard-synthesised clicks; `field: true` on keys typed in inputs.

### C. Clarity

- **C1** One `h1` per screen, naming the place in plain words.
- **C2** Every row has exactly one primary action, labelled with a verb that states what happens.
- **C3** No product-internal nouns or raw ids on screen unless the specification shows them.
- **C4** Empty states say why they are empty and what to do next.
- **C5** Every number carries a label; one fact has one value everywhere it appears.
- **C6** Policy prose never on the finish path.
- **C7** Validation silent until blur.
- **C8** Announcements are one verb line.
