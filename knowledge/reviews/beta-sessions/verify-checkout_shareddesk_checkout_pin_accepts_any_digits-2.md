---
title: "Verify: Shared-desk checkout PIN accepts any digits and does not change the poster"
type: review
date: 2026-09-03
source: independent Playwright reproduction against prototype/index.html#/frontdesk/checkout/a-1044?device=shared (lens: clean-run reproduction), defect key `checkout|shareddesk checkout pin accepts any digits`, reported by bp-03 (seq 38-47)
tags: [beta-panel, verify]
---

**Defect key:** `checkout|shareddesk checkout pin accepts any digits` — reported by bp-03 (seq 38-47; probe seq 34-41).

**Verdict: reproduced (P2 stands).** Started from "not real" and drove it myself on three fresh browser contexts with a script that does not copy the reporter's. The PIN gate on shared-desk Post only tests that the field is non-empty; it never compares the digits to any seeded user's PIN and never changes the frozen poster.

## Evidence (my run, `window.__events`)

Default seed, light theme, `device=shared`, persona `frontdesk` (current user Priya Raman, PIN 5555). Card tender, card number typed, then PIN, then `checkout.post`.

| Run | PIN typed | Matches a seeded user? | Refusal shown? | Writes (seq) | `le-5000.actor` / `cd-1.decidedBy` |
|---|---|---|---|---|---|
| A control | (empty) | n/a | yes: `pin_required`, verb "Enter your PIN to post", control "Enter PIN" (seq 22) | none, ledger stays 114 | n/a |
| A | `4321` | no | none (no `refusal.verb`/`refusal.control` in DOM, no `refusal` event in seq 24-37) | `ledger le-5000` 32, `allocationIntents ai-1` 33, `collectionDecisions cd-1` 34 | Priya Raman / Priya Raman |
| B | `000000` | no | none (seq 20-35) | le-5000 30, ai-1 31, cd-1 32 | Priya Raman / Priya Raman |
| C | `4444` | yes: Dana Whitfield | none (seq 20-33) | le-5000 28, ai-1 29, cd-1 30 | Priya Raman / Priya Raman |

Run C is the decisive one for the second half of the claim: a valid PIN belonging to a different user still posts as Priya, so the PIN is not consulted at all — the field hint under `checkout.pin` reads "Shared desk: the PIN makes you the frozen poster for this posting." and the refusal's Why reads "the PIN mints your own session for this posting", neither of which happens. Posted banner text in all three runs: "decided by Priya Raman"; appointment status `checked_out_unfiled`.

Root cause (read-only inspection): `prototype/js/store.js:87` is `if (window.__proto.device === 'shared' && !form.pin) return refuse('pin_required', ...)` and `u = currentUser()` is used as actor/decidedBy unchanged. Contrast the author-chip pad at `prototype/js/screens/shell.js:64`, which does `S.users.find((u) => u.pin === digits)` and refuses `pin_no_match` — the prototype already has the right pattern and Checkout does not use it.

## Contract rule violated

- `CONTRACTS.md` §2: "the prototype simulates entitlement refusals where the specs say so", together with §6, which lists `pin_required` as a gate code. The spec the gate simulates is docs/04 flow 4 ("desk PIN on Post on shared desks") as specified in docs/13 item 30 and the docs/05 amendment: the desk PIN is "verified server-side inside postGuarded, so the frozen poster is the PIN holder" and "a PIN never annotates another person's session". A gate that accepts any non-empty string and leaves the poster unchanged simulates neither the refusal nor the attribution.
- Not a docs/04 micro-rule (targets, verb line, blur validation); it is a behavioural contract on the refusal component and the frozen-poster attribution the prototype's own copy promises.

Severity: P2 stands. Wrong-author on a shared device is named in docs/13 as "a Board complaint and an immediate pilot kill"; in the prototype the control exists visually but is a no-op, so any beta session exercising flow 4 on a shared desk records a false positive for the identity handoff. Not P1 because no data is lost and the empty-PIN refusal does render.

## Artifacts

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_shareddesk_checkout_pin_accepts_any_digits-2.cjs`
- Results: `.../verify/checkout_shareddesk_checkout_pin_accepts_any_digits-2.result.json`
- Screenshots: `.../verify/checkout_shareddesk_checkout_pin_accepts_any_digits-2-{A-4321,B-000000,C-4444}.png`
