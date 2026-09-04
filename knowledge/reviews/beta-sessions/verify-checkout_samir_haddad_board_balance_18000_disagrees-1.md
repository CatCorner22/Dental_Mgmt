---
title: "Verify: Samir Haddad Board balance $180.00 disagrees with checkout estimate $168.00"
type: review
date: 2026-09-03
source: adversarial verifier (contract-rule lens) over beta reports bp-02 (seq 54-57) and bp-03 (seq 69-74)
tags: [beta-panel, verify]
---

# Verdict: reproduced (P3 stands)

Defect key: `checkout|samir haddad board balance 18000 disagrees`

## What I observed (own run, frontdesk, desk and shared devices, light)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_samir_haddad_board_balance_18000_disagrees-1.cjs`
Result JSON and screenshots sit beside it (`*-desk-board.png`, `*-desk-checkout.png`, `*-shared-*.png`).

Event window from my run (`window.__events`, identical on desk and shared): seq 1-6.
`1 focus board.card.a-1046.expand | 2 click board.card.a-1046.expand | 3 focus board.card.a-1046.expand | 4 focus board.card.a-1046.checkout | 5 click board.card.a-1046.checkout | 6 route /frontdesk/checkout/a-1046`. No page errors.

Three different numbers for one fact (Samir Haddad's patient portion today):

| Surface | Text | Source in code |
|---|---|---|
| Board Details (`#board-details-a-1046`, rect 250x70, visible) | `Balance $180.00 · patient portion, estimate separate` | `board.js:151` renders `appointment.balanceCents` (seed `18000`) |
| Checkout procedures table tfoot | `Totals $168.00 $168.00 est.` (fees D0140 $90.00 + D0274 $78.00) | `seed.js` procedures pr-421/pr-422; `estimates['a-1046'].patientCents = 16800` |
| Checkout `checkout.amount` prefill | `168.00` | `fresh(est.patientCents)` |
| Checkout three-number tile `Patient due` | `$0.00` | `store.balances(p-305)`: zero ledger rows for the patient |

The Board number matches neither the ledger balance ($0.00) nor the estimate ($168.00). The sibling checkout appointments are consistent (a-1044 4400/4400, a-1045 0/0, a-1047 41000/41000); a-1046 is the only one where `balanceCents` (18000) diverges from the estimate (16800). The seed is also inconsistent with CONTRACTS.md section 8, which describes a-1046 as "pays a $180 exam in full" while the seeded fees total $168.

## Contract rule violated

- docs/04 "How very intuitive is achieved": **One canonical view per fact.** The Board and Checkout show two different patient-portion numbers for the same appointment on the same day.
- docs/04 flow 4 and docs/03 Ledger: **estimate column separate from balance; estimates never joined into a balance.** The Board line labels an appointment-level field "Balance" and "patient portion" at once, so the desk quotes a number that is neither the ledger balance nor the estimate. `store.js:30` states the same rule ("estimates never join").
- CONTRACTS.md section 8 seed description ($180 exam) disagrees with the seeded fees ($168), so the stability checks and the panel scripts are bound to a contradictory fixture.

## Why this is not a preference

The reporter's complaint is that the desk quotes one number and collects another. That is a factual disagreement between two surfaces for one fact, which the blueprint forbids by rule, not a layout or wording taste. No measurement dispute: both strings are rendered and visible, and the store confirms the source values.

## Severity

P3 is right. Nothing wrong is written: Post uses the $168 estimate that matches the fees, and the ledger stays clean. The harm is a wrong verbal quote at the Board (and any script that trusts the section 8 row). Fix belongs in the seed (`a-1046.balanceCents` to 16800, or the fees to sum to 18000 and the estimate to match) plus a decision on whether the Board expander should read the estimate table rather than a duplicate `balanceCents` field.
