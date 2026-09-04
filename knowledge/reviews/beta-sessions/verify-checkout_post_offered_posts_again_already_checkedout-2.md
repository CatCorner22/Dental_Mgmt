---
title: "Verify: Post is offered and posts again on an already checked-out appointment (a-1050)"
type: review
date: 2026-09-03
source: adversarial verifier (reproduction lens), independent Playwright run against prototype/index.html
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED, with one correction to the report

Defect key: `checkout|post offered posts again already checkedout`. Reported by bp-01 (their seq 82-86).
Default position was "not real". A clean run reproduced the mechanism exactly; the "second row / duplicate" wording in the report is not what a clean run shows and should be rephrased (below).

## What I did

Fresh Chromium context, `window.__proto.reset()`, light theme, desk device. Read the store and the Board queue row for `a-1050`, then opened the public route `#/frontdesk/checkout/a-1050` directly (the Board offers no Checkout control for this row), measured the Post button, clicked it once, read the store, `window.__events`, and the screen; then went Back to Board and reopened the route.

## Evidence (my run)

- Seed baseline: `a-1050` status `checked_out_unfiled`; `S.collectionDecisions` is empty (0 rows for `enc-9010`, 0 total); `S.credits` holds `cr-1` -$95.00 for `p-307` ("Checked out unfiled: payment waiting for charges (a-1050)"); no ledger rows for `p-307`.
- Board: `board.queue.row.a-1050` renders the stamp "Paid at the window · in the Filed-later lane until Bree L. files" and **no** `board.queue.row.a-1050.checkout` control (selector absent). The Board therefore treats the appointment as done.
- Checkout screen before the click: chips "Note unfiled — Filed-later lane", "Claim ready", **"Already checked out"**; `checkout.collect.seg.zero-due` has `aria-pressed="true"` ("Nothing due today"); `checkout.post` is present, text "Post", class `btn irreversible`, `disabled=false`, no `aria-disabled`, rect 85 x 44 px at (29, 650), `pointer-events: auto`, `opacity: 1`. No `refusal.verb` on the page.
- Click: seq 3 `click checkout.post`; seq 4 `write collectionDecisions cd-1`; seq 5 `write firstRunState frs-checkout`. No `refusal` event, no `error` event.
- After: `S.collectionDecisions` = `[{ id: cd-1, encounterId: enc-9010, decision: zero_due, patientPortionCents: 0, decidedBy: Priya Raman }]`; `a-1050` status unchanged `checked_out_unfiled`; credits unchanged (`cr-1` -9500). The screen shows the Posted card: "Collection decision cd-1: Nothing due today, patient portion $0.00, decided by Priya Raman".
- Reopen (Back to Board, route again): Post is hidden and the Posted card persists, because `screens/checkout.js` keeps `state[aid].posted` in module memory for the session. That memory is the only thing preventing a further post; it is cleared on reload and `store.postCheckout` (store.js lines 82-118) never consults `a.status`.

## Correction to the report

On a clean run there is no prior `collectionDecisions` row for `enc-9010`: the seed models the earlier checkout only through the appointment status and the `cr-1` credit. The row written is `cd-1`, not a literal duplicate; bp-01 saw `cd-4` because it was their fourth Post in one session. The defect is better stated as: **the checkout screen labels the appointment "Already checked out" and still offers a live irreversible Post that writes a $0 "Nothing due today" collection decision against an encounter whose held credit says $95 was paid at the window, with no refusal.** The typed decision now contradicts the money on the same encounter.

## Contract rule violated

- docs/04 "How very intuitive is achieved": "Structural correctness over vigilance" and "every row has exactly one primary action". The Board enforces the structure (no Checkout control on a checked-out row); the Checkout screen relies on the operator reading an info chip next to a live irreversible button. CONTRACTS.md section 2 makes `checkout/<apptId>` a public route for every persona ("the prototype simulates entitlement refusals where the specs say so"), so the direct route is a supported path, not a hack.
- docs/03 Ledger: `ledger_entries` carry a "unique idempotency key per tenant"; `collection_decisions` are "written in the Post transaction". A second Post on the same encounter is the case an idempotency key exists to refuse, and CONTRACTS.md section 6 has no refusal code for it (nearest: none; the screen shows no `refusal.verb` at all).
- Not a preference: the screen writes a financial-control row with no gate, on an appointment the same product elsewhere marks done.

## Severity note

P1 as proposed is defensible for the control failure, but on this seed the financial effect is a $0 `zero_due` row (no ledger row). The `collect` path cannot fire here because the estimate is $0. Whether a checked-out appointment with a non-zero portion double-collects after a reload was not tested in this run; if it does, P1 stands outright.

## Script and artifacts

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_post_offered_posts_again_already_checkedout-2.cjs`
- Result JSON: same directory, `checkout_post_already_checkedout-2.result.json`
- Screenshots: `pa-1-a1050-before-post.png`, `pa-2-a1050-after-post.png`
