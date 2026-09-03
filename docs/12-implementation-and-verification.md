# Implementation steps and verification checks for this repository

> Source: generated from the approved consolidation plan (planning session of 2026-09-03; workflow `wf_8edc6cab-3ac`, 44 agents). The evidence behind every claim is under `knowledge/reviews/`. Legal statements carry one of four labels: PRIMARY, SECONDARY, REPO, UNVERIFIED (see `docs/11`).

The deliverable of this task is the review and the plan, so implementation means committing the planning corpus into `CatCorner22/Dental_Mgmt` on branch `claude/dental-precog-consolidation-60ckgd` and opening a draft pull request. No application code is written in this pass; Phase 0 scaffolding starts in a later task once the owner has confirmed or changed the recommendations in the decision table.

1. **Repository skeleton** (all new files; the repo is empty):
   - `README.md` — what this repository is, how the documents relate, how to read them in order, and the status of every open decision.
   - `docs/00-review-of-dental-and-precog.md` — the full review above with every file path (long form of section "Review of the two repositories").
   - `docs/01-product-vision-and-scope.md` — vision, personas, jobs-to-be-done, the ten must-haves and twelve unmet needs mapped to features, what is deliberately out of scope for v1.
   - `docs/02-architecture.md` — stack decision and rationale, tenancy model, hosting, offline strategy, integration boundaries (clearinghouse, payments, imaging bridges, eRx), how dental and precog code migrate, plus one Architecture Decision Record per contested decision under `docs/adr/`.
   - `docs/03-data-model.md` — entities and relationships; ledger as append-only postings with derived balances; frozen attribution; encounter-attached notes; four-state field model; retention clocks and legal hold; amendment chain.
   - `docs/04-ux-blueprint.md` — information architecture, persistent patient rail, home screen per persona, minimal-click flows for the top daily tasks, validation-timing policy, 44 px glove floor, severity shape/word/luminance rules, "Home is the work" rule.
   - `docs/05-internal-controls-module.md` — how Precog's rulebook, dual-release, COSO mapping, decision journal, and reconciliation consume live PMS events; where controls are enforced vs recorded; the bank-to-ledger reconciliation design; the interactive assessment loop.
   - `docs/06-security-and-hipaa-plan.md` — the full control mapping with citations and verification labels, architecture, identity, encryption and keys, audit logging, AI/PHI policy, vendors and BAAs, backup/DR, incident response, secure SDLC.
   - `docs/07-compliance-program-and-calendar.md` — risk analysis cadence, policies, training, BAAs, sanctions, documentation retention, breach clocks, SOC 2 / HITRUST timing, CDT license, PCI scope.
   - `docs/08-roadmap.md` — phases with scope, exit criteria, dependencies; what ships when; pilot instrumentation.
   - `docs/09-naming.md` — candidate names with rationale, taglines, collision-screen results, and the explicit statement that the screen is preliminary and formal clearance (USPTO Class 9/42 search by counsel) is required.
   - `docs/10-decisions-for-owner.md` — every decision that is the owner's to make, with options, recommendation, and why.
   - `docs/11-open-questions-and-unverified.md` — everything asserted on secondary sources or not verified, so nothing reads as more certain than it is.
2. **Knowledge base import**: extract the 33-file zip into `knowledge/` (INDEX.md, semantic-memory.md, sources/*), add the v3 report as `knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md`, and append an INDEX section listing the eight explorer reports and this plan as new sources, following the repo's existing ingest discipline (one indexed line per source, fixed front-matter).
3. **Workflow evidence** saved under `knowledge/reviews/` so every conclusion in `docs/` can be traced to the agent output it came from: the eight explorer reports (one per subsystem), the four design lenses and three judge reports, the design synthesis, the two security drafts, the citation-verification verdicts (one file, one row per statement with verdict and correction), the security synthesis, the three naming sets with collision-screen results, and the completeness critique. Each file gets the repo's fixed front-matter and one INDEX line.
4. **Git**: commit on `claude/dental-precog-consolidation-60ckgd`; push with `git push -u origin`. Because the repository has no default branch, a pull request needs a base: create `main` from an initial commit containing only `README.md`, push it, then open the **draft** PR from the feature branch against `main` via the GitHub MCP tools (there is no PR template to mirror because the repo is empty). Subscribe to PR activity. Creating `main` is the one push outside the feature branch; approving this plan is the explicit permission for it (decision 1). If you prefer to create `main` yourself, say so and I will open the PR against it instead.
5. **Artifact**: publish the review-and-plan as a private claude.ai artifact so it can be read and shared outside the repository (load the `artifact-design` skill first).

## Verification

- Every document renders as Markdown and every intra-repo link resolves (script: walk `docs/*.md` and `knowledge/**` for relative links and check the target exists).
- `knowledge/INDEX.md` has exactly one line per file under `knowledge/sources/` and `knowledge/reviews/` (script: diff the directory listing against the index).
- Every legal or regulatory statement in `docs/06` and `docs/07` carries one of the four labels (PRIMARY / SECONDARY / REPO / UNVERIFIED), checked by grep for the label pattern on every line containing "CFR", "Tenn. Code", "Rule 0460", "HIPAA", "PCI", "CDT".
- Every reused-asset row in `docs/00` names a path that exists in the cloned `dental` or `precog` checkout (script: extract paths and `test -e`).
- Every phase in `docs/08` has scope, exit criteria, and dependencies, and every decision row in `docs/10` matches the table in this plan (script: count `### Phase` headings and the three sub-headings under each; diff the decision numbers).
- The draft PR exists, is marked draft, targets `main`, and the branch protection/CI state is reported back honestly (there is no CI in the new repo yet, so "no checks" is the expected state).

## Feature-layer amendments (2026-09-03)

Adopted from `docs/13-innovation-and-intuitiveness.md` (the feature workflow's synthesis and its critique). Where an amendment conflicts with text above, the amendment governs.

- Add CI gates: copy catalog lint (≤8 words, verb-first, no currency token in note-scoped copy, terminology registry); luminance-ladder ordering asserted from token metadata; bounding-box check ≥44×44 with 8 px gaps on the five flows; pointer-disabled Playwright run of the five flows plus axe-core; explanation-template coverage test over reason_codes; twin-row test over the AI capability registry; no-provider-dimension test on the schedule-honesty and screening-share queries; property tests for variance-sentence templates alongside the ledger suite; the claim-line corpus as a precondition for the contradiction stop blocking Submit.
- From the critique: the ≤8-word verb-first lint applies to the refusal verb line only; worklist rows and finding titles follow a separate row grammar (object · state · one action).
