---
title: "Verify: ping_rate refusal breaks the gate shape (nine-word verb, no control, code not in CONTRACTS §6)"
type: review
date: 2026-09-03
source: beta panel adversarial verification (contract-rule lens) of defect key `board|pingrate refusal breaks gate shape nineword`, reported by bp-02 (seq 84-85) and bp-03 (seq 120-121)
tags: [beta-panel, verify]
---

# Verdict: REPRODUCED (P2 stands)

Independent reproduction in two fresh contexts (light/desk and dark/shared), default seed, 1280x900. I started from the
adversarial position that this was a copy preference, but the refusal breaks three explicit clauses of CONTRACTS §6,
so it is a contract violation, not a preference.

## Evidence (my run, `window.__events` seq 1-6 in each context)

Sequence: seq 1-3 first Ping (focus, click, `write messages msg-1`, stamp "Pinged chair 1 · 8:40 am · one-to-one, not
broadcast"); seq 4-6 second Ping (focus, click, `refusal`). The seq-6 refusal event is
`{code: "ping_rate", verb: "Already pinged this chair in the last 15 minutes", control: null}` in both contexts.

DOM inside `board.queue.row.a-1050` after the second tap:

| Check | Observed | §6 rule |
|---|---|---|
| `refusal.verb` text | "Already pinged this chair in the last 15 minutes" | verb first, at most eight words |
| word count | 9 | at most eight |
| first word | "Already" (adverb) | verb first |
| `refusal.control` inside the refusal | missing selector; `button` count in `.refusal` = 0; `refusal.control` count on the whole page = 0 | one 44 px control |
| `refusal.why` | present | Why disclosure (OK) |
| `#live` text | "Already pinged this chair in the last 15 minutes" | aria-live announcement (OK) |
| `data-code` | `ping_rate` | not among the 16 codes listed in §6 (list parsed from CONTRACTS.md at run time) |
| `refusal.verb` rect | 277 x 44 px | (for context only) |

Root cause is in the store, not the shared component: `js/store.js:79` calls
`refuse('ping_rate', 'Already pinged this chair in the last 15 minutes', null)`; `js/ui.js:45` (`refusal()`) renders
`refusal.control` only when `v.control` is truthy, so a null control produces a gate with a verb line and a Why but no
control. The reporters' observation is identical (bp-02 seq 85, bp-03 seq 121: same code, verb, `control: null`).

## Contract rule

CONTRACTS.md §6 Refusals: "a verb line (`refusal.verb`, verb first, at most eight words), one 44 px control
(`refusal.control`) ... Codes: needs_second, ..., second_identifier" (ping_rate absent). Also docs/04-ux-blueprint.md
"One verb line + one control at every gate".

## Note for triage

The same null-control pattern appears in other `refuse()` calls in `js/store.js` (`notfound`, `blocked_same_person`,
`stepup`, `entitlement`, `already_closed`, `pin_required`, `tender_required`), several with codes also missing from the
§6 list. This verification only measured `ping_rate`; the others are candidates for the same finding, not part of this
verdict.

## Script and artifacts

- Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/board_pingrate_refusal_breaks_gate_shape_nineword-1.cjs`
- Result JSON: same directory, `board_pingrate_refusal_breaks_gate_shape_nineword-1.result.json`
- Row screenshots: `board_pingrate_refusal_breaks_gate_shape_nineword-1-A.png` (light/desk), `-B.png` (dark/shared)
