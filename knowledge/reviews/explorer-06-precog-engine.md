# Explorer report 6: precog-engine

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 6 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, precog-engine

## Summary

The precog "engine" is a ~4,700-line pure-TypeScript risk/controls calculator living entirely under /home/user/catcorner22/precog/src/lib/precog (plus ~7,000 more lines of LLM/RAG/reasoning scaffolding around it). It computes, for a small dental practice: (a)…

## Scope

precog-engine

## Summary

The precog "engine" is a ~4,700-line pure-TypeScript risk/controls calculator living entirely under /home/user/catcorner22/precog/src/lib/precog (plus ~7,000 more lines of LLM/RAG/reasoning scaffolding around it). It computes, for a small dental practice: (a) a residual-risk portfolio over controls / knowledge items / scenarios using inherent × (1 − control effectiveness) × staff-composition uplift, banded into four action bands; (b) a COSO 2013 heat map across 5 components and all 17 principles, each principle's status derived from live state (segregation score, dual-control flags, SPOF counts, unaddressed gaps); (c) automated segregation-of-duties conflict detection by scanning every unordered pair of entitlements a person holds against a 12-rule dental conflict rulebook plus a duty-family incompatibility matrix; (d) a dual-release (two-person approval) policy engine over 6 payment/adjustment channels with a genuinely sophisticated threshold-exception system (raise/lower/force/waive, scoped by payee, person, role, amount band, and effective dates); (e) Monte-Carlo-free scenario projections producing p50 and a labelled 95% interval on "time to material impact" plus gross/retained/transferred loss under an insurance-transfer model (deductible, coinsurance, limit, stacked carrier discounts capped at a max); (f) a "tornado" sensitivity that re-runs the whole portfolio under five counterfactual staff/control configurations and ranks levers by delta in average residual; and (g) a 12-lever cross-variable cascade simulator that reports before/after on 13 metrics with direction semantics and second-order narrative notes.

The domain content is the real asset and it is unusually good. The SoD rulebook, entitlement taxonomy, duty-family matrix, dual-release channel defaults ($500 ACH, $150 write-off, $0 new-vendor and deposit), compensating-control defaults, fraud-path narratives, and the ROE/remediation text are all correct, dental-specific internal-control practice that maps directly onto the market-research gap ("no interactive SMB product tailors financial and operational internal controls"; 48% of dentists embezzled; only 17% caught by designed controls). The COSO principle mapping is complete and each principle carries a deep-link target into the evidence, which is exactly the questionnaire→tailored-policy→remediation-tracking loop Abyde/Patient Protect run for HIPAA but nobody runs for financial controls.

The engineering maturity is much lower than the domain content. Every engine module hard-imports module-level singletons (people, controls, knowledge, relations, processes, scenarios, staffComposition, crimeFraudStats) from demo-data.ts — 21 files do this. Only three things are actually user-editable: StaffComposition, RiskVariableState, and DualReleasePolicy, and those live in browser localStorage under key "precog.practiceProfile.v2" with zero server persistence (the single migration in migrations/ is the better-auth schema; there is no app table). assessCoso() takes no arguments at all and reads demo staff directly, so the COSO heat map is frozen regardless of what the user configures — and it feeds the ML feature vector and leading-indicator composite, so coso_overall is a constant there too. findKnowledgeRisks() is likewise argument-free and always returns demo SPOFs. The ML directory is classical statistics, not learned models: z-scores against a hand-written HEALTHY_PRIOR table, a weighted threshold composite, and a linear residual-drift extrapolation — honestly labelled as such in each file's method string. stats/README.md documents three forensic files (benford.ts, forensic-suite.ts, demo-transactions.ts) that do not exist anywhere in the repo. src/routes/index.tsx is a 32-byte broken placeholder containing the literal string "SEE_FILE_/tmp/index_restored.tsx", so the app's home route does not compile. There are no tests, no vitest, no CI.

Verdict for the merged PMS: lift the rulebooks, the dual-release evaluator, the residual math, the COSO mapping, and the corpus; rewrite the data plumbing entirely. Roughly 1,400 lines of this codebase are durable domain logic and roughly 1,600 are demo scaffolding or presentation-tier heuristics that should not survive the port.

## Architecture

DATA FLOW (current): demo-data.ts exports frozen module-level arrays (people, knowledge, relations, processes, controls, scenarios, staffComposition, crimeFraudStats). Every engine module imports these directly at module scope — there is no repository, no injection, no query layer. The only mutable state is PracticeProfile { practiceName, staff: StaffComposition, riskVariables: RiskVariableState, dualRelease: DualReleasePolicy, decisions: DecisionEntry[] }, held in React context (practice-context.tsx) and persisted to localStorage by practice-profile.ts (STORAGE_KEY "precog.practiceProfile.v2", with a v1 migration read). Components call engine functions synchronously inside useMemo and render; there are no loaders, no server functions for scoring, and no database round-trip anywhere in the risk path.

SCORING MATH — RESIDUAL ENGINE (scoring/residual-engine.ts + scoring/weights.ts, SCORING_VERSION "precog-residual-v1.0.0"):
1. Inherent (0–1) = 0.28·assetExposure + 0.22·processCriticality + 0.25·fraudOpportunityClass + 0.15·detectionDifficulty + 0.10·cascadePotential. Each factor is derived by SUBSTRING MATCH on the control's id: fraudOpportunityClass = 0.85 if id contains "sod"|"cash"|"ap"|"ar" else 0.45; exposure = 0.9 if id contains "cash"|"ap" else 0.55; criticality = 0.8 if duties.length >= 2 else 0.5; detectionDifficulty = 0.75 if !segregated else 0.35; cascade = 0.7 if id contains "sod" else 0.4.
2. Control effectiveness (0–1) = 0.30·segregationQuality + 0.15·dualAuthorization + 0.15·independentReconciliation + 0.15·compensatingControls + 0.15·monitoringCadence + 0.10·knowledgeRedundancy. segregationQuality = 0.9 if control.segregated else (staff.segregationScore/100)·0.45. dualAuthorization = 0.85 if staff.dualControlPayments AND id matches ap|cash, else 0.5 if dual on, else 0.15. independentReconciliation = 0.9 / 0.45 / 0.10 on the same pattern for bank rec. compensatingControls = 0.1 if none, else min(0.85, 0.35 + 0.25·count). monitoringCadence = 0.55 if independentBankRec else 0.25. knowledgeRedundancy = (# knowledge risks with ownerCount>=2) / (total knowledge risks).
3. residualRaw = inherent × (1 − effectiveness).
4. Staff uplift factor = 1 + 0.12 (teamSize <= 6) + min(0.24, 0.06 × soleOwnerKnowledgeCount) + 0.15 (segregationScore < 50) + 0.05 (avgTenureYears < 3). Max factor 1.56.
5. residual = clamp(0..100, round(residualRaw × 100 × upliftFactor)).
Worked example (control c-sod-cash, demo staff): inherent 0.823, effectiveness 0.265, raw 0.605, uplift 1.39 → residual 84 → "critical_path".

ACTION BANDS (weights.ts ACTION_BANDS, inclusive integer ranges): 0–39 accept_monitor ("Residual risk is tolerable if monitoring stays live. Set a re-review date."); 40–59 mitigate ("Install compensating controls or reduce likelihood within one planning cycle."); 60–79 act_now ("Priority remediation. Do not accept residual risk without owner sign-off."); 80–100 critical_path ("Material control failure path. Address before other nice-to-haves.").

KNOWLEDGE SCORING (same file): inherent = 0.55·crit + 0.45·ownership where crit = 0.9 critical / 0.6 otherwise, ownership = 1.0 (no owner) / 0.85 (sole) / 0.35 (two) / 0.15 (3+); effectiveness = 0.7 (>=2 owners) / 0.25 (1) / 0.05 (0); then the same ×(1−eff) and staff uplift.
SCENARIO SCORING: lossNorm = clamp01(expected/125000); timeNorm = clamp01(1 − p50/240); inherent = 0.55·lossNorm + 0.45·(0.5 + 0.5·timeNorm); effectiveness = 0.2 + 0.15(dual) + 0.15(bankRec) + 0.25·(segScore/100); residualRaw = inherent × (1 − 0.5·effectiveness) — note the ×0.5 damping unique to this branch.
Each score carries up to 6 RiskDrivers {label, direction increases|decreases, weight, detail} sorted descending by weight — this is the explainability surface and it is genuinely useful.

TORNADO SENSITIVITY (residual-engine.tornadoSensitivity): re-runs portfolioSummary() five times against mutated StaffComposition clones — dualControlPayments=true, independentBankRec=true, segregationScore=75, soleOwnerKnowledgeCount=0, teamSize=10 — and returns levers sorted by (baseAverage − improvedAverage). It is a genuine one-at-a-time counterfactual sweep over the real scoring function, not a lookup table, but it only perturbs the five StaffComposition fields; it cannot vary insurance variables or per-control design.

DYNAMIC VARIABLES / INSURANCE TRANSFER (scoring/dynamic-variables.ts, 18-entry VARIABLE_CATALOG with per-variable likelihoodEffect and severityEffect prose): computeLikelihoodSeverity multiplies three independent channels — likelihood, grossSeverity, detectionLag — by hard-coded factors: cameras ×0.88 likelihood (fraud) and ×0.92 detection lag; dual control ×0.72 likelihood and ×0.85 severity; independent bank rec ×0.90 likelihood, ×0.75 detection lag, ×0.88 severity; alarm ×0.94; bonded handlers ×0.93 likelihood and ×0.97 severity; cash intensity = clamp(dailyCashExposure/2500, 0.5, 3) applied as ×intensity on severity and ×sqrt(intensity) on likelihood; claimsLoadFactor >1 adds (load−1)·0.35 to likelihood and ·0.15 to severity; deductible >= 25000 adds ×1.03 likelihood (moral-hazard proxy). Outputs are clamped to [0.25,2.5] likelihood, [0.35,3] severity, [0.4,1.4] detection lag. retainLoss(gross, v): afterDed = max(0, gross − deductible); practiceCoins = afterDed × coinsurancePct; insurerLayer = afterDed − practiceCoins; transferred = min(insurerLayer, policyLimit); retained = gross − transferred. computeNetPremium: sum active discount pcts (cameras 5, dual 8, bankRec 5, alarm 3, bonded 4), clamp to maxDiscountPct (default 25), premium = base × (1 − pct/100) × claimsLoadFactor + underwritingLoad. expectedAnnualCostOfRisk = premium + retained × annualFreqWeight where annualFreqWeight = clamp(0.12 × likelihoodMultiplier, 0.03, 0.45).

SCENARIO ENGINE (engine.ts runPrecogScenario): staffRiskMultiplier is a product of ×1.15 (team<=6), ×1.20 (soleOwner>=2), ×1.25 (seg<50), ×1.08 (no dual), ×1.06 (no bank rec), ×1.05 (tenure<3). fraudMultiplier = 1 + 0.5·industryEmbezzlementRate (0.18) for cash/writeoff/vendor/sod scenarios. timelineMult = staffMult × sqrt(fraudMult) × dynamic.timelineMultiplier, where dynamic.timelineMultiplier = detectionLagMultiplier / sqrt(likelihoodMultiplier). Mitigations take the MAX riskReduction among selected (not additive), applying ×(1−r) to impact and ×(1−0.4r) to timeline. p50/p95Low/p95High are the scenario's hand-authored base days scaled by timelineMult, with p95High floored at p50+5. The "95% CI" is therefore a scaled hand-authored interval, not a sampled or fitted distribution — confidenceLabel says "95% CI on time-to-material-impact (dynamic likelihood/severity model)" and the assumptions array explicitly discloses it is educational.

COSO MAPPING (coso.ts, 404 lines): five CosoComponentAssessment objects each with score 0–100, HealthStatus (strong>=80 / adequate>=60 / weak>=40 / critical), a principles array, findings with DeepLinkTarget, and primaryActions. Component scores: Control Environment = max(25, 72 − 12·(seg<50) − 10·(unaddressedGaps>2)); Risk Assessment = max(20, 78 − 8·spofCount − 8·(topScenario p50<60)); Control Activities = max(15, segregationScore − 12·(!dual) − 10·(!bankRec) + 15·(no SoD gaps)); Information & Communication = max(25, 70 − 10·spofCount − 15·unownedCount); Monitoring = max(20, 55 + 15·bankRec + 10·(residualAccepted>0 && unaddressed==0) − 6·unaddressedGaps). Overall = arithmetic mean of the five. All 17 principles are present and each has a status rule and a note: P1 integrity (from CE score), P2 oversight (independentBankRec), P3 structure/authority (unaddressedGaps>2), P4 competence (spofs), P5 accountability (residualAccepted>0), P6 objectives (static adequate), P7 identify/analyze (ranked.length), P8 fraud risk (dual AND bankRec), P9 assess change (hard-coded "weak" — "Staff exits and role changes are not yet monitored as control-change events"), P10 select control activities (statusFromScore of Control Activities), P11 technology general controls (static adequate, note "PMS role design assumed; re-check access when staff change"), P12 policies & procedures (any unaddressed gap with zero compensating controls), P13 relevant quality information (static, note about aging/adjustments/deposits visibility), P14 internal communication (spofs), P15 external communication (static), P16 ongoing/separate evaluations (independentBankRec), P17 communicate deficiencies (unaddressedGaps). Control Activities emits one finding per unsegregated control; Info & Comm emits one per SPOF. priorityFindings = first 8 findings with severity critical|weak across all components.

SoD DETECTION (sod/conflict-rules.ts + sod/detect.ts): 14 entitlements typed to 5 duty families (authorization, custody, recording, reconciliation, master_data) with riskWeight 1–5 and processIds. 12 named conflict rules, evaluated symmetrically. Detection algorithm: expand person → entitlements via ROLE_TEMPLATES (six dental roles) plus optional per-person overrides; for every unordered pair test findRule(a,b); if no named rule, fall back to FAMILY_CONFLICT_MATRIX (custody conflicts with everything including itself; master_data conflicts with itself, custody, authorization; recording conflicts with authorization/custody/reconciliation; reconciliation with custody/recording) and emit a synthetic "family" conflict; view_reports_only is always exempt. scoreConflict: base 88 critical / 72 high / 55 medium / 48 family; + 3·(weightA + weightB − 6); − 18 if residual accepted; − min(20, 6·compensatingCount); − 28 if dual-release mitigated; + 6 if no dual control and either side touches pay/cash/release; + 8 if no independent bank rec and either side is bank_reconcile; + 5 if segregationScore < 50; clamped to [12,100]. segregationHealth = clamp(5..100, 100 − (14·critical + 8·high + 4·medium + 2·family + 1.5·openWithoutAcceptance − 4·dualReleaseMitigated)). It also emits the full N×N (14×14 = 196 cell) entitlement matrix for the UI and four targeted recommendation strings keyed on which specific rules fired.

DUAL RELEASE (controls/dual-release.ts, 855 lines — the single most production-shaped module): 6 channels with defaults ach $500, check $500, writeoff $150, vendor_new $0 (always dual), deposit $0, payroll $0; each with firstApproverRoles, secondApproverRoles, mitigatesRuleIds (the bridge back into SoD scoring), and processIds. evaluateRelease(policy, request) returns one of 9 ReleaseStatus values (below_threshold, needs_second, approved_dual, approved_single, approved_exception, blocked_same_person, blocked_role, blocked_missing_second, blocked_policy_off) with reasons[], nextSteps[], eligibleSeconds[], the applied exception, and a controlCredit block asserting insurance-discount eligibility (requires policy enabled AND >=3 enabled rules AND no active waive_dual exception). Exception resolution: matchExceptions filters on enabled, date window (effectiveFrom/effectiveTo inclusive), channel membership, payeeContains substring, personId, role, and amount band; then sorts by exceptionSpecificity (payee 40 > person 30 > role 20 > amount band 15 > single-channel 10 > dated 5) and the top match wins. resolveEffectiveThreshold maps waive_dual → +Infinity, force_dual → −1, raise_threshold → max(base, override), lower_threshold → min(base, override). mitigatedSodRuleIds(policy) returns the union of mitigatesRuleIds across enabled rules and is injected into detectSodConflicts, closing the loop: turning on a channel visibly lowers SoD conflict scores by 28 points and reclassifies conflicts as mitigated.

THREAT SCORING (threat-scoring.ts + map-vision.ts): unifies portfolio top-6, SoD top-4, SPOF top-4, and ranked-scenario top-3 into one deduped 10-item "target deck". scorePriority = min(100, heat·0.55 + impact·100·0.45 + 8 if heat>=70 && impact>=0.7) where impact starts 0.45 and is raised to >=0.72 for open control gaps, >=0.65 for knowledge/sole-owner, or 0.55 + 0.06·dependencyCount for processes. Bands: white_hot >=88, critical >=72, elevated >=55, watch >=35, cold below. Each target gets a domain-specific ROE (rules-of-engagement) list from deriveRoe(), which keys off name substrings (cash/deposit/payment, write/adjust/ar, vendor/ap/payable, knowledge) to emit concrete remediation steps. map-vision.ts also holds a 8-stop thermal color ramp and the Predator/Terminator visual modes — pure presentation.

ML MODULES — WHAT THEY ACTUALLY COMPUTE: ml/features.ts builds a 22-feature vector (team_size, segregation_score, sole_owner_knowledge, avg_tenure, dual_control, independent_bank_rec, cameras, alarm, bonded, deductible, policy_limit, base_premium, claims_load, daily_cash, avg_residual, critical_path_count, act_now_count, coso_overall, spof_count, sod_gap_count, open_sod_without_accept, discount_cap) and z-scores it against HEALTHY_PRIOR, a hand-written {mean, std} table with no empirical provenance. ml/anomaly.ts is NOT Mahalanobis — it is a signed one-sided weighted z-sum ("diagonal-prior z-score stress (Mahalanobis-lite)" per its own method string): for each feature, contribution = max(0, z)·w for positive-weight features and max(0, −z)·|w| for negative-weight (control-presence) features; overallScore = min(100, round(stress × 12)); bands stable/elevated/stressed/critical at 35/55/75. There is no covariance matrix, no training, no fitting. ml/leading-indicators.ts is a 9-indicator weighted threshold composite (weights 0.6–1.4; breach counts 1.0·w, watch counts 0.45·w) producing pressureIndex = round(100·pressure/sumWeights) and bands calm/watch/heat/red at 25/45/70. ml/forecast.ts is deterministic linear extrapolation: do-nothing residual drifts +driftPerWeek where drift = 0.15 + pressureIndex/200 + 0.35|0.20|0.05 by anomaly band, capped at 95; the "with plan" path snaps to the post-lever portfolio average at week 1 then exponentially blends 0.92/0.08 toward it with a small re-drift of pressureIndex/800; it reports p50CrossingWeek, the week do-nothing residual crosses 60. No stochastic simulation, no confidence bands, no learned parameters anywhere in ml/. All four files are honest about this in their method strings and header comments.

ENFORCEMENT MODEL: none of this is enforced anywhere. Every computation is client-side and synchronous; the profile is localStorage; the two server functions (coach/pioneer-server.ts runPioneerCoach and getLlmToolCatalog) are the only server surface and neither performs an auth check despite src/lib/auth/verify.server.ts existing. evaluateRelease is a calculator that renders a verdict in dual-release-panel.tsx — it gates nothing, because there are no transactions in this app to gate.

## Key files


### Item 1
- **path**: /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts
**purpose**

Dual-release (two-person approval) policy engine: 6 channels, role-based first/second approver lists, threshold-exception system (raise/lower/force/waive scoped by payee, person, role, amount band, date window with specificity ranking), 9-state evaluateRelease() verdict machine, mitigatesRuleIds bridge into SoD scoring, and insurance-credit eligibility. The single most production-shaped module in the repo.

- **loc estimate**: 855

### Item 2
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/dynamic-variables.ts
- **purpose**: 18-variable catalog with per-variable likelihood/severity prose; computeLikelihoodSeverity (3-channel multiplier model), retainLoss (deductible/coinsurance/limit), computeNetPremium (5 stacked carrier discounts under a cap), applyInsuranceTransfer (retained vs transferred vs annual cost-of-risk).
- **loc estimate**: 667

### Item 3
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/variable-cascade.ts
- **purpose**: 12 named cascade levers with human-readable 'affects' graphs; applyLever mutates variables+staff, snapshots 13 metrics before/after, computes signed deltas with LOWER_IS_BETTER/HIGHER_IS_BETTER direction semantics, generates second-order narrative notes and a verdict string; simulateAllCascades ranks levers by cost-of-risk and by residual and emits a 20-edge dependency map.
- **loc estimate**: 616

### Item 4
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/residual-engine.ts
- **purpose**: Core residual math: controlInherent, controlEffectiveness, staffUplift, scoreControl/scoreKnowledge/scenario branch, portfolioSummary, and tornadoSensitivity (5-lever one-at-a-time counterfactual sweep). Emits ranked RiskDrivers for explainability.
- **loc estimate**: 457

### Item 5
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/detect.ts
- **purpose**: SoD conflict detection: 6 dental ROLE_TEMPLATES, pairwise entitlement scan against rulebook + duty-family fallback, scoreConflict (0-100 with residual-acceptance, compensating-count, dual-release, and staff-flag adjustments), 14x14 UI matrix, segregationHealth index, and rule-keyed recommendations.
- **loc estimate**: 437

### Item 6
- **path**: /home/user/catcorner22/precog/src/lib/precog/coso.ts
- **purpose**: COSO 2013 assessment: 5 components with derived 0-100 scores, all 17 principles with per-principle status rules and notes, findings with DeepLinkTarget navigation, and primaryActions. NOTE: assessCoso() takes no arguments and reads demo staff/controls directly.
- **loc estimate**: 404

### Item 7
- **path**: /home/user/catcorner22/precog/src/lib/precog/threat-scoring.ts
- **purpose**: Unifies residual portfolio, SoD conflicts, knowledge SPOFs, and ranked scenarios into a deduped 10-item priority 'target deck' with classification bands, an impact/likelihood matrix, mission brief, ROE summary, and explicit caveats that it never labels individuals.
- **loc estimate**: 369

### Item 8
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts
- **purpose**: The rulebook: 14 typed entitlements across 5 duty families with riskWeight and processIds; 12 named conflict rules each with severity, why, fraudPath, compensatingDefaults, and links to scenario/control; plus the FAMILY_CONFLICT_MATRIX. Pure declarative domain knowledge — the highest-value file per line in the repo.
- **loc estimate**: 331

### Item 9
- **path**: /home/user/catcorner22/precog/src/lib/precog/engine.ts
- **purpose**: runPrecogScenario: staff and fraud multipliers, mitigation max-reduction, dynamic-variable integration, p50/p95 timeline scaling, gross vs retained impact, staffModifiers/crimeModifiers/cascade narrative, assumptions disclosure. Also findKnowledgeRisks (argument-free, demo-only) and rankDangerousScenarios.
- **loc estimate**: 272

### Item 10
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/scenario-compare.ts
- **purpose**: Do-nothing vs each mitigation vs selected package comparison columns, deltas vs baseline on 7 metrics, five 'winner by' selectors (loss, retained, speed, priority, annual CoR), and a piecewise risk-over-time chart series built from p95Low/p50/p95High.
- **loc estimate**: 251

### Item 11
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/weights.ts
- **purpose**: Versioned, documented weight tables: SCORING_VERSION, INHERENT_WEIGHTS, CONTROL_EFFECTIVENESS_WEIGHTS, STAFF_MODIFIERS, and the four ACTION_BANDS with labels and guidance text. Explicitly designed to be tunable and auditable rather than a black box.
- **loc estimate**: 79

### Item 12
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/leading-indicators.ts
- **purpose**: 9 weighted threshold indicators (SPOFs, open SoD, bank rec, dual control, avg residual, COSO overall, claims load, daily cash, segregation) producing a 0-100 pressure index and top actions. Classical composite, not ML.
- **loc estimate**: 193

### Item 13
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/forecast.ts
- **purpose**: 12-week deterministic residual trajectory: linear drift under neglect (rate driven by leading pressure and anomaly band) vs lever step-down plus exponential blend; reports the week residual would cross the act-now threshold.
- **loc estimate**: 164

### Item 14
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/anomaly.ts
- **purpose**: One-sided weighted z-score stress sum against a hand-written healthy prior, with per-feature message templates and 4 bands. Self-described as 'Mahalanobis-lite'; there is no covariance matrix.
- **loc estimate**: 143

### Item 15
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/features.ts
- **purpose**: 22-feature practice vector + HEALTHY_PRIOR {mean,std} table + zScores(). The prior has no cited empirical source.
- **loc estimate**: 93

### Item 16
- **path**: /home/user/catcorner22/precog/src/lib/precog/demo-data.ts
- **purpose**: The frozen demo practice 'Ridgeview Family Dental': 6 people, 7 knowledge items, 13 person-knowledge relations, 7 process nodes with risks/ideas/lean wastes, 11 controls, staffComposition, crimeFraudStats priors, and 4 scenario templates with hand-authored p50/p95 timelines, loss ranges, stat sources, and mitigation options. Imported at module scope by 21 engine files.
- **loc estimate**: 772

### Item 17
- **path**: /home/user/catcorner22/precog/src/lib/precog/types.ts
- **purpose**: Core domain types: MatrixLayerId, ProcessRisk/Idea/Waste, Person, KnowledgeItem/Relation, ProcessNode, ControlItem, StaffComposition, CrimeFraudStats, ScenarioTemplate, MitigationOption, DynamicRiskSlice, PrecogResult, KnowledgeRisk.
- **loc estimate**: 195

### Item 18
- **path**: /home/user/catcorner22/precog/src/lib/precog/map-vision.ts
- **purpose**: scorePriority (heat x impact composite), priorityBand thresholds and labels, PriorityTarget type — plus thermal color ramp and scan-line CSS (presentation-only).
- **loc estimate**: 223

### Item 19
- **path**: /home/user/catcorner22/precog/src/lib/precog/process-graph.ts
- **purpose**: Builds a node/edge graph merging processes, risks, ideas, wastes, control gaps, knowledge SPOFs, and owners; computes per-process heat (0.45*maxRiskHeat + 12*sodGaps + 15*spofs + 0.35*residual) and a stage-based layout. Residual linkage is a fragile name-token substring match.
- **loc estimate**: 424

### Item 20
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-profile.ts
- **purpose**: PracticeProfile shape, localStorage load/save (key precog.practiceProfile.v2 with v1 migration), DecisionEntry / DecisionKind (accept_residual, remediate, monitor, insure) — the decision-journal primitive worth keeping.
- **loc estimate**: 109

### Item 21
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-context.tsx
- **purpose**: React context provider that keeps staff flags, risk-variable booleans, and the dual-release master switch bidirectionally synchronized on every setter, and persists on every change.
- **loc estimate**: 213

### Item 22
- **path**: /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts
- **purpose**: 16 curated educational knowledge chunks (COSO components/activities/monitoring, SoD three-way, dental cash path, fraud triangle, detection lag, Lean muda/mura/muri, knowledge SPOFs, insurance transfer, shadow AI, residual appetite language, write-off controls, vendor master, leading indicators) with tags and sources. Directly reusable as remediation-guidance copy.
- **loc estimate**: 152

### Item 23
- **path**: /home/user/catcorner22/precog/src/lib/precog/stats/README.md
- **purpose**: Documents a forensic suite (benford.ts, forensic-suite.ts, demo-transactions.ts) that does not exist in the repo. Aspiration only.
- **loc estimate**: 7

### Item 24
- **path**: /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts
- **purpose**: Token-efficient structured context pack fed to the LLM coach (practice, scoring version, staff, crime priors, COSO summary, residual top-N with drivers, SPOFs with owner NAMES, top scenarios, tornado levers) plus the Pioneer system prompt with its no-accusation guardrails.
- **loc estimate**: 84

### Item 25
- **path**: /home/user/catcorner22/precog/src/routes/index.tsx
- **purpose**: BROKEN: 32-byte file containing the literal text 'SEE_FILE_/tmp/index_restored.tsx'. The app's home route does not compile; the referenced /tmp file does not exist.
- **loc estimate**: 1

## Reusable assets


### Item 1
- **name**: SoD conflict rulebook (entitlements + 12 rules + duty-family matrix)
- **path**: /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts
**why reusable**

Pure declarative data with zero imports. The 14 entitlements map almost one-to-one onto real PMS permissions (post payments, prepare deposit, reconcile bank, approve/post write-offs, submit claims, create/approve vendor, release payment, enter/approve payroll, PMS admin roles). The 12 rules encode the exact fraud paths the market research names: lapping/skim with self-reconciliation, under-ring then void, deposit-short-then-adjust, self-approved write-offs, denial suppression via write-off, fictitious vendor, self-approved vendor master, ghost payroll hours, and privilege escalation to alter the audit trail. Each rule ships its own why/fraudPath/compensatingDefaults copy, which is the remediation content a controls module needs anyway.

- **quality**: production-grade
- **coupling**: Zero runtime dependencies — the file imports nothing. Lift verbatim; only the linkedScenarioId/linkedControlId strings need remapping to PMS entities.

### Item 2
- **name**: Dual-release policy engine with threshold exceptions
- **path**: /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts
**why reusable**

This is a real approval-workflow evaluator, not a demo. It already models the things a PMS must enforce on refunds, write-offs, ACH, deposits, and payroll: per-channel thresholds, role-based first/second approver sets, a hard requireDistinctPeople check, an owner-can-second-any escape hatch, hardBlockWithoutSecond, and a full exception regime with scoping, date windows, specificity-ranked precedence, and mandatory residual notes on waivers. The 9-state verdict with reasons[] and nextSteps[] is exactly the shape a server-side authorization middleware wants to return.

- **quality**: solid
- **coupling**: Only real coupling is `import { people } from '../demo-data'` used by personById() and listEligibleApprovers(). Replace with a user/role repository and the module is portable. StaffComposition is only touched in defaultDualReleasePolicy/mergeDualReleasePolicy.

### Item 3
- **name**: Versioned residual scoring weights + action bands
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/weights.ts
- **why reusable**: Named, documented, tunable weight tables plus a SCORING_VERSION string that is stamped onto every ResidualRiskScore. That versioning is what makes a scoring change auditable over time — essential if a practice is going to point at a score in a dispute or an insurance conversation. The four action bands with guidance sentences are ready-to-ship product copy.
- **quality**: production-grade
- **coupling**: None. Zero imports.

### Item 4
- **name**: Residual scoring formula + driver explainability
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/residual-engine.ts
**why reusable**

The inherent x (1 - effectiveness) x staff-uplift shape is standard risk-management practice and is the right skeleton. More valuable than the arithmetic is the RiskDriver output contract {label, direction, weight, detail} sorted by weight and truncated to 6 — that is how you show an owner WHY a control scored 84 instead of handing them a number. tornadoSensitivity() is a real counterfactual sweep over the live scoring function.

- **quality**: solid
- **coupling**: Hard-imports controls, knowledge, staffComposition, scenarios from demo-data and calls the argument-free findKnowledgeRisks(). The factor derivation via control-id substring matching (id.includes('sod'|'cash'|'ap'|'ar')) must be replaced with explicit typed fields on the control record before this can score real PMS controls.

### Item 5
- **name**: COSO 17-principle assessment with deep links
- **path**: /home/user/catcorner22/precog/src/lib/precog/coso.ts
**why reusable**

Complete and correct 2013 framework mapping with a per-principle status rule and an explanatory note, findings that carry a DeepLinkTarget so 'Principle 8 fraud risk is weak' navigates straight to the SoD evidence, and primaryActions per component. This is the questionnaire-to-remediation loop the research says nobody offers for financial controls, and it is already wired to live state rather than being a static checklist.

- **quality**: solid
- **coupling**: assessCoso() takes NO arguments and reads demo staffComposition and controls at module scope — it must be parameterized before it can reflect a real practice. The component score formulas are hand-tuned heuristics with magic constants (72, 78, 12, 10, 8, 15, 6) that deserve the same versioned-weight treatment as the residual engine.

### Item 6
- **name**: Insurance transfer / cost-of-risk model
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/dynamic-variables.ts
**why reusable**

retainLoss() (deductible → coinsurance → limit → excess back to the practice) and computeNetPremium() (stacked control credits under a carrier cap) are correct mechanics, and expectedAnnualCostOfRisk = premium + frequency-weighted retained EL is the right decision metric to show an owner. The insight it operationalizes is commercially strong: the same control (dual release, independent bank rec, cameras) simultaneously lowers residual risk AND unlocks a carrier credit, so a controls module can quote a dollar payback for a control the owner would otherwise skip.

- **quality**: solid
- **coupling**: Self-contained except for the RiskVariableState shape. The individual multipliers (0.72, 0.75, 0.88...) and discount percentages are explicitly labelled illustrative and would need real calibration or a per-carrier config before being shown as anything but a directional estimate.

### Item 7
- **name**: Cascade lever simulator with second-order notes
- **path**: /home/user/catcorner22/precog/src/lib/precog/scoring/variable-cascade.ts
**why reusable**

The teaching value is the honest tradeoff surfacing: 'Premium falls but retained rises — check deductible/limit; cheap premium does not mean lower owner risk', and 'Model holds base premium constant when deductible rises. Real carriers often cut premium — re-quote; do not assume free lunch.' The before/after 13-metric delta table with explicit LOWER_IS_BETTER / HIGHER_IS_BETTER direction semantics is a reusable pattern for any what-if UI.

- **quality**: solid
- **coupling**: Calls snapshot() which calls runPrecogScenario + portfolioSummary, so it inherits all the demo-data coupling. Re-runs the entire portfolio twice per lever (24 full portfolio computations for simulateAllCascades) — fine on 4 scenarios, would need memoization on real data.

### Item 8
- **name**: Threat target deck + ROE remediation copy
- **path**: /home/user/catcorner22/precog/src/lib/precog/threat-scoring.ts
**why reusable**

The unification pattern (residual + SoD + SPOF + scenario into one ranked, deduped, capped list) is the right information architecture for a controls dashboard. deriveRoe() emits concrete, correct, dental-specific next steps per risk class. The explicit caveats array ('never labels individuals as threats; targets are control gaps') is exactly the framing a product that watches employee behavior must adopt to be sellable and defensible.

- **quality**: solid
- **coupling**: Depends on portfolioSummary, detectSodConflicts, findKnowledgeRisks, rankDangerousScenarios, scoreLeadingIndicators, mitigatedSodRuleIds, scorePriority. The military-operations skin (WHITE HOT, AO, mission brief, rules of engagement) is a branding choice a commercial PMS should almost certainly drop while keeping the underlying structure.

### Item 9
- **name**: Decision journal primitive
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-profile.ts
- **why reusable**: DecisionEntry {subject, kind: accept_residual|remediate|monitor|insure, note, reviewBy, residualAtDecision, linkedTab, linkedId} captures the single most defensible artifact in internal-control practice: a dated, owner-attributed decision that records the residual score AT THE TIME and a review date. COSO Principle 17 and any auditor conversation turn on exactly this record.
- **quality**: prototype
- **coupling**: Trivial to lift; needs to become a real append-only server-side table with user attribution instead of a localStorage array capped at 100 entries.

### Item 10
- **name**: Leading-indicator composite
- **path**: /home/user/catcorner22/precog/src/lib/precog/ml/leading-indicators.ts
- **why reusable**: 9 named indicators each with a value, threshold, ok/watch/breach status, weight, a 'why' sentence, and a linked tab. This is a clean, explainable early-warning panel and the pattern generalizes directly to real PMS signals (adjustment rate, refund velocity, void count, days-to-deposit, unreconciled balance age).
- **quality**: solid
- **coupling**: Calls portfolioSummary(staff) and the argument-free assessCoso(); the COSO input is therefore a constant today.

### Item 11
- **name**: Educational knowledge corpus
- **path**: /home/user/catcorner22/precog/src/lib/precog/rag/corpus.ts
**why reusable**

16 tagged, sourced chunks covering COSO components, control activities for small teams, monitoring, three-way SoD, the dental cash path, the fraud triangle, detection lag, Lean waste, SPOFs, insurance transfer, shadow AI, residual-appetite language, write-off controls, vendor master risk, and leading indicators. Directly usable as in-product remediation guidance and tooltip copy without any LLM involved.

- **quality**: solid
- **coupling**: None — plain data array.

### Item 12
- **name**: Practice context bidirectional-sync pattern
- **path**: /home/user/catcorner22/precog/src/lib/precog/practice-context.tsx
**why reusable**

Demonstrates the non-obvious requirement that a control fact (dual control is on) must stay consistent across three representations at once — the staff composition flag, the insurance variable boolean, and the dual-release policy master switch — with every setter reconciling all three. A merged PMS will have the same problem across many more surfaces; the pattern is worth studying even though the implementation should become server-derived.

- **quality**: prototype
- **coupling**: React context + localStorage. The right target architecture derives all three from one server-side control-configuration record instead of syncing three copies.

## Weaknesses

- EVERYTHING IS BOUND TO demo-data.ts AT MODULE SCOPE. 21 files import frozen singletons (people, controls, knowledge, relations, processes, scenarios, staffComposition, crimeFraudStats). There is no repository, no dependency injection, no query layer, and no multi-tenant concept anywhere in the engine. Porting this into a PMS is a rewrite of the data plumbing, not a copy.
- assessCoso() IN /home/user/catcorner22/precog/src/lib/precog/coso.ts TAKES NO ARGUMENTS and reads demo staffComposition and controls directly. The COSO heat map therefore does NOT respond to the user's configured practice profile — turning dual control on in the UI changes the residual portfolio but leaves every COSO component score identical. coso-heatmap.tsx compounds this with useMemo(() => assessCoso(), []). Because ml/features.ts and ml/leading-indicators.ts both call assessCoso(), the coso_overall feature and the li_coso_monitor indicator are constants.
- findKnowledgeRisks() in engine.ts also takes no arguments and always returns demo SPOFs; detectSodConflicts defaults to buildAssignments() over demo people; dual-release's personById/listEligibleApprovers read demo people. Only StaffComposition, RiskVariableState, and DualReleasePolicy are actually user-editable.
- DOUBLE BOOKKEEPING WITH A LIVE INCONSISTENCY: staffComposition.soleOwnerKnowledgeCount is a hand-entered 2, but findKnowledgeRisks() over the same demo data yields 4 sole-owner critical/important items (k1 appeals, k3 PMS admin, k4 vendor approval, k6 payroll exceptions). The staff-uplift factor uses the hand-entered 2 while the COSO and SPOF panels use the derived 4. Same for segregationScore (hand-entered 42) versus the derived segregationHealth from detectSodConflicts — two different segregation numbers coexist with no reconciliation.
- TIMELINE SIGN CONFUSION. In engine.ts, staffRiskMultiplier > 1 for a WEAK practice multiplies timelineMult UP, producing a LONGER p50. rankDangerousScenarios then scores danger as (...) x (1 / max(14, p50)), so weaker controls make a scenario look LESS urgent through the time channel. Meanwhile residual-engine's scenario branch computes timeNorm = 1 - p50/240 and treats a SHORTER p50 as higher inherent risk, and variable-cascade declares timelineP50 in HIGHER_IS_BETTER with the comment 'longer is better (delay material impact)'. Concretely: enabling independent bank rec sets detectionLagMultiplier to 0.75 which SHORTENS p50, so the cascade delta table will render 'Timeline p50 (days)' as WORSENS for the single highest-ROI control the product recommends — directly contradicting that same lever's own affects string, 'timeline p50 stretches (slower material impact)'.
- INHERENT-RISK FACTORS ARE DERIVED BY SUBSTRING MATCHING ON CONTROL IDs (residual-engine.ts lines ~105-111): c.id.includes('sod'), .includes('cash'), .includes('ap'), .includes('ar'). Any real control whose identifier happens to contain those two-letter sequences gets misclassified as high fraud-opportunity or high exposure. scenarioFlags() in dynamic-variables.ts and fraudMultiplier() in engine.ts do the same on scenario ids. Risk classification must become explicit typed fields.
- THE '95% CI' IS NOT A CONFIDENCE INTERVAL. p50/p95Low/p95High are hand-authored constants in demo-data scenario templates, linearly scaled by a product of multipliers. There is no sampling, no distribution, no fitting, no uncertainty propagation. p95High is floored at p50+5 to keep the interval from inverting. The assumptions array does disclose this honestly, but the UI label 'p50 / 95% CI' will read to a buyer as statistical inference.
- THE ml/ DIRECTORY CONTAINS NO MACHINE LEARNING. anomaly.ts is a one-sided weighted z-sum against a hand-written HEALTHY_PRIOR table with no cited empirical basis; it self-labels 'Mahalanobis-lite' but has no covariance matrix. features.ts is a hand-built 22-dim vector. forecast.ts is deterministic linear drift plus an exponential blend with hard-coded coefficients (0.92/0.08, drift = 0.15 + pressure/200 + band bonus). leading-indicators.ts is a weighted threshold composite. Nothing is trained, fitted, validated, or backtested. Naming this 'ml' invites a claim the code cannot support.
- stats/README.md DOCUMENTS THREE FILES THAT DO NOT EXIST: benford.ts, forensic-suite.ts, demo-transactions.ts. Repo-wide grep for 'benford' returns zero hits. The forensic-screening capability (Benford conformity, MAD outliers, round-number bias, duplicate detection, deposit-gap heuristics) — arguably the single most valuable thing for a PMS that will hold real ledger data — is aspiration only.
- src/routes/index.tsx IS A BROKEN 32-BYTE PLACEHOLDER containing the literal text 'SEE_FILE_/tmp/index_restored.tsx' with no newline. The referenced file does not exist. The app's home route cannot compile. The most recent commit (203ed30) is titled 'Restore index.tsx with Command UI + Threat Assessment link to /threat', so the restore was truncated and never verified.
- ZERO TESTS, ZERO CI. No vitest/jest, no *.test.* or *.spec.* files, no .github directory. For a codebase whose entire value is arithmetic — where a single flipped comparison silently produces a wrong risk score with no visible error — this is the largest single quality gap. There are Playwright smoke scripts (scripts/browser-smoke.mjs) that only prove the page loads and capture a PNG.
- NO SERVER-SIDE PERSISTENCE OF ANY RISK STATE. migrations/ contains exactly one file (0001_auth.sql, the better-auth schema). The entire practice profile, dual-release policy, and decision journal live in browser localStorage. Clearing site data destroys the audit trail. Two browsers on the same desk hold divergent control configurations.
- NO AUTHORIZATION ANYWHERE IN THE RISK PATH. src/lib/auth/verify.server.ts exists but nothing under src/lib/precog imports it. runPioneerCoach (coach/pioneer-server.ts) is an unauthenticated POST server function that accepts arbitrary staff and riskVariables overrides and a 1500-char free-text question and forwards to Grok. src/routes/threat.tsx renders the full threat assessment with no gate.
- PERFORMANCE IS QUADRATIC-ISH BY CONSTRUCTION. portfolioSummary() runs every scenario through runPrecogScenario; tornadoSensitivity() calls portfolioSummary 6 times; simulateCascadeLever() snapshots twice (each a full portfolio + scenario run); simulateAllCascades() runs 12 levers = 24 snapshots; forecastResidualTrajectory() calls simulateCascadeLever per lever plus scoreAnomalies (which itself calls portfolioSummary and assessCoso). Nothing is memoized. Trivial on 4 scenarios and 11 controls; pathological on a real practice with hundreds of controls and thousands of transactions.
- MAGIC CONSTANTS OUTSIDE THE VERSIONED WEIGHT TABLE. weights.ts admirably centralizes the residual weights, but coso.ts (72, 78, 12, 10, 8, 15, 6), detect.ts scoreConflict (88/72/55/48, 18, 6, 28, 8, 5), map-vision scorePriority (0.55/0.45/8, band cutoffs), threat-scoring (heat 92/78/55, /2000, /1500, /4), dynamic-variables (every multiplier), and forecast.ts drift coefficients are all inline and unversioned. Changing them silently changes every historical score with no provenance.
- process-graph.ts LINKS RESIDUAL SCORES TO PROCESSES BY NAME-TOKEN SUBSTRING MATCH (tokens of the process name length > 3 tested against residual item names), with a control-id fallback. This is a guess, not a relationship, and will mis-attribute risk on any realistic naming scheme.
- THE MILITARY SKIN IS A COMMERCIAL LIABILITY. 'WHITE HOT', 'Terminator threat scan', 'Predator thermal', 'AO', 'mission brief', 'rules of engagement', 'target deck' applied to an analysis whose inputs include named employees and their tenure. The code is careful to caveat that it never scores people, but the vocabulary undercuts the caveat in exactly the setting (an owner suspecting staff) where the framing matters most.
- MITIGATION STACKING IS MAX(), NOT COMBINED. runPrecogScenario takes reduction = max over selected mitigations, so selecting 'cross-train billing' (0.55) plus 'record the playbook' (0.35) yields 0.55, identical to selecting the first alone. The compare UI offers a 'Selected package' column that therefore cannot show the benefit of a package over its strongest member.
- DUAL-RELEASE waive_dual RETURNS thresholdUsd = Number.POSITIVE_INFINITY, which flows into a ReleaseEvaluation field and into template strings via toLocaleString(); the below_threshold branch special-cases Infinity but the field is still typed as a plain number and can leak '∞' into UI or serialized state.
- THE INSURANCE MODEL HOLDS PREMIUM CONSTANT WHEN DEDUCTIBLE OR LIMIT CHANGES. The code discloses this in secondOrderNotes, but it means the deductible/limit levers systematically overstate the case for a high deductible and understate the cost of a high limit — the opposite of how carriers actually price.
- LLM CONTEXT PACK SENDS EMPLOYEE NAMES OFF-PLATFORM. coach/context-pack.ts includes spofs[].owner (a person's actual name) and the full staffComposition; agent-loop.ts sends this to Grok when XAI_API_KEY is set. Today the names are fictional demo staff; in a real deployment they are real employees attached to fraud-risk language.

## Phi security observations

- THE PRECOG ENGINE HOLDS NO PHI TODAY AND WAS NOT DESIGNED TO. Its entire input surface is people (name, role, tenure), knowledge items, controls, scenario templates, staff composition, and insurance variables. There is not a single patient, appointment, chart, claim, or ledger entry anywhere in src/lib/precog. That is a clean starting point — but it also means none of the safeguards a PHI-holding system needs have ever been exercised in this code.
- NO AUTHORIZATION CHECK IN THE ENGINE OR ITS ROUTES. src/lib/auth/verify.server.ts exists and is referenced in the migration header comments as the intended pattern, but grep shows nothing under src/lib/precog imports it. runPioneerCoach in coach/pioneer-server.ts is an unauthenticated createServerFn POST; src/routes/threat.tsx renders the full assessment with no gate; src/routes/__root.tsx wraps everything in AuthProvider but enforces nothing.
- NO TENANCY MODEL AT ALL. There is no practice_id, org_id, or user_id anywhere in the engine types (types.ts) or the profile (practice-profile.ts). Every scoring function reads process-global singletons. A multi-practice PMS needs row-level scoping on every one of these entities from day one; retrofitting tenancy onto module-scope singletons touches all 21 importing files.
- ALL RISK STATE IS IN BROWSER localStorage (key 'precog.practiceProfile.v2', practice-profile.ts). Unencrypted, unscoped to any user, survives logout, readable by any script on the origin. The decision journal — the audit artifact — lives there too, capped at 100 entries with no server copy. In a PHI system this pattern must be replaced entirely, not hardened.
- THE SINGLE MIGRATION (migrations/0001_auth.sql) IS BETTER-AUTH IDENTITY ONLY: user, session, account tables. There is no application schema, so there is no encryption-at-rest decision, no audit-log table, no retention policy, and no BAA-relevant data map to inherit. The header comment does prescribe the right pattern for future tables (snake_case, user_id TEXT NOT NULL, scope every query server-side).
- THIRD-PARTY LLM EGRESS IS THE PRINCIPAL PHI RISK VECTOR IN THE PORT. agent-loop.ts reads process.env.XAI_API_KEY and calls Grok; coach/context-pack.ts assembles a pack that already includes named individuals (spofs[].owner resolves to a Person.name) alongside fraud-risk framing. Today those are demo names. In the merged PMS, if the controls engine is fed real ledger and roster data and the same coach is pointed at it, employee names and financial detail cross an external boundary. The market research explicitly flags this as a competitive question ('whether an AI compliance assistant routes patient context through third-party LLM APIs' — Patient Protect on rivals). Smile Notes' existing PHI-gate pattern is the right precedent to apply here.
- PROMPT-INJECTION SURFACE VIA UNVALIDATED FREE TEXT. runPioneerCoach's validator only trims and slices (question to 1500 chars, practiceName to 80). If a merged PMS lets the engine ingest ledger memos, adjustment reason codes, or vendor names — all attacker-influenceable strings — and those flow into the coach context, there is no sanitization layer between them and the model.
- NO AUDIT LOGGING OF CONTROL CHANGES. Turning dual release off, waiving a threshold, or accepting residual risk are exactly the events an investigator needs a tamper-evident record of. Today they mutate a localStorage blob. dual-release.ts already models the right metadata (approvedByPersonId, createdAt, reason, residualNote, effectiveFrom/effectiveTo) — it just has nowhere durable to write it. This is a small amount of work with outsized compliance value.
- DUAL RELEASE IS ADVISORY, NOT ENFORCING. evaluateRelease() returns a verdict object that a panel renders. Nothing prevents an action. The research draws exactly this distinction for HIPAA platforms ('recorded vs. enforced — does the workflow refuse to move PHI until a BAA is signed, or merely log that it should be?'). The same test applies to money: in the merged PMS, evaluateRelease must run server-side inside the transaction path and be able to REFUSE a refund, write-off, or ACH — never in the client.
- THE ENGINE IS ENTIRELY CLIENT-SIDE, SO ALL SCORING LOGIC AND ALL WEIGHT TABLES SHIP TO THE BROWSER. Not a PHI leak in itself, but it means thresholds are visible and, more importantly, that a client-computed 'you may release this payment' verdict is trivially bypassable if it is ever treated as authorization.
- POSITIVE: THE ENGINE IS PURE AND SYNCHRONOUS WITH NO I/O. No fetch, no fs, no logging of inputs, no telemetry in any scoring module. That makes it straightforward to relocate wholesale behind a server boundary, and it means there is no existing accidental-exfiltration path to hunt down.
- POSITIVE: NO SECRETS IN THE ENGINE. The only environment read in the entire precog tree is process.env.XAI_API_KEY, and it is read exclusively in server-side files (agent-loop.ts line 754, pioneer-server.ts line 88), never in a client module.
- POSITIVE: EXPLICIT ANTI-ACCUSATION GUARDRAILS ARE ALREADY IN THE CODE AND THE PROMPT. threat-scoring.ts caveats ('It never labels individuals as threats; targets are control gaps and residual exposures'), the pioneerSystemPrompt rule ('Never accuse staff of fraud. Score control design and residual risk only'), the conflict-rules header ('Educational control design — not a legal compliance product'), and the stats README ('Never use results to accuse individuals'). For a product that will watch employee behavior over real money, this posture is a genuine asset and should be carried forward verbatim.
- POSITIVE: scripts/browser-guard.mjs shows real security awareness in the tooling — it restricts Playwright targets to http/https loopback and PNG output under /workspace specifically because the scripts run Chromium as root with --no-sandbox and would otherwise render file:///root/.grok/auth.json into a readable screenshot.

## Product insights

- THE CORE PRODUCT THESIS IS VALIDATED BY THE OWNER'S OWN RESEARCH AND IS ALREADY HALF-BUILT. Report line 310: 'no mainstream product for small businesses interactively assesses the owner's operation and then recommends and tailors financial and operational internal controls.' The interactive-assessment pattern (question → score the gap → generate tailored policy → track remediation) is proven in HIPAA (Abyde, Patient Protect), safety (SmarterRisk), and cyber (Vanta). Precog is that loop for financial controls, and it exists in code. A PMS that ships it natively is the only place it can actually be enforced rather than merely recommended.
- THE KILLER STRUCTURAL ADVANTAGE OF MERGING: a standalone controls product (Zeldent, Prosperident) can only observe; a PMS can PREVENT. Every SoD conflict precog detects maps to a permission the PMS itself grants, and every dual-release rule maps to a transaction the PMS itself executes. detectSodConflicts already accepts an assignments array — feed it real PMS role grants and the conflict report becomes live rather than modelled. evaluateRelease already returns a blocking verdict — run it server-side in the refund/write-off/ACH path and the control is enforced, not documented.
- THE ADA/PROSPERIDENT DATA IS THE ENTIRE SALES ARGUMENT AND IT POINTS AT DESIGN, NOT DETECTION: 48% of dentists embezzled, average loss ~$105-109k, only 17% of thefts found by the practice's planned controls and 83% by chance, median scheme duration 18 months. A product that turns 'caught by chance' into 'caught by design' is selling against a number every dentist has heard. precog's detection-lag modelling (independent bank rec cuts detection lag 25%) is the mechanism that story needs.
- PRICING BAND IS ALREADY MAPPED BY THE RESEARCH: $39-115/month (Patient Protect $39/$99, Abyde from $115), $499-1,200/year (Medcurity, SmarterRisk), $3,000+/year coach-led. A controls module attached to a PMS can be priced inside that band as an add-on, or used as differentiation on the base seat — and unlike the standalone HIPAA vendors it needs no separate onboarding because the PMS already knows the roles, the ledger, and the schedule.
- THE INSURANCE-CREDIT LINKAGE IS AN UNDER-EXPLOITED COMMERCIAL HOOK. dynamic-variables.ts models the same control (dual release, independent bank rec, cameras, bonded handlers) simultaneously reducing residual risk AND unlocking a carrier premium credit under a stacking cap. That converts 'you should add a control' into 'this control pays for itself at $X/year in premium plus $Y in expected retained loss' — the exact framing SmarterRisk uses successfully for workers' comp. dual-release.ts even computes insuranceDiscountEligible and correctly revokes it when an active waive_dual exception exists.
- 'READING THE MONEY' IS THE #1 UNMET NEED AND IT IS A CONTROLS PROBLEM, NOT A UI PROBLEM. Report line 177: no harvested review praises any product for AR clarity after dual coverage and partial payments; CareStack transfer adjustments ('accounting team HATES it'), Open Dental allocated/unallocated/hidden payment logic, Curve invoice-vs-ledger, Oryx estimated write-offs. Line 319 closes the loop: 'A ledger that staff cannot read is a ledger an owner cannot audit.' The reviewer of the research explicitly moved 'reporting that reconciles to the bank' UP the priority list. Bank-to-ledger reconciliation is the single feature that serves both the daily-usability complaint and the fraud-control gap.
- THE DECISION JOURNAL IS THE DEFENSIBLE ARTIFACT AND IT IS ALREADY DESIGNED. DecisionEntry captures {subject, accept_residual|remediate|monitor|insure, note, reviewBy, residualAtDecision, linked evidence}. Recording the residual score AT THE MOMENT OF THE DECISION plus a review date is precisely what COSO Principle 17 expects and what an owner needs when an insurer, a CPA, or opposing counsel asks 'what did you know and when.' No competitor PMS has this.
- EXPLAINABILITY IS THE PRODUCT, NOT A FEATURE. Every score in the engine carries ranked RiskDrivers with plain-language detail, a SCORING_VERSION stamp, an explicit assumptions array, and a band with prescriptive guidance ('Do not accept residual risk without owner sign-off'). Compare to the research's complaint that competitors ship 'overwhelming reports.' A number an owner can interrogate beats a dashboard they cannot.
- THE THREE-VERB VOCABULARY IS EXCELLENT PRODUCT DESIGN: remediate / compensate / accept-on-purpose. It matches how COSO actually works for a 6-person office where full SoD is arithmetically impossible, and it gives the owner a legitimate, documented option other than 'fix it' — which is what makes the tool usable rather than nagging. The corpus chunk 'coso-control-activities' states it directly: when team size prevents full SoD, COSO still expects compensating controls plus documented residual acceptance with review dates.
- THE ROLE_TEMPLATES IN sod/detect.ts ARE A READY-MADE PMS PERMISSION MODEL AND ALSO A DIAGNOSIS. Owner/Dentist, Office Manager, Front Desk Lead, Hygienist, Dental Assistant, Billing Specialist — and the Office Manager template deliberately holds 10 entitlements including create_vendor + release_payment + approve_writeoffs + pms_admin_roles, which is both realistic for a small practice and an immediate critical-conflict generator. Shipping these as default PMS roles with the conflicts pre-flagged turns setup into the assessment.
- THRESHOLD EXCEPTIONS ARE THE FEATURE THAT MAKES THE CONTROL SURVIVE CONTACT WITH REALITY. A rigid $150 write-off rule gets disabled the first week. dual-release.ts instead models the trusted recurring lab payee (raise to $3,500, payee-scoped, owner-approved, with a residual note and a monthly sampling instruction), the vacation-cover temporary raise (person-scoped, date-bounded, auto-expiring), and an optional strict mode (force dual under $500 for first payments). activeExceptionSummary() surfaces raises/waives/expiringSoon so exceptions cannot quietly become permanent. This is mature control design.
- THE ENGINE ALREADY NAMES THE GAP IT CANNOT FILL. COSO Principle 9 is hard-coded 'weak' with the note 'Staff exits and role changes are not yet monitored as control-change events,' and Principle 11 is 'PMS role design assumed; re-check access when staff change.' In a merged PMS both become automatic: a role grant or a termination IS a control-change event the system observes. Those two principles go from permanently-weak to continuously-monitored purely as a consequence of the merge.
- DEEP-LINKED EVIDENCE IS THE ANTIDOTE TO 'CLICK-HEAVY UI' AND 'OVERWHELMING REPORTS.' Every COSO finding carries a DeepLinkTarget and every threat target carries reasons plus ROE steps. Finding → evidence → action in one click is the interaction model; it should be a hard rule in the merged product that no score is ever displayed without a path to the underlying records.
- PROCESS/KNOWLEDGE CONTINUITY (SPOF) MAPPING IS A GENUINELY DIFFERENTIATED SECOND ACT. The knowledge model (person x knowledge at expert/proficient/basic/aware, criticality, linked processes, sole-owner detection) addresses key-person risk — the front desk lead who is the only one who can appeal a denial. Practices feel this constantly and no PMS touches it. It also composes with the schedule and roster data the PMS already holds.
- THE LEAN LAYER (muda/mura/muri tags on process nodes) IS REAL BUT SECONDARY. It is well-modelled in types.ts and demo-data, and it feeds the process map, but it is thin relative to the controls content and should not compete for roadmap priority against ledger reconciliation.

## Test and ci posture

"Effectively nonexistent, and this is the single largest engineering gap. No test framework is installed — package.json has no vitest, jest, or test script; the only scripts are dev, build, db:migrate, build:dev, preview, typecheck (tsc --noEmit), lint (eslint), format (prettier). A repo-wide search for *.test.* / *.spec.* returns nothing outside eslint.config.mjs and vite.config.ts. There is no .github directory and therefore no CI of any kind: no automated typecheck, no lint gate, no build verification on commit. node_modules is not installed in this checkout, so even the local typecheck cannot be run without a network install.\n\nWhat does exist is browser smoke tooling: devDependency playwright plus scripts/browser-smoke.mjs (headless Chromium load of http://127.0.0.1:8080, capture PNG, exit 0 on success / 1 on navigation failure / 2 if console errors) and scripts/browser-guard.mjs (restricts targets to http/https loopback and PNG output under /workspace, explicitly because the scripts run Chromium as root with --no-sandbox and would otherwise render file:///root/.grok/auth.json into a readable screenshot). That proves the page loads; it asserts nothing about a single number the engine produces.\n\nThe absence of tests is disproportionately serious here because the entire product is arithmetic with no observable failure mode. A flipped comparison in bandForScore, a sign error in the timeline multiplier (there is one — see weaknesses), or a wrong weight in CONTROL_EFFECTIVENESS_WEIGHTS produces a plausible-looking wrong score with no crash, no console error, and no way for a user to notice. The engine is unusually easy to test — every scoring function is pure, synchronous, dependency-free apart from the demo singletons, and returns plain data — so the cost of fixing this is low and the payoff immediate.\n\nEvidence that the missing CI already caused damage: src/routes/index.tsx is a 32-byte file containing the literal string 'SEE_FILE_/tmp/index_restored.tsx' pointing at a nonexistent /tmp path, so the application's home route cannot compile. The most recent commit (203ed30) is titled 'Restore index.tsx with Command UI + Threat Assessment link to /threat' — the restore was truncated and shipped, and nothing in the repo would have caught it.\n\nMinimum bar before any of this logic is trusted with real money in the merged PMS: (1) golden-value tests pinning residual, band, and driver output for each demo control/knowledge/scenario against the current SCORING_VERSION, so weight changes become visible diffs rather than silent drift; (2) property tests asserting monotonicity — adding a compensating control, enabling dual release, or raising the segregation score must never increase residual, and the timeline sign convention must be asserted in one direction and held; (3) a full truth table over evaluateRelease covering all 9 ReleaseStatus values, exception precedence when multiple exceptions match, the Infinity/negative-threshold edge cases, and same-person and wrong-role rejection; (4) exhaustive SoD detection over every ROLE_TEMPLATE pair asserting expected rule ids and family fallbacks; (5) retainLoss boundary cases at gross < deductible, gross = deductible + limit, and gross above the tower with nonzero coinsurance; (6) CI running typecheck + lint + tests on every push."

## Open questions

- How should the engine consume REAL PMS data instead of a demo profile? The concrete mapping is clear and should be specified before any port: PMS role/permission grants → RoleAssignment[] fed directly into detectSodConflicts (it already accepts an assignments override, so this is the shortest path to a live conflict report); actual user accounts and terminations → Person[] and an automatic re-scan on every role change (which finally makes COSO Principle 9 'assess change' pass); ledger adjustments, write-offs, refunds, voids, and credits → transaction stream driving both the write-off dual-release channel and the missing Benford/forensic screen; deposit records vs. day-sheet collections vs. bank feed → the independent-bank-rec control, currently a boolean the owner self-asserts, becomes a measured reconciliation status with an actual detection-lag number instead of the modelled ×0.75; vendor master changes and ACH releases → the vendor_new and ach channels with real payee strings for the payeeContains exception matcher; schedule changes and appointment deletions → a new entitlement class the current rulebook does not cover at all; claims submissions and denial write-offs → rule-claims-writeoff, which currently has no data behind it. Which of these lands in v1?
- StaffComposition is the biggest conceptual problem in the port. Four of its six fields (teamSize, soleOwnerKnowledgeCount, avgTenureYears, segregationScore) become DERIVED quantities in a real PMS — team size from the roster, sole-owner count from the knowledge map, tenure from HR dates, segregation score from detectSodConflicts' own segregationHealth. Today they are hand-entered and already inconsistent with their derived counterparts (soleOwnerKnowledgeCount is 2 while findKnowledgeRisks yields 4). Does StaffComposition survive as a computed view, or does the whole staff-uplift stage get re-expressed against derived inputs?
- Should the residual model shift from configuration-based to evidence-based scoring? Today control effectiveness is inferred from booleans and compensating-control string counts. With real data it could be measured: what fraction of write-offs over $150 actually had a second approver; how many days between transaction and reconciliation; how many ACH releases used the same person for both signatures. That is a materially stronger product (and a defensible one), but it is a different model — control OPERATING effectiveness rather than control DESIGN effectiveness — and COSO distinguishes them. Does the merged product score both?
- How is the timeline sign convention resolved? engine.ts makes weak controls produce a LONGER p50 while residual-engine treats a shorter p50 as worse and variable-cascade declares longer better — so enabling independent bank rec currently renders as 'worsens' on the timeline metric. Is p50 'time until a scheme becomes material' (weak controls should shorten it) or 'time until it is detected' (weak controls lengthen it)? Pick one, name the field accordingly, and assert it in a test.
- Can the p50/95% interval be made real? Today the base timelines are hand-authored constants scaled by multipliers. With PMS transaction history a practice-specific detection-lag distribution is computable, and Monte Carlo over the multiplier chain would give a genuine interval. Is that in scope, or does the product keep the honest 'educational projection' framing and drop the 'CI' language?
- What is the actual policy for LLM egress once real ledger and roster data feed the engine? The Grok coach currently receives named individuals alongside fraud-risk framing. Options: strip all names and use role labels; run the coach only over aggregate scores; gate it behind an explicit per-practice opt-in like Smile Notes' PHI gate; or self-host. The research flags this as a live competitive question in the adjacent HIPAA market.
- Should the forensic layer promised by stats/README.md (Benford first/second-digit with chi-square and MAD conformity, round-number bias, duplicate detection, deposit-gap heuristics) be built for v1? It is the highest-value capability for a system that will finally hold real transaction data, it is well-understood, it is cheap to implement, and it is exactly what Zeldent sells. It is also the piece most likely to be misread as an accusation, so it needs the strongest framing discipline.
- How much of the residual/insurance model is defensible enough to show a paying customer? Every multiplier (dual control ×0.72 likelihood, bank rec ×0.75 detection lag), the discount percentages, the HEALTHY_PRIOR means and stds, and crimeFraudStats.industryEmbezzlementRate = 0.18 are illustrative and self-labelled as such. Options: keep them with prominent 'directional estimate' framing; recalibrate against the ACFE/ADA/Prosperident figures the research already cites (48% victimization, 18-month median scheme duration, ~$105-109k average loss, 83% discovered by chance); or make weights per-tenant configurable by a CPA.
- Should the ml/ directory be renamed and re-scoped? Nothing in it is learned. Either rename to 'analytics' or 'signals' and keep the honest classical statistics (which are perfectly good), or invest in something actually fitted once there is transaction data — anomaly detection on adjustment velocity per user, for instance, would be genuine and valuable. Shipping 'ML' that is a z-score table against a hand-written prior is a claim the code cannot defend.
- Does the Predator/Terminator/WHITE HOT/rules-of-engagement skin survive into a commercial product? The underlying prioritization is sound and the code is scrupulous about never scoring people, but the vocabulary works against that guarantee in precisely the emotionally loaded situation the tool exists for. A neutral 'priority queue' vocabulary loses nothing analytically.
- Where does the enforcement boundary sit? evaluateRelease must move server-side and be able to REFUSE a refund, write-off, or ACH inside the transaction — the 'recorded vs enforced' distinction the research draws for HIPAA platforms applies identically to money. That is a significant architectural commitment (every money-moving path routes through a policy check) and it should be decided before the port, not after.
- What is the audit-log design? Control changes, threshold waivers, and residual acceptances need a tamper-evident, append-only, user-attributed record with retention. dual-release.ts already models the right fields (approvedByPersonId, createdAt, reason, residualNote, effectiveFrom/effectiveTo) and practice-profile.ts models DecisionEntry — they just need a real table and a write path. Is this v1 or later?
- What is the per-practice configurability story for the rulebook itself? A practice with an external bookkeeper, a two-location DSO, or a spouse doing the books has a different conflict set. Are CONFLICT_RULES, ROLE_TEMPLATES, and DEFAULT_DUAL_RELEASE_RULES seeded defaults that a practice (or its CPA) can edit and version, or fixed product opinion? Versioned-and-editable is the stronger answer but needs a migration story for scores computed under an older rulebook, alongside the existing SCORING_VERSION stamp.
- Is the process/knowledge/Lean layer (process-graph.ts, ProcessNode with risks/ideas/wastes, the knowledge SPOF map) in scope for the merged PMS, or is it a separate later module? The knowledge/SPOF half is genuinely differentiated and composes with PMS roster data; the Lean waste half is thinner and competes for roadmap space against ledger reconciliation, which the research says matters more.
