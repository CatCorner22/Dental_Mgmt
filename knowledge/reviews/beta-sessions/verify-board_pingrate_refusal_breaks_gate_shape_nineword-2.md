---
title: "Verify: board | ping_rate refusal breaks gate shape (nine-word verb, no control, code not in §6)"
type: review
date: 2026-09-03
source: adversarial verifier (lens: reproduction on a clean run) of beta reports bp-02 (seq 84-85) and bp-03 (seq 120-121)
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (P2, contract violation — CONTRACTS.md §6)

Default position was "not real". It is real: a fresh `__proto.reset()` run reproduces all three parts of the report on the first attempt.

## Evidence (my run, `window.__events` after reset)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_pingrate_refusal_breaks_gate_shape_nineword-2.cjs`
(run with `NODE_PATH=/opt/node22/lib/node_modules`; raw output next to it as `.result.json`).

Seq range 1-6 on `#/frontdesk/board`, persona frontdesk, device desk, light theme:

- seq 2 click `board.queue.row.a-1050.ping` → seq 3 write `messages` (first ping succeeds)
- seq 5 click `board.queue.row.a-1050.ping` → **seq 6 refusal** `{code: "ping_rate", verb: "Already pinged this chair in the last 15 minutes", control: null}`

DOM at seq 6:

- `[data-testid="refusal.verb"]` text = "Already pinged this chair in the last 15 minutes" → **9 words** (§6: at most eight)
- `[data-testid="refusal.control"]` → **missing selector** (§6: one 44 px control). The shared component skips the button when `control` is null (`js/ui.js:52`).
- `.refusal[data-code="ping_rate"]` getBoundingClientRect = 308 × 113.5 px at (930, 830); `refusal.why` present.
- `ping_rate` is **not** among the 16 codes listed in §6.

No page errors.

## Contract rule violated

CONTRACTS.md §6 Refusals: "a verb line (`refusal.verb`, verb first, at most eight words), one 44 px control (`refusal.control`) … Codes: [closed list]". Also docs/04 "One verb line + one control at every gate". Three separate breaches from one call site: `js/store.js:79` `refuse('ping_rate', 'Already pinged this chair in the last 15 minutes', null)`.

## Notes

- Not a preference: word count and control presence are mechanical checks written into §6, and the code list is explicit.
- Severity P2 is right: the gate still renders, announces, and has a Why; it is the shape and catalog that are off, not the behaviour. Not P1.
- Fix sketch (not applied): a ≤8-word verb-first line (e.g. "Pinged chair 1 already — wait 15 minutes" is 7 words), a control (e.g. "Open chair 1" or "OK"), and either add `ping_rate` to §6 or reuse an existing code.
- Side observation only: the `aria-live="polite"` region read back empty at measurement time even though `router.announce` was called; may be a clear-after-timeout. Not part of this defect.
