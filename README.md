# Dental_Mgmt: consolidation of Smile Notes and Precog Pioneer into one dental practice management system

This repository holds the **review and plan** for combining two existing products into a single, HIPAA-grade, commercial dental practice management system (PMS):

- `CatCorner22/dental` (**Smile Notes**): a de-identified clinical-note builder with a deterministic audit engine, a hardened authentication layer, and 201 test files.
- `CatCorner22/precog` (**Precog Pioneer**): an internal-controls and residual-risk coach whose segregation-of-duties rulebook and dual-release evaluator become the PMS's enforced controls.

No application code lives here yet. Phase 0 scaffolding starts in a separate task once the owner confirms or changes the recommendations in `docs/10-decisions-for-owner.md`.

## Read in this order

| Step | Document | What you get |
|---|---|---|
| 1 | `docs/01-product-vision-and-scope.md` | Why the product exists, the market evidence, the three structural bets, the 22 design principles, and the module map with phase tiers |
| 2 | `docs/00-review-of-dental-and-precog.md` | What was verified in each repository, and what to lift verbatim, rewrite, or drop, file by file |
| 3 | `docs/02-architecture.md` | Stack, monorepo layout, database and tenancy, migrations, hosting, sessions, API, and the code-migration map |
| 4 | `docs/03-data-model.md` | Every entity group, the append-only ledger, and the database-enforced invariants |
| 5 | `docs/04-ux-blueprint.md` | Information architecture, one home screen per persona, the five daily flows with click counts, and how "intuitive" is measured |
| 6 | `docs/05-internal-controls-module.md` | How Precog's engines run on live PMS events, where controls refuse and where they only record |
| 7 | `docs/06-security-and-hipaa-plan.md` | 18 regimes, 36 controls mapped to tables and phases, architecture, identity, encryption, audit, AI policy, vendors and BAAs, backup, breach clocks, secure development |
| 8 | `docs/07-compliance-program-and-calendar.md` | Governance, cadence, attestations, the compliance calendar, and 32 questions for counsel |
| 9 | `docs/08-roadmap.md` | Six phases with scope, exit criteria, dependencies, sequencing contingencies, and the risk register |
| 10 | `docs/13-innovation-and-intuitiveness.md` | The feature layer: the thesis, six signature moments, 30 catalog features with specifications and click counts, 8 features adopted from the critique, the amendments adopted, and the ideas rejected with reasons |
| 11 | `docs/09-naming.md` | Thirty name candidates, selection criteria, the shortlist, and the collision-screen status |
| 12 | `docs/10-decisions-for-owner.md` | The 26 decisions that are the owner's, each with options, a recommendation, and why; mirrored as ADRs under `docs/adr/` |
| 13 | `docs/11-open-questions-and-unverified.md` | Verification method and labels, every correction adopted, every statement still unverified, and the completeness critique |
| 14 | `docs/12-implementation-and-verification.md` | How this repository was produced and how to check it |

## Status of the open decisions

Every decision in `docs/10` carries a recommendation. The recommendations stand unless the owner changes them. The one repository action that needed explicit permission (creating `main` so a pull request has a base) was granted by approving the plan.

## Verification labels

Legal and regulatory statements carry one of four labels wherever they appear:

- **PRIMARY**: read from the official text (none in this pass; the official domains were blocked from the planning environment).
- **SECONDARY**: confirmed through search snippets of reputable secondary sources, or by the workflow's verifier agents working from the same kind of sources.
- **REPO**: asserted in the dental repository's knowledge files and not independently re-verified.
- **UNVERIFIED**: asserted by a draft and not checked, or checked and found unverifiable from this environment.

Of 127 statements checked: 62 confirmed (SECONDARY), 17 corrected, 1 refuted and reversed, 47 unverifiable and listed for counsel in `docs/11`.

## Evidence

- `knowledge/` is the market-research knowledge base (v3, 2026-09-02) that the plan builds on: `INDEX.md`, `semantic-memory.md`, 31 source cards under `sources/`, and the full report.
- `knowledge/reviews/` holds the 44 planning-agent outputs rendered to Markdown (explorer reports, design lenses, judges, design synthesis, security drafts, citation verdicts, security synthesis, naming sets, collision screen, critique), the approved plan itself, and the 13 feature-workflow outputs behind `docs/13` (`features-*`). Every conclusion in `docs/` traces to one of these files.

## Checking this repository

```
bash scripts/verify-docs.sh
```

The script checks that every relative link resolves, that `knowledge/INDEX.md` lists every source and review file exactly once, that the regulatory tables in `docs/06` carry a verification label on every row, that every repository path named in `docs/00` exists in a checkout of `dental` or `precog` (pass the checkout paths as arguments), that `docs/08` has six phases each with scope, exit criteria, and dependencies, and that the decision table in `docs/10` matches the ADR set.

## Terminology

The documents use one term per concept: **the PMS** (the merged product), **tenant** (one practice), **location** (one office of a tenant), **encounter** (one visit), **ledger entry** (one append-only money row), **dual release** (a second approver required before a money-moving entry posts), **owner**, **office manager**, **biller**, **hygienist**, **front-desk coordinator**.
