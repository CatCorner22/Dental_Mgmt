---
title: "Verify (reproduction lens): board | Filed-later queue row has no Checkout control (a-1050)"
type: review
date: 2026-09-03
source: "beta panel defect board|filedlater queue row has no checkout, reported by bp-02 (seq 85-86) and bp-03 (seq 116-119); independent clean-run Playwright reproduction, second verifier"
tags: [beta-panel, verify]
---

## Verdict

**reproduced = false.** The reporters' observation is accurate on a clean run: `board.queue.row.a-1050.checkout` is never in the DOM and fo-5 step 2 times out. But that absence is the prototype doing what the contract's own seed requires. `a-1050` is seeded `checked_out_unfiled` (CONTRACTS §8: "Checked out with the note unfiled (Filed-later lane)") with credit `cr-1` (-$95.00, "payment waiting for charges (a-1050)") already on the account. The visit has been paid and checked out; offering a second Checkout would be the defect. The row shows exactly what docs/13 §2 specifies for an unfiled note at the desk: one line ("Note not filed — Bree L.") and one control (Ping chair). Contract rule violated by the prototype: **none**. The break is in `scripts/beta/tasks/front_office.json` fo-5 step 2, which targets a control the seed precludes.

## Evidence (my run, fresh contexts, default seed)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_filedlater_queue_row_has_no_checkout-2.cjs` (result JSON and screenshots `-desk.png`, `-shared.png`, `-after-ping.png` alongside, same basename).

- Clean load, desk/light (bp-02's profile) and shared/light (bp-03's profile), each probed before and after a reload: row `board.queue.row.a-1050` present, rect 334 x 180 px at (1077, 697); testids inside the row = `[board.queue.row.a-1050.ping]` only; `document.querySelector('[data-testid="board.queue.row.a-1050.checkout"]')` is null in all four snapshots. Ping button 113 x 44 px. Stamp text "Paid at the window · in the Filed-later lane until Bree L. files". Store: `status = checked_out_unfiled`, `enc-9010` open, `noteFiled = false`, `balanceCents = 0`, credit `cr-1 -9500`.
- Scripted fo-5 on desk: `window.__events` seq **1-3** (focus `.ping`, click `.ping`, write `messages/msg-1`); step 2 `page.click('[data-testid="board.queue.row.a-1050.checkout"]')` timed out at 1500 ms, selector never attached. Same shape as bp-02 83-86 and bp-03 116-118. After the ping, `document.activeElement` is `BODY` (the separately filed focus defect; `board.js:87` targets the absent `.checkout`).
- Queue survey, same page: a-1050 `checked_out_unfiled` ping yes / checkout no; a-1044 `in_chart` ping yes / checkout yes; a-1045, a-1046, a-1047 `note_filed` checkout yes. Every checkoutable row carries `.checkout`; the only row without it is the only already-checked-out row.
- Counterfactual: setting `Proto.store.appt('a-1050').status = 'in_chart'` and calling `Proto.router.render()` makes the same row render `board.queue.row.a-1050.checkout` plus the line "Checkout works now; charges post when the note files."; restoring the status removes it again. The control exists in the row template (`board.js:224-225`) and is gated only on status.

## Why it is a script defect, not a prototype defect

- CONTRACTS §4 lists `board.queue.row.<apptId>.checkout` as a testid the queue row can carry, the same way it lists `board.card.<apptId>.arrive`; neither is promised for every status.
- CONTRACTS §8 and `js/seed.js:85,210` define a-1050 as already checked out with money held as unapplied credit. fo-5's own success line ("checkout posts to unapplied credit (allocationIntents write)") describes the transition a-1050 has already completed in the seed.
- docs/13 §2: unfiled note at the desk = one line + one control (Ping chair); card moves to the Filed-later lane until `note_filed`. Observed row matches.

## Recommendation

Retarget fo-5 step 2 to an unfiled, not-yet-checked-out patient (a-1044 `in_chart` renders both `.ping` and `.checkout` today) or seed a dedicated `in_chart`/`noteFiled:false` appointment for the task; keep a-1050 as the already-paid Filed-later exemplar. The ping-then-focus-to-`BODY` behaviour and the direct-route "Post again on an already checked-out visit" probe are separate findings and are not part of this verdict.
