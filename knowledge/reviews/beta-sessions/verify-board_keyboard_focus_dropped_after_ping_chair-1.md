---
title: "Verify: Keyboard focus dropped after Ping chair on the Filed-later queue row"
type: review
date: 2026-09-03
source: beta panel adversarial verification (contract-rule lens) of defect key `board|keyboard focus dropped after ping chair`, reported by bp-02 (their seq 81-83)
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (P2 stands as a keyboard-only defect; not on a five-flow budget path)

Independent reproduction at 1440x900, light theme, desk device, default seed. Unlike the reporter (mouse click), the
button was reached by Tab and activated with Enter, so the run is a true keyboard-user path, and a control row
(a-1044, note open but not yet checked out) was pinged the same way to show the handler works when its focus target exists.

## Evidence (my run, `window.__events` seq 1-8)

| Step | Observation |
|---|---|
| a-1050 before | status `checked_out_unfiled`; the queue row's only control is `board.queue.row.a-1050.ping` (113 x 44 px); `board.queue.row.a-1050.checkout` is absent (the row renders the stamp "Paid at the window · in the Filed-later lane until Bree L. files" instead) |
| seq 1-3 | focus `board.card.a-1050.rail`, key Tab, focus `board.queue.row.a-1050.ping` — activeElement is the Ping button |
| seq 4-6 | key Enter on the Ping button, click `board.queue.row.a-1050.ping`, write `messages/msg-1` (the ping succeeded; stamp "Pinged chair 1 · 8:40 am · one-to-one, not broadcast"; live region "Pinged chair 1") |
| after re-render | `document.activeElement === document.body` (tag BODY, no data-testid). A fresh Ping button exists in the DOM but nothing focused it. Missing selector: `[data-testid="board.queue.row.a-1050.checkout"]` — the element `after()` tries to focus |
| seq 7-8 | one more Tab lands on `board.readiness.toggle`, the first control in the canvas: the keyboard user is thrown back to the top of the Board and must Tab through the readiness strip, chair strip, and every operatory card to get back to the queue |
| control (a-1044) | same Tab/Enter ping: activeElement after re-render is `board.queue.row.a-1044.checkout` (focus kept, seq 1-5 of the reset run) — the bug is specific to rows without a Checkout button, which is exactly every Filed-later row |

Screenshot: `.../verify/board_keyboard_focus_dropped_after_ping_chair-1-after-ping.png`; raw data in the same basename `.result.json`.

## Mechanism

`prototype/js/screens/board.js:87` — `doPing` always calls
`after(r, ..., 'board.queue.row.' + id + '.checkout')`. `after()` (line 45-49) rebuilds the screen with `render(r)`
(which detaches the focused Ping button, so the browser drops focus to body) and then focuses the named testid only
`if (el)`. `queueRow` (line 224-225) renders the Checkout button only when `a.status !== 'checked_out_unfiled'`; for a
Filed-later row it renders a `.stamp` instead. The success and refusal branches both hit this path, so the second
(rate-limited) ping drops focus as well. Every other Board mutation (`doArrive` → `.seat`, `doSeat` → `board.chair.n`,
`doReverify` → `.expand`, chair/expand toggles) refocuses a control that exists; Ping on a Filed-later row is the one
that does not. A one-line fix is to focus `board.queue.row.<id>.ping` (or the checkout button when present).

## Contract rule

Not in CONTRACTS.md (it has no focus rule; §6 covers refusal shape only). The rule broken is the **Keys layer** that the
docs/04 amendment of 2026-09-03 adds to "How 'very intuitive' is achieved" ("add the Refusal component, the copy catalog
rules, device-profile density, and the Keys layer"), specified in docs/13 item 29 for "keyboard-only or screen-reader
staff" against the drift where "worklists are mouse-only". Dropping focus to body after a worklist action makes the
Checkout queue mouse-only in practice: a keyboard user loses their place after every Filed-later ping. It is also the
prototype's own stated behaviour (`board.js:44` "move focus to a named control"), which the reporter praised for
Arrive → Seat and which fails here. The docs/14 claim "5 of 5 daily flows complete keyboard-only" is not contradicted
(Ping is not one of the five flows), so this is a real defect but not a flow-budget failure; P2 is fair for a keyboard-only
front-desk user, P3 would be defensible on reach.

## Reporter evidence

bp-02 seq 81-83 (click ping, write msg-1, then a new focus event on ping only because their script clicked it again) carries no
activeElement measurement; the measurement here is independent and confirms the claim.

## Script

`/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_keyboard_focus_dropped_after_ping_chair-1.cjs`
(results `.result.json`, screenshot `-after-ping.png`, same basename).
