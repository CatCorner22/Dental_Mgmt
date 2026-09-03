# Security synthesis (merged technical-safeguards and compliance-program drafts, verifier corrections applied)

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 35 (Security phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, security, hipaa, synthesis

## Summary

The merged product is a HIPAA business associate from the first Phase 1 import: a shadow ledger holding patient names and balances is PHI under 45 CFR 160.103, so the vendor SRA, a countersigned BAA with the pilot practice, encryption, RLS, phi_access_log and…

## Executive summary

The merged product is a HIPAA business associate from the first Phase 1 import: a shadow ledger holding patient names and balances is PHI under 45 CFR 160.103, so the vendor SRA, a countersigned BAA with the pilot practice, encryption, RLS, phi_access_log and the incident plan must be live before the first row lands — not at Phase 2. This plan merges the technical-safeguards and compliance-program drafts into one program built to the current Security Rule (with correct required/addressable/standard terminology), to the January 2025 NPRM as direction of travel only (still proposed as of 2026-09-03; Unified Agenda target July 2027; may be withdrawn), to the Breach Notification Rule with its imputed-discovery clock, to Tennessee law as actually written (7-year-from-last-contact retention; minors max(last_contact+7y, dob+19y); incompetent patients indefinitely; 10-working-day copies under Tenn. Code Ann. 63-2-101, not Board rule 0460-02-.12; HIPAA-subject entities exempt from 47-18-2107 but the 45-day clock still tracked for non-PHI data), and to FTC/PCI/information-blocking regimes with their verified scope limits. Verifiers refuted one load-bearing vendor assertion (xAI DOES offer a BAA behind a questionnaire plus mandatory ZDR-Enabled API), corrected the Neon/Anthropic/Twilio/Resend/AWS eligibility details, and fixed two Postgres RLS gotchas (NULLIF on current_setting; SET LOCAL inside an explicit transaction) that would otherwise have turned the fail-closed tenancy story into cast errors or leaks on pooled connections. Everything that could not be read from a primary source in this environment (Tennessee statutes and rules beyond the retention rule, penalty tables, state breach deadlines, Part 2 compliance date, PC 1107, HTI-series, PCI SAQ A redirect carve-out, IBM breach cost, RPC 5.7, several vendor terms) is listed as unverified and must be confirmed by counsel or a live read before it becomes product copy, a scheduler rule, or a retention timer. Architecture is unchanged from the product design: shared-schema Postgres with forced RLS accessed by non-owner roles, per-tenant envelope encryption with KMS, an INSERT-only role plus triggers for every append-only table, HMAC hash chains anchored daily to S3 Object Lock, a BAA registry that gates connector enablement at the database and at the network egress allowlist, mandatory TOTP with server-side sessions, and a sealed independent verifier. Marketing never says HIPAA compliant, certified, lawsuit-proof, board-proof or AI-powered (In re Henry Schein Practice Solutions, FTC File No. 142 3161, Docket C-4575, $250,000 monetary relief, final order May 23, 2016).

## Regulatory scope


### Item 1
- **regime**: HIPAA Security Rule, 45 CFR Part 164 Subpart C (164.302–164.318), as in force
**applies because**

The vendor creates, receives, maintains and transmits ePHI on behalf of covered-entity dental practices and is a business associate under 160.103; HITECH 13401 (42 U.S.C. 17931(a)) applies 164.308, 164.310, 164.312 and 164.316 to BAs directly and 17931(b) applies civil/criminal penalties; implemented at 164.104(b)/164.302 by the 2013 Omnibus Rule. Each tenant is a covered entity the moment the PMS sends an 837D or 270 for it, so every tenant is treated as a CE from onboarding.

- **citation**: 45 CFR 164.302, 164.306(c)-(d), 164.308, 164.310, 164.312, 164.314, 164.316; 42 U.S.C. 17931; 78 FR 5566 (2013)

#### key obligations
- 164.308(a)(1)(ii)(A)-(D) risk analysis, risk management, sanction policy, information system activity review — all Required implementation specifications (OCR Risk Analysis Initiative, launched October 2024, 13 completed investigations as of April 23, 2026, now extending to risk management under (B))
- 164.308(a)(3)-(5) workforce security, information access management, awareness/training incl. log-in monitoring and password management (largely Addressable — which under 164.306(d)(3) means implement if reasonable and appropriate or document why not and implement an equivalent; never optional)
- 164.308(a)(6) security incident procedures; (a)(7)(ii)(A)-(C) data backup, disaster recovery and emergency mode operation plans Required, (D) testing and revision procedures and (E) applications and data criticality analysis Addressable; (a)(8) periodic evaluation; (b) BA contracts
- 164.310(b)-(d) workstation use/security and device and media controls (disposal, re-use, accountability, backup)
- 164.312(a)(2)(i) unique user identification and (ii) emergency access procedure Required; (iii) automatic logoff and (iv) encryption/decryption Addressable; 164.312(b) audit controls and 164.312(d) person or entity authentication are STANDARDS with no implementation specifications — mandatory in full under 164.306(d)(1), not 'required specifications'; 164.312(c)(2) mechanism to authenticate ePHI and 164.312(e)(2)(i)-(ii) integrity controls and transmission encryption Addressable under mandatory standards
- 164.316(b)(1)-(2): written policies/procedures and required records retained 6 years from creation or last effective date, whichever later — this applies to Security Rule documentation only, NOT to patient records (no federal medical-record retention period exists; that is state law)
- **verification status**: Confirmed against eCFR text via search retrieval (direct fetch egress-blocked); terminology corrected per verifier

### Item 2
- **regime**: HIPAA Security Rule NPRM, 'HIPAA Security Rule To Strengthen the Cybersecurity of ePHI', RIN 0945-AA22 — PROPOSED, not law
**applies because**

Would rewrite Subpart C for every CE and BA including this vendor. Released by OCR Dec 27, 2024; published Jan 6, 2025 at 90 FR 898 (pin cite confirmed by one verifier, unconfirmed by another); comments closed Mar 7, 2025 (~4,745 comments). No final rule as of 2026-09-03; Unified Agenda (Long-Term Actions) lists July 2027; a 100+ organization coalition asked HHS to withdraw it in Dec 2025. Build to it where cheap; never market compliance with it; date-stamp every reference to current law.

- **citation**: 90 FR 898 (Jan. 6, 2025), FR Doc. 2024-30983; HHS OCR NPRM fact sheet; reginfo.gov RIN 0945-AA22

#### key obligations
- Would remove the required/addressable distinction (all specifications required with limited exceptions)
- Would require MFA for ePHI access and encryption at rest and in transit, each with limited exceptions
- Would require a technology asset inventory and network map of ePHI movement, reviewed at least every 12 months AND on material environmental change
- Would require written procedures to restore certain relevant systems and data within 72 hours plus a criticality analysis to set restoration order
- Would require automated vulnerability scanning at least every 6 months and penetration testing at least every 12 months (floors; more often if the risk analysis says so)
- Would require network segmentation, anti-malware, removal of extraneous software, and disabling network ports 'in accordance with the regulated entity's risk analysis' (not a flat 'all unused ports' mandate)
- Would require patching critical-risk items within 15 calendar days and high-risk within 30, with the clock running from patch availability/identification of need, and a 'reasonable and appropriate' third tier
- Would require BAs (and subcontractors upstream) to notify without unreasonable delay and no later than 24 hours after activating a contingency plan — outer bound, flowed down the chain, and a mandatory BAA term under proposed 164.314(a)
- Would require an every-12-months compliance audit of every standard by all regulated entities, and separately an annual BA→CE written verification consisting of BOTH a written analysis by a person with appropriate cybersecurity knowledge AND a written certification by a person with authority at the BA
- If finalized as proposed: 60 days to effective date + 180 days to comply (240 days), but existing BAAs get roughly one year after the effective date to conform
- Draft-asserted '48-hour RPO' and 'monthly backup testing' figures could NOT be verified against the proposed text — treated as unverified and not relied on
- **verification status**: Confirmed (existence, status, individual proposals) with precision corrections; 48h RPO / monthly test wording unverified

### Item 3
- **regime**: HIPAA Privacy Rule, 45 CFR Part 164 Subpart E, provisions with direct design consequences
- **applies because**: Tenants must discharge individual-rights and minimum-necessary duties through the product; the vendor is bound to BAA-permitted uses (164.502(e), 164.504(e)) and directly to minimum necessary and the enumerated BA provisions (HHS 2019 direct-liability guidance: BAs are NOT liable for the full Privacy Rule).
- **citation**: 45 CFR 164.502(b),(e),(f),(g); 164.504(e)(2),(e)(5); 164.506; 164.508; 164.514(a)-(e),(h); 164.520; 164.522; 164.524; 164.526; 164.528; 164.530(j)

#### key obligations
- Minimum necessary (164.502(b), 164.514(d)(2)): identify 'persons or classes of persons' who need access and the categories of PHI and conditions — the rule does not use 'role-based' and permits identification by named individual; exceptions in 164.502(b)(2) (treatment disclosures, to the individual, under authorization, to HHS)
- Right of access (164.524(b)(2)): act within 30 calendar days, one 30-day extension with written reasons — do NOT build to the never-finalized 15-day proposal (86 FR 6446); a separate NPRM on access timing is expected ~Nov 2026; Tennessee's 10 working days (63-2-101) is the binding shorter clock
- Right to amend (164.526): 60 days + one 30-day extension; (c)(1) identify affected records and append/link the amendment; (c)(2)-(3) inform the individual and notify persons who relied on the PHI — addendum-only, never overwrite
- Accounting of disclosures (164.528): six years back, 60 days + one 30-day extension; NINE exclusions in (a)(1)(i)-(ix) (TPO, to the individual, incidental, under authorization, facility directory/involved persons, national security, correctional/law enforcement custody, limited data set, pre-compliance-date) — the disclosures table logs everything and filters; the HITECH 13405(c) EHR-TPO accounting expansion was never finalized
- Mandatory restriction (164.522(a)(1)(vi)): must agree to restrict disclosure to a health plan ONLY where the disclosure is for payment/operations, not otherwise required by law, and the PHI pertains solely to an item/service paid in full out of pocket — other restriction requests are discretionary
- Confidential communications (164.522(b)); personal representatives and minors (164.502(g)); identity verification (164.514(h)); decedents protected 50 years (164.502(f)) — a protection period, not a retention mandate
- De-identification (164.514(b)): Safe Harbor = remove 18 identifiers AND no actual knowledge of re-identifiability ((b)(2)(ii)); (c) re-identification codes must not be derived from the data; maskPhi and the PHI rules are pseudonymization, never Safe Harbor
- Notice of Privacy Practices support (164.520) including Part 2 language (compliance date Feb 16, 2026 — confirm no extension); Privacy Rule documentation retained 6 years (164.530(j)(2))
- **verification status**: Confirmed against eCFR text via search retrieval; scope corrections applied

### Item 4
- **regime**: HIPAA Breach Notification Rule, 45 CFR Part 164 Subpart D; HITECH 13402
**applies because**

Any impermissible acquisition/access/use/disclosure of unsecured PHI is presumed a breach unless the entity demonstrates low probability of compromise via a documented assessment of at least the four factors (164.402) — a documented assessment concluding high probability is still a breach. Three express exclusions (unintentional good-faith workforce access; inadvertent disclosure between authorized persons; recipient could not reasonably retain). Encryption consistent with HHS guidance renders PHI 'secured' only if the key was not also compromised.

- **citation**: 45 CFR 164.400-164.414; HHS encryption/destruction guidance — operative version issued with the interim final rule at 74 FR 42740/42742 (Aug. 24, 2009), superseding the initial 74 FR 19006 (Apr. 27, 2009); NIST SP 800-111 (at rest), 800-52/800-77/800-113 (in transit), 800-88 (destruction)

#### key obligations
- Discovery imputed (164.404(a)(2), 164.410(a)(2)): first day known or by reasonable diligence would have been known to any workforce member or agent (agency per federal common law) — monitoring defines the clock; a BA that is an agent starts the CE's clock the same day, so the BA clock is not additive
- BA→CE (164.410): without unreasonable delay, ≤60 calendar days; BAA commits to 5 business days; MMG Fusion (dental patient-communication software BA, ~15M individuals, $10,000 + 3-year CAP, announced Mar 5, 2026) was sanctioned for never notifying at all
- CE→individuals (164.404(b)-(d)): without unreasonable delay, ≤60 days; content per (c); substitute notice per (d)(2) when contact info insufficient or out of date (fewer than 10: alternative written/phone; 10+: 90-day conspicuous home-page posting or major media in areas where affected individuals likely reside, toll-free number active ≥90 days) — exact text unverified in this environment
- Media (164.406): more than 500 residents of ONE state or jurisdiction (per-jurisdiction, not aggregate), same 60-day clock, 164.404(c) content
- HHS (164.408): 500+ individuals AGGREGATE — contemporaneous with individual notice via the HHS portal; fewer than 500 — log and submit within 60 days after calendar year end
- Law-enforcement delay (164.412): mandatory in form ('shall delay') when an official states notice would impede a criminal investigation OR damage national security; written statement → delay for the period specified; oral statement → document identity, delay ≤30 days unless a written statement arrives; applies to BAs and to all Subpart D notices
- Burden of proof on the CE/BA (164.414(b)); documentation retained 6 years
- **verification status**: Confirmed with corrections; 164.404(d)(2) mechanics unverified verbatim

### Item 5
- **regime**: HIPAA transactions and code sets, 45 CFR Part 162, via the clearinghouse
- **applies because**: Every 837D/835/270/271/276/277 the product assembles or ingests must be an ASC X12 005010 transaction using CDT. The clearinghouse is a covered entity (health care clearinghouse) and a BA of the practice. The vendor must not become a clearinghouse by contract/architecture (practice is submitter of record; clearinghouse performs translation) — counsel analysis required.
- **citation**: 45 CFR 162.100-162.1902; 162.1002 (versioned CDT adoption — identify the currently adopted version); 160.103

#### key obligations
- Compliant X12 5010 only; frozen 837 bytes retained
- BAA plus EDI/enrollment agreements; per-payer enrollment tracked
- Clearinghouse due diligence (SOC 2 Type II, HITRUST, breach history, notification terms) — Change Healthcare's ~192.7M-individual 2024 breach is the cautionary case (update-date detail unverified)
- CDT is ADA-copyrighted — license per tenant, never redistribute (license terms unverified in this environment)
- **verification status**: Regulatory structure known; 162.1002 version and ADA license terms unverified

### Item 6
- **regime**: FTC Act Section 5 and FTC Health Breach Notification Rule (16 CFR Part 318)
**applies because**

Section 5 reaches every public security claim. In re Henry Schein Practice Solutions (File No. 142 3161, Docket C-4575; announced Jan 5, 2016; final order May 23, 2016; 20-year order) imposed $250,000 monetary relief under a deception theory for representing that Dentrix G5 provided industry-standard encryption aiding HIPAA compliance when it used a less complex algorithm than NIST-recommended AES. HBNR (amended 89 FR 47028, May 30, 2024, effective July 29, 2024) excludes HIPAA CEs and entities 'to the extent' acting as BAs — an activity-specific carve-out: a direct-to-consumer app outside a BAA would be inside HBNR.

- **citation**: 15 U.S.C. 45(a); FTC File No. 142 3161; 16 CFR Part 318; 89 FR 47028

#### key obligations
- Every encryption claim names the standard (AES-256-GCM; TLS 1.2+/1.3; FIPS 140-validated KMS) and is evidenced
- Trust page and status page generated from system records, not hand-edited
- No 'HIPAA compliant/certified', 'lawsuit-proof', 'board-proof', 'AI-powered'
- ADR recording that the portal is offered only as a BA function of each practice; HBNR clocks implemented if a consumer product ever exists; HBNR 318.4/318.5 timing mechanics unverified verbatim
- **verification status**: Henry Schein confirmed by one verifier (unverifiable by another); HBNR scope confirmed, timing details unverified

### Item 7
- **regime**: Tennessee breach statute, Tenn. Code Ann. 47-18-2107
**applies because**

Tenants and vendor hold Tennessee residents' 'personal information' (first name/initial + last name combined with SSN, driver license, or financial account number with access code) — clinical data alone is outside the statute. Notice 'immediately, but no later than 45 days' from discovery (outer bound, not a safe harbor). Subsection (g): notify consumer reporting agencies 'without unreasonable delay' when more than 1,000 persons are notified at one time. The encryption carve-out sits in the 'breach of system security' definition at (a)(1) — unencrypted data, or encrypted data plus the key — where 'encrypted' means FIPS 140-2-conformant. Information holders subject to HIPAA/HITECH are exempt from the section outright (subsection lettering, likely (h), unconfirmed).

- **citation**: Tenn. Code Ann. 47-18-2107(a)(1), (b), (c), (g), and HIPAA/GLBA exemption subsection (as amended 2016, 2017)

#### key obligations
- Track the 45-day clock regardless: employee SSNs, card data and other non-PHI data fall outside HIPAA and inside the statute
- Field-level encryption under FIPS 140-validated modules so the state carve-out and the HIPAA 'secured' status are both available
- CRA notice trigger and vendor-as-maintainer duties under (c) modeled in the incident module
- **verification status**: Partially confirmed via secondary sources; verbatim text and subsection letters unverified (justia/tn.gov egress-blocked)

### Item 8
- **regime**: Tennessee dental records: Tenn. Comp. R. & Regs. 0460-02-.12 and Tenn. Code Ann. 63-2-101, 63-2-102
**applies because**

The product IS the dental record. Rule 0460-02-.12: retain not less than 7 years from the dentist's or supervisees' LAST PROFESSIONAL CONTACT; minors: the longer of 1 year after majority (18) or 7 years from last contact → max(last_contact+7y, dob+19y); incompetent patients INDEFINITELY; corrections by dated addendum; confidentiality-protecting destruction; on retirement, death, group departure or sale, notify patients seen in the preceding 36 months within 30 days and offer copies; records may not be withheld for non-payment. The 10-working-day copy deadline is statutory (63-2-101(a)(1), from a WRITTEN request), and fee caps are in 63-2-102 (figures unverified); HIPAA's cost-based fee limit (164.524(c)(4)) governs where lower.

- **citation**: Tenn. Comp. R. & Regs. 0460-02-.12; Tenn. Code Ann. 63-2-101(a)(1), 63-2-102; 0460-01-.11, -.12, -.16, 0460-02-.10 (mappings unverified)

#### key obligations
- retention_until recomputed on every contact; incompetency hold flag that no timer overrides; legal hold; destruction_log
- records_requests: due_at = receipt of writing + 10 working days; hipaa_due_at = +30 days; fee = min(63-2-102 cap, HIPAA cost-based); never gated on balance
- Practice-closure notification job (36-month lookback, 30-day deadline) separate from retention queries
- The draft's '10-year minor floor' from a Department of Health manual is unverified and is NOT implemented as a shorter alternative — the rule-based max() formula governs; counsel to confirm whether any manual imposes a longer floor
- **verification status**: Retention rule confirmed via LII/Justia text; copy deadline relocated to statute; fee figures and other rule mappings unverified

### Item 9
- **regime**: Other Tennessee law touching the product
**applies because**

Public Chapter 991 (2024), Tenn. Code Ann. 29-34-215 (class-action safe harbor absent willful/wanton misconduct or gross negligence — documented, tested controls are the defense); Tennessee Information Protection Act 47-18-3201 et seq. (eff. July 1, 2025; thresholds $25M revenue and 175,000 consumers; HIPAA CE/BA and PHI exempt); Public Chapter 1107 (2026) supervision rule encoded in dental src/lib/audit/rules/supervision.ts with EFFECTIVE_DATE 2027-01-01 and an S1 hard block; 63-5-108/-115 hygienist supervision; 53-10-310 CSMD checks; EPCS mandate (citation uncertain: 53-11-308 vs 63-1-160); Tenn. Sup. Ct. R. 8, RPC 5.7 (owner is a Tennessee attorney offering law-related services through an owned entity).

- **citation**: Tenn. Code Ann. 29-34-215; 47-18-3201 et seq.; 63-5-108, 63-5-115; 53-10-310; 2026 Tenn. Pub. Ch. 1107; Tenn. Sup. Ct. R. 8 RPC 5.7

#### key obligations
- Do not ship the PC 1107 scheduler/filing block on the current unpinned citation (tn-law.ts:139 links only to the capitol.tn.gov homepage); verify chapter, act list and date from a network with tn.gov egress
- Written RPC 5.7 opinion and disclaimers before the compliance module is sold
- CSMD/EPCS parameters verified before Phase 5 eRx
- **verification status**: All unverified in this environment (tn.gov, capitol.tn.gov, justia blocked)

### Item 10
- **regime**: 21st Century Cures Act information blocking (45 CFR Part 171) and ONC/ASTP certification (Part 170)
**applies because**

Each practice is an actor (health care provider). The vendor is an actor as a 'health IT developer of certified health IT' only if it offers a certified module — BUT an uncertified vendor can still be an actor under the functional HIN/HIE definition in 171.102 if it controls policies enabling EHI exchange among more than two unaffiliated entities for TPO. EHI = ePHI in the designated record set since Oct 6, 2022. Developer/HIN CMPs up to $1M per violation (possibly inflation-adjusted); provider disincentives run only through Medicare PI/MIPS/MSSP — dentists CAN be MIPS-eligible, the practical exclusion is the low-volume threshold.

- **citation**: 45 CFR 171.102, 171.103, 171.201-303; 45 CFR Part 170; 42 CFR Part 1003 Subpart N (88 FR 42820); 89 FR 54662

#### key obligations
- No-fee, prompt, self-service export (structured + documents + DICOM)
- Written HIN/HIE self-assessment and documented Part 171 exceptions relied on for API/export scoping
- Recorded ONC-certification ADR before API v1; if 'no', never use 'certified' or 'ONC'; note HTI-1 confirmed, 'HTI-5' existence unverified
- **verification status**: Actor-definition correction confirmed; disincentive/CMP details unverified

### Item 11
- **regime**: PCI DSS v4.0.1 (contractual via processor/acquirer)
**applies because**

Practices accept cards. With a processor-controlled iframe/hosted field collecting and transmitting account data directly to the processor, each practice can be SAQ A eligible — but SAQ A r1 (effective Mar 31, 2025) REMOVED 6.4.3 and 11.6.1 from SAQ A and ADDED an eligibility criterion that an embedding merchant confirm its site is not susceptible to script attacks (satisfiable by written processor confirmation). If merchant-controlled JavaScript touches or relays PAN/CVV, scope drops to SAQ A-EP where 6.4.3/11.6.1 apply in full. Whether full-redirect merchants are exempt from the criterion is unverified.

- **citation**: PCI DSS v4.0.1; SAQ A r1 eligibility criteria; PCI SSC FAQ 1588; Requirements 6.4.3, 11.6.1; SSA 1179 (42 U.S.C. 1320d-8)

#### key obligations
- Never store/process/transmit PAN or CVV; token, brand, last4 only
- Confirm the processor integration mode is true iframe/hosted-field; obtain and retain the processor's written script-attack confirmation; nonce CSP + SRI + script inventory anyway
- Processor payload PHI-free (no procedure descriptions) so SSA 1179 applies — note the statutory exemption runs to payment activities 'for a financial institution', so pin the analysis to the processor's actual status and to the HHS preamble cite (65 FR 82462 / 67 FR 53182) rather than an unnamed '2002 guidance'
- **verification status**: 6.4.3/11.6.1 and SAQ A r1 criterion confirmed; redirect carve-out and 'v4.0.1 only active version' unverified

### Item 12
- **regime**: 42 CFR Part 2, OSHA, TCPA, multi-state breach law — practice-facing and communications content
**applies because**

A general dental practice is not a Part 2 program, but NPPs must carry Part 2 statements (compliance date Feb 16, 2026 — confirm no extension) and received Part 2 records carry redisclosure limits. OSHA 29 CFR 1910.1030 (BBP training records 3 years; medical records via 1910.1020 cross-reference, employment + 30 years; sharps log; dentists' offices partially exempt under Appendix A to Subpart B of Part 1904). TCPA FCC 15-72 (2015) health-care message exemption — numeric conditions unverified and the ruling has been disturbed by later D.C. Circuit review and FCC orders; check current law. State breach statutes keyed to the individual's residence: several states at 30 days (Rhode Island likely 45, not 30); Texas HB 300 reaches possessors of PHI.

- **citation**: 42 CFR Part 2 (89 FR 12472); 45 CFR 164.520; 29 CFR 1910.1030, 1910.1020, 1904.2 + Appendix A to Subpart B; 47 U.S.C. 227, FCC 15-72; C.R.S. 6-1-716; Fla. Stat. 501.171; 10 M.R.S. 1348; R.I. Gen. Laws 11-49.3-4; RCW 19.255.010; Tex. Health & Safety Code ch. 181; Tex. Bus. & Com. Code 521.053

#### key obligations
- Part 2 language in NPP templates; 'received Part 2 record' document tag excluded from bulk export/AI/marketing
- Incident module computes per-state deadlines from patients.state from day one
- SMS consent records by scope (treatment vs marketing), STOP honored, no clinical detail in message bodies
- **verification status**: All unverified in this environment; listed for counsel

### Item 13
- **regime**: Enforcement posture and de facto contractual regimes
**applies because**

OCR: HIPAA audits resumed Dec 2024 (50 CEs/BAs, hacking/ransomware focus) after OIG A-18-21-08014 (Nov 21, 2024) found 2016-17 audits covered 8 of 180 protocol requirements; audit protocol scope confirmed, its '2018 revision' date unverified (likely April 2016). Pub. L. 116-321 (2021): 'recognized security practices' adequately demonstrated for the prior 12 months are a mitigating factor only (no safe harbor). HIPAA penalty tiers exist under 45 CFR 102.3 but the specific 2026 dollar figures are unverified. SOC 2 (TSP 100, 2017 w/ 2022 points of focus — observation window is convention, not rule); HITRUST e1/i1/r2 (counts version-dependent); cyber insurance conditions; ADA CDT license.

- **citation**: HHS-OIG A-18-21-08014; Pub. L. 116-321 (HITECH 13412); 45 CFR 102.3; AICPA TSP 100; HITRUST CSF v11.x

#### key obligations
- Audit-protocol-mapped evidence binder; OCR data-request runbook
- 12 months of continuous recognized-security-practices evidence (NIST CSF 2.0 + HHS 405(d) HICP)
- SOC 2 auditor engaged Phase 2; Type I at Phase 2 exit; Type II at Phase 4 GA; HITRUST only on buyer demand
- **verification status**: OIG report and audit resumption confirmed; penalty figures, protocol date, SOC 2/HITRUST specifics unverified

## Control mapping


### Item 1
- **requirement**: Risk analysis and risk management (Required)
- **citation**: 45 CFR 164.308(a)(1)(ii)(A)-(B); OCR Risk Analysis Initiative (Oct 2024–; extending to risk management)
- **control**: Vendor SRA of the product completed before the first Phase 1 import (the shadow ledger is PHI), refreshed annually, at each phase gate and on architectural change; risk register showing identification → treatment → implementation date → re-assessment; documents the cleartext name/DOB and shared-schema RLS decisions with compensating controls
- **implementation in product**: docs/security/sra/ versioned via PR; asset inventory and ePHI data-flow map generated from IaC, integration_registry and SBOM (satisfies the NPRM inventory/map if finalized); sra_questionnaires/responses schema reused by tenants in Phase 4
- **priority**: Phase 0 (must precede Phase 1 PHI)
- **reuse from**: /home/user/catcorner22/dental/knowledge/sources/adversarial-it-hipaa-security.md and adversarial-privacy-hipaa-attorney-hate.md as threat inputs; src/lib/risk/categories.ts folded into the findings register

### Item 2
- **requirement**: Information system activity review (Required); log-in monitoring
- **citation**: 45 CFR 164.308(a)(1)(ii)(D), 164.308(a)(5)(ii)(C)
- **control**: Monthly attested review of audit, PHI-access and security logs by tenant reviewer and vendor security officer; quarterly access recertification
- **implementation in product**: pg-boss creates compliance_task 'monthly log review' per tenant with pre-built views (failed logins, lockouts, after-hours reads, exports, break-glass, chain results); completion writes domain_event compliance.log_review with frozen reviewer; overdue on Compliance-lead home
- **priority**: Phase 0 vendor / Phase 1 tenant
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts security filter semantics; src/app/api/training/complete/route.ts server-verified attestation

### Item 3
- **requirement**: Sanction policy (Required); management-override transparency
- **citation**: 45 CFR 164.308(a)(1)(ii)(C); COSO ICIF Principle 10
- **control**: Written vendor sanction policy; tenant template (counsel-reviewed); overrides and waived dual controls logged and digested, never person-ranked
- **implementation in product**: control_findings practice-level framing; person-scoped detail owner + reviewer seat only; control_decisions kind=sanction with evidence refs; control_exceptions with residual_note and expiry
- **priority**: Phase 1 (controls) / Phase 4 (policy template)
- **reuse from**: /home/user/catcorner22/dental/src/lib/digest/digest.ts SYSTEMIC_SHARE; /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts

### Item 4
- **requirement**: Workforce security: authorization, clearance, termination (Addressable)
- **citation**: 45 CFR 164.308(a)(3)(ii)(A)-(C)
- **control**: Joiner-mover-leaver; role at provisioning under MANAGE_CEILING; deactivation kills the session on the next request; terminated user holding grants is a finding; SCIM ≤1 min at group tier
- **implementation in product**: users.active read from a fresh row in withGuard (never the token); user_entitlements append-only with effective_to; nightly detector; vendor offboarding revokes IdP/AWS/GitHub within 24h with audit row
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/guards.ts, freshUser.ts, roles.ts MANAGE_CEILING; src/lib/db/repo/users.ts mutateAdminGuarded last-admin guard

### Item 5
- **requirement**: Information access management / minimum necessary (Addressable; Privacy Rule)
- **citation**: 45 CFR 164.308(a)(4)(ii)(B)-(C); 164.502(b); 164.514(d)(2)(i)(A)-(B)
- **control**: Three orthogonal axes (admin rank, clinical licence, financial entitlement) + location scope + restricted-patient flag; default-deny wrapper; the written minimum-necessary policy names 'persons or classes of persons' and PHI categories and is GENERATED from role_templates so policy and code cannot drift
- **implementation in product**: requireAccess(req,{tenant,minRank,entitlements[],clinicalScope?,locationScope?,phiRead?}) → fresh-row SessionUser; withGuard opens a transaction, SET LOCAL app.tenant_id/app.user_id/app.session_id, typed 401/403; CI test globs apps/pms/src/app/api/**/route.ts and **/*.action.ts and fails on any unwrapped export (allowlist: nextauth, setup while zero users, reset token path, health, HMAC webhooks)
- **priority**: Phase 0
- **reuse from**: guards.ts GuardResult union, clinicalRoles.ts, approval.ts; /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts 14 entitlements; export predicate from src/app/api/export/[table]/route.ts

### Item 6
- **requirement**: Tenant isolation (risk-management control under 164.308(a)(1), 164.308(a)(4), 164.312(a)(1))
- **citation**: 45 CFR 164.308(a)(1)(ii)(B), 164.308(a)(4), 164.312(a)(1)
- **control**: tenant_id NOT NULL on every table, unique constraint and index; RLS ENABLED and FORCED; app connects as non-owner, non-superuser, non-BYPASSRLS roles; per-tenant DEKs as second wall; CI negative tests on real Postgres 16
**implementation in product**

Policy USING/WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid) — NULLIF is mandatory because a pooled connection leaves a previously-set GUC as '' (not undefined), which would otherwise raise 'invalid input syntax for type uuid'; NULL comparison yields unknown → no rows; SET LOCAL issued INSIDE an explicit BEGIN (bare SET LOCAL on autocommit is a no-op); roles app_rw / app_append / app_migrate (only app_migrate owns tables); tenant-salted advisory locks; CI: (1) two tenants, WHERE removed → zero foreign rows; (2) no SET LOCAL → zero rows on every table; (3) reused connection after RESET → still zero rows, no cast error; (4) app_append UPDATE → SQLSTATE 42501

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/gamify.ts userSpendLockKey FNV pattern; src/lib/db/repo/userBlocks.ts owner-scoping habit; pattern only from /home/user/catcorner22/precog/src/lib/auth/verify.server.ts

### Item 7
- **requirement**: Security awareness/training; password management (Addressable)
- **citation**: 45 CFR 164.308(a)(5)(ii)(A)-(D)
- **control**: Training at hire and annually with server-verified completion; throttle + spray detection; password policy with breach-corpus check and history; MFA everywhere
- **implementation in product**: training_assignments/completions (Phase 4); auth_throttle pair-key gate + IP detector lifted verbatim; HIBP k-anonymity check and last-5 history added; new device on a financial role pages the owner
- **priority**: Phase 0 / Phase 4
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts, hashGate.ts, clientIp.ts, password.ts, passwordPolicy.test.ts; e2e/lockout.mjs promoted to blocking CI

### Item 8
- **requirement**: Security incident procedures (Required) and breach clocks
- **citation**: 45 CFR 164.308(a)(6), 164.400-414; Tenn. Code Ann. 47-18-2107; other states
- **control**: Written IR plan; containment playbooks each producing an audit row; four-factor assessment template; dual/multi clocks computed per affected individual's state
**implementation in product**

incidents(discovered_at, four_factor jsonb, affected_by_state, ba_to_ce_due = +5 business days, hipaa_individual_due = +60d, tn_due = +45d with HIPAA-exemption counsel flag, other_state_due per pack, hhs_500_due contemporaneous, hhs_under_500_due = 60 days after year end, media_by_state (>500 per state), cra_notice (>1,000 TN, without unreasonable delay), law_enforcement_delay{written|oral, official, expires ≤30d if oral}, carrier_due per policy); one-click revoke-all-sessions (sessions.revoked_at + users.sessions_revoked_at); disable connector at registry; freeze exports; status-page entries from incidents rows

- **priority**: Phase 0 plan / Phase 1 intake / Phase 4 module
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts; src/lib/wishes/wishes.ts + src/lib/db/repo/wishes.ts intake; docs/GO-LIVE.md failure table shape

### Item 9
- **requirement**: Contingency plan: backup, DR, emergency mode (Required); testing/revision, criticality (Addressable)
- **citation**: 45 CFR 164.308(a)(7)(ii)(A)-(E)
- **control**: PITR + cross-region encrypted copies in a locked vault; monthly automated restore drill that writes its own audit row; criticality tiers documented; read-only degraded mode as emergency-mode plan; RPO ≤5 min (bounded by RDS 5-minute log shipping), RTO ≤4h → ≤1h at Phase 4
**implementation in product**

pg-boss backup.restore_drill restores latest snapshot into an isolated staging account, runs packages/verifier, tears down, writes domain_event; boot guard refuses if last successful drill >35 days; RDS automated retention 35 days max — longer retention via AWS Backup/manual snapshots; Backup Vault Lock compliance mode (grace period ≥3 days before immutability; prevents early deletion only); service-worker encrypted read cache disabled on operatory profile

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/backend.ts resolveDbBackend refuse-to-boot; scripts/postgres-durability.sh as drill ancestor

### Item 10
- **requirement**: Periodic evaluation (Required); vulnerability management
- **citation**: 45 CFR 164.308(a)(8); NPRM 6-month scan / 12-month pen test / 15-30 day patching (proposed)
- **control**: Annual technical evaluation; third-party pen test at Phase 4 GA and annually; dependency/image scanning every build; authenticated DAST semiannually; patch SLA tracked
- **implementation in product**: CI: pnpm audit (fail high/critical with expiring exceptions), Trivy, gitleaks, SBOM; Renovate security advisories immediately; risk register tracks 15/30-day clocks from patch availability
- **priority**: Phase 0 / Phase 4
- **reuse from**: /home/user/catcorner22/dental/.github/workflows/ci.yml

### Item 11
- **requirement**: Business associate contracts and subcontractor flow-down (Required)
- **citation**: 45 CFR 164.308(b), 164.314(a)(2)(i)-(iii), 164.502(e)(1)(ii), 164.502(e)(2), 164.504(e)(2), 164.504(e)(5)
- **control**: Two chains satisfied separately: privacy-side BAA contents (164.504(e)(2); (e)(5) applies them to BA-subcontractor contracts) and security-side ePHI terms (164.314(a)(2)(i)-(ii), flowed down by (a)(2)(iii)); a tenant cannot hold a patient row and a connector cannot be enabled without a countersigned BAA row
**implementation in product**

tenants.baa_signed_at NOT NULL before patients insert (setup wizard e-sign); business_associates → baas(kind baa|dpa|no_phi_determination, signed_at, expires_at, controls_named, document_id, active) → integration_registry(enabled) with trigger requiring active BAA or reviewed no-PHI determination; expiring BAAs raise compliance_tasks 60/30/7 days; egress allowlist generated from enabled rows; trust page renders the list

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/config.ts single-configured-egress principle; timingSafeEqualStr from src/app/api/law-watch/alert/route.ts

### Item 12
- **requirement**: Workstation use/security; device and media controls (Required)
- **citation**: 45 CFR 164.310(b)-(d)
- **control**: Shared-device profile with server-enforced idle lock and PIN author switch; encrypted-or-disabled local caches; short-TTL signed URLs; crypto-shredding at tenant termination
- **implementation in product**: sessions.device_profile operatory|desk; draftBackup rebuilt with AES-GCM under a server-issued per-session in-memory key, wiped on sign-out/switch/revoke, disabled on operatory; S3 presigned GET ≤5 min with attachment disposition; offboarding job exports then destroys wrapped DEK and writes destruction_log
- **priority**: Phase 0 sessions / Phase 3 caches
- **reuse from**: /home/user/catcorner22/dental/src/components/builder/SharedTabletIdleLock.tsx (UI only); src/lib/client/draftBackup.ts (rebuilt)

### Item 13
- **requirement**: Unique user identification (Required)
- **citation**: 45 CFR 164.312(a)(2)(i)
- **control**: One person, one account; shared logins refused at provisioning; PIN re-auth into the person's own session; frozen actor on every row
- **implementation in product**: users unique (tenant_id, username); per-user argon2id PIN ≥6 digits throttled on pwcheck namespace; created_by_id + created_by_name frozen everywhere; 'zero wrong-author events' Phase 3 exit
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/schema.ts frozen attribution; src/lib/auth/username.ts

### Item 14
- **requirement**: Emergency access procedure (Required)
- **citation**: 45 CFR 164.312(a)(2)(ii)
- **control**: Two-admin dual-control recovery ceremony; hardware-key vendor break-glass; clinical break-glass for restricted patients — all replacing ADMIN_PASSWORD_RESET
- **implementation in product**: recovery_ceremonies(target, initiated_by, approved_by CHECK distinct, both MFA-fresh ≤5 min, expires 15 min, consumed_at) mints a one-time reset link; vendor break-glass IAM role time-boxed 1h with session recording; phi_access_log.purpose=break_glass requires justification passing isValidPhiAttestation and emits a hard event
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts (refuses self-target); src/lib/audit/attestation.ts; src/lib/auth/resetToken.ts, issueResetLink.ts

### Item 15
- **requirement**: Automatic logoff (Addressable — implemented)
- **citation**: 45 CFR 164.312(a)(2)(iii)
- **control**: Server-enforced idle 10 min operatory / 30 min desk, 12h absolute, per-device revoke
- **implementation in product**: sessions table checked in withGuard each request; __Host- cookie, Secure, HttpOnly, SameSite=Lax carrying only an opaque session id inside the NextAuth JWE; watermark retained; GET/DELETE /api/me/sessions
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts, auth.config.ts; src/app/api/me/sessions/route.ts

### Item 16
- **requirement**: Encryption and decryption at rest (Addressable — implemented; breach and TN safe harbors)
- **citation**: 45 CFR 164.312(a)(2)(iv); 164.402 'unsecured PHI'; 74 FR 42740/42742 (Aug 24, 2009); Tenn. Code Ann. 47-18-2107(a)(1) FIPS 140-2
- **control**: Volume encryption with customer-managed KMS keys plus per-tenant envelope encryption for high-sensitivity fields; FIPS 140-validated cryptographic modules so both safe harbors are available; names/DOB cleartext documented in the SRA
**implementation in product**

packages/db crypto: KMS GenerateDataKey per tenant → tenant_keys(wrapped_dek, version); AES-256-GCM, 96-bit nonce, AAD = tenant_id||table||column||row_id; columns: users.mfa_secret_enc, patients.ssn_enc (+HMAC blind index of last4), patient_coverage.member_id_enc, bank identifiers, portal tokens, processor tokens; recovery codes/PINs/api_keys hashed; DEK version rotation with lazy re-encrypt; keys never in DB or env

- **priority**: Phase 0 framework / Phase 1 fields
- **reuse from**: none — new; decision documented in the SRA

### Item 17
- **requirement**: Audit controls (Standard, no implementation specifications)
- **citation**: 45 CFR 164.312(b); 164.308(a)(1)(ii)(D)
- **control**: Every state change emits a domain_event in the same transaction; every PHI read writes phi_access_log; both INSERT-only, hash-chained per tenant, partitioned monthly, retained ≥6 years, verified nightly, head anchored to WORM
**implementation in product**

domain_event(actor frozen, ip, ua, session_id, aggregate, event_type, payload codes/ids only, prev_hash, hash); phi_access_log(purpose enum, justification); per-tenant advisory lock serializes inserts; hash = HMAC-SHA256(HKDF(KMS chain root, tenant), prev_hash||canonical row) held only in memory; app_append role + BEFORE UPDATE/DELETE RAISE triggers; packages/verifier nightly → audit_chain_checks + head signed with KMS ECDSA P-256 to S3 Object Lock compliance mode (enable at bucket creation; validate retention in governance mode first); CI plants a tamper as app_migrate and asserts detection

- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts single write point; src/lib/db/repo/gamify.ts lock pattern; src/app/api/assist/route.ts one-row-per-call

### Item 18
- **requirement**: Integrity — mechanism to authenticate ePHI (Addressable under mandatory standard 164.312(c)(1))
- **citation**: 45 CFR 164.312(c)(1)-(2); Tenn. Comp. R. & Regs. 0460-02-.12 addendum rule; 164.526
- **control**: Immutability as a DB property for ledger, allocations, approvals, decisions, claim/chart events, filed notes, events, logs; corrections are reversal/amendment rows; sealed independent verifier; sha256 on documents
- **implementation in product**: app_append grants + triggers; day_closes and clinical_notes_filed carry content hashes; note_amendments(amends_note_id, reason_code incl. patient_request); packages/verifier restates promises with zero app imports, sealed by manifest hash, fails closed; documents.sha256 checked on signed-URL issue
- **priority**: Phase 0 / Phase 1 ledger / Phase 3 notes
- **reuse from**: /home/user/catcorner22/dental/src/lib/byteaudit/{contract.ts,verify.ts,seal.ts,manifest.ts}; src/lib/db/repo/submissions.ts fileSubmissionAtomic; e2e/submission.immutability.mjs

### Item 19
- **requirement**: Person or entity authentication (Standard)
- **citation**: 45 CFR 164.312(d)
- **control**: Mandatory TOTP with hashed recovery codes; passkeys Phase 4; SSO with IdP-asserted MFA Phase 5; hashed scoped API keys; HMAC webhooks; step-up on high-value approvals, grants, registry/policy changes, large exports, break-glass
- **implementation in product**: retire mfaFeature.ts; enrollment forced at first login; 10 argon2id-hashed single-use codes; @simplewebauthn behind guards.ts; api_keys(hash, scopes) compared with timingSafeEqualStr; step-up = fresh TOTP within 2 minutes
- **priority**: Phase 0 / 4 / 5
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/totp.ts; src/app/api/me/mfa/route.ts lifecycle; e2e/mfa.totp.mjs no-oracle assertions

### Item 20
- **requirement**: Transmission security (Addressable under mandatory standard 164.312(e)(1))
- **citation**: 45 CFR 164.312(e)(1)-(2)
- **control**: TLS 1.2+/1.3 at the edge with HSTS; verify-full to Postgres as a boot guard; TLS/SFTP with pinned host keys to connectors; HMAC-signed webhooks; no PHI in URLs, query strings, Referer or email subjects
- **implementation in product**: pinPostgresSslMode lifted verbatim and promoted to refuse-to-boot unless effective sslmode = verify-full with the RDS CA bundle; ALB TLS13-1-2 policy; HSTS preload only after apex is final; shared outbound HTTP client with host allowlist from integration_registry; UUIDv7 in paths; Referrer-Policy same-origin
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts; next.config.mjs header block; e2e/headers.mjs

### Item 21
- **requirement**: PHI read purpose capture and treatment-relationship heuristic (minimum necessary + audit)
- **citation**: 45 CFR 164.502(b), 164.514(d)(2), 164.312(b)
- **control**: Role-scoped views; location scope; restricted-patient break-glass; out-of-relationship chart opens prompt a purpose and are logged and detected
- **implementation in product**: requireAccess opts.phiRead={patientIds, resourceKind, purpose} writes phi_access_log in-transaction; list views one row with patient_ids[] and count (counsel to confirm granularity); exports mirror the screen predicate and record rendered row count; Patient Rail privacy mode
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts; src/lib/auth/roles.ts seesAllNotes allowlist pattern

### Item 22
- **requirement**: Accounting of disclosures
- **citation**: 45 CFR 164.528(a)(1)(i)-(ix), (c)
- **control**: Every print, export, fax, SMS, email, portal send, records-request fulfilment, clipboard copy of PHI and AI call is a disclosures row; accounting report filters the nine exclusions and tracks the 60-day + one 30-day clock
- **implementation in product**: disclosures(patient_id, at, channel, recipient, records jsonb ids, purpose, tpo_excluded bool, actor frozen, document_id) written in the send transaction; accounting_requests task with due dates
- **priority**: Phase 1 schema / Phase 2 egress paths
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/threading.ts opaque tokens; knowledge/sources/adversarial-privacy-hipaa-attorney-hate.md

### Item 23
- **requirement**: Right of access and Tennessee copy deadline; right to amend; mandatory self-pay restriction; confidential communications
- **citation**: 45 CFR 164.524(b)(2), (c)(4); Tenn. Code Ann. 63-2-101(a)(1), 63-2-102; 164.526; 164.522(a)(1)(vi), (b); 0460-02-.12 no-withholding
- **control**: records_requests with dual clocks and fee floor; amendment workflow with 60-day clock; self_pay_restricted flag blocks claim assembly where conditions are met; per-patient channel preferences enforced at every send
- **implementation in product**: records_requests(received_written_at, tn_due = +10 working days, hipaa_due = +30 days, fee = min(state cap, HIPAA cost-based), never gated on balance, export_bundle_id incl. images/DICOM); amendment_requests(+60d, one 30d extension, denial template); procedures.self_pay_restricted → scrubber hard-block, statements silent on insurance; patients.contact_preferences honored with refusal reason
- **priority**: Phase 2-3
- **reuse from**: /home/user/catcorner22/dental/src/lib/export/csv.ts; readbackClass.ts confirm-before-send; scrubber_rules/preflight_findings

### Item 24
- **requirement**: Retention and destruction — HIPAA documentation vs Tennessee clinical clocks
- **citation**: 45 CFR 164.316(b)(2), 164.530(j)(2), 164.414(b); Tenn. Comp. R. & Regs. 0460-02-.12
- **control**: retention_policy distinguishes 6-year Security/Privacy Rule documentation from clinical clocks; clinical retention_until = adult last_contact+7y; minor max(last_contact+7y, dob+19y); incompetent = indefinite hold; legal holds; logged destruction; closure-notification job (36 months, 30 days)
- **implementation in product**: retention_policy(kind, rule); patients.retention_until recomputed on every contact; incompetency_hold flag no timer overrides; retention_holds; destruction_log; partitions past retention detached to Glacier with Object Lock rather than dropped
- **priority**: Phase 0 schema / Phase 3 clinical
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/practicePacks.ts maker-checker + event log for policy approval

### Item 25
- **requirement**: CSRF/XSS defence and web tracking restrictions
- **citation**: 45 CFR 164.312(a)(1), 164.308(a)(1)(ii)(B); OCR tracking-technologies bulletin (authenticated pages — current status unverified)
- **control**: Origin/Sec-Fetch-Site on every mutation; Content-Type and 1 MB body caps; nonce CSP + SRI when portal ships; zero third-party scripts on authenticated surfaces; connect-src 'self'
- **implementation in product**: withGuard rejects cross-site/same-site Sec-Fetch-Site or Origin ≠ APP_URL; readJsonRecord requires application/json; middleware nonce and 'strict-dynamic' in Phase 4; e2e/headers.mjs asserts no 'unsafe-inline' in production
- **priority**: Phase 0 / Phase 4
- **reuse from**: pattern from /home/user/catcorner22/precog/src/lib/auth/isolation.server.ts; /home/user/catcorner22/dental/src/lib/http/readJson.ts; next.config.mjs

### Item 26
- **requirement**: Malicious software protection
- **citation**: 45 CFR 164.308(a)(5)(ii)(B)
- **control**: Scan every upload on ingest; nosniff + attachment disposition; distroless non-root read-only containers
- **implementation in product**: S3 upload → pg-boss ClamAV job → documents.scanned_at/scan_result; no signed URL until clean; server-side MIME sniff vs declared
- **priority**: Phase 3
- **reuse from**: none — new

### Item 27
- **requirement**: Secrets management and key rotation
- **citation**: 45 CFR 164.308(a)(1)(ii)(B), 164.312(a)(2)(iv)
- **control**: Secrets Manager injection; no .env in production; dual-key AUTH_SECRET rollover; 90-day third-party key rotation; gitleaks; precog history and PREVIEW_CLIENT_SECRET not carried
- **implementation in product**: Boot guard refuses on missing secrets or AUTH_SECRET <32 bytes; Auth.js secret array (first ENCRYPTS the JWE, all DECRYPT — newest first; verify against the eventually pinned 5.0.0-beta.x); rotation runbooks each naming the audit row produced
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/backend.ts; .env.example annotations

### Item 28
- **requirement**: AI/LLM boundary as a disclosure to a subcontractor BA
- **citation**: 45 CFR 164.502(e), 164.504(e), 164.514(b),(d), 164.528
- **control**: No model call without an active BAA row and tenant opt-in; per-capability field allowlist; egress classifier; per-call disclosure + codes-only drift row; outputs untrusted; deterministic twin
**implementation in product**

integration_registry kind=llm gated by baas; assist service builds payload from allowlisted fields, pseudonymizes via maskPhi (random, never derived), refuses on S0 identifiers outside the allowlist; provider adapter with one implementation chosen at Phase 4 (see vendors); verifyMeaning + evidence pinning; browser SpeechRecognition disabled on PHI fields; egress SG permits only the registered host

- **priority**: Phase 5 (registry gate Phase 0)
- **reuse from**: /home/user/catcorner22/dental/src/app/api/assist/route.ts, src/lib/assist/**, src/lib/verify/**, src/lib/audit/rules/{phi.ts,phi-secondary.ts}, src/lib/audit/maskPhi.ts, src/lib/learning/redact.ts, docs/model-charter.md; /home/user/catcorner22/precog/src/lib/precog/coach/context-pack.ts

### Item 29
- **requirement**: Vendor support access to tenant PHI
- **citation**: 45 CFR 164.502(b), 164.504(e)(2)(ii)(A), 164.312(b)
- **control**: Owner-granted, time-boxed, purpose-stated support access through the same guard; owner digest lists every session
- **implementation in product**: support_grants(tenant, granted_by owner, scope, expires_at ≤24h, reason); actor tagged vendor_support; phi_access_log purpose=operations; production DB console access logged and reviewed monthly
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/users.ts isCreatureOf / mutateAdminGuarded

### Item 30
- **requirement**: PCI DSS SAQ A scope
- **citation**: PCI DSS v4.0.1; SAQ A r1 eligibility criteria; FAQ 1588; SSA 1179
- **control**: Processor-controlled iframe/hosted field only; written processor script-attack confirmation retained; nonce CSP + SRI + script inventory; PHI-free processor payload; annual processor AOC
- **implementation in product**: Processor adapter returns token only; ledger tender stores brand/last4/processor_ref; integration review confirms no merchant JS touches PAN (else SAQ A-EP); baas row for processor kind=no_phi_determination with the SSA 1179 analysis attached
- **priority**: Phase 1
- **reuse from**: CSP block in /home/user/catcorner22/dental/next.config.mjs (nonce upgrade)

### Item 31
- **requirement**: Information blocking posture
- **citation**: 45 CFR 171.102-171.303
- **control**: No-fee self-service export incl. DICOM; documented Part 171 exceptions; written HIN/HIE self-assessment; ONC-certification ADR before API v1
- **implementation in product**: Export bundle job for owner role at any time; API/export policy cites privacy/security/infeasibility/content-and-manner exceptions relied on; trust page never says 'certified'
- **priority**: Phase 2
- **reuse from**: Trust Page and Data Migration/Exit modules

### Item 32
- **requirement**: Change control, secure development and supply chain
- **citation**: 45 CFR 164.308(a)(8), 164.312(c)(1); SOC 2 CC7/CC8
- **control**: Branch protection, CODEOWNERS on security-critical paths, blocking CI with RLS/role/chain/guard/migration/version/secret/dependency/image checks, exact pins, SBOM, sealed verifier, import-purity tests
- **implementation in product**: See secure_sdlc; drizzle-kit migrations with chained history table; e2e security probes in the blocking job
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/.github/workflows/ci.yml version guards; src/lib/byteaudit/seal.ts; e2e/*.mjs

### Item 33
- **requirement**: Honest public claims and status transparency
- **citation**: 15 U.S.C. 45(a); In re Henry Schein Practice Solutions (2016); Tenn. Comp. R. & Regs. 0460-02-.10 (unverified)
- **control**: Status/uptime from health checks; post-mortems from incidents rows; subprocessor list from the registry; dated attestation facts instead of adjectives; marketing checklist
- **implementation in product**: /healthz (DB, KMS, S3, worker heartbeat, replication lag) + synthetic monitor → hosted status page; trust page renders baas rows and SOC 2 / pen-test dates
- **priority**: Phase 0 status / Phase 1 trust
- **reuse from**: /home/user/catcorner22/dental/docs/brand.md voice rules; docs/GO-LIVE.md

### Item 34
- **requirement**: Notice of Privacy Practices and consent capture; personal representatives
- **citation**: 45 CFR 164.520 (incl. Part 2 statements); 164.502(g); 164.514(h)
- **control**: Versioned NPP template per tenant with acknowledgement; guardian/responsible-party model driving portal scope and release eligibility; two-identifier verification recorded
- **implementation in product**: policies table holds NPP versions; consents kind=npp_ack; patient_relationships with consent_scope; 'provisional pending counsel review' label
- **priority**: Phase 1 headers / Phase 3 consents / Phase 4 NPP
- **reuse from**: /home/user/catcorner22/dental/src/lib/law/tn-law.ts content (jurisdiction-keyed); skill/references/tennessee-dental-law-summary.md

### Item 35
- **requirement**: Practice-facing OSHA/communications content
- **citation**: 29 CFR 1910.1030(c),(g),(h), 1910.1020; Appendix A to Subpart B of Part 1904; 47 CFR 64.1200; FCC 15-72 (current status unverified)
- **control**: BBP training records 3 years; exposure/medical records employment+30 years; sterilizer monitoring 2 years (TN, unverified mapping); SMS consent by scope; STOP honored; no clinical detail in messages
- **implementation in product**: compliance_logs with retention classes; messages append-only with template_version and consent_id; every send a disclosures row
- **priority**: Phase 4
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/threading.ts; src/lib/vocab/plain-language.ts

## Architecture

TRUST BOUNDARIES, each with its legal instrument. (1) Practice ↔ vendor: BA relationship; vendor-form BAA countersigned in the setup wizard (baas row with signed_at, document_id) before any patient row may exist. Group locations must be classified as one CE or affiliated CEs (164.105(b)) because that decides whether cross-location clinical grants are a use or a disclosure. (2) Vendor ↔ subprocessors: privacy chain (164.502(e)(1)(ii) assurances, papered under 164.502(e)(2), contents per 164.504(e)(2) applied to subcontractors by (e)(5)) and security chain (164.314(a)(2)(i)-(ii), flowed down by (a)(2)(iii)) satisfied separately; the registry gates enablement in the DB and the egress allowlist enforces it in the network. (3) Vendor ↔ patient: portal offered only as a BA function of each practice (ADR) so the FTC HBNR stays out of scope; separate identity realm. (4) Vendor ↔ regulators/auditors: OCR audits BAs directly; evidence binder in a compliance repo; SOC 2 and pen-test reports under NDA.

TIERS. Browser (untrusted; opaque session cookie; per-session in-memory key; encrypted read cache on desk profile only) → WAF + ALB (TLS 1.2+/1.3, rate limits, fixed X-Forwarded-For hop count read by clientIp.ts) → long-lived Node containers on ECS Fargate (distroless, non-root, read-only FS, private subnets; every handler through withGuard; egress restricted to Postgres, VPC endpoints for S3/KMS/Secrets Manager/CloudWatch, and hosts in integration_registry) → pg-boss worker service (same roles, no inbound) → RDS PostgreSQL 16 Multi-AZ (no public endpoint, IAM or rotated credentials, CMK-encrypted storage, PITR, verify-full enforced by pinPostgresSslMode as a boot guard) and S3 (SSE-KMS, Block Public Access, versioning, Object Lock on audit-heads and WORM exports) → KMS (one CMK per environment for volume encryption, one for DEK wrapping, one HMAC/HKDF root for chains, one asymmetric signing key for chain heads; CloudTrail on every call) → external connectors behind integration_registry.enabled → operator access via SSM with hardware MFA and session logging, never psql against production with PHI.

TENANCY. Shared database, shared schema; tenant_id uuid NOT NULL in every table, unique constraint and index; RLS ENABLED and FORCED; policy USING/WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid). The NULLIF is not optional: on a pooled connection a GUC set once earlier persists as the empty string after transaction end, so the bare ::uuid cast would raise rather than fail closed. A NULL comparison evaluates to unknown, so the row is not returned — fail closed — and no policy branch may coalesce NULL into a permissive result. withGuard runs SET LOCAL inside an explicit BEGIN (bare SET LOCAL on autocommit warns and does nothing), which is also what makes PgBouncer transaction pooling safe later. The app never connects as the table owner: app_migrate owns tables (runs only from CI); app_rw serves requests; app_append has INSERT-only on ledger_entries, payment_allocations, approval_requests, approvals_log, control_decisions, control_exceptions, claim_events, chart_events, clinical_notes_filed, note_amendments, appointment_events, domain_event, phi_access_log, disclosures, audit_chain_checks, bank_transactions — with BEFORE UPDATE/DELETE RAISE triggers as the second lock. None of the runtime roles is superuser or BYPASSRLS (FORCE RLS binds owners but not those). Advisory locks are FNV-salted with tenant_id. UUIDv7 everywhere; per-tenant sequences for visible numbers so no identifier leaks cross-tenant volume. Schema-per-tenant is the documented escalation for a group that contracts for it.

NETWORK. Separate AWS accounts for prod/staging/logging under an organization with SCPs (deny disabling CloudTrail/GuardDuty/Block Public Access; deny KMS key deletion without the 30-day window); private subnets per tier; VPC endpoints; NAT egress allowlist generated from the registry; GuardDuty, CloudTrail (all regions, Object Lock), VPC flow logs, WAF managed rules plus rate rule; Route 53 health checks feed the status page. This satisfies the NPRM's proposed segmentation if it is finalized.

HOSTING CHOICE. AWS over Fly Machines + Neon because one AWS BAA (via Artifact) covers compute, RDS PostgreSQL, S3, KMS, Secrets Manager, CloudWatch, SES and later Bedrock and End User Messaging — subject to verified sub-service exclusions: Fargate eligible for ECS/EKS only; End User Messaging excludes Voice and WhatsApp; Bedrock eligibility is per model (verifier reports Fable and Mythos excluded) so model selection is a compliance decision; the eligible-services page changes roughly monthly and is re-verified at design freeze. Alternatives recorded: Neon HIPAA is self-serve on the Scale plan only (not Business), free today with a disclosed future 15% surcharge, cannot be disabled once enabled, and its Managed Better Auth and Data API sit outside the HIPAA boundary; Fly.io signs a pre-signed BAA on a ~$99/month compliance add-on. Single region in Phases 0-3 with cross-region encrypted backups and a rehearsed failover runbook; two-region active/passive at Phase 4.

ENVIRONMENTS. dev (Docker Postgres 16, synthetic tenants; PGlite only for pure unit tests), CI (ephemeral Postgres 16 for RLS/role/migration/chain tests), staging (separate account, synthetic data from the training generator — never a production snapshot, because maskPhi is not Safe Harbor and 164.514(b)(2)(ii) also requires no actual knowledge of re-identifiability), production. Migrations only from CI as app_migrate with shadow-DB dry run and fresh-vs-migrated diff; migration history table append-only and chained. Boot guard (extending resolveDbBackend): refuse without verify-full POSTGRES_URL, resolvable KMS_DEK/CHAIN/SIGN key ids, reachable OBJECT_STORAGE_BUCKET, APPEND_ROLE_URL whose role fails an UPDATE probe with 42501, a restore-drill row younger than 35 days, AUTH_SECRET ≥32 bytes, explicit TRUSTED_PROXY_HOPS; PGlite only when NODE_ENV=test.

DESIGNATED RECORD SET AND CLASSIFICATION. DRS defined in writing (patients, encounters, notes, chart, perio, imaging, plans, ledger, claims, consents, documents, prescriptions); tables classified PHI / PHI-adjacent (audit, access, disclosures) / practice-financial (bank, controls, scoring — treated PHI-adjacent because ledger rows carry patient ids) / vendor-operational. Classification drives export bundles, accounting scope, analytics eligibility and the incident four-factor pre-population.

## Identity and access

IDENTITY. One human, one account, per tenant (unique on tenant_id+username); shared logins refused at provisioning — a 'hygiene room' account would be a per-se 164.312(a)(2)(i) violation. Passwords: bcrypt cost 12 behind hashGate (verbatim), 10-72 byte policy, blocklist, HIBP k-anonymity check at set/change, 5-entry history. Throttle lifted verbatim (pair-key gates, IP-key detects; DB-backed) with e2e/lockout.mjs blocking in CI. Login failure copy byte-identical across causes (e2e/mfa.totp.mjs). Unknown usernames never logged.

MFA. Mandatory for every account; enrollment forced at first sign-in with no skip; otpauth TOTP wrapper lifted with the secret envelope-encrypted; ten single-use argon2id-hashed recovery codes; existing lifecycle rules kept ('start' refuses while enabled; 'disable' requires a current code); mfaFeature.ts deleted. Passkeys/WebAuthn at Phase 4 as the preferred desk factor; SAML/OIDC with IdP-asserted MFA and SCIM at Phase 5. Step-up (fresh factor within 2 minutes) on approvals above the tenant's high-value band, role/entitlement grants, BAA registry and control-policy changes, exports above a row threshold, break-glass. MFA reset is two-person (route refuses self-target) and audited.

SESSIONS. Server-side sessions table is the authority: sessions(id, tenant_id, user_id, device_profile operatory|desk, created_at, last_seen_at, idle_deadline, absolute_expires, revoked_at, revoked_reason, ip, ua, mfa_verified_at). Idle 10 min operatory / 30 min desk, 12h absolute; withGuard rejects expired or revoked sessions and slides idle_deadline. Cookie __Host-pms_session, Secure, HttpOnly, SameSite=Lax; the NextAuth JWE carries only the opaque session id and the pwAt watermark (sessionWatermark.ts retained as belt-and-braces). Auth.js secret array for rollover (first entry encrypts, all decrypt; newest first) — re-verify against the pinned beta since no package.json exists yet in the target repo. Active-session list and per-device revoke at /api/me/sessions; admin revoke-all per user; IR revoke-all per tenant. Operatory tablets: PIN unlock (argon2id, ≥6 digits, throttled) resumes only that user's session with caret restored; author switch revokes the session, discards the client key, wipes caches. Zero wrong-author events is a Phase 3 exit criterion.

AUTHORIZATION. Derived per request from a fresh user row inside one default-deny wrapper. requireAccess(req, {tenant, minRank, entitlements[], clinicalScope?, locationScope?, phiRead?}) → SessionUser | typed 401/403. Three orthogonal axes: administrative rank (roles.ts ladder + MANAGE_CEILING actor×target predicates — an office manager may issue a reset link but never read or set a password, never act on the owner), clinical licence (clinicalRoles.ts derived not stored; filing authority via approval.ts; Tennessee scope rules parameterized by jurisdiction), financial entitlement (Precog's 14 + PMS additions as a current view over the append-only user_entitlements grant log, location-scoped). Location is a real boundary for financial and roster data; cross-location clinical cover is a deliberate grant. Minimum necessary is expressed as role-scoped views and endpoints (front desk: schedule, demographics, coverage, balance summary — never note bodies or perio; biller: ledger, claims, procedures, chart summary; hygienist: clinical record + read-only balance; owner and designated reviewer seat alone see person-scoped control signals) and the written minimum-necessary policy the Privacy Rule requires — naming 'persons or classes of persons' and PHI categories per 164.514(d)(2)(i)(A)-(B) — is generated from role_templates. Restricted patients (employees, family, VIP) require a break_glass entitlement and an isValidPhiAttestation-validated reason; the read pages the owner. Treatment-relationship heuristic (on the user's schedule ±30 days or assigned provider) is advisory: outside it the chart opens for clinical roles but prompts a purpose and logs it, feeding the no-relationship/after-hours read detector. Hard SoD blocks at action time are the small named set (requester ≠ approver by CHECK and re-check; poster/deposit-preparer cannot clear that day's variance; no self-approval of vendor master or payroll); everything else is detected and requires a dated control_decision; critical-conflict grants are refused without one (tenant switch for 'pending until a distinct second admin decides').

CI GUARANTEE. A vitest test globs apps/pms/src/app/api/**/route.ts and **/*.action.ts, parses exports, and fails on any handler not wrapped in withGuard(...) (allowlist: /api/auth/[...nextauth], /api/setup while user count is zero, /api/reset token path, /api/health, HMAC webhook receivers using timingSafeEqualStr). requireRole's behaviours (active, revoked, rank, ack) plus tenant/location/entitlement checks get direct tests against a real Postgres container — the current 18-line guards.test.ts is the named gap.

BREAK-GLASS. (a) Account recovery: recovery_ceremonies — admin A initiates; distinct admin B with MFA verified ≤5 minutes ago approves within 15 minutes; one-time reset link via issueResetLink; both frozen on the row; hard event to owner. For 1-owner/1-OM tenants the vendor's support identity may be the second approver (logged, owner-visible) — owner decision pending. (b) Vendor emergency access: hardware-key IAM role, 1-hour time box, session recording, phi_access_log purpose=break_glass with justification, affected tenants' owners notified. (c) Clinical break-glass on restricted patients, reviewed in the monthly log review. (d) Vendor support: owner-granted support_grants ≤24h through the same guard. ADMIN_PASSWORD_RESET is deleted.

PORTAL. Separate identity realm, identity verification per 164.514(h) at enrollment (two identifiers plus out-of-band code), guardian/personal-representative scoping per 164.502(g), no shared cookies with the staff realm. ACCESS REVIEWS. Quarterly recertification of owner-level and financial grants per tenant and of all vendor staff access (AWS, GitHub, Secrets Manager, DB permission sets), produced as an attested compliance_task.

## Encryption and keys

Encryption is simultaneously the 164.312(a)(2)(iv)/(e)(2)(ii) safeguard, the HIPAA breach safe harbor (PHI encrypted consistent with the HHS guidance issued with the Aug 24, 2009 interim final rule — 74 FR 42740/42742, superseding the Apr 27, 2009 RFI at 74 FR 19006 — is not 'unsecured' provided the key was not also compromised; destruction per NIST SP 800-88 is the second qualifying method), and the Tennessee carve-out in the 'breach of system security' definition at 47-18-2107(a)(1), which requires FIPS 140-2-conformant encryption. Consequence: every safe-harbor argument must rest on FIPS 140-validated modules (AWS KMS HSMs; application-layer AES-GCM via a FIPS-validated OpenSSL build — validation certificates to be confirmed and cited in the SRA), never on obfuscation or unvalidated ciphers — the exact failure the FTC charged in Henry Schein.

IN TRANSIT. TLS 1.2 minimum, 1.3 preferred at the ALB (ELBSecurityPolicy-TLS13-1-2-2021-06); HSTS max-age 2 years includeSubDomains, preload only after the apex is final. Postgres: pinPostgresSslMode lifted verbatim (converts require/prefer/verify-ca to verify-full, appends verify-full to any non-loopback URL) and promoted to refuse-to-boot with the RDS CA bundle present. S3/KMS/Secrets Manager over VPC endpoints. Connectors: one shared outbound HTTP client with host allowlist from integration_registry, mandatory TLS verification, no off-allowlist redirects, timeouts; clearinghouse SFTP with pinned host keys; inbound webhooks HMAC-SHA256 over raw body + timestamp, 5-minute window, timingSafeEqualStr. No PHI in URLs, query strings, Referer (same-origin) or email subjects. SMS and SES email are not end-to-end encrypted beyond the provider, so message bodies carry no clinical detail.

AT REST — PLATFORM. RDS storage, automated backups, snapshots and cross-region copies under customer-managed KMS keys (multi-region key for the replica region); S3 SSE-KMS with bucket keys; ECS ephemeral storage and CloudWatch log groups encrypted; Object Lock compliance mode (7 years) on audit-heads and WORM exports — enabled at bucket creation, protects object versions (delete markers still accrue cost), unrecoverable by anyone including AWS, so retention values are validated in governance mode first; AWS Backup Vault Lock compliance mode with its ≥3-day grace period before immutability (prevents early deletion only). Stated on the trust page as mechanisms, never adjectives.

AT REST — APPLICATION (envelope, per tenant). KMS GenerateDataKey per tenant → plaintext DEK in memory only (cached ≤5 min), wrapped DEK in tenant_keys(tenant_id, version, wrapped_dek, algorithm, created_at, retired_at). AES-256-GCM, random 96-bit nonce, AAD = tenant_id||table||column||row_id so ciphertext cannot be transplanted across rows or tenants. Encrypted columns: users.mfa_secret_enc; patients.ssn_enc with an HMAC-SHA256 blind index of the last four (key derived from the tenant DEK); patient_coverage.member_id_enc; bank_accounts account/routing; portal identity tokens; processor customer/payment-method tokens. Hashed, not encrypted: api_keys (SHA-256), recovery codes and PINs (argon2id), reset tokens (SHA-256). Names, DOB, phone, address, MRN, schedule and ledger rows stay cleartext under storage encryption, RLS, MFA and access logging because the product must search, sort and join at chairside speed — a documented Addressable-standard decision with compensating controls in the SRA and on the trust page; deterministic encryption of names is rejected (frequency analysis on a small practice's name set is trivial); blind indexes on normalized last name + DOB are the Phase 4 option if buyers demand it.

ON THE DEVICE. Any client persistence of PHI (draft mirror, degraded-mode read cache) is AES-GCM under a per-session key issued by the server at sign-in, held only in memory, discarded on sign-out, author switch, idle lock or revoke (wipe also attempted); disabled entirely on device_profile=operatory; IndexedDB/localStorage never hold cleartext PHI; Phase 3 exit is an inspection showing zero cleartext PHI after logout. Browser SpeechRecognition blocked on PHI fields.

LOGS AND TELEMETRY. Structured logger with an allowlist serializer (src/lib/learning/redact.ts as the standard redactor); domain_event.payload is codes-and-ids by Zod contract; no third-party error tracker until a BAA exists, and the scrubber runs first even then; an e2e test greps log output for seeded PHI strings and fails on any hit.

KEY LIFECYCLE. KMS CMKs auto-rotate annually (no re-encryption needed); DEK version rotation on demand and at least every 24 months with lazy re-encryption; audit-chain HMAC keys HKDF-derived per tenant from a separate KMS root, never stored in the database, so a database-only adversary cannot forge a chain; chain heads signed with KMS ECDSA P-256 and the public key published so an auditor can verify without the vendor; AUTH_SECRET dual-key 24-hour rollover; ACM auto-renewal; KMS key deletion protected by the 30-day pending window and an SCP; tenant termination = export → wrapped-DEK destruction (crypto-shred) logged in destruction_log → row purge after the contractual window. The incident module's four-factor assessment pre-populates 'encrypted at rest under FIPS-validated KMS, keys not compromised' from the asset inventory so the safe-harbor conclusion is evidenced, not asserted.

## Audit logging and monitoring

LEGAL ANCHORS. Audit controls (164.312(b), a standard implemented in full), information system activity review (164.308(a)(1)(ii)(D)), log-in monitoring (164.308(a)(5)(ii)(C)), accounting of disclosures (164.528), documentation retention (164.316(b)(2), 164.530(j)(2)), breach burden of proof (164.414(b)), the Pub. L. 116-321 12-month recognized-security-practices evidence window, and Tennessee's PC 991 gross-negligence standard — all of which reward logs that cannot be quietly edited.

WHAT IS LOGGED, IN THE SAME TRANSACTION. (1) domain_event — every state change (auth.*, role.*, ledger.*, claim.*, chart.*, control.*, export.*, disclosure.*, backup.*, chain.*, connector.*, compliance.*) with actor id + frozen name, session_id, ip, ua, aggregate, event_type, payload (codes and ids only), prev_hash, hash; also the transactional outbox (processed_at) fanned out by pg-boss to the controls engine, detectors, digests and webhooks. (2) phi_access_log — every PHI read: actor, patient_id/account_id, resource_kind/id, purpose (treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms), justification (break-glass), ip, session_id; detail views one row per record; list/search views one row with patient_ids[] and count (granularity for OCR production is an owner/counsel question). (3) disclosures — channel, recipient, records, purpose, tpo_excluded, actor, document — so the 164.528 accounting is a query that filters the nine exclusions. Sign-ins, failures, lockouts, spray detections, MFA changes, session revokes and new-device logins are events; unknown usernames are never logged.

INTEGRITY. Both streams written by app_append (INSERT-only), BEFORE UPDATE/DELETE RAISE triggers, monthly partitions, per-tenant HMAC chain: hash = HMAC-SHA256(chain_key_tenant_v, prev_hash || canonical JSON). Per-tenant advisory lock serializes inserts so the chain has one linear head (contention trade-off for the group tier recorded as an open question). HMAC key HKDF-derived from a KMS root, memory-only. Nightly packages/verifier job (sealed, zero app imports) walks each tenant's chain from the last verified head, writes audit_chain_checks(tenant, day, ok, head_hash, object_lock_key), signs the head with KMS ECDSA and puts it in the Object Lock bucket; mismatch = hard event to owner and vendor security officer and export freeze for that tenant. CI plants a tamper (direct UPDATE as app_migrate) and asserts detection. auditLog.ts single-write-point discipline (bounded columns, marked truncation, frozen actor) is kept; ip/ua become real columns.

RETENTION AND REVIEW. ≥6 years for domain_event/phi_access_log/disclosures; partitions past retention detached to Glacier with Object Lock, never dropped unless a destruction_log row and no legal hold permit it; whether access logs should follow the longer clinical clock is an open question. Monthly information-system-activity review is a generated compliance_task with pre-filtered views and an attested completion event; quarterly access recertification likewise; both overdue on the Compliance-lead home. Default UI filter hides routine sign-ins; every row renders as a plain sentence; every export shows the row count actually rendered. Access to the logs is itself a named entitlement and is itself logged.

MONITORING AND ALERTING. pg-boss detectors over the stream: failed-login bursts, lockouts, spray, new device on a financial role, optional impossible-geography, PHI-read volume vs the practice's own baseline, reads without a schedule relationship, after-hours reads/postings, export volume, break-glass use, connector enable/disable, control-policy change, chain failure, restore-drill failure, backup age, terminated user holding grants. Hard events (the design's named set plus chain failure, break-glass, connector change, drill failure) page the owner and vendor immediately via BAA-covered channels (SES under the AWS BAA; SMS via Twilio Security/Enterprise edition BAA or AWS End User Messaging at Phase 4); everything else flows to the weekly digest with SYSTEMIC_SHARE re-scoping and acknowledgment stamping; person-scoped detail is owner + reviewer seat only and never a ranking. Platform telemetry: CloudTrail (Object Lock), GuardDuty, VPC flow logs, WAF logs, RDS/ECS metrics with alarms on error rate, saturation, replication lag, failed KMS calls and unusual IAM activity; EDR on staff endpoints (cyber-insurance precondition); SIEM (Security Lake or a BAA-covered vendor) at Phase 4; 1 year hot / 6 years cold. Health checks feed the public status page so uptime is measured, never asserted. Evidence of the monitoring program (review attestations, alert runbooks, drill results) is retained 6 years and mapped to audit-protocol items.

## Ai and phi policy

PRINCIPLE. PHI reaches a model only through a named, logged, BAA-gated boundary — the inversion of Smile Notes' 'the app holds no PHI, so the gate blocks anything PHI-like' into 'this field may cross to this BAA-covered destination for this purpose'. Deterministic first, model second, human always; every capability has a shipped deterministic twin; AI is included in the price or off, never metered; 'AI off' never removes a feature. Legal basis: a provider receiving PHI on the practice's behalf is a subcontractor BA requiring a BAA with no-training, retention and breach-notice terms; without a BAA the only lawful inputs are Safe Harbor de-identified data (18 identifiers removed AND no actual knowledge of re-identifiability, 164.514(b)(2)(i)-(ii)), Expert Determination output, or a limited data set under a DUA.

WHEN PHI MAY REACH AN LLM. Only when all hold: (1) integration_registry kind=llm enabled, which the trigger permits only with an active baas row; (2) tenant opt-in (tenants.settings.ai_enabled, owner-attested) and the acting user passes capabilityTier server-side from the fresh row; (3) the payload was built from a per-capability field allowlist (note normalization may send note sections and procedure codes; never name, DOB, MRN, SSN, contact, member id, balance); (4) the egress classifier (runPhiRule + scanPhiForProvider, additive-only merge) found no S0 identifier outside the allowlist — stray names/dates are pseudonymized by maskPhi (random per call, never derived; consistent within a document, inconsistent across documents) or the call is refused; (5) the call writes a disclosures row (purpose=ai) plus a codes-only drift row (capability, ASSIST_PROMPT_VERSION, model identity as a version not a pointer, token counts, outcome, latency — never content) so refusal rates have a denominator and model swaps are attributable.

PROVIDER SELECTION (Phase 4 decision, corrected by verifiers). Candidates and their verified constraints: Amazon Bedrock under the AWS BAA (no new subprocessor; HIPAA eligibility is per model — verifier reports Fable and Mythos excluded — so the model id is a compliance decision); Azure OpenAI under the Microsoft DPA/BAA that attaches automatically to volume-licensing customers (GA services and models only; non-text modalities confirmed individually; opt out of abuse-monitoring human review; stay in a selected geography); Anthropic first-party API under a BAA (sales-assisted, not self-serve; BAA and ZDR are separate approvals; BAA Covered Models require a 30-day retention configuration and CANNOT be used from a ZDR-enabled organization — so the draft's 'zero-retention + BAA' assumption is wrong and the choice is HIPAA-ready-with-BAA); xAI/Grok API — the draft's exclusion 'because no BAA is available' was REFUTED: xAI offers a BAA via the questionnaire at x.ai/legal/baa, conditional on approval and on using the ZDR-Enabled API (team-level; disables stateful Responses, Files/Collections and Batch APIs; the consumer Grok app is never covered). xAI is therefore evaluated on its merits (approval likelihood, feature loss under ZDR, model fit, subprocessor count) rather than excluded by premise; the precog Grok-federated better-auth shell is still deleted for architectural reasons (no persistence, committed secret, identity federation the practice does not control), and the 'auth.grok.me' broker's existence and terms are unverified. Whichever provider is chosen: BAA row, no training on inputs, US residency, disclosed subprocessors, model identity logged.

OUTPUT HANDLING. Model output is untrusted data: never authorizes anything, never writes to the record without a human accept, passes verifyMeaning and evidence pinning (every proposal quotes its source span), shows spans not confidence percentages; READBACK_CLASS tokens (tooth, surface, dose, amount, payer) require explicit confirmation on accept. Prompt-injection posture: prompts and tool schemas versioned and CI-guarded; coach tools are read-only ToolResult views over already-authorized data; no tool moves money, grants roles or sends messages. The controls coach receives role labels only (context-pack.ts reshaped), never staff names; outputs labelled directional/educational.

SPEECH. Browser SpeechRecognition is an off-device disclosure to a browser vendor with no BAA — disabled on every PHI field from Phase 0 (Permissions-Policy microphone=(self) reserved for an on-device engine). Voice perio/dictation at Phase 5 only through the DictationEngine seam with an on-device Whisper WASM engine (no subprocessor; frozen dental WER corpus) or a BAA-covered STT vendor registered like any connector.

DE-IDENTIFICATION STANCE. maskPhi and the PHI rules are pseudonymization for minimum necessary, not Safe Harbor; nothing leaves a BAA boundary on their strength; staging never receives a 'de-identified' production copy. Benchmarking/research data sets go through Expert Determination or a complete documented Safe Harbor process — out of scope for v1.

VERIFIER PATTERNS FROM SMILE NOTES KEPT. Server-side licence gating before the run meter and before any provider call; PHI gate result returned before the meter is charged; one parseable row per call including successes; content never logged; connect-src 'self' so the browser can never talk to a provider; sealed independent verification before a model-assisted artifact becomes filed; docs/model-charter.md and non-goals versioned. Marketing never says 'AI-powered'.

## Vendors and baas

MODEL. Two BAA directions and one DPA class. UPSTREAM (vendor as BA of each practice): vendor-form BAA (counsel-drafted) countersigned in the setup wizard before any patient row exists, containing the 164.504(e)(2) terms: uses limited to providing the service; Subpart C safeguards; subcontractor flow-down under both chains; breach reporting to the CE within 5 business days of discovery (statutory outer limit 60 days; the BA clock is not additive to the CE's when the BA is an agent, which is why the contractual window is short); contingency-activation notice within 24 hours (NPRM-aligned, outer bound); access/amendment/accounting support on timelines that let the CE meet Tennessee's 10 working days; return-or-destroy with certified destruction and no-fee export; HHS audit cooperation; 6-year documentation retention; no sale, no training on practice data; liability structure carving breach costs to a cap tied to insurance limits. Optional paid delegated-breach-notifier service (owner decision).

DOWNSTREAM REGISTRY AS A TECHNICAL CONTROL (Phase 0). business_associates(vendor, category, contact) → baas(vendor_id, kind baa|dpa|no_phi_determination, signed_at, expires_at, controls_named, document_id, attestation_report_date, breach_history_reviewed_at, active) → integration_registry(kind, vendor_id, enabled, config). Trigger refuses enabled=true without an active BAA (expires_at > now) or a security-officer-reviewed no-PHI determination; compliance_tasks at 60/30/7 days before expiry; egress allowlist generated from enabled rows; the trust page renders the subprocessor list from these tables so it cannot drift. Annual written verification per vendor (SOC 2 Type II/HITRUST report, pen-test summary, OCR-portal breach search, notification terms, data location, subprocessors, insurance) recorded as a compliance_task.

SUBPROCESSOR INVENTORY WITH VERIFIED STATUS. AWS — one BAA via Artifact; HIPAA-eligible: RDS PostgreSQL, ECS, Fargate (ECS/EKS engines only), S3, KMS, Secrets Manager, CloudWatch, SES, Bedrock (per-model exclusions), End User Messaging (excludes Voice and WhatsApp); account designated HIPAA before any PHI; re-verify the eligible-services page at design freeze. Managed Postgres alternative Neon — BAA self-serve on Scale plan only, $0 today with announced future 15% surcharge, Neon Auth/Managed Better Auth and Data API OUTSIDE the HIPAA boundary, HIPAA cannot be disabled once enabled (one verifier confirmed from Neon's docs source; a second could not reach it — re-read before committing). Hosting alternative Fly.io — pre-signed BAA on a ~$99/month compliance add-on covering Machines and Managed Postgres (scope re-verified). Clearinghouse (DentalXChange or Vyne first; Change Healthcare evaluated against its ~192.7M-individual 2024 breach and multi-month outage) — BAA + EDI agreements; the clearinghouse is itself a CE. Card processor — not a BA under SSA 1179 if the payload is payment-only for a financial institution; written data-flow statement, annual AOC, written script-attack confirmation for SAQ A r1; if the processor's status or payload does not fit 1179, a BAA is required. Transactional email — Resend's public posture is no HIPAA, no BAA; its Enterprise Terms permit PHI only if an Order Form expressly says so under a mutually signed BAA — default plan: Resend for provably PHI-free system mail only, or replace entirely with SES under the AWS BAA (Paubox as alternative). SMS/voice (Phase 4) — Twilio Programmable Messaging/Voice/SIP HIPAA-eligible only with the Twilio BAA on Security or Enterprise Edition (paid tier; SendGrid status unresolved); or AWS End User Messaging SMS. Bank aggregator (Plaid class) — neither a DPA attached to the developer agreement nor any BAA could be verified; plan pessimistically: written answer from Plaid legal before Phase 1 enablement, read-only scopes, no patient identifiers in anything sent, transaction descriptions through the egress classifier before storage; statement import (OFX/CSV) is the floor that needs no vendor. STT (Phase 5) — on-device preferred, else BAA vendor. LLM (Phase 5) — Bedrock / Azure OpenAI / Anthropic (BAA, 30-day retention, no ZDR) / xAI (BAA + ZDR-Enabled API) evaluated on merits as above. eRx (Phase 5) — DoseSpot/DrFirst under BAA + DEA EPCS (21 CFR 1311). Error tracking/APM — none until a BAA exists; scrubber always on. Status page vendor — no PHI (documented determination). Support desk and staff email (Google Workspace/M365) — BAA required if PHI can appear; redactor on pasted content. ADA CDT — license compliance, not PHI. SOC 2 auditor and pen-test firm — NDA + BAA. Legal counsel — not a BA when acting as counsel to the vendor, but a BA of practices if given PHI on their behalf.

NO-BAA / OUT-OF-BOUNDARY (documented). Browser SpeechRecognition — disabled on PHI fields; consumer analytics — never on authenticated pages; third-party CDN/fonts — none (default-src 'self'); precog's Grok-federated auth shell — deleted; Neon Auth/Data API and Resend self-serve — never receive PHI. Subprocessor changes noticed to tenants 30 days ahead with a trust-page diff. Practices average many BAs of their own; the Phase 4 module gives them the same registry.

## Backup dr and availability

LEGAL ANCHOR. Contingency plan standard 164.308(a)(7): backup, DR and emergency-mode plans Required; testing/revision procedures and criticality analysis Addressable (implemented anyway). The NPRM would add a 72-hour restoration requirement for relevant systems; the draft's '48-hour RPO' and 'monthly backup testing' figures could not be verified against the proposed text and are treated as internal targets, not proposed law.

TARGETS. RPO ≤5 minutes for the primary database — this is the floor RDS PITR can honor because transaction logs ship every 5 minutes; do not promise tighter. RTO ≤4 hours for single-region failure in Phases 0-3 (documented runbook, cross-region encrypted copies), ≤1 hour at Phase 4 with a warm cross-region replica and Route 53 failover; degraded read-only mode within 5 minutes of an outage. Availability 99.9% monthly with credits from Phase 4; Multi-AZ RDS and ≥2 app tasks across AZs from Phase 0. All published on the trust page and measured by drills.

BACKUP DESIGN. RDS automated backups with the 35-day maximum PITR window — any longer obligation (the 7-year/majority+1/indefinite Tennessee clinical clocks) is met through AWS Backup and manual snapshot copies, never the automated window; daily snapshots copied cross-region under a multi-region CMK; AWS Backup vault with Vault Lock compliance mode (immutable only after the ≥3-day grace period; prevents early deletion, not expiry) so a compromised administrator cannot delete recovery points — the ransomware posture (Henry Schein, detected Oct 14, 2023, re-encrypted late November 2023, ~166,000 individuals notified, is the market's reference incident); S3 versioning + cross-region replication + Object Lock compliance mode on audit-heads and WORM exports (validated in governance mode first because compliance mode is unrecoverable); documents bucket versioned with MFA-delete; tenant_keys replicated (useless without KMS, which is multi-region for the replica). Backups inherit encryption, so a lost backup is 'secured PHI' provided keys were not compromised.

RESTORE DRILLS. Monthly automated pg-boss job restores the latest snapshot into an isolated staging account (itself under the BAA), runs packages/verifier (chain continuity per tenant, ledger invariants, day-close arithmetic, row-count parity), records duration, tears down, writes domain_event backup.restore_drill(ok, duration, snapshot_id); a failed or stale (>35 days) drill is a hard event and a boot-guard failure for the next deploy. Weekly during Phases 0-1 (Phase 0 exit criterion). Twice a year a human-run DR exercise promotes the cross-region copy and points staging traffic at it, timed, with the runbook revised (164.308(a)(7)(ii)(D)).

EMERGENCY MODE OPERATION (164.308(a)(7)(ii)(C)). Honest bounded degraded mode rather than an offline ledger: a service worker holds today's schedule, critical alerts and chart summaries for the signed-in user, AES-GCM under the in-memory session key, TTL 24 hours, disabled on operatory/shared profiles (owner may disable per tenant); when the API is unreachable the shell shows a banner stating exactly what still works, accepts no writes, and clears on reconnect. Financial postings, approvals and claims are never offline because dual release and SoD cannot be enforced without the server — stated publicly. Queued clinical capture is a Phase 5 ADR decided from measured outage minutes. Criticality analysis written down: Tier 1 ledger, approvals, claims, encounters, audit chain (never degrade, RTO ≤4h); Tier 2 schedule, alerts, chart summaries (degraded read-only); Tier 3 reports, digests, forensics, AI (best effort). Practice-side emergency procedures: printed 'when the cloud is down' card, paper day-sheet template that ties out on restore, subprocessor outage playbooks (clearinghouse down: queue and resubmit frozen bytes; processor down: cash/check with later reconciliation).

STATUS AND CONTRACT. External synthetic checks + internal /healthz (DB, KMS, S3, worker heartbeat, replication lag) feed a public status page with incident history and post-mortems generated from incidents rows; uptime computed, never typed. SLA with credits at GA; 24-hour contingency-activation notice to tenants in the BAA; immutable tested backups and a written IR/DR plan kept in the compliance binder because they are cyber-insurance underwriting requirements.

## Breach and incident response

DEFINITIONS BUILT INTO THE PRODUCT. Security incident (164.304): any attempted or successful unauthorized access, use, disclosure, modification or destruction. Breach (164.402): impermissible acquisition/access/use/disclosure of unsecured PHI, presumed a breach unless the entity DEMONSTRATES low probability of compromise via a documented assessment of at least the four factors (nature/extent incl. identifiers and re-identification likelihood; unauthorized person; whether actually acquired or viewed; extent of mitigation) — performing the assessment is not enough; the conclusion must be low probability. Three exclusions (good-faith unintentional workforce access within authority; inadvertent disclosure between authorized persons; recipient could not reasonably retain) are evaluated first. 'Secured' = encrypted per the HHS guidance (74 FR 42740/42742) with keys not compromised, or destroyed per NIST SP 800-88; the four-factor form pre-populates encryption status from the asset inventory so the safe-harbor decision is evidenced, not made under pressure. Discovery is imputed to the first day any workforce member or agent (federal common law of agency) knew or by reasonable diligence should have known — detection defines the clock.

CLOCKS THE INCIDENTS MODULE COMPUTES FROM discovered_at. BA→CE: contractual 5 business days (statutory ≤60 days, 164.410; not additive to the CE clock when the BA is an agent; MMG Fusion never notified and was sanctioned). CE→individuals: ≤60 calendar days HIPAA (164.404(b)); Tennessee 47-18-2107 says 'immediately, but no later than 45 days' — HIPAA-subject entities are exempt from the section, but the 45-day clock is tracked anyway because employee SSNs, card data and other non-PHI fall outside HIPAA and inside the statute; other states per the individual's residence (several at 30 days; Rhode Island likely 45 — all unverified; Texas 521.053 60 days with a separate AG trigger). Substitute notice when contact info is insufficient or out of date (<10: alternative written/phone; ≥10: 90-day home-page posting or major media where affected individuals likely reside + toll-free number ≥90 days) — mechanics unverified verbatim. Media (164.406): more than 500 residents of one state or jurisdiction, same 60-day clock, 164.404(c) content. HHS (164.408): 500+ aggregate — contemporaneous with individual notice via the portal; <500 — logged and submitted within 60 days after calendar year end. Tennessee consumer reporting agencies (47-18-2107(g)): more than 1,000 persons notified at one time, without unreasonable delay. Law-enforcement delay (164.412): mandatory when an official states notice would impede a criminal investigation or damage national security — written statement: delay for the period specified; oral: document official's identity, delay ≤30 days unless a written statement arrives. Cyber carrier per policy (often 72 hours). Card processor/acquirer if payment pages are implicated (PCI 12.10). FTC HBNR only if a non-BA consumer product ever exists. Every notice recorded as an event with the artifact's document_id; burden of proof (164.414(b)) means the record is evidentiary and retained 6 years.

VENDOR IR PLAN (164.308(a)(6)). Roles: security official (owner initially; fractional vCISO by Phase 2), privacy official, outside healthcare regulatory counsel (privilege and independence should not depend on the owner personally), engineering lead, communications, pre-contracted forensics and notification/call-center vendors via the cyber policy panel. Severity: S1 confirmed PHI exposure or chain/immutability failure; S2 suspected exposure or auth compromise; S3 availability/integrity without exposure; S4 policy violation. Detection sources: hard-event detectors, GuardDuty/CloudTrail alarms, WAF anomalies, chain-verification failure, restore-drill failure, subprocessor BA notice, tenant report, researcher disclosure (security.txt and published policy from Phase 1), the anonymous PHI-gated tip channel. Containment playbooks as runbooks each producing an audit row: rotate AUTH_SECRET (dual-key window) and connector credentials; revoke all sessions for user/tenant/platform; disable connector at the registry; freeze exports for a tenant; block IPs/ASNs at WAF; isolate a task; snapshot RDS and S3 objects before remediation; preserve chain heads. Evidence: CloudTrail, WAF, flow logs, domain_event/phi_access_log slices exported with chain proofs to an Object Lock bucket; chain of custody documented. Recovery per the DR procedures. Post-incident: four-factor assessment, notifications, root cause, corrective actions in the risk register, public post-mortem on the status page within 14 days for availability incidents; security incidents reported to affected CEs, publicly only if counsel decides. Tabletops twice a year (ransomware; insider/credential) plus a quarterly live 'revoke everything' drill on staging. Never make public statements about cause before forensics and counsel sign off; cooperate with OCR data requests (typically 10 business days); rely on the 12-month recognized-security-practices record as a mitigating factor (no safe harbor).

TENANT-FACING IR (Phase 1 intake, Phase 4 module). Incident intake with all clocks above computed per affected individual's state, four-factor template, notice templates with 164.404(c) content, workforce sanction note, and the phi_access_log/disclosures queries that answer 'who saw what' — the questions OCR asks first. The tip channel (from wishes.ts, PHI-gated, anonymous option) is first-class because most fraud and many privacy incidents surface through tips.

## Secure sdlc

REPOSITORY AND REVIEW. pnpm-workspaces monorepo seeded from the dental repo; precog git history not carried (committed PREVIEW_CLIENT_SECRET rotated). Branch protection on main: required review, required status checks, no force push, signed commits. CODEOWNERS requiring a second reviewer for packages/verifier, packages/db (migrations, roles, RLS policies), apps/pms/src/lib/auth, the withGuard wrapper, integration_registry code, .github/workflows. PRs touching an append-only table, RLS policy, role grant or the verifier get a security-review label and checklist (threat, test added, audit row emitted, migration reversible).

BLOCKING CI (one job; any failure blocks merge). tsc --noEmit; eslint (added — neither repo has it) with security plugins and a custom rule forbidding direct writes to ledger_entries outside the ledger service and PHI fields in log statements; vitest with a coverage floor that ratchets; route-guard glob test (every route/action wrapped or allowlisted); RLS/role negative tests on a real Postgres 16 service container (cross-tenant leak with WHERE removed; missing SET LOCAL → zero rows; reused connection after RESET → zero rows and no uuid cast error, proving the NULLIF policy; app_append UPDATE → 42501; trigger RAISE on every append-only table); planted-tamper chain-detection test; import-purity tests (clinical-core, controls-engine, verifier import nothing from apps/); verifier seal check (manifest hashes match; unsealed files fail); drizzle-kit checks (schema changed without a migration → fail; shadow-DB apply; fresh-vs-migrated diff empty); version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION, SCORING_VERSION, CONTROL_RULEBOOK_VERSION) from ci.yml; gitleaks; pnpm audit failing on high/critical with an expiring exceptions file; CycloneDX SBOM attached; Trivy image scan; the e2e security probes (headers, lockout, mfa.totp, submission.immutability, account.lifecycle, prehydration.login, setup.firstboot) against a production build on ephemeral Postgres — not continue-on-error; PHI-in-logs grep test; next build.

DEPENDENCIES AND SUPPLY CHAIN. Exact pins, frozen lockfile, pnpm --ignore-scripts with an explicit allowlist; Renovate weekly grouped updates, security advisories immediately, tracked to the NPRM-aligned SLA (critical 15 days, high 30, from patch availability); next-auth pinned to an exact 5.0.0-beta.x and wrapped behind guards.ts and the sessions table so the provider is swappable (formal stable-library decision at Phase 4); GitHub artifact attestations; distroless Node LTS base digest-pinned and rebuilt weekly; one-line justification per new dependency; quarterly dependency-count review (precog's unused Radix packages as the cautionary example).

SECURE CODING RULES. Zod at every boundary behind readJsonRecord (Content-Type check, 1 MB cap); parameterized queries only (Drizzle); no raw HTML rendering; nonce CSP in Phase 4; routes and server actions only through withGuard; money in bigint cents; UUIDv7; frozen attribution; no PHI in logs (allowlist serializer); no PHI in fixtures (synthetic generator only; precog demo-data becomes a fixture); no production data in non-production; errors return human sentences without stack traces or wire-format words.

RUNTIME HARDENING. Fargate tasks non-root, read-only root filesystem, minimal per-service IAM task roles, no inbound to workers, health checks that fail closed on missing KMS/DB/storage, boot guards as specified, structured logging with redaction, request ids threaded into domain_event.

TESTING BEYOND CI. Property-test suite for the ledger (10,000 generated dual-payer/partial/secondary/reversal/refund scenarios) before any UI; golden + monotonicity tests for every lifted Precog function before a score is shown; precision harness for the PHI egress classifier (zero false blocks after re-scope); STRIDE-lite threat model per module using the adversarial panels in dental/knowledge/sources as attacker personas, revisited at each phase gate; authenticated DAST against staging quarterly (exceeds the NPRM's proposed 6 months); annual third-party penetration test from Phase 4 (findings closed as a GA exit criterion) including backup-media and key-separation scenarios; security.txt and disclosure policy from Phase 1, bug bounty later.

RELEASE. Migrations run by CI as app_migrate with the chained history table; blue/green ECS deploys with automatic rollback on health failure; every release has an SBOM, an attestation, a changelog line for any security-relevant change, and a re-seal diff if the verifier moved; post-mortems for availability incidents published, security post-mortems internal with a CAP.

## Compliance program and calendar

GOVERNANCE. Designate a Security Official (164.308(a)(2)) and a Privacy Official — may be one person in Phase 0 but both roles documented; fractional vCISO by Phase 2; outside healthcare regulatory counsel retained for the SRA sign-off, BAA forms, Tennessee content review, the RPC 5.7 opinion on generated policies, and incident response so privilege and independence do not depend on the owner personally. Adopt NIST CSF 2.0 plus HHS 405(d) HICP (small-practice volume) as the 'recognized security practices' framework and keep 12 months of continuous evidence (mitigating factor only under Pub. L. 116-321; no safe harbor). NIST SP 800-66r2 (Feb 2024) used as non-binding implementation guidance, noting it predates the NPRM.

POLICIES (164.316(a); docs/security/policies, maker-checker approved, versioned, reviewed annually, retained 6 years from last effective date). Security management and risk; workforce and JML; access control and minimum necessary (generated from role_templates); awareness/training; incident response and breach notification (all clocks); contingency/backup/DR; evaluation; BA and vendor management; facility/workstation/device (cloud-inherited + laptop controls); audit and monitoring; integrity; authentication; transmission; encryption and key management; privacy uses/disclosures and individual rights; complaints; sanctions; documentation and retention (HIPAA 6-year vs Tennessee clinical clocks); AI/PHI; vendor support access; secure development and change; data classification and DRS; acceptable use.

CADENCE. Risk analysis: vendor SRA before any PHI (Phase 0 exit — the Phase 1 shadow ledger is PHI), refreshed at each phase gate, annually, and on material change (new subprocessor, region, data class); risk register reviewed monthly showing identification → treatment → implementation → re-assessment (OCR now evaluates risk management, not just analysis). Training: all vendor staff at hire and annually; role-specific for production access; quarterly phishing; records 6 years. BAAs: gating Phase 0; annual verification per subprocessor; practice-side BAA management Phase 4. Sanctions: written, applied, logged. Evidence: audit-protocol-mapped binder (policy → procedure → artifact → owner → last reviewed) in a compliance repository; the product dogfoods most vendor evidence as audit rows (restore drills, chain checks, log reviews, access reviews, BAA expiries, training, incidents, policy approvals) exported as a signed evidence pack.

ATTESTATIONS AND TIMING. HIPAA has no certification; never claim one. Phase 1 (~month 6): readiness assessment against the OCR audit protocol (scope: Privacy, Security, Breach modules; revision date unverified) and gap letter; pilot agreement discloses plainly that early buyers rely on a pen test, documented SRA and published policies. Phase 2: engage the SOC 2 auditor; Type I at Phase 2 exit; Type II observation window (convention 6-12 months; ~3-month practical minimum is industry practice, not a rule) spanning Phases 3-4. Phase 4 GA: SOC 2 Type II issued or observation complete; third-party pen test; product SRA summary on the trust page; PCI SAQ A posture with processor AOC and written script-attack confirmation; cyber and tech E&O bound with the compliance binder as the source of every application answer. Year 2: HITRUST e1 (then i1) only if a group/DSO or payer requires it (requirement counts are CSF-version-dependent). The NPRM's annual compliance audit and annual BA written verification (SME analysis + officer certification) are pre-adopted as internal practice so finalization changes paperwork, not architecture.

COMPLIANCE CALENDAR. Daily — chain verification, backup success, hard-event triage; practice-side reconciliation. Weekly — dependency/patch review; restore drill (Phases 0-1, then monthly); digest review. Monthly — attested information-system-activity review; production restore test; vendor/admin access review; BAA expiry check; open-incident and under-500 breach-log review; risk-management plan status. Quarterly — authenticated vulnerability scan; access recertification (vendor staff; tenant owner/financial grants); IR/DR tabletop (alternating ransomware and insider); policy change review; phishing exercise; cyber-insurance control check; PCI posture check. Semi-annual — external scan floor; key/secret rotation review; SoD review of vendor staff duties; engineer training refresh; human-run DR failover exercise. Annual — SRA refresh and sign-off; full policy review; workforce HIPAA and security training; penetration test; Security Rule self-audit against every standard; asset inventory and network map review (also on change); BA written verification for every subprocessor; NPP template review; cyber-insurance renewal with application accuracy review; SOC 2 Type II period; PCI SAQ A and processor AOC; recognized-security-practices roll-up; retention/destruction run with destruction log; Tennessee dental rule and statute currency review. Fixed dates — by March 1 each year: prior-year under-500 breaches to HHS (60 days after year end); Feb 16, 2026 (passed): Part 2 NPP language — confirm no extension; 2027-01-01: PC 1107 supervision rule effective — UNVERIFIED, do not ship the hard block until the enrolled chapter is read; HHS penalty inflation adjustment (typically early in the year — figures unverified) updated in the risk register; Unified Agenda checks each spring/fall for the Security Rule NPRM (July 2027 target) and the Privacy Rule access-timing NPRM (~Nov 2026). Event-driven — breach clocks (BA→CE 5 business days; individuals ≤60 HIPAA / 45 TN tracked / per-state; HHS contemporaneous if 500+ aggregate; media >500 per state; CRAs >1,000 TN; carrier per policy); right of access 10 working days TN / 30 days HIPAA; amendment 60 days; accounting 60 days; workforce termination same day (vendor within 24 hours); new subprocessor: BAA before enablement (enforced); tenant BAA termination: return/destroy with certificate within 30 days; material change: SRA delta; subprocessor change: 30-day tenant notice.

PRACTICE-FACING PROGRAM (Phase 4, counsel-reviewed, labelled provisional until then). Guided SRA questionnaire → tailored versioned policies → remediation tasks → server-verified training with certificates → BAA document management → incident intake with all clocks → OSHA logs (BBP training 3 years; exposure/medical records employment + 30 years via 1910.1020; sterilizer monitoring 2 years TN — mapping unverified) → annual SRA reminder. This content is legal material produced by a company owned by a Tennessee attorney: the RPC 5.7 analysis and disclaimers must be settled before commercial distribution.

## Corrections applied

- xAI/Grok 'no BAA available' was REFUTED: xAI offers a BAA via a questionnaire at x.ai/legal/baa, conditional on approval and on using the ZDR-Enabled API (team-level; disables stateful Responses, Files/Collections and Batch APIs; consumer Grok app never covered). Plan change: xAI is evaluated on its merits at Phase 4 alongside Bedrock, Azure OpenAI and Anthropic rather than excluded by premise; the precog Grok-federated auth shell is still deleted for architectural reasons; 'auth.grok.me' identity broker existence and terms marked unverified.
- Anthropic BAA assumption corrected: BAA and zero-data-retention are separate, sales-assisted approvals, and BAA Covered Models REQUIRE a 30-day retention configuration and cannot run in a ZDR-enabled organization. Plan change: provider comparison lists Anthropic as 'HIPAA-ready with BAA, 30-day retention', not 'zero-retention'; per-model coverage checked before locking a model id.
- AWS eligibility flattened by the draft was corrected: Fargate eligible for ECS/EKS engines only; Bedrock eligibility is per model (verifier reports Fable and Mythos excluded); End User Messaging excludes Voice and WhatsApp; the eligible-services page changes roughly monthly. Plan change: model selection treated as a compliance decision; re-verify at design freeze; account designated HIPAA before any PHI.
- Neon corrected: HIPAA is self-serve on the Scale plan only (Business plan not listed); $0 today with a disclosed future 15% surcharge; Neon Auth/Managed Better Auth and Data API sit outside the HIPAA boundary; HIPAA cannot be disabled once enabled. Fly.io corrected: BAA is gated behind a ~$99/month compliance add-on. Both recorded as alternatives with these constraints.
- Resend corrected from a flat 'no BAA' to: public posture is no HIPAA and no BAA, but Enterprise Terms permit PHI only under an Order Form expressly allowing it plus a mutually signed BAA. Plan change: default is no PHI through Resend; SES under the AWS BAA (or Paubox) for anything that could carry PHI unless a countersigned Order Form + BAA is actually held.
- Twilio corrected: HIPAA eligibility requires the Twilio BAA on Security or Enterprise Edition (paid tier); SMS is not end-to-end encrypted beyond Twilio; SendGrid status unresolved. Plan change: budget the edition; content minimization in message bodies is a design requirement.
- Plaid corrected: neither a DPA attached to the developer agreement nor any BAA could be verified. Plan change: pessimistic posture — written answer from Plaid legal before Phase 1 enablement, no patient identifiers in anything sent, statement import as the vendor-free floor, descriptions through the egress classifier.
- Postgres RLS fail-closed claim corrected: comparing tenant_id to NULL yields unknown (not false) — same practical effect but no policy branch may coalesce NULL permissively; and on pooled/reused connections a previously SET GUC persists as '' rather than undefined, so current_setting('app.tenant_id', true)::uuid raises a cast error. Plan change: policies written as NULLIF(current_setting('app.tenant_id', true), '')::uuid; SET LOCAL always inside an explicit BEGIN; a CI test exercises a reused connection after RESET.
- FORCE ROW LEVEL SECURITY caveat applied: superusers and BYPASSRLS roles still bypass; owner-only for policy DDL. Plan change: runtime roles are explicitly non-owner, non-superuser, non-BYPASSRLS, not reliant on FORCE alone.
- Auth.js secret-array behavior clarified: session tokens are encrypted JWEs — secrets[0] encrypts, all decrypt (newest first) — not sign/verify; the pinned beta could not be checked because the target repo has no package.json yet. Plan language and rollover runbook updated; verification deferred to the actual pin.
- Security Rule terminology corrected: 164.312(b) audit controls and 164.312(d) authentication are standards with no implementation specifications (mandatory under 164.306(d)(1)), not 'required implementation specifications'; 'addressable' restated as implement-or-document-and-substitute, never optional; the (D) caption is 'testing and revision procedures'.
- 164.316(b)(2)(i) scope corrected: the 6-year retention applies to Security Rule documentation only, not to medical records (no federal record-retention period exists). Plan change: retention_policy separates HIPAA documentation clocks from Tennessee clinical clocks.
- Minimum-necessary language corrected: 164.514(d)(2) says 'persons or classes of persons' and requires identifying PHI categories and conditions ((d)(2)(i)(A)-(B)); 'role-based' is a paraphrase; 164.502(b)(2) exceptions noted. Plan change: the written policy is generated from role_templates using the regulatory phrase.
- Accounting of disclosures corrected: nine exclusions in 164.528(a)(1)(i)-(ix), not only TPO; the HITECH 13405(c) EHR-TPO expansion was never finalized. Plan change: disclosures table logs everything with a tpo_excluded flag and the report filters all nine.
- Right of access corrected: stay on 30 days + one 30-day extension; the 15-day proposal (86 FR 6446) is unfinalized and a separate NPRM on access timing is expected ~Nov 2026; Tennessee's 10 working days (63-2-101) is the binding shorter clock.
- Safe Harbor corrected to include 164.514(b)(2)(ii) (no actual knowledge of re-identifiability) and 164.514(c) re-identification-code rules; staging may never receive 'de-identified' production copies.
- Breach definition corrected: the presumption is rebutted by demonstrating low probability of compromise, not merely by performing an assessment; three exclusions at 164.402(1)(i)-(iii) evaluated first; encryption safe harbor requires the key not be compromised.
- HHS encryption guidance citation corrected: the operative version is the one issued with the Aug 24, 2009 interim final rule at 74 FR 42740/42742, superseding 74 FR 19006; destruction per NIST SP 800-88 is the second qualifying method.
- Breach notification mechanics corrected: 164.404(a)(2) agency per federal common law; 164.406 threshold is per single state/jurisdiction with the same 60-day clock and 164.404(c) content; 164.408 500+ is aggregate and via the HHS portal; 164.410 BA clock is not additive to the CE clock; 164.412 is mandatory in form, covers criminal investigation OR national security, written statement → specified period, oral → ≤30 days documented.
- BAA citation chain corrected: 164.504(e)(2) does not cite 164.314(a)(2)(iii); privacy chain is 164.502(e)(1)(ii)/(e)(2) + 164.504(e)(2) applied to subcontractors by (e)(5); security chain is 164.314(a)(2)(i)-(ii) flowed down by (a)(2)(iii). Plan requires both chains in every subcontractor BAA.
- Tennessee 47-18-2107 corrected: 45 days is an outer bound ('immediately'); CRA notice is subsection (g), 'without unreasonable delay', >1,000 at one time; the encryption carve-out is in the 'breach of system security' definition at (a)(1), requires FIPS 140-2, and 'personal information' is limited to name + SSN/driver license/financial account credentials (clinical data alone is outside); HIPAA-subject entities are exempt from the section outright (lettering unconfirmed). Plan change: the 45-day clock is still tracked for non-PHI data; FIPS-validated modules required for the safe-harbor argument.
- Tennessee retention corrected: 7 years runs from LAST PROFESSIONAL CONTACT (recomputed on every contact); minors = longer of majority+1 year or 7 years from last contact → max(last_contact+7y, dob+19y), not '10 years'; incompetent patients retained INDEFINITELY (hard hold flag). The 10-working-day copy deadline moved from Board rule 0460-02-.12 to Tenn. Code Ann. 63-2-101(a)(1) (written request), fees to 63-2-102 with HIPAA's cost-based cap governing where lower; 36-month closure notification (30-day deadline) also triggers on group departure and sale; records never withheld for non-payment.
- Henry Schein citation corrected: File No. 142 3161, Docket C-4575; announced Jan 5, 2016, final order May 23, 2016, 20-year term; $250,000 monetary relief under Section 5 (not a civil penalty, not HIPAA enforcement); FTC framing is 'a less complex encryption algorithm' than NIST-recommended AES.
- FTC HBNR exclusion restated as activity-specific ('to the extent' acting as a BA): a direct-to-consumer product would be inside HBNR even with a BAA for the clinical product; 318.4/318.5 timing details marked unverified.
- Information blocking corrected: an uncertified developer is not a 'health IT developer of certified health IT' actor but can be an HIN/HIE actor under the functional 171.102 definition. Plan change: written HIN/HIE self-assessment; dentists CAN be MIPS-eligible (low-volume threshold is the practical exclusion); 'HTI-5' existence marked unverified.
- PCI corrected: SAQ A r1 REMOVED 6.4.3 and 11.6.1 from SAQ A and added a script-attack eligibility criterion satisfied by written processor confirmation; 'hosted fields' is not a safe synonym for iframe — merchant JS touching PAN drops to SAQ A-EP; full-redirect carve-out and 'v4.0.1 only active version' marked unverified. SSA 1179 restated with its 'for a financial institution' qualifier and pinned to the Privacy Rule preambles rather than an unnamed '2002 guidance'.
- OCR enforcement counts corrected: '16' was total HIPAA resolution agreements Jan–Aug 2025, not Risk Analysis Initiative actions; the Initiative launched October 2024 and stood at 13 completed investigations when the four ransomware settlements ($1,165,000) were announced April 23, 2026 (not April 24). MMG Fusion restated as a patient-communication/marketing software BA that never notified (not merely late).
- AWS RDS/S3/Backup details applied: PITR maximum 35 days (longer retention via AWS Backup/manual snapshots); 5-minute log shipping bounds RPO; Object Lock compliance mode is version-level, unrecoverable, validate in governance mode; Vault Lock has a ≥3-day grace period and prevents early deletion only.
- Pub. L. 116-321 restated as requiring the entity to have 'adequately demonstrated' recognized security practices for the prior 12 months, mitigating only, no safe harbor; HITECH 13402 'required HHS to issue' the Breach Notification Rule.
- NPRM precision applied throughout: 90 FR 898 pin cite confirmed by one verifier and unconfirmed by another (kept with note); patch clocks run from patch availability with a third 'reasonable' tier; ports disabled 'in accordance with the risk analysis'; asset inventory reviewed every 12 months AND on change; BA contingency notice is an outer bound flowed down the chain; BA verification is a two-part SME analysis + officer certification; BAAs get ~1 year to conform after the effective date; the draft's '48-hour RPO' and 'monthly backup testing' figures could not be verified and are treated as internal targets.
- Henry Schein 2023 ransomware timeline tightened (detected Oct 14, disclosed Oct 15, re-encrypted late November, ~166,000 notified); Change Healthcare 'updated July 31, 2025' date flagged as likely wrong.
- Draft's '10-year minor floor from the Department of Health manual' is not implemented as an alternative shorter period; the rule-based max() formula governs pending counsel confirmation of any longer manual floor.
- Phase 1 entry gate made explicit: the shadow ledger (names + balances) is PHI under 160.103, so the vendor SRA, pilot BAA, encryption, RLS, phi_access_log and IR plan must be live before the first import.

## Unverified items

- 90 FR 898 as the exact Federal Register starting page for the Security Rule NPRM (publication date, RIN and comment deadline confirmed; pin cite confirmed by one verifier, unconfirmed by another).
- NPRM '48-hour RPO' and 'monthly backup/restore testing' wording — not found in the proposed text by any verifier; treated as internal targets only.
- Exact codified location of the NPRM patch-management provisions (proposed 164.308 vs 164.312).
- HIPAA civil monetary penalty tiers and the 'assessed on or after January 28, 2026' inflation-adjusted figures (45 CFR 102.3) and current status of the April 2019 enforcement-discretion notice.
- 45 CFR 164.404(d)(2) substitute-notice mechanics verbatim (10-or-more threshold, 90-day posting, toll-free line, media geography).
- Tenn. Code Ann. 47-18-2107 subsection lettering for the HIPAA/GLBA exemption (likely (h)/(i)) and verbatim text of (a)(1), (b), (c), (g).
- Tenn. Code Ann. 63-2-102 fee cap figures ($25 / $0.25 per page / $90 electronic) and the 'free if late' consequence; 63-2-101 verbatim 10-working-day text.
- Tenn. Comp. R. & Regs. mappings: 0460-01-.11 sterilizer monitoring 2 years; 0460-02-.10 advertising retention; 0460-01-.12 unprofessional conduct; 0460-01-.16 patient rights; whether the Department of Health Standards of Practice Manual imposes any minors' floor and whether it binds.
- 2026 Tenn. Pub. Ch. 1107 (hygienist supervision for new patients, effective 2027-01-01) — chapter number, act list and date; the dental repo's tn-law.ts:139 links only to the capitol.tn.gov homepage; the encoded S1 hard block must not ship until the enrolled chapter is read from a network with tn.gov egress.
- Tenn. Code Ann. 63-5-108 (three-hygienist cap) and 63-5-115 (15-business-day / 11-month general-supervision window) — section numbers and parameters.
- Tenn. Code Ann. 53-10-310(e) CSMD check triad (new episode / each prescription in first 90 days / every six months) and dentist exemptions; Tennessee EPCS mandate citation (53-11-308 vs 63-1-160) and effective date.
- Tennessee Public Chapter 991 (2024) / Tenn. Code Ann. 29-34-215 scope (class actions only? definition of cybersecurity event; signature date May 21, 2024).
- Tennessee Information Protection Act thresholds, effective date and whether the HIPAA exemption is entity-level, data-level or both.
- Tenn. Sup. Ct. R. 8, RPC 5.7 text and Comments as adopted in Tennessee — highest-stakes personal item for the owner; obtain a Board of Professional Responsibility opinion.
- 42 CFR Part 2 final rule dates and whether the Feb 16, 2026 NPP compliance date was extended or subject to enforcement discretion.
- Purl v. HHS (N.D. Tex. June 18, 2025) scope of vacatur and September 2025 Fifth Circuit dismissal; AHA v. Becerra (June 20, 2024) scope and August 2024 appeal withdrawal; current posted state of the OCR tracking-technologies bulletin.
- 45 CFR 171.102 cross-reference to 42 U.S.C. 300jj(3) and inclusion of dentists; the October 6, 2022 EHI date; HHS disincentives rule details (89 FR 54662); OIG CMP $1M and any inflation adjustment; existence of an 'HTI-5' rule.
- PCI DSS v4.0.1 as the only active version as of Sept 2026; whether full-redirect merchants are exempt from the SAQ A r1 script-attack criterion; PCI DSS 12.10 processor-notification wording.
- SSA 1179 / 42 U.S.C. 1320d-8 verbatim text and the specific HHS preamble or FAQ that treats payment processors as non-BAs.
- Change Healthcare breach figure (~192.7M) update date; 'largest ever reported to OCR' characterization.
- OCR HIPAA Audit Protocol revision date ('2018' likely wrong; probably April 2016).
- Plaid DPA and BAA posture; whether any Plaid document constitutes a DPA attached to the developer agreement.
- 'auth.grok.me' identity broker — existence, ownership and terms.
- Neon HIPAA details (Scale-only, 15% future surcharge, Auth/Data API exclusions) — confirmed by one verifier from Neon's documentation source, unreachable for another; re-read at neon.com/docs/security/hipaa before choosing.
- Fly.io compliance add-on price (~$99/month) and whether Fly Managed Postgres is inside the BAA scope; SOC 2 Type 2 status.
- Anthropic BAA/ZDR coupling (30-day retention; no ZDR for Covered Models) — confirmed by one verifier from Anthropic help articles, unreachable for another; quote verbatim before relying.
- Twilio SendGrid HIPAA status; current Twilio HIPAA-eligible product list.
- FCC 15-72 health-care message exemption numeric conditions (one/day, three/week, 160 characters) and the current state of TCPA law after subsequent D.C. Circuit and FCC actions.
- State breach deadlines: Colorado, Florida, Maine, Rhode Island (likely 45 days, not 30), Washington; Texas HB 300 'covered entity' definition and Tex. Bus. & Com. Code 521.053 (60-day individual / 30-day AG) details.
- OSHA citations: 1910.1030(c)(1)(iv), (g)(2)(ii), (h)(1)-(2); 1910.1020(d)(1)(i) cross-reference; Appendix A to Subpart B of Part 1904 listing NAICS 6212 vs 621210.
- AICPA TSP 100 (2017, 2022 points of focus) and SOC 2 observation-window conventions; HITRUST e1/i1/r2 requirement counts and validity for the current CSF version.
- IBM Cost of a Data Breach 2026 healthcare figure ($6.64M) — second-hand via Patient Protect; do not reproduce until confirmed against IBM directly.
- ADA CDT copyright/license terms and which CDT version is currently adopted at 45 CFR 162.1002.
- FIPS 140 validation certificates for AWS KMS HSMs and for the application-layer crypto library build — required to support both the HIPAA and Tennessee safe-harbor arguments.
- Auth.js secret-array behavior against the eventually pinned next-auth 5.0.0-beta.x (target repo has no package.json yet).
- HHS 2019 direct-liability-of-business-associates guidance scope (BAs not liable for the full Privacy Rule) — consistent with verifier notes but not read directly.

## Open questions for owner

- Phase 1 entry gate: confirm the roadmap treats the shadow-ledger pilot as holding PHI (patient names + balances) so the vendor SRA, pilot BAA, encryption, RLS, phi_access_log and IR plan are exit criteria of Phase 0, not deliverables of Phase 2.
- Hosting: AWS single-BAA stack (recommended) versus Fly Machines ($99/month BAA add-on) + Neon (Scale plan only; Auth/Data API outside HIPAA; future 15% surcharge). If not AWS, the Object Lock, Vault Lock, KMS and cross-region stories must be re-derived with provider equivalents.
- LLM provider for Phase 5 now that xAI's exclusion premise is refuted: Bedrock (no new subprocessor; per-model eligibility), Azure OpenAI (automatic BAA under volume licensing; GA only), Anthropic (BAA with mandatory 30-day retention, no ZDR), or xAI (BAA by approval + ZDR-Enabled API with feature loss). Decide at Phase 4 with the SRA refresh; is a 30-day provider-side retention window acceptable to you as counsel?
- Cleartext names and DOB for search under RLS + access logging + storage encryption: are you comfortable defending this in the SRA and to the plaintiff-attorney panel, or should blind indexes on normalized last name + DOB be budgeted before GA?
- PHI read-log granularity for list views: one row with patient_ids[] per render (design) or one row per patient shown — which can you produce in an OCR request?
- Tennessee 47-18-2107: does counsel agree HIPAA-subject tenants are exempt from the section outright, and that the 45-day clock therefore binds only non-PHI data (employee SSNs, card data)? Tenant-facing copy must not overstate the state duty.
- Records-copy fee: confirm the 63-2-102 figures and the rule that the product charges min(state cap, HIPAA cost-based fee) and zero when late.
- Minors' retention: the rule-based max(last_contact+7y, dob+19y) governs the design; does any Department of Health manual impose a longer floor that should override, and how should 'incompetent patient' map to current guardianship law for the indefinite hold?
- PC 1107 supervision block: authorize a verification from a network with tn.gov egress before any scheduler or filing rule encodes the 2027-01-01 hard block; if the chapter differs, the engine would refuse lawful bookings and notes on a date certain.
- RPC 5.7: commission a written opinion (or Board of Professional Responsibility guidance) on the compliance module's generated policies and Tennessee-law references before commercial distribution; decide on the provider of record and disclaimer language.
- Clearinghouse-status risk: obtain counsel's written analysis that assembling 837Ds and forwarding them to a clearinghouse does not make the vendor a 'health care clearinghouse' (a covered entity), and structure contracts so the practice is submitter of record.
- Card processor: which vendor, in which integration mode (true processor-controlled iframe/hosted field → SAQ A; any merchant JS touching PAN → SAQ A-EP), and will it sign a BAA if the SSA 1179 'for a financial institution' analysis does not cleanly fit?
- Bank aggregator: run under DPA only with the egress classifier scrubbing descriptions and read-only scopes, or require a BAA (which Plaid may never sign) before enablement — accepting statement import as the only Phase 1 path if so?
- Transactional email: keep Resend for provably PHI-free system mail (reset links, invites) or move everything to SES under the AWS BAA to avoid classification disputes?
- Vendor as second approver in the two-admin recovery ceremony for 1-owner/1-OM tenants: acceptable (logged, owner-visible), or must every tenant designate a second human admin at provisioning?
- Vendor break-glass posture: hardware-key, time-boxed, session-recorded IAM role (design) or stricter 'no vendor access to tenant PHI without per-incident tenant approval', accepting slower support?
- Degraded-mode encrypted cache on desk profiles: enabled by default with 24h TTL, or disabled by default and enabled per tenant, given that any client-side PHI is a breach surface the SRA must justify?
- Access-log retention beyond 6 years: follow the Security Rule minimum or the longer clinical record they describe (7y / majority+1 / indefinite)?
- Chain-insert serialization per tenant at group scale: keep real-time per-tenant advisory-lock chaining (contention) or move to sequence-numbered inserts with nightly re-chaining (weaker real-time tamper evidence)?
- Designated reviewer/CPA seat: does giving an external CPA person-scoped control signals (ledger rows carry patient ids) make the CPA a business associate of the practice? Decide the seat's data scope and BAA status.
- SOC 2 budget and sequence: auditor engaged at Phase 2 start (~$15k-$50k plus tooling); issue a Type I at Phase 2 exit or go straight to Type II fieldwork? Will early customers accept pen test + SRA + policies for roughly a year, and does the pilot agreement say so plainly?
- Delegated breach notification: offer to act as tenants' notifier (as Change Healthcare did) as a paid service, at what liability cap, and with what change to cyber-insurance limits?
- Cyber and tech E&O coverage: carrier, limits, and whether tenants and subprocessors must carry their own; the compliance binder should be the source of every application answer.
- Named officials: who is Security Official and Privacy Official in Phase 0, when is a fractional vCISO engaged, and will outside healthcare regulatory counsel be retained so privilege and independence do not rest on the owner personally?
- Multi-state: will any out-of-state practice or Tennessee practice with a material out-of-state patient base be onboarded before per-state jurisdiction packs exist? The incident engine computes per-state clocks from day one regardless; which states' research is funded first (Rhode Island's 45-day figure and Texas HB 300 need confirming)?
- Passkeys on operatory tablets from Phase 3 (phishing resistance; NPRM direction) versus PIN re-auth, given iPad/MDM enrollment friction?
- NextAuth v5 beta: at which phase gate do you want a formal decision to migrate to a stable library or Auth.js GA, given audit optics of a beta dependency in the authentication path?
- Error tracking/APM: operate Phases 0-3 on CloudWatch and structured events alone, or procure a BAA-covered vendor (Sentry Business, Datadog) in Phase 0?
- ONC certification: record the decision before API v1 (default no); if yes, budget HTI-series obligations and developer information-blocking exposure; either way, complete the HIN/HIE self-assessment.
- Portal HBNR analysis: confirm in an ADR that the portal is offered only as a BA function of each practice and that no direct-to-consumer app is planned.
