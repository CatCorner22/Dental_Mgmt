---
title: "Verify: Samir Haddad (a-1046) Board Details Balance $180.00 vs Checkout $168.00 / Patient due $0.00"
type: review
date: 2026-09-03
source: adversarial verifier run (contract-rule lens) against prototype/index.html, fresh seed, desk, light
tags: [beta-panel, verify]
---

# Verdict: reproduced (P3 stands; seed/contract inconsistency, not a preference)

Defect key: `checkout|samir haddad board details says balance`. Reported by bp-01 (seq 55-57) and bp-05 (seq 64-67); the same reading also appears in bp-02 and bp-03.

## What I observed (my run, window.__events)

- seq 1-3: `board.card.a-1046.expand` on `#/frontdesk/board`. `#board-details-a-1046` renders the line **"Balance $180.00 · patient portion, estimate separate"** (board.js:151, from `a.balanceCents` = 18000).
- seq 4-6: `board.card.a-1046.checkout` → route `/frontdesk/checkout/a-1046`. Tiles (`.threenum`, aria-label "Account balance"): **$0.00 Patient due / $0.00 Waiting on insurance / $0.00 Credit**. Table rows: Limited exam D0140 $90.00, Bitewings D0274 $78.00. Footer: **"$168.00"** fee total, **"$168.00 est."**, "Estimate is separate from the balance above; it never enters the ledger." `checkout.amount` prefilled **168.00**.

Store ground truth (`window.__proto.state()` after `reset()`): `appointments[a-1046].balanceCents` = 18000; `estimates['a-1046'].patientCents` = 16800; procedures pr-421 (9000) + pr-422 (7800) = 16800; ledger rows for p-305: none, so `Proto.store.balances('p-305').patientDue` = 0.

Three different numbers for one appointment come from three unrelated seed sources: a hand-typed `balanceCents` (18000), the CDT fee schedule (16800), and the ledger (0, because `note_filed` charges are released only at Post, store.js:103). The Board line explicitly labels the $180 as the "patient portion", and the checkout footer labels $168 as the patient portion estimate.

## Contract rule

CONTRACTS.md §8 (Seed ids the scripts rely on): `a-1046 / p-305 | Samir Haddad, pays a $180 exam in full ...`. The seed table binds the prototype, the stability checks and the panel scripts; the checkout renders a $168 exam (fees and estimate) while the Board and the task sheet (scripts/beta/tasks/front_office.json fo-4) carry the contracted $180. Either the fee schedule/estimate or `balanceCents`/§8 is wrong; they cannot both satisfy §8. Secondary: docs/04 §26 requires the estimate column to be "separate from balance" — that separation is honoured on both screens, so the defect is the disagreement of the balance figure itself between Board ($180) and Checkout ($0), not the layout.

For comparison, a-1047 is consistent (balanceCents 41000 = ledger 118000 − 59000 − 18000 = estimate 41000); a-1046 is the odd one out (a-1044 has a similar $44-vs-$0 tile disagreement, tracked separately).

## Not a preference

The reporters were not asking for a different presentation; they observed one appointment displaying $180, $168 and $0 as its balance/patient portion across two screens. The store confirms the values do not derive from each other.

## Evidence

- Script: /tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_samir_haddad_board_details_says_balance-1.cjs
- Output JSON (includes full event log): .../verify/checkout_samir_haddad_board_details_says_balance-1.json
- Screenshots: .../verify/samir-1-board-details.png, .../verify/samir-2-checkout.png
- Code: prototype/js/seed.js:83 (balanceCents 18000), :123-124 (fees), :131 (estimate 16800); prototype/js/screens/board.js:151; prototype/js/screens/checkout.js:94, :117, :231; prototype/js/store.js:31-44.
