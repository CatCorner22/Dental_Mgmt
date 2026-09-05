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

_Pending: the audit workflow is running. This section is appended when it completes and nothing above the line changes._

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
