---
title: "Verify: Palette result rows show the date of birth before the second-identifier gate asks for it"
type: review
date: 2026-09-03
source: beta panel adversarial verification (contract-rule lens) of defect key `palette|palette result rows show date birth`, reported by bp-02 (seq 95-99) and bp-03 (seq 136-141)
tags: [beta-panel, verify]
---

# Verdict: NOT REPRODUCED as a defect (behaviour confirmed; it is the specified design, not a contract violation)

The behaviour the reporters describe is real and I observed it independently, but it is exactly what the spec asks
for. No CONTRACTS.md section or docs/04 rule says the confirmation identifier must be concealed from the result list;
docs/13 feature 28 says the opposite. Reclassify as a design question (candidate for docs/11), not a P2.

## Evidence (my run, `window.__events` seq 1-19, both passes identical)

Pass 1: `#/frontdesk/board?theme=light&device=desk`. Pass 2: `device=shared&privacy=1`.

| Step | Observation |
|---|---|
| seq 2-6 | `topbar.search` click, keys `f` `i` `s` on `palette.input` |
| row text | `palette.row.0` label `Lena Fischer` (privacy pass: `LF`), `.syn` = `DOB 7/8/1969 · …0126`, 44 px tall, `.syn` computed `display:block; visibility:visible` |
| seed check | `Proto.store.patient('p-306').dob` = `1969-07-08`; the row's DOB parses to the same ISO date (`rowShowsSeedDob: true`) |
| seq 7-9 | click `palette.row.0` -> confirm step, focus lands on `palette.confirm.dob`; title `Confirm date of birth`; who-line `Lena Fischer · …0126 · MRN-306` (the confirm step itself does **not** re-show the DOB); hint `Second identifier. Ask the patient, or read it from the appointment card.` |
| seq 10-14 | wrong DOB `01/01/1970` -> `refusal.verb` = `Date of birth does not match`, primary switches to `Held`, no `phiAccessLog` write, hash unchanged. The gate genuinely checks. |
| seq 15-18 | DOB copied from the row (`7/8/1969`) -> `write:phiAccessLog` at seq 18, palette closes, Rail opens on `Lena Fischer` (`LF` in privacy mode) |

Screenshots: `.../verify/palette_palette_result_rows_show_date_birth-1-{desk,shared-privacy}-{rows,confirm,after}.png`.

## Why it is not a contract violation

- **docs/13 feature 28, Specification:** "Three letters list patients (**name · DOB · last-4 phone as two identifiers**) ... Selecting a patient requires the second identifier before the chart opens." The row content is prescribed verbatim; the prototype renders it verbatim (`store.search`: `'DOB ' + longDate(p.dob) + ' · …' + p.phone.slice(-4)`).
- **docs/13 feature 28, PHI and controls:** "two identifiers only until confirmation writes the phi_access_log row on chart open." The row shows exactly the two identifiers plus the name; the full record (MRN, chart, ledger) appears only after the gate and the `phiAccessLog` write (seq 18). That rule is honoured.
- **docs/04 IA:** "global patient search (typeahead over name, DOB, phone, MRN; two-identifier confirmation on chart open)." Satisfied: two identifiers displayed, confirmation required, refusal on mismatch (seq 12).
- **CONTRACTS.md** section 4 only lists the test ids (`palette.input`, `palette.row.<n>`, `palette.confirm.dob`); section 6 lists the `second_identifier` refusal code and the gate shape (verb line, one 44 px control, Why, Held identity), all of which the confirm step meets (verb `Date of birth does not match` = 5 words, one control `Try again`, primary becomes `Held`).
- Nothing in CONTRACTS.md, docs/04 or docs/13 says the typed identifier must be one the operator has not seen. The design intent is stated in the copy itself: "Ask the patient" — the two-identifier check is a patient-matching step (compare the person in front of you to the record), and the typed entry is the deliberate act that writes the access-log row. Whether a displayed identifier makes the typed step a rubber stamp is a legitimate design critique of the spec, not a break of it.

**Contract rule: none: preference** (a design question about docs/13 feature 28, which explicitly prescribes the row content).

## Worth carrying forward (not this defect)

- The reporters' underlying concern is reasonable as an open question for docs/11: should the confirm step ask for the identifier *not* shown in the row (for example last-4 phone when DOB is displayed, or ask for whichever the patient can volunteer)? That is a spec change, not a prototype bug.
- Side observation from pass 2: in privacy mode on a shared device the name is masked to initials (`LF`) but the full DOB remains in the row. docs/04 defines privacy mode as hiding **names**, so this is also within the stated rule, but it is the more interesting shoulder-surfing question if the panel wants one.

## Reporter evidence

bp-02 seq 95-99 and bp-03 seq 136-141 record only the keystrokes, the row focus/click and (bp-03) the focus on `palette.confirm.dob`; no measurement and no rule cited. Their observation of the row text is accurate.

## Script

`/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/palette_palette_result_rows_show_date_birth-1.cjs`
(results: same basename `.result.json`, six screenshots as listed above).
