---
title: "Verify: Search rows show the second identifier (full DOB and last-4) before the DOB gate"
type: review
date: 2026-09-03
source: beta panel adversarial verification (reproduction lens, clean run) of defect key `palette|search shows second identifier full dob`, reported by bp-01 (seq 91-108) and bp-04 (seq 100-105)
tags: [beta-panel, verify]
---

# Verdict: NOT A DEFECT (behaviour observed, spec-conformant; reclassify as a spec question)

The behaviour the reporters describe happens exactly as stated on a clean run, but it is what the
specification asks for. The prototype does not violate CONTRACTS.md or any docs/04 rule; the complaint is with
the design in docs/13 feature 28, so it belongs in docs/11 as an open question, not on the defect list as P2.

## What I observed (my run, fresh context, default seed, frontdesk, 1280x900)

Script: `/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/palette_search_shows_second_identifier_full_dob-2.cjs`
(run with `NODE_PATH=/opt/node22/lib/node_modules`); raw output beside it as `.result.json`.

Run A, `window.__events` seq 1-36:

| Step | Evidence |
|---|---|
| Ctrl+K, type `fis` (seq 1-6) | 3 rows, all `Patient`, all Fischers. Row 0 text: `Patient Lena Fischer DOB 7/8/1969 · …0126`; rows 1-2 likewise (`Beth Fischer DOB 5/6/1970 · …0289`, `Cole Fischer DOB 9/1/1966 · …0231`). 3/3 rows carry a full DOB and a last-4 phone. |
| Click `palette.row.0` (seq 7-8) | Title `Confirm date of birth`; who-line `Lena Fischer · …0126 · MRN-306` (DOB deliberately absent in this step); hint `Second identifier. Ask the patient, or read it from the appointment card.`; focus on `palette.confirm.dob` (seq 9). |
| Control: wrong DOB `01/01/1900` + Enter (seq 10-20) | Refusal `second_identifier` (seq 21), verb `Date of birth does not match`, primary switched to `Held`. The gate compares. |
| `Try again` (seq 22-24), type `07/08/1969` copied from row 0, Enter (seq 25-35) | Dialog closed, Patient Rail opened (`rail.close` present, rail head `Lena Fischer DOB 7/8/1969 · phone …0126`), `write phiAccessLog p-306` at seq 36. Chart opened from on-screen data alone. |

Run B, `?privacy=1&device=operatory`: names collapse to initials (`LF`, `BF`, `CF`) but all 3 rows still read
`DOB 7/8/1969 · …0126` etc. (3/3 full DOB), while the Rail's ident line for the same patient in privacy mode is
`Born 1969 · phone …0126`. Side observation, not part of the reported defect.

## Why it is not a contract violation

- CONTRACTS.md section 4 only fixes the palette test ids (`palette.input`, `palette.row.<n>`, `palette.confirm.dob`);
  section 6 fixes the refusal shape, which the `second_identifier` gate honours (verb line, one control, Held).
  Nothing in CONTRACTS.md governs what a result row may display.
- docs/13 feature 28 specifies the row literally: "Three letters list patients (name · DOB · last-4 phone as two
  identifiers)" and "two identifiers only until confirmation writes the phi_access_log row on chart open".
  docs/04 IA: "typeahead over name, DOB, phone, MRN; two-identifier confirmation on chart open". The prototype
  (`store.js` search: `'DOB ' + longDate(p.dob) + ' · …' + phone.slice(-4)`) implements that text.
- The gate is specified as a right-patient confirmation (three Fischers, pick the one whose DOB the patient or the
  appointment card gives), not as proof the patient is present. The prototype's own hint says "or read it from the
  appointment card". No contract requires the patient to be present to open a chart; front-desk and billing work
  routinely opens charts with no patient in the room.

Contract rule: none: preference (spec-level design question, not a rule the prototype breaks).

## Recommendation

Do not fix in the prototype against the current spec. Raise in docs/11 as an open question for feature 28:
should search rows mask the DOB to year (`Born 1969`, as the Rail does in privacy mode) or to month/year so the
typed confirmation carries information the screen did not already give, and should privacy mode on operatory
glass mask the DOB in palette rows the way it masks names. If counsel or the owner wants the gate to be more than
a right-patient check, that is a spec change with a cost in search ergonomics (docs/07 item 2, docs/11 item 2).
