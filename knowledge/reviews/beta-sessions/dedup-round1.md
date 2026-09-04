---
title: "Beta round 1: defect dedup, adversarial verification, and severity"
type: review
date: 2026-09-04
source: 30 session files in this directory, verified by scripts/beta/reproduce.mjs
tags: [beta-panel, dedup, verification]
---

# Round 1 defects: 213 reports, 38 root causes, 28 reproduced

The 30 sessions filed 213 defect reports. Grouping them by screen and root cause leaves 38 distinct claims. Each was then verified adversarially and mechanically rather than by opinion: `scripts/beta/reproduce.mjs` drives the prototype for every claim, takes the default position that the claim is false, and records `reproduced: true` only when it can produce a measurement, a missing selector, or a written row as evidence.

Twenty-eight reproduced. Ten did not stand on a clean run and are listed below with the reason, because a verification exercise that only confirms is worth nothing.

Two of my own probes were wrong and are corrected here: R8 (the author chip) failed a regular expression, not the product, and the chip did print the initials twice; R11 (the plan card rule trace) happened to pick the one patient whose carrier matched the hard-coded string. Both are counted as reproduced.

Severity uses the definitions registered in `docs/14-beta-test-report.md` before the panel ran: **P0** blocks a daily flow or excludes an ability group; **P1** misses a click budget or fails a target, contrast, or keyboard rule; **P2** causes confusion a persona quoted; **P3** is preference.

## Reproduced, and fixed in round 1

| # | Defect (root cause) | Severity | Reported by | Verified | Fix |
|---|---|---|---|---|---|
| R1 | The needs_second verb names "Dr. Reagan or Dr. Kim" while the seed and the phone card say Dana and Dr. Reagan | P1 | bp-06, bp-07, bp-08, bp-09 +1 | reproduced, fixed | prototype/js/store.js evaluateRelease: rank eligible approvers, office manager and owner first |
| R2 | The Checkout Credit tile double-counts an unapplied payment (a $44.00 card payment shows as $88.00 credit) | P1 | bp-01, bp-04, bp-05 | reproduced, fixed | prototype/js/store.js balances and postCheckout: a payment already in the ledger is not counted again as a credit |
| R4 | Saving the screening lane derives the hygiene note as "0 sites probed, deepest 0 mm, bleeding at 0 sites" | P1 | bp-21, bp-22, bp-23, bp-24 +1 | reproduced, fixed | prototype/js/store.js savePerio: derive the screening note from sextant codes |
| R5 | Pressing a procedure chip twice paints a duplicate procedure, and the note scaffold keeps only the last paint | P1 | bp-01, bp-05, bp-09, bp-13 +6 | reproduced, fixed | prototype/js/store.js chartPaint: duplicate guard, and the note accumulates every procedure |
| R6 | A temp's first-shift chips are already retired by another user's events before the day pass exists | P1 | bp-01, bp-04, bp-15, bp-20 +5 | reproduced, fixed | prototype/js/store.js retireChip and railStateFor: one bucket per user |
| R7 | The ping_rate refusal has a nine-word verb and no control, and its code is not in the contract list | P2 | bp-01, bp-02, bp-03, bp-04 +2 | reproduced, fixed | prototype/js/store.js pingChair: eight-word verb and a control |
| R8 | The author chip renders the initials twice on shared and operatory devices ("DH DH · DDS") | P2 | bp-11, bp-13, bp-14, bp-15 +9 | reproduced, fixed | prototype/js/screens/shell.js: the chip prints initials once |
| R9 | A valid PIN for a user with no chart persona (Dana) writes a session row and closes the pad but never switches the author | P1 | bp-01, bp-02, bp-03, bp-04 +12 | reproduced, fixed | prototype/js/screens/shell.js submit: open that person’s session or refuse; never write a session that changes nothing |
| R10 | A wrong PIN is rendered as a hint line, not through the shared refusal component | P2 | bp-28, bp-30 | reproduced, fixed | prototype/js/screens/shell.js: the wrong-PIN verdict renders through the shared refusal component |
| R11 | The plan card's rule trace names Cigna PPO for every patient regardless of the patient's carrier | P1 | bp-11 | reproduced, fixed | prototype/js/store.js chartPaint: the rule trace names the patient’s own carrier |
| R12 | Privacy mode leaves the full patient name in the encounter header and the read-back verb | P1 | bp-14, bp-20 | reproduced, fixed | prototype/js/screens/encounter.js and store.js: privacy mode covers the header and the read-back verb |
| R17 | The glove pad opens below the fold on a 1024x768 operatory tablet and can never share the screen with the active-site line | P1 | bp-21, bp-23, bp-24, bp-25 +5 | reproduced, fixed | prototype/css/components.css .pad-dock: the pad docks in reach |
| R18 | After Save the exam is locked with no amend path: keys do nothing, Screening still looks live, and nothing refuses | P2 | bp-21, bp-22, bp-23, bp-24 +1 | reproduced, fixed | prototype/js/screens/perio.js: a sealed exam offers an addendum and refuses keys with a reason |
| R19 | The Bleed label is wider than its 44 px pad key, eating the 8 px gap to its neighbour | P1 | bp-21, bp-22, bp-23, bp-24 +5 | reproduced, fixed | prototype/css/components.css .pad .btn: the label fits its 44 px key |
| R20 | The omission gate says "1 sites" and the derived note carries the raw licence code (not_tolerated) | P2 | bp-20, bp-21, bp-22, bp-23 +2 | reproduced, fixed | prototype/js/store.js: singular and plural copy, and licence words in the note instead of the raw code |
| R21 | The glove pad has no 0 key (depths of 10 mm and more) and no suppuration key, so a gloved operator cannot enter what the keyboard can | P1 | bp-23 | reproduced, fixed | prototype/js/screens/perio.js pad: 10+ and suppuration keys |
| R22 | The Filed-later queue row carries no Checkout control, so the window cannot check out a patient whose note is unfiled | P0 | bp-01, bp-02, bp-03, bp-04 +1 | reproduced, fixed | prototype/js/screens/board.js: the Filed-later row keeps its Checkout control (safe once the duplicate-decision gate exists) |
| R23 | Hygiene and Restorative appointment chips share one glyph, so in grayscale they differ only by the word | P1 | bp-15, bp-16, bp-17, bp-18 +2 | reproduced, fixed | prototype/js/ui.js GLYPH: six severities, six distinct marks |
| R25 | Keyboard focus drops to the page body after Ping chair, so a keyboard user loses their place | P1 | bp-01, bp-02, bp-03, bp-04 +16 | reproduced, fixed | prototype/js/screens/board.js: focus lands on the row’s primary action after the ping |
| R26 | The write-off entry point is rendered only on some Money Desk tabs, so the scripted path from Denials cannot start | P2 | bp-06, bp-07, bp-08, bp-09 +1 | reproduced, fixed | prototype/js/screens/moneydesk.js: the write-off gate renders on every worklist |
| R29 | Search result rows print the date of birth and last-4 phone before the second-identifier gate asks for them | P1 | bp-01, bp-02, bp-03, bp-04 +1 | reproduced, fixed | prototype/js/screens/palette.js rowSyn: the row no longer prints the identifier the gate asks for |
| R31 | One keyboard activation is counted as two taps: the Enter keydown and the click the browser synthesises from it | P1 | bp-01, bp-04, bp-05, bp-07 +2 | reproduced, fixed | prototype/js/events.js and CONTRACTS §5: synthesised clicks are marked so one activation counts once |
| R32 | The sticky top bar wraps to four or five rows on a phone and covers a quarter of the viewport | P2 | bp-09, bp-12, bp-13, bp-18 +3 | reproduced, fixed | prototype/css/components.css: one scrollable row of chrome under 640 px |
| R33 | Every route change leaves keyboard focus on the page body instead of the new screen | P1 | bp-01, bp-02, bp-03, bp-04 +16 | reproduced, fixed | prototype/js/app.js: the new screen takes focus on every route change |
| R34 | The work canvas keeps the previous screen's scroll offset, so a new screen opens mid-page with its heading off-screen | P2 | bp-05, bp-09, bp-15, bp-18 +8 | reproduced, fixed | prototype/js/app.js: the canvas scroll resets on every route change |
| R35 | The selected state of the collection decision is carried by colour alone: geometry and text are identical to the unselected state | P1 | bp-04 | reproduced, fixed | prototype/js/ui.js btn: a pressed control carries a check mark |
| R37 | IV sedation is charted, charged and planned against a tooth | P2 | bp-16, bp-17, bp-18, bp-19 | reproduced, fixed | prototype/js/store.js WHOLE_PATIENT: services that belong to the visit carry no tooth |
| R38 | The Board card balance and the checkout patient portion disagree for the same visit ($180.00 against $168.00) | P2 | bp-01, bp-02, bp-03, bp-05 | reproduced, fixed | prototype/js/seed.js: a-1046 balance equals the checkout portion |

| # | Claim not reproduced on a clean run | Why it did not stand |
|---|---|---|
| R3 | Post stays live on an already checked-out appointment and writes a second collection decision and a second payment | A second Post was already unreachable; the duplicate-decision gate was added anyway so the refusal is explicit rather than a hidden control. |
| R13 | The read-back gate renders several controls where the contract allows one | The refusal component carried exactly one control; the extra buttons sat outside it, which the contract allows. |
| R14 | The encounter page is wider than a 420 px phone: the odontogram forces the whole page to pan sideways | The page body does not pan: the odontogram scrolls inside its own container, which is what docs/04 asks for. The grid was still made to wrap under 640 px. |
| R15 | Space, the bleeding key, activates the irreversible Save exam whenever focus rests on the Save button | Space on the Save button did not fire the save; the handler already guarded it. |
| R16 | The grid never scrolls the active cell into view, so the lower arch is charted blind below the fold | The active cell was in view after ninety keystrokes. A scroll-into-view was added anyway, because the panel hit it deeper in the arch than this probe reached. |
| R24 | With the Patient Rail open at 1280 px the Board columns overlap the checkout queue | No overlap and no horizontal page scroll with the rail open at 1280 px. |
| R27 | Once appealed, claim c-88 is on no worklist: the biller cannot see or act on it again | The appealed claim stayed on the denial worklist. |
| R28 | Sending a statement gives no visible in-place confirmation; only a screen-reader announcement changes | The canvas text changed in place after Send. |
| R30 | At phone width the palette row hides the target name: the label collapses to nothing | The label rendered at 50 px, not collapsed. |
| R36 | The ledger table overflows its wrapper on a phone and the amount column cannot be reached | The table scrolls inside its own wrapper, which is the required behaviour. |

## Additional defects taken from the accessibility findings

These four came from the per-trait blocker lists rather than the defect fields. Each was fixed in the same round.

| Defect | Reported by | Fix |
|---|---|---|
| The first-shift "show me" pointer exists only as motion, so a persona who turns motion off gets no pointer at all | bp-27, bp-29 | `prototype/js/screens/shell.js` and `css/components.css`: a static ring that survives reduced motion |
| The perio undo trace clears in 1.9 s, under what a slow reader needs | bp-21 | `prototype/js/screens/perio.js`: 4.5 s |
| Focus and the cursor diverge in the screening lane | bp-24 | `prototype/js/screens/perio.js`: focus follows the cursor |
| The day-pass disclosure sits 4 px below the entitlement toggles, inside the 8 px floor | bp-30 | `prototype/css/components.css` |

## Verification after the fixes

`node scripts/beta/reproduce.mjs` reports 0 of 38 reproduced on the fixed prototype, and `node scripts/proto-check.mjs` passes all nine rows, including the 420 px width added because the panel found phone-width defects the original three widths missed.

## Corrections after round 2

Round 2 proved three of the "not reproduced" verdicts above wrong. In each case the probe accepted evidence that did not mean what I took it to mean, and the defect was real all along. The strengthened probes are in `scripts/beta/reproduce.mjs`.

| # | Round-1 verdict | Why it was wrong | Now |
|---|---|---|---|
| R27 | not reproduced | The probe looked for the claim id in the page text. The sentence that names the claim is the same sentence announcing its removal from every worklist. | Reproduced and fixed: appealed claims stay on the denial worklist. |
| R28 | not reproduced | The probe compared canvas text before and after. A row that vanishes changes the text. | Reproduced and fixed: a sent statement confirms in place. |
| R30 | not reproduced | The probe measured a row whose label happened to render, and compared horizontal ranges only. | Reproduced and fixed: the row stacks below 640 px so the name it found always has a line. |
| R15 | not reproduced | The probe pressed Space on an empty chart, where Save refused for an unrelated reason. bp-25 pressed it on a chart ready to save. | Reproduced and fixed: Space belongs to the perio grammar, not to whatever holds focus. |

The round-2 defects, including the three regressions the round-1 fixes caused, are recorded in `docs/14-beta-test-report.md` under Results.
