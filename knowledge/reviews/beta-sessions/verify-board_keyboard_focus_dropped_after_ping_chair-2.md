---
title: "Verify #2: Board keyboard focus dropped after Ping chair on a Filed-later row"
type: review
date: 2026-09-03
source: adversarial verifier (reproduction lens) for beta defect "board|keyboard focus dropped after ping chair", reported by bp-02 (their seq 81-83)
tags: [beta-panel, verify]
---

## Verdict

**Reproduced.** On a clean run (fresh load, `__proto.reset()`), focusing `board.queue.row.a-1050.ping` and pressing Enter leaves `document.activeElement === document.body`. The code in `prototype/js/screens/board.js` `doPing()` calls `after(r, ..., 'board.queue.row.' + id + '.checkout')`, but `renderQueueRow` never renders a Checkout button for a `checked_out_unfiled` row (it renders the "Paid at the window" stamp instead), so the selector misses and `after()` silently does nothing; the full re-render has already destroyed the previously focused Ping button node.

## Evidence (my run)

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_keyboard_focus_dropped_after_ping_chair-2.cjs`
- Result JSON and screenshot alongside it (`-2.result.json`, `-2-after-enter.png`).
- `window.__events` seq 1-6 of my run: seq 1 `focus` on `board.queue.row.a-1050.ping`; seq 2 `key` Enter on the same testid; seq 3 `click` on it; seq 4 `write` messages `msg-1`; seq 5 `key` Tab with no testid (focus was on body); seq 6 `focus` lands on `board.readiness.toggle` (top of page), i.e. the keyboard user is thrown back to the start of the Board.
- Measurements: before Enter the row's only control is `board.queue.row.a-1050.ping`; `board.queue.row.a-1050.checkout` does not exist before or after (missing selector). After Enter: `activeElement.tagName === 'BODY'`; the Ping button still exists in the DOM (re-rendered) with the stamp "Pinged chair 1 · 8:40 am · one-to-one, not broadcast" and the live region says "Pinged chair 1". Appointment status remains `checked_out_unfiled`.
- Concurs with verify #1 (`...-1.result.json`), which observed the same body focus and the same next-Tab landing.

## Contract rule

No explicit focus-management rule exists in `prototype/CONTRACTS.md`. The nearest binding rules are: docs/13 item 29 "keyboard-complete worklists" and its cited docs/08 Phase 3 exit "keyboard-only end-to-end test passes for all five daily flows" (the Board queue is a worklist, and a keyboard user loses their place after every ping); and the board code's own stated contract in `after()` ("move focus to a named control"). It is not a preference: the announcement is fine, but a keyboard or screen-reader user must Tab from the top of the Board to get back to the Filed-later lane.

## Severity

P2 as proposed is defensible for keyboard-only staff (docs/13 names them as a persona); the mouse path is unaffected and the action itself succeeds. Fix is one line: fall back to `board.queue.row.<id>.ping` (or the row group) when the checkout control is absent.
