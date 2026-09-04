---
title: "Verify: Checkout Post is offered and writes a collection decision on an already-checked-out visit (a-1050)"
type: review
date: 2026-09-03
source: adversarial verification of beta defect `checkout|checkout can be posted again alreadycheckedout` (reported by bp-02 seq 86-89, bp-03 seq 122-130); lens = reproduction on a clean run
tags: [beta-panel, verify]
---

## Verdict

**Reproduced: yes.** Severity P3 as proposed is fair: no ledger row and no money moves ($0 due), but an irreversible Post is offered on a visit the same screen chips "Already checked out", and the store writes a `collectionDecisions` row for `enc-9010` with no refusal. The store has no status gate at all: two direct `postCheckout('a-1050', …)` calls after a fresh reset write `cd-1` and `cd-2` with zero refusal events.

## Evidence (my run, fresh browser, `window.__events` from seq 1)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_checkout_can_be_posted_again_alreadycheckedout-2.cjs`
Result JSON and screenshots (`-A-before.png`, `-A-after.png`, `-B-after.png`) sit next to it.

- **Pass A, desk, direct route `#/frontdesk/checkout/a-1050?theme=light&device=desk`.** Before click: `a-1050.status = checked_out_unfiled`, `collectionDecisions` for enc-9010 = 0, procedures for enc-9010 = 0, credit `cr-1` "Checked out unfiled: payment waiting for charges (a-1050)" already on the account; chips `Note unfiled — Filed-later lane`, `Claim ready`, `Already checked out`; `checkout.collect.seg.zero-due` aria-pressed=true; `checkout.post` present, text "Post", class `btn irreversible`, not disabled, rect 85 x 44 px; no `refusal.verb`. **Seq 1-5:** focus `checkout.post` (1), click `checkout.post` (2), write `collectionDecisions cd-1` (3), write `firstRunState frs-checkout` (4), focus `checkout.back` (5). No `refusal` event. After: `collectionDecisions = [{cd-1, enc-9010, zero_due, Priya Raman}]`, ledger length unchanged (114), status still `checked_out_unfiled`, chip flips to `Posted`.
- **Pass B, shared desk (bp-03's path), after `__proto.reset()`.** Post without PIN correctly refuses `pin_required` (seq 2-5, `refusal.control` present), so the gate component works here; it is the already-posted condition specifically that has no gate. PIN 7788 + Enter: **seq 6-15**, click `checkout.post` (12), write `collectionDecisions cd-1` (13), no refusal.
- **Pass A2.** Within one store session, leaving and returning shows `Posted` and no Post button (per-appointment screen state), so the UI itself does not allow a third click without a reset; the exposure is the seeded/initial `checked_out*` status plus the missing store guard.
- **Pass C, store level, fresh reset, desk PIN supplied.** `postCheckout` x2 → `r1.ok = true`, `r2.ok = true`, writes `1:cd-1`, `3:cd-2`, refusals `[]`.

Reporter ids differ (`cd-4`) only because their sessions had three earlier postings; `nextId.cd` is session-monotonic. Same behavior.

## Contract rule

No explicit clause in `prototype/CONTRACTS.md` forbids a second decision, and §6 has no `already_posted` code, which is the gap. The closest binding text: `docs/03-data-model.md` line 26, `collection_decisions` is "INSERT-only, written in the Post transaction" with `encounter_id NOT NULL`, i.e. one decision per encounter's Post; and the prototype's own Board treats `checked_out_unfiled` rows as finished (no `board.queue.row.a-1050.checkout`, stamp "Paid at the window"), while Checkout offers an irreversible Post on the same visit. Internal inconsistency plus an integrity gap, not a preference. Related seed inconsistency: `a-1050` is seeded `checked_out_unfiled` with credit `cr-1` but no `collectionDecisions` row for `enc-9010`, so the "second" decision is the first row in the store even though the domain says the visit was already posted.

## Suggested fix (not applied)

In `store.postCheckout`, refuse when `a.status` starts with `checked_out` (or when a decision exists for `encId`) with a new §6 code such as `already_posted`, verb "Already posted — open the ledger", control "Open ledger"; on the screen, render the Held identity instead of Post when the chip says Already checked out. Seed a `cd-*` row for `enc-9010` so the visit's history is honest.
