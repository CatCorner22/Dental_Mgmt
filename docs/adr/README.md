# Architecture decision records

Generated from the decision table in `docs/10-decisions-for-owner.md`. Status **Proposed** means the recommendation stands until the owner confirms or changes it.

| ADR | Decision | Recommendation (short) |
|---|---|---|
| [1](ADR-0001-base-branch-for-the-empty-dental-mgmt-repo.md) | Base branch for the empty `Dental_Mgmt` repo | (a). **Approving this plan is the permission for that one push to `main`**; nothing else is ever pushed anywhere but the feature branch |
| [2](ADR-0002-what-ships-first-after-the-foundation.md) | What ships first after the foundation | (c) in a **report-import** shape: the practice keeps posting in its incumbent; the new product imports day sheets, deposits, and the staff r… |
| [3](ADR-0003-ledger-model.md) | Ledger model | (a), with the domain-model design's database-enforced invariants (append-only role, reversal must mirror an unreversed original, allocations… |
| [4](ADR-0004-launch-customer-and-pilot-shape.md) | Launch customer and pilot shape | (a), never (c) |
| [5](ADR-0005-perio-input-at-launch.md) | Perio input at launch | (b), with the speech-engine decision started in Phase 0 |
| [6](ADR-0006-owner-alerting.md) | Owner alerting | (b), six named events: after-hours refund, retroactive-dated entry, waived dual control, deposit variance over threshold, audit-chain verifi… |
| [7](ADR-0007-segregation-of-duties-strictness-for-critical-role-grant-con.md) | Segregation-of-duties strictness for critical role-grant conflicts | (c) |
| [7a](ADR-0007a-runtime-sod-hard-block-on-reconciliation-clearance-in-tiny-o.md) | Runtime SoD hard block on reconciliation clearance in tiny offices | (b) |
| [8](ADR-0008-operatory-idle-lock.md) | Operatory idle lock | 10 minutes on the operatory device profile with a server-side session kill; 30 minutes at desks; 12-hour absolute; PIN re-entry restores the… |
| [9](ADR-0009-primary-user-research-before-the-ledger-is-designed.md) | Primary user research before the ledger is designed | (a) |
| [10](ADR-0010-offline-behavior.md) | Offline behavior | (a) in v1, (b) designed for v2 with measured outage minutes as the input |
| [11](ADR-0011-compliance-program-timing-hipaa-osha-risk-analysis-tailored-.md) | Compliance program timing (HIPAA/OSHA risk analysis, tailored policies, training) | (a) |
| [12](ADR-0012-ai-assist-timing-and-provider.md) | AI assist timing and provider | (a); provider chosen at Phase 4 on one rubric (signed BAA, retention terms, no training on inputs, US residency, model-level eligibility) am… |
| [13](ADR-0013-onc-health-it-certification.md) | ONC health-IT certification | Decide and record before API v1 ships in Phase 2; default (b) unless a payer, group, or state program requires certification |
| [14](ADR-0014-bank-data-source-at-launch.md) | Bank data source at launch | Both in Phase 1: build the statement importer first (it is the fallback forever and needs no vendor), pursue the aggregator agreement and BA… |
| [15](ADR-0015-product-name.md) | Product name | Retire "Precog Pioneer" and "Smile Notes" as product names; send **Daybook**, **Onefold**, and **Denote** to trademark counsel for a Class 9… |
| [16](ADR-0016-money-in-the-clinical-record.md) | Money in the clinical record | Separate surfaces: money on plan cards and the ledger, never inside note text |
| [17](ADR-0017-hosting-topology-at-launch.md) | Hosting topology at launch | (a) |
| [18](ADR-0018-pricing-and-packaging-of-the-phase-1-financial-layer.md) | Pricing and packaging of the Phase 1 financial layer | (a), priced near the top of the band per location, credited toward the PMS, with the PMS itself priced as one per-location fee with unlimite… |
| [19](ADR-0019-clearinghouse-partner.md) | Clearinghouse partner | Choose one in Phase 1 (contract, BAA, certification suite) behind an adapter interface with exactly one implementation; never build payer co… |
| [20](ADR-0020-who-may-open-person-scoped-control-signals.md) | Who may open person-scoped control signals | (b), never the office manager by default |
| [21](ADR-0021-tenancy-and-package-layout.md) | Tenancy and package layout | (a) |
| [22](ADR-0022-medicaid-tenncare-at-launch.md) | Medicaid (TennCare) at launch | (b), stated publicly |
| [23](ADR-0023-budget-staffing-and-funding.md) | Budget, staffing, and funding | (a) |
| [24](ADR-0024-imaging-during-the-phase-3-clinical-pilot.md) | Imaging during the Phase 3 clinical pilot | (a) |
| [25](ADR-0025-patient-communications-during-the-phase-2-conversion.md) | Patient communications during the Phase 2 conversion | (a) |
