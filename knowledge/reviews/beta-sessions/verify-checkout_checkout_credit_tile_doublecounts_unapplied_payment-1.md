---
title: "Verify: Checkout Credit tile double-counts an unapplied payment ($44 card payment shows as $88 Credit)"
type: review
date: 2026-09-03
source: adversarial verification of beta-panel defect `checkout|checkout credit tile doublecounts unapplied payment` (reported by bp-01, bp-04, bp-05); own Playwright run against prototype/index.html
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (contract violation, P1 stands)

Lens: contract-rule. Default position was "not real"; the independent run reproduced the reporters' failure exactly.

## Repro (own script, not the reporters')

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_checkout_credit_tile_doublecounts_unapplied_payment-1.cjs`

1. `#/frontdesk/board` -> `board.card.a-1044.checkout` (Ines Okoro, p-303, enc-9003 note unfiled).
2. Collect pre-selected (`checkout.collect.seg.collect` aria-checked=true); `checkout.tender.card`; typed 16 digits into `checkout.card.number`; `checkout.post`.

## Evidence (my run's `window.__events`)

- Post transaction: seq 25 (click `checkout.post`) through seq 30; ledger write `le-5000` at seq 26, `allocationIntents ai-1` at seq 27, `collectionDecisions cd-1` at seq 28.
- Before Post, `.threenum[aria-label="Account balance"]` read `$0.00 Patient due / $0.00 Waiting on insurance / $0.00 Credit`; p-303 ledger nets to 0 (charge 21700, insurance -15600, -6100).
- After Post the same tile read `$0.00 Patient due / $0.00 Waiting on insurance / $88.00 Credit` (element rect 1100x65.8 at y=160, so the tile is the visible one).
- `Proto.store.balances('p-303')` returned `{patientDue: 0, insurancePending: 0, credit: 8800}`.
- State after Post: exactly one new ledger row `le-5000 patient_payment -4400 gl=unapplied_credit tender=card`, and one `S.credits` row `cr-2 -4400 "Checked out unfiled: payment waiting for charges (a-1044)"`.
- The Posted card lists one payment: "Payment $44.00 by card · held as credit until the note is filed · le-5000".
- Money Desk Credits tab (biller) shows "Ines Okoro $44.00 credit" for the same event, so the prototype disagrees with itself: $44 on Money Desk, $88 on Checkout.

## Mechanism (prototype/js/store.js, not edited)

`balances()` (store.js:31-45) folds the `patient_payment` row into `patientDue`, flips a negative `patientDue` into `credit` (4400), then adds every `S.credits` row for the patient (`credit += -cr.amountCents`, another 4400). `postCheckout` (store.js:116) writes both the unapplied ledger row and the `S.credits` row for the same unfiled-note payment, so any Collect on an unfiled note is double-counted. The seeded Devon Price credit (cr-1, p-307) has no matching ledger row, which is why the bug only appears after a live Post.

## Contract rule violated

- `docs/03-data-model.md` line 16: balances come from the `account_balances` view over `ledger_entries` (patient due, pending insurance, unapplied), with the `unapplied_credit` gl bucket as the single source for the unapplied number; the store's own header comment says "Balances: three numbers from ledger rows; estimates never join." The Credit tile must equal the unapplied ledger amount ($44.00); it shows twice that.
- `docs/04-ux-blueprint.md` flow 4 / Explain contract: the three numbers and the Posted list must describe the same posting. One $44.00 payment listed, $88.00 Credit shown.

Not a preference: it is a wrong money figure shown to the front desk (and via `checkout.showpatient`, to the patient).

## Notes

- The reporters' cited ranges (bp-01 34-40, bp-04 37-42, bp-05 40-45) show the same write sequence (`le-5000`, `ai-1`, `cd-1`, `frs-checkout`, `frs-payment`); my run's equivalent is seq 25-30.
- Suggested fix direction (for the prototype owner, not applied): derive the Credit number from ledger rows only, or exclude `S.credits` rows whose payment already exists as a `gl: 'unapplied_credit'` ledger row.
