---
title: "Verify: board | Filed-later queue row has no Checkout control (a-1050)"
type: review
date: 2026-09-03
source: "beta panel defect board|filedlater queue row has no checkout, reported by bp-02 (seq 85-86) and bp-03 (seq 116-119); independent Playwright rerun"
tags: [beta-panel, verify]
---

## Verdict

**Not reproduced as a prototype defect (reproduced = false).** The observation is accurate: `board.queue.row.a-1050.checkout` is not in the DOM and fo-5 step 2 cannot run. But the omission is deliberate, per-status behaviour that follows the contract; the rule break is in the beta task script, which names a patient the contract itself defines as already checked out. Contract rule violated by the prototype: **none**.

## Evidence (my run, fresh context, light/desk, default seed)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_filedlater_queue_row_has_no_checkout-1.cjs` (result JSON and two screenshots alongside it, same basename).

- `Proto.store.appt('a-1050').status === 'checked_out_unfiled'`, encounter `enc-9010`, matching `js/seed.js:85`.
- Testids inside `board.queue.row.a-1050`: only `board.queue.row.a-1050.ping`. `document.querySelector('[data-testid="board.queue.row.a-1050.checkout"]')` is null before and after the ping. Row rect 334 x 180 px at (1077, 697); stamp reads "Paid at the window · in the Filed-later lane until Bree L. files".
- Control across the whole Checkout queue: a-1044 (`in_chart`) renders ping + checkout; a-1045, a-1046, a-1047 (`note_filed`) render checkout. Zero checkoutable rows lack `.checkout`; zero `checked_out_unfiled` rows have it. The omission is per-status, not a rendering fault.
- Driving fo-5 as written: `window.__events` seq **1-3** (focus `.ping`, click `.ping`, write `messages/msg-1`); then `board.queue.row.a-1050.checkout` click timed out (locator never attached). Same shape as bp-02 83-85 and bp-03 116-118.
- Source: `js/screens/board.js:224-225` renders the stamp when `a.status === 'checked_out_unfiled'` and the Checkout button otherwise.

## Why it is not a contract violation

- CONTRACTS §8 defines `a-1050 / enc-9010` as "Checked out with the note unfiled (Filed-later lane)". The seed also carries credit `cr-1` (-$95.00, "payment waiting for charges (a-1050)"), i.e. the checkout fo-5 asks for has already happened. Offering a second Checkout on a paid, checked-out visit would be the wrong behaviour.
- CONTRACTS §4 lists `board.queue.row.<apptId>.checkout` as a testid the queue row can carry; it does not promise it for every status, any more than `board.card.<apptId>.arrive` is promised on a seated card.
- docs/13 §2: the card "moves to a bottom 'Filed later' lane until note_filed" and the front desk gets one line and one control (Ping chair) on an unfiled note. The row shows exactly that.

## Where the real defect lives

`scripts/beta/tasks/front_office.json` task `fo-5` step 2 targets `board.queue.row.a-1050.checkout`, which the contract's own seed precludes. Retarget fo-5 to a not-yet-checked-out unfiled patient (a-1044 renders both `.ping` and `.checkout` today) or seed a dedicated `in_chart` / `noteFiled: false` appointment, and keep a-1050 as the already-paid exemplar. Adjacent, separately filed: after the ping `document.activeElement` is `BODY` because `doPing` (`board.js:87`) focuses the non-existent `.checkout`; my run reproduced that too.
