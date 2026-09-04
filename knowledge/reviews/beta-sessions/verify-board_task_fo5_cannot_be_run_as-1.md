---
title: "Verify: board | task fo-5 cannot be run as written (a-1050 has no queue Checkout control)"
type: review
date: 2026-09-03
source: adversarial verification of beta-panel defect key "board|task fo5 cannot be run as" (reported by bp-01, bp-04, bp-05; also seen by bp-02, bp-03)
tags: [beta-panel, verify]
---

## Verdict

**Not reproduced as a prototype defect (reproduced = false).** The observation is accurate and I reproduced it exactly, but it breaks no stated rule. The mismatch is in the beta task script (`scripts/beta/tasks/front_office.json`, task `fo-5`), which names an appointment the contract itself declares already checked out. The prototype is behaving as CONTRACTS §8 and docs/13 §2 say it should.

## What I observed (my run, seq 1-3)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_task_fo5_cannot_be_run_as-1.cjs`
Screenshots: `board_task_fo5-1.png`, `board_task_fo5-1-row.png` in the same folder.

- Loaded `#/frontdesk/board` (light, desk). `Proto.store.appt('a-1050').status === 'checked_out_unfiled'`, `balanceCents: 0`, `encounterId: 'enc-9010'`.
- `[data-testid="board.queue.row.a-1050"]` contains exactly one testid: `board.queue.row.a-1050.ping` (44 px tall, 113 px wide). `board.queue.row.a-1050.checkout` is **absent** before and after the ping (missing selector, confirmed both probes).
- Row text: "7:30 am · Devon Price · Filed later · Note Open · BL · Claim Held · Note not filed — Bree L. · Ping chair · Paid at the window · in the Filed-later lane until Bree L. files".
- Clicking Ping produced seq 1 (focus on `.ping`), seq 2 (click `.ping`), seq 3 (write `messages` / `msg-1`). Same three-event shape as bp-01 79-81, bp-04 84-86, bp-05 95-98. So step 1 of fo-5 succeeds and its success criterion (a ping message write) is met; step 2 has no target.
- Every other queue row does carry `.checkout`: a-1044 (`in_chart`, note unfiled: has **both** `.ping` and `.checkout`), a-1045, a-1046, a-1047 (`note_filed`). The control is conditional on status, not missing from the screen.

## Why it is not a contract violation

- **CONTRACTS §8** lists `a-1050 / enc-9010` as "Checked out with the note unfiled (Filed-later lane)". The seed is by contract already past checkout; the seed even carries credit `cr-1` (-$95.00, "Checked out unfiled: payment waiting for charges (a-1050)", intent "pending charges on enc-9010"), which is the very end-state fo-5 asks the tester to produce.
- **CONTRACTS §4** is a naming convention ("every element with a click or key handler carries data-testid ... `screen.object[.id].control`"). It enumerates the ids the Board *can* emit; it does not promise that every id renders on every row regardless of state. `board.card.<apptId>.arrive` likewise does not exist on a seated card.
- **docs/13 §2 (Filed-later lane spec)**: "checkout on an unfiled encounter posts the patient payment to unapplied_credit with an allocation intent ... The Board card moves to a bottom 'Filed later' lane until note_filed." A patient already in that lane has already been checked out; showing a second Checkout would invite a duplicate posting. The stamp "Paid at the window ..." is the correct state for that row.
- No docs/04 rule (44 px targets, one verb line + one control, validation silent until blur, no per-person counts) is touched: the ping control measures 44 px, the row renders no refusal, and no counts appear.

Contract rule: **none** — task-script/seed mismatch, not a prototype rule. The three-step fo-5 script (ping → queue checkout → post to unapplied credit) *is* runnable end to end on `a-1044` (Ines Okoro, `in_chart`, note unfiled), which renders both `board.queue.row.a-1044.ping` and `board.queue.row.a-1044.checkout`. The fix belongs in `scripts/beta/tasks/front_office.json` (retarget fo-5 to a-1044, or add a not-yet-checked-out unfiled appointment to the seed), not in the prototype.

## Side observations (not this key)

- `board.js` `doPing()` calls `after(r, ..., 'board.queue.row.' + id + '.checkout')` as the focus target. For a `checked_out_unfiled` row that element never exists, so focus lands on `<body>` after Ping (my probe: `document.activeElement === BODY` after seq 2). That is a real, separate focus-management defect the personas also noted; it should be verified under its own key.
- Several personas probed `#/frontdesk/checkout/a-1050` directly and were allowed to Post a second collection decision on an already-checked-out encounter. Also a separate key.
