# Design judge 2: feasibility and engineering risk for a small team (winner: controls-trust)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 14 (Design phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, design, judge, feasibility-and-engineering-risk-for-a-small-team

## Summary

Scored the four design lenses from the feasibility and engineering risk for a small team viewpoint; winner controls-trust.

## Judge lens

feasibility and engineering risk for a small team

## Scores


### Item 1
- **design lens**: mvp-sequencing
- **score 0 10**: 7.5

#### strengths
- Most concrete, file-level migration manifest (verbatim lift / rewrite / delete lists for both repos) — this is directly executable by one developer and matches what actually exists on disk (guards.ts, gamify.ts, submissions.ts, byteaudit/, dual-release.ts, detect.ts).
- Correctly puts controls enforcement (postGuarded) INTO the ledger phase rather than retrofitting it later, and mandates ledger allocation property tests before UI.
- Cheapest-first wins explicitly called out as decisions not builds (rate card, exit terms, status page) and the CI route-glob guard test closes a real bug class the repo already shipped (unguarded GET /api/bytestar).
- Honest about solo-owner capacity ('durations are estimates, not commitments'), about SOC 2 lag, and about the design partner (Cornerstone) being larger than the target — advises piloting one location first.
- Bounded offline (read-only degraded mode in v1) is the least engineering-risky offline position of the four.
- Starts payer EDI enrollment and clearinghouse contract one phase early — a genuine schedule de-risk that the others miss.

#### weaknesses
- v1-core is enormous: ~14 modules including bank reconciliation, Open Dental importer, treatment-plan estimate engine, patient comms — for a single primary developer this is ~12 months before anything is sellable, and Phase 0 (6–8 weeks) alone bundles RLS, sessions, hash chain, KMS, controls-engine port with golden tests, container deploy, and BAA procurement.
- Clinical-first sequencing means the novel, unproven bet (readable ledger + enforced controls) is not tested until month ~5–8; the clinical port is the LEAST risky code because it already exists, so it is spending the earliest, most valuable weeks on the lowest-uncertainty work.
- Phase 3 exit criterion requires a second PAYING practice converted from Open Dental with a published fixed price — that is a sales and conversion-services milestone, not an engineering one, and it will slip the phase.
- Phase 1 exit criterion asks a practice to run a full clinical day in parallel with its incumbent — parallel clinical charting is a heavy ask for a design partner with no billing in the new system.
- Keeps NextAuth v5 beta and Tailwind 3 without addressing that next-auth 5.0.0-beta.32 is a beta dependency for a PHI system.

### Item 2
- **design lens**: persona-ux
- **score 0 10**: 5.5

#### strengths
- Best measurable exit criteria of the four: click budgets per flow, biller/CPA ledger-reading probe with task-success threshold, perio single-operator timed simulation, zero-cleartext-after-logout inspection — these convert UX intent into pass/fail engineering gates.
- Explicit warning to keep runTextAudit pure and pass tenant/encounter as arguments when threading context through the note engine — a real refactor-risk mitigation for the BuilderShell decomposition.
- Correctly identifies that the exception system (payee/person/date-scoped, expiring) must ship WITH dual release, not after, or the control gets disabled in week one.
- Structural encounter FK and shared-device profile are well specified and low-cost.

#### weaknesses
- Longest path to signal: 68 weeks to pilot exit, with a 10-week Phase 0 that includes 24–30 persona interviews — for a small team the calendar cost of a dedicated research phase is high and delays code that would generate the same learning via a pilot.
- Controls engine (precog's entire contribution and the differentiator) is sequenced LAST of the core phases (weeks 40–52) and dual release is added to a ledger that already shipped in Phase 2 — retrofitting a refusal gate into an existing posting path is precisely the kind of change that leaves a bypass.
- Phase 2 stacks the two hardest builds (ledger AND clearinghouse/eligibility/837/835) into one 16-week phase.
- Voice perio in Phase 1 depends on an on-device Whisper WASM engine that does not exist in either repo, or a BAA STT vendor — the design flags this itself as a slip risk and then schedules it first anyway.
- Adds surface area a small team does not need yet: Radix primitives, TanStack Query, two-region active/passive hosting, and a full design-system re-expression of precog panels.
- Phase 0 'parallel' research plus 'ledger-layout preference measured' as an exit criterion is unfalsifiable as an engineering gate.

### Item 3
- **design lens**: domain-data-model
- **score 0 10**: 7

#### strengths
- Strongest correctness-by-construction: ten ledger invariants enforced in the database (balanced entries via deferred constraint trigger, INSERT-only role, reversal must mirror original, allocation ≤ payment, approval-required entries must carry an approved request id, balances as views only). Pushing invariants into Postgres is the single best way for a small team to shrink the class of bugs it can ship.
- Transactional outbox as the ONE event source for audit, PHI log, controls engine, detectors and notifications — eliminates 'logged by convention at call sites'.
- Controls hooks (evaluateRelease, approval_request, SoD from grants) land in the same phase as the ledger, so there is no retrofit.
- Derived StaffComposition and measured (not asserted) independentBankRec fix precog's double-bookkeeping and self-assertion problems concretely.
- Shadow-DB migration check in CI and 'schema.ts changed without a migration file fails the build' preserve the owner's existing version-guard discipline.
- Explicitly states 'Phases 0–2 alone produce a usable clinical and financial core; resequence everything after Phase 3 against pilot data' — the most honest scoping statement of the four.

#### weaknesses
- Full double-entry GL (gl_account, journal_entry, journal_line) is the highest-complexity ledger of the four and requires accounting-domain design decisions (GL chart, deferred constraints, reversal mirroring) that a solo engineer without a CPA in the loop will get wrong at least once; the readability bet is then carried by the view layer, not the model.
- Over-engineered for a first tenant: monthly partitioning of two log tables, per-tenant KMS envelope keys, UUIDv7 everywhere, two-region containers, PGlite-over-OPFS encrypted replica, PgBouncer — each is defensible at scale and each costs weeks now.
- Compliance program (SRA, policies, training, BAA registry, sterilizer log, incidents, records requests, retention, legal hold) is v1-nice and lands in Phase 4 alongside bank reconciliation and COSO — that phase is under-estimated at 8 weeks.
- Clinical-first sequencing (same weakness as mvp-sequencing): novel bet validated late.
- Migration tooling and Open Dental importer pushed to Phase 5, so the first real practice cannot be converted until after everything is built.

### Item 4
- **design lens**: controls-trust
- **score 0 10**: 8

#### strengths
- Best sequencing for a small team: Phase 1 ships the readable ledger + dual release + bank reconciliation + SoD-from-grants as a financial layer that runs BESIDE the incumbent PMS, so the novel, unproven thesis is tested at ~month 5–6 with every line of code (tenancy, sessions, audit chain, ledger, approvals, reconciliation) reused in the full PMS. Failure is cheap and visible; success can be sold (Zeldent/Precog-class price band) before the PMS exists.
- Defers the largest port (the Smile Notes clinical core, ~90k LOC codebase) to Phase 3 — correct because it is the LOWEST-risk code (already built, 201 tests) and its value does not depend on the PMS thesis.
- Smallest v1-core of the four (perio/odontogram, treatment plans, compliance, imaging are v1-nice or v2), which is the only realistic posture for a solo owner.
- Retargets the existing sealed byteaudit verifier at ledger/day-close/audit-chain promises — reuses a tested tamper-evidence mechanism instead of inventing one.
- 'Tie-out or refuse go-live' (opening AR must equal incumbent to the cent) is a cheap, decisive conversion control.
- Denial-suppression detection and 'poster cannot clear own reconciliation' are concrete, implementable SoD rules that need no questionnaire.
- Engages the SOC 2 auditor at Phase 2 so the observation period overlaps the build rather than following it.

#### weaknesses
- The Phase 1 parallel pilot is enforcement-in-name-only: refunds and write-offs are actually posted in the incumbent PMS, so dual release can only be enforced on the shadow ledger fed by report import; the exit criterion 'every over-threshold refund has a second named approver' is therefore testing a mirror, not the practice's real posting path. The design should say so.
- Parallel running imposes dual data entry or a report-import ETL from Dentrix/Open Dental reports that is itself a small conversion project — unbudgeted in the 12–14 week estimate.
- Action-time SoD hard blocks inside withGuard ('a user who posted payments today cannot clear today's reconciliation') require per-request activity lookups and add latency/complexity to the one wrapper every route passes through.
- Total time to a full PMS (~60+ weeks) is no shorter than the others; the win is signal-per-week, not calendar.
- Proposes Tailwind v4 + Radix + ULIDs + zod-to-openapi + Object Lock WORM in Phase 0 — some stack churn that could be deferred.
- Clinical Phase 3 estimate (14–16 weeks for BuilderShell decomposition, PHI re-scope, editable odontogram, voice perio, treatment plans, imaging, records-request, retention) is optimistic.

## Winner lens

controls-trust

## Graft ideas

- From mvp-sequencing: the file-by-file migration manifest (verbatim lift / rewrite / delete for both repos) must be the synthesis's implementation checklist — it is the only artifact that is directly executable.
- From mvp-sequencing: withGuard() wrapper plus a CI test that globs src/app/api/**/route.ts and fails on any unwrapped handler; extend the existing ci.yml version-stamp guard with SCORING_VERSION and CONTROL_RULEBOOK_VERSION.
- From mvp-sequencing: start clearinghouse contract and per-payer EDI enrollment one full phase before the insurance build (enrollment is up to 30 business days per practice).
- From mvp-sequencing: pilot ONE location of the Cornerstone design partner first, not all three; and read-only degraded mode (not queued writes) is the v1 offline promise.
- From domain-data-model: enforce ledger invariants in Postgres, not only in the service — INSERT-only role with REVOKE UPDATE/DELETE plus BEFORE triggers on ledger/approvals/audit tables; allocation ≤ payment trigger; reversal must reference an unreversed original and mirror it; an adjustment/write-off/refund above threshold must carry an approved approval_request_id (trigger re-check so no code path bypasses evaluateRelease).
- From domain-data-model: transactional outbox (domain_event written in the same transaction as every business write) as the single source for audit log, PHI access log, controls engine, detectors and digests.
- From domain-data-model: derive StaffComposition from roster/grants/findings and make independentBankRec a measured value (match rate, median lag), never a self-asserted boolean; show the 'recorded vs enforced' table in-product.
- From domain-data-model: shadow-DB migration check in CI ('schema.ts changed without a migration file fails the build'), replacing the SCHEMA_BOOT_VERSION guard with equivalent discipline.
- From domain-data-model: clearinghouse adapter interface from day one with exactly one implementation; never build payer connectivity.
- From persona-ux: measurable, falsifiable exit criteria per phase — click budgets for the five daily flows, biller/CPA ledger-reading probe with a task-success threshold, single-operator perio timing, zero-cleartext-after-logout inspection on shared devices.
- From persona-ux: keep runTextAudit and the audit engine pure; pass tenant_id/encounter_id as arguments when decomposing BuilderShell.tsx rather than threading them through module state.
- From persona-ux and mvp-sequencing (both): the scoped, dated, owner-approved exception system (raise/lower/force/waive with residual note and expiry surfaced on the owner home) ships in the SAME release as dual release, never after.
- From persona-ux: the biller's home is three worklists (ERA exceptions, claims aging, denials) each with one primary action; the structural encounter FK on every clinical row.
- From controls-trust itself (must survive): retarget the sealed byteaudit verifier at ledger/day-close/audit-chain promises; tie-out-or-refuse go-live; denial-suppression detection routes write-offs through dual release regardless of amount; engage the SOC 2 auditor during the build, not after.

## Disagreements between designs

- Phase-1 sequencing: clinical record first (mvp-sequencing, domain-data-model), chairside UX first (persona-ux), or money/controls first as a standalone financial layer running beside the incumbent PMS (controls-trust). This is the single largest decision — it determines when the novel thesis is tested and whether early revenue is possible.
- Ledger model: single-entry append-only ledger_entries with typed kinds plus an explicit allocations table (mvp-sequencing, persona-ux, controls-trust) versus full double-entry GL with gl_account / journal_entry / journal_line and DB-enforced balanced entries (domain-data-model).
- Controls timing: dual release enforced inside the ledger transaction from the first ledger release (mvp-sequencing, domain-data-model, controls-trust) versus ledger shipped first and controls added in a later phase (persona-ux).
- SoD enforcement point: refuse the critical grant unless the owner records a decision in the same request (mvp-sequencing, persona-ux); hold the grant pending until a second admin decides (domain-data-model); additionally hard-block a small set of critical conflicts at ACTION time inside withGuard, e.g. today's poster cannot clear today's reconciliation (controls-trust).
- Dedicated primary-research phase: persona-ux runs 24–30 persona interviews in Phase 0 as a calendar-consuming gate; the other three learn from pilots and usability probes without a research phase.
- HIPAA/OSHA compliance program priority: v2 (mvp-sequencing, persona-ux) versus v1-nice landing in a v1 phase (domain-data-model Phase 4, controls-trust Phase 4).
- Perio voice entry timing: Phase 1 depending on an unbuilt on-device Whisper engine or BAA STT (persona-ux); keyboard-first v1 with voice in v1.x (mvp-sequencing); keyboard/pedal Phase 1 and voice in Phase 6 (domain-data-model); perio itself v1-nice in Phase 3 (controls-trust).
- Imaging bridge-and-store: v1-nice in Phase 1 (mvp-sequencing), v1-nice Phase 6-ish (domain-data-model), v2 (persona-ux, controls-trust).
- Hosting redundancy: single region us-east (mvp-sequencing) versus two regions active/passive from Phase 0 (persona-ux, domain-data-model); controls-trust unspecified.
- Offline scope for v1: read-only degraded mode only, queued capture deferred to v2 (mvp-sequencing) versus encrypted read replica PLUS queued clinical note/perio capture with reconciliation (persona-ux, domain-data-model, controls-trust — the latter in Phase 5).
- Bank data source timing: CSV/OFX statement import in v1 with Plaid/Finicity in v1.x (mvp-sequencing); aggregator in Phase 1 with statement fallback (controls-trust); aggregator or statement in Phase 3 (persona-ux); aggregator in Phase 4 (domain-data-model).
- Migration tooling priority: Open Dental importer in v1-core Phase 3 (mvp-sequencing); report-import for parallel run in Phase 1 then full conversions Phase 2 (controls-trust); Open Dental first but in Phase 5 (domain-data-model); v2 (persona-ux).
- Public API timing: read-only API v1 in Phase 2 (controls-trust) versus v2/post-GA (all others).
- Field-level encryption scope at launch: mfa_secret only (mvp-sequencing) versus per-tenant KMS envelope keys for SSN, member ids, MFA secrets, bank identifiers, portal tokens (persona-ux, domain-data-model, controls-trust).
- Identifier strategy: uuid v7 plus per-tenant sequences for user-visible numbers (mvp-sequencing); UUIDv7 everywhere with opaque display ids (domain-data-model); ULIDs plus per-tenant sequences (controls-trust); per-tenant sequences or opaque (persona-ux).
- Frontend stack churn: stay on the existing Tailwind 3 stack (mvp-sequencing) versus adopting Radix primitives and TanStack Query (persona-ux) or Tailwind v4 + Radix + zod-to-openapi (controls-trust); domain-data-model unspecified.
- Package layout: grow dental into a monorepo with packages/controls-engine enforced import-free by test (mvp-sequencing); pnpm workspaces monorepo (domain-data-model); src/lib/controls inside the app (persona-ux); server-only controls package (controls-trust).
- Design-partner pilot shape: one Cornerstone location running a full clinical day in parallel in Phase 1 (mvp-sequencing); financial layer beside the incumbent with report import and dual entry in Phase 1 (controls-trust); pilot deferred to Phase 4 (persona-ux) or Phase 5 (domain-data-model).
- SOC 2 auditor engagement: during Phase 2 (controls-trust), Phase 4 (mvp-sequencing), Phase 5 (domain-data-model), unspecified (persona-ux).
- Treatment plans and estimate engine: v1-core Phase 1 (mvp-sequencing, persona-ux, domain-data-model) versus v1-nice (controls-trust).
- Accepting critical SoD conflicts: whether the owner alone may accept residual risk with a journal entry (mvp-sequencing) or a distinct second admin is always required (domain-data-model) — affects a 1-owner/1-manager practice's ability to operate at all.
