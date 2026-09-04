---
title: "Verify: shared-desk checkout PIN accepts any digits and never changes the poster"
type: review
date: 2026-09-03
source: adversarial verify of bp-03 defect "checkout|shareddesk checkout pin accepts any digits" against prototype/ (contract-rule lens)
tags: [beta-panel, verify]
---
# Verdict: reproduced (P2 stands). Contract violated: docs/13 #30 amendment / docs/06 row 12 (the desk PIN must resume or mint its owner's session; a PIN that matches no one cannot make anyone the poster)

## What I tested (independent script, fresh `__proto.reset()` before every attempt)
Route `#/frontdesk/checkout/a-1044?device=shared&theme=light`, Collect pre-selected, Card, card number typed, then PIN typed in `checkout.pin`, then `checkout.post`.

| Run | PIN | Owner in seed | Refusal? | Writes (seq) | Poster recorded |
|---|---|---|---|---|---|
| A | 4321 | none | none | 29 ledger le-5000, 30 allocationIntents ai-1, 31 collectionDecisions cd-1 (window seq 1-34; PIN keys 23-26, Post click 28) | `cd-1.decidedBy` = Priya Raman, `le-5000.actor` = Priya Raman |
| B | 4444 | Dana Whitfield (office manager, has `post_payment`) | none | same rows, seq 29-33 (window 1-34) | still Priya Raman |
| C | 5555 | Priya Raman (persona's own user) | none | same rows, seq 29-33 | Priya Raman |
| D | 000000 | none | none | seq 31-35 (window 1-36; PIN keys 23-28, Post click 30) | Priya Raman |
| E | empty (control) | - | `pin_required` at seq 25, verb "Enter your PIN to post", control "Enter PIN" 116x44 px | none | - |

Every run reports `device: 'shared'` in the event context. No `refusal` event and no `refusal.verb`/`refusal.control` node in runs A-D. The field hint reads verbatim "Shared desk: the PIN makes you the frozen poster for this posting."

## Why it is a contract violation, not a preference
- The only PIN check in `postCheckout` is presence: `prototype/js/store.js:87` `if (window.__proto.device === 'shared' && !form.pin) return refuse('pin_required', ...)`. The value is never compared to `S.users[].pin`, and `u = currentUser()` (the persona's user) is stamped on every row regardless. The `why` text on that very refusal says "the PIN mints your own session for this posting", which the code does not do.
- docs/13 #30 amendment (adopted): "the desk PIN ... resumes or mints B's own server session for the single posting ... so the frozen poster is a session owner, not a PIN annotation on A's session." Run B typed Dana's PIN and the poster stayed Priya. docs/06 row 12: a per-user PIN "can only resume that user's own session"; a PIN with no owner (runs A, D) can resume nothing and must be refused. docs/05 line 39: "a PIN never annotates another person's session."
- The prototype already implements the correct behaviour elsewhere: the author chip pad (`screens/shell.js:64-65`) looks the PIN up in `S.users` and emits `pin_no_match` on a miss. Checkout is inconsistent with its own sibling gate. (`screens/phone.js:55` documents the step-up as deliberately unvalidated "in the prototype"; checkout carries no such note and its copy promises the opposite.)
- CONTRACTS.md §6 lists `pin_required` as a gate code; the gate fires only on an empty field, so it is a presence check dressed as an identity control. Not a 44 px / verb-line issue: the refusal that does render (run E) is compliant (116x44, verb first, one control).

## Not reproduced / caveats
- The reporter's "cd-1 and le-5000 written 'decided by Priya Raman'" matches my run exactly; nothing in their claim overreaches.
- Severity: P2 is fair for a prototype (no real money), but the copy actively misleads the tester about a control that is the headline of feature #30; I would not lower it.

## Files
- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/checkout_shareddesk_checkout_pin_accepts_any_digits-1.cjs`
- Result: same path with `.result.json`; screenshots `-A-4321.png` (posted with an unowned PIN) and `-E-empty.png` (the only refusal).
