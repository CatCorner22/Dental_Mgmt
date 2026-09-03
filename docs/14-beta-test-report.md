# Beta test of the clickable prototype with a 30-persona stakeholder panel

Status: thresholds pre-registered 2026-09-03 before any session ran (see the commit that introduced this file). Results are appended below the line "Results" once the panel has run; nothing above that line changes after it.

## Falsifiable claim

The merged PMS's UX, as specified in `docs/04-ux-blueprint.md` and `docs/13-innovation-and-intuitiveness.md`, is learnable and operable by all six professions (front-office administrative staff, back-office administrative staff, dentists, oral surgeons, dental hygienists, dental assistants) across the stated range of ages, health, and ability, at or under the click budgets, when exercised on a clickable prototype that implements the specifications faithfully.

The negation this exercise can return: personas in one or more professions fail their role's daily tasks, exceed the budgets, or hit gates they cannot get past, or an ability group is excluded by a control that does not meet the 44 px, contrast, or keyboard rules.

## Pre-registered thresholds (set 2026-09-03, before data)

**UI stable** means every row of `scripts/proto-check.mjs` passes:

| Check | PASS |
|---|---|
| routes | 0 console errors, 0 page errors, 0 event-log errors on every route × persona × theme |
| flows | 5 of 5 daily flows complete keyboard-only within budget (check-in 1 tap; perio 2 taps plus 168 keystrokes; chart+plan+note ≤10 taps; checkout ≤4 clicks; ERA post 1 click and close day 2 clicks) |
| targets | 100% of focusable controls ≥44×44 px; sibling gaps ≥8 px |
| contrast | 100% of text ≥4.5:1 (≥3:1 at ≥24 px), both themes |
| overflow | 0 horizontal overflow at 1280, 1024, and 820 px on every route |
| motion | 0 animated elements under reduced motion |
| focus | visible focus on 100% of controls; 0 keyboard traps |
| testids | 100% of elements with a handler carry a `data-testid` |
| shots | 8 persona homes × 2 themes captured |

**Beta passed** means all of:

- Task success ≥80% of all task attempts across the panel.
- Median would-choose ≥4 of 5 in every profession.
- No reproduced P0 defect open at the end of the fix rounds.
- ≥90% of budgeted tasks completed within budget.

**Rerun band**: task success between 65% and 80%, or any profession's median would-choose between 3 and 4. Action: one fix round, then re-run the affected personas' tasks only.

**Stop**: task success below 65%, or any profession's median would-choose below 3, or any P0 unresolved after the second round. Action: report FAIL and list the specification changes needed in `docs/04` and `docs/13`.

Severity: **P0** blocks a daily flow or excludes an ability group; **P1** misses a click budget or fails a target, contrast, or keyboard rule; **P2** causes confusion the persona quotes; **P3** is preference.

## Scope

In: the five daily flows and the six signature moments as rendered by `prototype/` (Board, Checkout, Chairs, Perio, Encounter, Money Desk, Daily Close, Roles, Patient Rail, palette, phone approvals). Out: imaging, portal and messaging, ePrescribing, migration, report builder, COSO heat map, CPA month-end, lab and referral detail beyond chips, real authentication, autosave, AI assist (each needs a backend or a vendor to mean anything).

## Roles

- **Runs it**: 30 persona agents, one per roster record in `knowledge/reviews/beta-panel-roster.json`, each driving the prototype through Playwright and Chromium under its own device profile and theme, then completing the structured interview.
- **Adversary**: two verifier agents per reported defect, drawn from a different profession, each writing its own reproduction script. A defect counts only when at least one verifier reproduces it with event-log evidence.
- **Grades**: a dedup-and-severity agent applies the severity definitions above; a synthesis agent drafts the results; a completeness critic checks that every persona and task appears, that thresholds were applied as written, and that negative results were kept.
- **Sponsor**: the repository owner, who does not grade.

## Declared constraints (and their effect on the conclusion)

| Constraint | Reason | Effect |
|---|---|---|
| Personas are language-model agents | No human panel is available in this session | They enact a trait's test behaviours; they cannot feel tremor, glare, fatigue, or pain. Findings about those traits are structural (target size, contrast, keyboard reach), not experiential |
| Synthetic data, one tenant | No PHI may exist here | Ledger and claim edge cases are the ones seeded; real payer behaviour is untested |
| Static prototype, simulated refusals | No backend exists yet | Latency, concurrency, autosave, and real dual-release timing are untested |
| No real gloves, pedals, or devices | Headless Chromium | Target sizes and key grammar are checked geometrically, not physically |
| Evidence rule: every finding cites `seq` ranges from `window.__events` | Prevents invented findings | Findings that cannot be tied to events are discarded, even if plausible |

## What this exercise cannot prove

- The 8-minute full-mouth perio target, or any time-on-task figure; event counts are a proxy for effort, not for minutes.
- Real-world learnability by a temp in one shift.
- Screen-reader usability; no assistive technology runs in this environment. Focus visibility, labels, and live regions are checked structurally.
- Payer, clearinghouse, or bank behaviour.
- Security properties; the prototype has no authentication.

## Recording plan

- `prototype/` and `scripts/proto-check.mjs` output (`report.json`, screenshots) in the scratch directory, summarized below.
- One session file per persona at `knowledge/reviews/beta-sessions/bp-NN.md`, validated by `scripts/beta/validate-session.mjs`, including negative results (failed tasks, would-choose below 3).
- Verifier files `knowledge/reviews/beta-sessions/verify-*.md`, the dedup file, the synthesis, and the critic's file.
- Results by profession and by task, defects fixed and open, and the verdict against the thresholds above, appended under "Results".

## Roster

Generated by `node scripts/gen-roster.mjs --seed 20260903` into `knowledge/reviews/beta-panel-roster.json` with one card per persona under `knowledge/reviews/beta-panel/cards/`. Six groups of five; gender identity 9 men, 11 women, 3 trans men, 3 trans women, 4 nonbinary people; ages 19 to 68 with every age band present in every profession; at least 12 personas carry an access-relevant note (low vision, deuteranopia, essential tremor, hard of hearing, ADHD, dyslexia, chronic back pain, wheelchair user, third-trimester pregnancy, non-native English) and no persona carries more than two notes; incumbent systems Dentrix, Eaglesoft, Open Dental, Curve, Denticon, CareStack, tab32, or none; tech comfort 1 to 5; device profiles desk, operatory, shared, and phone width.

Respect rules, enforced by a review pass on every card before the panel runs: a trait is context for what the persona tests, never the persona's identity or a punchline; no medical detail beyond what changes the interaction; pronouns are used consistently; every persona has a job, a history with a system, and a device.

---

## Results

_Pending. Appended after the panel runs; nothing above this line changes._
