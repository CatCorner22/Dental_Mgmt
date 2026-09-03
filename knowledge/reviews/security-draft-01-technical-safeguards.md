# Security draft 1: technical-safeguards

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 17 (Security phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, security, hipaa, technical-safeguards

## Summary

Regulatory scope, control mapping, and architecture from the technical-safeguards lens; 64 citations submitted for verification.

## Lens

technical-safeguards

## Regulatory scope


### Item 1
- **regime**: HIPAA Security Rule, 45 CFR Part 164 Subpart C (§§164.302–164.318), as currently in force
**applies because**

The merged PMS creates, receives, maintains and transmits ePHI (patients, schedules, ledgers, claims, charts) on behalf of covered-entity dental practices. The vendor is a Business Associate of every tenant and, since HITECH (§164.302 / §164.104(b)), is directly liable for Security Rule compliance — not merely contractually. Each tenant practice is a Covered Entity that must also be able to satisfy the Rule using the product, so the product must produce the evidence the practice's own SRA and OCR request will ask for.

- **citation**: 45 CFR 164.302, 164.306, 164.308, 164.310, 164.312, 164.314, 164.316; HITECH Act §13401 (42 U.S.C. 17931) applying 164.308/310/312/316 to business associates

#### key obligations
- §164.308(a)(1): security management process — risk analysis, risk management, sanction policy, information-system activity review (all required)
- §164.308(a)(3)–(4): workforce security and information access management — authorization, clearance, termination procedures, access establishment/modification
- §164.308(a)(5): security awareness/training incl. log-in monitoring and password management
- §164.308(a)(6): security incident procedures — identify, respond, mitigate, document
- §164.308(a)(7): contingency plan — data backup, disaster recovery, emergency-mode operation (required); testing/revision and criticality analysis (addressable)
- §164.308(a)(8): periodic technical and non-technical evaluation
- §164.308(b) / §164.314(a): business associate contracts, including subcontractor flow-down
- §164.310(b)–(d): workstation use/security, device and media controls (disposal, re-use, accountability, backup)
- §164.312(a): access control — unique user identification and emergency access procedure (required); automatic logoff and encryption/decryption (addressable)
- §164.312(b): audit controls — record and examine activity in systems containing ePHI
- §164.312(c): integrity — mechanisms to authenticate ePHI and protect against improper alteration/destruction
- §164.312(d): person or entity authentication
- §164.312(e): transmission security — integrity controls and encryption
- §164.316: written policies/procedures and documentation retained 6 years from creation or last effective date, available to workforce, reviewed and updated

### Item 2
- **regime**: HIPAA Security Rule NPRM 'To Strengthen the Cybersecurity of ePHI', 90 FR 898 (published Jan 6, 2025) — PROPOSED, not final as of September 2026
**applies because**

If finalized it would rewrite Subpart C for every covered entity and business associate, including this vendor. Status verified by web search on 2026-09-03: comment period closed March 7, 2025; no final rule issued; OMB Unified Agenda now lists July 2027 for final action; provider coalitions have asked HHS to withdraw or narrow it. The design therefore treats the NPRM as the direction of travel and builds to it where cheap, but must not market compliance with a rule that does not exist. If finalized as proposed, regulated entities would have 60 days to effective date plus 180 days to comply (240 days total).

- **citation**: 90 FR 898 (Jan. 6, 2025), RIN 0945-AA22; HHS OCR NPRM fact sheet; OMB Unified Agenda entry (target July 2027)

#### key obligations
- Would remove the 'addressable' vs 'required' distinction — every implementation specification becomes required with narrow exceptions
- Would require a written technology asset inventory and network map of ePHI flows, reviewed at least annually and on material change
- Would require MFA for all access to ePHI (limited exceptions) and encryption of ePHI at rest and in transit
- Would require written procedures to restore critical systems and data within 72 hours, plus an applications-and-data criticality analysis
- Would require vulnerability scanning at least every 6 months and penetration testing at least every 12 months
- Would require network segmentation, anti-malware, removal of extraneous software, disabling unused network ports, and patching of critical vulnerabilities within 15 days / high within 30 days
- Would require an annual compliance audit and annual written verification by business associates (via a subject-matter expert) that technical safeguards are deployed
- Would require business associates to notify covered entities within 24 hours of activating their contingency plan
- Would require review and testing of security measures at least every 12 months

### Item 3
- **regime**: HIPAA Privacy Rule provisions with direct technical design consequences, 45 CFR Part 164 Subpart E
- **applies because**: Authorization granularity, disclosure accounting, patient access, and de-identification are Privacy Rule duties the practice must discharge through the product; the vendor as BA is bound to the permitted-use terms of each BAA (§164.502(e), §164.504(e)) and directly to minimum-necessary for its own uses.
- **citation**: 45 CFR 164.502(b) and 164.514(d) (minimum necessary); 164.528 (accounting of disclosures, 6 years, TPO excluded); 164.524 (right of access, 30 days with one 30-day extension); 164.514(a)–(b) (de-identification: Expert Determination or Safe Harbor 18 identifiers); 164.504(e) (BAA content); 164.530(j) (documentation 6 years)

#### key obligations
- Role-based and purpose-based access so each workforce member sees only the PHI needed for their role (minimum necessary) — the three-axis authorization model and the phi_access_log purpose enum implement this
- Accounting of disclosures outside treatment/payment/operations for 6 years — the disclosures table must capture date, recipient, description, purpose for every export/fax/portal/AI/SMS send
- Right of access within 30 days (federal); the product's records_requests workflow must produce a full-record export and track the clock (state law may be shorter — see TN)
- maskPhi and the phi rules are NOT a Safe Harbor de-identification mechanism; nothing leaves a BAA boundary on the strength of them alone
- BAAs with each tenant and every downstream subcontractor must contain the §164.504(e)(2) required terms

### Item 4
- **regime**: HIPAA Breach Notification Rule, 45 CFR Part 164 Subpart D (§§164.400–164.414)
**applies because**

Any unauthorized acquisition, access, use or disclosure of unsecured PHI is presumed a breach unless a documented four-factor risk assessment shows low probability of compromise. The vendor as BA must notify each affected tenant; the tenant must notify individuals, HHS and (over 500) media. Encryption consistent with HHS guidance renders PHI 'secured' and removes the notification duty for lost media/backups — which is why at-rest and field-level encryption are breach-economics controls, not just confidentiality controls.

**citation**

45 CFR 164.402 (definitions, presumption, 4-factor assessment, 'unsecured PHI'); 164.404 (individuals, ≤60 calendar days after discovery); 164.406 (media, >500 residents); 164.408 (HHS: ≥500 contemporaneously, <500 annual log within 60 days of calendar year end); 164.410 (BA to CE ≤60 days); 164.412 (law-enforcement delay); 164.414 (burden of proof); HHS Guidance Specifying the Technologies and Methodologies that Render PHI Unusable, Unreadable, or Indecipherable (74 FR 19006, Apr. 27, 2009)


#### key obligations
- Discovery is imputed: a breach is 'discovered' on the first day it is known or by reasonable diligence would have been known to any workforce member or agent — monitoring and alerting define the clock start
- BA must notify the CE without unreasonable delay and no later than 60 calendar days; the product's BAA should commit to a shorter contractual window
- CE notification content prescribed (what happened, PHI types, steps, mitigation, contact incl. toll-free number) — the incident module should template it for counsel review
- Documentation of the risk assessment and notifications retained 6 years (burden of proof on the entity)

### Item 5
- **regime**: Tennessee Identity Theft Deterrence Act breach notification, Tenn. Code Ann. § 47-18-2107
**applies because**

Tenants are Tennessee practices holding Tennessee residents' personal information (name + SSN, driver licence, account numbers). The statute requires notice to affected residents no later than 45 days from discovery (verified by web search), and notice to the Attorney General/consumer reporting agencies when more than 1,000 residents are affected. NOTE: the statute contains an exemption for information holders subject to HIPAA/HITECH that must be verified by counsel before the product asserts a 45-day clock as binding on covered entities; the product should still track both clocks and let counsel decide.

- **citation**: Tenn. Code Ann. § 47-18-2107 (as amended 2017), subsections (b) (45 days), (f) (consumer reporting agencies >1,000), and the HIPAA-subject-entity exemption subsection

#### key obligations
- 45-day resident notification clock from discovery, extendable only for legitimate law-enforcement needs
- Notice to consumer reporting agencies when >1,000 Tennessee residents are notified
- Encryption safe harbor: 'personal information' means unencrypted computerized data (or encrypted data where the key was also acquired) — another reason keys must live in KMS, not the database
- Counsel determination of whether the HIPAA-subject exemption removes the state duty for a given tenant; the product tracks both clocks regardless

### Item 6
- **regime**: Tennessee Board of Dentistry rules on dental records, Tenn. Comp. R. & Regs. 0460-02-.12
**applies because**

Tenants must retain, transfer, and destroy patient records per Board rule; the product's retention_until computation, records_requests SLA, destruction_log and legal_holds implement it. The primary sources were unreachable from this environment (egress blocked), so the specific retention periods (design assumes 7 years adult / 10 years minor or age of majority plus statute, longer wins) and the copy-request deadline (design assumes 10 working days) are UNVERIFIED and listed in citations_to_verify.

- **citation**: Tenn. Comp. R. & Regs. 0460-02-.12 (Dental Records); Tenn. Code Ann. § 63-5-101 et seq. (Dental Practice Act); Tenn. Code Ann. § 68-11-305 (hospital/medical records retention, for comparison)

#### key obligations
- Retention clock computed per patient from last contact and age, with the longer of state rule / HIPAA documentation / malpractice statute of repose winning; legal hold suspends destruction
- Records transfer/copy on request within the Board's deadline, as a full-record export including images
- Destruction logged (what, when, method, by whom) so the practice can prove compliant disposal (§164.310(d)(2)(i) also applies to media)

### Item 7
- **regime**: FTC Act § 5 (unfair or deceptive practices) as applied to security and privacy claims
**applies because**

The product will publish security claims (encryption, audit trails, uptime, 'HIPAA-grade'). FTC v. Henry Schein Practice Solutions (2016, $250,000) penalized a dental PMS vendor (Dentrix G5) for advertising 'encryption' that was in fact a proprietary obfuscation. Every public security statement must be literally true and evidenced; the design's 'never claim HIPAA compliant' rule is an FTC posture as much as a marketing one. The FTC Health Breach Notification Rule (16 CFR Part 318) does NOT apply to HIPAA covered entities or their BAs acting as such, but would apply if the vendor ever offered a direct-to-consumer app outside a BAA.

- **citation**: 15 U.S.C. § 45(a); In re Henry Schein Practice Solutions, Inc., FTC File No. 142-3161 (2016); 16 CFR Part 318 (Health Breach Notification Rule, as amended 2024) — scope exclusion for HIPAA-covered entities

#### key obligations
- Encryption claims must name the standard (AES-256-GCM, TLS 1.2+/1.3, KMS-managed keys) and be verifiable
- Public trust page statements (uptime, incident history, subprocessor BAA status) must be generated from system records, not hand-edited
- No 'HIPAA compliant', 'HIPAA certified', 'lawsuit-proof', 'board-proof' adjectives anywhere

### Item 8
- **regime**: PCI DSS v4.0.1 (contractual, via the card processor and acquiring bank)
**applies because**

The product takes patient card payments. By using hosted fields / iframe tokenization so card data never touches the product's servers or DOM-controlled inputs, the merchant (each practice) stays in SAQ A scope and the vendor stays out of cardholder-data scope; the product still owns the scripts on the payment page, so v4.0.1 requirements 6.4.3 (payment-page script inventory/integrity) and 11.6.1 (change detection on payment pages) fall on the product from March 31, 2025.

- **citation**: PCI DSS v4.0.1 (June 2024), Requirements 6.4.3 and 11.6.1; PCI SSC SAQ A v4.0.1 eligibility criteria

#### key obligations
- Never store, process or transmit PAN/CVV; processor tokens only, stored envelope-encrypted
- Payment page CSP with nonces and script allowlist; script inventory; integrity monitoring of the checkout page
- Processor must sign a BAA or receive no PHI beyond what its own compliance program covers (patient name + amount linked to a dental practice is PHI)

### Item 9
- **regime**: ONC Health IT Certification and Information Blocking (45 CFR Parts 170 and 171)
**applies because**

Information-blocking rules bind 'health care providers' (the tenants) and 'developers of certified health IT'. A dental PMS that does not seek ONC certification is not an 'actor' as a developer, but the practices are, and the product must not make it impracticable for them to fulfil access/exchange requests (no-fee export, records-request workflow, FHIR later). The design records a deliberate no-certification decision before API v1 (Phase 2).

- **citation**: 45 CFR Part 171 (information blocking), § 171.102 definitions of 'actor'; 45 CFR Part 170 (ONC certification program); 21st Century Cures Act § 4004

#### key obligations
- Self-service full export (structured + documents + DICOM) at no fee so tenants can meet their own access/exchange duties
- Recorded decision on ONC certification before publishing API v1; align export shape with USCDI/FHIR R4 where cheap to avoid retrofit

### Item 10
- **regime**: Payment-card and banking data: Gramm-Leach-Bliley is NOT applicable to the vendor; bank aggregator terms and the tenant's bank agreements govern
- **applies because**: Bank transaction data pulled for reconciliation is the practice's business financial data, not PHI, unless transaction descriptions embed patient names (refund checks). Treat the aggregator feed as PHI-adjacent: DPA required, BAA preferred, descriptions passed through the egress classifier before storage in a PHI-bearing table.
- **citation**: Plaid/Finicity developer terms and data-use agreements; 45 CFR 160.103 definition of PHI (individually identifiable health information created or received by a covered entity relating to payment for health care)

#### key obligations
- Read-only bank access scopes; no payment-initiation scope ever
- Aggregator listed on the subprocessor page with its agreement type

## Control mapping


### Item 1
- **requirement**: Risk analysis and risk management (required)
- **citation**: 45 CFR 164.308(a)(1)(ii)(A)–(B); OCR Risk Analysis Initiative enforcement (16 resolutions Jan–Aug 2025, continuing 2026); NPRM would add asset inventory + network map
- **control**: Product-level Security Risk Analysis performed on the PMS itself before Phase 1 PHI, refreshed annually and on every architectural change; risk register with owner, likelihood, impact, treatment, due date; the SRA explicitly documents the names/DOB-cleartext decision and the shared-schema RLS tenancy decision with compensating controls
- **implementation in product**: docs/security/sra/ in the monorepo (versioned, reviewed via PR); an asset inventory generated from IaC + integration_registry + package SBOM so the NPRM inventory/network-map requirement is a build artifact, not a spreadsheet; sra_questionnaires/responses tables reused by tenants in the Phase 4 compliance module
- **priority**: Phase 0 (vendor SRA) / Phase 4 (tenant SRA module)
- **reuse from**: /home/user/catcorner22/dental/knowledge/sources/adversarial-it-hipaa-security.md and adversarial-privacy-hipaa-attorney-hate.md as the seed threat list; /home/user/catcorner22/dental/src/lib/risk/categories.ts folded into the findings register

### Item 2
- **requirement**: Information system activity review (required)
- **citation**: 45 CFR 164.308(a)(1)(ii)(D)
- **control**: Monthly review of audit, PHI-access and security event logs by the tenant's designated reviewer and by the vendor's security officer, producing an attested record
- **implementation in product**: pg-boss job creates a compliance_task 'monthly log review' per tenant with pre-built views (failed logins, lockouts, after-hours PHI reads, exports, break-glass uses, chain check results); completing it writes an attested domain_event 'compliance.log_review' with reviewer frozen name; overdue reviews surface on Compliance lead home
- **priority**: Phase 0 (vendor side) / Phase 1 (tenant side)
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts filter semantics ('security' = everything except routine auth.signin); /home/user/catcorner22/dental/src/app/api/training/complete/route.ts server-verified attestation pattern

### Item 3
- **requirement**: Sanction policy (required)
- **citation**: 45 CFR 164.308(a)(1)(ii)(C)
- **control**: Written sanction policy for vendor workforce; tenant sanction policy template; the product records access-policy violations as findings without scoring people
- **implementation in product**: control_findings with practice-level framing; owner + reviewer seat can open person-scoped detail; policy template in the Phase 4 compliance module (counsel-reviewed)
- **priority**: Phase 4
- **reuse from**: /home/user/catcorner22/dental/src/lib/digest/digest.ts SYSTEMIC_SHARE re-scoping rule

### Item 4
- **requirement**: Workforce security: authorization, clearance, termination (addressable → required under NPRM)
- **citation**: 45 CFR 164.308(a)(3)(ii)(A)–(C)
- **control**: Joiner-mover-leaver lifecycle: role set at provisioning by an admin with MANAGE_CEILING limits; deactivation kills the session on the very next request; terminated users holding grants is a finding; SCIM deprovisioning for groups
- **implementation in product**: users.active checked from a fresh row inside withGuard (never the token); user_entitlements append-only grant log with effective_to; nightly detector 'terminated user still holds grants'; SCIM (Phase 5) revokes grants + sessions ≤1 minute
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/guards.ts requireRole fresh-row read; /home/user/catcorner22/dental/src/lib/auth/roles.ts MANAGE_CEILING; /home/user/catcorner22/dental/src/lib/db/repo/users.ts mutateAdminGuarded last-admin guard

### Item 5
- **requirement**: Information access management: access authorization, establishment and modification (addressable)
- **citation**: 45 CFR 164.308(a)(4)(ii)(B)–(C); 164.502(b) minimum necessary
- **control**: Three orthogonal authority axes (admin rank, clinical licence, financial entitlement) plus location scope and patient-level restrictions; default-deny wrapper on every handler; per-request derivation from the database
- **implementation in product**: requireAccess(req, {tenant, minRank, entitlements[], clinicalScope?, locationScope?, phiRead?}) returning a fresh-row SessionUser; withGuard(handler, opts) wraps every route handler and server action, opens a transaction, SET LOCAL app.tenant_id / app.user_id, and 401/403s as typed JSON; CI test globs src/app/api/**/route.ts and **/*.action.ts and fails on any export not wrapped
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/guards.ts (GuardResult discriminated union), clinicalRoles.ts, approval.ts; /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts 14 entitlements as the financial axis

### Item 6
- **requirement**: Security awareness and training; log-in monitoring; password management (addressable)
- **citation**: 45 CFR 164.308(a)(5)(ii)(A)–(D)
- **control**: Training at hire and annually with server-verified completion; failed-login throttling and spray detection with alerts; password policy with breach-corpus check; MFA everywhere so password strength is a second line
- **implementation in product**: training_assignments/completions (Phase 4); auth_throttle pair-key gate + IP detector lifted verbatim; add HIBP k-anonymity range check at set/change time and password history (last 5 hashes); new-device login on a financial role pages the owner
- **priority**: Phase 0 (throttle, policy) / Phase 4 (training)
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts, hashGate.ts, clientIp.ts, password.ts, passwordPolicy; /home/user/catcorner22/dental/e2e/lockout.mjs promoted to blocking CI

### Item 7
- **requirement**: Security incident procedures: response and reporting (required)
- **citation**: 45 CFR 164.308(a)(6); 164.400–414 breach notification; Tenn. Code Ann. § 47-18-2107
- **control**: Written IR plan with severity matrix, containment playbooks (rotate secrets, revoke all tenant sessions, disable connector at registry, freeze exports), evidence preservation, four-factor risk assessment template, dual clocks (HIPAA 60 / TN 45), post-mortem publication; tabletop twice a year
- **implementation in product**: incidents table with discovered_at, tn_deadline, hipaa_deadline, ba_to_ce_notified_at, four_factor jsonb, status; one-click 'revoke every session in tenant' sets users.sessions_revoked_at for all + deletes sessions rows; 'disable connector' flips integration_registry.enabled and writes a hard event; status page incident entries generated from incidents rows
- **priority**: Phase 0 (plan + revoke-all) / Phase 1 (incident intake)
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts (belt-and-braces revoke); /home/user/catcorner22/dental/docs/GO-LIVE.md failure-symptom table shape

### Item 8
- **requirement**: Contingency plan: data backup, disaster recovery, emergency mode operation (required); testing/revision, criticality analysis (addressable); NPRM would require 72-hour restoration
- **citation**: 45 CFR 164.308(a)(7)(ii)(A)–(E); 90 FR 898 proposed 164.308(a)(13)
- **control**: Encrypted PITR + cross-region snapshots with immutable vault; monthly automated restore drill that verifies the restored copy and writes its own audit row; read-only degraded mode as the emergency-mode operation plan; criticality tiers documented; RPO ≤5 min, RTO ≤4 h (Phase 0–3) → ≤1 h (Phase 4)
**implementation in product**

pg-boss job 'backup.restore_drill' restores latest snapshot into an isolated instance, runs packages/verifier (chain check, ledger invariants, row-count parity), tears it down, writes domain_event backup.restore_drill with result; production boot refuses if last successful drill is >35 days old or backup target unset; service-worker read cache (encrypted, TTL 24h, disabled on shared-device profile) for Board/alerts/chart summaries

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/backend.ts resolveDbBackend refuse-to-boot pattern extended; /home/user/catcorner22/dental/scripts/postgres-durability.sh as the drill's ancestor

### Item 9
- **requirement**: Periodic evaluation (required); NPRM would require annual compliance audit, semiannual vulnerability scans, annual penetration test
- **citation**: 45 CFR 164.308(a)(8); 90 FR 898 proposed 164.308(a)(9)–(10), 164.312(?) scanning/pen-test provisions
- **control**: Annual technical evaluation; third-party penetration test at Phase 4 GA and annually thereafter; automated vulnerability scanning of containers and dependencies on every build plus a scheduled full scan every 6 months; findings tracked to closure
- **implementation in product**: CI: npm audit (fail on high/critical), Trivy image scan, Dependabot/Renovate with lockfile-only updates reviewed; scheduled semiannual authenticated DAST against staging; pen-test report summary published on the trust page
- **priority**: Phase 0 (CI scanning) / Phase 4 (pen test)
- **reuse from**: /home/user/catcorner22/dental/.github/workflows/ci.yml blocking job extended

### Item 10
- **requirement**: Business associate contracts and subcontractor flow-down (required)
- **citation**: 45 CFR 164.308(b), 164.314(a), 164.502(e), 164.504(e)
- **control**: BAA with every tenant; BAA (or documented no-PHI determination) with every subprocessor; a connector cannot be enabled until a countersigned BAA row exists; public subprocessor list with BAA status
- **implementation in product**: business_associates → baas(vendor, kind, signed_at, expires_at, controls_named, document_id, active) and integration_registry(kind, vendor, enabled) with a trigger: enabled=true requires an active baa row whose expires_at > now (or kind='no_phi' with a written determination); expiring BAAs raise compliance_tasks; egress allowlist in the container security group mirrors the registry
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/config.ts single-configured-egress principle → per-channel destination allowlist

### Item 11
- **requirement**: Workstation use and security; device and media controls (required)
- **citation**: 45 CFR 164.310(b), (c), (d)(2)(i)–(iv)
- **control**: Shared-device profile with server-enforced idle lock and PIN author switch that wipes local state; encrypted-or-disabled local caches; no PHI in downloads except via signed URLs with short TTL; media disposal is the cloud provider's under BAA plus crypto-shredding of per-tenant DEKs at tenant termination
**implementation in product**

sessions.device_profile operatory|desk with idle 10/30 min, absolute 12h, enforced in withGuard; draftBackup rebuilt: AES-GCM with a per-session key issued by the server and held only in memory, wiped on sign-out/switch/revoke, disabled when device_profile=operatory; documents served via S3 presigned GET (≤5 min) with Content-Disposition attachment; tenant offboarding job exports, then destroys the wrapped DEK (crypto-shred) and logs destruction_log

- **priority**: Phase 0 (sessions) / Phase 3 (device caches)
- **reuse from**: /home/user/catcorner22/dental/src/components/builder/SharedTabletIdleLock.tsx (UI only), /home/user/catcorner22/dental/src/lib/client/draftBackup.ts (rebuilt), knowledge/sources/adversarial-it-hipaa-security.md controls C1/C4/C5

### Item 12
- **requirement**: Unique user identification (required)
- **citation**: 45 CFR 164.312(a)(2)(i)
- **control**: One person, one account; no shared logins; shared operatory tablets use a device profile plus per-person PIN re-authentication into that person's own server session; every write carries frozen actor id + name
- **implementation in product**: users unique (tenant_id, username); PIN is a per-user secret (argon2id-hashed, 6+ digits, throttled on pwcheck key) that can only resume/open a session for that user on a device already bound to the tenant; created_by_id + created_by_name frozen on every row; 'zero wrong-author events on shared tablets' is a Phase 3 exit criterion
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/schema.ts frozen-attribution convention; /home/user/catcorner22/dental/src/lib/auth/username.ts

### Item 13
- **requirement**: Emergency access procedure (required)
- **citation**: 45 CFR 164.312(a)(2)(ii)
- **control**: Two-admin dual-control recovery ceremony for locked-out accounts; vendor break-glass with an offline hardware-key-protected identity whose use pages the owner and is logged; clinical break-glass for restricted patients with validated justification; all replace the ADMIN_PASSWORD_RESET env flag
**implementation in product**

recovery_ceremonies(target_user, initiated_by, approved_by CHECK distinct, both MFA-fresh ≤5 min, expires 15 min, consumed_at) mints a one-time reset link; vendor break-glass role exists only in the IdP/AWS layer with hardware MFA, session recording, and auto-expiring credentials; phi_access_log.purpose='break_glass' rows require justification passing isValidPhiAttestation and generate a hard event to the owner

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts (refuses self-target — second person by construction); /home/user/catcorner22/dental/src/lib/audit/attestation.ts isValidPhiAttestation; /home/user/catcorner22/dental/src/lib/auth/resetToken.ts + issueResetLink.ts

### Item 14
- **requirement**: Automatic logoff (addressable → required under NPRM)
- **citation**: 45 CFR 164.312(a)(2)(iii)
- **control**: Server-enforced idle timeout (10 min operatory, 30 min desk), 12h absolute, active-session list with per-device revoke, watermark retained
- **implementation in product**: sessions table (user_id, device_profile, last_seen_at, idle_deadline, absolute_expires, revoked_at, ip, ua) checked inside withGuard on every request; cookie is an opaque session id (__Host- prefix, Secure, HttpOnly, SameSite=Lax); NextAuth JWT retained only as the transport for the session id and the pwAt watermark; GET /api/me/sessions lists, DELETE revokes one or all
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts, auth.config.ts (12h maxAge rationale), /home/user/catcorner22/dental/src/app/api/me/sessions/route.ts

### Item 15
- **requirement**: Encryption and decryption of ePHI at rest (addressable → required under NPRM)
- **citation**: 45 CFR 164.312(a)(2)(iv); 164.402 'unsecured PHI'; 74 FR 19006 encryption guidance
- **control**: Volume encryption (RDS, EBS, S3 SSE-KMS) with customer-managed KMS keys plus application-layer envelope encryption for high-sensitivity fields with per-tenant data keys
**implementation in product**

packages/db crypto module: KMS GenerateDataKey per tenant → wrapped DEK in tenant_keys(tenant_id, version, wrapped_dek, created_at); AES-256-GCM with AAD = tenant_id||table||column||row_id so ciphertext cannot be transplanted; columns: users.mfa_secret_enc, recovery codes (hashed, not encrypted), patients.ssn_enc (+ HMAC blind index of last4 for search), patient_coverage.member_id_enc, bank_accounts identifiers, portal tokens, processor customer tokens, api_keys (hashed); rotation = new DEK version + lazy re-encrypt job; keys never in the DB or env

- **priority**: Phase 0 (framework, mfa_secret) / Phase 1 (SSN, member ids, bank)
- **reuse from**: none in either repo — new; the decision to keep names/DOB cleartext documented in the SRA

### Item 16
- **requirement**: Audit controls (required)
- **citation**: 45 CFR 164.312(b); 164.308(a)(1)(ii)(D)
- **control**: Every state change emits a domain_event in the same transaction; every PHI read writes a phi_access_log row; both hash-chained per tenant, written by an INSERT-only role, partitioned monthly, retained ≥6 years, verified nightly with the daily chain head anchored to WORM storage
**implementation in product**

domain_event(tenant_id, id uuidv7, occurred_at, actor_id, actor_name frozen, ip, ua, session_id, aggregate_type, aggregate_id, event_type, payload codes-and-ids only, prev_hash, hash); phi_access_log(actor, patient_id, resource_kind/id, purpose enum, justification, ip); insertion serialized per tenant via tenant-salted advisory lock so the chain never forks; hash = HMAC-SHA256(chain_key_v, prev_hash || canonical(row)) with chain_key derived by HKDF from a dedicated KMS key (distinct from DEKs); app_append role with UPDATE/DELETE revoked + BEFORE UPDATE/DELETE triggers RAISE; nightly job in packages/verifier recomputes; audit_chain_checks row + S3 Object Lock (compliance mode, 7 years) of the head signed with a KMS asymmetric key; failure = hard event

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts (single write point, capped + marked truncation, frozen actor); /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts userSpendLockKey FNV pattern for tenant-salted locks; /home/user/catcorner22/dental/src/app/api/assist/route.ts one-parseable-row-per-call

### Item 17
- **requirement**: Integrity: mechanism to authenticate ePHI (addressable → required under NPRM)
- **citation**: 45 CFR 164.312(c)(1)–(2)
- **control**: Immutability as a database property for ledger, allocations, approvals, control decisions, claim events, chart events, filed notes, events and logs; frozen artifacts re-verified by a sealed independent verifier; sha256 on every stored document
**implementation in product**

app_append role + BEFORE triggers on all append-only tables; corrections are new rows (reversal/amendment) referencing the original; day_closes and clinical_notes_filed carry a hash over their frozen content; packages/verifier (byteaudit pattern: contract restated, zero app imports, sealed by manifest hash, fails closed) re-derives ledger invariants, day-close arithmetic, note stamp agreement and chain continuity; documents.sha256 checked on every signed-URL issue

- **priority**: Phase 0 (roles/triggers/verifier) / Phase 1 (ledger) / Phase 3 (notes)
- **reuse from**: /home/user/catcorner22/dental/src/lib/byteaudit/{contract.ts,verify.ts,seal.ts,manifest.ts}; /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts fileSubmissionAtomic; /home/user/catcorner22/dental/e2e/submission.immutability.mjs

### Item 18
- **requirement**: Person or entity authentication (required); NPRM would mandate MFA
- **citation**: 45 CFR 164.312(d); 90 FR 898 proposed MFA requirement
- **control**: Mandatory TOTP for every human account with hashed recovery codes; WebAuthn/passkeys added as a phishing-resistant option; SAML/OIDC SSO for groups with MFA asserted by the IdP; API keys hashed and scoped; webhooks HMAC-signed; step-up MFA on high-value approvals and admin actions
**implementation in product**

retire mfaFeature.ts; mfa_enabled forced at first login (no bypass), secret envelope-encrypted, 10 single-use recovery codes stored argon2id-hashed; passkeys (Phase 4) via @simplewebauthn behind guards.ts; api_keys(hash, scopes, tenant, last_used) compared with timingSafeEqualStr; step-up = re-verify TOTP within 2 minutes for approvals above the high-value band, role grants, BAA registry changes, export of >N rows

- **priority**: Phase 0 (TOTP mandatory) / Phase 4 (passkeys) / Phase 5 (SSO)
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/totp.ts, /home/user/catcorner22/dental/src/app/api/me/mfa/route.ts lifecycle rules, /home/user/catcorner22/dental/e2e/mfa.totp.mjs no-oracle assertions, timingSafeEqualStr from /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts

### Item 19
- **requirement**: Transmission security: integrity controls and encryption (addressable → required under NPRM)
- **citation**: 45 CFR 164.312(e)(1)–(2)
- **control**: TLS 1.2+ (1.3 preferred) at the edge with HSTS; verify-full TLS to Postgres enforced in code; TLS to every connector; SFTP/AS2 with pinned host keys for clearinghouse batch files; HMAC-signed webhooks; no PHI in URLs or query strings
- **implementation in product**: pinPostgresSslMode lifted verbatim and made a boot guard (refuse if resulting sslmode ≠ verify-full); ALB TLS policy TLS13-1-2; HSTS max-age 2y includeSubDomains, preload only after the production domain is final; UUIDv7 identifiers in paths; Referrer-Policy same-origin; connector clients use a shared HTTP client with host allowlist, timeouts and no redirects off-allowlist
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts; /home/user/catcorner22/dental/next.config.mjs header block; /home/user/catcorner22/dental/e2e/headers.mjs

### Item 20
- **requirement**: Tenant isolation (no explicit HIPAA citation; falls under 164.308(a)(4) access management, 164.312(a) access control and the risk analysis)
- **citation**: 45 CFR 164.308(a)(4), 164.312(a)(1), 164.308(a)(1)(ii)(A)
- **control**: tenant_id on every row, unique constraint and index; Postgres RLS on every table, forced, keyed on current_setting('app.tenant_id', true); app connects as non-owner roles so RLS cannot be bypassed; per-tenant encryption keys as the second wall; negative tests in CI on real Postgres
**implementation in product**

ALTER TABLE ... ENABLE ROW LEVEL SECURITY; FORCE ROW LEVEL SECURITY; policy USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (same) — missing setting yields NULL → zero rows (fail closed); withGuard runs SET LOCAL inside the transaction so PgBouncer transaction pooling is safe; app_rw/app_append/app_migrate roles, only app_migrate owns tables and has BYPASSRLS off; CI test: seed two tenants, run a repo function with the WHERE deliberately removed, assert zero foreign rows; second test: connect as app_rw without SET LOCAL, assert every table returns zero rows; third: attempt UPDATE/DELETE as app_append, assert SQLSTATE 42501

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/userBlocks.ts owner-scoping discipline as the app-layer habit; /home/user/catcorner22/precog/src/lib/auth/verify.server.ts fail-closed instinct (pattern only)

### Item 21
- **requirement**: Minimum necessary and PHI-read purpose capture
- **citation**: 45 CFR 164.502(b), 164.514(d)(2); 164.312(b)
- **control**: Role-scoped views (front desk: no note bodies; biller: ledger/claims + chart summary; hygienist: clinical + limited ledger); location scope on financial/roster data; restricted-patient flag requiring break-glass; treatment-relationship heuristic (patient on today's/recent schedule or assigned provider) that otherwise prompts a reason and logs purpose
- **implementation in product**: requireAccess opts.phiRead = {patientIds, resourceKind, purpose} writes phi_access_log inside the same transaction; list endpoints log one row with patient_ids[] and count; export endpoints mirror the screen's predicate ('authorization mirrors the screen, not the table') and record rendered row count; PatientRail privacy mode hides names on operatory glass
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts; /home/user/catcorner22/dental/src/lib/auth/roles.ts seesAllNotes allowlist pattern

### Item 22
- **requirement**: Accounting of disclosures
- **citation**: 45 CFR 164.528
- **control**: Every print, export, fax, SMS, email, portal send, records-request fulfilment and AI call is a disclosure row with recipient, records, purpose and actor; exportable per patient for 6 years
- **implementation in product**: disclosures(patient_id, at, channel, recipient, records jsonb ids only, purpose, actor frozen, document_id) written in the same transaction as the send; clipboard copy of any PHI-bearing text also logged (the Smile Notes clipboard path was an unlogged egress); patient-facing accounting report generated from this table
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/threading.ts (opaque tokens, header-injection safe) for outbound mail; knowledge/sources/adversarial-privacy-hipaa-attorney-hate.md demand #3

### Item 23
- **requirement**: Cross-site request forgery / cross-site scripting defence (falls under 164.312(a) access control and 164.308(a)(1) risk management)
- **citation**: 45 CFR 164.312(a)(1), 164.308(a)(1)(ii)(B)
- **control**: Origin/Sec-Fetch-Site verification on every state-changing request; Content-Type and body-size checks; nonce-based CSP once portal/intake HTML ships; no user-supplied HTML rendered; output encoding by React; Radix primitives only for select/dialog/combobox
**implementation in product**

withGuard rejects mutations whose Sec-Fetch-Site is cross-site/same-site or whose Origin ≠ configured APP_URL (top-level GET navigations exempt); readJsonRecord gains a Content-Type: application/json requirement; Next middleware generates a per-request nonce and the header block switches script-src to 'nonce-…' 'strict-dynamic' in Phase 4; e2e/headers.mjs extended to assert no 'unsafe-inline' on script-src in production

- **priority**: Phase 0 (Origin check) / Phase 4 (nonce CSP)
- **reuse from**: /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts assertSameSiteRequest (pattern; reimplemented for Next Request); /home/user/catcorner22/dental/src/lib/http/readJson.ts; /home/user/catcorner22/dental/next.config.mjs

### Item 24
- **requirement**: Malicious software protection (addressable → required under NPRM)
- **citation**: 45 CFR 164.308(a)(5)(ii)(B); 90 FR 898 anti-malware provisions
- **control**: Every uploaded document/image scanned on ingest; served with nosniff and attachment disposition; distroless non-root read-only containers; no shell in production images
- **implementation in product**: S3 upload → pg-boss job runs ClamAV (lambda or sidecar) → documents.scanned_at/scan_result; unscanned or infected objects never get a signed URL; content-type sniffed server-side and compared to declared MIME
- **priority**: Phase 3
- **reuse from**: none — new

### Item 25
- **requirement**: Secrets management and key rotation (164.308(a)(1)(ii)(B) risk management; 164.312(a)(2)(iv))
- **citation**: 45 CFR 164.308(a)(1)(ii)(B), 164.312(a)(2)(iv)
- **control**: All secrets in AWS Secrets Manager injected at task start; no .env in production; dual-key AUTH_SECRET rollover; 90-day rotation for third-party API keys; DB credentials via Secrets Manager rotation or IAM auth; CI secret scanning; precog history and its committed PREVIEW_CLIENT_SECRET not carried forward
- **implementation in product**: boot guard refuses if any required secret is missing or AUTH_SECRET <32 bytes; NextAuth configured with an array of secrets (current + previous) during rollover windows; gitleaks in the blocking CI job; a scripts/rotate-*.md runbook per secret with the audit row it must produce
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/backend.ts refuse-to-boot; /home/user/catcorner22/dental/.env.example annotations as the seed for the secrets inventory

### Item 26
- **requirement**: Change control, secure development and supply chain (164.308(a)(8) evaluation; 164.312(c) integrity; NPRM patching windows)
- **citation**: 45 CFR 164.308(a)(8), 164.312(c)(1); 90 FR 898 proposed patch timelines (critical 15 days / high 30 days)
- **control**: Branch protection with required review; blocking CI (types, lint, unit with coverage floor, RLS negative tests on real Postgres, route-guard glob, e2e security probes, migration shadow check, version-stamp guards, secret scan, dependency audit, image scan, SBOM); exact-pinned dependencies with lockfile; CODEOWNERS on security-critical directories; sealed verifier; import-purity tests for packages
- **implementation in product**: pnpm with frozen lockfile and exact versions (next-auth beta pinned); CycloneDX SBOM attached to each release; Renovate PRs grouped weekly, security advisories immediately with a 15/30-day SLA tracked in the risk register; packages/verifier re-seal requires a manual script and a reviewed manifest diff; packages/controls-engine and clinical-core fail a test if they import from apps/
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/.github/workflows/ci.yml version-stamp guards; /home/user/catcorner22/dental/src/lib/byteaudit/seal.ts + scripts/byteaudit-seal.mjs; /home/user/catcorner22/dental/e2e/*.mjs

### Item 27
- **requirement**: AI/LLM boundary as a disclosure to a business associate
- **citation**: 45 CFR 164.502(e), 164.504(e), 164.514(d); 164.528
- **control**: No model call without an active BAA row and per-tenant opt-in; field-level minimum-necessary allowlist per capability; egress PHI classifier as a second lock; zero-retention endpoint; every call a disclosure row plus a codes-only drift row; model output treated as untrusted data, never authorization; deterministic twin for every capability
**implementation in product**

integration_registry kind='llm' gated by baa; assist service builds payload only from allowlisted fields, replaces names with role labels/pseudonyms via maskPhi, runs runPhiRule + scanPhiForProvider and refuses on S0 identifiers outside the allowlist; provider adapter interface with one implementation (Bedrock/Azure/Anthropic-with-BAA decided at Phase 4); verifyMeaning + evidence pinning on outputs; browser SpeechRecognition disabled on PHI fields; egress security group only permits the registered provider host

- **priority**: Phase 5 (Phase 0 for the registry gate)
- **reuse from**: /home/user/catcorner22/dental/src/app/api/assist/route.ts, src/lib/assist/**, src/lib/verify/**, src/lib/audit/rules/{phi.ts,phi-secondary.ts}, maskPhi.ts, src/lib/learning/redact.ts, docs/model-charter.md; /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts reshaped to role labels

### Item 28
- **requirement**: Documentation and retention of policies, procedures and required records
- **citation**: 45 CFR 164.316(b)(1)–(2); 164.530(j); 164.528(a)
- **control**: Policies versioned and reviewed; every required record (SRA, training, BAAs, incident assessments, log reviews, restore drills, chain checks, disclosures) retained ≥6 years with legal hold; retention enforced by job, never manual deletion
- **implementation in product**: retention_policy(kind, years) table; partitions for domain_event/phi_access_log older than retention detached and archived to S3 Glacier with Object Lock rather than dropped; legal_holds suspend; destruction_log records every purge; policies table versioned with approved_by frozen
- **priority**: Phase 0 (retention design) / Phase 4 (policy module)
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts maker-checker + event log for policy approval

### Item 29
- **requirement**: Public status, availability and honest security claims
- **citation**: 15 U.S.C. § 45(a) (FTC Act § 5); In re Henry Schein Practice Solutions (2016)
- **control**: Status page and uptime history generated from real health checks; incident post-mortems from incidents rows; trust page statements sourced from system records; no compliance adjectives
- **implementation in product**: external synthetic monitor + internal /healthz (DB, KMS, object storage, worker heartbeat) feed a hosted status page; SLA credits computed from the same data; trust page renders subprocessor list from business_associates/baas
- **priority**: Phase 0 (status page) / Phase 1 (trust page)
- **reuse from**: market report C.1 buyer checklist; /home/user/catcorner22/dental/docs/GO-LIVE.md runbook shape

## Architecture

TRUST BOUNDARIES (outermost to innermost). (1) Browser on unmanaged or shared glass — untrusted by default; holds only an opaque session cookie, a per-session in-memory encryption key, and (desk profile only) an encrypted read cache. Nothing the client computes is authorization; verdicts, audits and PHI classification are recomputed server-side. (2) Edge — AWS WAF + ALB terminating TLS 1.2+/1.3, rate limits per IP and per tenant, geo/ASN blocks optional, request size caps; forwards X-Forwarded-For with a fixed hop count that clientIp.ts reads from the right (TRUSTED_PROXY_HOPS=1). (3) Application tier — long-lived Node containers (ECS Fargate, distroless, non-root, read-only root FS) in private subnets; every handler and server action passes through withGuard; outbound egress restricted by security group + NAT egress allowlist to Postgres, S3/KMS/Secrets Manager VPC endpoints, and the hosts named in integration_registry. (4) Worker tier — a second Fargate service running pg-boss consumers (outbox fan-out, chain verification, detectors, claim batches, ERA posting, restore drills) with the same DB roles and egress rules; workers never accept inbound traffic. (5) Data tier — RDS PostgreSQL 16 Multi-AZ in isolated subnets, no public endpoint, IAM-authenticated or Secrets-Manager-rotated credentials, storage encrypted with a customer-managed KMS key, PITR on, verify-full TLS enforced by pinPostgresSslMode as a boot guard; S3 buckets (documents, era_files, exports, audit-heads) with SSE-KMS, Block Public Access, versioning, Object Lock on audit-heads and WORM exports. (6) Key tier — AWS KMS: one CMK per environment for volume encryption, one for data-key wrapping (per-tenant DEKs), one HMAC/HKDF root for audit chains, one asymmetric signing key for daily chain heads; key policies grant Decrypt/GenerateDataKey only to the app and worker task roles; CloudTrail logs every KMS call. (7) External connectors — clearinghouse, card processor (hosted fields; card data never enters our boundary), bank aggregator, email (SES), SMS (Phase 4), STT and LLM (Phase 5) — each behind integration_registry.enabled which a trigger refuses to set without an active baa row, and mirrored in the egress allowlist so a registry bypass still meets a closed network. (8) Operator access — no SSH; ECS Exec via SSM with session logging to an audit bucket, gated by hardware MFA; production DB reachable only via a bastion-less SSM port-forward with time-boxed IAM permission sets; every operator PHI access is itself a phi_access_log row (purpose=operations) written by a support tool, never psql.

TENANCY. Shared database, shared schema, tenant_id uuid NOT NULL on every table and in every unique constraint and index; Postgres row-level security ENABLED and FORCED on every table with USING/WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid) — the `true` (missing_ok) makes an unset GUC evaluate to NULL, which is false, so a connection that forgot SET LOCAL sees zero rows rather than everything (fail closed). withGuard opens the transaction and issues SET LOCAL app.tenant_id / app.user_id / app.session_id before any query; SET LOCAL (not SET) means the setting dies with the transaction, which is what makes PgBouncer transaction pooling safe later. The application never connects as the table owner: app_migrate owns tables and runs only from the migration runner; app_rw is the request role; app_append has INSERT-only on ledger_entries, payment_allocations, approval_requests, approvals_log, control_decisions, control_exceptions, claim_events, chart_events, clinical_notes_filed, note_amendments, appointment_events, domain_event, phi_access_log, disclosures, audit_chain_checks, bank_transactions — with UPDATE/DELETE revoked and BEFORE UPDATE/DELETE triggers that RAISE as the second lock (the trigger catches app_migrate misuse; the grant catches everything else). Advisory locks are salted with tenant_id (FNV-1a of tenant||subject, the gamify.ts pattern) so one practice's serialization never blocks another; the global ADMIN_GUARD_LOCK constant is retired. Why RLS over schema-per-tenant or database-per-tenant: one migration path, one connection pool, one backup, cheapest for a solo team; the tested backstop (CI negative tests on a real Postgres 16 container, not PGlite) is what makes it defensible in the SRA; per-tenant DEKs mean a cross-tenant SQL leak of encrypted columns yields ciphertext. Schema-per-tenant is documented as the escalation for a group customer that contractually demands it (the RLS policy expression already isolates the code paths that would change); database-per-tenant only for a regulated buyer willing to pay for it. UUIDv7 primary keys everywhere; per-tenant sequences for human-visible numbers so no identifier leaks cross-tenant volume.

NETWORK. One VPC per environment (prod, staging) in separate AWS accounts under an organization with SCPs (deny disabling CloudTrail/GuardDuty/Block Public Access, deny KMS key deletion without a 30-day window); private subnets for app, worker, DB; VPC endpoints for S3/KMS/Secrets Manager/CloudWatch so PHI traffic never traverses the public internet inside AWS; NAT with an egress allowlist; GuardDuty + CloudTrail + VPC flow logs to a logging account with Object Lock; WAF managed rules (common, known-bad-inputs, SQLi) plus a rate-based rule; Route 53 health checks feed the status page. NPRM network segmentation is satisfied by subnet/security-group tiering and by the worker/app split.

HOSTING CHOICE AND WHY. AWS (ECS Fargate + RDS Postgres + S3 + KMS + Secrets Manager + SES + WAF + CloudTrail/GuardDuty) over Fly Machines + Neon. Reasons: a single AWS BAA covers compute, database, storage, key management, logging, email and — later — Bedrock and End User Messaging, which collapses the subprocessor list and the BAA-gating registry to one row for the whole platform; RDS gives Multi-AZ, PITR (35 days), cross-region automated backup replication with a multi-region KMS key, and AWS Backup Vault Lock for ransomware-immutable copies; S3 Object Lock in compliance mode is the WORM anchor for audit-chain heads; Fargate is long-lived containers without host management, which the design already requires (pg-boss, no serverless pool max:1). Neon's HIPAA tier and Fly's BAA availability are viable alternatives but each adds a subprocessor and splits the failover story; both are recorded in citations_to_verify. Single region (us-east-2 or us-east-1) in Phases 0–3 with cross-region encrypted backups and a rehearsed failover runbook; two-region active/passive (cross-region read replica promoted, S3 CRR, Route 53 failover) at Phase 4.

KEY MANAGEMENT. Envelope encryption: KMS GenerateDataKey per tenant yields a plaintext DEK (used in memory only, cached ≤5 minutes) and a wrapped DEK stored in tenant_keys(tenant_id, version, wrapped_dek, algorithm, created_at, retired_at). Field encryption is AES-256-GCM with a 96-bit random nonce and AAD = tenant_id||table||column||row_id so a ciphertext copied between rows or tenants fails authentication. Rotation: create a new DEK version, new writes use it, a pg-boss job re-encrypts old rows lazily; KMS CMK rotation annually (automatic) does not require re-encryption. Audit-chain HMAC keys are derived per tenant via HKDF from a separate KMS-held root and cached in memory; they never touch the database, so a database-only adversary cannot forge a chain. Daily chain heads are signed with a KMS asymmetric key (ECDSA P-256) and written to S3 Object Lock; the public key is published on the trust page so an auditor can verify a head without our cooperation. Recovery codes, PINs and API keys are hashed (argon2id / SHA-256 for high-entropy keys), never encrypted, because they never need to be read back. Tenant offboarding destroys the wrapped DEK after export (crypto-shredding), which is the media-disposal control for a cloud where we do not own disks.

SECRETS. Secrets Manager holds AUTH_SECRET (array: current+previous for rollover), DB credentials, KMS key ids (not secret but config), connector credentials, webhook secrets; ECS injects them as task secrets; nothing in images, nothing in the repo (gitleaks blocks CI), no .env in production. Boot guard (extending resolveDbBackend): refuse to start unless POSTGRES_URL parses and pins to verify-full, KMS_DEK_KEY_ID / KMS_CHAIN_KEY_ID / KMS_SIGN_KEY_ID are resolvable (a DescribeKey call at boot), OBJECT_STORAGE_BUCKET is reachable, APPEND_ROLE_URL is present and its role lacks UPDATE on ledger_entries (probed with a dry-run that expects 42501), BACKUP_VERIFY_MAX_AGE_DAYS is satisfied by the last restore drill row, AUTH_SECRET ≥32 bytes, TRUSTED_PROXY_HOPS is set explicitly. PGlite is permitted only when NODE_ENV=test; the ALLOW_EPHEMERAL_DB two-hands rule survives for the e2e battery.

ENVIRONMENTS. dev (local Postgres 16 in Docker with synthetic tenants; PGlite only for pure unit tests), CI (ephemeral Postgres 16 service container for RLS/role/migration tests; PGlite for the fast unit suite), staging (separate AWS account, prod-like topology, synthetic data generated by the training/synthetic-notes generator — never a production snapshot, not even 'de-identified', because maskPhi is not a Safe Harbor process), production. Migrations run only from CI/CD as app_migrate with a shadow-DB dry run and a fresh-vs-migrated schema diff; hand-run DDL against production is prohibited and detectable (the migration history table is itself append-only and chained).

## Identity and access

IDENTITY. One human, one account, per tenant (users unique on tenant_id+username; email optional and never a login identifier on shared glass). No shared logins exist as a concept; the shared operatory tablet is a device profile, not an identity. Passwords: bcrypt cost 12 behind hashGate (lift verbatim), 10–72 byte policy, blocklist, plus a HIBP k-anonymity range check at set/change and a 5-entry history. Failed-attempt throttle lifted verbatim (pair key gates, IP key detects only, DB-backed), with the e2e/lockout.mjs probe promoted to blocking CI. Login failure copy byte-identical across causes (no username/MFA-enrollment oracle), asserted by e2e/mfa.totp.mjs.

MFA. Mandatory for every account; enrollment forced at first sign-in with no skip; TOTP (otpauth wrapper lifted) with secret envelope-encrypted; ten single-use recovery codes shown once and stored argon2id-hashed; 'start' refuses while enabled, 'disable' requires a current code (existing lifecycle rules kept); passkeys/WebAuthn added at Phase 4 as a phishing-resistant alternative and the preferred factor on desk profiles; SSO via SAML/OIDC with MFA asserted by the IdP for the group tier (Phase 5), SCIM for JML. Step-up (re-verify factor within 2 minutes) on: approvals above the tenant's high-value band, role/entitlement grants, BAA registry and control-policy changes, exports above a row threshold, break-glass. MFA reset is a two-person action (admin cannot self-target — existing route semantics) and lands in the audit log.

SESSIONS. Server-side sessions table is the authority: sessions(id, tenant_id, user_id, device_profile operatory|desk, created_at, last_seen_at, idle_deadline, absolute_expires, revoked_at, revoked_reason, ip, ua, mfa_verified_at). Idle 10 minutes on operatory, 30 on desk, 12 hours absolute; withGuard rejects when now > idle_deadline or absolute_expires or revoked_at is set, and slides idle_deadline on success. Cookie: __Host-pms_session, Secure, HttpOnly, SameSite=Lax, Path=/, carrying only the opaque session id inside the NextAuth JWT (which is retained purely as transport plus the pwAt watermark; the watermark check from sessionWatermark.ts stays as belt-and-braces because it is 35 lines and has already saved the product once). Active-session list and per-device revoke at /api/me/sessions; admin 'revoke all sessions for user' and incident-response 'revoke all sessions in tenant'. Shared operatory tablets: device_profile=operatory sessions require a per-user PIN (argon2id-hashed, ≥6 digits, throttled on the pwcheck namespace) to unlock after idle; PIN unlock resumes that user's own session with caret position restored; author switch = revoke current session, wipe client caches (encrypted key discarded), new PIN → that user's session. Zero wrong-author events is a Phase 3 exit criterion.

AUTHORIZATION. Derived per request from a fresh user row inside one default-deny wrapper. requireAccess(req, {tenant, minRank, entitlements[], clinicalScope?, locationScope?, phiRead?}) → SessionUser | typed 401/403. Three orthogonal axes: administrative rank (roles.ts ladder + MANAGE_CEILING actor×target predicates — an office manager can issue a reset link but never read or set a password, never act on the owner), clinical licence (clinicalRoles.ts derived not stored; dentist-owned sections and filing authority via approval.ts; TN scope rules parameterized by jurisdiction), financial entitlement (Precog's 14 + PMS additions, current view over the append-only user_entitlements grant log, location-scoped). Location is a real boundary for financial and roster data; clinical cross-location cover is a deliberate grant. Minimum necessary is expressed as role-scoped views and endpoints: front desk gets schedule, demographics, coverage, balance summary — never note bodies or perio data; biller gets ledger, claims, procedures and chart summary sufficient for coding; hygienist gets clinical record and a read-only balance; owner and the designated reviewer seat alone see person-scoped control signals. Restricted patients (employees, family, VIP) carry restricted_flag and require break-glass with an isValidPhiAttestation-validated reason. A treatment-relationship heuristic (patient on the user's schedule in ±30 days or assigned provider/hygienist) is advisory: outside it the chart still opens for clinical roles but prompts a purpose and writes phi_access_log with that purpose, feeding the after-hours/no-relationship read detector. Hard SoD blocks at action time are the small named set (requester ≠ approver, poster/preparer cannot clear that day's variance, no self-approval of vendor or payroll); everything else is detected and requires a dated decision.

CI GUARANTEE. A vitest test globs apps/pms/src/app/api/**/route.ts and **/*.action.ts, parses exports, and fails if any exported handler is not a withGuard(...) call (allowlist: /api/auth/[...nextauth], /api/setup while user count is zero, /api/reset token path, /api/health, webhook receivers that use timingSafeEqualStr on an HMAC). requireRole's four behaviours (active, revoked, rank, ack) plus the new tenant/location/entitlement checks get direct unit tests against a real Postgres container — the current 18-line guards.test.ts is the gap named in the exploration.

BREAK-GLASS. (a) Account recovery: recovery_ceremonies — admin A initiates for user X; a distinct admin B with MFA verified ≤5 minutes ago approves within 15 minutes; a one-time reset link is minted and mailed by the existing issueResetLink path; both admins are frozen on the row and a hard event goes to the owner. For 1-owner/1-OM tenants the vendor's support identity can be the second approver, which is itself logged and visible to the owner. (b) Vendor emergency access: a break-glass IAM role assumable only with a hardware key held offline, time-boxed to 1 hour, with session recording; any PHI touched is written to phi_access_log purpose=break_glass with justification; the owner of every affected tenant is notified. (c) Clinical break-glass: restricted patient open with reason; reviewed in the monthly log review. The ADMIN_PASSWORD_RESET environment flag and mfaFeature.ts are deleted.

## Encryption

IN TRANSIT. TLS 1.2 minimum, 1.3 preferred, at the ALB (ELBSecurityPolicy-TLS13-1-2-2021-06); HSTS max-age=63072000; includeSubDomains, with preload enabled by HSTS_PRELOAD=1 only after the production apex is final (the existing config's irreversibility warning is correct). Postgres: pinPostgresSslMode lifted verbatim and promoted from 'rewrite the URL' to 'refuse to boot unless the effective sslmode is verify-full with the RDS CA bundle present'. S3, KMS, Secrets Manager via VPC endpoints over TLS. Connectors: a single shared outbound HTTP client with host allowlist (from integration_registry), TLS verification mandatory, no redirect following off-allowlist, timeouts; clearinghouse SFTP with pinned host keys where batch 837/835 files are exchanged; webhooks inbound verified by HMAC-SHA256 over raw body + timestamp with a 5-minute window and timingSafeEqualStr. No PHI in URLs, query strings, Referer (Referrer-Policy same-origin), or email subjects (threading.ts rationale kept); UUIDv7 in paths only.

AT REST — PLATFORM LAYER. RDS storage, automated backups, snapshots and cross-region copies encrypted with customer-managed KMS keys (multi-region key for the replica region); S3 SSE-KMS with bucket keys on documents/era/exports/audit-heads; ECS ephemeral storage encrypted; CloudWatch log groups encrypted with KMS; Object Lock (compliance mode, 7 years) on audit-heads and on WORM export bundles; AWS Backup Vault Lock on the snapshot vault. This layer is what makes a lost backup or decommissioned disk 'secured PHI' under 164.402 and the HHS 2009 guidance, and it is stated exactly that way in the SRA and the trust page (no adjective, just the mechanism).

AT REST — APPLICATION LAYER (envelope, per tenant). AES-256-GCM, random 96-bit nonce, AAD binding (tenant_id||table||column||row_id), DEK per tenant wrapped by KMS, DEK versions in tenant_keys. Encrypted columns: users.mfa_secret_enc; patients.ssn_enc with an HMAC-SHA256 blind index of the last four digits (key derived from the tenant DEK) so 'find by last-4' works without decrypting; patient_coverage.member_id_enc; bank_accounts.account_number_enc / routing_enc; portal identity tokens; processor customer/payment-method tokens; api_keys are SHA-256 hashed instead; recovery codes and PINs argon2id-hashed. Names, DOB, phone, address, MRN, appointment and ledger data stay cleartext under RLS + access logging because the product must search, sort and join on them at chairside speed; this is a documented, defensible §164.312(a)(2)(iv) decision recorded in the SRA with its compensating controls (RLS, per-tenant DEKs for the highest-value identifiers, encrypted volumes, PHI read logging, egress classifier). Deterministic encryption of names for equality search is rejected (frequency analysis on a small practice's name set is trivial).

ON THE DEVICE. Any client-side persistence of PHI (draft mirror, degraded-mode read cache) is AES-GCM under a per-session key issued by the server at sign-in, held only in memory (never localStorage/IndexedDB), and discarded on sign-out, author switch, idle lock or revoke — which renders the stored bytes unrecoverable without wiping them; wipe is also attempted. Disabled entirely when device_profile=operatory. IndexedDB/localStorage never hold cleartext PHI; the Phase 3 exit criterion is an inspection showing zero cleartext PHI after logout. Browser SpeechRecognition (off-device) is blocked on PHI fields; Permissions-Policy keeps microphone=(self) for the future on-device engine.

LOGS AND TELEMETRY. Structured logger with an allowlist serializer (src/lib/learning/redact.ts as the standard redactor) so request logs, error traces and metrics carry codes and ids only; no third-party error tracker until a BAA exists, and even then the scrubber runs first; domain_event.payload is codes-and-ids by contract, enforced by a Zod schema that rejects free text fields above a small length.

KEY ROTATION AND DESTRUCTION. KMS CMKs auto-rotate annually; DEK re-wrap on CMK rotation is automatic; DEK version rotation on demand and at least every 24 months with lazy re-encryption; AUTH_SECRET dual-key rollover window of 24 hours; TLS certificates via ACM auto-renewal; tenant termination = export, then wrapped-DEK destruction (crypto-shred) logged in destruction_log, then row purge after the contractual window; KMS key deletion protected by a 30-day pending window and an SCP.

## Audit logging and monitoring

WHAT IS LOGGED. Two high-integrity streams plus one accounting table, all written in the same transaction as the business write so a log row cannot be skipped by a code path: (1) domain_event — every state change (auth.*, role.*, ledger.*, claim.*, chart.*, control.*, export.*, disclosure.*, backup.*, chain.*, connector.*) with actor id + frozen name, session_id, ip, ua, aggregate, event_type, payload (codes and ids only), prev_hash, hash; this is also the transactional outbox (processed_at) that pg-boss fans out to the controls engine, detectors, digests and webhooks. (2) phi_access_log — every read of PHI: actor, patient_id/account_id, resource_kind, resource_id, purpose (treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms), justification (break-glass only), ip, session_id; detail views log per record; list/search views log one row with patient_ids[] and a count so 'who viewed whom' is always answerable without a row per result. (3) disclosures — the §164.528 accounting: channel, recipient, records, purpose, actor, document. Sign-ins, failures, lockouts, spray detections, MFA changes, session revokes, new-device logins are events; unknown usernames are never logged (attacker-writable log).

INTEGRITY. Both streams are written by app_append (INSERT-only), protected by BEFORE UPDATE/DELETE triggers, partitioned monthly, and hash-chained per tenant: hash = HMAC-SHA256(chain_key_tenant_v, prev_hash || canonical JSON of the row). Insertion for a tenant is serialized by a tenant-salted pg_advisory_xact_lock so the chain has one linear head. The HMAC key is HKDF-derived from a KMS-held root and lives only in process memory, so a database-only adversary cannot recompute a valid chain after editing. A nightly pg-boss job in packages/verifier (sealed, zero app imports) walks each tenant's chain since the last verified head, writes audit_chain_checks(tenant, day, ok, head_hash, object_lock_key), signs the head with a KMS asymmetric key and puts it in the Object Lock bucket; any mismatch is a hard event to the owner and the vendor security officer and freezes exports for the tenant until cleared. A CI test plants a tamper (direct UPDATE as app_migrate on a test DB) and asserts detection. The single write point pattern from auditLog.ts (bounded columns, marked truncation, frozen actor) is kept; ip/ua become real columns rather than free text.

RETENTION AND REVIEW. Six years minimum for domain_event/phi_access_log/disclosures (§164.316(b)(2), §164.528); partitions past retention are detached and archived to Glacier with Object Lock, never dropped, unless a destruction_log row and no legal hold permit it. Monthly information-system-activity review (§164.308(a)(1)(ii)(D)) is a generated compliance_task with pre-filtered views and an attested completion event; quarterly access review of entitlements is another; both surface overdue on the Compliance lead home. Default UI filter hides routine sign-ins ('a successful login is the noise; a failed one is the signal'); every row renders as a plain sentence and every export shows the row count actually rendered.

MONITORING AND ALERTING. Detectors run as pg-boss consumers over the event stream: failed-login bursts, lockouts, spray, new device on a financial role, impossible-geography sign-in (optional, tenant-configurable), PHI-read volume per user versus the practice's own baseline, reads of patients with no schedule relationship, after-hours reads/postings, export volume, break-glass use, connector enable/disable, control-policy changes, chain verification failure, restore-drill failure, backup age. Hard events (the design's named set plus chain failure, break-glass, connector change, drill failure) page the owner and the vendor immediately via BAA-covered channels (SES; SMS at Phase 4); everything else flows to the weekly digest with SYSTEMIC_SHARE re-scoping and acknowledgment stamping; person-scoped detail is owner + reviewer seat only and never rendered as a ranking. Platform telemetry: CloudTrail (all regions, Object Lock), GuardDuty, VPC flow logs, WAF logs, RDS/ECS metrics to CloudWatch with alarms on error rate, saturation, replication lag, failed KMS calls, and unusual IAM activity; a SIEM (Security Lake or a BAA-covered vendor) is a Phase 4 hardening item. Health checks feed the public status page so uptime is measured, not asserted.

## Ai and phi policy

PRINCIPLE. PHI reaches a model only through a named, logged, BAA-gated boundary — the inversion of Smile Notes' 'the app holds no PHI, so the AI gate blocks everything that looks like PHI' into 'this field may cross to this BAA-covered destination for this purpose'. Deterministic first, model second, human always; AI is included in the price or off, never metered; 'AI off' never removes a feature because every capability has a shipped deterministic twin.

WHEN PHI MAY REACH AN LLM. Only when all of the following hold: (1) integration_registry has kind='llm' enabled, which the DB trigger permits only with an active baa row for the provider (zero data retention, no training on inputs, US data residency, subprocessor list disclosed) — candidates decided at Phase 4: Amazon Bedrock (under the AWS BAA), Azure OpenAI (Microsoft BAA), or Anthropic's API under a signed BAA with zero-retention; xAI/Grok is excluded because no BAA is available; (2) the tenant has opted in (tenants.settings.ai_enabled) and the acting user's clinical role passes capabilityTier for that capability (server-side, from the fresh row); (3) the payload was built by the assist service from a per-capability field allowlist (e.g., note normalization may send the note body sections and procedure codes; it may never send name, DOB, MRN, SSN, contact, member id, account balance); (4) the egress classifier (runPhiRule + scanPhiForProvider, additive-only merge) ran on the assembled payload and found no S0 identifier outside the allowlisted fields — a name or date appearing in free text is pseudonymized by maskPhi (random, per-call, never derived) or the call is refused; (5) the call is recorded as a disclosures row (purpose=ai, recipient=provider, records=ids) plus a codes-only drift row (capability, prompt version, model identity, token counts, outcome, latency, never content) so refusal rates have a denominator and model swaps are attributable.

DE-IDENTIFICATION STANCE. maskPhi and the PHI rules are pseudonymization for minimum-necessary, not Safe Harbor (§164.514(b)(2)) de-identification, and are never the basis for sending data to a provider without a BAA. If a genuinely de-identified data set is ever needed (benchmarking, research), it goes through Expert Determination or a complete Safe Harbor process with the 18 identifiers, documented, and is out of scope for v1.

OUTPUT HANDLING. Model output is untrusted data: it never authorizes anything, never writes to the record without a human accept, passes verifyMeaning (semantic check against the source) and evidence pinning (every proposal quotes its source span), shows spans not confidence percentages, and READBACK_CLASS tokens (tooth, surface, dose, amount, payer) require explicit confirmation on accept. Prompt-injection posture: system prompts and tool schemas are versioned (ASSIST_PROMPT_VERSION guarded in CI); any tool the coach can call is a read-only ToolResult over already-authorized data; no tool moves money, grants roles or sends messages. The controls coach (Precog lineage) receives role labels only, never names — context-pack.ts reshaped — and its outputs are labelled directional/educational.

SPEECH. Browser SpeechRecognition is an off-device disclosure to a browser vendor with no BAA; it is disabled on every PHI-bearing field from Phase 0. Voice perio and dictation ship at Phase 5 only through the DictationEngine seam with either an on-device Whisper WASM engine (no subprocessor, evaluated against a frozen dental WER corpus) or a BAA-covered STT vendor registered like any other connector.

VERIFIER PATTERNS FROM SMILE NOTES TO KEEP. Server-side licence gating before the run meter and before any provider call; PHI gate result returned before the meter is charged; one parseable row per call including successes; model identity logged as a version not a pointer; content never logged ('a log becomes the least protected copy of the clinical record'); connect-src 'self' so the browser can never talk to a provider; sealed independent verification of anything the model helped produce before it becomes a filed artifact. Marketing never says 'AI-powered'.

## Vendors and baas

MODEL. The vendor is a Business Associate of each tenant practice; every downstream party that creates, receives, maintains or transmits PHI on the vendor's behalf is a subcontractor BA requiring a BAA with §164.504(e)(2) terms and §164.314(a)(2)(iii) flow-down. The product's own BAA template (counsel-drafted) commits to: permitted uses limited to providing the service; safeguards per Subpart C; breach notification to the practice within 5 business days of discovery (well inside the §164.410 60-day ceiling) and, if the NPRM is finalized, notice within 24 hours of contingency-plan activation; subcontractor BAAs; return of PHI at termination via the no-fee self-service export; access to books and records for HHS; 6-year documentation retention; no sale, no training on practice data.

REGISTRY AS A TECHNICAL CONTROL (Phase 0). business_associates(vendor, category, contact) → baas(vendor_id, kind baa|dpa|no_phi_determination, signed_at, expires_at, controls_named jsonb, document_id, active) → integration_registry(kind, vendor_id, enabled, config). A trigger refuses UPDATE integration_registry SET enabled=true unless an active baa row exists with expires_at > now (or a no_phi determination reviewed by the security officer); expiring BAAs raise compliance_tasks 60/30/7 days ahead; the egress allowlist is generated from enabled rows so a registry bypass still meets a closed network. The public trust page renders the subprocessor list, BAA status and data category from these tables — it cannot drift from reality.

SUBPROCESSOR INVENTORY (planned). AWS (compute, RDS, S3, KMS, Secrets Manager, CloudWatch, SES, later Bedrock and End User Messaging) — one AWS BAA, all services must be on AWS's HIPAA-eligible list; clearinghouse (DentalXChange or Vyne) — BAA, EDI transport, eligibility/claims/ERA PHI; card processor with hosted fields — BAA required because patient name + amount + practice is PHI; if the chosen processor will not sign, the integration must send only an opaque account token and amount; bank aggregator (Plaid/Finicity class) — DPA required, BAA preferred, treated as PHI-adjacent, read-only scopes; email — SES under the AWS BAA (replaces Resend unless Resend signs a BAA); SMS/voice (Phase 4) — Twilio with BAA or AWS End User Messaging; STT (Phase 5) — on-device preferred, else BAA vendor; LLM (Phase 5) — Bedrock/Azure/Anthropic with BAA and zero retention; error tracking/APM — none until a BAA is signed (Sentry Business+ or Datadog with BAA), scrubber always on; status page vendor — no PHI, no BAA needed (documented determination); support desk — no PHI permitted in tickets, redactor on any pasted content; ADA CDT licence — not a PHI vendor, licence compliance only; SOC 2 auditor and pen-test firm — NDA + BAA because they see PHI-bearing systems.

NO-BAA EXCLUSIONS (documented). xAI/Grok and auth.grok.me (identity and model) — no BAA available, removed with the precog shell; browser SpeechRecognition — disabled on PHI fields; consumer analytics (GA etc.) — never on authenticated pages; any 'free tier' third-party CDN or font host — none (default-src 'self').

VENDOR RISK REVIEW. Annual review of each subprocessor's SOC 2/HITRUST report and HIPAA-eligibility status, recorded as a compliance_task with the report document_id; a subprocessor change triggers notice to tenants per the BAA (30 days) and a trust page diff.

## Backup dr and availability

TARGETS. RPO ≤5 minutes (RDS PITR transaction-log shipping); RTO ≤4 hours in Phases 0–3 (restore from snapshot/PITR in-region, or promote cross-region copy per runbook), ≤1 hour at Phase 4 with a warm cross-region read replica and Route 53 failover; both figures published on the trust page and measured by drills, and both sit inside the NPRM's proposed 72-hour restoration requirement (§164.308(a)(7) as proposed). Availability target 99.9% monthly with credits from Phase 4; Multi-AZ RDS and ≥2 app tasks across AZs from Phase 0 because both are cheap relative to a single-AZ outage.

BACKUP DESIGN. RDS automated backups with 35-day PITR; daily snapshots copied cross-region with a multi-region KMS key; AWS Backup vault with Vault Lock (compliance) so a compromised administrator cannot delete backups — the ransomware posture (Henry Schein 2023 is the market's reference incident); S3 versioning + cross-region replication + Object Lock for audit-heads and WORM exports; documents bucket with versioning and MFA-delete; per-tenant DEK wrapped copies replicated with the tenant_keys table (they are useless without KMS, which is itself multi-region for the replica). Backups inherit encryption, so a lost backup is 'secured PHI'.

RESTORE DRILLS (the deliverable is the drill, not the backup). Monthly automated pg-boss job: restore the latest snapshot to an isolated instance in the staging account, run packages/verifier (chain continuity per tenant, ledger invariants, day-close arithmetic, row-count parity against production's last known counts), record duration, tear down, write domain_event backup.restore_drill(ok, duration, snapshot_id) — a failed or stale drill (>35 days) is a hard event and a boot-guard failure for the next deploy. Twice a year a human-run full DR exercise promotes the cross-region copy and points staging traffic at it, with the runbook timed and updated (§164.308(a)(7)(ii)(D) testing and revision).

EMERGENCY MODE OPERATION (§164.308(a)(7)(ii)(C)) — the answer to the market's cloud-outage complaint. v1 ships an honest, bounded degraded mode rather than an offline ledger: a service worker holds today's schedule, patient critical alerts and chart summaries for the signed-in user, encrypted under the per-session in-memory key, TTL 24 hours, disabled on operatory/shared profiles; when the API is unreachable the shell shows a persistent banner stating exactly what still works, accepts no writes, and clears when connectivity returns. Financial postings, approvals and claims are never available offline because dual release and SoD cannot be enforced without the server — this is stated publicly. Queued clinical capture is a Phase 5 ADR decided from measured outage minutes. Criticality analysis (§164.308(a)(7)(ii)(E)) is written down: Tier 1 (Board, alerts, chart summaries — degraded mode), Tier 2 (encounter documentation, ledger posting, approvals — RTO ≤4h), Tier 3 (reports, digests, forensic suite — best effort).

STATUS AND INCIDENT TRANSPARENCY. External synthetic checks + internal /healthz (DB, KMS, S3, worker heartbeat, replication lag) feed a public status page with incident history and post-mortems generated from incidents rows; uptime shown is computed, never typed. Practices get a printed 'what to do when the cloud is down' card because the research shows no vendor documents any of this.

## Breach and incident response

DEFINITIONS AND CLOCKS BUILT INTO THE PRODUCT. A security incident (§164.304) is any attempted or successful unauthorized access, use, disclosure, modification or destruction; a breach (§164.402) is presumed for any impermissible acquisition/access/use/disclosure of unsecured PHI unless a documented four-factor risk assessment (nature/extent of PHI, unauthorized person, whether actually acquired or viewed, extent of mitigation) demonstrates low probability of compromise. Discovery is imputed to the first day any workforce member or agent knew or by reasonable diligence should have known — which is why detection and alerting define the clock and why the vendor commits contractually to notify tenants within 5 business days rather than the §164.410 60-day ceiling. The incidents module stores discovered_at, ba_to_ce_notified_at, hipaa_individual_deadline (+60 calendar days), tn_deadline (+45 days per Tenn. Code Ann. § 47-18-2107, with a counsel flag for the HIPAA-subject exemption), hhs_deadline (≥500: contemporaneous with individual notice; <500: within 60 days after the calendar year end), media_required (>500 residents of a state), law_enforcement_delay (§164.412), four_factor jsonb, affected_patient_ids (encrypted), status, and produces counsel-reviewable letter drafts with the §164.404(c) required content. Encrypted-at-rest media loss with keys intact is documented as 'secured PHI' and not a breach under the HHS 2009 guidance — the SRA states this so the decision is not made under pressure.

VENDOR IR PLAN (§164.308(a)(6)). Roles: security officer (owner or fractional vCISO), engineering lead, counsel, communications. Severity matrix: S1 confirmed PHI exposure or chain/immutability failure; S2 suspected exposure or auth compromise; S3 availability or integrity without exposure; S4 policy violation. Detection sources: hard-event detectors, GuardDuty/CloudTrail alarms, WAF anomalies, chain verification failure, restore-drill failure, vendor BA notice, tenant report, researcher disclosure (security.txt + public policy). Containment playbooks as runbooks with the audit row each must produce: rotate AUTH_SECRET (dual-key window) and connector credentials; revoke all sessions for a user/tenant/platform (sessions.revoked_at + users.sessions_revoked_at); disable a connector at the registry; freeze exports for a tenant; block IPs/ASNs at WAF; isolate a task; snapshot RDS and S3 objects for forensics before any remediation; preserve chain heads. Eradication and recovery with the restore procedures above. Evidence: CloudTrail, WAF, flow logs, domain_event/phi_access_log slices exported with their chain proofs to an Object Lock bucket; chain of custody documented. Post-incident: four-factor assessment, notifications, root cause, corrective actions in the risk register, public post-mortem on the status page within 14 days for availability incidents (content reviewed by counsel for security incidents). Tabletop exercises twice a year (one ransomware, one insider/credential), plus one live 'revoke everything' drill on staging per quarter.

TENANT-FACING IR (Phase 1 intake, Phase 4 full module). Practices get an incident intake with both clocks, the four-factor template, a workforce sanction note, and the disclosures/phi_access_log queries needed to scope 'who saw what' — the questions OCR asks first. Anonymous tip channel (from wishes.ts, PHI-gated) is first-class because most fraud and many privacy incidents surface through tips.

REGULATORY AND CONTRACTUAL NOTICES. BA→CE per §164.410 (contract: 5 business days); CE→individuals §164.404 (≤60 days, first-class mail or agreed email, substitute notice rules); CE→HHS §164.408 via the OCR portal; CE→media §164.406; Tennessee AG/consumer reporting agencies when >1,000 residents; cyber-insurance carrier per policy; card processor/acquirer if payment pages are implicated (PCI 12.10). The product records each notice as an event with the artifact's document_id.

## Secure sdlc

REPOSITORY AND REVIEW. pnpm-workspaces monorepo seeded from the dental repo; precog history not carried (committed PREVIEW_CLIENT_SECRET rotated and never imported). Branch protection on main: required PR review, required status checks, no force push, signed commits; CODEOWNERS requiring a second reviewer for packages/verifier, packages/db (migrations, roles, RLS policies), apps/pms/src/lib/auth, the withGuard wrapper, integration_registry code, and .github/workflows. Every PR touching an append-only table, an RLS policy, a role grant or the verifier gets a 'security-review' label and a checklist (threat, test added, audit row emitted, migration reversible).

BLOCKING CI (one job; everything below fails the merge). tsc --noEmit; eslint (add — neither repo has it) with security plugins (no-unsafe-regex, no-eval) and a custom rule forbidding direct table writes to ledger_entries outside the ledger service; vitest with a coverage floor (start at current, ratchet); route-guard glob test (every route/action wrapped or allowlisted); RLS/role negative tests against a real Postgres 16 service container (cross-tenant leak, missing SET LOCAL → zero rows, app_append UPDATE → 42501, trigger RAISE on append-only tables); planted-tamper chain-detection test; import-purity tests (packages/clinical-core, controls-engine, verifier import nothing from apps/); verifier seal check (manifest hashes match; unsealed files fail); drizzle-kit migration checks (schema.ts changed without a migration → fail; shadow-DB apply; fresh-vs-migrated schema diff empty); version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION, SCORING_VERSION, CONTROL_RULEBOOK_VERSION) lifted from ci.yml; gitleaks secret scan; pnpm audit failing on high/critical with a documented exception file that expires; SBOM (CycloneDX) generated and attached; Trivy scan of the built image; the e2e security probes (headers, lockout, mfa.totp, submission.immutability, account.lifecycle, prehydration.login) run against a production build on ephemeral Postgres in the blocking job, not continue-on-error; next build.

DEPENDENCIES AND SUPPLY CHAIN. Exact pins in package.json, frozen lockfile, pnpm --ignore-scripts in CI with an explicit allowlist for packages that genuinely need install scripts; Renovate weekly grouped updates, security advisories immediately, tracked to the NPRM-aligned SLA (critical 15 days, high 30); next-auth beta pinned exactly and wrapped behind src/lib/auth/guards.ts so it is swappable; provenance: GitHub artifact attestations for images; base image distroless Node LTS, digest-pinned, rebuilt weekly; no dependency added without a one-line justification in the PR; dependency count reviewed quarterly (precog's 24 unused Radix packages are the cautionary example).

SECURE CODING RULES (enforced where possible). Zod at every boundary behind readJsonRecord (with Content-Type check and 1 MB cap); parameterized queries only (Drizzle); no raw HTML rendering; output via React; nonce CSP in Phase 4; server actions and routes only through withGuard; money in bigint cents; UUIDv7 ids; frozen attribution; no PHI in logs (allowlist serializer; a test greps log output in e2e for seeded PHI strings and fails on any hit); no PHI in test fixtures (synthetic generator only); no production data in non-production environments; errors return human sentences without stack traces or wire-format words.

RUNTIME HARDENING. Fargate tasks non-root, read-only root filesystem, minimal IAM task roles (per service), no inbound to workers, health checks that fail closed on missing KMS/DB/storage, boot guards described above, structured logging with redaction, request ids threaded into domain_event for correlation.

TESTING BEYOND CI. Property-test suite for the ledger (10,000 generated scenarios) before any UI; golden + monotonicity tests for every lifted Precog function before a score is shown; precision harness for the PHI egress classifier (zero false blocks on the corpus after re-scope); threat model (STRIDE-lite) written per module and revisited at each phase gate; annual third-party penetration test from Phase 4 (findings closed as a GA exit criterion), authenticated DAST against staging every 6 months; bug bounty or at least a published security.txt and disclosure policy from Phase 1.

RELEASE. Migrations run by CI as app_migrate with the history table chained; deploys are blue/green on ECS with automatic rollback on health failure; every release has an SBOM, an attestation, a changelog line for any security-relevant change, and a re-seal diff if the verifier moved.

## Compliance program

GOVERNANCE. Designate a Security Officer (§164.308(a)(2)) — the owner initially, with a fractional vCISO engaged by Phase 2 — and a Privacy Officer (counsel/owner). Maintain the vendor's own written policies and procedures (§164.316(a)) in the repo under docs/security/policies with version history: information security, access control and JML, acceptable use and workstation, encryption and key management, logging and monitoring, vulnerability and patch management, change management and SDLC, incident response and breach notification, contingency/backup/DR, vendor and BAA management, data retention and disposal, sanctions, training, physical security (cloud-provider inherited + laptop controls), AI use. Each reviewed annually and on material change; retained 6 years from last effective date (§164.316(b)(2)).

RISK ANALYSIS AND MANAGEMENT CADENCE. Enterprise SRA (NIST SP 800-30 method, HHS SRA Tool as a checklist) completed before any tenant PHI (Phase 1 entry), refreshed annually and on every architectural change (new connector, new region, new data class); risk register with likelihood/impact, treatment, owner, due date, evidence link; OCR's Risk Analysis Initiative (16 resolutions in 2025, continuing into 2026 with an announced shift toward risk management) makes an accurate, thorough, documented SRA plus evidence that identified risks were actually treated the single most-enforced obligation — the register must show closure, not just identification. The asset inventory and data-flow map (NPRM) are generated from IaC, integration_registry and the SBOM and attached to the SRA.

WORKFORCE. Background checks for anyone with production access; training at hire and annually (HIPAA, secure coding, phishing, incident reporting) with tracked completion; role-based least privilege in AWS via IAM Identity Center with hardware MFA; quarterly access reviews of AWS, GitHub, Secrets Manager and production DB permission sets, recorded; documented sanctions policy; termination checklist (revoke IdP, AWS, GitHub, rotate any shared secrets they could have seen) executed within 24 hours.

BAAS AND VENDORS. Countersigned BAA with every tenant before PHI (the Phase 1 pilot agreement includes it); subcontractor BAAs per the registry; annual vendor review recorded; subprocessor changes noticed 30 days ahead; the public subprocessor list generated from the registry.

EVIDENCE COLLECTION (dogfooded). The product itself produces most vendor evidence as audit rows: restore drills, chain verifications, monthly log reviews, quarterly access reviews, BAA expiries, training completions, incident timelines, policy approvals — exported as a signed evidence pack for auditors. Tenant-facing, the Phase 4 compliance module gives practices the same loop (SRA questionnaire → tailored versioned policies → remediation tasks → server-verified training with certificates → BAA document management → incident clocks → annual reminder), labelled provisional until Tennessee counsel review.

ATTESTATION PATH AND TIMING. HIPAA has no certification; the product never claims one. SOC 2: engage the auditor at Phase 2 start so the design and Type 1 readiness overlap the build; Type 1 report at Phase 2 exit; Type 2 observation window (6 months) spanning Phases 3–4 with the report at Phase 4 GA — early buyers are told plainly that they are trusting a pen test, a documented SRA and published policies until then. HITRUST e1 (then i1) is a Phase 5+ decision driven by DSO/group buyers demanding it; not before. PCI: SAQ A attestation with the processor annually; payment-page script inventory and change detection per v4.0.1 6.4.3/11.6.1. The NPRM's annual compliance audit and annual BA written verification are pre-adopted as internal practice (annual technical evaluation §164.308(a)(8) already required) so finalization changes paperwork, not architecture.

METRICS PUBLISHED INTERNALLY. MFA coverage (must be 100%), median time from deactivation to session death (must be ≤1 request), chain verification pass rate, restore-drill pass rate and duration, patch SLA adherence, open risk items past due, BAA coverage of enabled connectors (must be 100%), PHI-in-logs test hits (must be 0), pen-test findings open by severity.

## Citations to verify

- The HIPAA Security Rule NPRM 'HIPAA Security Rule To Strengthen the Cybersecurity of Electronic Protected Health Information' was published at 90 FR 898 on January 6, 2025, with comments due March 7, 2025.
- As of September 3, 2026, HHS has not published a final rule amending the HIPAA Security Rule based on the January 2025 NPRM; the OMB Unified Agenda lists July 2027 as the target for final action.
- The January 2025 NPRM proposes to eliminate the distinction between 'required' and 'addressable' implementation specifications, making all specifications required with limited exceptions.
- The January 2025 NPRM proposes to require multi-factor authentication for access to ePHI and encryption of ePHI at rest and in transit, each with limited exceptions.
- The January 2025 NPRM proposes written procedures to restore the loss of certain relevant electronic information systems and data within 72 hours.
- The January 2025 NPRM proposes vulnerability scanning at least every six months and penetration testing at least once every twelve months.
- The January 2025 NPRM proposes an annual written technology asset inventory and network map of ePHI movement.
- The January 2025 NPRM proposes network segmentation, anti-malware protection, removal of extraneous software, and disabling unused network ports.
- The January 2025 NPRM proposes patching critical vulnerabilities within 15 calendar days and high-risk vulnerabilities within 30 calendar days of identification.
- The January 2025 NPRM proposes that business associates notify covered entities within 24 hours of activating their contingency plans.
- The January 2025 NPRM proposes an annual compliance audit and annual written verification by business associates, through a subject-matter expert analysis, that required technical safeguards are deployed.
- If finalized as proposed, regulated entities would have 240 days to comply (60 days to effective date plus 180 days).
- 45 CFR 164.308(a)(1)(ii)(A)–(D) make risk analysis, risk management, sanction policy, and information system activity review 'required' implementation specifications.
- 45 CFR 164.308(a)(7)(ii)(A)–(C) make data backup plan, disaster recovery plan, and emergency mode operation plan 'required'; (D) testing and revision and (E) applications and data criticality analysis are 'addressable'.
- 45 CFR 164.312(a)(2)(i) unique user identification and (ii) emergency access procedure are 'required'; (iii) automatic logoff and (iv) encryption and decryption are 'addressable'.
- 45 CFR 164.312(b) audit controls and 164.312(d) person or entity authentication are 'required' standards without addressable sub-specifications.
- 45 CFR 164.312(c)(2) mechanism to authenticate ePHI and 164.312(e)(2)(i)–(ii) integrity controls and encryption in transmission are 'addressable'.
- 45 CFR 164.316(b)(2)(i) requires documentation required by the Security Rule to be retained for 6 years from the date of its creation or the date when it last was in effect, whichever is later.
- HITECH Act section 13401 (42 U.S.C. 17931) applies 45 CFR 164.308, 164.310, 164.312 and 164.316 directly to business associates.
- 45 CFR 164.502(b) and 164.514(d) impose the minimum necessary standard, and 164.514(d)(2) requires role-based identification of persons needing access.
- 45 CFR 164.528 requires an accounting of disclosures for the six years prior to the request, excluding disclosures for treatment, payment and health care operations.
- 45 CFR 164.524(b)(2) requires action on a right-of-access request within 30 days, with one 30-day extension permitted.
- 45 CFR 164.514(b)(2) Safe Harbor de-identification requires removal of 18 enumerated identifiers; 164.514(b)(1) provides the Expert Determination alternative.
- 45 CFR 164.402 defines 'breach' with a presumption of breach absent a documented four-factor risk assessment, and defines 'unsecured protected health information' by reference to HHS guidance on encryption and destruction.
- HHS 'Guidance Specifying the Technologies and Methodologies That Render Protected Health Information Unusable, Unreadable, or Indecipherable to Unauthorized Individuals' was published at 74 FR 19006 (April 27, 2009) and treats encryption consistent with NIST guidance as rendering PHI secured.
- 45 CFR 164.404(b) requires notification to individuals without unreasonable delay and in no case later than 60 calendar days after discovery of a breach.
- 45 CFR 164.404(a)(2) provides that a breach is treated as discovered on the first day it is known, or by exercising reasonable diligence would have been known, to any person other than the person committing the breach who is a workforce member or agent.
- 45 CFR 164.406 requires notice to prominent media outlets when a breach involves more than 500 residents of a State or jurisdiction.
- 45 CFR 164.408 requires notice to HHS contemporaneously with individual notice for breaches of 500 or more individuals, and within 60 days after the end of the calendar year for breaches of fewer than 500.
- 45 CFR 164.410 requires a business associate to notify the covered entity of a breach without unreasonable delay and in no case later than 60 calendar days after discovery.
- 45 CFR 164.412 permits delay of notification when a law enforcement official states that notification would impede a criminal investigation.
- 45 CFR 164.504(e)(2) enumerates the required contents of a business associate contract, including subcontractor flow-down under 164.502(e)(1)(ii) and 164.314(a)(2)(iii).
- Tenn. Code Ann. § 47-18-2107(b) requires disclosure of a breach of system security to affected Tennessee residents no later than 45 days from discovery or notification of the breach, subject to law enforcement delay.
- Tenn. Code Ann. § 47-18-2107 requires notice to consumer reporting agencies when more than 1,000 Tennessee residents are notified at one time.
- Tenn. Code Ann. § 47-18-2107 contains an exemption for information holders subject to HIPAA/HITECH (verify subsection and scope; the design assumes the state clock may not bind covered entities but tracks it anyway).
- Tenn. Code Ann. § 47-18-2107 defines 'personal information' to exclude encrypted data unless the encryption key was also acquired.
- Tenn. Comp. R. & Regs. 0460-02-.12 (Board of Dentistry, Dental Records) specifies the retention period for adult and minor patient records — the design assumes 7 years for adults and 10 years (or age of majority plus a period) for minors; verify the exact text.
- Tenn. Comp. R. & Regs. 0460-02-.12 specifies a deadline for furnishing copies of dental records on patient request — the design assumes 10 working days; verify the exact text and any fee provisions.
- Tenn. Comp. R. & Regs. 0460-02-.12 requires notification of patients seen within the preceding 36 months when a dentist retires or dies, and offers of record copies.
- In re Henry Schein Practice Solutions, Inc., FTC File No. 142-3161 (2016), resulted in a $250,000 settlement over claims that Dentrix G5 provided 'encryption' when it used a less secure data-masking method.
- The FTC Health Breach Notification Rule (16 CFR Part 318, as amended in 2024) does not apply to HIPAA covered entities or to business associates acting in that capacity.
- 45 CFR 171.102 defines information-blocking 'actors' as health care providers, health IT developers of certified health IT, health information networks and health information exchanges; a developer of non-certified health IT is not an actor.
- PCI DSS v4.0.1 requirements 6.4.3 (payment page script management) and 11.6.1 (payment page change and tamper detection) became mandatory on March 31, 2025.
- Merchants using fully outsourced payment pages via iframe/hosted fields, with no electronic storage, processing or transmission of account data on their systems, may be eligible for SAQ A under PCI DSS v4.0.1.
- Amazon RDS for PostgreSQL, ECS/Fargate, S3, KMS, Secrets Manager, CloudWatch, SES, Amazon Bedrock and AWS End User Messaging are on the AWS HIPAA Eligible Services list and covered by the AWS Business Associate Addendum.
- Amazon RDS supports point-in-time recovery with automated backup retention up to 35 days.
- Amazon S3 Object Lock in compliance mode prevents deletion or modification of object versions by any user, including the root account, for the retention period.
- AWS Backup Vault Lock in compliance mode prevents deletion of recovery points by any user including the account root.
- Neon offers a HIPAA-compliant tier (Business or Scale plan) with a signed BAA — verify current availability and price before choosing it over RDS.
- Fly.io offers a Business Associate Agreement on certain plans — verify current availability before choosing Fly Machines over ECS Fargate.
- Anthropic offers a Business Associate Agreement for the Claude API to qualifying customers, with zero-data-retention options — verify eligibility and terms before Phase 4 provider selection.
- Azure OpenAI Service is covered by the Microsoft Business Associate Agreement — verify current terms.
- Twilio signs Business Associate Agreements for SMS and voice on eligible accounts — verify current terms before Phase 4.
- Resend does or does not offer a Business Associate Agreement — verify; if not, Amazon SES under the AWS BAA replaces it.
- Plaid's developer agreement provides a Data Processing Addendum; whether Plaid will sign a HIPAA BAA must be verified before Phase 1 aggregator enablement.
- xAI does not offer a HIPAA Business Associate Agreement for its Grok API.
- Auth.js (NextAuth) v5 accepts an array of secrets to support key rollover, using the first to sign and all to verify — verify against the pinned beta version.
- Postgres current_setting(name, missing_ok=true) returns NULL when the setting is not defined, so an RLS policy comparing tenant_id to that NULL evaluates to false and returns no rows.
- Postgres FORCE ROW LEVEL SECURITY applies policies to the table owner as well; superusers and roles with BYPASSRLS still bypass policies.
- Postgres SET LOCAL scopes a configuration change to the current transaction, making it safe under PgBouncer transaction-mode pooling.
- OCR announced 16 Risk Analysis Initiative resolution agreements between January and August 2025 and has continued the initiative into 2026, including four ransomware-related settlements announced April 24, 2026 totaling $1,165,000.
- HHS OCR has signaled that the Risk Analysis Initiative will expand to evaluate risk management (whether identified risks were addressed), not only whether a risk analysis was performed.
- NIST SP 800-66 Rev. 2 (February 2024) is HHS/NIST's current guidance for implementing the HIPAA Security Rule.
- Henry Schein disclosed a BlackCat/ALPHV ransomware incident discovered October 14, 2023, with re-encryption in November 2023 and possible exposure of customer bank account and credit card information.

## Open questions

- Hosting vendor decision (owner): AWS single-BAA stack (recommended) versus Fly Machines + Neon HIPAA tier. The design assumes AWS; if Fly/Neon is chosen, the subprocessor list grows to three BAAs, cross-region backup and Object Lock stories must be re-derived, and the boot guards' KMS/backup checks need provider equivalents.
- Names and DOB in cleartext: the design keeps them searchable under RLS + access logging + volume encryption and documents the choice in the SRA. Some buyers and the plaintiff-attorney panel will challenge it. Is the owner comfortable defending this, or should Phase 4 add a searchable-encryption scheme (blind indexes on normalized last name + DOB) at real cost in search ergonomics?
- PHI read-logging granularity for list views: one row with patient_ids[] per list render (design) versus one row per patient shown. The former keeps volume tractable on a busy Board; the latter is simpler to query per patient. Which does counsel want to be able to produce in an OCR request?
- Tennessee § 47-18-2107 HIPAA-subject exemption: does counsel read it as removing the state 45-day clock for covered-entity tenants? The product tracks both clocks regardless, but the tenant-facing copy must not overstate a state duty.
- Tenn. Comp. R. & Regs. 0460-02-.12 retention and copy deadlines could not be read from this environment; the 7y/10y and 10-working-day assumptions must be confirmed by counsel before retention_until and the records_requests SLA are hard-coded as Tennessee jurisdiction parameters.
- Passkeys/WebAuthn timing: Phase 4 in the design. Should operatory tablets use platform passkeys instead of PIN re-auth from Phase 3, given the NPRM's MFA direction and the phishing resistance gain, at the cost of iPad/MDM enrollment friction?
- Card processor selection is a security question: will the chosen processor sign a BAA? If not, the integration must be constrained to opaque account tokens and amounts with no patient identifiers, and the estimate/checkout UX must be designed around that.
- Bank aggregator: Plaid/Finicity DPA versus BAA. Transaction descriptions can carry patient names (refund checks). Is the owner willing to run the aggregator under DPA-only with the egress classifier scrubbing descriptions, or is a BAA a hard requirement before enablement?
- LLM provider for Phase 5: Bedrock (under the AWS BAA, no new subprocessor) versus Anthropic direct with BAA versus Azure OpenAI. Bedrock minimizes the subprocessor list; the others may offer better models. Decide at Phase 4 with the SRA refresh.
- Error tracking/APM: the design ships with none until a BAA exists. Is the owner willing to operate Phases 0–3 on CloudWatch logs and structured events alone, or should a BAA-covered vendor (Sentry Business, Datadog) be procured in Phase 0?
- SOC 2 auditor engagement at Phase 2 start is a cost decision (roughly $15k–$50k for the audit plus tooling). Confirm budget and whether a Type 1 at Phase 2 exit is worth issuing or whether to go straight to Type 2 fieldwork.
- Two-admin recovery in 1-owner/1-OM tenants: the design lets the vendor's support identity act as the second approver (logged, owner-visible). Is that acceptable to the owner as counsel, or must every tenant designate a second human admin at provisioning?
- Degraded-mode cache on desk profiles: encrypted under an in-memory session key with 24h TTL. Should the cache be disabled by default and enabled per tenant, given that any client-side PHI is a breach surface the SRA must justify?
- Advisory-lock serialization of chain inserts per tenant is correct but adds contention on the hottest tenants at group scale; the alternative (per-tenant sequence number with a nightly re-chain) weakens real-time tamper evidence. Which trade does the owner prefer when the group tier arrives?
- Vendor-side break-glass to production data: the design permits a hardware-key, time-boxed, session-recorded IAM role. Does the owner want a stricter 'no vendor access to tenant PHI without tenant approval per incident' posture, accepting slower support?
- Retention of phi_access_log beyond 6 years: HIPAA documentation is 6 years, but the ledger and clinical record live longer under state law and malpractice repose. Should access logs follow the record they describe (longer) or the Security Rule minimum?
- NextAuth v5 beta: the design keeps it pinned and wrapped. At what phase gate does the owner want a formal decision to migrate to a stable library (or to Auth.js GA), given the audit optics of a beta dependency in the authentication path?
- Whether the Phase 1 financial-layer pilot (shadow ledger beside the incumbent) already constitutes holding PHI (patient names + balances) — yes under §160.103 — and therefore the vendor SRA, BAA with the pilot practice, encryption, and phi_access_log must all be live before the first import, not at Phase 2. Confirm the roadmap's Phase 1 entry gate reflects this.
