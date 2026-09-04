---
title: "Verify: board | keyboard focus dropped to body after Ping chair on a Filed-later row"
type: review
date: 2026-09-03
source: adversarial verification (contract-rule lens) of beta-panel defect key "board|keyboard focus dropped body after ping" (reported by bp-03 seq 117-119)
tags: [beta-panel, verify]
---

## Verdict

**Reproduced (reproduced = true) as a code defect; it breaks no rule stated in CONTRACTS.md or the docs/04 rule list.** Activating `board.queue.row.a-1050.ping` by keyboard (focus + Enter) or by mouse leaves `document.activeElement === document.body`. Mechanism, confirmed in source: `doPing()` at `prototype/js/screens/board.js:87` calls `after(r, ..., 'board.queue.row.' + id + '.checkout')`; `after()` (board.js:45-51) re-mounts the whole Board (the focused button node is detached, so focus falls to body) and then focuses the named testid only `if (el)`. `queueRow()` (board.js:224-225) renders `.checkout` for every queue status except `checked_out_unfiled`, which gets the "Paid at the window · in the Filed-later lane" stamp instead. So for a-1050 the focus target is a **missing selector** and nothing is focused. Same key as the already-verified `board|focus dropped page body after ping` (bp-01, bp-05); bp-03's report adds the keyboard framing, which I confirmed. Recommend **P3**, not the proposed P2: no keyboard trap, no data loss, one Tab recovers focus (to the top of the Board). One-line fix: fall back to the `.ping` control when `.checkout` is absent, or have `after()` fall back to the triggering control.

## Evidence (my run)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_keyboard_focus_dropped_body_after_ping-1.cjs`
Result JSON `board_keyboard_focus_dropped_body_after_ping-1.result.json` and screenshot `board_keyboard_focus_dropped_body_after_ping-1-after-enter.png` in the same folder. Fresh context per case, default seed, light theme, shared device (as the reporter), 1440x900.

- **Case A, keyboard, seq 1-4.** Before: `Proto.store.appt('a-1050').status === 'checked_out_unfiled'`; `[data-testid="board.queue.row.a-1050.checkout"]` absent. Focus `.ping` (seq 1 focus), Enter (seq 2 key Enter on `.ping`, seq 3 click, seq 4 write `messages/msg-1`). After: old button `isConnected === false`, new `.ping` rendered, `.checkout` still absent, stamp "Pinged chair 1 · 8:40 am · one-to-one, not broadcast" rendered, `activeElement.tagName === 'BODY'`, no `focus` event after the write. Next Tab (seq 5-6) lands on `board.readiness.toggle`, the first control in the Board, i.e. the keyboard user is thrown from the Checkout queue to the top of the page (the first focusable on the page is a top-bar link, so it is not literally "from the top of the page", but it is the top of the Board canvas). Not a trap.
- **Case B, mouse, seq 1-3.** Same result: `activeElement === BODY`, `.checkout` missing.
- **Case D, Held second ping, seq 4-7.** Enter on `.ping` again yields seq 7 refusal `ping_rate` ("Already pinged this chair in the last 15 minutes"); focus is dropped to body on the refusal path too, so the refusal component's verb/control are not reachable from where the user was.
- **Case C, control, seq 1-5.** `a-1044` (`in_chart`, note open) renders both `.ping` and `.checkout`; Enter on its `.ping` ends with `activeElement` = `board.queue.row.a-1044.checkout` (seq 5 focus). The focus hand-off works wherever the target exists; only the Filed-later row shape lacks it.

Matches bp-03's window seq 117-119 (click, write, then a fresh focus event only because the reporter re-focused `.ping` before the second click).

## Contract rule

**None stated; closest are roadmap criteria, not binding contracts.** Checked:
- CONTRACTS.md §1-8: no focus-management rule. §4 names `board.queue.row.<apptId>.checkout` as a testid that exists on the Board but does not promise it on every row. §5 defines the `focus` event kind only. §6 (refusals) says nothing about where focus rests after a gate.
- docs/04 rule list: 44 px targets (Ping is 44 px), one verb line + one control (refusal is well-formed), validation silent until blur (no field), no per-person counts (none): none touched.
- docs/14 pre-registered checks: "5 of 5 daily flows complete keyboard-only" (ping is not in the five flows) and "0 keyboard traps" (Tab recovers). Not breached.
- docs/13 item 29 (gate contract: "worklists are mouse-only" as the failure to prevent) and docs/08 Phase 3 exit "keyboard-only end-to-end test passes" express the intent this bug offends, but they are Phase 1/3 roadmap items, not a rule the prototype is bound to today. docs/13 item 35 (focus-retention while a field is dirty) does not apply; no field is dirty.

Verdict: real, reproducible focus-management bug against the screen's own `after()` convention ("move focus to a named control"); severity P3; no contract violation to cite. Fix in `board.js` `doPing()`.
