---
title: "Verify: board | focus dropped to page body after Ping chair on the Filed-later row"
type: review
date: 2026-09-03
source: adversarial verification (contract-rule lens) of beta-panel defect key "board|focus dropped page body after ping" (reported by bp-01 seq 80-81, bp-05 seq 96-98)
tags: [beta-panel, verify]
---

## Verdict

**Reproduced (reproduced = true), but it breaks no rule stated in CONTRACTS.md or the docs/04 rule list.** The observation is exact: after Ping chair on `a-1050`, `document.activeElement` is `<body>` because `doPing()` in `prototype/js/screens/board.js:87` hands `after()` the focus target `board.queue.row.a-1050.checkout`, and `queueRow()` (board.js:224-225) never renders that control for status `checked_out_unfiled`. It is a genuine focus-management defect against the Board's own documented intent (the `after()` comment at board.js:44: "move focus to a named control"; every sibling handler on the screen re-focuses a rendered control), not a matter of taste. Recommend **P3**, not the proposed P2: mouse users lose nothing functionally, keyboard users lose their place (one Tab from body lands on `board.readiness.toggle` at the top of the page) but are not trapped. One-line fix: fall back to `board.queue.row.<id>.ping` when the `.checkout` control is absent.

## Evidence (my run)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_focus_dropped_page_body_after_ping-1.cjs`
Result JSON and row screenshot (`board_focus_dropped_page_body_after_ping-1.result.json`, `focus_ping-A-row.png`) in the same folder. Fresh context per case, `__proto.reset()`, light theme, desk device, 1280x900.

- **Case A, mouse click (seq 1-3).** Before: `Proto.store.appt('a-1050').status === 'checked_out_unfiled'`; the row contains exactly one testid, `board.queue.row.a-1050.ping` (113x44 px); `board.queue.row.a-1050.checkout` is a **missing selector**. Events: seq 1 focus `.ping`, seq 2 click `.ping`, seq 3 write `messages/msg-1`. After: stamp "Pinged chair 1 · 8:40 am · one-to-one, not broadcast" rendered; `.checkout` still missing; `document.activeElement.tagName === 'BODY'`. No focus event follows the write, and no page errors.
- **Case B, keyboard (seq 2-4).** `.ping` focused (seq 1), Enter: seq 2 key Enter on `.ping`, seq 3 click, seq 4 write `msg-1`. After: `activeElement === BODY`. One Tab press then lands on `board.readiness.toggle` (seq 5-6), i.e. the top of the Board, so a keyboard user is thrown from the Checkout queue back to the readiness strip. Not a keyboard trap.
- **Case C, control (seq 1-4).** `a-1044` (`in_chart`, note unfiled) renders both `.ping` and `.checkout`. Ping there produces seq 4 focus `board.queue.row.a-1044.checkout` and `activeElement` is that button. This is the intended behaviour the a-1050 row misses. Every other queue row (a-1045/46/47, `note_filed`) renders `.checkout`; only the Filed-later row omits it.

Matches the reporters' windows exactly: bp-01 seq 79-81 (focus, click, write; no follow-up focus event) and bp-05 seq 95-98 (focus, Enter, click, write; no follow-up focus event).

## Contract rule

**None stated.** Checked:
- CONTRACTS.md §1-8: no focus-management rule. §4 is a testid naming convention and does not promise `.checkout` on every row. §5 only defines the `focus` event kind.
- docs/04 rule list (44 px targets, one verb line + one control, validation silent until blur, no per-person counts): none touched. The Ping control measures 44 px; no refusal is shown; no counts.
- docs/14 pre-registered "focus: visible focus on 100% of controls; 0 keyboard traps": not breached. Body is not a control, and Tab recovers (no trap).
- docs/13 item 35 / docs/08 Phase 3 "focus-retention rule" (no control moves focus while a field is dirty except by the user's own Go to): Phase 3 scope, and no field is dirty here.

So the defect is real and reproducible but is a code bug against the screen's own internal convention, not a contract violation. Fix in `board.js` `doPing()` (or generalize `after()` to fall back to the triggering control when the named target is absent).

## Side note (not this key)

At 120 ms after the click the first `[aria-live]` region on the page was empty, though `after()` calls `Proto.router.announce('Pinged chair 1')`. I did not chase which region the announcer writes to; if the announcement is also lost, that would be a separate key.
