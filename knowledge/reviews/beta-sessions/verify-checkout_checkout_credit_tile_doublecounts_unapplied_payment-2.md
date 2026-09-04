---
title: "Verify: Checkout Credit tile double-counts an unapplied payment ($44 card payment shows as $88 Credit)"
type: review
date: 2026-09-03
source: adversarial verifier (reproduction lens), independent Playwright run against prototype/index.html
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (P1 upheld)

Defect key: `checkout|checkout credit tile doublecounts unapplied payment`. Reported by bp-01, bp-04, bp-05.
Default position was "not real"; a clean run reproduced it exactly.

## What I did

Fresh Chromium context, `window.__proto.reset()`, light theme, desk device. Board -> `board.card.a-1044.checkout` (Ines Okoro, note unfiled) -> Collect pre-selected (`aria-pressed="true"`) -> `checkout.tender.card` -> typed 16 digits into `checkout.card.number` -> `checkout.post`. Then read the three-number tiles, the Posted list, the store, `window.__events`, and cross-checked the Money Desk Credits tab and the `ledger/p-303` route.

## Evidence (my run)

- Event seq range 23-30: seq 24 `click checkout.post`; seq 25 `write ledger le-5000`; seq 26 `write allocationIntents ai-1`; seq 27 `write collectionDecisions cd-1`; seq 28-29 `firstRunState`. No `error` events.
- Before Post the tiles read Patient due $0.00 / Waiting on insurance $0.00 / Credit $0.00 (seed ledger for p-303: charge 21700, insurance -15600 and -6100, net 0; `S.credits` empty for p-303).
- After Post the Credit tile reads **$88.00** (`.threenum .n` labelled Credit, 361 x 66 px). The ledger holds exactly one new row: `le-5000 patient_payment -4400 gl=unapplied_credit tender=card`. `S.credits` holds one new row `cr-2 -4400`. `Proto.store.balances('p-303')` returns `{patientDue: 0, insurancePending: 0, credit: 8800}`.
- The Posted list on the same screen says "Payment $44.00 by card - held as credit until the note is filed - le-5000" and "Allocation intent $44.00 ...". One payment, two dollar figures.
- Cross-surface contradiction: Money Desk `money.tab.credits` shows "Ines Okoro - $44.00 credit"; the `ledger/p-303` route and Patient Rail show Credit $88.00 while the ledger table lists a single "Payment card Priya Raman -$44.00".

## Mechanism (store.js `balances`, lines 31-45)

The unapplied payment row makes `patientDue` -4400, which the function flips into `credit = 4400`; it then loops `S.credits` and adds the `cr-*` row `postCheckout` pushed for the same payment (`credit += -cr.amountCents`), giving 8800. The same payment is counted from two tables. Any Filed-later checkout with a collected payment will double the Credit tile; the seeded `cr-1` (p-307, a-1050) is the same shape and is worth checking.

## Contract rule violated

docs/04 UX blueprint: balance shown as "three labeled numbers with Explain"; store.js states the rule as "Balances: three numbers from ledger rows; estimates never join." A number that is not the ledger sum breaks that rule, and CONTRACTS.md section 7 flow 4 / section 8 (`a-1044`, "$44 patient portion") is the exact contract path on which it happens. Not a preference: the figure is factually wrong by 2x on a money surface and disagrees with the Money Desk on the same store.

## Script and artifacts

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_checkout_credit_tile_doublecounts_unapplied_payment-2.cjs`
- Result JSON: same directory, `checkout_credit_doublecount-2.result.json`
- Screenshots: `dc-1-before-post.png`, `dc-2-after-post.png`, `dc-3-money-credits.png`, `dc-4-ledger-route.png`
