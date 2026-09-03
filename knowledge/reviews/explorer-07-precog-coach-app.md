# Explorer report 7: precog-coach-app

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 7 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, precog-coach-app

## Summary

Precog Pioneer is a ~23,300-LOC single-page TanStack Start / Vite / React 19 app that scores a small dental practice's internal-control posture and coaches the owner on what to fix. Its real substance is a domain layer of about 7,000 LOC under /home/user/catco…

## Scope

precog-coach-app

## Summary

Precog Pioneer is a ~23,300-LOC single-page TanStack Start / Vite / React 19 app that scores a small dental practice's internal-control posture and coaches the owner on what to fix. Its real substance is a domain layer of about 7,000 LOC under /home/user/catcorner22/precog/src/lib/precog/ — a segregation-of-duties conflict engine over a dental-specific entitlement ontology, a dual-release (two-person approval) policy engine with a full exception system, a versioned residual-risk scoring engine with named drivers and tornado sensitivity, a scenario/insurance cost-of-risk model, a "variable cascade" simulator that recomputes every coupled metric when one lever moves, and a 19-panel UI on top of it. The LLM layer wraps all of that in a tool catalog (17 deterministic tools), a TF-IDF RAG over 16 curated COSO/SoD/Lean/fraud chunks, and a set of reasoning modules (Bayesian, beam search, causal graph, counterfactual, EVOI, meta-analysis, Johari).

The critical finding is that the repository does not build or run. /home/user/catcorner22/precog/src/routes/index.tsx is a 32-byte plain-text file containing the literal string `SEE_FILE_/tmp/index_restored.tsx`; the referenced /tmp file does not exist, node_modules is absent, and this broken state is the committed HEAD. The repo has exactly one commit (203ed30, "Restore index.tsx with Command UI + Threat Assessment link to /threat") whose message describes a restore that did not actually happen. That missing file was the application shell: it owned the tab router and the `onNavigate(tab, id)` deep-link contract, and it mounted 17 of the 19 panels. Only /threat and /login render today. `npm run typecheck` would fail on the first file it reads.

Nothing is persisted server-side. There is no application database schema at all — migrations/ contains a single file, 0001_auth.sql, which is only the Better Auth identity tables. `getSql()` is never called from any application code; the only consumer of the database is Better Auth itself via a Kysely-over-PGLite dialect. All app state lives in one React context (practice-context.tsx) holding a `PracticeProfile` in `useState`, hydrated from and written back to `localStorage["precog.practiceProfile.v2"]`. Zustand is declared in package.json and imported nowhere. Everything else the panels display is derived from demo-data.ts, a 772-line hardcoded fixture for one fictional practice ("Ridgeview Family Dental"). Two staff members at the same practice would see completely different data, and clearing site data destroys the decision journal — the one artifact a compliance product must retain.

Authentication is a well-engineered template that protects nothing. `authMiddleware` is defined, documented, and referenced by zero call sites. The only two server functions — `runPioneerCoach` and `getLlmToolCatalog` — have no middleware, so `runPioneerCoach` is an unauthenticated POST that spends the owner's XAI_API_KEY (grok-4.5, max_tokens 2200) on any caller's prompt with no rate limiting. No route in the app calls `useCurrentUserState`, `SignedIn`, or `RedirectToSignIn`; /login even offers "Continue as guest demo." Platform lock-in to the Grok Build sandbox is broad but shallow: it touches only agent-loop.ts (one hardcoded fetch to api.x.ai), __root.tsx (branding banner and og.grok.me card), src/lib/auth/** (federation to auth.grok.me), vite.config.ts, startup.sh, and scripts/. The entire src/lib/precog/** domain layer has zero Grok imports and lifts cleanly.

## Architecture

Data flow is entirely client-side and synchronous. `PracticeProvider` (src/lib/precog/practice-context.tsx) mounts in __root.tsx and holds a single `PracticeProfile` object — practiceName, StaffComposition, RiskVariableState, DualReleasePolicy, DecisionEntry[] — in useState. It hydrates from localStorage in a mount effect and writes back on every change. Panels call `usePractice()` and recompute derived state in `useMemo` on the render path; there are no queries, no loaders, no server round-trips, and therefore no loading states anywhere except the coach.

Key abstractions, bottom up: (1) demo-data.ts exports the fixture graph — people, knowledge, relations, processes, controls, scenarios, staffComposition, crimeFraudStats. (2) Pure engines import that fixture DIRECTLY (sod/detect.ts imports `people`; residual-engine.ts imports `controls` and `knowledge`; leading-indicators.ts imports `controls`), so the domain logic is hard-wired to the fixture rather than parameterized by a repository. (3) scoring/variable-cascade.ts is the computational hub: `simulateCascadeLever(leverId, vars, staff)` applies a lever and returns before/after snapshots of residual, premium, retained, cost-of-risk, p50 timeline and likelihood, plus deltas and second-order notes; beam-search, counterfactual, and forecast all call it. (4) llm/tools.ts wraps 17 of these engines in a uniform `ToolResult { tool, ok, summary, data, links }` shape with a `TOOL_CATALOG` description table.

The "agent loop" is not an agentic loop. `runLocalAgentLoop` executes a fixed sequence: `planTools(question)` → map `executeTool` over the plan → `extractEvidence` → `extractVariableCascades` → `runSpecialistAgents` → `chickenLittleCritique` → `localSynthesize`. It emits a `steps[]` array with phases named plan/retrieve/analyze/reason/meta/specialize/critique/synthesize, but that array is narration appended after the fact, not control flow. `runGrokAgentLoop` runs the entire local loop first, then makes ONE non-streaming POST to https://api.x.ai/v1/chat/completions and merges the result as `brief: { ...local.brief, markdown: text }` — the model replaces only the prose. Every structured field (evidence anchors, decisions, warnings, specialist notes, tool list, fingerprint) comes from the deterministic local path, and every failure mode (no API key, non-2xx, empty content, thrown exception) silently returns the local brief. That is a genuinely good grounding and graceful-degradation property, badly undersold by the "multi-agent" framing.

Enforcement is entirely client-side; there is no server-side authorization at any point. src/lib/auth/ implements a complete Better Auth setup — federation to the Grok broker via genericOAuth, `__Host-`-prefixed cookies, a bearer-token path for the partitioned preview iframe, a Kysely-over-PGLite dialect so preview sessions share the app database, and a Fetch-Metadata cross-site guard (`assertSameSiteRequest`) intended to sit at the `authMiddleware` chokepoint. None of it is wired to anything: `authMiddleware` has zero call sites, so `assertSameSiteRequest` and `requireUserId` never execute. src/lib/db.ts is a careful dual-backend SQL wrapper (Neon via `pg` when DATABASE_URL is set, else in-process PGLite) with HMR-safe global memoization, type-parser parity between backends, and transactional migration application — and no application code ever calls it.

Routing is four file routes (routeTree.gen.ts): `/` (the broken placeholder), `/login`, `/threat`, and the `/api/auth/$` splat that hands GET/POST to `auth.handler`. Because index.tsx is gone, the tab-based navigation and the `onNavigate(tab, id)` deep-link contract that panels accept as props (targets: command, map, coso, residual, sod, precog, knowledge, intel, layers, journal) exist only as orphaned prop signatures. vite.config.ts adds two sandbox-only plugins — a PGLite bootstrap that awaits `ensureDbReady` in `configureServer`, and a middleware that serves `/auth/popup` before TanStack Start so the OAuth popup can never be shadowed by a React route — plus `nitro({ preset: "vercel" })` gated to `command === "build"`, and a hardcoded 0.0.0.0:8080 strictPort binding.

## Key files


### Item 1
- **path**: /home/user/catcorner22/precog/src/routes/index.tsx
- **purpose**: BROKEN. A 32-byte plain-text file containing the literal string 'SEE_FILE_/tmp/index_restored.tsx' (no trailing newline). The referenced file does not exist. This was the application shell: tab router, onNavigate(tab, id) deep-link dispatcher, and mount point for 17 of the 19 panels. Its absence means the app cannot build, typecheck, or run.
- **loc estimate**: 1

### Item 2
- **path**: /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts
**purpose**

Two-person approval policy engine. 6 channels (ach/check/writeoff/vendor_new/deposit/payroll), per-channel thresholds and approver roles, and a specificity-ordered exception system (raise/lower/force/waive, scoped by payee/person/role/channel/amount-band, date-bounded, with residual notes). evaluateRelease() is ~300 lines of real decision logic. Best single asset in the repo alongside the SoD engine.

- **loc estimate**: 855

### Item 3
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/meta-analysis.ts
**purpose**

Epistemic 'what we cannot see' engine. Mostly a hardcoded expert catalog of known-unknowns and 'unknown unknowns' with light state-conditioned severity and magic-constant readiness/confidence formulas. Low as computation, high as product content: its gap list (PMS void/adjustment audit log, vendor master change log, carrier loss runs, refund authorization trail, collusion rings, owner impairment) is effectively the PMS integration backlog.

- **loc estimate**: 845

### Item 4
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/agent-loop.ts
- **purpose**: Deterministic plan-execute-synthesize pipeline plus a single non-streaming Grok call that replaces only brief.markdown. Contains extractEvidence (per-tool evidence-anchor mapping), extractVariableCascades, chickenLittleCritique, and localSynthesize (the full markdown brief builder). Hardcodes https://api.x.ai/v1/chat/completions and model grok-4.5.
- **loc estimate**: 812

### Item 5
- **path**: /home/user/catcorner22/precog/src/lib/precog/demo-data.ts
- **purpose**: The entire dataset: one fictional practice (Ridgeview Family Dental) with people, knowledge items, knowledge relations, process nodes, controls, staffComposition, crimeFraudStats, and scenarios. Imported directly by the engines rather than injected, which is the main coupling obstacle to reuse.
- **loc estimate**: 772

### Item 6
- **path**: /home/user/catcorner22/precog/src/components/precog/process-map.tsx
- **purpose**: Largest component. React Flow value-stream canvas with custom nodes, MiniMap/Controls/Background, 8 toggleable layers, three vision modes (standard / Predator thermal / Terminator threat scan), priority-target ranking and a detail drawer.
- **loc estimate**: 1201

### Item 7
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/dynamic-variables.ts
- **purpose**: Insurance and control variable model: VARIABLE_CATALOG, DEFAULT_RISK_VARIABLES, evaluateDynamicRisk (likelihood/severity/detection-lag multipliers, premium discount stacking, deductible/limit split into retained vs transferred, expected annual cost of risk), scenarioFlags.
- **loc estimate**: 667

### Item 8
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/variable-cascade.ts
- **purpose**: The computational hub. CASCADE_LEVERS plus simulateCascadeLever/simulateAllCascades: apply one lever, recompute every coupled metric, return before/after, signed deltas, improves/worsens lists, second-order notes and a dependency map. Beam search, counterfactuals and the forecast all call it.
- **loc estimate**: 616

### Item 9
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/tools.ts
- **purpose**: TOOL_CATALOG of 17 deterministic grounding tools plus executeTool() dispatch returning a uniform ToolResult, and planTools() — which is near-decorative: 14 of 17 tools are added unconditionally and most regex branches re-add tools already present.
- **loc estimate**: 571

### Item 10
- **path**: /home/user/catcorner22/precog/src/lib/multiplayer/p2p.ts
- **purpose**: DEAD CODE. Full-mesh WebRTC with perfect-negotiation glare handling, ICE watchdogs, RTT pings. Zero imports outside src/lib/multiplayer/. Signals to /api/rtc, a route that does not exist in this app. Pure Grok Build template leftover — delete on merge.
- **loc estimate**: 570

### Item 11
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/residual-engine.ts
- **purpose**: Residual scoring: inherent x (1 - control effectiveness) x staff modifiers, using versioned weights from scoring/weights.ts, producing named RiskDriver explanations, action bands and linked scenario/knowledge/control ids. Also portfolioSummary and a real one-at-a-time tornado sensitivity.
- **loc estimate**: 457

### Item 12
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/johari-applications.ts
- **purpose**: JOHARI_PLAYBOOK — a static content constant (quadrant guides, 8 domains, moves, anti-patterns, metrics). Zero computation. An educational content library, not a reasoning module.
- **loc estimate**: 448

### Item 13
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/detect.ts
- **purpose**: Segregation-of-duties conflict engine: expand person to entitlements, test all unordered pairs against CONFLICT_RULES, fall back to a family-level conflict matrix, score severity with risk weights / residual acceptance / dual-release mitigation, and emit the N x N matrix the UI renders.
- **loc estimate**: 437

### Item 14
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts
**purpose**

The dental SoD ontology. 14 entitlements written in PMS nouns (collect_cash, post_payments, prepare_deposit, bank_reconcile, approve_writeoffs, post_adjustments, submit_claims, create_vendor, approve_vendor, release_payment, approve_payroll, enter_payroll, pms_admin_roles, view_reports_only), duty families, conflict rules with fraud-path narratives and compensating defaults, and FAMILY_CONFLICT_MATRIX.

- **loc estimate**: 331

### Item 15
- **path**: /home/user/catcorner22/precog/src/lib/precog/engine.ts
- **purpose**: Scenario engine: findKnowledgeRisks (SPOF detection over the person-knowledge graph), runPrecogScenario (p50 / 95% CI timelines, gross vs retained financial impact), rankDangerousScenarios, staff and fraud multipliers.
- **loc estimate**: 272

### Item 16
- **path**: /home/user/catcorner22/precog/src/lib/auth/server.ts
- **purpose**: Better Auth config: tri-mode (deployed / sandbox preview / disabled), genericOAuth federation to the Grok broker at auth.grok.me, bearer plugin for partitioned iframes, __Host- cookie naming, encrypted OAuth tokens, dynamic baseURL with a host allowlist. Well written and completely unused by app code.
- **loc estimate**: 253

### Item 17
- **path**: /home/user/catcorner22/precog/src/lib/db.ts
- **purpose**: Dual-backend SQL client (Neon via pg when DATABASE_URL is set, else in-process PGLite) with HMR-safe globalThis memoization, cross-backend type-parser parity, and transactional migration application. Never called by application code — only Better Auth uses the PGLite handle.
- **loc estimate**: 238

### Item 18
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-context.tsx
- **purpose**: The single source of application state. One PracticeProfile in useState, hydrated from and saved to localStorage. Bidirectionally couples staff.dualControlPayments, riskVariables.hasDualControl and dualRelease.enabled on every setter — convenient but easy to desync.
- **loc estimate**: 213

### Item 19
- **path**: /home/user/catcorner22/precog/src/lib/precog/reasoning/../llm/reasoning/engine.ts
- **purpose**: runAdvancedReasoning orchestrator — composes Bayesian, causal, beam, counterfactual and EVOI into one report with a synthesis narrative and a confidence score built from CI width, improving-counterfactual count and beam utility.
- **loc estimate**: 185

### Item 20
- **path**: /home/user/catcorner22/precog/src/lib/precog/rag/retrieve.ts
- **purpose**: Honest TF-IDF retrieval: tokenize, stopword filter, IDF precomputed at module load over the corpus, cosine similarity, exact-tag boost, 0.02 score floor. No embedding API, works in SSR.
- **loc estimate**: 154

### Item 21
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/multi-agent.ts
- **purpose**: Four 'specialist agents' (Operator, Shield, Precog, Critic) that are four hardcoded notes.push blocks reading the same ToolResult array. No separate prompts, models, or arbitration. Presentation only.
- **loc estimate**: 155

### Item 22
- **path**: /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts
- **purpose**: 16 curated educational chunks across coso / sod / lean / dental_ops / fraud / insurance / continuity / ai_governance, each with title, tags, text and a source attribution. Small but well written and directly reusable.
- **loc estimate**: 152

### Item 23
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/reasoning/beam-search.ts
- **purpose**: Real beam search over lever sequences (width 4, depth 3) with a normalized utility (1.1 x residual improvement + 1.0 x CoR improvement - 0.45 x effort) and a diversity rule on the last lever. Bug: the empty status-quo node is dropped after depth 0, so it can never recommend doing nothing.
- **loc estimate**: 149

### Item 24
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/features.ts
- **purpose**: Feature vectorization plus HEALTHY_PRIOR — a hand-authored table of 22 (mean, std) pairs used to z-score a practice. This is the whole of the 'ML': no training data, no covariance, no fitting.
- **loc estimate**: 93

### Item 25
- **path**: /home/user/catcorner22/precog/src/lib/precog/coach/pioneer-server.ts
- **purpose**: The only two server functions in the app. runPioneerCoach validates input, merges risk variables and staff, and calls the local or Grok agent loop; getLlmToolCatalog returns TOOL_CATALOG. Neither uses authMiddleware, so both are unauthenticated.
- **loc estimate**: 129

### Item 26
- **path**: /home/user/catcorner22/precog/src/lib/auth/preview.ts
- **purpose**: Contains a committed shared OAuth client secret (PREVIEW_CLIENT_SECRET, a 64-hex-char literal) and PREVIEW_CLIENT_ID = 'grok_preview', plus the auth.grok.me issuer default and the *.grok-sandbox.com host allowlist.
- **loc estimate**: 32

### Item 27
- **path**: /home/user/catcorner22/precog/migrations/0001_auth.sql
- **purpose**: The ONLY migration. Better Auth identity schema (user, session, account, verification) and three indexes. There is no application schema whatsoever — no practice, no org, no tenant, no decision, no assessment table.
- **loc estimate**: 67

### Item 28
- **path**: /home/user/catcorner22/precog/AGENTS.md
- **purpose**: The Grok Build sandbox agent template, not project documentation. Describes /workspace, the live-preview proxy, .grok/skills/, game-asset generators, GROK_ALLOW_INSTALL_SCRIPTS, and mandates keeping the 'Created with Grok' banner mounted. Delete on merge.
- **loc estimate**: 583

## Reusable assets


### Item 1
- **name**: SoD conflict engine + dental entitlement ontology
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts and /home/user/catcorner22/precog/src/lib/precog/sod/detect.ts
**why reusable**

The single most valuable thing in either repo for the merged PMS. Fourteen entitlements are already named in PMS vocabulary (post_payments, approve_writeoffs, submit_claims, create_vendor, release_payment, prepare_deposit, bank_reconcile, pms_admin_roles), so the rulebook can be bound directly to the new product's real permission model. That converts the market's questionnaire-based approach into detection from actual role assignments — precisely the gap the research says no product fills. Each rule ships a plain-language 'why' and a fraud-path narrative, which is the explanatory content a dentist actually needs.

- **quality**: production-grade
- **coupling**: detect.ts imports `people` from demo-data.ts directly; conflict-rules.ts is pure data with zero imports. Lifting requires replacing one fixture import with a roster parameter — roughly an hour of work. No React, no platform, no network.

### Item 2
- **name**: Dual-release approval policy engine
- **path**: /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts
**why reusable**

A complete two-person-control engine whose six channels (ach, check, writeoff, vendor_new, deposit, payroll) map onto real PMS transaction types. evaluateRelease() resolves the effective threshold through a specificity-ordered exception chain, enforces distinct approvers, checks role eligibility, and returns an auditable explanation of which exception applied and why. Wiring this in front of real write-off and refund posting turns it from advice into an enforced control — the 'recorded vs enforced' axis the research names as the competitive dividing line.

- **quality**: production-grade
- **coupling**: Imports `people` from demo-data.ts for approver lookup and StaffComposition from ../types. Otherwise self-contained pure TypeScript. Needs a persistence layer and an immutable approval log, neither of which exists today.

### Item 3
- **name**: Residual scoring engine with explainable drivers and tornado sensitivity
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/residual-engine.ts and /home/user/catcorner22/precog/src/lib/precog/scoring/weights.ts
**why reusable**

Every score carries a versioned SCORING_VERSION and an array of named RiskDriver objects with direction, weight and a human explanation, so the UI can always answer 'why is this 68?'. tornadoSensitivity gives a ranked list of which single change moves the portfolio most. That combination — a number, its reasons, and the cheapest lever — is a strong executive dashboard primitive and directly answers the market complaint about tools with no ROI story.

- **quality**: solid
- **coupling**: Imports controls, knowledge, scenarios and staffComposition from demo-data.ts, and calls into engine.ts. Moderate refactor to accept an injected practice model.

### Item 4
- **name**: Variable cascade simulator
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/variable-cascade.ts
**why reusable**

Answers 'if I change one thing, what else moves?' with real recomputation across residual, premium, retained loss, cost of risk, p50 detection timeline and likelihood, returning signed deltas plus improves/worsens lists and second-order notes. Genuinely novel UX for this market and translates directly into a PMS settings-change preview ('turning on dual approval for write-offs will also do X, Y, Z').

- **quality**: solid
- **coupling**: Depends on dynamic-variables.ts, residual-engine.ts and engine.ts, which in turn depend on demo-data.ts. It is the hub of the domain layer, so it comes along with most of src/lib/precog/scoring/.

### Item 5
- **name**: Decision journal model
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-profile.ts and /home/user/catcorner22/precog/src/components/precog/decision-journal.tsx
**why reusable**

DecisionKind of remediate / accept_residual / monitor / insure, with a subject, note, review-by date and residual-at-decision snapshot, plus overdue highlighting in the UI. This is exactly the 'tailored controls to remediation tracking' loop that Abyde and Patient Protect sell, and it is the artifact that makes a compliance claim defensible. Small, clean, and the most directly PMS-relevant piece of the compliance story.

- **quality**: prototype
- **coupling**: Trivially portable as a data model. But it currently persists only to localStorage, which makes it user-editable and therefore worthless as evidence; it must become server-side and append-only before it means anything.

### Item 6
- **name**: TF-IDF RAG retriever plus curated control-guidance corpus
- **path**: /home/user/catcorner22/precog/src/lib/precog/rag/retrieve.ts and /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts
**why reusable**

Honest, dependency-free retrieval that works in SSR with no embedding API, no vector store and no per-query cost. The 16 chunks (COSO components, control activities, monitoring, three-way SoD, dental cash handling, fraud triangle, detection lag, Lean muda/mura/muri, continuity SPOF, risk transfer, shadow AI, risk appetite, write-offs, vendor master, leading indicators) are well written and source-attributed. For a corpus of this size, TF-IDF is the correct engineering choice, not a shortcut.

- **quality**: solid
- **coupling**: Zero dependencies beyond its own corpus. Copy two files and it works. Scales poorly past a few hundred chunks (IDF and doc vectors are computed eagerly at module load) but that is far beyond current needs.

### Item 7
- **name**: Beam search over control-lever sequences
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/reasoning/beam-search.ts
- **why reusable**: A real search — width 4, depth 3, threading full state through each cascade simulation, with an explicit normalized utility trading residual reduction and cost-of-risk reduction against effort, plus a diversity rule. It produces a defensible ordered remediation roadmap ('do these three things in this order') rather than an unordered list, which is what an owner actually needs.
- **quality**: solid
- **coupling**: Depends entirely on variable-cascade.ts. Carries a real bug: the empty status-quo node is dropped after the first depth iteration, so it always returns a full-depth sequence and can never recommend doing nothing, even when every lever has negative utility.

### Item 8
- **name**: Auth security patterns (as patterns, not as code)
- **path**: /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts, /home/user/catcorner22/precog/src/lib/auth/verify.server.ts, /home/user/catcorner22/precog/src/lib/auth/server.ts
**why reusable**

Several ideas are worth carrying into a PHI product even though the implementation must be replaced: Fetch-Metadata based rejection of scripted cross-site requests while still permitting top-level GET navigations for OAuth callbacks; __Host- prefixed cookies so a sibling origin cannot inject a session; and a fail-closed requireUserId that refuses to fall back to a shared dev user whenever a real database is configured. That last instinct — refuse to degrade silently when real data is present — is exactly right for PHI.

- **quality**: solid
- **coupling**: Tightly bound to Better Auth, TanStack Start server internals, and the Grok broker at auth.grok.me. Not liftable as code for a PHI product; lift the reasoning and reimplement against an IdP that will sign a BAA.

### Item 9
- **name**: Dark design-token system and panel composition vocabulary
- **path**: /home/user/catcorner22/precog/src/styles.css and /home/user/catcorner22/precog/src/components/ui/
**why reusable**

A coherent Tailwind v4 @theme token set (bg/surface/elevated/panel/fg/muted/subtle/border/border-strong/primary/accent/danger/warn/ok, four radii, sans and mono stacks) with only three tiny primitives — button, badge, card — on top. The panels compose a consistent hero-section / stat-tile-row / card-grid / view-switcher pattern from those three plus styled native elements. Very few dependencies to carry over.

- **quality**: solid
- **coupling**: Almost none — copy styles.css and three ~30-line components. Caveats: dark-only (color-scheme: dark, no light theme), and because ~24 Radix packages are declared but unused, there is no accessible select, dialog or combobox anywhere to inherit.

### Item 10
- **name**: Meta-analysis gap catalog (as product roadmap, not as code)
- **path**: /home/user/catcorner22/precog/src/lib/precog/llm/meta-analysis.ts
**why reusable**

Strip the scoring arithmetic and what remains is a well-researched enumeration of exactly which data feeds would make control assessment real: PMS void and adjustment audit log with the posting user, vendor master change log, carrier loss runs, actual cash count history, patient refund authorization trail, bonding and background-check currency, plus structural blind spots (two-party collusion that passes dual release by design, owner incapacity when the owner is the second signer, ransomware and ePHI extortion cascades, HIPAA/OCR enforcement linked to access entitlements). A PMS already owns most of those feeds, which is the strategic argument for the merge.

- **quality**: demo-only
- **coupling**: The code is near-unusable (hardcoded item lists, magic-constant scoring, coverage slice counts that are typed literals rather than derived from the item array, and a quickReadiness() that runs the full analysis and discards 95% of it). The content is the asset; extract it as a backlog document.

## Weaknesses

- The application does not build or run. src/routes/index.tsx is a 32-byte plain-text placeholder containing the literal string 'SEE_FILE_/tmp/index_restored.tsx'; the referenced /tmp file does not exist, node_modules is absent, and this is the committed HEAD state (git status clean, one commit). npm run typecheck fails on the first file. Only /threat and /login render.
- The lost index.tsx was the application shell — it owned the tab router and the onNavigate(tab, id) deep-link contract and mounted 17 of the 19 panels. Panels still accept onNavigate/onOpenLinked props and emit link targets ('command', 'map', 'coso', 'residual', 'sod', 'precog', 'knowledge', 'intel', 'layers', 'journal'), but nothing consumes them. The integration contract between the panels must be reverse-engineered from prop signatures.
- Zero server-side persistence. migrations/ contains only the Better Auth identity schema; there is no practice, org, tenant, assessment, or decision table. getSql() has no application call sites. All state is one localStorage key, so it is per-device and per-browser: two staff at one practice see different data, and clearing site data destroys the decision journal — the exact artifact a compliance product must retain and the only thing resembling an audit trail.
- Auth protects nothing. authMiddleware has zero call sites, so assertSameSiteRequest() and requireUserId() never execute. No route calls useCurrentUserState, SignedIn, or RedirectToSignIn; /login offers 'Continue as guest demo'. Every panel is reachable anonymously.
- runPioneerCoach is an unauthenticated POST server function that calls api.x.ai with the owner's XAI_API_KEY (grok-4.5, max_tokens 2200) on any caller's prompt, with no auth, no rate limit and no quota. A cost-abuse vector today; a data-exfiltration vector the moment real practice data flows through the tool layer.
- A live OAuth client secret is committed to the repository: PREVIEW_CLIENT_SECRET in src/lib/auth/preview.ts is a 64-hex-char literal, alongside PREVIEW_CLIENT_ID = 'grok_preview'. It is present in git history and cannot be removed by deletion alone.
- No multi-tenancy anywhere. No practice_id, org_id or tenant concept in any type, table or function. The entire domain layer assumes exactly one practice and imports its data from a module-level constant.
- Domain engines import the fixture directly rather than receiving it: sod/detect.ts imports `people`, residual-engine.ts imports `controls` and `knowledge`, leading-indicators.ts imports `controls`, coach/context-pack.ts imports PRACTICE_NAME and staffComposition. Roughly ten modules must be threaded with a repository or parameter before any of this works against real data.
- Zero automated tests. No test runner in devDependencies (no vitest, jest, or testing-library), no test script, no test files. No CI configuration and no .github directory. Nothing verifies the ~7,000 LOC of scoring math.
- planTools() is presented as tool planning but is effectively 'run everything': 14 of 17 tools are added unconditionally and most of the regex branches re-add tools already in the base set. Only three tools are ever conditionally added.
- The 'multi-agent' layer is four hardcoded notes.push blocks in one function reading the same ToolResult array — no separate prompts, models, or arbitration. The 'agent loop' has no tool-calling, no iteration, and no model-selected tools; steps[] is narration appended after a fixed pipeline. The grounding property is genuinely good, but the framing overstates the machinery by a wide margin.
- runCounterfactuals has a structural flaw: worldFrom() computes residual as portfolioSummary(staff), ignoring the variables argument entirely. Any purely-insurance lever (raise_deductible_10k, lower_deductible_1k) therefore yields a residual delta of exactly zero by construction, and the counterfactual ranking collapses to two channels rather than the five it reports.
- beamSearchLevers drops the empty status-quo node after the first depth iteration, so it always returns a three-lever sequence and can never recommend doing nothing — even when every candidate has negative utility. That recommendation is then surfaced as the coach's primary action.
- causal-graph.ts computes netToDecision as a plain sum of the top-five path scores, which double-counts shared sub-paths and is not a causal effect estimate. The 23 edge weights are hand-authored and never calibrated.
- The 'ML' modules are z-scores against HEALTHY_PRIOR, a hand-authored table of 22 (mean, std) pairs. No training data, no covariance (despite the 'Mahalanobis-lite' comment), no fitting. The forecast is exponential drift/decay with hand-picked rates and no uncertainty band. These are well-labeled scoring rubrics presented as machine learning.
- meta-analysis.ts mixes computed and typed-literal numbers in the same view: the coverage[] slices carry hardcoded knownKnowns/knownUnknowns/unknownUnknowns integer counts that are not derived from items[], displayed next to genuinely computed scores. Readiness and confidence are magic-constant arithmetic (38 + kk*6 + rtReady*5 - criticalUnknowns*2). quickReadiness() advertises itself as a lightweight tick but calls the full runMetaAnalysis and discards 95% of the result.
- Magic constants pervade the scoring with no provenance or calibration: 0.12 annualization in the Bayesian EAL, Beta prior strength 20, pseudo-count weights of 8 and 6 and 4 and 3.5, conf = 55 + ..., utility coefficients 1.1 / 1.0 / 0.45. Nothing records where any of these came from.
- Duplicated and bidirectionally-coupled state. scenario-runner.tsx keeps its own staff and riskVars copies synced from the profile by effect; practice-context.tsx couples staff.dualControlPayments, riskVariables.hasDualControl and dualRelease.enabled in three different setters, each writing the other two. Easy to desync and hard to reason about.
- Heavy synchronous recomputation on the render path. runAdvancedReasoning (beam search width 4 depth 3, each node a full cascade simulation, plus counterfactuals, EVOI and Bayesian init) runs inside a useMemo keyed on profile.staff and profile.riskVariables, so it re-runs on every slider drag.
- No accessibility work. Only three UI primitives exist despite ~24 Radix packages being declared, so every input, slider, tab, table and disclosure is hand-rolled from styled native elements with no aria wiring. Status is encoded by color alone in several panels. /threat's only navigation affordance is an sr-only link. Dark-only theme with no light mode.
- 579 LOC of dead WebRTC multiplayer code (src/lib/multiplayer/) with zero imports outside the module, signaling to a /api/rtc route that does not exist.
- knowledge-map.tsx uses fixed SVG coordinates (y = 48 + i*72 for people, 40 + i*68 for knowledge), so it silently breaks past the demo fixture's row count.
- The Predator/Terminator thermal vision modes, the ticking 1 Hz UTC clock, and the FORCE RED/AMBER/GREEN tactical framing are the wrong register for a commercial product sold to a dentist and an office manager — particularly given that the market research's central complaint is UIs that are confusing and click-heavy.
- Single commit, single author, no branches, no review history, and a commit message ('Restore index.tsx...') that describes work the commit does not actually contain.

## Phi security observations

- Precog holds no PHI today and has no concept of a patient. There is no patient entity, chart, ledger, claim, or appointment anywhere in the type system. people[] are staff members (name, role, tenureYears, active). This matters strategically: adding PHI to the merged product is a net-new compliance problem to be designed, not a migration of existing exposure.
- The nearest PHI-adjacent surface is dual-release.ts's payeeContains exception matcher and the release-evaluation flow. In production those carry payee names — vendors, and for refund channels quite possibly patients — so the exception table and any approval log become PHI-bearing the moment they hold real data.
- No BAA-eligible third party in the stack. Identity federates to the Grok broker at auth.grok.me (GROK_ISSUER_DEFAULT in src/lib/auth/preview.ts) and the LLM is xAI at api.x.ai. Neither relationship is one a HIPAA-covered product can rely on without a signed BAA. Both must be replaced.
- The LLM call has no PHI gate, no redaction, no consent check and no boundary. runGrokAgentLoop POSTs JSON.stringify of every ToolResult — the complete tool output payload — to api.x.ai. Today that is fixture data. If PMS data were routed through executeTool or buildPioneerContextPack, it would leave the trust boundary silently. Notably, Smile Notes already has a PHI gate for exactly this; Precog has none, so the merged design must adopt the Smile Notes posture rather than the Precog one. The market research flags this exact concern as a live competitive question (whether an AI compliance assistant routes patient context through third-party LLM APIs).
- runPioneerCoach and getLlmToolCatalog are unauthenticated server functions. Post-merge, an unauthenticated endpoint that returns a tool-grounded brief over practice data is a direct read-path data leak, not merely a cost problem.
- A live OAuth client secret is committed in plaintext at src/lib/auth/preview.ts (PREVIEW_CLIENT_SECRET, 64 hex chars) and is in git history. Rotation requires coordinating with the broker, and history rewriting or acceptance of exposure.
- No role-based access control of any kind. migrations/0001_auth.sql has no role, permission, org or tenant column; the only identity primitive is a userId string. There is a deep irony here: the product's core asset is an entitlement-conflict engine with 14 well-modeled roles, while the product itself has no roles at all.
- No audit logging of reads or writes. The decision journal is the only trail and it lives in localStorage, so it is trivially editable by the user and therefore not evidence. For a compliance product whose entire value proposition is defensibility, this is the single most important gap to close: the journal must become server-side and append-only.
- No encryption at rest beyond whatever the Postgres provider supplies. No field-level encryption. The PGLite fallback is in-memory and unencrypted, and db.ts documents that a process restart wipes both data and sessions.
- Authentication offers only Google and X social login; email/password is hard-disabled (email-password.ts exports false with instructions not to modify server.ts). There is no MFA or TOTP, no password policy, no session revocation UI, no idle timeout, and no step-up re-authentication for sensitive actions. Smile Notes already has TOTP MFA, so that side should be the base for the merge.
- Genuinely good patterns worth preserving conceptually: assertSameSiteRequest() in isolation.server.ts rejects scripted cross-site and same-site-sibling requests via Fetch-Metadata headers while still allowing top-level GET navigations for OAuth callbacks — a well-reasoned defense against the sibling-tenant attack that same-site Lax cookies invite. __Host- prefixed cookies prevent a sibling origin from injecting a session with a Domain attribute. account.encryptOAuthTokens encrypts broker tokens at rest.
- Also worth preserving: verify.server.ts fails closed. When DATABASE_URL is set but auth is disabled, requireUserId throws rather than falling back to a shared 'dev-user' against real data, and it logs a startup error explaining why. Likewise db.ts treats a whitespace-only DATABASE_URL as unset specifically so production cannot silently run on the ephemeral PGLite fallback. That instinct — refuse to degrade quietly when real data is present — is exactly the right default for a PHI system and should be a stated architectural principle in the merged product.
- No secret management: XAI_API_KEY, BETTER_AUTH_SECRET, DATABASE_URL and GROK_AUTH_* are all read from process.env with no vault, no rotation story and no startup validation that required secrets are present.
- No data retention, deletion, or export policy anywhere. Nothing implements or even contemplates a patient right-of-access or right-to-delete path, which the merged product will need.

## Product insights

- The strongest strategic asset is that the SoD ontology is already written in PMS nouns. conflict-rules.ts names entitlements as post_payments, approve_writeoffs, submit_claims, create_vendor, approve_vendor, release_payment, prepare_deposit, bank_reconcile, post_adjustments and pms_admin_roles. In a standalone risk tool these must be collected by questionnaire; inside a PMS they ARE the permission model. Binding the rulebook to real role assignments converts 'you told us you have a conflict' into 'you have a conflict, here are the three people and the exact fraud path' — which is precisely the interactive-tailoring gap the research says no financial-controls product fills for SMBs.
- The same logic makes dual-release.ts the highest-leverage merge target. Its six channels (ach, check, writeoff, vendor_new, deposit, payroll) are PMS transaction types, and evaluateRelease already returns approve / block / needs-second with an explanation of which exception applied. Putting it in front of real write-off, adjustment and refund posting moves the product from 'recorded' to 'enforced' — the distinction the research identifies as the axis competitors are being judged on.
- The meta-analysis known-unknowns list is effectively the integration roadmap, and it is compelling because a PMS already owns nearly every feed it asks for: the void and adjustment audit log with the posting user's identity, the vendor master change log, actual cash counts, the patient refund authorization trail, and bonding/background-check currency. This is the concrete argument for merging rather than selling two products — Precog's engine is starved of exactly the data the PMS generates as a byproduct.
- The research says only 17% of dental thefts are caught by the practice's designed controls (83% by chance), with 48% of dentists victimized and average losses of $105-109k. That statistic is the product's headline: a PMS that detects entitlement conflicts from live roles and enforces dual approval on the actual money-touching transactions is attacking the 83% directly. No competitor in the research does this.
- 'Reporting that reconciles to the bank' is called out as the top control point, and Zeldent's thesis is quoted as 'the bank is the only independent ground truth.' Precog currently models bank reconciliation as a single boolean (independentBankRec) that feeds residual and leading-indicator scores. The merged product should make it a real reconciliation surface; the scoring machinery to consume it already exists and would immediately become meaningful rather than self-reported.
- The decision journal's four dispositions — remediate / accept_residual / monitor / insure — with review dates and a residual-at-decision snapshot is the 'assess, tailor, track remediation' loop that Abyde ($115/mo) and Patient Protect ($39-99/mo) sell as their whole product. Precog has the model; it needs server-side immutability and evidence attachment. The meta-analysis file even names this gap itself (ku-decision-followthrough: decisions carry no proof the control actually changed).
- The variable-cascade concept — 'change one thing, see what else moves,' with dollar-denominated deltas across residual, premium, retained loss, cost of risk and detection timeline — is genuinely novel UX for this market and generalizes beyond risk. It is the right pattern for any consequential PMS settings change, and it directly answers the research's complaint about tools with no legible ROI story: every recommended control change comes with a priced effect.
- The COSO heat map plus tornado sensitivity is a good executive dashboard shape: a score, the five components that compose it, and a ranked list of the changes that move it most. Pair that with the cascade dollar figures and the owner gets 'your control score is 62; enabling dual approval on write-offs moves it to 71 and cuts expected annual cost of risk by $4,200.' That is a sellable one-screen story.
- Every output is captioned 'educational, not actuarial' and the system prompt explicitly forbids accusing staff of fraud ('score control design and residual risk only'). For an attorney-owned product this discipline is correct and should survive the merge verbatim — it is also good product design, since a tool that accuses the front-desk staffer will be uninstalled the day it does so.
- The Johari and meta-analysis 'here is what we cannot see' framing is unusually honest and could become a real trust feature, but it needs reframing. As written it reads as an epistemology lecture with four quadrants and Rumsfeld taxonomy. As an onboarding checklist — 'connect these five data sources to raise assessment confidence from 52 to 84' — it becomes an activation funnel that also happens to be truthful about model limits.
- Two structural blind spots the meta-analysis names are worth designing for explicitly rather than filing away: two-party collusion passes dual release by design (the control cannot see that both signers share finances), and owner impairment is a single point of failure whenever the owner is the designated second approver. Both are real, both are common in 8-person practices, and neither is addressed by any competitor. Naming them in the product builds more credibility than pretending they are covered.
- Panels worth carrying into the merged PMS as dashboards: sod-panel (conflict list, matrix and health score), dual-release-panel (policy editor plus the live release simulator — the simulator in particular is excellent for training and for demos), residual-radar (ranked risks plus tornado levers), coso-heatmap (executive summary), cascade-panel (change preview), decision-journal (compliance trail), and the signals half of intelligence-panel (leading indicators and the neglect-vs-plan forecast chart). Panels to drop or heavily rework: threat-assessment and the Predator/Terminator vision modes in process-map (wrong register for a clinical buyer), johari-panel and meta-analysis-panel as user-facing screens (keep the content, retire the epistemology UI), advanced-reasoning-panel (the math should inform recommendations, not be displayed raw to a dentist), and layers-panel (concept navigation with thin content).

## Test and ci posture

Effectively nonexistent, and the repository cannot currently be verified even manually. There are zero automated tests: no test files anywhere in the tree, no test runner in devDependencies (no vitest, jest, or testing-library), and no test script in package.json. Roughly 7,000 LOC of scoring, simulation and search math — beam search, Bayesian updates, cascade simulation, SoD conflict detection, dual-release threshold and exception resolution — has no verification of any kind. There is no CI: no .github directory, no workflow files, no pipeline configuration.

The only verification tooling is three sandbox-oriented Playwright scripts. scripts/browser-smoke.mjs loads http://127.0.0.1:8080, waits for network idle, captures a screenshot, reports title / body text length / console errors, and exits 1 on navigation failure or 2 on any console error. scripts/preview-thumbnail.mjs captures a 1280x800 thumbnail for the Grok preview service. scripts/browser-guard.mjs is a genuinely thoughtful hardening module shared by both — it restricts targets to http/https loopback (blocking file:, data:, chrome: and view-source:) and confines output paths to an allowlisted directory after path resolution, specifically to stop a screenshot script from rendering /root/.grok/auth.json into a readable PNG. That is careful work, but it protects the build agent, not the application. All three require a running dev server, which is impossible in the current state.

The real gates are npm run typecheck (tsc --noEmit) and npm run lint (eslint with typescript-eslint, react-hooks, react-refresh and prettier integration). Both are configured competently. Neither can pass today: typecheck fails immediately on src/routes/index.tsx, which is not valid TypeScript but the string 'SEE_FILE_/tmp/index_restored.tsx'. node_modules is not installed, so nothing has been run recently. npm run build chains vite build into node scripts/migrate.mjs, so a deploy would apply migrations to DATABASE_URL — that migrator is well written (one transaction per file, recorded in a _migrations table, idempotent, skipped with a clear message when DATABASE_URL is unset, and it prints pg error code/detail/hint/position/where on failure), and it is the most production-ready script in the repo.

Process signal is minimal: one commit, one author, no branches, no tags, no PRs, no review history. The single commit's message ("Restore index.tsx with Command UI + Threat Assessment link to /threat") asserts work that the commit does not actually contain, which is itself the clearest evidence that nothing gates what lands. Overall posture: pre-alpha prototype, entirely unverified, with the quality of the domain reasoning inversely proportional to the quality of the engineering process around it.

## Open questions

- Does a copy of the real src/routes/index.tsx exist anywhere — a Grok sandbox snapshot, another machine, a chat transcript, an earlier export? It defined the tab shell, the onNavigate(tab, id) deep-link dispatcher and the mounting of 17 panels. Without it the panels' integration contract must be reconstructed from orphaned prop signatures, and roughly 8,000 LOC of UI is currently unreachable. This is the single highest-value recovery item; check for a Grok Build project snapshot before rebuilding the shell from scratch.
- Was /threat ever intended as a product surface, or was it a demo detour? It is the only route that renders, which makes the repo's runnable state actively misleading about what the product is. Related: should the Predator/Terminator/tactical visual language be retired entirely for a clinical buyer, or kept as an internal or marketing artifact?
- Which repo's auth is the base for the merge? Smile Notes already has TOTP MFA and role-based access; Precog has better session, cookie and cross-site plumbing but federates identity to a third party (auth.grok.me) with no BAA. The likely answer is Smile Notes' identity model plus Precog's isolation and fail-closed patterns, but that needs deciding before any schema work.
- Should the merged product's control scores remain explicitly 'educational, not actuarial', or become defensible numbers? Making them defensible requires calibration data that does not exist, and materially changes the liability posture for an attorney-owned product. The current disclaimer discipline is a deliberate and probably correct choice — confirm it is intentional and should persist.
- Is there an intended real data source for HEALTHY_PRIOR (22 hand-authored mean/std pairs) and crimeFraudStats, or do these remain cited-literature constants? This determines whether the anomaly scorer can honestly keep the 'ML' label or should be relabeled as a scoring rubric.
- Should the dual-release engine become an enforcement gate that blocks real PMS postings, or remain advisory? This is product-defining: enforcement requires the permissions architecture, an immutable approval log, an override-with-reason path, and a break-glass procedure, and it is also the feature that most differentiates against every competitor in the research.
- What is the tenancy model — one practice per account, or DSO and multi-location from day one? Nothing in Precog anticipates either; there is no practice_id, org_id or tenant concept in any type or table. This choice cascades into every schema decision and cannot be deferred.
- Has any part of the reasoning stack been validated against a real practice, or is all of it authored from the literature? Specifically, do the conflict rules, the dual-release channel thresholds, and the residual weights reflect any actual dental office's operations, or are they entirely a priori?
- The counterfactual residual bug (worldFrom ignores its vars argument, so insurance levers show zero residual change) and the beam-search status-quo bug (the empty node is dropped, so 'do nothing' is never recommendable) both produce plausible-looking but wrong output today. Were these ever noticed? Their presence suggests the reasoning output was reviewed for shape rather than correctness, which raises the question of what else in the 7,000 LOC has never been checked against a hand-computed expectation.
- What is the disposition of the committed OAuth secret in src/lib/auth/preview.ts? It is in git history. If the merged product starts from this repo's history rather than a fresh tree, that decision needs to be made deliberately.
- Does the owner intend to keep any Grok/xAI dependency post-merge, or move fully to a provider that will sign a BAA? The domain layer has zero Grok coupling, so this is a clean cut — but it affects whether agent-loop.ts's single fetch is refactored behind a provider interface now or later.
