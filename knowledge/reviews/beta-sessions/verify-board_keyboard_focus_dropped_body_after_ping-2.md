---
title: "Verify: board | Keyboard focus dropped to body after Ping chair on the Filed-later row (a-1050)"
type: review
date: 2026-09-03
source: "adversarial verification (clean-run reproduction lens) of beta-panel defect key board|keyboard focus dropped body after ping, reported by bp-03 (their seq 117-119); independent Playwright rerun"
tags: [beta-panel, verify]
---

## Verdict

**Reproduced (reproduced = true).** On a fresh browser context loading `#/frontdesk/board?theme=light&device=shared`, focusing `board.queue.row.a-1050.ping` and pressing Enter leaves `document.activeElement === document.body`. A second fresh load with a mouse click does the same. A control row in the same queue (`a-1044`, checkoutable, note open) pinged the same way lands focus on `board.queue.row.a-1044.checkout`, so the loss is specific to the `checked_out_unfiled` row type, exactly as the reporter said.

Mechanism, confirmed by reading code (not just the report): `doPing()` at `prototype/js/screens/board.js:87` calls `after(r, ..., 'board.queue.row.' + id + '.checkout')`; `after()` (lines 45-50) re-renders the whole screen, which detaches the focused Ping button, then does `querySelector` on the checkout testid and focuses it only `if (el)`. `queueRow()` (lines 224-225) renders the "Paid at the window" stamp instead of a `.checkout` button when `a.status === 'checked_out_unfiled'` (`seed.js:85` seeds a-1050 that way), so the selector misses and nothing is focused.

## Evidence (my run)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_keyboard_focus_dropped_body_after_ping-2.cjs` (run with `NODE_PATH=/opt/node22/lib/node_modules`; exit 0). Result JSON and screenshot beside it (`.result.json`, `-after-enter.png`). Tab-order probe: `kb-order-probe.cjs` in the same directory.

- Before activation: row `board.queue.row.a-1050` present, status `checked_out_unfiled`, testids inside the row = `[board.queue.row.a-1050.ping]` only; `board.queue.row.a-1050.checkout` selector: **missing**.
- Keyboard path, `window.__events` seq **2-4**: `key Enter` on `board.queue.row.a-1050.ping` (2), `click` on the same testid (3), `write messages msg-1` (4). No `focus` event follows. After: `activeElement.tagName = BODY`, `activeIsBody = true`, `.checkout` selector still missing, `aria-live` reads "Pinged chair 1". No page errors.
- Mouse path (fresh load), seq **1-3**: `focus` ping (1), `click` ping (2), `write messages msg-1` (3); after: `BODY`.
- Control row `a-1044` (has both `.ping` and `.checkout`): after Enter on its ping, active element is `BUTTON` `board.queue.row.a-1044.checkout`.
- Cost to a keyboard user: the next Tab from body lands on `board.readiness.toggle` (index 10 of 100 visible focusables; the ping button is index 93). Returning to the a-1050 Ping button takes **84 Tabs**. The reporter's "Tab from the top of the page" is slightly generous (Chrome resumes near the top of the Board, not at `skip.canvas`), but the effect is the same: place lost.

## Contract rule

`prototype/CONTRACTS.md` has no focus-management section (§4 is testid naming, §5 defines the `focus` event kind, §6 is refusal shape), and none of the docs/04 shorthand rules (44 px targets, one verb line + one control, validation silent until blur, no per-person counts) is touched. The nearest binding statements are docs/14 `focus` row ("visible focus on 100% of controls; 0 keyboard traps" under keyboard-only flows) and the Board code's own convention: every other action handler on the screen (`doArrive` -> `.seat`, `doSeat` -> `board.chair.<n>`, `doReverify` -> `.expand`) re-focuses a control that it knows will exist after re-render; `doPing` names one that does not exist for the row it is on. This is not a preference: activating a control and having the app discard focus is a functional keyboard defect (WCAG 2.4.3 focus order), and it sits on the fo-5 task path.

Severity: P2 as proposed is defensible for keyboard and screen-reader users (84 Tabs to recover, on a busy-morning task); mouse users lose nothing, so P3 would also be arguable. One-line fix: in `doPing`, fall back to `board.queue.row.<id>.ping` (or the row itself) when the `.checkout` control is absent.
