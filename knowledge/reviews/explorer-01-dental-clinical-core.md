# Explorer report 1: dental-clinical-core

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 1 (Understand phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, explorer, dental-clinical-core

## Summary

The clinical documentation core of the `dental` repo (product "Smile Notes") is a deterministic, schema-driven dental note builder with an unusually rigorous audit engine layered on top of it. Roughly 34,000 LOC across `src/lib/{modules,vocab,audit,standardize…

## Scope

dental-clinical-core

## Summary

The clinical documentation core of the `dental` repo (product "Smile Notes") is a deterministic, schema-driven dental note builder with an unusually rigorous audit engine layered on top of it. Roughly 34,000 LOC across `src/lib/{modules,vocab,audit,standardize,extract,assist,verify,dictation}` and `src/components/builder`, of which about half is test code. The pipeline is: 33 JSON-serializable `ModuleDef` objects (Universal Core, always on, plus 32 add-ons) drive form rendering, note composition, and audit rules from one source of truth; a `NoteState` of `{moduleId}.{fieldId}` values is composed into markdown-safe text; a pure `runAudit(ctx)` produces an `AuditReport` of S0–S4 findings; `computeGates()` converts that report into export/email permissions. Everything below the UI is a pure function, isomorphic (client and server run the same code), and versioned by `RULESET_VERSION` with a CI guard that fails a PR touching rules/vocab/modules without a bump.

The domain IP is genuinely deep and, more importantly, *documented in-line at a level I have rarely seen*. `src/lib/vocab/teeth.ts` is a complete ADA Universal tooth table (permanent 1–32, primary A–T, supernumerary 51–82 and AS–TS) with derived FDI secondary display, per-tooth allowed-surface logic (anterior I/F vs posterior O/B), quadrant/arch/side/class metadata, and chart display orders. `src/lib/vocab/shorthand.ts` (109 entries) and `abbreviations.ts` encode a first-use-expansion convention, an explicit ambiguity set that is never auto-expanded (GP, CR, ASA, PA), ISMP/Joint Commission do-not-use constructs that are flagged and *deliberately never expanded* ("expanding a dangerous abbreviation launders it"), and a `pluralExpansion` field that exists because a singular expansion of "SSCs" silently changed a count in a legal record. `src/lib/audit/rules/` contains 18 rule families including a curated dental drug-interaction screen with avoidance-cue demotion, a Tennessee CSMD/PMP opioid gate, weight-unit and dose-reconciliation checks that refuse to compute a dose, anticipatory completeness rules derived from published malpractice claim-file research, billing-narrative justification rules (SRP evidence, buildup retention, crown necessity), and an effective-dated supervision rule for TN Public Chapter 1107 that takes the audit date as an *input* so the engine stays pure.

The read-only extraction layer (`src/lib/extract/`) is the most novel piece: a documented EBNF clause grammar that turns staff shorthand into `ClinicalFact` objects carrying spans into the original text plus a ConText-style assertion (`polarity` assigned, `temporalityHint` only ever hinted because published recall on "historical" is 67%). It never returns text and never edits a note — the invariant is stated at the top of `facts.ts` and is what makes the odontogram (`src/lib/extract/chart.ts` + `src/components/builder/Odontogram.tsx`) safe: the chart is a *readback*, not a charting widget, so a transposed "#14 → #41" becomes a mark in the wrong quadrant instead of an invisible string difference. Measured clause coverage went 26.2% → 94.6% and is ratcheted by `coverage.test.ts`.

The AI layer is deliberately small and caged. `runAssist()` in `src/lib/assist/service.ts` is a single doorway: PHI gate (every `phi` finding blocks, not just S0) → practice-standards retrieval → injected model → JSON-schema validation → `verifyMeaning()` (14 typed rejection codes covering digits, negation scope, teeth, units, drugs, attribution, laterality, surfaces, fabrication) → human review. `capabilityTier()` makes capability follow *licence*, not just deployment config, and every capability has a shipped deterministic twin so "AI off" never means "feature gone". `src/lib/assist/non-goals.ts` writes down four permanently-refused capabilities with enforcement tests. Maturity is high for a solo-built product: 201 test files, 16 Playwright-style e2e scripts, a precision-eval harness with a zero-false-block target over a 34-note hazard corpus, and adversarial red-team suites for the verifier. The one structural fact that changes everything for the merged PMS: this product is de-identified *by construction* and holds no patient record, so the PHI gate, the mask tool, the "identifiers belong only in the EDR" messaging, and the `patient-history-crossref` non-goal all invert when the new product legitimately holds PHI.

## Architecture

DATA FLOW (note authoring)
1. `ALL_MODULES` (/home/user/catcorner22/dental/src/lib/modules/index.ts) exposes 33 `ModuleDef`s sorted by `order`; `activeModules(selectedIds)` returns universal-core (`alwaysOn`) plus chosen add-ons. `moduleMatches()` searches title+id+description (added because "TMD" matched no title).
2. `BuilderShell` (/home/user/catcorner22/dental/src/components/builder/BuilderShell.tsx, 2127 LOC) is the single client entry point. It owns `NoteState` via `noteReducer`, autosave, draft backup, conflict handling, PHI override, submit, and lazily `import()`s the audit engine after mount (~180 KB) — until it lands, `AUDIT_PENDING_REPORT` is used and **all gates stay closed** rather than showing a false pass.
3. `NoteForm` (/home/user/catcorner22/dental/src/components/builder/NoteForm.tsx) renders sections/fields from the `ModuleDef`, evaluating `visibleIf`/`requiredIf` through `src/lib/schema/conditions.ts`. Field renderers live in `src/components/builder/fields/` (inputs.tsx, ToothPicker.tsx, SurfacePicker.tsx, DictationField.tsx, BlockChips.tsx).
4. `composeNote()` / `composeNoteText()` (/home/user/catcorner22/dental/src/lib/compose/composeNote.ts) walk modules in canonical order, omit empty optional fields, and run `sanitizeUserText()` — an inverted-allowlist markdown-injection guard (escapes `<` everywhere, clamps leading whitespace to 3, escapes heading/fence/setext/thematic-break starters) because the frozen note is emailed as a `.md` attachment where a forged "Submission record" heading would be believed.
5. `runAudit(ctx)` (/home/user/catcorner22/dental/src/lib/audit/engine.ts) = state rules (`required`, `supervision`, `anatomy-state`, `measurement`) + `runTextAudit(composedText)` (13 text rule families) + per-field spelling (single shared budget across all fields) + plain-language over `audience: "patient"` fields, then `tailorAuditFindings()` suppresses dentist-judgement coaching for auxiliaries. `buildReport()` sorts S0→S4, counts, extracts `phiStops`, derives `OverallStatus`.
6. `computeGates(report, phiOverridden)` → `{exportAllowed, emailAllowed}`. Any unresolved S0 blocks copy/download; a PHI S0 is the *only* waivable stop (attested override dialog); email additionally requires zero S1.

KEY ABSTRACTIONS
- `ModuleDef`/`SectionDef`/`Field` (/home/user/catcorner22/dental/src/lib/schema/types.ts, 145 LOC): the whole clinical schema in 145 lines. Field types: select, multiselect, text, textarea, toothPicker, surfacePicker, measurement. `audience: "patient"` is load-bearing — it switches the plain-language rule ON and the jargon/abbreviation machinery OFF for that field, because record voice and patient voice want opposite edits from the same machinery.
- `FieldValue` discriminated union including `{kind:"teeth"; teeth: ToothId[]}` and `{kind:"surfaces"; byTooth: Record<ToothId, Surface[]>}` — teeth/surfaces are first-class typed values, not free text.
- `AuditFinding` / `Severity` S0–S4 (/home/user/catcorner22/dental/src/lib/audit/types.ts, 258 LOC) with five parallel presentation ramps (CHIP, RAIL, TEXT, CLASS, SHAPE) and non-colour shape channel for CVD. `OverallStatus` is deliberately kept as a shouted stored enum (frozen into `submissions.auditStatus`) with a separate `STATUS_DISPLAY` for the screen.
- `ClinicalFact` + `Assertion` + `Span` (/home/user/catcorner22/dental/src/lib/extract/facts.ts): read-only, spans-into-input only.
- `ClinicalRole` (unset|assistant|hygienist|dentist|smilenotes) as a *separate axis* from the system RBAC ladder (/home/user/catcorner22/dental/src/lib/auth/clinicalRoles.ts), driving `dentistOwnedKeys()` scope locks, template filtering (`authorCapabilities.ts`), audit tailoring, and AI tier.

TEXT-ENTRY PIPELINES (three, all converging on the same fields)
- Typing + standard-phrase chips + verified "blocks" (`src/lib/phrases/`).
- Dictation: `src/lib/dictation/engine.ts` defines a swappable `DictationEngine` interface (browser SpeechRecognition today, on-device Whisper planned) with `offDevice: boolean` surfaced in the UI; `availability.ts` distinguishes disabled/insecure/unsupported/unknown so the user gets an actionable reason; `enrollment.ts` gates apply-mode behind a 90 s preview-only session with utterance and prompt minimums; `normalize.ts` performs ONLY deterministic joins of compounds generic STT splits ("bite wing"→"bitewing"), never expansion; `regional.ts` supplies six US-region colloquial phrase sets for grammar hints (read-only gloss, never rewrite).
- Paste: `PasteIntake` (/home/user/catcorner22/dental/src/components/builder/PasteIntake.tsx) runs `partitionIntoSoap()` + `standardize()` + `runTextAudit()` client-side on the pasted text, shows the sort and the diff, and requires the human to click each destination. Nothing auto-fills — because required-field checks only test emptiness (a gate that opens for prose is not a gate) and because a hygienist writing to a dentist-owned field is refused by the scope guard on first autosave.

STANDARDIZE (/home/user/catcorner22/dental/src/lib/standardize/, ~4400 LOC)
`standardize()` splits every rewrite into APPLIED (deterministic, language-only) vs FLAGGED (needs a clinical fact the tool doesn't have) and returns a *proposal* the human accepts. Hard rules: medication-name typos are never auto-corrected; nothing writes a clinical assertion or removes a negation. `normalizeWhitespace()` folds non-ASCII digits to ASCII, strips bidi/zero-width/tag/variation-selector characters, and preserves paragraph breaks. `structure.ts` is a deterministic SOAP partitioner whose invariant is "it MOVES sentences" — every input sentence appears once, byte-identical, only headings are added. Supporting modules: `notation.ts`, `plausibility.ts`, `resolution.ts` (attested resolution queue), `reasonCodes.ts`, `proposeReading.ts` (display-only readings for ambiguous shorthand), `disambiguation-eval.ts`.

AI ASSIST (/home/user/catcorner22/dental/src/lib/assist/)
`runAssist(capability, text, generate, generateList?)` — signature deliberately has nowhere to put a patient (asserted by `non-goals.test.ts`). Order: PHI gate (`runPhiRule` + `scanPhiForProvider`; ANY phi finding blocks, S2 bare names included, because off-server disclosure cannot be reviewed afterwards) → `retrieveContext()` appends the practice's own tables to the system prompt → model (injected `GenerateFn`/`GenerateListFn`, so tests bind adversaries) → JSON schema + hand validators → `verifyMeaning()` for prose/questions or `verifyExtraction()` for facts. `extract` short-circuits the shared tail because its per-fact grounding verifier is stricter. Every failure returns a machine-readable `codes[]` of *constants from this codebase* (never text), consumed by `drift.ts` which counts refusal-code rates over time to detect a silently-changed provider model.

VERIFIER (/home/user/catcorner22/dental/src/lib/verify/, ~1470 LOC)
`verifyMeaning()` is a deterministic multiset/scope diff over canonicalized text: digits, negations, negation *scopes* (bounded to a two-word negated head), teeth, units, drugs, attribution added/dropped, laterality/site, surface runs, content shrunk, content invented, claims added, output degenerate, not-questions. `vocabulary.ts` derives the "allowed to introduce" set FROM the same shorthand/abbreviation/misspelling/plain-language tables the deterministic pass enforces, so the verifier can never refuse the transformer's own correct output. `neutralize(tokens, noise)` is per-input so only expansions the note actually licenses are forgiven.

ENFORCEMENT: SERVER vs CLIENT
- Client: live audit on every keystroke (deferred value), gates rendered, chips/status derived.
- Server (authoritative): the submit route re-runs `runAudit` + `computeGates` and returns 422 on any open S1 — which is why `AuditPanel` makes `required.missing` fix-only rather than attestable. The email route re-runs the text audit server-side "so a tampered client cannot bypass it." The assist route re-checks `capabilityTier` against the clinical role read fresh from the DB, not from the token or the browser; CSP `connect-src 'self'` means the browser never talks to a model provider.
- Versioning: `RULESET_VERSION` (/home/user/catcorner22/dental/src/lib/version.ts) is stamped onto every submission and frozen; CI diffs the PR against its base and fails if `src/lib/{vocab,modules}/` or `src/lib/audit/{rules,maskPhi}` changed without a bump, and likewise for `ASSIST_PROMPT_VERSION` and `SCHEMA_BOOT_VERSION`.

## Key files


### Item 1
- **path**: /home/user/catcorner22/dental/src/lib/schema/types.ts
- **purpose**: The entire clinical form schema: ModuleDef/SectionDef/Field union (incl. toothPicker, surfacePicker, measurement), FieldValue union with typed teeth/surfaces, NoteState, fieldKey(). The single source of truth that drives form UI, composer, and audit engine. `audience: "patient"` marker switches plain-language on and jargon machinery off.
- **loc estimate**: 145

### Item 2
- **path**: /home/user/catcorner22/dental/src/lib/modules/index.ts
- **purpose**: Module registry: imports all 33 modules, sorts by canonical `order`, exposes ALL_MODULES / MODULES_BY_ID / activeModules() / moduleMatches().
- **loc estimate**: 96

### Item 3
- **path**: /home/user/catcorner22/dental/src/lib/modules/universal-core.ts
- **purpose**: The always-on module: Visit narrative (3 prose fields), Visit, Medical/dental review, Subjective, Objective, Assessment, Plan and decision, Care delivered, Handoff, Open items, patient-facing summary. Encodes TN Rule 0460-01-.19 teledentistry definitions and Public Chapter 1107 supervision fields.
- **loc estimate**: 749

### Item 4
- **path**: /home/user/catcorner22/dental/src/lib/modules/shared.ts
- **purpose**: Controlled option vocabularies reused across modules: DATA_STATES (present/absent/not assessed/not applicable/unknown/unresolved), PROCEDURE_STATES (10 states, 'do not collapse these'), CARE_STATUS, allergy/medication/premed statuses, optionalTeeth() helper that puts optional sites under the wrong-site poka-yoke.
- **loc estimate**: 295

### Item 5
- **path**: /home/user/catcorner22/dental/src/lib/modules/
**purpose**

32 add-on modules (examination, emergency, imaging, preventive, direct-restorative, fixed/removable prosthodontic, endodontic, periodontal, implant, robotic-surgery, operative, extraction, biopsy, bone-graft-sinus, trauma, nitrous, sedation-anesthesia, pediatric, orthodontic, oral-medicine, anxiety-comfort, sleep-apnea, tmj-tmd, cosmetic, medication, teledentistry, communication-followup, pathology-result, refusal-incomplete, late-entry, universal-procedure). ~5,900 LOC of pure domain data.

- **loc estimate**: 5887

### Item 6
- **path**: /home/user/catcorner22/dental/src/lib/vocab/teeth.ts
- **purpose**: ADA Universal tooth table built from quadrant seeds: permanent 1-32, primary A-T, supernumerary +50 / +S, with arch/side/quadrant/class/anterior flags, derived FDI secondary display, allowedSurfaces() per tooth, describeTeeth(), and chart display orders.
- **loc estimate**: 203

### Item 7
- **path**: /home/user/catcorner22/dental/src/lib/vocab/shorthand.ts
- **purpose**: 109 dental/medical/dosing shorthand entries with pattern, display, expansion, pluralExpansion, and `alternatives` for permanently-ambiguous initialisms. Encodes the first-use-expansion convention and the ISMP dosing-frequency carve-outs.
- **loc estimate**: 697

### Item 8
- **path**: /home/user/catcorner22/dental/src/lib/vocab/abbreviations.ts
- **purpose**: BANNED_ABBREVIATIONS with severityClass style|review and the `doNotUse` flag that makes Joint Commission / ISMP constructs block filing and never be expanded. Rendered directly by the /reference page so docs cannot drift from enforcement.
- **loc estimate**: 559

### Item 9
- **path**: /home/user/catcorner22/dental/src/lib/vocab/
**purpose**

Full controlled vocabulary: procedures.ts (procedure terms by length + categories), clinical-terms.ts (findings, materials, care events, drug shorthand, dose/measure units), vague-phrases.ts, plain-language.ts (PLAIN_WORDS for patient voice), misspellings.ts (with MEDICATION_WORDS never auto-corrected), given-names.ts, unknownAbbreviations.ts (looksLikeShorthand heuristic), lexicon-*.ts spelling dictionaries, surfaces.ts, units.ts.

- **loc estimate**: 4091

### Item 10
- **path**: /home/user/catcorner22/dental/src/lib/audit/engine.ts
- **purpose**: Pure isomorphic audit orchestrator: runTextAudit(text) for the 13 text rule families, runAudit(ctx) adding state rules + patient/record voice separation + shared spelling budget + role tailoring, buildReport(), computeGates().
- **loc estimate**: 253

### Item 11
- **path**: /home/user/catcorner22/dental/src/lib/audit/types.ts
- **purpose**: Severity model S0-S4 with labels, meanings, shapes, five presentation ramps, AuditCategory union, AuditFinding, AuditReport, AuditGates, OverallStatus (stored enum) + STATUS_DISPLAY (screen), AuditContext with `today` as an input for date-effective rules.
- **loc estimate**: 258

### Item 12
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts
- **purpose**: Heuristic PHI screen: SSN (cue-gated), phone, 8 date shapes incl. ISO/dotted/EHR-export/day-month, email, MRN/chart/account with qualifier evidence, honorific+name with clinical-initialism suppression (MS Contin), bare names against GIVEN_NAMES, obfuscated-digit and hidden-character screens. captureGroup exists so the Mask button replaces the identifier, not the label.
- **loc estimate**: 573

### Item 13
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/medication-safety.ts
- **purpose**: The 'Mockingbird gates': lb-with-mg/kg, dose-arithmetic reconciliation (2x ceiling, never states the expected number), household units, mixed unit systems, 12 curated dental drug-interaction patterns with an AVOIDANCE_CUE that demotes to S3 when the note shows the clinician avoided it, and the TN CSMD/PMP opioid gate. Every rule cites its source in the message.
- **loc estimate**: 457

### Item 14
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/completeness.ts
- **purpose**: 11 anticipatory completeness rules derived from claim-file research: imaging-no-interpretation, anesthetic-no-amount, extraction-no-outcome, rx-no-duration, rx-no-indication, consent-no-decision, consent-thin-assertion (checkbox theater), clinical-rationale, referral-loop-open, finding-no-disposition, procedure-no-followup. Each is trigger + satisfiedBy regex at S2.
- **loc estimate**: 163

### Item 15
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/anatomy.ts
- **purpose**: Wrong-site guard: invalid ADA tooth designation (S0), surface-orphan where surfaces exist for a tooth the linked tooth field does not list (S0), impossible surface per tooth class (occlusal on incisor = S0), mixed dentition (S2), plus a text-mode variant.
- **loc estimate**: 220

### Item 16
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/shorthand-gate.ts
- **purpose**: The tiered filing gate: Tier 1 known/unambiguous = expanded silently; Tier 2 ambiguous, Tier 3 unknown, Tier 4 do-not-use all = S1 block on FILING (not on copy/draft). Reasoned explicitly against alert-override arithmetic (87.6% drug-allergy override rate).
- **loc estimate**: 171

### Item 17
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts
- **purpose**: Billing-narrative readiness rules (SRP periodontal evidence, core-buildup retention, crown necessity) that check the narrative supports the claim without ever writing a CDT code.
- **loc estimate**: 75

### Item 18
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/supervision.ts
- **purpose**: TN Public Chapter 1107 effective-dated rule: before 2027-01-01 a heads-up, after it blocks filing when a hygiene service is documented for a new patient without direct supervision. Takes `today` as an input so the engine stays pure.
- **loc estimate**: 109

### Item 19
- **path**: /home/user/catcorner22/dental/src/lib/audit/maskPhi.ts
- **purpose**: One-click identifier masking with random (never derived) tokens, consistent within a note and deliberately NOT across notes (a stable token would become a durable patient key), unambiguous alphabet, MaskKind preserving what kind of fact was there.
- **loc estimate**: 182

### Item 20
- **path**: /home/user/catcorner22/dental/src/lib/audit/omissions.ts
- **purpose**: Named omission licences (not applicable / not assessed / unknown / unresolved) with precise meanings, counted per note and surfaced before filing. The MPDS-inspired 'make the escape hatch countable rather than closing it' pattern.
- **loc estimate**: 219

### Item 21
- **path**: /home/user/catcorner22/dental/src/lib/audit/precision/precision-eval.ts
- **purpose**: Precision harness measuring how often the audit blocks a note that was already fine, with a ZERO blocking-false-positive target (not a percentage) and an advisory-per-note rate that is ratcheted. Audit fn injectable so a candidate ruleset can be scored before promotion.
- **loc estimate**: 154

### Item 22
- **path**: /home/user/catcorner22/dental/src/lib/audit/precision/clean-corpus.ts
- **purpose**: 34 house-style notes each deliberately loaded with a hazard known to break a specific rule, with a per-note `why` sentence so a failure reads as a sentence. This is the anti-vacuity input to the precision claim.
- **loc estimate**: 498

### Item 23
- **path**: /home/user/catcorner22/dental/src/lib/standardize/standardize.ts
- **purpose**: The APPLIED vs FLAGGED transformer. Unicode/bidi/zero-width sanitization, digit folding, whitespace and notation normalization, abbreviation/shorthand/misspelling application, ambiguity flagging, truncation reporting. Returns a proposal, never an auto-apply.
- **loc estimate**: 636

### Item 24
- **path**: /home/user/catcorner22/dental/src/lib/standardize/structure.ts
- **purpose**: Deterministic SOAP partitioner with DECISIVE label cues plus scored cue lists per section. Invariant: it only MOVES sentences; every input sentence appears once byte-identical. Powers both PasteIntake and the deterministic twin of the `soap` AI capability.
- **loc estimate**: 327

### Item 25
- **path**: /home/user/catcorner22/dental/src/lib/extract/facts.ts
- **purpose**: The read-only fact model: Span, Assertion (ConText-derived; negation assigned at 97/97, temporality only hinted), ToothSite with impossibleSurfaces, seven fact kinds (tooth-site, procedure, medication, measurement, finding, material, care-event), quadrant regions, affirmedSites()/sitesOfFact().
- **loc estimate**: 295

### Item 26
- **path**: /home/user/catcorner22/dental/src/lib/extract/extract.ts
- **purpose**: The clause parser with an EBNF grammar written in the header and three stated invariants: a bare number is never a tooth, an introducer alone is not enough (lot/op/chair #N), surfaces must be uppercase. Refusal is free and is the default.
- **loc estimate**: 788

### Item 27
- **path**: /home/user/catcorner22/dental/src/lib/extract/chart.ts
- **purpose**: The chart model: chartMarks() with CATEGORY_RANK conflict resolution, chartRegions() for quadrant-level claims, and CONTRADICTORY_PAIRS (extracted-and-restored, extracted-and-endo) kept deliberately short with the published base-rate/precision arithmetic for why.
- **loc estimate**: 241

### Item 28
- **path**: /home/user/catcorner22/dental/src/lib/extract/context.ts
- **purpose**: ConText assertion scoping: negation/experiencer/temporality cue tables, scope windows, impliesNegation for NKA/NKDA so an absence of allergy can never be read as an allergy.
- **loc estimate**: 369

### Item 29
- **path**: /home/user/catcorner22/dental/src/lib/extract/tokenize.ts
- **purpose**: Tokenizer with newline-as-clause-boundary and a 250-token clause ceiling — added after a 1,500-line paste parsed as one clause and cost 12 s on the keystroke path while letting a 'no' on line 1 negate a finding 40 lines down.
- **loc estimate**: 233

### Item 30
- **path**: /home/user/catcorner22/dental/src/lib/assist/service.ts
- **purpose**: The single AI doorway: PHI gate -> retrieval -> injected model -> schema validation -> verifier. Typed AssistOutcome with machine-readable `codes` on both success and failure paths.
- **loc estimate**: 324

### Item 31
- **path**: /home/user/catcorner22/dental/src/lib/assist/prompts.ts
- **purpose**: Versioned system prompts (ASSIST_PROMPT_VERSION 1.4.0) for 5 capabilities, sharing a MUST_NOT block that states the constraints the verifier actually enforces, a VOICE block, and worked examples exported as DATA so prompts.test.ts runs every exemplar through verifyMeaning at build time.
- **loc estimate**: 199

### Item 32
- **path**: /home/user/catcorner22/dental/src/lib/assist/tier.ts
- **purpose**: capabilityTier(role, capability): capability follows licence. Judgement-shaped capabilities (interrogate, conflicts) drop to the deterministic twin for anyone who may not record judgement; `unset` is deterministic by deliberate inversion of the permissive default.
- **loc estimate**: 92

### Item 33
- **path**: /home/user/catcorner22/dental/src/lib/assist/extraction.ts
- **purpose**: Evidence-pinned extraction: every proposed fact must carry a VERBATIM quote from the input; verifyExtraction() locates the quote and grounds the statement in it, refusing per-fact. Implements the owner's acceptance test that no AI clinical fact is finalized without visible source evidence.
- **loc estimate**: 313

### Item 34
- **path**: /home/user/catcorner22/dental/src/lib/assist/non-goals.ts
- **purpose**: Four permanently-refused AI capabilities (patient-history cross-reference, dose calculation, ambient dictation, confidence scores) each with proposal / conflict / safe alternative, asserted by non-goals.test.ts so the exclusion is machinery rather than folklore.
- **loc estimate**: 61

### Item 35
- **path**: /home/user/catcorner22/dental/src/lib/assist/drift.ts
- **purpose**: Drift monitoring built from verifier refusals as free labelled examples. Records capability, prompt version, MODEL IDENTITY, rejection codes, tokens, per-fact counts. Never records note text.
- **loc estimate**: 350

### Item 36
- **path**: /home/user/catcorner22/dental/src/lib/verify/verifyMeaning.ts
- **purpose**: The deterministic meaning gate with 14 typed rejection codes including negation-scope-changed, site-changed, surfaces-changed, attribution-added/dropped, content-invented and claims-added (two complementary fabrication guards).
- **loc estimate**: 569

### Item 37
- **path**: /home/user/catcorner22/dental/src/lib/verify/vocabulary.ts
- **purpose**: licenseFor(): the allowed-to-introduce set derived from the same vocab tables the deterministic pass enforces, plus a FUNCTION_WORDS list whose hard part is what it must NOT contain (discussed, reviewed, tolerated, obtained, examined, verified all stay on the grounded side).
- **loc estimate**: 302

### Item 38
- **path**: /home/user/catcorner22/dental/src/lib/verify/grounding.ts
- **purpose**: checkGrounding()/checkQuestionGrounding(): clause-level grounding of model output against the input, the guard `content-invented` rests on.
- **loc estimate**: 175

### Item 39
- **path**: /home/user/catcorner22/dental/src/lib/dictation/engine.ts
- **purpose**: Swappable DictationEngine interface (id, label, offDevice, lang, available, start, stop) with a hardened browser SpeechRecognition implementation: en-US only, finals-only commit, maxAlternatives 1, supervised restart, optional JSGF grammar boosting.
- **loc estimate**: 299

### Item 40
- **path**: /home/user/catcorner22/dental/src/lib/dictation/normalize.ts
- **purpose**: Deterministic join table for dental compounds generic STT splits (bite wing, peri apical, x ray, sub/supra gingival, inter proximal, gutta percha, post operative), using [ \t]+ so line breaks are always boundaries. Never expands, never touches numbers/doses/teeth/negations.
- **loc estimate**: 73

### Item 41
- **path**: /home/user/catcorner22/dental/src/lib/dictation/enrollment.ts
- **purpose**: Voice enrollment gate: 90 s preview-only session with minimum utterances and prompts before apply-mode dictation unlocks, versioned (2.0.0) and stored on the user row rather than localStorage.
- **loc estimate**: 149

### Item 42
- **path**: /home/user/catcorner22/dental/src/lib/dictation/regional.ts
- **purpose**: Six US-region colloquial phrase sets for recognition grammar hints and enrollment scripts, with a hard rule that nothing here rewrites a transcript.
- **loc estimate**: 196

### Item 43
- **path**: /home/user/catcorner22/dental/src/components/builder/BuilderShell.tsx
- **purpose**: The note-builder client shell: state, autosave + backup + conflict, module rail and search, lazy audit engine with closed-gates-until-loaded, PHI mask/override, copy/download/email gates, submit, Fast Lane, packs, prior notes, readback, dictation context, shared-tablet idle lock, advisor panels. Largest single file in the subsystem.
- **loc estimate**: 2127

### Item 44
- **path**: /home/user/catcorner22/dental/src/components/builder/NoteForm.tsx
- **purpose**: Renders modules/sections/fields with condition evaluation, per-field finding display, dentist-owned section locks by clinical role, section open/close heuristics, and verified-block append.
- **loc estimate**: 578

### Item 45
- **path**: /home/user/catcorner22/dental/src/components/builder/AuditPanel.tsx
- **purpose**: Findings list with severity rails, per-finding attestation with reason codes (S0 and required.missing deliberately fix-only because the server re-runs the audit at submit), jump-to-field, and escalation.
- **loc estimate**: 385

### Item 46
- **path**: /home/user/catcorner22/dental/src/components/builder/Odontogram.tsx
- **purpose**: SVG odontogram readback: five-zone tooth glyph with mesial/distal drawn on the anatomically correct sides, category fills from brand chrome (severity colours deliberately excluded), shape as a second channel, tooth numbers and a parallel text list.
- **loc estimate**: 346

### Item 47
- **path**: /home/user/catcorner22/dental/src/components/builder/fields/ToothPicker.tsx
- **purpose**: Dentition-tabbed tooth grid that opens on the dentition of the stored selection, with aria wiring for the field that decides which tooth enters a legal record.
- **loc estimate**: 114

### Item 48
- **path**: /home/user/catcorner22/dental/src/components/builder/fields/SurfacePicker.tsx
- **purpose**: Per-tooth surface picker with anatomically impossible surfaces disabled at the control (poka-yoke, so the S0 anatomy rule rarely fires) and wrapping rather than squeezing on phones.
- **loc estimate**: 98

### Item 49
- **path**: /home/user/catcorner22/dental/src/components/builder/PasteIntake.tsx
- **purpose**: Paste-as-entry-mode: SOAP partition + standardize + text audit shown as a review with a diff, and one explicit human click per destination field. Respects licence-locked sections read-only.
- **loc estimate**: 299

### Item 50
- **path**: /home/user/catcorner22/dental/src/lib/readback/readbackClass.ts
- **purpose**: ICAO-style human hearback tokens (tooth, surface, site, drug, dose, unit, time) extracted for confirm-on-Apply, distinct from the software verifier.
- **loc estimate**: 180

### Item 51
- **path**: /home/user/catcorner22/dental/src/lib/version.ts
- **purpose**: RULESET_VERSION 2.25.2 with a 260-line changelog that is itself a design document: each bump states the harm prevented, the false positives found, and the reasoning. Highest-signal single artifact in the repo for understanding why the rules are the way they are.
- **loc estimate**: 266

### Item 52
- **path**: /home/user/catcorner22/dental/skill/assets/dental-note-templates.md
- **purpose**: The 734-line source-of-truth note standard the modules were derived from: use rules, coverage list, 12-step guided staff process, module router table, and full de-identified templates for Universal Core and every add-on.
- **loc estimate**: 734

### Item 53
- **path**: /home/user/catcorner22/dental/.cursor/rules/transformer-development.mdc
- **purpose**: The development discipline as an always-apply rule: the never-change-what-a-note-says invariant, storm-first verification loop, versioning discipline, AI layer rules, and tone rules for user-facing text.
- **loc estimate**: 64

### Item 54
- **path**: /home/user/catcorner22/dental/src/lib/auth/clinicalRoles.ts
- **purpose**: ClinicalRole as a separate axis from system RBAC, mapped to Tenn. Comp. R. & Regs. 0460 scope of practice; drives dentist-owned section locks and audit tailoring.
- **loc estimate**: 144

### Item 55
- **path**: /home/user/catcorner22/dental/src/lib/scope/authorCapabilities.ts
- **purpose**: Licence-to-product mapping: which modules appear in the rail, which quick picks are featured, which advisor scope applies, and whether the writer reaches the predictive or deterministic assist tier.
- **loc estimate**: 182

### Item 56
- **path**: /home/user/catcorner22/dental/knowledge/sources/
**purpose**

53 research digests (~5,300 lines) including high-stakes-documentation-patterns, litigation-documentation-research, industry-note-standards-and-safety, tn-dental-legal-best-practices, voice-to-text-landscape, and 20 adversarial persona 'hate' panels (HIPAA attorney, IT security, insurance auditor, chairside DA, RDH surveillance/labor, CVD/dyslexia, a11y advocate). The provenance behind almost every rule.

- **loc estimate**: 5338

## Reusable assets


### Item 1
- **name**: ADA tooth/surface notation library
- **path**: /home/user/catcorner22/dental/src/lib/vocab/teeth.ts + /home/user/catcorner22/dental/src/lib/vocab/surfaces.ts
- **why reusable**: Complete, correct, dependency-free ADA Universal table with primary, permanent, and both supernumerary forms; per-tooth allowed surfaces; FDI cross-walk as a secondary display; quadrant/arch/side/class metadata; chart display orders. Every PMS needs exactly this and getting it wrong is a wrong-site incident. Lift it verbatim.
- **quality**: production-grade
- **coupling**: Only `@/lib/schema/types` for the Dentition/Surface/ToothId type aliases. Effectively zero coupling; copy the file and 6 lines of types.

### Item 2
- **name**: Controlled dental vocabulary tables
- **path**: /home/user/catcorner22/dental/src/lib/vocab/
**why reusable**

~4,100 LOC of curated domain data: 109 shorthand entries with ambiguity sets and plural-safe expansions, banned/do-not-use abbreviations with severity classes, procedure terms by category, clinical findings/materials/care events/drug shorthand/dose units, vague and stigmatizing phrase lists, plain-language patient-voice map, dental spelling lexicons, misspellings with a never-auto-correct medication set. This is years of accumulated domain knowledge that cannot be regenerated by an LLM without the same adversarial review.

- **quality**: production-grade
- **coupling**: Pure data + regexes. Depends only on schema type aliases and `lib/text/foldDigits`. The abbreviations table is consumed by the audit, the standardizer, the verifier's licence set, and the /reference page — that fan-out is a feature (one edit teaches every consumer) but means the consumers must move together.

### Item 3
- **name**: Deterministic audit engine + S0-S4 severity model
- **path**: /home/user/catcorner22/dental/src/lib/audit/
- **why reusable**: A pure, isomorphic rules engine with a five-level severity taxonomy, gate derivation, per-field attribution, role tailoring, and a stored-vs-displayed status split. Directly becomes the PMS's clinical-note quality gate; the same shape also generalizes to claim-narrative checking and to Precog's control-finding severity model.
- **quality**: production-grade
- **coupling**: Depends on the module registry (for state rules), the vocab tables, `lib/schema/conditions`, and `lib/auth/clinicalRoles`. `runTextAudit(text)` alone is fully standalone and is the highest-leverage single export — it takes a string and returns findings.

### Item 4
- **name**: Dental medication-safety rule set
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/medication-safety.ts
**why reusable**

Twelve curated dental-relevant interaction screens (anticoagulant/metronidazole/azole/NSAID, NSAID/lithium/methotrexate/SSRI/corticosteroid/asthma, epi/non-selective beta-blocker, statin/macrolide-azole, metronidazole/alcohol) with cited sources in the message, plus the kg rule, dose reconciliation, household units, and the TN CSMD/PMP opioid gate. The AVOIDANCE_CUE demotion (documenting that you avoided an interaction should not be punished) is a hard-won detail most products get wrong.

- **quality**: production-grade
- **coupling**: Pure text-in, findings-out. Zero dependencies beyond the AuditFinding type. Drop-in for any note or eRx surface. Note the TN-specific opioid rule needs a jurisdiction switch for a multi-state PMS.

### Item 5
- **name**: Anticipatory completeness + billing-justification rules
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/completeness.ts + /home/user/catcorner22/dental/src/lib/audit/rules/justification.ts
**why reusable**

Encodes published malpractice claim-file and carrier-denial research as trigger/satisfiedBy regex pairs: imaging without interpretation, anesthetic without amount, extraction without outcome, consent without decision, consent-as-checkbox, procedure without rationale, referral loop open, finding without disposition, SRP without periodontal evidence, buildup without retention narrative. This is the bridge between the clinical note and the claim, which the market research identifies as the daily test no product wins.

- **quality**: production-grade
- **coupling**: Pure text-in, findings-out. Free to lift. The justification rules are the natural seed for a claims-narrative pre-flight in the merged PMS.

### Item 6
- **name**: PHI screen + one-click masking
- **path**: /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts + phi-secondary.ts + /home/user/catcorner22/dental/src/lib/audit/maskPhi.ts
**why reusable**

Even in a PHI-holding PMS this becomes the outbound-boundary screen: what may leave to an LLM provider, an analytics pipeline, a support ticket, a research export, or a de-identified benchmark. Includes obfuscation detection (non-ASCII digits, zero-width/bidi splitting) that most naive `\d`-based screens miss entirely, and a correctly-reasoned pseudonymization scheme (random not derived; consistent within a note, deliberately not across notes).

- **quality**: production-grade
- **coupling**: phi.ts needs GIVEN_NAMES and foldDigits. maskPhi needs `crypto.getRandomValues`. Both are otherwise standalone. Heuristic by design — it 'helps; it cannot certify de-identification', and that caveat must travel with it.

### Item 7
- **name**: Read-only clinical fact extractor with ConText assertions
- **path**: /home/user/catcorner22/dental/src/lib/extract/
**why reusable**

Turns staff shorthand into structured facts with spans, negation, and experiencer, at 94.6% measured clause coverage, without ever rewriting text. In a PMS this is the ingest path for legacy note conversion, for auto-populating the chart from prose, for cross-checking prose against the odontogram and against the codes on the claim, and for the readback UI. The EBNF-in-a-comment and the three stated invariants make it maintainable by someone who did not write it.

- **quality**: production-grade
- **coupling**: Depends on vocab/teeth, vocab/procedures, vocab/clinical-terms, vocab/misspellings, and schema type aliases. Self-contained within the extract+vocab pair; ratcheted by coverage.test.ts and a real-shorthand corpus in corpus.ts.

### Item 8
- **name**: Odontogram readback component + chart model
- **path**: /home/user/catcorner22/dental/src/components/builder/Odontogram.tsx + /home/user/catcorner22/dental/src/lib/extract/chart.ts
**why reusable**

SVG five-zone tooth glyph with anatomically-correct mesial/distal orientation, category colour separated from the severity palette, shape as a second non-colour channel, click-to-jump spans, and a documented paint policy (only what the note affirms; negated drawn outlined; hinted drawn faintly; never inferred). This is a strong starting point for the PMS's real charting widget, and the contradiction detector is directly reusable.

- **quality**: solid
- **coupling**: React + Tailwind-class strings + brand colour hexes; depends on chart.ts and vocab/teeth. Currently a READBACK (display-only) — it has no editing, no per-surface history, no existing-conditions layer, and only renders the permanent dentition rows. Turning it into an editable chart is real work, but the glyph geometry and the paint policy carry over.

### Item 9
- **name**: Meaning verifier (verifyMeaning + grounding + licensed vocabulary)
- **path**: /home/user/catcorner22/dental/src/lib/verify/
**why reusable**

The single most differentiating asset. A deterministic, testable gate that refuses any LLM output that changed digits, negation, negation scope, teeth, units, drugs, attribution, laterality, or surfaces, or that invented a claim — with the allowed-to-introduce vocabulary DERIVED from the enforcement tables so it cannot disagree with the transformer it guards. Applicable to every AI surface in the merged PMS (note assist, claim narratives, patient communications, Precog's coach) and is exactly the artifact a HIPAA/liability review asks for.

- **quality**: production-grade
- **coupling**: Depends on the vocab tables (via vocabulary.ts) and lib/verify/normalize. Portable; retune `licenseFor()` for any new domain vocabulary. Backed by redteam.test.ts (360 LOC) and verifyMeaning.test.ts.

### Item 10
- **name**: Assist service architecture (gate -> model -> verifier -> human)
- **path**: /home/user/catcorner22/dental/src/lib/assist/service.ts + tier.ts + prompts.ts + schemas.ts + extraction.ts + drift.ts + non-goals.ts
**why reusable**

A complete, opinionated pattern for shipping LLM features in a regulated product: injectable model seam (tests bind adversaries, never live providers), two-switch opt-in, versioned prompts with worked examples validated against the verifier at build time, JSON-schema + hand validators, evidence-pinned extraction, capability-follows-licence tiering enforced server-side from the DB, drift counting from refusal codes without logging text, and written-down non-goals with enforcement tests. Transplant the shape wholesale.

- **quality**: production-grade
- **coupling**: service.ts depends on the PHI rules, retrieval, and the verifier; tier.ts on clinicalRoles/authorCapabilities. The pattern is portable even if the specific capabilities are not.

### Item 11
- **name**: Deterministic standardizer + SOAP partitioner
- **path**: /home/user/catcorner22/dental/src/lib/standardize/
- **why reusable**: APPLIED-vs-FLAGGED discipline, Unicode/bidi/zero-width sanitization, digit folding, notation repair, plausibility bounds, an attested resolution queue with reason codes, and a SOAP partitioner whose invariant is that sentences move byte-identical. Powers paste ingest, legacy-note migration, and the deterministic twins of AI capabilities.
- **quality**: production-grade
- **coupling**: Depends on the vocab tables and lib/text/foldDigits. ~4,400 LOC including 12 test/eval files (property, adversarial, reliability, meaning, usefulness, plausibility, disambiguation-eval).

### Item 12
- **name**: Module registry / schema-driven form system
- **path**: /home/user/catcorner22/dental/src/lib/schema/types.ts + /home/user/catcorner22/dental/src/lib/modules/ + /home/user/catcorner22/dental/src/lib/compose/composeNote.ts
- **why reusable**: 33 modules of dental domain content plus a 145-line schema that drives form, composer, and audit from one definition. In the PMS this becomes the clinical template engine; the module set maps almost 1:1 onto the procedure categories a PMS charts. `audience: "patient"` and the dentist-owned-section concept are both directly relevant to a multi-role PMS.
- **quality**: production-grade
- **coupling**: Modules import only `shared.ts` and the schema types — pure data, trivially portable. `composeNote` and the renderers are Next/React-specific but the composer's markdown-sanitization logic is worth keeping. The schema has no versioning/migration story for module changes against saved drafts (see weaknesses).

### Item 13
- **name**: Precision evaluation harness + clean corpus
- **path**: /home/user/catcorner22/dental/src/lib/audit/precision/
**why reusable**

A reusable methodology for any rules engine that blocks work: measure false blocks on notes that are correct by construction, target ZERO for blocking findings (with the stated reasoning for why a percentage is the wrong shape), rate-limit advisory noise, make the audit function injectable so a candidate ruleset is scored before promotion, and print the corpus note's own justification sentence in the failure. Directly transplantable to Precog's control findings.

- **quality**: production-grade
- **coupling**: Depends on runTextAudit and the corpus file. The harness is generic; the corpus is dental-specific and is itself the asset.

### Item 14
- **name**: Dictation layer with provider seam and enrollment gate
- **path**: /home/user/catcorner22/dental/src/lib/dictation/ + /home/user/catcorner22/dental/src/components/builder/fields/DictationField.tsx
**why reusable**

A swappable engine interface with an `offDevice` truth flag surfaced in the UI, an availability model that gives actionable reasons (disabled/insecure/unsupported), a preview-only enrollment gate before dictation may mutate text, a deterministic dental-compound join table, and regional phrase sets for grammar boosting. Directly addresses the market finding that perio and notes at hygiene speed need voice, and that generic STT mangles dental terminology.

- **quality**: solid
- **coupling**: engine.ts is browser-API-bound but behind the interface; normalize/regional/enrollment/availability are pure. The current implementation is browser SpeechRecognition (off-device), which conflicts with the ambient-dictation non-goal and would need the planned on-device Whisper engine or a BAA-covered vendor before touching PHI.

### Item 15
- **name**: Named omission licences + finding attestation with reason codes
- **path**: /home/user/catcorner22/dental/src/lib/audit/omissions.ts + /home/user/catcorner22/dental/src/lib/standardize/reasonCodes.ts + /home/user/catcorner22/dental/src/lib/audit/attestation.ts
- **why reusable**: The MPDS-derived pattern: don't close the escape hatch, make it finite, named, and countable, then surface the rate to a Team Lead. This is a general control-design pattern that maps directly onto Precog's override/compensating-control tracking and onto any PMS field that a busy person can click past.
- **quality**: production-grade
- **coupling**: omissions.ts depends on the module registry and schema conditions; the attestation validators are pure string helpers deliberately split out so client code can import them without the rules cluster.

### Item 16
- **name**: Note standards source document
- **path**: /home/user/catcorner22/dental/skill/assets/dental-note-templates.md
- **why reusable**: The 734-line normative document the modules were built from: module router table, guided staff process, and de-identified templates for every add-on. Doubles as onboarding material, as a sales artifact, and as the spec against which module changes are reviewed.
- **quality**: production-grade
- **coupling**: None — it is prose. Its de-identification framing needs rewriting for a PHI-holding product.

### Item 17
- **name**: Research knowledge base
- **path**: /home/user/catcorner22/dental/knowledge/sources/
- **why reusable**: 53 digests including 20 adversarial persona critiques (HIPAA attorney, IT/security, TN board investigator, insurance auditor, chairside DA, RDH labor/surveillance, CVD/dyslexia, front desk, OMFS referral, practice owner). Almost every non-obvious rule traces to one of these. The adversarial-panel method is itself reusable for the merged product.
- **quality**: solid
- **coupling**: Prose; some digests are Smile-Notes-specific and will need re-reading against a PHI-holding product.

### Item 18
- **name**: Versioning + CI enforcement discipline
- **path**: /home/user/catcorner22/dental/src/lib/version.ts + /home/user/catcorner22/dental/.github/workflows/ci.yml + /home/user/catcorner22/dental/.cursor/rules/transformer-development.mdc
- **why reusable**: RULESET_VERSION stamped and frozen onto every filed note, ASSIST_PROMPT_VERSION on prompts, SCHEMA_BOOT_VERSION on DDL — each enforced by a CI job that diffs the PR against its base and fails on an unbumped change. For a PHI/audit-trail product this is exactly the provenance a regulator or plaintiff's expert asks for, and it costs almost nothing to carry forward.
- **quality**: production-grade
- **coupling**: The CI script hardcodes paths under src/lib/. Trivially retargeted.

## Weaknesses

- THE DE-IDENTIFICATION PREMISE IS LOAD-BEARING AND IS ABOUT TO INVERT. The PHI rules do not merely flag identifiers — they BLOCK filing (S0), block the AI call entirely, and drive the mask tool and the override dialog. In a PHI-holding PMS, a patient name, DOB, and MRN are legitimate and expected content. Every S0 phi finding, the phi.mrn / phi.date / phi.name families, the attested override flow, and the 'identifiers belong only in the EDR' message text in dozens of rules and module helpText must be re-scoped from 'never present' to 'present but boundary-controlled'. This is the single largest migration in the subsystem and it touches /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts, phi-secondary.ts, maskPhi.ts, attestation.ts, assist/service.ts, and the copy in nearly every module.
- NO PATIENT, ENCOUNTER, OR PROVIDER ENTITY EXISTS. NoteState is a bag of `{moduleId}.{fieldId}` values with no patient id, no visit id, no provider id, no date of service, no procedure code, and no link to a chart. There is no longitudinal model: no 'prior perio chart', no 'existing restorations', no 'this tooth's history'. The odontogram is explicitly 'a record of this note', not of the mouth. Building the PMS means introducing an entity model underneath everything and re-deriving what 'the note' means relative to it.
- PERIO CHARTING IS DELEGATED, NOT BUILT. /home/user/catcorner22/dental/src/lib/modules/periodontal.ts records whole-mouth SUMMARY measurements (deepest PPD, greatest CAL, greatest recession, BOP%, plaque%, max mobility, max furcation) plus a `chart-status` select whose options all point at the EDR. The six-point site-by-site chart does not exist in this codebase. Since the market research names 'perio at hygiene speed' as a top-3 unmet need (60% of hygienists skip full-mouth perio when behind; only 11% chart every visit), this is a build-from-scratch area, not a port.
- SINGLE-JURISDICTION BY CONSTRUCTION. Tennessee law is hardcoded into rules (supervision.pc1107 with a literal 2027-01-01 effective date), into the CSMD/PMP opioid rule, into module helpText (Rule 0460-01-.19 teledentistry definitions), into clinicalRoles.ts scope-of-practice reasoning, and into a whole /reference/law surface. A commercial PMS needs a jurisdiction dimension on every one of these; today there is no such parameter.
- REGEX-ONLY RULE ENGINE WITH NO CONFIGURABILITY. Every rule is a hand-tuned regex pair compiled into the bundle. There is no per-practice rule enablement, no severity override, no custom rule authoring, and no data-driven rule store. A commercial multi-tenant product will be asked for all four, and retrofitting configurability onto ~8,200 LOC of hardcoded rules while preserving the RULESET_VERSION provenance guarantee is nontrivial. Rules also carry known precision limits — the 2.23.0 changelog documents five BLOCKING false positives found only after a precision corpus was built (a carbide bur '#557' read as an impossible tooth, an implant lot number read as an SSN, 'buccal fat pad' read as unprofessional tone, '------' read as gibberish).
- NO MODULE-SCHEMA MIGRATION STORY. ModuleDefs are code, not data, and NoteState keys are `${moduleId}.${fieldId}` strings. Renaming a field id orphans every saved draft's value silently; removing a module leaves values with no renderer. The codebase is explicitly aware of the adjacent problem (a newly `required` field would block every saved draft, so new requirements are made contextual instead) but there is no migration mechanism, no field-id deprecation registry, and no test that a draft saved under an older module set still round-trips.
- BUILDERSHELL IS A 2,127-LINE CLIENT COMPONENT. It owns note state, autosave, backup, conflict resolution, module selection, PHI masking, override, copy/download/email gating, submit, packs, fast lane, prior notes, readback, dictation context, idle lock, and advisor panels. It is the highest-risk file to modify and the hardest to reuse. Adding scheduling, ledger, claims, and imaging context to this shell without decomposition will not end well.
- THE AI LAYER'S CAPABILITIES ARE NARROW AND OFF BY DEFAULT. Five capabilities (normalize, soap, interrogate, conflicts, extract), all text-in/text-out, all requiring two env switches, with a 40-run-per-user free meter. The 'ambient dictation' non-goal explicitly forecloses the capability the market is buying (Dentrix Voice Notes, Denticon AI Voice Perio, Curve Care+, Bola). The stated conflict — audio bypasses the text PHI gate and is biometric — dissolves once the product legitimately holds PHI under a BAA, so this non-goal will need to be deliberately retired rather than inherited.
- AN INTERNAL CONTRADICTION ALREADY EXISTS AROUND DICTATION. /home/user/catcorner22/dental/src/lib/assist/non-goals.ts declares ambient dictation a permanent non-goal on PHI grounds, while /home/user/catcorner22/dental/src/lib/dictation/engine.ts ships a working browser SpeechRecognition engine flagged `offDevice: true` — i.e. audio may go to a vendor's servers. non-goals.test.ts only asserts that runAssist takes strings, so it does not catch this. The reconciliation (dictation is entry assistance into a de-identified field, not ambient operatory capture) is defensible but is not written down where the two files meet, and it will not survive the move to PHI without a BAA and an on-device engine.
- TEMPORALITY IS NEVER ASSIGNED, WHICH BLOCKS CHART-STATE DERIVATION. extract/facts.ts deliberately refuses to decide historical vs current (ConText's published 67% recall) and only hints. That is the right call for a readback, but a PMS chart must distinguish 'crown placed today' from 'crown placed in 2019 elsewhere' to maintain existing conditions. The structured entity model will have to supply what the parser correctly declines to guess.
- EXTRACTION AND AUDIT ARE ENGLISH-ONLY AND US-NOTATION-ONLY. en-US dictation lock, ADA Universal as the only notation that enters the record (FDI is display-only), American spelling enforced by test, US drug brand names. No i18n path, and the FDI-leakage rule actively blocks the notation used by staff trained abroad.
- PERFORMANCE IS MANAGED BY HAND, NOT MEASURED IN CI. The audit runs on every keystroke over the whole composed note; the mitigations are a shared spelling budget, a lazy patient/record-voice split, a deferred value, a 250-token clause ceiling, and a lazy engine import. There is a performance.test.ts (50 LOC) and an engine-keystroke.test.ts, but no budget enforced in CI. A PMS note with a full chart, a ledger context, and a longer history will stress this.
- NO ACCESSIBILITY OR VISUAL REGRESSION AUTOMATION FOR THE CHART. The Odontogram encodes careful colour/shape/CVD reasoning and there is a contrast.test.ts referenced, but the SVG chart itself has no automated a11y assertions and no visual regression test; correctness of the mesial/distal mirroring — the thing the readback exists to guarantee — rests on the developer having got the geometry right.
- THE SEVERITY MODEL IS INCONSISTENT ACROSS SURFACES. precision-eval.ts itself flags this: standardize/resolution.ts treats S2 as blocking while the builder does not, so a bare-name S2 is non-blocking in one screen and blocking in another. The precision harness measures only the builder's gate, so advisory noise may matter more than the headline number implies.

## Phi security observations

- THE ARCHITECTURAL POSTURE IS 'HOLD NO PHI AT ALL'. Drafts are de-identified by construction (angle-bracket placeholders), identifiers are completed only in the downstream EDR, and the PHI screen is a filing gate rather than an access control. /home/user/catcorner22/dental/src/lib/assist/non-goals.ts states plainly that a patient database 'is the one thing its entire privacy argument rests on not having'. The merged PMS inverts this premise, so none of the PHI machinery can be inherited unexamined — but all of it is reusable as an OUTBOUND BOUNDARY control.
- THE PHI GATE ON THE AI PATH IS THE STRONGEST PATTERN HERE AND SHOULD SURVIVE VERBATIM. In /home/user/catcorner22/dental/src/lib/assist/service.ts, ANY phi finding blocks the model call — not just S0 — with the explicit reasoning that an S2 bare name is a reviewable finding in-app but an unreviewable disclosure once it is off-server. There is no override path. The route (/home/user/catcorner22/dental/src/app/api/assist/route.ts) runs server-side only; CSP connect-src stays 'self' so the browser never talks to a provider. For a PHI-holding PMS this becomes: PHI may exist in the record, and this gate decides what crosses to a third party.
- NO NOTE CONTENT IS EVER LOGGED. drift.ts records only capability, prompt version, model identity, rejection CODES (all constants from the codebase), token counts, and fact counts. The assist route logs an action but not the text. grep across src/lib/{assist,audit,standardize,extract,verify,dictation,modules,vocab} finds console statements only in two test/eval files. This discipline is the right default to carry forward and is easy to lose.
- MODEL IDENTITY IS TREATED AS A SECURITY-RELEVANT FIELD. drift.ts calls 'anthropic/claude-sonnet-4.5' a pointer, not a version, and records what actually answered each call so a behaviour change can be attributed. For a PHI product this is also the audit-trail field a BAA review will want.
- PSEUDONYMIZATION IS CORRECTLY REASONED. /home/user/catcorner22/dental/src/lib/audit/maskPhi.ts uses crypto.getRandomValues rather than a hash or any function of the input (a derived token is re-identifiable and therefore still protected data), is consistent within a note so the note still reads, and is deliberately INCONSISTENT across notes so masked tokens cannot become a durable linking key across a corpus. The alphabet excludes O/0, I/1, L, S/5. This is the level of thinking a de-identified research/benchmark export in the PMS will need.
- SERVER RE-RUNS THE AUDIT; THE CLIENT GATE IS ADVISORY. The submit route re-runs runAudit + computeGates and returns 422 on any open S1, and the email route re-runs the text audit server-side 'so a tampered client cannot bypass it'. The assist route re-reads the clinical role from the database rather than the token ('a licence gate the client could set is not a gate'). This client-advisory/server-authoritative split is the correct pattern and should be the rule for every PHI-affecting action in the PMS.
- PHI DETECTION IS EXPLICITLY HEURISTIC AND SAYS SO. The header of phi.ts: 'It helps; it cannot certify de-identification.' Any compliance claim built on it must carry that caveat. It also has known false positives that were only found by building a corpus (implant lot numbers as SSNs, scanner serials, '#557' bur numbers) — a reminder that a PHI screen tuned for recall will block legitimate clinical content.
- OBFUSCATION-AWARE INPUT SANITIZATION IS PRESENT AND UNUSUAL. standardize.ts strips soft hyphen, Arabic letter mark, zero-width and bidi controls, LRI/RLI/FSI/PDI isolates, variation selectors, interlinear annotation, and the Unicode TAG block (U+E0000-E007F), and folds all Unicode decimal digits to ASCII. The stated reason is that an SSN written in Arabic-Indic digits or split by a zero-width joiner reads normally to a human and is invisible to every \d-based rule. This same class of attack applies to prompt injection and to anything that pattern-matches PHI on the way out.
- MARKDOWN INJECTION INTO THE FROZEN LEGAL RECORD IS DEFENDED. composeNote.ts sanitizeUserText() escapes '<' everywhere and every markdown block starter, clamps leading whitespace to 3, and handles setext underlines and unterminated comments/fences — because the frozen note is emailed as a .md attachment where a forged 'Submission record' heading, or a '<!--' that erases the allergy block from the rendered view, would be believed. Any PMS that renders or exports user text into a document format inherits this exact risk.
- AI IS OPT-IN PER DEPLOYMENT WITH TWO INDEPENDENT SWITCHES. getAssistConfig() requires both ASSIST_ENABLED=1 and AI_GATEWAY_API_KEY; a key present without the flag means 'an operator added credentials without turning the feature on' and the feature stays off. Defaults are asserted by test. Good default-deny posture to keep.
- THE ASSIST ROUTE HAS RATE LIMITING, THROTTLING, INPUT CAPS, AND A PROVIDER TIMEOUT (40 free runs per user, MAX_INPUT 20,000, PROVIDER_TIMEOUT_MS 20s under maxDuration 30s) — cost control that doubles as abuse control.
- SHARED-DEVICE RISK IS ACKNOWLEDGED IN THE UI. /home/user/catcorner22/dental/src/components/builder/SharedTabletIdleLock.tsx exists specifically for operatory tablets. In a PHI-holding product this becomes a mandatory automatic-logoff control (HIPAA 164.312(a)(2)(iii)) rather than a nicety, and the timeout needs to be policy-configurable and audit-logged.
- DICTATION IS THE OPEN PHI QUESTION. The shipped engine sets offDevice: true — browser SpeechRecognition may transmit audio to a vendor. Today that is tolerable because the text is de-identified and no BAA-covered content is spoken. In a PMS where a hygienist dictates 'Mrs. Patterson reports...', audio becomes PHI and biometric identifying data, requiring either the planned on-device Whisper engine (the interface seam already exists) or a BAA-covered vendor. availability.ts already carries a NEXT_PUBLIC_DICTATION_DISABLED kill switch.
- NO ENCRYPTION, KEY MANAGEMENT, FIELD-LEVEL PROTECTION, OR TENANCY BOUNDARY EXISTS IN THIS SUBSYSTEM. That is consistent with holding no PHI, and it means the PMS must add all of it: encryption at rest and in transit, per-tenant isolation on every query, break-glass access, and a PHI-access audit log distinct from the existing action log. The clinical core as written has no concept of 'who may read this note' — only 'who may write which section' (clinicalRoles + scopeGuard).
- THE FROZEN-RECORD DISCIPLINE IS A REAL COMPLIANCE ASSET. Submissions are immutable (e2e/submission.immutability.mjs), audit status and RULESET_VERSION are stamped at filing, statusLabel() returns unknown stored values verbatim rather than guessing, and the transformer rules forbid migrations that rewrite filed note or audit text. This is the correct amendment/addendum posture for a legal record and maps onto the late-entry module.

## Product insights

- THE CORE PRODUCT THESIS IS TRANSFERABLE AND UNUSUAL: a documentation tool that REFUSES rather than scores. 'The model proposes, the rails dispose.' There is no confidence percentage anywhere — non-goals.ts argues a score is worse than a binary refusal because '84% confident' invites a tired clinician to accept it, and a threshold is 'a knob someone lowers when the refusals get inconvenient'. The audit never returns a percentage or claims a note is complete or compliant.
- SEVERITY IS A SAFETY VOCABULARY AND IS PROTECTED AS ONE. Five levels with fixed meanings ('S2: Open review. Does not block Copy. Does not mean finished'), one shared colour ramp used by every surface (deduplicated after AuditPanel and Standardizer drifted apart and rendered the same finding two different colours), a non-colour shape channel for CVD, and an explicit rule that the odontogram may NOT use severity colours because 'a chart that paints an ordinary composite in amber teaches the eye that amber is decoration'.
- ALERT-FATIGUE ARITHMETIC IS THE DESIGN CONSTRAINT, WITH NUMBERS. Drug-allergy alerts are overridden 87.6% of the time and repeated alerts 12 points harder than first-time ones; a shipped commercial laterality-contradiction checker ran at 36% precision. These figures are cited in code and drive concrete decisions: only two contradiction pairs exist and a third 'does not get added until the first two have a measured precision on real notes'; the shorthand gate is tiered rather than blanket; blocking false positives are held at ZERO rather than 98%.
- THE ESCAPE HATCH IS NAMED AND COUNTED, NOT CLOSED. Four omission licences (not applicable / not assessed / unknown / unresolved) with distinct precise meanings, counted per note, surfaced to the writer before filing and to a Team Lead as a rate — the MPDS pattern of putting the shortcut INSIDE the protocol so it is finite and manageable. Directly applicable to every PMS field a busy person clicks past and to Precog's control-override tracking.
- READBACK AS A SAFETY MECHANISM, IN TWO FORMS. The odontogram is 'the note said back in pictures' so a transposed #14/#41 becomes a mark in the wrong quadrant; readbackClass.ts is an ICAO-style human hearback of tooth/surface/site/drug/dose/unit tokens confirmed on Apply. Both come from aviation and emergency-dispatch practice and both are cheap to build.
- POKA-YOKE IN THE CONTROL BEATS A RULE AFTER THE FACT. SurfacePicker disables anatomically impossible surfaces per tooth so the S0 anatomy rule 'rarely even fires'; ToothPicker opens on the dentition of the stored value so a saved primary tooth is never invisible; optionalTeeth() routes optional sites through the validated picker so they fall under the wrong-site guard instead of living in free text.
- PATIENT VOICE AND RECORD VOICE ARE OPPOSITE, AND THE SYSTEM MODELS IT. `audience: "patient"` switches the plain-language rule ON and the abbreviation/jargon machinery OFF, and the engine suppresses STYLE abbreviation findings that exist only in patient-facing text — because otherwise the tool demands 'x-ray -> radiograph' and 'radiograph -> x-ray' simultaneously and the writer cannot satisfy it. Any PMS that generates both a chart note and a patient summary needs this distinction.
- CAPABILITY FOLLOWS LICENCE, AND THE FALLBACK IS NEVER NOTHING. Every AI capability has a deterministic twin that ships in the repo, so an auxiliary who may not record judgement still gets an answer ('the deterministic checks answered'), never a refusal. tierExplanation() writes the sentence in terms of what would change it. This is a far better multi-role UX than greying out a button.
- THE NOTE IS A CLAIM'S EVIDENCE, AND THE TOOL SAYS SO WITHOUT TOUCHING CODES. justification.ts checks that the narrative contains what carriers require (probing depths >= 4 mm and bone/attachment loss for SRP; insufficient retentive structure for a buildup; necessity for a crown) while writing no CDT code, on the reasoning that 'the narrative that will justify those codes is written HERE, and this is the last place a gap is cheap to fix'. This is the natural bridge between the clinical module and the claims module of the merged PMS, and it targets the market's #1 unmet need.
- COMPLETENESS RULES ENCODE DEPOSITION FAILURE PATTERNS, NOT A CHECKLIST. Each is trigger-plus-satisfiedBy so it only fires when the note's own content raises a question it then fails to answer: images acquired but never interpreted, an anesthetic named without an amount, consent discussed without a decision, 'patient consented' without any risks/alternatives/questions (checkbox theater), a procedure without rationale, a referral without a recipient, a lesion without a disposition. Sourced to Doctors Company claim-file research.
- MESSAGES EXPLAIN WHY THE LINE STOPPED, ALWAYS. The stated tone is 'cold logic, zero condescension: state WHAT was found, WHY the line stops, HOW to move.' Interaction findings name the mechanism ('metronidazole inhibits warfarin metabolism (CYP2C9)'), the shorthand gate explains why 'BW' is fine and '10U' is not, and the assist PHI block explains why the same finding is S2 elsewhere and a hard stop here — 'a rule that looks arbitrary is a rule that gets worked around'.
- SHORTHAND IS A FEATURE TO SUPPORT, NOT A HABIT TO PUNISH. The gate's own header: refusing every abbreviation 'is slower than a blank text box', and expanding a do-not-use abbreviation 'launders it' — the note reads clean, the reader is reassured, and the dangerous writing habit survives. Tier 1 costs the writer nothing; only genuine ambiguity blocks.
- PROSE AND STRUCTURE COEXIST INSTEAD OF COMPETING. The 2.25.0 changelog documents merging a separate free-text page into the note as five narrative fields, with the Assessment and Plan narratives placed INSIDE the dentist-owned sections so the existing scope lock, audit tailoring, and filing checks cover prose without learning a new rule. Deliberately not required, because 'a gate that opens for prose is not a gate'. This is the right answer to the click-heavy-vs-freeform tension the market research identifies.
- PASTE IS A FIRST-CLASS ENTRY MODE WITH A HUMAN IN THE LOOP. PasteIntake sorts pasted prose into SOAP, standardizes it, audits it, shows a diff, and then requires one click per destination — nothing auto-fills. This is also the shape a legacy-note migration tool should take.
- THE VERSION CHANGELOG IS A PRODUCT ARTIFACT. /home/user/catcorner22/dental/src/lib/version.ts records not just what changed but the harm prevented and the defect found — including embarrassing ones (a hygiene module's own help text failing the app's own shorthand gate; a bug window where notes were filed under a version that did not describe the rules that ran, 'the exact failure this constant exists to prevent'). This candour is a trust asset for a compliance-adjacent product.
- ADVERSARIAL PERSONA REVIEW IS THE METHOD BEHIND MOST NON-OBVIOUS RULES. 20 'hate panel' digests in knowledge/sources/ (privacy attorney, IT security, TN board investigator, insurance auditor, chairside DA, RDH labor/surveillance, CVD/dyslexia, accessibility advocate, front desk, practice owner). The RDH surveillance/labor panel in particular is a warning worth carrying into a PMS that will hold productivity data.
- DICTATION IS FRAMED AS ENTRY ASSISTANCE, NOT TRANSFORMATION, WITH AN HONESTY FLAG. `offDevice` is described as 'load-bearing UI truth' and rendered as a warning; availability messages name the thing that would fix the problem ('This browser cannot do speech recognition. Chrome, Edge and Safari can.'); enrollment is preview-only until the writer has actually heard how the engine handles dental words. The enrollment duration was CUT from 3 minutes to 90 seconds after discovering Chrome does no per-speaker adaptation from a web page — an honest correction of a feature's own premise.

## Test and ci posture

["SCALE: 201 test files under src/ (roughly half of the subsystem's ~34,000 LOC is test code), plus 16 Node-driven e2e scripts in /home/user/catcorner22/dental/e2e/ (setup.firstboot, prehydration.login, mfa.totp, lockout, account.lifecycle, conflict, dictation, email.assist, export.aioff, phi.mask-override, submission.immutability, headers, hydration.clean, ttfa, crossbrowser.smoke). Runner is vitest (node-only over src/**/*.test.ts) with jsdom + @testing-library for components.", "CI (/home/user/catcorner22/dental/.github/workflows/ci.yml): checkout with fetch-depth 0, `npx tsc --noEmit`, `npm test` (full suite), the version-stamp guard, then `npm run build`. A second non-blocking `cross-browser` job drives the production build in Chromium, Firefox, and WebKit with a 15-minute timeout added after a job hung for 25 minutes and read as 'still working'.", "THE VERSION-STAMP GUARD IS THE STANDOUT CI CONTROL. On every PR it diffs against the base branch and FAILS if src/lib/{vocab,modules}/ or src/lib/audit/{rules/,maskPhi} changed without touching src/lib/version.ts; likewise assist/prompts.ts without ASSIST_PROMPT_VERSION, and db/ddl.ts without SCHEMA_BOOT_VERSION. The rationale is stated in the workflow: a rules change under an unchanged version 'makes every stamped audit report a lie about which rules actually ran'.", "STORM-FIRST DISCIPLINE IS CODIFIED. /home/user/catcorner22/dental/.cursor/rules/transformer-development.mdc mandates writing the adversarial case BEFORE the implementation (casing, plurals, sentence boundaries, medical-history collisions of the NKA/FMS/Coe-Pak class, idempotency x3), then tsc, then the FULL suite, then build, then a commit message stating the harm prevented.", "PROPERTY AND INVARIANT SUITES: /home/user/catcorner22/dental/src/lib/standardize/property.test.ts, meaning.test.ts, adversarial.test.ts, reliability.test.ts, usefulness.test.ts, zz-adversary.test.ts, plausibility.test.ts, dose-safety.test.ts, plural-counts.test.ts, partition.test.ts. structure.test.ts asserts the byte-identical sentence-partition invariant on every case.", "ADVERSARIAL-MODEL TESTING FOR THE AI PATH: the model is an injected function, so /home/user/catcorner22/dental/src/lib/assist/service.test.ts and drift.test.ts bind adversaries that fabricate doses, invert negations, add attributions, and return wrong shapes, and assert refusal. /home/user/catcorner22/dental/src/lib/verify/redteam.test.ts (360 LOC) is the dedicated verifier red team. Tests never bind a live provider.", "PROMPTS ARE TESTED AGAINST THE VERIFIER AT BUILD TIME: worked examples are exported as data and prompts.test.ts runs each through verifyMeaning, so 'an exemplar that teaches behaviour the verifier would refuse is a bug this suite catches at build time, not a refusal a staff member meets at run time'.", "MEASURED EVALUATION HARNESSES, NOT JUST UNIT TESTS: audit/precision/ (zero blocking false positives across 34 hazard-loaded notes; advisory-per-note rate ratcheted), extract/coverage.test.ts (clause parse rate ratcheted at 94.6%, up from 26.2%), extract/unparsed-routing-eval, standardize/disambiguation-eval, assist/evals/{cases,scorer} gating falseRefusalRate <= 0. Each harness makes the scored function injectable so a candidate ruleset can be evaluated before promotion.", "SELF-CONSISTENCY / DOGFOOD SUITES: /home/user/catcorner22/dental/src/lib/modules/self-consistency.test.ts asserts the app's own standard phrases pass its own spell check, that no module text uses British spelling, and (per the changelog) that the app's own help text does not trip its own shorthand filing gate — a real defect class that shipped twice.", "REGRESSION-BY-STORY CONVENTION: nearly every bug fix is a pinned regression test plus a comment at the fix site telling the story of the bug. phi-regressions.test.ts, phi-evasion.test.ts, phi-names.test.ts, phi-spans.test.ts, newline-boundary.test.ts, and severity-style.test.ts are examples.", "PERFORMANCE IS TESTED BUT NOT BUDGETED IN CI: performance.test.ts (50 LOC) and engine-keystroke.test.ts (110 LOC) exist, and the 2.16.0 changelog documents a 12-second keystroke found by 'a hostile stress battery, not by a user'. There is no enforced latency budget in the pipeline.", "GAPS: no coverage threshold is enforced; no mutation testing; no visual-regression or automated a11y assertions on the Odontogram SVG; no load/soak testing; the cross-browser job is continue-on-error so a Safari regression cannot block a merge; no dependency/SCA or secret-scanning step in the workflow; no test that a draft saved under an older module schema still round-trips."]

## Open questions

- Does the PHI screen become an OUTBOUND boundary control (what may cross to an LLM, an analytics pipeline, a support ticket, a de-identified export) while patient identifiers become first-class fields in the record? If so, which S0 phi rules become informational, which become boundary-only, and what replaces the attested override flow?
- Does the merged PMS build a real six-point periodontal chart, or keep the summary-measures model and integrate with an external charting surface? The market research names perio-at-hygiene-speed as a top-3 need and this codebase explicitly declines to build it ('this tool does not pretend to replace it').
- Is the `ambient-dictation` non-goal deliberately retired? Every major competitor ships voice notes / voice perio, the swappable DictationEngine seam already anticipates on-device Whisper, but the current engine is offDevice and would need a BAA or a local model before it touches PHI. Who decides, and is the decision recorded the way the other non-goals are?
- How does the module/field schema get versioned and migrated once notes are permanent chart entries tied to patients? Field ids are string keys into a value bag with no deprecation registry, no migration mechanism, and no round-trip test against older module sets.
- Does the odontogram become an editable chart with existing-conditions state and per-surface history, or stay a readback? If editable, what supplies the historical/current distinction that extract/facts.ts deliberately refuses to guess?
- What is the jurisdiction model? TN law is hardcoded into rule bodies (the 2027-01-01 supervision date, the CSMD/PMP opioid rule), module helpText, and clinical-role scope reasoning. A commercial PMS needs per-state rule sets, per-state supervision matrices, and a maintenance process for them.
- Do practices get to configure the ruleset (enable/disable rules, adjust severities, author custom rules)? If yes, how is RULESET_VERSION provenance preserved when the effective ruleset is per-tenant, and how does the precision harness score a configuration it has never seen?
- Which module content maps onto CDT procedure codes, and does the PMS auto-suggest codes from the note or keep the current hard separation ('the practice writes no billing codes in this tool')? The justification rules already check carrier criteria without naming codes — is that the boundary, or the first step past it?
- Where do Smile Notes' clinical severity findings and Precog's control/residual-risk findings converge? Both are finding-list products with severity, attestation, and remediation tracking; a single findings model (clinical + operational + financial-control) would be a real differentiator, or a category error. Which?
- What does the note look like when it has a real patient, a real appointment, a real ledger, and a real claim beside it? The current NoteState is context-free; the completeness and justification rules would get materially stronger with access to the scheduled procedure, the prior visit, the insurance plan, and the medication list — but each of those couplings weakens the 'pure function of its arguments' property the whole engine rests on.
- Does the AI layer keep the refuse-don't-score posture, and does verifyMeaning govern every AI surface in the merged product (note assist, claim narratives, patient messages, Precog's Grok-based coach)? Precog uses a different provider and a different trust model; are they reconciled?
- What replaces 'the identifiers live in the EDR' as the product's privacy story in sales and in the module helpText? Roughly a hundred user-visible strings currently promise something the new product will not do.
- Is BuilderShell decomposed before or after the PMS entities land? It is already 2,127 lines and the merged product will want scheduling, ledger, claim, and imaging context in the same view.
- What is the retention, amendment, and legal-hold model for filed notes once they are the practice's system of record rather than a draft feeder into an EDR? The immutability discipline and the late-entry module exist, but there is no retention policy, no legal hold, and no patient-record-request export.
