---
title: "Verify: Board Op 3 column overlaps the Checkout queue with the Rail open at 1280 px"
type: review
date: 2026-09-03
source: independent Playwright reproduction against prototype/index.html#/frontdesk/board (lens: clean-run reproduction)
tags: [beta-panel, verify]
---

**Defect key:** `board|board op 3 column overlaps checkout` — reported by bp-01 (seq 108-111) and bp-04 (seq 116-117).

**Verdict: reproduced (P2 stands).** The reporters' cited seq ranges carry no measurement (palette DOB Enter, a `phiAccessLog` write, `rail.close`), so I started from "not real" and measured it myself on a fresh context.

## Evidence (my run, `window.__events` seq 1-3, then a click probe at seq 4-6)

Rail opened via the card's own `board.card.a-1047.rail` button (seq 1-2; `rail.close` focused at seq 3). Measured immediately after seq 3:

| viewport | rail | `.board-layout` grid-template-columns | `.board` columns | Op 3 rect (x..right) | queue x | Op 3 ∩ queue | `board.card.a-1047.checkout` ∩ queue |
|---|---|---|---|---|---|---|---|
| 1280x900 | closed | `872px 360px` | 3 x 282.7 | 605-888 | 904 | 0 | 0 |
| **1280x900** | **open (320 px)** | **`552px 360px`** (two columns kept; `@media (max-width:1279px)` keys on viewport, not canvas) | **3 x 220px = 684 px > 552 px track** | **800-1020** | **904** | **116 px wide x 1095 px tall** | **30.5 px of the 114.5 px button** |
| 1279x900 | open | `927px` (single column) | 3 x 301 | 962-1263 | stacked below (y 1984) | 0 | 0 |
| 1440x900 | open | `712px 360px` | 3 x 229 | 819-1048 | 1064 | 0 | 0 |

`document.elementFromPoint` over a 5x3 grid inside the Checkout button at 1280/rail-open returned `board.queue.row.a-1044` (the queue) at 3 of 15 points (x = 923), confirming the queue paints on top, not just an abstract rect overlap. The canvas has no horizontal scroll (`scrollWidth 960 == clientWidth 960`): the `.board` overflows its `minmax(0,1fr)` grid track and slides under the queue silently. A pointer click at the button's uncovered centre (877,480) still fires (`click board.card.a-1047.checkout` seq 5, route `/frontdesk/checkout/a-1047` seq 6), so the control is degraded, not dead — hence P2 rather than P1.

Numbers match the reporters' (Op 3 800-1020, queue at 904) exactly.

## Contract rule violated

docs/04 "How very intuitive is achieved": **44 px targets with 8 px gaps** (also the docs/12 CI gate "bounding-box check >=44x44 with 8 px gaps on the five flows"). The Checkout control's unobstructed hit area is 84x44 with a negative 30.5 px gap to the neighbouring queue row; every Op 3 card also loses its right 116 px (status chip side) under the queue. CONTRACTS.md itself has no layout section, so the rule cited is docs/04.

Root cause (no fix applied): `css/components.css:193-194` — `.board-layout` switches to one column at `max-width:1279px` on the *viewport*, while the rail removes 320 px from the *canvas*; `.board` has a 684 px minimum (`repeat(3, minmax(220px,1fr))` + 2 x 12 px gaps) that the 552 px track cannot hold. A container query on `.canvas`, or a `min-width: 0`/`overflow-x:auto` on the first track's child, would close it.

## Artifacts

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_board_op_3_column_overlaps_checkout-2.cjs` (run with `NODE_PATH=/opt/node22/lib/node_modules`)
- Result JSON: `.../beta/verify/board_op3_overlaps_checkout-2.result.json`
- Screenshot: `.../beta/verify/op3-overlap-1280-rail-open.png`
