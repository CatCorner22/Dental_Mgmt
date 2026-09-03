# Explorer report 5: dental-peripheral

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 5 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, dental-peripheral

## Summary

The "peripheral" surface of the Smile Notes repo is roughly 8,700 lines of application code across twelve loosely-related subsystems, and the single most important finding is that the label is wrong for at least three of them. `src/lib/byteaudit/**` is not per…

## Scope

dental-peripheral

## Summary

The "peripheral" surface of the Smile Notes repo is roughly 8,700 lines of application code across twelve loosely-related subsystems, and the single most important finding is that the label is wrong for at least three of them. `src/lib/byteaudit/**` is not peripheral at all — it is the publish gate wired into `src/app/api/drafts/[id]/submit/route.ts:39`, a cryptographically sealed, deliberately duplicated verifier that refuses to file a note whose frozen artifact disagrees with its own record row. `src/lib/packs/**` feeds the note builder's Fast Lane on the hot path (`src/components/builder/FastLane.tsx`). `src/lib/law/license-scope.ts` feeds `src/lib/scope/authorCapabilities.ts`, which gates who may author which sections. Conversely, three things presented as features are effectively dead: `src/lib/risk/categories.ts` (258 LOC, a well-argued failure taxonomy with a build-enforcing exhaustiveness test and zero importers outside its own test), `src/lib/gamify/insights.ts` (90 LOC, no callers), and `rollingGpa` in `src/lib/stats/computeStats.ts:105`. The GPA itself is computed, frozen onto every filing, and paid out on — but never rendered on any screen in the app.

Code quality across the area is unusually high and unusually verbose. Nearly every module opens with a 20–40 line design rationale that states the trade-off taken, names the rejected alternative, and lists honest divergences from spec (see `src/lib/stats/badges.ts:97-107`, `src/lib/learning/redact.ts:1-35`, `src/lib/digest/digest.ts:3-32`). Several of these headers encode product principles that are more valuable than the code beneath them: the digest's four rules (batch not alert, never a single note, like-vs-like, and — enforced in code at `DIGEST_RULES.SYSTEMIC_SHARE = 0.6` — a finding that applies to most of the practice is re-scoped to the tool and the names dropped); the learning ledger's "learning moves out of the weights and into versioned tables" doctrine; and `verify.ts`'s "pro-user, not pro-system" refusal posture. This is prototype-to-solid engineering with production-grade reasoning, ~201 test files, and a CI that enforces three separate version-stamp disciplines.

Maturity is uneven in a predictable pattern: pure library modules are well tested, and every large React component in scope is not. `WorkflowBoard.tsx` (512), `GauntletForm.tsx` (499), `WishList.tsx` (413), `ByteStarAdvisor.tsx` (391), `RiskManagement.tsx` (289) and `StoreFront.tsx` (171) have zero tests between them. `src/lib/law/watch.ts` scrapes six live government HTML pages and has no test file. `src/lib/practice/config.ts` and `src/lib/db/repo/offices.ts` — the entire tenancy story — have no tests and no tenant boundary.

For the merged PMS the recommendation splits cleanly. Keep and generalize: byteaudit's seal-and-independently-restate pattern, the digest's reporting philosophy and copy-forward discriminator, packs' maker-checker versioned publish, wishes as a staff-observation intake, learning's fail-closed allow-list redactor, license-scope, and the ops metrics (time-to-file, after-hours filing rate, first-pass rate). Make optional modules of: the ByteStar LLM cage, law-watch, the training arena, vocabulary proposals, and the GPA. Drop: the points economy and clinic store, the Sparkle mascot, the Data Hygiene Gauntlet as a user-facing screen, the EDR paste-target abstraction (its premise inverts when the product becomes the record), and the hand-written provisional risk-management content — the last of which precog replaces outright.

## Architecture

DATA FLOW — the peripheral features hang off two spines.

Spine 1: the submit path (`src/app/api/drafts/[id]/submit/route.ts`, ~400 LOC) is where five in-scope subsystems converge. In order: the audit engine produces a report → `deriveGpa(report, note, modules)` (line 217) produces a frozen 4-axis grade stamped with `GPA_VERSION` → `assistEventsForDraft` folds in AI provenance → `byteAuditVerify` (line 39) independently re-derives whether the artifact may publish and can throw `ByteAuditRefusal` → the filing happens in ONE transaction (claim + ticket reservation + frozen note + frozen audit) → then, best-effort and outside the transaction, `awardForSubmission` and per-badge `awardOnce` write to the append-only points ledger, and `filingRollup` snapshots modules/categories/killers onto the row. The comment at line ~397 states the ordering rule explicitly: "A missing award is a support question; a failed filing is an outage."

Spine 2: the digest page (`src/app/digest/page.tsx`, lead-gated) is a single server component that loads up to 500 filed submissions with full note markdown and audit JSON (`DIGEST_ROW_CAP = 500`) and fans them out to four independent analyzers — `buildDigest` (patterns), `proposalsFromNotes` + `grammarGrowthFromNotes` (learning), `buildPracticeFilingRollup` (module/category totals), and `buildByteStarSummary` (rolled up from `audit_log` rows with action prefix `bytestar.`). No extra queries; everything is derived from data the practice already stores, which is a stated privacy principle rather than an optimization.

KEY ABSTRACTIONS.

1. Frozen-artifact-plus-independent-verifier (byteaudit). `contract.ts` restates 13 pipeline promises from scratch — deliberately NOT importing the composer, stamp builder, audit engine, or ticket formatter — so that a bug cannot cancel itself out on both sides of the comparison. `verify.ts` re-parses the frozen documents with its own regexes and objects at `refuse` or `concern` severity. `seal.ts` + `manifest.ts` hash the directory; a test reads every file from disk and fails CI on drift, a second test asserts the directory imports nothing from the app but pure types, and re-sealing requires running `scripts/byteaudit-seal.mjs` by hand. It fails closed: an unparseable artifact is a refusal, not a pass.

2. Deterministic-first, model-second (advisor → bytestar). `advise(text)` in `src/lib/advisor/advisor.ts` is pure, total, client-side, zero-network: one extraction pass plus table lookups over 23 knowledge entries, returning advice + gauges (`readCoverage`, `density`, `ReaderPillars`, `DoseGauge` against `ANAESTHETIC_LIMITS`) + a mood derived from the same numbers. Only when that is insufficient does ByteStar call a provider, and every strictness decision is still made by regex, not by the model.

3. The ByteStar cage (`src/lib/bytestar/**`, 24 files). Ordered gates in `service.ts`: perma-kill latch → config gate → 20k truncation → primary `runPhiRule` + secondary `scanPhiForProvider` → `detectEscape` on input → deterministic `resolveModes`/`resolveProfile` (documentation | sedation | imaging | legal; two high-risk modes escalate to legal = 3 reads, unanimous, no rewrites, regulatory sources only) → RAG over practice tables → N independent reads with rotating lenses → `detectEscape` on output (any read escaping refuses the whole turn and feeds the ladder) → majority or unanimous consensus on `kind|anchor` keys → per-suggestion verification (source allow-list, evidence must appear verbatim via `input.includes`, gap kinds must be questions, rewrites must pass `verifyMeaning`) → deterministic `tentative` labeling for strong claims without a named authority. `one-way.ts` blocks the actions staff would use to talk back.

ENFORCEMENT — SERVER VS CLIENT. Consistently server-side, with the client copy documented as convenience. `src/lib/requests/gauntlet.ts:11-15` states it: the same pure function guards the button and the API route, "so a request cannot be forced through by calling the endpoint directly." Training completion is verified server-side by running the real audit engine on the submitted repair (`src/app/api/training/complete/route.ts`), plus a `matchesScenarioEvidence` case-identity check so a clean unrelated note cannot farm the bounty, plus throttling, plus a DB unique index making the bounty once-per-scenario. Store redemption does the balance check and the spend in one transaction; a decline refunds by APPENDING a ledger row, never by mutating one. Pack publish requires a second lead (`canManagePracticePacks`), and `validatePackBody` permits composition of shipped ids only — freeform clinical prose can never enter a pack.

Every route in scope self-guards via `requireRole(...)`, because `/api/*` bypasses middleware by design — a fact documented at `src/app/api/bytestar/route.ts:43-52` as the post-mortem of an unguarded GET that leaked config and amplified DB load anonymously.

ENTRY POINTS. Pages: `/store`, `/training`, `/wishes`, `/requests`, `/workflow`, `/digest`, `/reference/risk-management`, `/reference/tennessee-law`, `/admin/team`, `/admin/bytestar`. Only `/wishes` (labeled "Ask") is in the primary nav (`src/components/shell/AppHeader.tsx:57`); the rest are role-gated menu entries. APIs: `/api/store` (+`/items`, `/redemptions/[id]`), `/api/training/complete`, `/api/wishes` (+`/[id]`), `/api/change-requests`, `/api/workflow/packs` (+`/[id]`, `/events`), `/api/bytestar`, `/api/law-watch` (+`/alert`).

## Key files


### Item 1
- **path**: /home/user/catcorner22/dental/src/lib/byteaudit/contract.ts
- **purpose**: 13 pipeline promises with the evidence each must leave in the final artifact, plus KNOWN_STATUSES and LIMITS; deliberately restated rather than imported so a shared bug cannot cancel itself out
- **loc estimate**: 177

### Item 2
- **path**: /home/user/catcorner22/dental/src/lib/byteaudit/verify.ts
- **purpose**: The adversary: re-derives publish/refuse from the frozen note + frozen audit + record row alone, with its own regexes; refuses on doubt
- **loc estimate**: 317

### Item 3
- **path**: /home/user/catcorner22/dental/src/lib/byteaudit/seal.ts
- **purpose**: SHA-256 seal over the byteaudit directory with typed SealFailure kinds; fail-closed, hand-run re-seal via scripts/byteaudit-seal.mjs
- **loc estimate**: 162

### Item 4
- **path**: /home/user/catcorner22/dental/src/lib/byteaudit/manifest.ts
- **purpose**: Generated hash manifest for the three sealed files; a one-line-per-file diff is what makes backstop changes unmissable in review
- **loc estimate**: 17

### Item 5
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/service.ts
- **purpose**: The full LLM cage: PHI gate, escape scan, mode routing, RAG, N-read self-consistency consensus, per-suggestion verification, deterministic tentative labeling
- **loc estimate**: 394

### Item 6
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/router.ts
- **purpose**: Deterministic risk-mode classification (documentation/sedation/imaging/legal) to strictness profiles; foreign-jurisdiction detection that withholds TN-law observations
- **loc estimate**: 171

### Item 7
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/config.ts
- **purpose**: Three-switch deployment gate including the silent BYTESTAR_KILL killswitch the model is never told exists
- **loc estimate**: 67

### Item 8
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/escape.ts
- **purpose**: Six regex families detecting write-path, engine-access, killswitch-probe, PII-request, jailbreak and self-modification intent in model output
- **loc estimate**: 77

### Item 9
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/ladder.ts
- **purpose**: Warn to reset to perma-kill escalation within a 1h window, counting model-originated escapes only
- **loc estimate**: 64

### Item 10
- **path**: /home/user/catcorner22/dental/src/app/api/bytestar/route.ts
- **purpose**: Provider call site: PHI/escape checks before the quota meter, per-call audit rows carrying codes/versions/tokens only, lead-gated canary eval and perma-clear
- **loc estimate**: 300

### Item 11
- **path**: /home/user/catcorner22/dental/src/lib/advisor/advisor.ts
- **purpose**: Deterministic zero-network chairside coach; produces ReaderPillars (consent/outcome/instructions/followUp, presence-only never a score), density, parse coverage, anesthetic dose gauge
- **loc estimate**: 282

### Item 12
- **path**: /home/user/catcorner22/dental/src/lib/advisor/knowledge.ts
- **purpose**: 23 sourced knowledge entries with pure predicates over extracted facts, priority-ordered, role-scoped; every entry cites a statute, rule, case or paper
- **loc estimate**: 496

### Item 13
- **path**: /home/user/catcorner22/dental/src/lib/risk/categories.ts
- **purpose**: 8-category failure taxonomy (what a defect does to a record) plus a complete rule-id to category map and coverageByCategory(); DEAD CODE - zero importers outside its own test
- **loc estimate**: 258

### Item 14
- **path**: /home/user/catcorner22/dental/src/components/risk/RiskManagement.tsx
- **purpose**: Static 6-topic risk page with localStorage checklists, self-labeled 'provisional content'; the surface precog replaces outright
- **loc estimate**: 289

### Item 15
- **path**: /home/user/catcorner22/dental/src/lib/digest/digest.ts
- **purpose**: Team-lead pattern report with four hard rules encoded as constants, including SYSTEMIC_SHARE=0.6 which re-scopes a widespread finding to the practice and drops names
- **loc estimate**: 298

### Item 16
- **path**: /home/user/catcorner22/dental/src/lib/digest/similarity.ts
- **purpose**: Near-duplicate detection whose discriminator is the tooth signature: same text + same teeth is copy-forward, same text + different teeth is a template working correctly
- **loc estimate**: 164

### Item 17
- **path**: /home/user/catcorner22/dental/src/lib/digest/metrics.ts
- **purpose**: Per-note facts-per-100-words density, parser coverage, licenced omissions and severity counts, all from already-stored frozen artifacts
- **loc estimate**: 201

### Item 18
- **path**: /home/user/catcorner22/dental/src/lib/digest/filingRollup.ts
- **purpose**: Versioned per-filing snapshot of modules, audit categories and killer rule ids; practice totals only, with graceful degradation for pre-snapshot rows
- **loc estimate**: 321

### Item 19
- **path**: /home/user/catcorner22/dental/src/lib/learning/redact.ts
- **purpose**: Allow-list (not deny-list) redaction that fails closed: a token survives only if it is in a controlled clinical lexicon, and all numbers are redacted wholesale
- **loc estimate**: 121

### Item 20
- **path**: /home/user/catcorner22/dental/src/lib/learning/proposals.ts
- **purpose**: Vocabulary/grammar/rule-friction proposals with author-count-gated evidence; encodes the 'learning goes into versioned tables, not model weights' doctrine
- **loc estimate**: 315

### Item 21
- **path**: /home/user/catcorner22/dental/src/lib/wishes/wishes.ts
- **purpose**: Wish taxonomy with the urgent 'standards' safety category and the 'rule-disagreement' escape valve, plus ruleDisagreementStats as a rules-engine calibration signal
- **loc estimate**: 186

### Item 22
- **path**: /home/user/catcorner22/dental/src/app/api/wishes/route.ts
- **purpose**: Wish intake open to readonly accounts by design; 4000-char free-text detail with NO PHI gate and practice-wide read on GET
- **loc estimate**: 110

### Item 23
- **path**: /home/user/catcorner22/dental/src/lib/requests/gauntlet.ts
- **purpose**: Five-cycle schema-change gate (necessity, exhaustion, ripple, behavior, protection) as a pure module shared by client and server
- **loc estimate**: 300

### Item 24
- **path**: /home/user/catcorner22/dental/src/lib/packs/validate.ts
- **purpose**: Practice-pack body validation permitting composition of shipped module ids and suggestable block ids only; freeform clinical prose can never enter a pack
- **loc estimate**: 103

### Item 25
- **path**: /home/user/catcorner22/dental/src/lib/packs/publishedForVisit.ts
- **purpose**: Role-and-module matching that selects which published packs apply to this writer and this visit
- **loc estimate**: 74

### Item 26
- **path**: /home/user/catcorner22/dental/src/components/workflow/WorkflowBoard.tsx
- **purpose**: Draft to second-lead-approval to versioned publish UI with full event history; the maker-checker primitive, entirely untested
- **loc estimate**: 512

### Item 27
- **path**: /home/user/catcorner22/dental/src/lib/gpa/deriveGpa.ts
- **purpose**: 4-axis weighted grade derived from the audit report, frozen with GPA_VERSION; two stated rules - never a gate, never silently regraded - and no display surface anywhere in the app
- **loc estimate**: 109

### Item 28
- **path**: /home/user/catcorner22/dental/src/lib/stats/computeStats.ts
- **purpose**: First-pass rate, streak, badges, plus the three genuine ops metrics: median same-day minutes to file, after-hours count and rate in practice-local Eastern time
- **loc estimate**: 111

### Item 29
- **path**: /home/user/catcorner22/dental/src/lib/gamify/economy.ts
- **purpose**: Point award math (band, streak multiplier restricted to A-band, rank bonus) and the 5-tier STARTER_STORE seed
- **loc estimate**: 51

### Item 30
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts
- **purpose**: Append-only points ledger; balances and XP are sums never stored columns, idempotency enforced by a partial unique index on (user, refType, refId)
- **loc estimate**: 200

### Item 31
- **path**: /home/user/catcorner22/dental/src/lib/training/scenarios.ts
- **purpose**: Three planted-defect practice cases with plantedRules self-tests and requiredEvidence anti-farming tokens
- **loc estimate**: 93

### Item 32
- **path**: /home/user/catcorner22/dental/src/app/api/training/complete/route.ts
- **purpose**: Server-verified drill completion using the same audit engine that gates real notes; repaired text audited in memory and discarded, only a ledger row persists
- **loc estimate**: 100

### Item 33
- **path**: /home/user/catcorner22/dental/src/lib/training/persona-agents.ts
- **purpose**: Ten frozen de-identified staff archetypes with age, openness, coaching response and failure modes, grounded in named research; test-fixture material, not a product feature
- **loc estimate**: 359

### Item 34
- **path**: /home/user/catcorner22/dental/src/lib/law/license-scope.ts
- **purpose**: TN scope-of-practice may/mayNot/withCertification per license level with TCA and Rule 0460 citations; feeds authorCapabilities so it is core, not reference
- **loc estimate**: 266

### Item 35
- **path**: /home/user/catcorner22/dental/src/lib/law/watch.ts
- **purpose**: Six hardcoded public-source agents: HTML scrape, deterministic keyword scoring, optional AI summarization where the model never supplies the URL; no test file
- **loc estimate**: 256

### Item 36
- **path**: /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts
- **purpose**: Scheduled sweep authenticated by CRON_SECRET with constant-time digest comparison, fails closed when unset, deliberately no AI pass on a timer
- **loc estimate**: 80

### Item 37
- **path**: /home/user/catcorner22/dental/src/lib/practice/config.ts
- **purpose**: The single-tenant story: PRACTICE_NAME env var plus three hardcoded real Knoxville office addresses committed to the repo as first-boot seeds
- **loc estimate**: 48

### Item 38
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/offices.ts
- **purpose**: Office CRUD, seed-if-empty, and picker ordering; officeIdsForUser explicitly documents that it is NOT a permission check - there is no tenant boundary
- **loc estimate**: 130

### Item 39
- **path**: /home/user/catcorner22/dental/src/lib/edr/product.ts
- **purpose**: Env-driven naming seam for the external charting product (default Curve Hero) used in UI copy and AI source allow-listing; explicitly forbids adding a PMS sync API
- **loc estimate**: 84

### Item 40
- **path**: /home/user/catcorner22/dental/docs/bytestar-architect-audit.md
- **purpose**: Self-audit with a technique-to-implementation table, mermaid gate flow, and per-claim confidence calibration; states no learned parameters are in-repo
- **loc estimate**: 181

### Item 41
- **path**: /home/user/catcorner22/dental/src/lib/stats/sparkle.ts
- **purpose**: Deterministic mascot micro-copy across 14 contexts with an explicit ethics contract; 18 call sites make it the most-woven-in cosmetic dependency
- **loc estimate**: 124

## Reusable assets


### Item 1
- **name**: ByteAudit sealed independent verifier
- **path**: /home/user/catcorner22/dental/src/lib/byteaudit/
**why reusable**

A publish gate that re-derives its verdict from the final artifact alone, restating every promise from scratch rather than importing it, and refusing when uncertain. For a PHI-holding PMS this generalizes directly to the three highest-stakes writes: claim submission, ledger posting, and chart signing. The seal mechanism (directory hash in manifest.ts, a test that reads files from disk, a second test asserting zero app imports, hand-run re-seal) makes it structurally hard to quietly relax a control - which is exactly the problem the ADA embezzlement data describes, where only 17% of thefts are caught by designed controls because the controls drift.

- **quality**: production-grade
- **coupling**: Near-zero. Accepts plain strings and numbers only (FinalArtifact interface), imports nothing from the app, and is enforced not to. The only coupling is the submit route's single import at src/app/api/drafts/[id]/submit/route.ts:39 and the re-seal script. Lifts wholesale.

### Item 2
- **name**: ByteStar AI governance cage
- **path**: /home/user/catcorner22/dental/src/lib/bytestar/
**why reusable**

The complete set of controls a PHI product needs around any LLM call, already built and tested: PHI gate before the provider (and before the quota meter, so a blocked draft costs nothing), deterministic risk-mode routing so the model never grades its own danger, self-consistency across N reads with majority or unanimous voting, evidence quotes verified by input.includes rather than by the model, a source allow-list, a silent killswitch, a three-strike escape ladder, one-way feedback so staff cannot train or steer it, and one transparent audit_log row per call carrying codes/versions/tokens but never note text. Market research flags 'whether an AI compliance assistant routes patient context through third-party LLM APIs' as a live competitive objection - this architecture is the answer to it.

- **quality**: solid
- **coupling**: Moderate. Depends on lib/audit/rules/phi, lib/verify/verifyMeaning, lib/assist/retrieval, lib/extract, lib/scope/authorCapabilities, lib/edr/product, and the Vercel AI SDK. The gate ordering and the router are the portable parts; the retrieval and prompt content are Smile-Notes-specific. Budget a rewrite of prompts.ts, public.ts and benchmarks.ts.

### Item 3
- **name**: Fail-closed allow-list redactor
- **path**: /home/user/catcorner22/dental/src/lib/learning/redact.ts
**why reusable**

Inverts the usual deny-list PHI scrub: a token survives only if it appears in a controlled clinical lexicon, and numbers are redacted wholesale with no exception for 'obviously clinical' ones. A patient name cannot survive, not because it was recognized as a name but because it is not in the dental lexicon. The header states the failure-direction argument precisely - deny-lists fail open, which is tolerable when a human is about to read the result and intolerable in an artifact that gets stored, aggregated and circulated. Reusable for every analytics, telemetry, error-reporting, support-bundle and vendor-escalation path in a PHI product.

- **quality**: production-grade
- **coupling**: Low. Imports four vocabulary tables (lexicon-common, lexicon-dental, lexicon-generated, given-names). Swap the lexicons and it works on any domain.

### Item 4
- **name**: Digest reporting philosophy and systemic re-scoping
- **path**: /home/user/catcorner22/dental/src/lib/digest/digest.ts
**why reusable**

Four rules with real teeth: batch rather than alert (grounded in the 87.6% override rate across 611,192 drug-allergy alerts), never report on a single note, compare like with like inside a note type, and - enforced by DIGEST_RULES.SYSTEMIC_SHARE = 0.6 - when a finding would flag most of the practice, re-scope it to the practice and drop the names, because a standard nobody meets is a badly set standard. Every signal carries its sample size. The market research says reporting is where incumbents lose (Ascend 77% negative on reporting); this is a defensible reporting posture that also happens to be the anti-surveillance story staff need to hear.

- **quality**: solid
- **coupling**: Moderate. Depends on digest/metrics and digest/similarity, which depend on lib/extract and lib/audit/omissions. The rules and thresholds are the transferable part; the metrics need a PMS-appropriate replacement set.

### Item 5
- **name**: Copy-forward discriminator
- **path**: /home/user/catcorner22/dental/src/lib/digest/similarity.ts
**why reusable**

Solves the trap that kills naive duplicate detectors in dentistry: standardized notes for the same procedure SHOULD look alike. The discriminator is whether the parts that must differ actually differ - near-identical text with different teeth is a template working, with the same teeth is copy-forward, and with no clinical facts at all is boilerplate carrying nothing patient-specific. Five-word shingles plus an affirmed-tooth signature. In a PMS this is simultaneously a documentation-quality metric and an upcoding/fraud control, which makes it one of the cleanest bridges to the precog half.

- **quality**: solid
- **coupling**: Low-moderate. Needs lib/extract for facts and affirmed sites. The shingle-plus-signature idea ports to any domain with a natural 'thing being treated' key (tooth, claim line, account).

### Item 6
- **name**: Maker-checker versioned publish (practice packs)
- **path**: /home/user/catcorner22/dental/src/lib/packs/
**why reusable**

Draft, submit, second-lead approval, versioned publish, immutable event log with from/to version and decision note - backed by practice_packs and practice_pack_events tables and validated to permit only composition of shipped ids. This is the generic two-person-integrity primitive a PMS needs for fee schedule changes, adjustment and write-off reason codes, refund approvals, and treatment-plan templates. It is precisely the segregation-of-duties control precog detects the absence of, already implemented and shipping.

- **quality**: solid
- **coupling**: Low for the pattern, moderate for the current instance. validate.ts is tied to MODULES_BY_ID and SUGGESTABLE_BLOCK_IDS. The repo layer (src/lib/db/repo/practicePacks.ts) and the two-table event-sourced shape lift cleanly.

### Item 7
- **name**: Append-only points ledger with DB-enforced idempotency
- **path**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts
**why reusable**

Balances and XP are SUMs, never stored columns; a partial unique index on (user, refType, refId) makes a double-submit or replayed request a no-op at the database rather than in application logic; a decline refunds by APPENDING a compensating row. The header states it: 'a bug can misread a sum, but it cannot silently overwrite a career.' Independent of whether the points economy survives, this is the exact ledger shape the patient financial ledger needs - and the market research says no PMS is praised for ledger clarity after dual insurance and partial payments, with reversals and adjustments being where every incumbent's ledger becomes unreadable.

- **quality**: solid
- **coupling**: Low. Drizzle plus one table and one index. The pattern is what matters and it is a page of code.

### Item 8
- **name**: Server-verified training drill
- **path**: /home/user/catcorner22/dental/src/lib/training/ + /home/user/catcorner22/dental/src/app/api/training/complete/route.ts
**why reusable**

Practice cases whose planted defects are the same defects the production engine catches, verified server-side by running that same engine on the submitted repair - so practicing and doing real work are the same skill and a tampered client earns nothing. Plus requiredEvidence tokens so a clean unrelated note cannot farm the bounty, plus throttling, plus DB-enforced once-per-scenario. Market research says compliance platforms sell 'training with certificate management' (Smart Training at $79/user/yr, 15,000+ dental professionals); this is that, with the crucial difference that competence is demonstrated against the real engine rather than a quiz.

- **quality**: solid
- **coupling**: Low-moderate. Needs the audit engine and the points ledger for the bounty. Only three scenarios exist, so content is the real cost, not code.

### Item 9
- **name**: Deterministic zero-network chairside advisor
- **path**: /home/user/catcorner22/dental/src/lib/advisor/
**why reusable**

23 sourced knowledge entries with pure predicates, priority-ordered (safety beats law beats craft), role-scoped by license, running client-side on every typing pause in about a millisecond with no network, no model, no storage. Structurally advise-only: there is no code path from the module to the note. For a PHI product this is the coaching layer that needs no BAA, no gate and no latency budget, and it degrades to nothing when the AI is dark.

- **quality**: solid
- **coupling**: Moderate. Depends on lib/extract, lib/audit/rules/anesthetic-dose, lib/auth/clinicalRoles. The engine (advisor.ts) and the entry shape port cleanly; the 496 lines of knowledge content are dental-documentation-specific and largely still applicable.

### Item 10
- **name**: Risk failure taxonomy with coverage-gap reporting
- **path**: /home/user/catcorner22/dental/src/lib/risk/categories.ts
**why reusable**

Eight categories answering 'what does this defect do to a record months later' as opposed to 'which detector fired', a complete rule-id-to-category map with family prefixes, and coverageByCategory() whose useful output is an EMPTY rules array - a failure mode the tool currently does nothing about, stated as a fact rather than discovered when somebody needs the note. That is structurally the same artifact as precog's COSO control-coverage heat map, one domain over. The whatAReaderNeeds field is also a rare piece of disciplined copy: the only claim in the file safe to paraphrase on a screen, because it is about reading comprehension rather than legal outcomes.

- **quality**: solid
- **coupling**: Zero - it imports nothing. It is also currently dead, so lifting it costs nothing and wiring it up is pure upside.

### Item 11
- **name**: TN license scope charts
- **path**: /home/user/catcorner22/dental/src/lib/law/license-scope.ts
- **why reusable**: Structured may / mayNot / withCertification per license level, every item carrying TCA or Tenn. Comp. R. & Regs. citations, already consumed by lib/scope/authorCapabilities to gate who may author which note sections. In a PMS this becomes the authorization model for who may chart, sign, prescribe and bill - scope of practice as an access-control input rather than a reference page.
- **quality**: solid
- **coupling**: Low as data. The schema (LicenseLevel, ScopeItem, LicenseScope) is state-agnostic; the content is Tennessee-only and would need per-state authoring to sell outside TN.

### Item 12
- **name**: Wish list as staff-observation intake
- **path**: /home/user/catcorner22/dental/src/lib/wishes/wishes.ts + /home/user/catcorner22/dental/src/app/api/wishes/
**why reusable**

Deliberately friction-free intake (two-word minimum, no justification required) with an urgent 'standards' category that sorts above everything regardless of age, open to readonly accounts because 'a locum, a temp, a student, a biller walking past an empty glove box' is exactly who notices first, frozen author attribution, and a mandatory written reason on decline. Plus the rule-disagreement category and ruleDisagreementStats, which turn escalations into the rules engine's own error signal rather than noise to clear. Maps onto both OSHA/HIPAA incident intake and the ACFE finding that ~40% of frauds surface through tips.

- **quality**: solid
- **coupling**: Low. Pure module plus one table. Must NOT be lifted as-is - see PHI observations; the free-text detail field needs a PHI gate and tenant scoping first.

### Item 13
- **name**: Version-stamp CI guards
- **path**: /home/user/catcorner22/dental/.github/workflows/ci.yml
**why reusable**

Three enforced disciplines that a regulated product needs and most teams only aspire to: changing rules/vocab/modules without bumping RULESET_VERSION fails the build (because every stamped audit report would otherwise be a lie about which rules ran); changing assist prompts without touching ASSIST_PROMPT_VERSION fails; changing ddl.ts without bumping SCHEMA_BOOT_VERSION fails, because ensureSchema skips DDL when the stored version matches so new DDL would reach dev and never production.

- **quality**: solid
- **coupling**: None. Thirty lines of shell in a GitHub Actions job; retarget the paths and it works anywhere.

### Item 14
- **name**: Deterministic mascot micro-copy with a stated ethics contract
- **path**: /home/user/catcorner22/dental/src/lib/stats/sparkle.ts
**why reusable**

Fixed human-written lines selected by a caller-supplied seed so the same event always shows the same line and nothing generative is involved, under an explicit contract enforced by tests: transparent encouragement never hidden persuasion, fully ignorable, positive only with no shame and no staff comparisons, truthful about the workflow, zero new tracking, never lecturing. Even if Sparkle the tooth is dropped, the seeded-deterministic-copy technique and the ethics test suite are worth keeping for any empty state, error state or confirmation copy.

- **quality**: solid
- **coupling**: Zero for the mechanism. The 60-odd lines of content are brand-specific and 18 call sites reference the Character component.

## Weaknesses

- DEAD CODE with a build-enforcing test: src/lib/risk/categories.ts (258 LOC) has zero importers outside src/lib/risk/categories.test.ts (170 LOC). The test asserts exhaustiveness, so adding an audit rule without categorizing it fails CI - meaning the team pays a maintenance tax on a module whose output nothing consumes. The coverage-gap report it exists to produce is never rendered.
- MORE DEAD CODE: src/lib/gamify/insights.ts (deriveInsights, deriveLeadCoachingTip, 90 LOC) has no callers. rollingGpa at src/lib/stats/computeStats.ts:105 has no callers. Rank titles and perks in src/lib/gamify/ranks.ts are never displayed - only pointBonus is consumed, by economy.ts. Neither ranks.ts nor insights.ts has a test file.
- THE GPA IS INVISIBLE. deriveGpa runs on every filing, freezes a grade and subscores onto the submission row, and drives the points award - but a grep for 'gpa' across src/components and src/app returns only comments saying the team page deliberately does NOT show GPA bands. A scoring system that pays out but never explains itself to the person being scored is the worst of both worlds: the incentive exists, the feedback does not.
- NO TENANT BOUNDARY. src/lib/practice/config.ts hardcodes PRACTICE_NAME plus three real Knoxville addresses; offices seed once when the table is empty; and src/lib/db/repo/offices.ts:officeIdsForUser explicitly documents that it is NOT a permission check and that every office stays selectable by everyone. There is no organization above office, no row-level scoping, and no test file for either module. For a commercial multi-tenant PHI product this is the single largest structural gap in scope.
- WISHES IS AN UNGATED FREE-TEXT STORE. src/app/api/wishes/route.ts accepts a 4000-character detail field with sanitizeMultiline but NO PHI rule, and GET returns every wish to any signed-in account including readonly. Today the app is de-identified by construction so the blast radius is bounded; in a PHI-holding PMS a supply-request box is where someone types a patient's name, and it is readable practice-wide.
- LAW WATCH DETECTS PRESENCE, NOT CHANGE. src/lib/law/watch.ts scrapes six hardcoded government HTML pages, strips markup with regex, and counts keyword hits. It stores no prior sweep and diffs nothing, so 'the page still mentions 0460' scores the same as 'the rule was amended yesterday'. A site redesign degrades it silently to no-signal, and there is no test file for the module at all.
- PROVIDER COST SCALES BADLY. src/lib/bytestar/service.ts runs up to 3 independent model reads per call (forced to 3 under any high-risk or legal profile via ModeProfile.minReads), auto-triggered on debounced typing pauses, with FREE_RUNS=60 per throttle window per user. At commercial scale that is up to 180 provider calls per user per window on drafts nobody explicitly asked to have reviewed.
- EVERY LARGE COMPONENT IN SCOPE IS UNTESTED. WorkflowBoard.tsx (512), GauntletForm.tsx (499), WishList.tsx (413), ByteStarAdvisor.tsx (391), RiskManagement.tsx (289), StoreFront.tsx (171), TrainingArena.tsx (149) - zero tests among them. ByteAskDeeper.test.tsx (110 LOC) is the only component test in the entire peripheral surface.
- RISK-MANAGEMENT CONTENT SELF-IDENTIFIES AS UNFINISHED. src/components/risk/RiskManagement.tsx renders an amber banner reading 'Provisional content... Treat it as training scaffolding, not policy, until that review lands', and the incident-response topic is explicitly a placeholder. Checklists are localStorage-only, so nothing is auditable, nothing is reportable, and clearing site data erases the record.
- THE GAMIFICATION ECONOMY IS A CONTROL WEAKNESS IN A PMS. Points are awarded automatically on filing volume and grade, and redeemed for real goods (gift cards, paid leave) that a Team Lead approves. In a product whose sibling half exists because 48% of dentists have been embezzled and only 17% of thefts are caught by designed controls, shipping an app-tracked currency redeemable for value - with approval concentrated in a single lead role - is a segregation-of-duties finding precog would itself flag.
- /api/* BYPASSES MIDDLEWARE BY DESIGN, so every route must remember to call requireRole itself. src/app/api/bytestar/route.ts:43-52 documents the consequence: a shipped GET handler with no guard that leaked AI configuration and prompt version to anonymous callers and ran getDb() plus two audit_log queries per hit against a pool defaulting to one connection per isolate. It was found and fixed, but the class of bug remains structurally available on every new route.
- THE DIGEST PAGE IS A MEMORY AND BLAST-RADIUS RISK. src/app/digest/page.tsx loads up to 500 submissions with full note markdown and full audit JSON into one server render, then runs five analyzers over them, with no office or department scoping. The DIGEST_ROW_CAP comment concedes unbounded loads would OOM the isolate; 500 full clinical notes in one request is still a large object to hold in a PHI context.
- EDR ABSTRACTION'S PREMISE INVERTS ON MERGE. src/lib/edr/product.ts exists because Smile Notes writes a de-identified body that a human pastes into an external chart, and it explicitly instructs 'Do NOT invent a PMS sync API here.' When the merged product IS the record there is no paste, no external EDR and no de-identified body - yet edrProductName is threaded through UI copy, the SuperByte source allow-list (public.ts, service.ts), the risk page and the note pages.
- GAUNTLET FRICTION IS AIMED AT THE WRONG AUDIENCE. src/lib/requests/gauntlet.ts is an excellent five-cycle engineering-governance ritual rendered as a 499-line customer-facing form (GauntletForm.tsx) reachable at /requests. Asking a paying practice to clear five sterilization cycles and a five-item preflight checklist before requesting a custom field is the click-heavy, permission-gated experience the market research lists as an incumbent complaint.
- TENNESSEE-ONLY LEGAL CONTENT LIMITS COMMERCIAL REACH. license-scope.ts, tn-law.ts, the law-watch source list, and ByteStar's isTennesseeSource/detectForeignJurisdiction logic are all single-state. The jurisdiction handling is honest (out-of-state drafts get TN observations withheld with a notice) but the product simply has no content for 49 states, and authoring it is a per-state legal-research cost, not an engineering one.
- PERSONA AGENTS ASSIGN IQ BANDS TO STAFF ARCHETYPES. src/lib/training/persona-agents.ts gives each of ten personas an integer 'iq' field (105, 118, 132...) alongside age and generation band. The comment disclaims it as 'only for training diversity; not a clinical claim', but a commercial artifact that models employees by IQ and generation is a liability if it ever surfaces in a UI, a sales deck, or a discovery request.

## Phi security observations

- The entire peripheral surface is built on the assumption that the app holds NO PHI ('de-identified by construction'). That assumption is load-bearing in more places than it looks, and it inverts in the merged product. Today the PHI gate is a second line of defense catching operator error; after the merge it becomes the first line separating a real PHI store from a third-party inference API. Every module in scope needs re-review under the new assumption, not just the AI paths.
- STRONGEST PRIMITIVE: src/lib/learning/redact.ts inverts deny-list scrubbing into an allow-list that fails closed. A token survives only if it is in a controlled clinical lexicon; all numbers are redacted wholesale with no 'obviously clinical' exception. A patient name cannot survive - not because it was recognized, but because it is not in the dental lexicon. This should become the standard redactor for every analytics, telemetry, support-bundle and vendor-escalation path in the merged product.
- AI CALL AUDIT TRAIL IS EXEMPLARY. src/app/api/bytestar/route.ts writes one audit_log row per provider interaction via encodeByteStarDetail carrying outcome, prompt version, model id, token count, kept/refused counts, refusal codes, retrieved source labels, and the router's mode and profile decision - and never any note text. bytestar.refused, bytestar.escape, bytestar.drift, bytestar.eval, bytestar.perma-kill and bytestar.perma-clear are separate actions. This is what an OCR investigator would want to see for AI-touched records.
- PHI GATE RUNS BEFORE THE QUOTA METER (src/app/api/bytestar/route.ts, comment: 'a blocked draft must not burn FREE_RUNS'). Primary runPhiRule plus a secondary scanPhiForProvider that may only ADD blocks, never remove them. Escape detection runs on input before the provider call and on output before a human sees it. The ordering is correct and deliberate.
- SILENT KILLSWITCH DESIGN IS SOUND. src/lib/bytestar/config.ts: BYTESTAR_KILL=1 makes SuperByte unavailable, the model is never told the variable exists, and src/lib/bytestar/escape.ts includes the literal string 'BYTESTAR_KILL' as a killswitch-probe pattern so a model that somehow learned the name cannot confirm it by echo. Tests assert the prompt text is free of kill/env/escape vocabulary. A killswitch a model can reason about is one it can negotiate with.
- ONE-WAY FEEDBACK IS ENFORCED SERVER-SIDE. src/lib/bytestar/one-way.ts lists nine forbidden actions (feedback, rate, thumbs-up/down, train, opt-in, opt-out, chat, prompt) and the API route rejects them with 403 before anything else. Staff cannot prompt, rate, or send any signal that could steer the model. Combined with docs/model-charter.md ruling out training on filed notes, this is a defensible 'we do not train on your patients' claim.
- SCHEDULED-JOB AUTH DONE RIGHT. src/app/api/law-watch/alert/route.ts authenticates with CRON_SECRET via timingSafeEqualStr, which hashes both sides to fixed-width digests first because timingSafeEqual throws on length mismatch and would itself leak the secret's length. Fails closed when the secret is unset. Deliberately runs no AI pass on a timer so a schedule cannot quietly spend tokens.
- WISHES IS THE CLEAREST PHI HOLE IN SCOPE. src/app/api/wishes/route.ts accepts up to 4000 characters of free text with sanitizeMultiline only - no runPhiRule, no maskPhi, no override attestation - and the GET returns every wish with author name to any signed-in account down to readonly. Three fixes are needed before reuse: run the PHI gate on submission, scope reads by office/tenant, and decide whether readonly accounts should read the whole list or only write to it.
- NO ROW-LEVEL TENANCY ANYWHERE. src/lib/db/repo/offices.ts:officeIdsForUser carries an explicit comment that it is 'NOT a permission check, and nothing may use it as one' - every office stays selectable by everyone, justified by short-notice cover arrangements. Office is a label frozen onto a submission for provenance, not an isolation boundary. Combined with the digest loading 500 unscoped notes and wishes being practice-wide readable, minimum-necessary access would be hard to argue today.
- A REAL PRACTICE'S IDENTITY IS COMMITTED TO THE REPO. src/lib/practice/config.ts contains Cornerstone Dental Arts plus three street addresses and phone numbers in Knoxville TN. Not PHI, but it is customer data in version control and it makes the codebase single-tenant by construction.
- THIRD-PARTY INFERENCE DEPENDENCY. ByteStar and law-watch both call out through the Vercel AI SDK to whatever AI_GATEWAY_API_KEY points at. A BAA with the gateway and every downstream model provider becomes mandatory once the product holds PHI, and the market research specifically names 'whether an AI compliance assistant routes patient context through third-party LLM APIs' as a competitive attack surface (Patient Protect, Sept 2026).
- PROVENANCE FROZEN ONTO EVERY FILING. The submit route folds assistEventsForDraft into an assistProvenance object stamped with gpaVersion, so each filed note records which AI capabilities touched it, under which prompt version, with which retrieved sources - or records an empty events array, which the comment notes is 'itself a statement worth freezing'. That is the right shape for defending an AI-assisted clinical record.
- MIDDLEWARE DOES NOT COVER /api/*, BY DESIGN. Documented at src/app/api/bytestar/route.ts:43-52 as the cause of a shipped unguarded GET that leaked config to anonymous callers and amplified DB load against a one-connection-per-isolate pool. Every route in scope now calls requireRole, but the protection is per-route convention rather than a structural default - a standing risk as the route count grows in a PHI product.
- TRAINING HANDLES TEXT CORRECTLY. src/app/api/training/complete/route.ts audits the submitted repair in memory and discards it, persisting only a points-ledger row and an audit-log line. It also throttles per user and enforces once-per-scenario via a DB unique index. Same discipline as the paste-intake path.
- DIGEST DERIVES, NEVER LOGS. Both src/lib/digest/metrics.ts and src/lib/learning/proposals.ts state the principle: everything is computed from filed submissions the practice already stores, so no new privacy surface is created. 'Counting something you already hold is not a new privacy surface; recording keystrokes to grade people would be.' Worth carrying forward as an explicit product rule.
- RISK-PAGE CHECKLIST STATE IS DELIBERATELY CLIENT-ONLY. src/components/risk/RiskManagement.tsx stores ticks in localStorage under smile-notes.risk-checklists.v1 with the reasoning that 'which boxes a person ticked on a training page is not clinical data and does not belong in the database.' Correct today; note that a compliance module which must PROVE remediation to an auditor needs the opposite - server-side, attributed, timestamped attestations.

## Product insights

- ANTI-SURVEILLANCE REPORTING IS ENFORCED IN CODE, NOT POLICY. src/lib/digest/digest.ts sets DIGEST_RULES.SYSTEMIC_SHARE = 0.6: when a finding would flag 60% or more of authors, it is re-scoped from person to practice and the names are dropped, because 'a standard nobody meets is a badly set standard, and reporting it as eleven individual failings would be both false and corrosive.' Paired with MIN_NOTES_PER_AUTHOR = 10 and MIN_AUTHORS_FOR_COMPARISON = 3. This is a sellable differentiator to staff, who are the people who decide whether a PMS gets used properly.
- ALERT FATIGUE IS QUANTIFIED AND DESIGNED AROUND. The digest header cites drug-allergy alerts overridden 87.6% of the time across 611,192 alerts, with REPEATED alerts overridden 12 points harder than first-time ones. The conclusion - batch, never fire per-event to a supervisor - should govern every notification in the merged PMS, especially claim-denial and treatment-plan nags.
- COPY-FORWARD VS TEMPLATE, DISAMBIGUATED. Same text + same teeth = copy-forward; same text + different teeth = the template working; same text + no clinical facts at all = boilerplate carrying nothing patient-specific, which the literature ties to 1.2% of duplicated-text notes carrying misleading information or major risk of harm, fraud or tort exposure. Doubles as a documentation-quality metric and an upcoding control.
- AN ENFORCEMENT SYSTEM NEEDS AN ESCAPE VALVE THAT IS NOT AN OVERRIDE. The 'rule-disagreement' wish category exists because the tool never lets a user force a note past a rule they dislike - but a rule can be wrong, and the person who sees that first is the person it just blocked. The disagreement is named, reasoned and routed to a lead; the rule stays in force until someone with authority settles it; and ruleDisagreementStats surfaces open-vs-settled counts per rule so a rule with many disputes is visibly either mis-tuned or under-explained. Escalations become the engine's own error signal rather than noise to clear.
- SAFETY OBSERVATIONS OUTRANK EVERYTHING, INCLUDING RECENCY. sortWishes puts open 'standards' items above all else regardless of age, so a sterilizer running cold cannot be pushed off the page by feature ideas. And readonly accounts may post, because 'a locum, a temp, a student, a biller walking past an empty glove box' is exactly who notices first - requiring note-authoring rights to report a hazard would silence the right people.
- FRICTION SHOULD BE PROPORTIONAL TO REVERSIBILITY. Stated explicitly in src/lib/wishes/wishes.ts:5-15: the Gauntlet is hard on purpose because a schema change is expensive and permanent, and a wish is the opposite trade - the cost of a bad suggestion is that a manager reads one sentence, while the cost of a suppressed observation is unbounded and lands on a patient. Two intake paths, two deliberately opposite friction levels, in the same product.
- PRESENCE, NOT SCORES, FOR ANYTHING LEGALLY LOADED. ReaderPillars in advisor.ts was renamed from 'defensibility pillars', and the comment explains why: the code can only count which of four things a note MENTIONS, and a name asserting otherwise invites a clinician to read four ticks as a verdict on their record. Presence-only, never a percentage, 'because a percentage invites gaming and a checklist invites completion.'
- A QUALITY SCORE MUST NEVER BECOME A SECOND GATE. src/lib/gpa/deriveGpa.ts states two rules that outrank the math: the GPA is never a gate (eligibility lives in computeGates and fix-or-attest, full stop, because two gates keyed differently will eventually disagree and 'the note that one gate files and the other locks is a support ticket with a lawyer attached'), and it is FROZEN with a gpaVersion so a rule change next month cannot silently regrade last month's work.
- STATE WHAT THE TOOL CANNOT DO, NEXT TO EVERY PASS. byteaudit's LIMITS array is rendered beside any pass verdict: it reads the filed artifact only, cannot judge clinical correctness, cannot confirm an email arrived, is not a clinician's review, and 'a pass means the record is internally consistent and structurally complete. Nothing more.' The rationale - a backstop trusted beyond its evidence is more dangerous than no backstop, because it converts 'nobody checked' into 'something checked and said it was fine' - applies verbatim to claim scrubbing and eligibility verification in a PMS.
- MAKER-CHECKER WITH A WRITTEN REASON ON DECLINE. Practice packs need a second lead to approve and keep a full event log with from/to versions and decision notes. Store redemptions and wish declines both REQUIRE a note back to the named person who asked. The stated reason - a list where things silently die stops being used - generalizes to every approval queue in a PMS, and the two-person rule is exactly the segregation-of-duties control precog detects the absence of.
- REFUND BY APPENDING, NEVER BY MUTATING. The points ledger is append-only with balances as SUMs, and a declined redemption refunds by inserting a compensating row inside the same transaction. Idempotency is a partial unique index, not application logic. This is the answer to the market-research finding that no PMS is praised for ledger clarity after dual insurance and partial payments - reversals and adjustments are where incumbent ledgers become unreadable, and an append-only ledger with derived balances is readable by construction.
- PRACTICE COSTS NOTHING AND IS VERIFIED BY THE REAL ENGINE. Training scenarios plant the exact defects the production audit catches, and completion is graded server-side by that same engine, so practicing and charting for real are the same skill. requiredEvidence tokens prevent farming the bounty with an unrelated clean note. This maps directly onto the 'training with certificate management' that Abyde and Smart Training sell, but demonstrates competence instead of quizzing for it.
- LEARNING BELONGS IN VERSIONED TABLES, NOT MODEL WEIGHTS. src/lib/learning/proposals.ts rejects fine-tuning on four independent grounds - privacy (narrative text is re-identifiable), reproducibility (a March note cannot be re-audited identically in June once weights move), self-consumption (training on a corpus containing the tool's own accepted suggestions narrows the distribution in a way that reads as improvement), and arithmetic (one practice does not produce enough notes to matter). Tables are versioned, diffable, reviewable and revertible; a change is a pull request, not a retrain. This is both a compliance posture and a sales answer.
- EVIDENCE THRESHOLDS DOUBLE AS PRIVACY THRESHOLDS. A learning proposal's load-bearing number is distinct AUTHOR count, not occurrence count: one person's habit is not the practice's vocabulary, and a token one person used once could be anything, including a name. The author threshold is what licenses showing the token at all.
- A DEFECT TAXONOMY SHOULD ANSWER 'WHAT DOES THIS COST A LATER READER', NOT 'WHICH CHECK FIRED'. risk/categories.ts separates the detector taxonomy (phi, spelling, anatomy) from the failure taxonomy (wrong-referent, material-omission, rationale-absent...), and its whatAReaderNeeds field is scoped to claims that are actually verifiable - 'a reader cannot tell which tooth' is checkable, 'this protects you' is not and must never be derived from it. The same discipline should govern every compliance claim the merged product makes.
- MEASURE THE TOOL'S ROI IN THE STAFF'S OWN TERMS. computeStats produces median same-day minutes from draft-open to filed and the count and rate of filings outside 7am-6pm Eastern - 'the after-hours charting the tool exists to reduce', in the practice's day rather than the server's - and both are computed from timestamps already recorded, with nothing new surveilled. These are the two numbers an owner and a burnt-out associate both care about, and they are far better product metrics than a quality score.
- A MASCOT CAN HAVE A TESTED ETHICS CONTRACT. sparkle.ts commits to transparent encouragement rather than hidden persuasion, fully ignorable, positive only with no shame and no staff comparisons, truthful about the workflow, zero new tracking, and never lecturing - with roughly one line in three carrying a team principle so the principle lines feel subtle rather than preachy. Selection is deterministic by seed and never generative. Even if the tooth goes, keep the contract.
- COMPLIANCE CONTENT MUST BE ABLE TO SAY IT IS NOT READY. The risk page ships an amber 'Provisional content... training scaffolding, not policy' banner rather than presenting draft guidance as finished. The stated reason - 'a placeholder that looks finished is how wrong guidance calcifies' - is the right default for any generated policy in the merged compliance module, and it is the honest version of what Abyde's one-click policy generation implies.

## Test and ci posture

"OVERALL: strong for pure libraries, near-absent for UI, and structurally clever in two places.\n\nVOLUME. 201 test files across the repo. Within scope: bytestar leads with 6 files (~890 LOC: bytestar 257, consensus 228, router 237, summary 102, liveStatus 69, instrument 33, ladder 28), then digest (457 across digest.test.ts 256 and filingRollup.test.ts 201), learning (327 across 4 files), byteaudit (283 in one file), stats (221), requests/gauntlet (209), wishes (172), risk (170), advisor (181 across 2), gpa (151), law (181 across license-scope 51 and tn-law 130), training (175 across 2), packs (242 across 3), gamify (91 - economy only), edr (33).\n\nCONFIGURATION. vitest.config.ts defaults to the node environment with per-file jsdom opt-in via a `// @vitest-environment jsdom` first line, chosen over the deprecated environmentMatchGlobs and over a two-project split 'because this way the requirement is stated in the file that has it.' esbuild jsx is set to automatic so .tsx tests run without a React plugin and without mutating the tsconfig the app builds with.\n\nCI (.github/workflows/ci.yml). Runs on push to main and all PRs: npm ci, npx tsc --noEmit, npm test, then npm run build with a dummy AUTH_SECRET. Checkout uses fetch-depth 0 because three PR-only guards diff against the merge base:\n  1. Changes under src/lib/vocab, src/lib/modules, src/lib/audit/rules or maskPhi must bump RULESET_VERSION in src/lib/version.ts, otherwise every stamped audit report is a lie about which rules ran.\n  2. Changes to src/lib/assist/prompts.ts must touch ASSIST_PROMPT_VERSION.\n  3. Changes to src/lib/db/ddl.ts must bump SCHEMA_BOOT_VERSION, because ensureSchema skips all DDL when the stored version matches - so new DDL would reach a fresh dev database and never reach production, surfacing as 'column does not exist' on an untested route.\nThese three guards are the most transferable CI asset in the repo.\n\nTWO STRUCTURALLY UNUSUAL TEST MECHANISMS IN SCOPE.\n  - byteaudit.test.ts (283 LOC) reads every file in src/lib/byteaudit from disk, hashes it, and fails if the result does not match manifest.ts; a second assertion verifies the directory imports NOTHING from the rest of the application except pure type declarations. Independence is checked, not commented.\n  - risk/categories.test.ts (170 LOC) asserts exhaustiveness: adding an audit rule without placing it in a failure category fails the build. Ironically this guards a module with zero production consumers, so the team pays the tax without collecting the benefit.\nAlso notable: training/scenarios.test.ts verifies that each scenario's plantedRules actually fire on its defective text - the practice content self-tests against the production engine.\n\nE2E. 16 hand-rolled .mjs scripts in /e2e (setup.firstboot, mfa.totp, lockout, conflict, submission.immutability, phi.mask-override, hydration.clean, prehydration.login, crossbrowser.smoke, ttfa, dictation, email.assist, export.aioff, headers, account.lifecycle, plus a _noteSeed helper). None are invoked by ci.yml - they are run by hand. No Playwright or Cypress dependency in package.json. Nothing in the e2e set covers any in-scope peripheral feature: no store, training, wishes, workflow, digest or bytestar path is exercised end to end.\n\nGAPS, RANKED BY RISK.\n  1. Every substantial component in scope is untested: WorkflowBoard (512), GauntletForm (499), WishList (413), ByteStarAdvisor (391), RiskManagement (289), StoreFront (171), TrainingArena (149), SuperByte (132), ByteAdvisor (213), Byte (154). ByteAskDeeper.test.tsx (110 LOC) is the lone component test in the entire peripheral surface.\n  2. src/lib/law/watch.ts - the only module in scope that makes outbound network calls to six third-party sites - has no test file at all, despite watch.ts exporting an injectable FetchPage type expressly so tests never touch the network.\n  3. No tests for src/lib/practice/config.ts, src/lib/db/repo/offices.ts, src/lib/gamify/ranks.ts, or src/lib/gamify/insights.ts. Offices is the closest thing to a tenancy model and it is unverified.\n  4. No API route tests anywhere in scope. Every route's authorization, throttling and PHI-gating is covered only by reading the code - including /api/wishes, which is the free-text ingestion point.\n  5. Repo-layer coverage is thin: only practicePacks.test.ts exists under src/lib/db/repo/, so the points ledger's idempotency index and the store's single-transaction balance-check-and-spend are asserted by comment rather than by test.\n  6. No coverage thresholds, no lint step in CI (no eslint config or script in package.json), and no dependency or secret scanning."

## Open questions

- Does the points economy and clinic store survive at all? A staff currency redeemable for gift cards and paid leave, awarded automatically on filing volume and grade, with approval concentrated in one lead role, is a segregation-of-duties finding that the precog half of the product is built to detect. Either drop it, or rebuild it under precog's own control model (dual approval, threshold limits, periodic reconciliation) and treat that as a dogfooding showcase.
- Is the GPA meant to be visible? It is computed, frozen with a version stamp, and paid out on - but rendered nowhere. Decide: surface it to the author only (never to leads, per the digest's rules), keep it as an internal ledger input, or remove the axis weighting entirely and pay on first-pass rate.
- Who owns the risk register after the merge - dental's RISK_CATEGORIES (8 clinical-documentation failure modes with rule coverage-gap reporting) or precog's COSO components? They are structurally the same artifact in two domains. Recommendation: one register, two domains, one coverage heat map - but this needs an explicit decision before either team builds on the other.
- Does the ByteStar cage generalize to a product where the PHI gate is the FIRST line rather than the second? Today the whole app is de-identified by construction, so a PHI-gate miss is a defense-in-depth failure. After the merge, a miss is a disclosure. Does the gate's precision/recall justify sending any chart-adjacent text to a third-party gateway, and does the answer change if inference moves in-VPC?
- What is the tenancy model? Is 'office' the tenant, is there an organization above it, or is deployment single-tenant per practice? src/lib/db/repo/offices.ts explicitly disclaims being a permission boundary, so today the answer is 'none of the above'. This blocks any multi-practice or DSO story, and the research shows DSO packaging is where the market is moving (16.1% of dentists DSO-affiliated in 2024, 26.5% among those under 10 years out).
- Does the wish list become the compliance-incident intake? The safety-observation channel, the ACFE finding that ~40% of frauds surface through tips, and OSHA/HIPAA incident reporting all want the same low-friction, low-retaliation intake. If yes, it needs a PHI gate, tenant scoping, a retention policy, and probably an anonymous option - which directly contradicts the current owner-mandated non-anonymous design.
- Is law-watch a product feature or an internal ops tool? As shipped it is TN-only, scrapes six hardcoded URLs, detects keyword presence rather than change, and has no test. Abyde sells 'policies kept current with federal and state rules' - matching that is a content and legal-research commitment across 50 states, not an engineering one. Decide before promising it.
- What does BYTESTAR_READS=3 cost at commercial scale? Up to three provider calls per debounced typing pause, forced to three under any high-risk or legal profile, with a 60-run-per-window budget per user. Model whether self-consistency survives contact with per-seat pricing, or whether a single read plus stricter deterministic verification is the right trade.
- Should the Data Hygiene Gauntlet stay user-facing? The five cycles are genuinely well-written and dental-specific, but making a paying practice clear five sterilization cycles to request a custom field is the click-heavy gatekeeping the market research lists as an incumbent complaint. Options: keep it as internal engineering process, keep it as an optional 'make the case' path with a fast lane beside it, or drop the UI and keep the prose as sales/onboarding content.
- What replaces the EDR paste-target seam? edrProductName threads through UI copy, the risk page, the note pages, and ByteStar's source allow-list - all premised on an external chart that no longer exists after the merge. Does it become a migration/interop label (Dentrix, Open Dental, Eaglesoft) for the conversion story, or is it deleted outright?
- Should the Sparkle mascot survive into a commercial PMS? Eighteen call sites, a tested ethics contract, and genuine warmth - against the risk that a system handling claims, ledgers and controlled-substance records reads as a toy to the practice owner signing the check. Consider keeping the deterministic-copy mechanism and the ethics tests while retiring the character.
- Do compliance checklists move server-side? RiskManagement.tsx deliberately keeps ticks in localStorage because 'which boxes a person ticked on a training page is not clinical data.' A compliance module that must PROVE remediation to an auditor needs the opposite: attributed, timestamped, server-stored attestations. These are different products and the boundary between them needs drawing.
- Should byteaudit's seal-and-restate pattern be extended to money? It currently guards note publication. The market research says reporting that does not reconcile to the bank is the central complaint and that only 17% of dental embezzlement is caught by designed controls. An independently sealed verifier over claim submission and ledger posting would be a genuinely novel control - but the seal only works if the duplication discipline holds, and that is an organizational commitment, not a code change.
- What happens to the persona-agent corpus? Ten archetypes with IQ bands and generation labels are useful test fixtures and a liability if they ever surface in a UI or a sales deck. Keep as internal fixtures with the IQ field removed, or retire entirely?
- Are the 23 advisor knowledge entries and the TN license-scope charts reviewed by counsel? Both carry citations and the risk page explicitly says its guidance awaits review 'by the practice owner and, where it touches law, counsel'. Commercial distribution changes the exposure profile from one practice's internal training material to published guidance sold to strangers.
