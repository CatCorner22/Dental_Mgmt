---
title: "Verify: task fo-5 cannot be run as written (a-1050 seeded checked_out_unfiled)"
type: review
date: 2026-09-03
source: adversarial verification, reproduction lens; clean Playwright run against prototype/index.html
tags: [beta-panel, verify]
---

# Verdict: reproduced (as a task-script / seed mismatch, not a board rendering bug)

Defect key: `board|task fo5 cannot be run as`. Reported by bp-01 (seq 79-81), bp-04 (84-86), bp-05 (95-98).

## What I ran

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_task_fo5_cannot_be_run_as-2.cjs`
(result JSON and screenshots `fo5-before-ping.png`, `fo5-after-ping-no-checkout.png` beside it).

Fresh Chromium context, 1280x900, light theme, desk device, `window.__proto.reset()` before any interaction, route `#/frontdesk/board`. Did not reuse any reporter script.

## Evidence from my run

- Seed: `appointments[a-1050].status === 'checked_out_unfiled'` (matches `prototype/js/seed.js:85` and CONTRACTS.md section 8, "Checked out with the note unfiled (Filed-later lane)").
- Before any tap, `board.queue.row.a-1050` is present; its only descendant with a testid is `board.queue.row.a-1050.ping` (44 px tall, 113x44 at 1125,778). `board.queue.row.a-1050.checkout` is **absent** (`querySelector` returns null); so is `board.card.a-1050.checkout`. Row stamp: "Paid at the window · in the Filed-later lane until Bree L. files".
- Step 1 (`board.queue.row.a-1050.ping`): my seq 1-3 — focus, click, then `write messages msg-1` (`kind: board.ping_chair`, to "chair 1"). The row gained the stamp "Pinged chair 1 · 8:40 am · one-to-one, not broadcast". Step 1 behaves as the task's success text describes.
- Step 2 (`board.queue.row.a-1050.checkout`): `waitForSelector` with a 1500 ms bound timed out; the element never exists for this status, before or after the ping. No further events are possible, so `checkout.post` (step 3) is unreachable from the script. seq window for the whole attempt: 1-3.
- Cause is in code, not in timing: `prototype/js/screens/board.js:224-225` renders the stamp for `checked_out_unfiled` **instead of** the Checkout button (`if (a.status === 'checked_out_unfiled') ... else if (!outage) ...checkout`). This is intentional: the patient has already paid at the window.
- Queue survey on the same clean load: `a-1044` (status `in_chart`, note unfiled) is the only row that carries **both** `.ping` and `.checkout`; `a-1045/6/7` (`note_filed`) carry only `.checkout`.

## Contract rule

None violated by the prototype itself. The board honours CONTRACTS.md section 8 (a-1050 is already checked out) and section 4 lists `board.queue.row.<apptId>.checkout` as an available testid without promising it for every status. The defect is an internal inconsistency in the beta harness: `scripts/beta/tasks/front_office.json` task `fo-5` step 2 demands a control that the contract's own seed definition for a-1050 precludes. Three personas lost the task for a reason that has nothing to do with their behaviour, so it is a real P2 for the panel's measurement, filed against the task script (or the seed), not against the board screen.

## Suggested fix target (not applied)

Either retarget fo-5 to a patient who is out of the chair with the note unfiled and not yet checked out (a-1044 has that shape today, though it is also the fo-2 / flow 4 $44 checkout patient), or seed a dedicated appointment in `in_chart` with `noteFiled: false`, and keep a-1050 as the already-paid Filed-later exemplar. Adjacent observation, already filed separately by bp-01: after the ping `document.activeElement` is `BODY` because `doPing` focuses `board.queue.row.a-1050.checkout`, which does not exist for this status (`board.js:87`).
