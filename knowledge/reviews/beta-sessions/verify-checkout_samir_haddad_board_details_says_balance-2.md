---
title: "Verify: Samir Haddad a-1046 — Board Details Balance $180.00 vs Checkout $168.00 (reproduction lens)"
type: review
date: 2026-09-03
source: "adversarial verifier, lens: reproduction on a clean run; reporters bp-01 (seq 55-57), bp-05 (seq 64-67), bp-02 (seq 54-57)"
tags: [beta-panel, verify]
---

# Verdict: reproduced (P3 stands)

Defect key: `checkout|samir haddad board details says balance`

## What I did

Own script, not the reporter's: fresh `file://` load of `prototype/index.html#/frontdesk/board`, `__proto.reset()`, then in the **same run** (the reporter read the Board number in a separate probe) clicked `board.card.a-1046.expand`, read `#board-details-a-1046`, clicked `board.card.a-1046.checkout`, read the `tfoot` totals row and the `.threenum` tiles, and pulled `__proto.state()` for the appointment, estimate, procedures and ledger rows behind the numbers.

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_samir_haddad_board_details_says_balance-2.cjs`
Result JSON and screenshots: same basename, `.result.json`, `-board.png`, `-checkout.png`.

## Evidence (my run, `window.__events` seq 1-6)

| seq | event |
|---|---|
| 2 | click `board.card.a-1046.expand` on `/frontdesk/board` |
| 5 | click `board.card.a-1046.checkout` |
| 6 | route `/frontdesk/checkout/a-1046` |

- Board Details (`#board-details-a-1046`, rect 250x70, visible): **"Forms Done Balance $180.00 · patient portion, estimate separate"**.
- Checkout totals row: **"Totals $168.00 $168.00 est. Estimate is separate from the balance above; it never enters the ledger."** Lines: D0140 $90.00, D0274 $78.00. `checkout.amount` prefilled `168.00`.
- Tiles: Patient due **$0.00**, Waiting on insurance $0.00, Credit $0.00.
- Store: `appointments.a-1046.balanceCents = 18000`; `estimates['a-1046'].patientCents = 16800`; procedure fees 9000 + 7800 = 16800; ledger rows for `p-305` before Post: **0**.
- Sibling checkout cards are self-consistent: a-1044 balance 4400 = est 4400; a-1045 0 = 0; a-1047 41000 = 41000. Only a-1046 disagrees (18000 vs 16800).

## Reading of the three numbers

- **$0.00 Patient due is correct by design**, not part of the defect: the three tiles come from ledger rows only (docs/13 #23, docs/03 "estimates never joined into a balance"), and no charge exists for p-305 until Post writes it. The reporter's title lumps it in, but it is the one number that is behaving.
- **$180.00 on the Board is the defect.** The card labels `balanceCents` "patient portion", yet the same appointment's patient-portion estimate and its fee total are both $168.00. The Board figure is a third value that is neither the ledger balance ($0) nor the estimate ($168). The coordinator quotes $180 from the Board and collects $168 at the window (bp-02's exact complaint).
- The seed and CONTRACTS.md §8 also disagree with each other: §8 says a-1046 "pays a **$180** exam in full", but the seeded procedures for enc-9005 sum to $168.

## Contract rule

- CONTRACTS.md §8 seed table: a-1046 is "a $180 exam", while the seeded fees total $168 and the estimate is $168 — the seed contradicts its own contract row.
- docs/04 flow 4 / docs/13 #1: checkout shows "the patient portion (estimate column separate from balance)". The Board Details line presents a "patient portion" that matches neither the estimate column nor the balance for the same appointment, so the two screens give the desk two different patient portions for one visit.

Not a preference: it is a data inconsistency that produces a wrong spoken quote. Nothing is mis-written (Post collects $168 against $168 of charges), so P3 is the right level. Fix is one seed value (`balanceCents: 16800`, matching how a-1044/a-1045/a-1047 are seeded) plus §8 wording, or make the Board Details line read the estimate rather than a separate field.
