---
title: "Verify: Board Op 3 column overlaps the Checkout queue with the Rail open at 1280 px"
type: review
date: 2026-09-03
source: beta panel adversarial verification (contract-rule lens) of defect key `board|board op 3 column overlaps checkout`, reported by bp-01 and bp-04
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (P2 stands)

Independent reproduction at 1280x900, dark theme, desk device, default seed. The rail was opened by a different
path from the reporters (the card's own `board.card.a-1047.rail` button, not the Ctrl-K palette) and the overlap
is the same.

## Evidence (my run, `window.__events` seq 1-4)

| Measurement | Rail closed | Rail open |
|---|---|---|
| `.canvas` width | 1280 px | 960 px |
| `.board-layout` computed `grid-template-columns` | `872px 360px` | `552px 360px` (still two columns) |
| `.board` computed columns | `282.7px x3` | `220px 220px 220px` (3 x 220 + 2 x 12 gap = 684 px in a 552 px track) |
| Operatory 3 `.opcol` rect | x 605-888 | x 800-1020 |
| Checkout queue `.queue` rect | x 904-1264 | x 904-1264 |
| Op 3 right edge minus queue left edge | -16 px (8 px gap honoured) | **+116 px overlap** |
| `board.card.a-1047.checkout` rect | x 625-740 | x 820-934, 44 px tall |
| Button area under the queue | 0 | **30 x 44 px (1320 px^2)** |
| `elementFromPoint` at the button's right edge | - | `small muted` (queue text), not the button |
| Real mouse click 4 px inside the button's right edge | - | landed on `board.queue.row.a-1044` (seq 4); hash stayed on `#/frontdesk/board`, checkout did not open |

Events from my run: seq 1 focus `board.card.a-1047.rail`, seq 2 click `board.card.a-1047.rail`, seq 3 focus `rail.close`,
seq 4 click `board.queue.row.a-1044` (the mis-tap). Screenshot: `.../verify/board_board_op_3_column_overlaps_checkout-1-railopen.png`.

## Mechanism

`css/components.css`: `.board-layout` collapses to one column only under `@media (max-width: 1279px)` and `.board`
drops to two operatory columns only under `@media (max-width: 1023px)`. Both are viewport queries. At exactly 1280 px
neither fires, but the 320 px `.rail` shrinks the canvas to 960 px, so the 552 px board track receives a 684 px
minimum-width three-column grid and Operatory 3 overflows into the 360 px queue column. Nothing clips or scrolls
(`canvas.scrollWidth` = 960 = `clientWidth`), so the overflow is a silent visual and hit-target overlap.

## Contract rule violated

docs/04 "How very intuitive is achieved": **44 px targets with 8 px gaps**. The Checkout target for a-1047 is 44 px
tall but 30 of its 114 px width is occluded by a different patient's queue row; the gap between the two controls is
negative, and a tap inside the Checkout button's own rectangle activates `board.queue.row.a-1044` instead. It also
undercuts "every row has exactly one primary action" because the visible Checkout control for a-1047 does not reliably
perform that action. Not a preference: it is a measurable target-overlap defect with a wrong-patient mis-tap.

Note: CONTRACTS.md (routes, state, test ids, event log, refusals, flows, seed ids) has no layout section; the rule is
the docs/04 blueprint rule that the prototype claims to implement.

## Reporter evidence

bp-01 seq 108-111 and bp-04 seq 116-117 only record the palette DOB confirm, the `phiAccessLog` write and (bp-01) the
`rail.close` click; they contain no measurement. The reproduction here supplies the measurement independently.

## Script

`/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_board_op_3_column_overlaps_checkout-1.cjs`
(results: same basename `.result.json`, screenshot `-railopen.png`).
