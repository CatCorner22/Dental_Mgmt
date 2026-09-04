---
title: "Verify: palette | search shows second identifier (full DOB) in result rows"
type: review
date: 2026-09-03
source: adversarial verification of beta defect "palette|search shows second identifier full dob" (reported by bp-01 seq 91-108, bp-04 seq 100-105); own script, contract-rule lens
tags: [beta-panel, verify]
---

# Verdict: NOT reproduced as a contract violation (behaviour confirmed, rule not broken)

**Defect key:** `palette|search shows second identifier full dob` · **Screen:** palette · **Proposed P2**

## What I observed (own run)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/palette_search_shows_second_identifier_full_dob-1.cjs`
(result JSON alongside, `...-1.result.json`). Fresh context, default seed, `#/frontdesk/board?theme=light&device=desk`.

- Ctrl+K opened the palette (seq 1-3); typing `fis` (seq 4-6) listed three patient rows, each 44 px high and visible:
  `palette.row.0` "Lena Fischer" / "DOB 7/8/1969 · …0126", `row.1` "Beth Fischer" / "DOB 5/6/1970 · …0289", `row.2` "Cole Fischer" / "DOB 9/1/1966 · …0231". Store for p-306: dob `1969-07-08`, phone `615-555-0126`. So yes: every patient row shows the full DOB and phone last-4.
- Clicking `palette.row.0` (seq 7-8) rendered "Confirm date of birth", who-line "Lena Fischer · …0126 · MRN-306", hint "Second identifier. Ask the patient, or read it from the appointment card.", focus on `palette.confirm.dob` (seq 9).
- Typing `07/08/1969` read off the row + Enter (seq 10-20) closed the palette, opened the Patient Rail, wrote `phiAccessLog p-306` (seq 21), no refusal. **Seq range for the whole claim: 1-21.**

The reporter's factual account is accurate. Source: `prototype/js/store.js:268` builds `syn: 'DOB ' + longDate(p.dob) + ' · …' + p.phone.slice(-4)`; `prototype/js/screens/palette.js` `renderConfirm()` asks for the DOB.

## Why it is not a contract violation

- `docs/13-innovation-and-intuitiveness.md` feature 28 (line 530) specifies the row content verbatim: "Three letters list patients (**name · DOB · last-4 phone as two identifiers**) ... Selecting a patient requires the second identifier before the chart opens." Line 534: "two identifiers only until confirmation writes the phi_access_log row on chart open." The prototype renders exactly the specified two identifiers in the row and withholds everything else (MRN, coverage, balance, alerts, full phone) until the gate passes. The row content is the spec, not a leak.
- `docs/04-ux-blueprint.md` line 7: "global patient search (typeahead over name, DOB, phone, MRN; two-identifier confirmation on chart open)" -- the gate is a wrong-patient confirmation step (Joint Commission two-identifier practice: compare against the patient or the card), not an authentication secret. The gate's own copy says so ("Ask the patient, or read it from the appointment card"). No rule in `CONTRACTS.md`, docs/04, or docs/13 requires the DOB to be hidden from results, or the patient to be physically present for a front-desk chart open (front desk opens charts for phone calls and scheduling by design).
- The gate still does what the contract asks of it: re-keying forces the operator to pick among three Fischers deliberately, a mismatch renders the shared `second_identifier` refusal (CONTRACTS.md §6 code), and the match is the moment the PHI access row is written (seq 21).

**Contract rule:** none: preference. The report is a threat-model critique (a copyable confirmation is ceremony) of a design the spec chose on purpose. If the panel wants a stronger gate, that is a docs/13 feature-28 spec change (e.g. hide DOB until hover/focus, or confirm last-4 instead), not a prototype defect.

## Adjacent observation (separate key, not part of this verdict)

Probe D: `#/hygienist/chairs?device=operatory&privacy=1`. Rows show initials only ("LF", "BF", "CF") but the syn line still shows "DOB 7/8/1969 · …0126" (seq 1-6 of that context). docs/13 line 209 says "Initials only in privacy mode"; a full DOB beside initials on operatory glass arguably defeats privacy mode. Worth filing as its own defect (`palette|privacy mode shows full dob`) and verifying independently; I did not adjudicate it here.
