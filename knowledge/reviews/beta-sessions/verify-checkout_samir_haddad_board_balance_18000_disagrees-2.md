---
title: "Verify: Samir Haddad a-1046 — Board balance $180.00 disagrees with Checkout estimate $168.00 (clean-run reproduction lens)"
type: review
date: 2026-09-03
source: "adversarial verifier, lens: reproduction on a clean run; defect key checkout|samir haddad board balance 18000 disagrees; reporters bp-02 (seq 54-57), bp-03 (seq 69-74)"
tags: [beta-panel, verify]
---

# Verdict: reproduced (P3 stands)

Started from the position that the defect is not real. It is real, on the first clean run, with no persona, theme,
device or timing dependency: it is a seed-data disagreement rendered faithfully by two screens.

## What I did

Own script (not the reporters'): fresh `file://` load of `prototype/index.html#/frontdesk/board` at 1280x900, desk,
light, `__proto.reset()` to rebuild the store and clear the event log, then in one run: real click on
`board.card.a-1046.expand`, read `#board-details-a-1046`; real click on `board.card.a-1046.checkout`, read the
procedure rows, the `tfoot` totals, the `.threenum` tiles and `checkout.amount`; pulled `__proto.state()` for the
appointment, estimate, procedures and ledger; compared every checkout-lane appointment's `balanceCents` against its
estimate; then (extra) posted the $168 collect by cash and inspected the ledger and the appointment field afterwards.

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_samir_haddad_board_balance_18000_disagrees-2.cjs`
- Result JSON (full event log included): same basename `.result.json`; screenshots `-1-board.png`, `-2-checkout.png`.
- Page errors: none.

## Evidence (my run, `window.__events` seq 1-6; post-Post extra seq 7-21)

| seq | event |
|---|---|
| 1-2 | focus, click `board.card.a-1046.expand` on `/frontdesk/board` |
| 4-5 | focus, click `board.card.a-1046.checkout` |
| 6 | route `/frontdesk/checkout/a-1046` |
| 11-17 | (extra) click `checkout.post`; writes `ledger/le-5000..5002`, `allocations/al-1..2`, `collectionDecisions/cd-1` |

- Board Details `#board-details-a-1046` (visible, rect 250x70 at the seed position): **"Balance $180.00 · patient portion, estimate separate"**.
- Checkout lines: `checkout.line.pr-421` Limited exam D0140 **$90.00**; `checkout.line.pr-422` Bitewings D0274 **$78.00**.
- Checkout `tfoot`: **"Totals $168.00 $168.00 est. Estimate is separate from the balance above; it never enters the ledger."**
- `checkout.amount` value: **`168.00`** (44 px tall control, Collect pre-selected).
- Tiles: Patient due $0.00 / Waiting on insurance $0.00 / Credit $0.00. The string `$180.00` appears nowhere on the Checkout page.
- Store: `appointments.a-1046.balanceCents = 18000`; `estimates['a-1046'].patientCents = 16800` (note "Patient asked to pay in full; no claim"); procedure fees 9000 + 7800 = 16800; ledger rows for p-305 before Post: 0.
- Lane comparison: a-1044 (4400 = 4400), a-1045 (0 = 0), a-1047 (41000 = 41000) all agree; **a-1046 is the only appointment in the store whose estimate disagrees with its `balanceCents`** (`estimatesDisagreeingWithBalance: ["a-1046"]`).
- After Post: ledger = charge 9000, charge 7800, patient_payment -16800; `balances('p-305')` = 0/0/0; `a-1046.balanceCents` is **still 18000** and the appointment leaves the Board's expandable cards. The $180 never corresponded to anything the ledger could produce.

## Mechanism

`prototype/js/screens/board.js:151` prints `a.balanceCents` and labels it "patient portion"; `prototype/js/screens/checkout.js:117,145,231` print `S.estimates[aid].patientCents` and label it the patient portion estimate. The two come from two hand-typed seed values that were meant to be the same number: `seed.js:83` (`balanceCents: 18000`) and `seed.js:131` (`patientCents: 16800`), with `seed.js:123-124` fees summing to 16800. Every other seeded checkout appointment keeps the two fields equal, so this is a one-row seed error, not a design of two separate figures.

## Contract rule

- CONTRACTS.md §8 (seed ids the scripts rely on): a-1046 is "Samir Haddad, pays a **$180** exam in full". The prototype's fee schedule and estimate for that exam are $168; the Board honours §8 and the Checkout contradicts it (or vice versa). The same $180 is repeated to the panel in `scripts/beta/tasks/front_office.json` fo-4, so every persona is primed to quote a number the window will not collect.
- docs/04 flow 4: Checkout shows "the patient portion (estimate column separate from balance)". Separation is honoured on both screens; what is violated is that the Board's line calls `balanceCents` the "patient portion" while the Checkout's patient portion for the same visit is a different amount. One appointment, two patient portions.

Not a preference: the reporters are not asking for a different layout. The desk reads $180 on the Board, and the Checkout prefills and posts $168. Nothing is mis-written to the ledger (charges 168, payment 168, due 0), so P3 is the right level. Fix is one seed value (`balanceCents: 16800` at `seed.js:83`, matching how a-1044/a-1045/a-1047 are seeded) plus the §8 and fo-4 wording, or have the Board Details line read the estimate instead of a separate field.

Related: the same seed inconsistency is already verified under the sibling key `checkout|samir haddad board details says balance` (verify-…-1.md and -2.md); this report confirms it independently under the "disagrees" key from bp-02 and bp-03.
