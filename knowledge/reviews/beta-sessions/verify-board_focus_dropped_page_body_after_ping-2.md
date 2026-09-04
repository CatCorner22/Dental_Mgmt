---
title: "Verify: board | focus dropped to page body after Ping chair on the a-1050 Filed-later row"
type: review
date: 2026-09-03
source: adversarial verification (lens: clean-run reproduction) of beta-panel defect key "board|focus dropped page body after ping" (reported by bp-01 seq 80-81, bp-05 seq 96-98)
tags: [beta-panel, verify]
---

## Verdict

**Reproduced (reproduced = true).** On a fresh browser context, opening `#/frontdesk/board` and activating `board.queue.row.a-1050.ping` — by mouse click and separately by focus + Enter — leaves `document.activeElement` on `<body>`. The mechanism the reporters named is correct and confirmed by code reading: `doPing` (`prototype/js/screens/board.js:87`) calls `after(r, ..., 'board.queue.row.a-1050.checkout')`; `after()` (line 45-51) re-renders the screen (which detaches the previously focused Ping button) and then tries `querySelector` on the checkout testid. For `a-1050` the status is `checked_out_unfiled` (`seed.js:85`), so `queueRow` (line 224-225) renders the "Paid at the window" stamp instead of a `.checkout` button; the selector misses, `el.focus()` never runs, and focus is left on the body.

Proposed severity P2 is reasonable for a keyboard or switch user: after Ping they must Tab from the top of the document past the top bar, readiness strip, and every chair card to get back to the queue. It is not a keyboard trap and it does not lose data, so P3 would also be defensible. The fix is one line: fall back to the row's own Ping button (still rendered, 44 px tall) or the `board.queue.row.a-1050` group when the checkout control is absent.

## Evidence (my run)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_focus_dropped_page_body_after_ping-2.cjs` (run with `NODE_PATH=/opt/node22/lib/node_modules`, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`; exit 0, prints `REPRODUCED=true`).

| Mode | window.__events seq | activeElement after | `.checkout` before / after | Ping still rendered | Stamp rendered |
|---|---|---|---|---|---|
| mouse click | 2 (click ping) - 3 (write messages/msg-1) | `BODY` | false / false | yes, 113 x 44 px at (1125, 778) | "Pinged chair 1 · 8:40 am · one-to-one, not broadcast" |
| focus + Enter | 3 (click ping) - 4 (write messages/msg-1) | `BODY` | false / false | yes | same |

No `focus` event follows the click in either run (`focusEventsAfterClick: []`), so the log itself shows focus never landed on a control after the write. The reporters' subsequent `route /frontdesk/checkout/a-1050` events (bp-01 seq 82, bp-05 seq 99) are their own next navigation, not part of this defect.

## Contract rule

No section of `prototype/CONTRACTS.md` states a focus-management rule. The rule it violates is the docs/14 UI-stable `focus` row (visible focus on 100% of controls, keyboard-only flows) read with docs/04's keyboard-first intent, and the prototype's own convention in `after()` ("move focus to a named control"), which `doArrive`, `expand`, `board.chair.<n>`, and `board.readiness.toggle` all honor. Not a preference: activation of a control silently discarding focus is a functional keyboard defect (WCAG 2.4.3 focus order).
