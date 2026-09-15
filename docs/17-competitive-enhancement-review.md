# Competitive enhancement review and Phase 0 increment

> Source: owner review of 2026-09-14. The owner asked for a comprehensive, beautiful, low-cognitive-load dental PMS with an industry-leading one-way SuperByte note advisor (twin deterministic and probabilistic knowledge bases; see Smile Notes) and a novel Precog risk-avoidance module. Two decisions lock this document: start Phase 0 of the real product, and keep SuperByte one-way (staff never prompt, chat, or rate). Evidence for market claims is the v3 knowledge base (`knowledge/dental-pms-and-risk-platforms-report-v3-2026-09-02.md`, `knowledge/semantic-memory.md`). Legal statements inherit the PRIMARY / SECONDARY / REPO / UNVERIFIED labels from `docs/11`.

This repository remains a consolidation plan plus a clickable prototype. Increment 0.1, recorded here, is the first code foundation of the merged PMS. Owner-only Phase 0 items (BAA, hosting contract, 24-month budget, D.8 interviews) stay listed, not silently marked done.

## Current state

| Layer | Status |
|---|---|
| Vision, architecture, data model, 25 ADRs, 30-feature catalog | Complete (planning session 2026-09-03) |
| Clickable prototype (`prototype/`) | Seven persona homes, five daily flows, 117 UX heuristics, 0 axe violations in 144 contexts |
| Production PMS (`apps/pms`, packages) | Starts in this increment |
| Smile Notes (`CatCorner22/dental`) | External; ~34k LOC clinical core, 201 test files; de-identified by design |
| Precog Pioneer (`CatCorner22/precog`) | External; ~4,700-line engine, zero tests, localStorage, broken home route |

The existing plan is already stronger than most greenfield PMS briefs. The gaps versus the five goals are sequencing, knowledge-base depth, visual ambition, and a broader definition of risk-avoidance — not a missing module list.

## Competitive position

Incumbents a GP will compare you to: Dentrix, Eaglesoft, Open Dental, Dentrix Ascend, Denticon, Curve SuperHero, CareStack. Adjacent AI: Curve Care+, Dentrix Voice Notes / Detect AI, Denticon Voice Perio, Pearl / Overjet / VideaHealth. Adjacent risk: Zeldent (observe-only bank-to-PMS recon), Abyde / Patient Protect (HIPAA/OSHA), Prosperident (forensic, after the loss).

**Where incumbents win today.** Hiring-pool familiarity (Dentrix / Eaglesoft). Insurance plumbing and clearinghouse years (HS1, Open Dental, Curve unlimited eClaims). Ambient / voice charting already shipping (Ascend Voice Notes and Voice Perio, Curve Care+, Denticon AI Voice). Native imaging and sensor lists. Patient comms, portal, and eRx in the base or as a known add-on.

**Where this product can win if it ships what is already designed.**

- A ledger both the window and the CPA can read after dual coverage and partial payments. No harvested review praises any incumbent for that.
- Controls that refuse inside the posting transaction. Zeldent and every PMS audit trail can only observe; Precog today only calculates. The PMS is the only host that can block the $410 courtesy write-off.
- Chairside notes whose evidence is a versioned deterministic gate (`RULESET_VERSION`, `verifyMeaning`, encounter FK), not a template the biller retypes into the claim.
- Published rate card, year-two price, no-fee exit including DICOM, no per-use AI metering — the cheapest differentiators, and the ones tab32 and Dentrix/Eaglesoft lose on.

**Where the plan was behind the market narrative (corrected below).** SuperByte sat in Phase 5 and Byte's knowledge table is 23 entries. Precog was specified as financial SoD / dual-release / COSO, not clinical and compliance near-miss avoidance. The visual system is NHS / GOV.UK-grade: extremely usable, not yet beautiful. A controls-only public identity would be compared to Zeldent and lose on price.

## Five public pillars

These are the product's public pillars. They do not replace the three structural bets in `docs/01` (readable ledger, enforced controls, chairside record). They name what a buyer and a daily user should be able to say about the software.

1. **A comprehensive GP practice-management system.** Independent general practices, 1–3 dentists at launch, Tennessee first. The Trust page publishes an honest In / Later / Not list so "comprehensive" is not a silent promise of ortho, OMS, or TennCare.
2. **Aesthetically beautiful and modern.** The 117 heuristics, 44 px glove floor, two button identities, and monotonic severity ladder are floors. Beauty is a layer that does not add choices: quieter chrome, one editorial display face for h1 only, more generous rag on worklists, signature empty states that still name the next verb. Encounter density is decomposed, not decorated.
3. **Industry-leading minimization of cognitive load.** Home is the work. One primary action per row. Byte on the note so the completeness checklist is not held in working memory. Palette with incumbent vocabulary so hiring-pool familiarity is a search problem, not a training problem.
4. **SuperByte, one-way, with a twin knowledge base.** Staff never prompt, chat, or rate. The deterministic Byte twin and a versioned, cited knowledge base ship as packages in Phase 0 and appear on the Encounter in Phase 3. The SuperByte cage (killswitch, dual PHI scan, N-read consensus, `verifyMeaning`, evidence quotes, audit row with no note text) ships in Phase 0 with the provider call still Phase 5. Ambient scribe is ceded short-term; PTT voice stays Phase 5. Never claim "AI-powered." Never meter. Never show a confidence percentage. Never train on filed notes.
5. **Precog as risk-avoidance, not a heat map.** One Practice Risk surface that prevents the next bad action: financial (dual release, SoD grant refusal, bank-tied close), clinical (killers, encounter FK, chart/note/claim contradiction, open referral, undispositioned tag), compliance (BAA registry now; HIPAA/OSHA program after counsel). Never score people. Military and "threat assessment" vocabulary stays deleted.

## In / Later / Not (Trust page copy)

**In by GA (already in the module map).** Tenancy, patients, Board, encounters, odontogram, six-point perio, treatment plans, readable ledger, checkout, membership and payment plans, eligibility, claims, ERA, denials, lab cases, referrals, imaging import, confirmations, reports that reconcile to the ledger, conversion, exit export.

**Later (do not pull into Phase 0–1).** eRx, portal, two-way text, online booking, digital intake, voice perio, sensor bridge, groups/SSO, public write API, specialty modules, TennCare.

**Not at launch (say so).** Inventory, time-clock, and payroll as a system of record; marketing and reputation; teledentistry; Canada; DSO enterprise.

The Phase 1 shadow-ledger wedge stays. It is how the novel thesis gets a falsifier before claims and notes exist. Frame it as "the money layer of the PMS, run beside your current system," not as a separate product name.

## SuperByte and the knowledge base

Industry-leading here is the twin, not the model. Curve and HS1 already sell ambient notes. A 23-entry advisor cannot compete on that headline. A versioned, cited, module-mapped corpus that a counsel can review, plus a cage that refuses unsafe rewrites, can.

| Layer | What it is | When it ships |
|---|---|---|
| Deterministic Byte | Pure `advise()` over a versioned, cited knowledge base; gauges are presence-only, never a percentage | Package in Phase 0 (`packages/clinical-kb`); on the Encounter in Phase 3 |
| Knowledge base | Grow from 23 entries to a module-mapped, counsel-reviewable corpus (completeness, justification, med-safety, TN scope, claim-narrative, omission licences) | Authoring starts in Phase 0; `KB_VERSION` stamped |
| SuperByte cage | One-way, killswitch, dual PHI scan, N-read consensus, `verifyMeaning`, evidence quotes, audit row with no note text | Cage and twin CI in Phase 0; provider call Phase 5 |
| Ambient scribe | Cede the marketing lane short-term; PTT voice behind the existing `DictationEngine` seam | Phase 5 |

Hard rules: `BYTESTAR_ENABLED` defaults off; no provider key is required to boot; SuperByte must not auto-fire on every keystroke (the 3-read cost model in explorer-05 is a standing risk); one-way stays server-enforced.

## Precog as Practice Risk

Zeldent watches the bank. Abyde writes HIPAA policies. Precog today scores demo data. The novel module refuses or records from live `domain_event` rows.

- **Financial (enforced in Phase 1).** `evaluateRelease` and `detectSodConflicts` port in Phase 0 onto `PracticeState`; they refuse inside the Postgres posting transaction in Phase 1.
- **Clinical (avoidance in Phase 3).** Smile Notes killers, encounter FK, contradiction stop. A missing interpretation, open referral, or undispositioned hygienist tag is a Board or Exams row, not a weekly PDF.
- **Compliance (boundary now, program later).** `integration_registry` requires a live BAA row before a connector enables (Phase 0). HIPAA/OSHA program stays Phase 4 after counsel.
- **Math on port.** Timeline sign, counterfactual ignoring variables, beam-search dropping the status quo, `waive_dual` infinity leak. Golden and monotonicity tests before any score is shown. Constants labelled directional until a CPA calibrates them.

## Beauty and cognitive load

The prototype already leads the category on measurement: controls above the fold 530 → 293; chip vocabulary 103 → 48; five flows inside tap budgets; 0 axe violations. `docs/16` treated "modern" as a byproduct of restraint. Beauty is now a goal that may not violate those floors.

- Keep cream / navy / teal (Daylight chart). Do not copy Linear's 28 px targets or dashboard ornament.
- Tokens stay the contract: `prototype/css/tokens.css` becomes `apps/pms` theme via the dental `design-tokens.json` pipeline.
- The remaining density problem is Encounter (58 controls above the fold). `BuilderShell.tsx` (2,127 LOC in Smile Notes) must not land as one screen.
- Next load reductions are product, not CSS: Byte on the note; one primary action per row enforced by the gate-contract CI (feature 29); paint-once-write-four-records; palette synonyms.

## Decisions accepted in this increment

| Decision | Status | Amendment |
|---|---|---|
| ADR-0002 (what ships first) | **Accepted** | Money and controls first as GTM (report-import shadow ledger). Product identity is the full PMS from the first public page. |
| ADR-0012 (AI assist timing) | **Accepted, amended** | LLM provider call remains Phase 5 behind a BAA. Byte, `packages/clinical-kb`, and the SuperByte cage ship in Phase 0. SuperByte stays one-way. |
| Other ADRs | Proposed | Stand unless Increment 0.1 forces a pin (NextAuth v5 beta, Tailwind 3). |

## Increment 0.1 (this engagement)

Phase 0 as written is 8–10 weeks plus legal pack, budget, and D.8 interviews. This increment is the code foundation only.

- `apps/pms` — Next.js 15 App Router, React 19, TypeScript, Tailwind 3. Sign-in and empty shell. `withGuard` plus a CI glob that fails on a bare route export.
- `packages/clinical-core` — lift audit, vocab, modules, verify, extract, standardize, compose, readback. `runTextAudit` stays pure.
- `packages/clinical-kb` — Byte `advise()`, versioned knowledge table, SuperByte cage with `BYTESTAR_ENABLED` default off.
- `packages/controls-engine` — SoD, dual-release, residual, COSO, signals on `PracticeState`; known math bugs fixed; golden, monotonicity, and zero-app-import tests.
- `packages/db` — Drizzle tenants, locations, users, sessions, entitlements, `domain_event`, `phi_access_log`, `integration_registry`. RLS. No PHI patient rows yet.
- `packages/verifier` — byteaudit retargeted at chain verification and an RLS negative test.
- Auth: lifted dental guards, mandatory TOTP, sessions table, envelope-encrypted MFA secret (dev: local key).
- Prototype and its harness stay green.

**Not in Increment 0.1.** Ledger UI, claims, Board, imaging, hosting/WAF, real KMS, Object Lock, legal pack, D.8 interviews, product name, clearinghouse contract.

## Risks that stay visible

- Lifting Smile Notes tests while inverting the PHI premise will fail some of those tests; they become a tracked rewrite list, not a reason to leave PHI-blocking rules in place.
- Precog math is illustrative. Shipping scores before golden tests is a liability.
- SuperByte's 3-read cost model must not auto-fire on every keystroke in a PHI product.
- Solo-team capacity: Increment 0.1 is the only honest Phase 0 slice for one engagement. Decision 23 (budget and staffing) is still the gate on Phase 1 durations.
