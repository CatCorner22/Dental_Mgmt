---
title: "Verify: Post is offered and posts again on an already checked-out appointment (duplicate collection decision)"
type: review
date: 2026-09-03
source: adversarial verification (lens: contract-rule) of beta-panel defect `checkout|post offered posts again already checkedout` reported by bp-01 (seq 82-86); own Playwright run against prototype/index.html
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (contract violation; P1 stands, with a reachability note)

Default position was "not real". The independent run reproduced the reporter's failure exactly, and a second probe shows the gap is in the store, not only in the screen.

## Repro (own script, not the reporter's)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_post_offered_posts_again_already_checkedout-1.cjs`
Screenshots: `checkout-a1050-before-post.png`, `checkout-a1050-after-post.png` in the same directory.

1. Open `#/frontdesk/checkout/a-1050` directly (light theme, desk device, fresh seed). Seed state: `a-1050.status = checked_out_unfiled`, `enc-9010`, `balanceCents 0`, no estimate, `S.credits` holds `cr-1 -9500 "Checked out unfiled: payment waiting for charges (a-1050)"`. `collectionDecisions` starts empty (the seed does not carry the earlier decision row, only the appointment status and the held payment).
2. Click `checkout.post`.

## Evidence (my run's `window.__events`)

- Before the click the status row rendered three chips: `Note unfiled — Filed-later lane`, `Claim ready`, `Already checked out`. `checkout.collect.seg.zero-due` had `aria-pressed="true"`. `checkout.post` existed, text `Post`, class `btn irreversible`, `disabled=false`, no `aria-disabled`, `getBoundingClientRect` 85.5 x 44 at (29, 650) — a live, visible primary control. No `refusal.verb` on the page.
- seq 1 focus `checkout.post`; **seq 2 click `checkout.post`; seq 3 write `collectionDecisions cd-1`**; seq 4 write `firstRunState frs-checkout`; seq 5 focus `checkout.back`.
- After: `collectionDecisions` = `[{id: cd-1, encounterId: enc-9010, decision: zero_due, patientPortionCents: 0, decidedBy: Priya Raman}]`; Posted card reads "Posted in one transaction / Collection decision cd-1: Nothing due today, patient portion $0.00"; aria-live "Posted. 0 ledger rows and the collection decision are written." No refusal, no Held identity. `a-1050.status` unchanged (`checked_out_unfiled`); `cr-1` ($95 paid at the window) still on the account, so the store now says both "Devon paid $95 at the window" and "Nothing due today, decided 08:40" for the same encounter.
- Reload and revisit `a-1050`: Post live again, chip `Already checked out` again (deterministic).
- Store-level probe (same script, seq 9-11 of the second run): legitimate Post on `a-1045` (enc-9004) writes `cd-1`; then only the page's in-memory `Proto.screens.checkout.state['a-1045']` was dropped (what a second workstation or a fresh tab against the same server would see) and the screen re-rendered: `Already checked out` chip plus a live Post; the click wrote **`cd-2: zero_due` for the same encounter** (seq 10 click, seq 11 write). `Proto.store.postCheckout` has no check on `a.status` at all.

## Mechanism (prototype, not edited)

- `prototype/js/screens/checkout.js` `render()`: the Payment card and Post row are hidden only when `st.posted` is set, and `st` is per-page-load module memory (`fresh()` sets `posted: null`). The same function already detects the condition — `!st.posted && String(a.status).startsWith('checked_out') ? chip('info', 'Already checked out')` — and renders it as an informational chip instead of a gate.
- `prototype/js/store.js` `postCheckout()` (lines ~84-118): refuses on outage, missing PIN, zero collect, missing tender, write-off threshold; never on an appointment already `checked_out` / `checked_out_unfiled`, and never on an existing `collectionDecisions` row for the encounter. It always appends `cd-<n>`.
- The Board is consistent with the rule the Checkout screen breaks: `board.js` `CHECKOUTABLE = ['in_chart', 'note_filed']`, and the Filed-later row for `a-1050` offers only `Ping chair` with the stamp "Paid at the window · in the Filed-later lane until Bree L. files" (this is why bp-01 had to type the route by hand).

## Contract rules violated

- `CONTRACTS.md` §6 Refusals: "One shared component renders every gate ... The primary button never dims; it switches to the Held identity". The screen recognises the gate condition (it prints `Already checked out`) but leaves the irreversible primary control live with no `refusal.verb` / `refusal.control` and no announcement. A recognised condition rendered as a chip rather than a refusal is a gate without the component.
- `docs/03-data-model.md` line 26: `collection_decisions` is "written in the Post transaction", one typed decision per checkout; line 16: ledger postings carry a "unique idempotency key per tenant". The Post transaction here is re-runnable without limit against a checked-out encounter, producing a second (contradictory) decision row. INSERT-only makes the duplicate permanent.
- `docs/04-ux-blueprint.md` flow 4 (line 26) and line 40: Post is the single atomic write for a checkout and "the typed decision row records reason `zero_due`" so the day's "Not collected at window" line "stays honest". A second `zero_due` row on an encounter whose patient already paid $95 makes that line dishonest, and the prototype's own Board (CHECKOUTABLE excludes `checked_out*`) shows the intended rule.

Not a preference: it is an irreversible money-decision write with no gate on a state the screen itself names.

## Notes

- Reporter's cited range bp-01 82-86 matches my seq 1-5 one-for-one (route, focus, click `checkout.post`, write `collectionDecisions`, focus `checkout.back`); theirs was `cd-4` because three earlier checkouts had run in that session.
- Reachability: in the prototype the Board never offers Checkout for `checked_out*` rows, so the seeded case needs a typed URL, a bookmark, or Back/Forward. The second-desk probe shows the guard is page memory only, so in a real deployment any second tab, refresh, or second workstation reaches it in ordinary use. P1 as proposed is defensible; P2 would be the floor.
- Suggested fix direction (not applied): in `postCheckout`, refuse when `a.status` starts with `checked_out` or a `collectionDecisions` row exists for the encounter (new code, e.g. `already_posted`, verb "Already checked out — nothing to post", control "Back to Board"); in `checkout.js`, when the appointment is checked out and `st.posted` is null, render the existing decision (or the refusal) instead of the Payment card and Post.
