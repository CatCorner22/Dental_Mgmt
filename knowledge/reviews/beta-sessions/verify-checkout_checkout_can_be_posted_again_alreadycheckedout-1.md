---
title: "Verify: Checkout can be posted again on an already-checked-out visit (a-1050 writes a fresh zero_due decision)"
type: review
date: 2026-09-03
source: adversarial verification (lens: contract-rule) of beta-panel defect `checkout|checkout can be posted again alreadycheckedout`, reported by bp-02 (seq 86-89) and bp-03 (seq 122-130); own Playwright run against prototype/index.html, default seed
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (contract violation; P3 understates it, P2 recommended)

Default position was "not real". An independent script reproduced the reporters' failure in both their shapes (desk, and shared desk with PIN), and a third probe shows the missing guard is in the store's Post transaction, not only in the screen's memory.

## Repro (own script)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_checkout_can_be_posted_again_alreadycheckedout-1.cjs`
Result JSON and screenshots (`...-A-before.png`, `...-A-after.png`, `...-B-after.png`, `...-C-second-post.png`) in the same directory.

Run A (desk, bp-02 shape): open `#/frontdesk/checkout/a-1050?theme=light&device=desk` directly (the Board offers no Checkout control on the Filed-later row), click `checkout.post` once.
Run B (shared, bp-03 shape): same route with `device=shared`; click Post with no PIN, then PIN 4321 and Post.
Run C (store probe): post `a-1044` ($44 by card) legitimately, delete only `Proto.screens.checkout.state['a-1044']` (what a second tab or workstation sees against the same store), re-render, post again.

## Evidence (my run's `window.__events` and measurements)

Seed baseline (fresh store on each reload; no storage persistence in the prototype): `a-1050.status = checked_out_unfiled`, `enc-9010`, 0 procedures on the encounter, `collectionDecisions` empty, no ledger rows for `p-307`, `credits` holds `cr-1 -9500` "Checked out unfiled: payment waiting for charges (a-1050)".

Run A, before the click: chips `Note unfiled — Filed-later lane`, `Claim ready`, **`Already checked out`**; `checkout.collect.seg.zero-due` `aria-pressed="true"`; `checkout.post` present, text "Post", class `btn irreversible`, `disabled=false`, no `aria-disabled`, `getBoundingClientRect` 85 x 44 at (29, 650), `pointer-events: auto`, `opacity: 1`; no `refusal.verb` / `refusal.control` on the page.
Run A, **seq 1-5**: 1 focus `checkout.post`; 2 click `checkout.post`; **3 write `collectionDecisions cd-1`**; 4 write `firstRunState frs-checkout`; 5 focus `checkout.back`. No `refusal` event, no `error` event. After: `collectionDecisions` = `[{cd-1, enc-9010, zero_due, patientPortionCents 0, decidedBy Priya Raman}]`; aria-live "Posted. 0 ledger rows and the collection decision are written."; Posted card "Collection decision cd-1: Nothing due today, patient portion $0.00". `a-1050.status` unchanged.
Run A, revisit in the same session: Post hidden, Posted card shown (module memory `state[aid].posted`). After a real `page.reload()`: store rebuilt from seed, chip `Already checked out` and a live Post again, and a further click writes `cd-1` again (seq 1-5 of the reloaded page).

Run B (shared), **seq 1-10**: 2 click `checkout.post` -> **3 refusal `pin_required` "Enter your PIN to post"**, `refusal.control` "Enter PIN", aria-live "Enter your PIN to post. Enter PIN" (the shared refusal component works on this screen for the gates the store knows); 7 click `checkout.post` after PIN -> **8 write `collectionDecisions cd-1`**, no refusal. Matches bp-03's 122-130 shape.

Run C (store probe), first post seq 5-8: writes `ledger le-5000` (patient_payment -4400 card, unapplied_credit), `allocationIntents ai-1`, `collectionDecisions cd-1` (collect, 4400); `a-1044.status` becomes `checked_out_unfiled`. After dropping only the page's form memory: chip `Already checked out`, Collect pre-selected, Post live 85 x 44. **Seq 16-19**: click Post -> **write `ledger le-5001` (a second -4400 patient_payment), `allocationIntents ai-2`, `collectionDecisions cd-2`**. Two payments and two collect decisions on one encounter; `balances('p-303').credit` = 13200. So `store.postCheckout` (store.js lines 82-118) never consults `a.status` or an existing decision for the encounter; the screen's in-memory `posted` flag is the only thing that ever hides Post.

## Contract rules violated

- `CONTRACTS.md` section 6 Refusals: "One shared component renders every gate ... The primary button never dims; it switches to the Held identity". The screen recognises the condition (`checkout.js` render(): `!st.posted && String(a.status).startsWith('checked_out') ? chip('info', 'Already checked out')`) and renders it as an info chip beside a live irreversible Post, with no `refusal.verb`, no `refusal.control`, no announcement. A recognised gate condition rendered as decoration instead of the refusal component is the exact shape section 6 forbids.
- `docs/13` feature 1 and `docs/03` line 26: "Checkout closes on a typed collection decision"; "Post writes one collection_decisions row ... in the same transaction" and the row is INSERT-only; `docs/03` line 16 gives the Post transaction's ledger rows "a unique idempotency key per tenant". A Post that re-runs without limit against an encounter already in `checked_out*` appends a second permanent decision (and, on a non-zero visit, a second payment) that no idempotency key catches.
- `docs/04` line 40 / `docs/13` amendment: the `zero_due` row exists so the practice-level "Not collected at window: $X across N visits" line "stays honest". A second row per visit inflates N; on `a-1050`, whose patient already paid $95 at the window (`cr-1`), a `zero_due` decision is also the wrong decision.
- Not a preference: an irreversible money-control write with no gate on a state the same screen names and the Board already treats as done (`board.js` `CHECKOUTABLE = ['in_chart', 'note_filed']`; the Filed-later row offers only Ping chair).

## Corrections to the report and severity

- On a clean seed there is no prior `collectionDecisions` row for `enc-9010`; the seed models the earlier checkout only through `a.status` and `cr-1`. My run wrote `cd-1`, the reporters saw `cd-4` because three earlier checkouts had run in their sessions. The defect is accurately "Post is live and writes a fresh decision on a visit the screen labels Already checked out", not "a literal duplicate row" on this seed.
- Severity: the reporters proposed P3 because the visible effect here is a $0 `zero_due` row. Run C shows the same gap doubles a real $44 patient payment whenever the screen's page memory is not present (second tab, second workstation, reload). That is a duplicate-collection control failure, so P2 is the honest floor; the sibling key `checkout|post offered posts again already checkedout` (bp-01) was verified at P1 for the same mechanism.
- Note for the fix: the store gate should refuse on `a.status` starting with `checked_out` or on an existing decision for the encounter, through the shared refusal component (new code, e.g. `already_posted`, would need adding to section 6's code list).
