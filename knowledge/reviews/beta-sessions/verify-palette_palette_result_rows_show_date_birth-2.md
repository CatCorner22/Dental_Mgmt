---
title: "Verify: palette result rows show the DOB before the second-identifier gate asks for it (lens 2, reproduction)"
type: review
date: 2026-09-03
source: beta panel bp-02 (seq 95-99), bp-03 (seq 136-141); own clean run
tags: [beta-panel, verify]
---

## Verdict

**Behavior confirmed; not a prototype defect. reproduced = false (spec-conformant).**

The prototype does exactly what the reporter describes, but it is doing what the written spec tells it to do. The concern is against the design of docs/13 feature 28, not against the prototype's conformance to it.

## Evidence (own run, `window.__events` seq 1-22)

Clean load of `file:///home/user/Dental_Mgmt/prototype/index.html#/frontdesk/board?theme=light&device=desk`, desk device, privacy off.

- seq 2 click `topbar.search`; seq 4-6 keys `f`,`i`,`s` on `palette.input`.
- `palette.row.0` text: `Lena Fischer` / `.syn` = `DOB 7/8/1969 · …0126`. Height 44 px, `.syn` display `block`, visibility `visible`. Seed `patients.p-306.dob` = `1969-07-08`, so the row shows the full seed DOB.
- seq 8 click `palette.row.0`; seq 9 focus `palette.confirm.dob`. The confirm step itself does not repeat the DOB (name line is `name · …0126 · MRN`); hint reads "Second identifier. Ask the patient, or read it from the appointment card."
- seq 10-20 typed `07/08/1969` (the value read off the row) + Enter; seq 21 `write`; palette closed; zero `refusal` events (no `second_identifier` code). The gate was satisfied with the displayed value.

## Contract check

- `CONTRACTS.md` §4 lists `palette.input`, `palette.row.<n>`, `palette.confirm.dob` and §6 lists the `second_identifier` refusal code; neither constrains what a result row may display.
- `docs/13-innovation-and-intuitiveness.md` feature 28, Specification: "Three letters list patients (**name · DOB · last-4 phone as two identifiers**) ... Selecting a patient requires the second identifier before the chart opens." PHI and controls: "two identifiers only until confirmation writes the phi_access_log row on chart open."
- `docs/04-ux-blueprint.md` line 7: "global patient search (typeahead over name, DOB, phone, MRN; two-identifier confirmation on chart open)."
- The store's `search()` (`prototype/js/store.js`, Palette search) and `rowSyn()` in `prototype/js/screens/palette.js` implement that line verbatim.

So the row content is the specified two-identifier disambiguation display, and the confirm step is the specified confirmation. The hint's own words ("or read it from the appointment card") show the gate is intended as a positive-identification ritual against wrong-patient selection, not as a secret the operator must not already know. Nothing in CONTRACTS.md or docs/04 rules (44 px targets, one verb line + one control, validation silent until blur, no per-person counts) is violated.

## What is worth carrying forward (not as a prototype bug)

The reporters' underlying point is fair as a spec critique: if the second-identifier step is meant to add assurance, showing the DOB in the result row makes the confirmation a copy exercise. Options for the spec owner: show DOB as month/year or age in rows and ask for the full date at confirm; or accept that the gate is a wrong-patient check (the operator confirms with the patient) and say so. Recommend routing to docs/11 open questions against feature 28 rather than filing against the prototype.

## Script

`/tmp/claude-0/-home-user-Dental-Mgmt/4c28e93a-776f-5803-ad14-686b00bc97f0/scratchpad/beta/verify/palette_palette_result_rows_show_date_birth-2.cjs` (run with `NODE_PATH=/opt/node22/lib/node_modules`).
