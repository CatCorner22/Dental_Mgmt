# Security draft 2: compliance-program

- **Source**: Claude Code planning workflow `wf_8edc6cab-3ac`, agent result 18 (Security phase); repositories read: `CatCorner22/dental`, `CatCorner22/precog`; knowledge base v3 (2026-09-02)
- **Type**: analysis
- **Author/Origin**: read-only planning agent (no code was changed); reviewed by the session lead before inclusion
- **Published**: 2026-09-03
- **Ingested**: 2026-09-03
- **Tags**: consolidation, security, hipaa, compliance-program

## Summary

Regulatory scope, control mapping, and architecture from the compliance-program lens; 63 citations submitted for verification.

## Lens

compliance-program

## Regulatory scope


### Item 1
- **regime**: HIPAA Privacy Rule (45 CFR Part 160 and Part 164 Subparts A, E)
**applies because**

Each practice is a covered entity (health care provider that transmits health information electronically in connection with a HIPAA standard transaction, e.g., 837D claims or 270/271 eligibility). The vendor creates, receives, maintains and transmits PHI on the practices' behalf and is therefore a business associate under 45 CFR 160.103, directly liable for the Privacy Rule provisions that apply to BAs (uses/disclosures limited to the BAA, minimum necessary, access support, accounting support, subcontractor BAAs). Note: a cash-only practice that never transmits a standard transaction is NOT a covered entity — but the moment the PMS submits an e-claim or eligibility inquiry for it, it becomes one, so onboarding must treat every tenant as a CE from day one.


#### key obligations
- Uses and disclosures only as the BAA permits; no sale of PHI; no marketing uses without authorization (164.502(a)(3), 164.502(a)(5)(ii), 164.508(a)(3)).
- Minimum necessary for uses, disclosures and requests, implemented as role-based access policies identifying persons/classes and the PHI categories each needs (164.502(b), 164.514(d)(2)).
- Right of access: act within 30 days, one 30-day extension, in the form and format requested if readily producible, reasonable cost-based fee only (164.524). Tennessee is stricter: 10 working days (see TN regime).
- Right to amend: act within 60 days, one 30-day extension; amendments must be linked to the record; corrections by addendum, never overwrite (164.526).
- Accounting of disclosures: 6-year history, respond within 60 days; TPO disclosures excluded but the product should log all disclosures and filter (164.528).
- Right to request restrictions — MUST honor a restriction on disclosure to a health plan when the patient paid out of pocket in full (164.522(a)(1)(vi)); the claims engine must refuse to bill a self-pay-restricted procedure.
- Confidential communications by alternative means/locations (164.522(b)) — per-patient channel preferences in messaging.
- Personal representatives and minors (164.502(g)), verification of identity (164.514(h)), decedents protected 50 years (164.502(f)).
- De-identification (164.514(a)-(c)) and limited data sets with a DUA (164.514(e)) for analytics, training corpora and any non-BAA destination.
- Notice of Privacy Practices support for practices (164.520), including the Part 2 language required since Feb 16, 2026.
- Administrative requirements the practice must meet and the product must evidence: privacy official, training, sanctions, complaints, mitigation, 6-year documentation retention (164.530).
- **citation**: 45 CFR 160.103; 164.502; 164.504(e); 164.508; 164.514; 164.520-164.530

### Item 2
- **regime**: HIPAA Security Rule (45 CFR Part 164 Subpart C) — current text plus the pending January 2025 NPRM
**applies because**

The vendor holds ePHI for many covered entities and is directly liable as a BA for every Security Rule standard (164.302-164.318). The NPRM published Jan 6, 2025 (comments closed Mar 7, 2025; ~4,745 comments; final rule now targeted for July 2027 on the OMB agenda and heavily contested) would remove the required/addressable distinction and mandate MFA, encryption at rest and in transit, asset inventory and network map (reviewed every 12 months), 72-hour restoration, 48-hour RPO, monthly backup/restore testing, vulnerability scans every 6 months, annual penetration testing, annual compliance audits, 15/30-day patching, 24-hour contingency-activation notice to CEs and annual written verification of each BA's safeguards. Because the design already commits to most of these, build to the NPRM now and treat the current rule as the floor.


#### key obligations
- Accurate and thorough risk analysis of the product itself, documented, updated at least annually and on material change (164.308(a)(1)(ii)(A)) — OCR's Risk Analysis Initiative (12+ actions incl. MMG Fusion, a dental PMS vendor, Mar 2026) makes this the single most-enforced item.
- Risk management plan with tracked remediation (164.308(a)(1)(ii)(B)); sanctions policy (C); information system activity review of audit logs, access reports and incident reports (D).
- Assigned security official (164.308(a)(2)); workforce security and termination procedures (a)(3); information access management (a)(4); security awareness and training incl. log-in monitoring and password management (a)(5).
- Security incident procedures (a)(6); contingency plan — data backup, disaster recovery, emergency mode operation, testing/revision, application and data criticality analysis (a)(7); periodic technical and non-technical evaluation (a)(8).
- BA contracts with every subcontractor that touches ePHI (164.308(b), 164.314(a), 164.504(e)(5)).
- Physical safeguards adapted to cloud: facility access via the hosting BAA, workstation use/security guidance for practices, device and media controls incl. disposal and re-use of storage (164.310).
- Technical safeguards: unique user identification (required), emergency access procedure (required), automatic logoff, encryption/decryption (164.312(a)); audit controls (b, required); integrity controls (c); person or entity authentication (d); transmission security (e).
- Policies, procedures and documentation retained 6 years from creation or last effective date, available to the workforce, reviewed and updated (164.316).
- **citation**: 45 CFR 164.302-164.318; 90 Fed. Reg. 898 (Jan 6, 2025) NPRM RIN 0945-AA22

### Item 3
- **regime**: HIPAA Breach Notification Rule (45 CFR Part 164 Subpart D) and HITECH Act (Pub. L. 111-5, Title XIII) incl. the 2021 HITECH amendment (Pub. L. 116-321)
**applies because**

As a BA the vendor must discover, risk-assess and report breaches of unsecured PHI to each affected covered entity; each practice must notify individuals, HHS and (over 500 per state) media. HITECH made BAs directly liable for Security Rule and specified Privacy Rule violations, authorized state attorneys general to enforce HIPAA, and set the four penalty tiers (inflation-adjusted annually — for penalties assessed on or after Jan 28, 2026: Tier 1 $145-$73,011 per violation, Tier 4 $73,011-$2,190,294, annual cap $2,190,294 per identical provision, with OCR enforcement discretion applying lower caps for Tiers 1-3). The 2021 amendment requires OCR to consider whether 'recognized security practices' (NIST CSF or HHS 405(d) HICP) were in place for the prior 12 months when deciding fines and audit outcomes.


#### key obligations
- Breach presumption unless a documented 4-factor low-probability-of-compromise assessment says otherwise (164.402); encryption consistent with HHS guidance (NIST SP 800-111 at rest, TLS per SP 800-52) renders PHI 'secured' and outside notification — the encryption program is therefore also the breach-liability program.
- BA to CE: without unreasonable delay and no later than 60 calendar days after discovery (164.410); the BAA will shorten this (recommend 5 business days contractual) and require content sufficient for the CE to notify.
- CE to individuals: no later than 60 calendar days after discovery, written first-class mail or agreed email, substitute notice (web posting 90 days or major media plus toll-free number) when 10+ addresses are stale (164.404).
- Media notice to prominent outlets when more than 500 residents of a state/jurisdiction are affected (164.406).
- HHS: 500+ individuals contemporaneously with individual notice (within 60 days); fewer than 500 logged and reported within 60 days after the end of the calendar year (164.408).
- Law-enforcement delay (164.412); burden of proof on the regulated entity to show all notifications were made or the incident was not a breach (164.414) — the incident record must be evidentiary.
- Maintain 'recognized security practices' evidence continuously for 12 months so it is available as a mitigating factor.
- **citation**: 45 CFR 164.400-164.414; 42 U.S.C. 17931-17940 (HITECH 13401-13410); Pub. L. 116-321 (Jan 5, 2021); 45 CFR 102.3 (penalty table); 91 Fed. Reg. (Jan 28, 2026 inflation adjustment)

### Item 4
- **regime**: HIPAA Administrative Simplification transaction and code set standards (45 CFR Part 162) via the clearinghouse relationship
**applies because**

Every 837D, 835, 270/271, 276/277 the product assembles or ingests must be an ASC X12 005010 standard transaction with CDT codes (the adopted dental code set). The clearinghouse is itself a covered entity (health care clearinghouse) AND a BA when acting for the practice. The vendor must avoid becoming a 'health care clearinghouse' by contract and architecture (it enables the practice to create standard transactions; it does not receive nonstandard data from other entities and convert it as a service to them). Change Healthcare (a candidate vendor in the design) suffered the largest health data breach ever recorded (192.7 million individuals, Feb 2024) — clearinghouse selection is a due-diligence question, not only a commercial one.


#### key obligations
- Produce and consume only compliant X12 5010 transactions; freeze submitted 837 bytes for the record (design already does).
- Execute BAA plus the clearinghouse's provider-enrollment and EDI agreements; track per-payer enrollment (design has edi_enrollments).
- Vendor due diligence on the clearinghouse (SOC 2 Type II, HITRUST, breach history, incident notification terms, contingent BI insurance).
- CDT is an ADA-copyrighted code set — license per tenant, never redistribute (design already states this).
- **citation**: 45 CFR 162.100-162.1902; 45 CFR 160.103 (health care clearinghouse); ASC X12N 005010X224A2 (837D), 005010X221A1 (835), 005010X279A1 (270/271)

### Item 5
- **regime**: FTC Act Section 5 and the FTC Health Breach Notification Rule (16 CFR Part 318, as amended effective July 29, 2024)
**applies because**

Section 5 (unfair or deceptive practices) applies to every public security or privacy claim the vendor makes — the FTC's Jan 2016 Henry Schein / Dentrix G5 order ($250,000) was for calling a data-camouflage feature 'encryption' that met HIPAA — hence the design rule 'never claim HIPAA compliant'. The HBNR reaches vendors of personal health records and PHR-related entities NOT covered by HIPAA. The patient portal offered on behalf of practices under a BAA is a HIPAA function and therefore outside the HBNR; a direct-to-consumer app or any consumer-facing product not offered as a BA would fall inside it (60-day individual notice; FTC notice at the same time for 500+; media for 500+ residents of a state; under-500 annual log within 60 days after year end).


#### key obligations
- No unsubstantiated security/privacy claims in marketing, sales decks, trust page or in-product copy; substantiate every attestation reference (SOC 2 report date, pen-test date).
- Keep the portal and any patient app strictly inside the BA relationship (practice is the offeror) to stay out of the HBNR; record this determination in an ADR.
- If a consumer-facing product is ever launched, implement HBNR clocks and the FTC notification form.
- **citation**: 15 U.S.C. 45; 16 CFR Part 318 (89 Fed. Reg. 47028, May 30, 2024); In re Henry Schein Practice Solutions, FTC File No. 142-3161 (2016)

### Item 6
- **regime**: Tennessee Identity Theft Deterrence Act breach statute (Tenn. Code Ann. 47-18-2107) and Tennessee data-breach class action safe harbor (Public Chapter 991 (2024), Tenn. Code Ann. 29-34-215)
**applies because**

Practices and the vendor hold Tennessee residents' personal information (SSN, driver's license, financial account data collected for payment plans). 47-18-2107 requires notice to affected residents without unreasonable delay and no later than 45 days from discovery, notice to consumer reporting agencies when more than 1,000 persons are notified at once, and provides an encryption safe harbor; an information holder subject to HIPAA/HITECH is deemed compliant if it complies with HIPAA's notice provisions. Because the deemed-compliance clause depends on HIPAA applicability to the specific data and a plaintiff will argue the 45-day clock, adopt 45 days as the internal SLA for every incident. PC 991 bars class-action liability for a cybersecurity event absent willful/wanton misconduct or gross negligence (events after May 21, 2024) — documented, tested controls are what defeat a gross-negligence pleading.


#### key obligations
- Incident clock defaults to 45 days for individuals regardless of the HIPAA deemed-compliance argument; CRA notice when over 1,000 Tennesseans.
- Encrypt SSNs, member IDs, bank identifiers and card tokens (field-level) so the statutory encryption safe harbor is available.
- Preserve the evidence pack (SRA, remediation log, restore drills, pen tests) that supports a no-gross-negligence defense under 29-34-215.
- **citation**: Tenn. Code Ann. 47-18-2107(a)-(h) (as amended 2016-2017); Tenn. Code Ann. 29-34-215 (Pub. Ch. 991, eff. May 21, 2024)

### Item 7
- **regime**: Tennessee Board of Dentistry rules (Tenn. Comp. R. & Regs. 0460) and Tennessee medical-records statutes (Tenn. Code Ann. 63-2-101, 63-2-102)
**applies because**

The product IS the dental record for Tennessee licensees. Rule 0460-02-.12 sets minimum record content, addendum-only correction, retention (adults 7 years after last contact; minors — the Board rule and the Department of Health Standards of Practice Manual state different floors, so the product takes the longer: 1 year past majority or 10 years after last contact, whichever is longer; incompetent patients indefinitely) and confidential destruction with a destruction log. Rule 0460-01-.12 lists false or inconsistent record entries and unauthorized disclosure as unprofessional conduct. Rule 0460-01-.16 patient rights include record access. Rule 0460-01-.11 requires sterilizer biological-monitoring documentation kept 2 years; 0460-02-.10 requires advertising copies kept 2 years. Tenn. Code Ann. 63-2-101 requires a copy of the record within 10 working days of a written request (a summary does not satisfy the HIPAA right of access), and 63-2-102 caps fees (electronic: $25 for 10 pages or fewer, $0.25 per page thereafter, cap $90 — verify current figures); records become free if the 10-day deadline is missed and the Board may discipline. The repo's supervision engine also encodes 'Public Chapter 1107 (2026), effective 2027-01-01' (new-patient hygiene requires a dentist who has seen the patient); this could not be verified externally because the TN publications site is blocked from this environment — verify at capitol.tn.gov before shipping the scheduler rule.


#### key obligations
- Retention clocks per patient computed from last contact and DOB with the longer-wins rule; legal hold; destruction only via logged procedure (design has retention_until, retention_holds, destruction_log).
- Addendum-only correction for filed notes (note_amendments), never overwrite — this is both 0460-02-.12 and 164.526.
- Records-request workflow with a 10-working-day SLA and fee calculator capped per 63-2-102; full-record export, not summary.
- Sterilizer/biological monitoring logs with 2-year retention in the OSHA/compliance module.
- Never withhold records for unpaid fees (0460-02-.12) — the records-request flow must not be gated on balance.
- Jurisdiction parameterization so each of these is a Tennessee rule-pack value, not a literal.
- **citation**: Tenn. Comp. R. & Regs. 0460-01-.11, 0460-01-.12, 0460-01-.16, 0460-02-.10, 0460-02-.12; Tenn. Code Ann. 63-2-101, 63-2-102; Tenn. Code Ann. 63-5-108, 63-5-115; Public Chapter 1107 (2026) [unverified]

### Item 8
- **regime**: Tennessee controlled-substance law (CSMD check, Tenn. Code Ann. 53-10-310/311; electronic prescribing of controlled substances)
**applies because**

Phase 5 ePrescribing. Tennessee requires a CSMD check before prescribing an opioid or benzodiazepine (and other substances designated by rule) at the start of a new episode of treatment, before each new prescription in the first 90 days, and every 6 months thereafter while treatment continues; practice sites must provide electronic CSMD access. Tennessee also mandates electronic prescribing of controlled substances with limited exemptions (effective date and exemptions to be verified). The product documents the check (csmd_checked_at) and flags; it never selects drug or dose.


#### key obligations
- Capture CSMD check timestamp and result reference on every controlled-substance prescription; block eRx send when a required check is missing (flag, per the design's 'flags, never prescribes' rule).
- Route eRx/EPCS through a certified vendor (DoseSpot/DrFirst) under BAA; identity proofing per DEA EPCS rules (21 CFR 1311).
- **citation**: Tenn. Code Ann. 53-10-310(e), 53-10-311; Tenn. Comp. R. & Regs. 1140-11 / 1145-01; Tenn. Code Ann. 53-11-308 (e-prescribing mandate) [verify]; 21 CFR Part 1311

### Item 9
- **regime**: 42 CFR Part 2 (Confidentiality of Substance Use Disorder Patient Records) — largely NOT applicable, with one product implication
**applies because**

Part 2 applies to 'Part 2 programs' — federally assisted programs that hold themselves out as providing SUD diagnosis, treatment or referral. A general dental practice is not a Part 2 program, and a patient's self-reported SUD history in a dental medical history is ordinary PHI, not a Part 2 record. Two things still apply: (1) the Feb 16, 2024 final rule (effective Apr 16, 2024, compliance date Feb 16, 2026) requires every HIPAA covered entity's Notice of Privacy Practices to include Part 2 language — the practice NPP templates in the compliance module must include it; (2) if a practice receives a Part 2 record from a program (e.g., a methadone clinic's letter), redisclosure rules attach, so documents should be taggable as 'received Part 2 record' with the redisclosure notice preserved.


#### key obligations
- NPP template includes the Part 2 provisions (compliance date already passed: Feb 16, 2026).
- Document tag for received Part 2 records; exclude tagged documents from bulk export/AI/marketing paths.
- **citation**: 42 CFR Part 2 (89 Fed. Reg. 12472, Feb 16, 2024); 42 CFR 2.11, 2.12; 45 CFR 164.520(b)(1)(ii)

### Item 10
- **regime**: 21st Century Cures Act Information Blocking (45 CFR Part 171) and ONC Health IT Certification (45 CFR Part 170)
**applies because**

Each practice is an 'actor' (health care provider — the PHSA definition reaches dentists; ADA guidance confirms dentists are covered regardless of certified-product use or program participation). The VENDOR is an actor only if it is a 'health IT developer of certified health IT' — i.e., offers at least one ONC-certified module. If the owner records 'no certification' (the design's default), the vendor is not directly subject to information-blocking penalties (up to $1M per violation for developers), but every export fee, delay or format restriction the vendor imposes can make its customers information blockers (EHI = ePHI in the designated record set since Oct 6, 2022). Provider disincentives finalized June 2024 apply only to Medicare PI/MIPS/MSSP participants — few dentists — but OIG investigations and referrals remain possible. Certification would additionally bring HTI-1 obligations (decision-support transparency, real-world testing, Insights reporting) and annual attestations; note ONC is now ASTP/ONC and HTI-4/HTI-5 (2025-2026) changed certification criteria and timelines — verify before deciding.


#### key obligations
- No-fee, prompt, self-service export in a machine-readable format and DICOM — the design's exit terms are the practices' information-blocking compliance.
- Document the Part 171 exceptions the product relies on (privacy, security, infeasibility, content/manner) in the API and export policies.
- Record the ONC-certification decision (ADR) before API v1 is published; if 'no', do not describe the product as 'certified' or 'ONC' anywhere.
- **citation**: 42 U.S.C. 300jj-52; 45 CFR 171.102-171.303; 45 CFR Part 170 (HTI-1, 89 Fed. Reg. 1192; HTI-4/HTI-5 [verify]); 89 Fed. Reg. 54662 (June 2024 provider disincentives); 45 CFR 1003.1400 (developer CMPs)

### Item 11
- **regime**: PCI DSS v4.0.1 (mandatory since March 31, 2025) — scope minimized to SAQ A
**applies because**

Practices accept cards for patient payments; the vendor integrates a processor. If the vendor never touches PAN (hosted fields or iframe from a PCI-compliant processor, tokens only, settlement imports without PAN), each practice's merchant scope is SAQ A and the vendor's scope is limited to the eligibility criterion added in SAQ A r1 (effective Mar 31, 2025): a merchant embedding a hosted payment form in an iframe must confirm its page is not susceptible to script attacks (techniques such as Requirements 6.4.3 script inventory/authorization and 11.6.1 change-and-tamper detection, or CSP/SRI). The design's nonce-based CSP plan satisfies this. Separately, HIPAA section 1179 exempts financial institutions' payment processing from HIPAA, so the processor is not a BA provided no PHI beyond what is needed to move money (no procedure descriptions, no diagnoses) is sent.


#### key obligations
- Never receive, store or log PAN, CVV or full track data; store processor token, brand and last4 only; refunds by token.
- Provide practices an SAQ A assist page (which criteria the product satisfies) and confirm the iframe script-attack criterion via CSP/SRI plus a script inventory.
- Vendor contractual position: not in cardholder data environment; obtain the processor's AOC annually; if the vendor ever becomes a payment facilitator or ISV with card-data access it moves to SAQ D-Service Provider / ROC.
- Keep payment metadata sent to the processor PHI-free (section 1179 exemption).
- **citation**: PCI DSS v4.0.1 (June 2024); PCI SSC SAQ A r1 (Jan 2025 bulletin/FAQ); PCI DSS Requirements 6.4.3, 11.6.1; Social Security Act 1179 (42 U.S.C. 1320d-8); HHS 2002 Privacy Rule preamble on payment processing

### Item 12
- **regime**: OSHA — Bloodborne Pathogens (29 CFR 1910.1030), Hazard Communication, recordkeeping — practice-side content in the compliance module
**applies because**

The compliance module ships OSHA logs and training for practices (Phase 4). Dental offices must maintain an exposure control plan reviewed annually, annual BBP training with records kept 3 years, employee medical/exposure records for duration of employment plus 30 years, hepatitis B vaccination records, and sharps-injury logs where 29 CFR 1904 recordkeeping applies (offices of dentists are partially exempt from routine 300 logs; OSHA still encourages a sharps log). The vendor itself has no OSHA exposure program.


#### key obligations
- Training completion records with 3-year retention; exposure control plan versioning with annual review date; sharps/exposure incident log; sterilizer monitoring (TN 2 years).
- Employee medical records are PHI-adjacent employee records — separate access role from patient PHI.
- **citation**: 29 CFR 1910.1030(f),(g),(h); 29 CFR 1904.2 and Appendix A (partially exempt industries incl. NAICS 6212); 29 CFR 1910.1020

### Item 13
- **regime**: Telephone Consumer Protection Act and FCC healthcare exemptions (47 U.S.C. 227; 47 CFR 64.1200) — patient communications
**applies because**

Phase 4-5 reminders, recall and two-way texting. The FCC's 2015 order exempts certain non-telemarketing 'health care messages' by HIPAA covered entities from prior-express-consent requirements when sent to the number the patient provided, free to the recipient, with opt-out, limited frequency and length; marketing texts require prior express written consent. HIPAA still governs content (minimum necessary in an SMS; no diagnoses in a reminder).


#### key obligations
- Per-patient SMS/email consent records with channel, scope (treatment vs marketing), timestamp and source; honor STOP within the message stream; content templates that carry no clinical detail.
- Every send is a disclosure row (design already requires).
- **citation**: 47 U.S.C. 227; 47 CFR 64.1200(a)(9); FCC 15-72 (July 10, 2015) Declaratory Ruling and Order, paras. 143-148

### Item 14
- **regime**: Multi-state law (breach statutes, medical-records statutes, dental board retention rules, health-privacy statutes such as Texas HB 300) — applies as soon as any tenant or patient is outside Tennessee
**applies because**

Breach statutes are keyed to the residence of the individual, not the practice: five states impose 30-day individual notice (Colorado, Florida, Maine, Rhode Island, Washington), many require AG notice at thresholds of 500 or 1,000, and some (e.g., Texas HB 300 / Tex. Health & Safety Code ch. 181) define 'covered entity' broadly enough to reach a vendor that merely possesses PHI of Texas residents and impose their own training and access-time rules. Dental-record retention and copy-fee rules differ by state board. A Tennessee practice will see out-of-state patients, so the incident engine must compute clocks per affected individual's state from day one even while the product is sold only in Tennessee.


#### key obligations
- Incident module computes per-state deadlines from patients' state of residence; jurisdiction pack per state for retention, copy fees and access time.
- Record 'Tennessee-only sales' as a deliberate limitation on the trust page; commission per-state legal research before any non-TN tenant.
- **citation**: Colo. Rev. Stat. 6-1-716; Fla. Stat. 501.171; Me. Rev. Stat. tit. 10, 1348; R.I. Gen. Laws 11-49.3-4; Wash. Rev. Code 19.255.010; Tex. Health & Safety Code 181.001, 181.101, 181.102, 181.154; Tex. Bus. & Com. Code 521.053

### Item 15
- **regime**: Tennessee Information Protection Act (Tenn. Code Ann. 47-18-3201 et seq., effective July 1, 2025) — likely not applicable at launch
**applies because**

TIPA applies only to controllers with over $25M revenue that control/process personal information of 175,000+ consumers (or 25,000+ with over 50% revenue from sale). HIPAA covered entities and business associates, and PHI, are exempt. The vendor will be below the thresholds for years and its PHI is exempt; non-PHI marketing/web analytics data could come into scope at DSO scale. Its NIST Privacy Framework affirmative defense is a useful template regardless.


#### key obligations
- Re-check thresholds annually; keep marketing analytics minimal and cookie-consented; adopt a written privacy program mapped to the NIST Privacy Framework.
- **citation**: Tenn. Code Ann. 47-18-3201 to 47-18-3213 (Pub. Ch. 408 (2023))

### Item 16
- **regime**: OCR HIPAA Audit Program and HHS enforcement posture
**applies because**

OCR's audit protocol (2018 revision; Privacy, Security and Breach modules, ~180 requirements) is the checklist OCR uses; OIG's November 2024 report found the 2016-17 audits assessed only 8 of 180 requirements and recommended a stronger program, and OCR launched a new round in late December 2024 covering 50 covered entities and business associates focused on Security Rule provisions relevant to hacking and ransomware. OCR's Risk Analysis Initiative (11+ actions through 2025-2026) and Right of Access Initiative (50+ settlements) are the two enforcement lines most relevant to a dental PMS and its customers. The vendor, as a BA, is directly auditable.


#### key obligations
- Maintain an audit-protocol-mapped evidence binder (policy, procedure, evidence artifact, owner, last-reviewed) and an OCR data-request response runbook (10-business-day response window is typical for document requests).
- Treat every practice's right-of-access request as an enforcement-grade event (TN 10 working days).
- **citation**: HHS OCR Audit Protocol (updated 2018); HHS-OIG Report A-18-21-08014 (Nov 2024); OCR 2024-2025 HIPAA Audits announcement (Dec 2024); OCR Risk Analysis Initiative actions 2024-2026 (incl. MMG Fusion, Mar 5, 2026)

### Item 17
- **regime**: Contract and attestation regimes that function as de facto requirements: SOC 2 (AICPA TSC), HITRUST CSF, cyber insurance, ADA CDT license, Tennessee Rules of Professional Conduct 5.7 (owner is an attorney)
**applies because**

Not law, but they set what buyers, carriers and DSOs will demand. SOC 2 Type II needs a minimum 3-month (typically 6-12 month) observation window so it cannot exist at Phase 1; HITRUST e1/i1 are one-year certifications DSOs and payers increasingly require. Cyber carriers in 2026 condition coverage on MFA everywhere, EDR, immutable tested backups, a written IR plan and training, and deny claims for misrepresentation on the application. Because the owner is a Tennessee attorney, a company he owns that generates 'tailored policies' and 'Tennessee law reference' for customers implicates Tenn. Sup. Ct. R. 8, RPC 5.7 (law-related services) and the unauthorized-practice line — the compliance module's content must be reviewed for how it is labeled and who is the provider of record.


#### key obligations
- Engage SOC 2 auditor in Phase 2 for a Type I then Type II; consider HITRUST e1 in year 2 if a group customer requires it.
- Carry technology E&O plus cyber (first- and third-party, regulatory defense, contingent business interruption) and require practices and subprocessors to carry their own.
- Written opinion on RPC 5.7 exposure and disclaimer language for generated policies before the compliance module is sold.
- **citation**: AICPA TSP Section 100 (2017, rev. 2022); HITRUST CSF v11 assessment portfolio (e1, i1, r2); Tenn. Sup. Ct. R. 8, RPC 5.5 and 5.7; ADA CDT copyright license terms

## Control mapping


### Item 1
- **requirement**: Business associate agreement with every covered entity; subcontractor BAAs with every downstream processor; no PHI flows before the agreement exists
- **citation**: 45 CFR 164.502(e), 164.504(e), 164.308(b), 164.314(a)
- **control**: Countersigned BAA as a gating record for both tenants and connectors
**implementation in product**

tenants.baa_signed_at NOT NULL before the tenant can hold a patient row (setup wizard step with e-signature capture); integration_registry.enabled REQUIRES a live baas row (design already has this); public subprocessor list rendered from the same table; BAA templates in two directions (vendor-as-BA to practices; vendor-as-CE-proxy to subcontractors) with clauses shortening breach notice to 5 business days and contingency-activation notice to 24 hours

- **priority**: Phase 0
- **reuse from**: business_associates/baas/integration_registry from the design; timingSafeEqualStr for webhook secrets from /home/user/catcorner22/dental/src/app/api/law-watch/alert/route.ts

### Item 2
- **requirement**: Minimum necessary through role-based access that names persons/classes and PHI categories
- **citation**: 45 CFR 164.502(b), 164.514(d)(2)-(3)
- **control**: Three-axis authorization (admin rank, clinical licence, financial entitlement) plus location scope and phiRead purpose, default-deny
- **implementation in product**: withGuard(requireAccess{tenant,minRank,entitlements,clinicalScope,locationScope,phiRead}) on every route and server action; CI route-glob test; RLS with SET LOCAL app.tenant_id; restricted-patient flag requiring break-glass; report/export authorization mirrors the screen
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/guards.ts, roles.ts (MANAGE_CEILING), clinicalRoles.ts, freshUser.ts; export pattern from /home/user/catcorner22/dental/src/app/api/export/[table]/route.ts; entitlement enum from /home/user/catcorner22/precog/src/lib/precog/sod/conflict-rules.ts

### Item 3
- **requirement**: Unique user identification (required) and person/entity authentication
- **citation**: 45 CFR 164.312(a)(2)(i), 164.312(d)
- **control**: No shared logins; mandatory TOTP with hashed recovery codes; shared-device author switch that kills the session
- **implementation in product**: users unique per person per tenant; mfa_enabled forced at first login; recovery codes hashed; device_profile operatory with PIN author switch wiping local state; login failure copy byte-identical (no-oracle)
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/{auth.ts,totp.ts,password.ts,throttle.ts,hashGate.ts,clientIp.ts}; e2e/mfa.totp.mjs, lockout.mjs; retire mfaFeature.ts

### Item 4
- **requirement**: Emergency access procedure (required) that is itself controlled and audited
- **citation**: 45 CFR 164.312(a)(2)(ii); 164.308(a)(7)(ii)(C)
- **control**: Two-admin dual-control recovery ceremony and break-glass read with justification
- **implementation in product**: Replace ADMIN_PASSWORD_RESET env break-glass with a two-admin ceremony (distinct approver, time-boxed, audit row, owner notified); break_glass entitlement writes phi_access_log.purpose=break_glass with isValidPhiAttestation-validated justification and pages the owner
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/app/api/admin/users/[id]/mfa-reset/route.ts (second-person-by-construction pattern); /home/user/catcorner22/dental/src/lib/audit/attestation.ts

### Item 5
- **requirement**: Automatic logoff (addressable — implement) and session governance fit for shared operatory devices
- **citation**: 45 CFR 164.312(a)(2)(iii)
- **control**: Server-enforced idle and absolute timeouts; active-session list; per-device revoke
- **implementation in product**: sessions table (idle 10 min operatory / 30 min desk, 12 h absolute, revoked_at), watermark retained as second layer; SharedTabletIdleLock becomes server-enforced; deactivation kills session on next request
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/sessionWatermark.ts; /home/user/catcorner22/dental/src/app/api/me/sessions/route.ts; SharedTabletIdleLock.tsx (rebuilt)

### Item 6
- **requirement**: Audit controls and information system activity review; tamper-evident logs retained 6 years
- **citation**: 45 CFR 164.312(b), 164.308(a)(1)(ii)(D), 164.316(b)(2)
- **control**: Hash-chained, INSERT-only domain_event and phi_access_log with nightly verification, Object Lock head, and a monthly attested log review
- **implementation in product**: app_append role with UPDATE/DELETE revoked + BEFORE triggers; per-tenant HMAC chain; audit_chain_checks job writes its own row; daily head to S3 Object Lock; monthly 'log review' compliance_task producing an attested row; 6-year partitions with legal hold; plain-sentence renderer
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/auditLog.ts (single write point, caps, frozen actor); /home/user/catcorner22/dental/src/lib/byteaudit/** (sealed verifier retargeted)

### Item 7
- **requirement**: Log every access to ePHI (who viewed which patient), not only writes — this is the control that detects insider snooping and supports the accounting/investigation duties
- **citation**: 45 CFR 164.312(b), 164.308(a)(1)(ii)(D), 164.528
- **control**: phi_access_log written by withGuard when phiRead names records, with purpose enum
- **implementation in product**: Partitioned monthly; purpose treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms; owner/compliance view with routine reads filtered by default; volume anomaly detector (mass-read, after-hours) feeds control_findings
- **priority**: Phase 0
- **reuse from**: pattern from /home/user/catcorner22/dental/src/app/api/assist/route.ts (one parseable row per call)

### Item 8
- **requirement**: Accounting of disclosures (6 years, respond within 60 days) and disclosure accounting for print/fax/export/portal/SMS/AI
- **citation**: 45 CFR 164.528
- **control**: disclosures table populated by every egress path; per-patient accounting report
- **implementation in product**: Every print, export, fax, SMS, email, portal send and AI call inserts a disclosures row (recipient, purpose, records, actor frozen); non-TPO disclosures flagged for the statutory accounting; patient-facing 'accounting of disclosures' export with 60-day task clock
- **priority**: Phase 2 (egress paths exist) with schema in Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/email/threading.ts; email/config.ts single-configured-egress principle → destination allowlist

### Item 9
- **requirement**: Right of access — HIPAA 30 days; Tennessee 10 working days; full record, requested format, capped fee; no withholding for unpaid balance
- **citation**: 45 CFR 164.524; Tenn. Code Ann. 63-2-101, 63-2-102; Tenn. Comp. R. & Regs. 0460-02-.12
- **control**: records_requests workflow with SLA clock, fee calculator and full-record export bundle
- **implementation in product**: records_requests(received_at, due_at = +10 working days TN, hipaa_due_at = +30 days, fulfilled_at, export_bundle_id); bundle = notes, chart, perio, images/DICOM, ledger, claims, consents; fee capped per 63-2-102 and zeroed if late; owner home shows overdue requests; drill in Phase 4 exit criteria
- **priority**: Phase 3
- **reuse from**: /home/user/catcorner22/dental/src/lib/export/csv.ts; readbackClass for confirm-before-send

### Item 10
- **requirement**: Right to amend — addendum-only, linked to the original, 60-day response
- **citation**: 45 CFR 164.526; Tenn. Comp. R. & Regs. 0460-02-.12 (addendum-only correction)
- **control**: Immutable filed notes with note_amendments chain and patient-requested amendment workflow
- **implementation in product**: clinical_notes_filed immutable by role + trigger; note_amendments(amends_note_id, reason_code incl. patient_request, author frozen); amendment request task with 60-day clock and written-denial template
- **priority**: Phase 3
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/repo/submissions.ts fileSubmissionAtomic; e2e/submission.immutability.mjs

### Item 11
- **requirement**: Restriction on disclosure to a health plan when paid out of pocket in full (mandatory), and confidential-communication preferences
- **citation**: 45 CFR 164.522(a)(1)(vi), 164.522(b)
- **control**: Self-pay-restricted flag on procedures blocks claim assembly; per-patient channel preferences enforced by the messaging gate
- **implementation in product**: procedures.self_pay_restricted → claim scrubber hard-blocks inclusion and ERA matching; statements to restricted procedures never mention insurance; patients.contact_preferences (channel, address) honored by every send path with a refusal reason when violated
- **priority**: Phase 2
- **reuse from**: scrubber_rules + preflight_findings from the design

### Item 12
- **requirement**: Personal representatives, minors, guardianship and consent capture
- **citation**: 45 CFR 164.502(g), 164.514(h); Tenn. Comp. R. & Regs. 0460-01-.16, 0460-01-.18
- **control**: patient_relationships with consent_scope; consents with consenting party and relationship; identity verification before release
- **implementation in product**: Guardian/responsible-party model drives portal access scope and records-release eligibility; two-identifier verification recorded on release; consent objects with decision, interpreter, scope clinical|marketing
- **priority**: Phase 1 (headers) / Phase 3 (consents)
- **reuse from**: consent enumeration from /home/user/catcorner22/dental/skill/references/tennessee-dental-law-summary.md

### Item 13
- **requirement**: Encryption of ePHI at rest and in transit (addressable today; mandatory under the NPRM) — also the breach safe harbor and the TN encryption safe harbor
- **citation**: 45 CFR 164.312(a)(2)(iv), 164.312(e)(2)(ii); HHS Guidance to Render Unsecured PHI Unusable (NIST SP 800-111, 800-52); Tenn. Code Ann. 47-18-2107
- **control**: TLS verify-full everywhere; provider-managed encryption for storage; KMS envelope encryption for high-risk fields with per-tenant data keys
- **implementation in product**: pinPostgresSslMode lifted verbatim; RDS/Neon storage encryption under BAA; S3 SSE-KMS; AES-GCM field encryption for mfa_secret, SSN, member IDs, bank identifiers, portal tokens; boot refuses without KMS key; cleartext names/DOB documented in the product SRA as a searchability decision with compensating controls
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/lib/db/postgresUrl.ts; /home/user/catcorner22/dental/src/lib/db/backend.ts (boot guard pattern)

### Item 14
- **requirement**: Device and media controls: no unencrypted ePHI on unmanaged endpoints; disposal and re-use
- **citation**: 45 CFR 164.310(d)
- **control**: Encrypted, session-bound local mirror disabled on shared devices; degraded-mode cache encrypted with a session-derived key; server-side wipe on logout/author switch
- **implementation in product**: draftBackup rebuilt with WebCrypto key derived from the server session, wiped on sign-out, disabled for device_profile=operatory; degraded read cache same; Phase 3 exit test: zero cleartext PHI on a shared device after logout
- **priority**: Phase 3
- **reuse from**: /home/user/catcorner22/dental/src/lib/client/draftBackup.ts (rebuilt), autosaveMachine.ts

### Item 15
- **requirement**: Security risk analysis of the product, risk management plan, evaluation; annual and on change
- **citation**: 45 CFR 164.308(a)(1)(ii)(A)-(B), 164.308(a)(8); NPRM annual compliance audit
- **control**: Vendor SRA maintained as a living document with an asset inventory, network map, threat/vulnerability register and remediation tracker
- **implementation in product**: Vendor-side: SRA repository (docs/compliance) with NIST SP 800-30 methodology, asset inventory generated from IaC, network map, risk register with owners/dates; reviewed each phase gate and annually; the practice-facing sra_questionnaires module (Phase 4) reuses the same schema
- **priority**: Phase 0 (first SRA before any PHI in Phase 1)
- **reuse from**: /home/user/catcorner22/dental/knowledge/sources/adversarial-it-hipaa-security.md and adversarial-privacy-hipaa-attorney-hate.md as threat inputs

### Item 16
- **requirement**: Workforce security, training and sanctions for the vendor's own staff and contractors
- **citation**: 45 CFR 164.308(a)(3), 164.308(a)(5), 164.308(a)(1)(ii)(C), 164.530(b),(e)
- **control**: Onboarding/offboarding checklist, annual HIPAA + security awareness training with records, written sanctions policy applied and logged
- **implementation in product**: Vendor staff are tenants of an internal 'vendor' tenant with the same training_completions and sanctions tables; production access requires completed training row; offboarding revokes SSO, KMS, DB and cloud roles within one hour with an audit row
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/src/app/api/training/complete/route.ts server-verified completion pattern

### Item 17
- **requirement**: Vendor support access to tenant PHI is a use that must be minimal, logged and justified
- **citation**: 45 CFR 164.502(b), 164.504(e)(2)(ii)(A); 164.312(b)
- **control**: Support impersonation only via tenant-owner-granted, time-boxed, purpose-stated access that writes phi_access_log and notifies the owner
- **implementation in product**: support_grants(tenant, granted_by owner, scope, expires_at ≤ 24h, reason); vendor staff act through the same withGuard path with actor tagged vendor_support; owner digest lists every support session
- **priority**: Phase 1
- **reuse from**: isCreatureOf/mutateAdminGuarded patterns from /home/user/catcorner22/dental/src/lib/db/repo/users.ts

### Item 18
- **requirement**: Contingency plan: backup, disaster recovery, emergency mode, testing, criticality analysis; NPRM 72-hour restore, 48-hour RPO, monthly restore test
- **citation**: 45 CFR 164.308(a)(7); NPRM 164.308(a)(13) proposed
- **control**: PITR + cross-region backups + scheduled restore drills that write their own audit row; documented RTO/RPO; degraded read-only mode
- **implementation in product**: pg-boss job restores last night's backup into an isolated environment weekly (Phase 0 exit) and monthly in production runbook; day-sheet and chain head to Object Lock daily; status page publishes incidents; failover runbook; criticality tiers documented (ledger/claims tier 1)
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/scripts/postgres-durability.sh (extend to restore drill); docs/GO-LIVE.md runbook shape

### Item 19
- **requirement**: Security incident procedures and breach notification clocks (BA→CE, CE→individuals/HHS/media, TN 45 days, other states, FTC where applicable)
- **citation**: 45 CFR 164.308(a)(6), 164.400-164.414; Tenn. Code Ann. 47-18-2107; 16 CFR 318
- **control**: incidents module with discovery timestamp, 4-factor risk assessment, per-jurisdiction deadline computation and evidence retention; vendor IR plan with named roles
- **implementation in product**: incidents(kind, discovered_at, risk_assessment jsonb, affected_individuals by state, tn_deadline=+45d, hipaa_individual=+60d, hhs_500=+60d, hhs_under_500=Mar 1 next year, media_by_state, cra_notice if >1000 TN, ba_to_ce contractual 5 business days); templates for notices; tabletop each quarter; law-enforcement delay record
- **priority**: Phase 1 (intake) / Phase 4 (full)
- **reuse from**: wishes.ts intake pattern; digest.ts batching for non-hard events

### Item 20
- **requirement**: Breach notification content and substitute notice mechanics; toll-free number for 90 days; website posting
- **citation**: 45 CFR 164.404(c)-(d)
- **control**: Notice templates and substitute-notice runbook with a pre-contracted mailing/call-center vendor
- **implementation in product**: Compliance module stores notice templates (what happened, PHI types, steps, what we are doing, contact) per tenant; runbook lists pre-vetted breach-response vendors under the cyber policy panel
- **priority**: Phase 4
- **reuse from**: none

### Item 21
- **requirement**: Information system activity review must include vendor/admin actions and export volumes; exports are the embezzlement and exfiltration question
- **citation**: 45 CFR 164.308(a)(1)(ii)(D), 164.312(b)
- **control**: Export metering and row counts; hard-event alerts on mass export, new device on financial role, after-hours refund
- **implementation in product**: export.performed events carry rendered row count; per-actor throttle namespaces; hard-event channel pages owner via BAA-covered email/SMS; weekly digest for the rest
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/src/lib/auth/throttle.ts key namespaces; export route row-count derivation

### Item 22
- **requirement**: Documentation retention: 6 years from creation or last effective date for policies, procedures, risk analyses, BAAs, training, sanctions, incident and breach records, access/accounting logs
- **citation**: 45 CFR 164.316(b)(2), 164.530(j)
- **control**: Versioned policies and compliance artifacts with effective/superseded dates and 6-year retention; clinical records on the longer TN clocks
- **implementation in product**: policies(version, effective_from, superseded_at) never deleted; compliance_logs, training_completions, baas retained ≥ 6 years after superseded; retention_policy table distinguishes HIPAA 6-year documentation from TN 7/10-year clinical clocks; destruction_log
- **priority**: Phase 0 (schema) / Phase 4 (UI)
- **reuse from**: practicePacks.ts maker-checker + event log for policy approval

### Item 23
- **requirement**: De-identification and minimum-necessary filtering before any AI, analytics, support or research egress; no training on PHI
- **citation**: 45 CFR 164.514(a)-(b), 164.502(b), 164.504(e)(2)(i); BAA no-training clause
- **control**: Field-level PHI gate plus redaction on every non-treatment egress; BAA-covered zero-retention or HIPAA-ready provider; per-call disclosure row
- **implementation in product**: phi.ts/phi-secondary.ts/maskPhi.ts demoted to egress classifier; learning/redact.ts on analytics/support paths; provider adapter enabled only with a baas row; per-call disclosure row with codes/versions/tokens, never content; deterministic twin for every AI feature
- **priority**: Phase 5 (AI) / Phase 1 (redactor on analytics)
- **reuse from**: /home/user/catcorner22/dental/src/lib/audit/rules/phi.ts, phi-secondary.ts, maskPhi.ts; src/lib/learning/redact.ts; src/lib/assist/**; docs/model-charter.md

### Item 24
- **requirement**: Web tracking technologies must not disclose PHI to analytics vendors; authenticated pages (portal) are squarely covered
- **citation**: HHS OCR Bulletin on Online Tracking Technologies (Dec 2022, rev. Mar 2024) as narrowed by AHA v. Becerra (N.D. Tex. June 20, 2024; appeal withdrawn Aug 2024)
- **control**: No third-party scripts on authenticated surfaces; first-party, PHI-free analytics on the marketing site; CSP connect-src 'self'
- **implementation in product**: CSP connect-src 'self' retained; portal and app have zero third-party tags; marketing site uses cookie-consented, IP-truncated analytics with no health-condition page combinations logged to vendors
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/next.config.mjs headers; e2e/headers.mjs

### Item 25
- **requirement**: PCI DSS SAQ A scope: never touch PAN; iframe script-attack eligibility criterion
- **citation**: PCI DSS v4.0.1; SAQ A r1 eligibility criteria; Requirements 6.4.3, 11.6.1
- **control**: Hosted fields/iframe tokenization; nonce-based CSP with SRI and script inventory; no PAN in logs, settlement imports or support tools
- **implementation in product**: Processor adapter returns token only; ledger tender stores brand/last4/processor_ref; CSP nonces when portal ships (Phase 4); annual processor AOC filed in vendors registry; practice-facing SAQ A assist page
- **priority**: Phase 1
- **reuse from**: CSP block in next.config.mjs (nonce upgrade)

### Item 26
- **requirement**: Information blocking: practices must not be made to block; vendor must not create fees or delays that cause it
- **citation**: 45 CFR 171.103, 171.201-171.303
- **control**: No-fee self-service export incl. DICOM within a published SLA; documented Part 171 exceptions for API scoping
- **implementation in product**: export bundle job available to owner role at any time; published timeline; API and export policy documents cite the privacy/security/infeasibility exceptions relied on; ONC-certification ADR before API v1
- **priority**: Phase 2
- **reuse from**: Trust Page module; Data Migration/Exit module

### Item 27
- **requirement**: Business associate due diligence and annual verification of subprocessor safeguards (NPRM); notification of contingency activation within 24 hours
- **citation**: 45 CFR 164.308(b), 164.314(a); NPRM 164.308(b)(1) proposed written verification
- **control**: Subprocessor registry with BAA, SOC 2/HITRUST report date, breach history, annual review task, incident-notice terms
- **implementation in product**: business_associates rows for Postgres host, object storage, clearinghouse, processor, messaging, STT, model provider, bank aggregator (DPA, not BAA — bank data is not PHI), eRx vendor; compliance_task 'annual BA verification' per row; public subprocessor list generated from the registry
- **priority**: Phase 0
- **reuse from**: integration_registry gating from the design

### Item 28
- **requirement**: Notice of Privacy Practices and patient acknowledgement, including Part 2 language (compliance date Feb 16, 2026) and Tennessee patient-rights content
- **citation**: 45 CFR 164.520; 42 CFR Part 2 final rule (2024); Tenn. Comp. R. & Regs. 0460-01-.16
- **control**: Versioned NPP template per tenant with acknowledgement capture and posting
- **implementation in product**: policies table holds NPP versions; consents kind=npp_ack; portal displays current NPP; counsel-reviewed template with 'provisional' label until reviewed
- **priority**: Phase 4
- **reuse from**: /home/user/catcorner22/dental/src/lib/law/tn-law.ts content (jurisdiction-keyed)

### Item 29
- **requirement**: Sanctions and management-override transparency for the practice's own financial controls (COSO) — supports the Security Rule sanctions standard when the misconduct is PHI-related
- **citation**: 45 CFR 164.308(a)(1)(ii)(C); COSO ICIF 2013 Principle 10; ACFE/COSO Fraud Risk Management Guide (2023)
- **control**: Owner overrides and waived dual controls are logged, digested and scored; sanctions recorded as control_decisions
- **implementation in product**: control_exceptions with residual_note and expiry; approvals_log; weekly digest lists overrides; sanctions kind on control_decisions with evidence refs
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/precog/src/lib/precog/controls/dual-release.ts; practice-profile.ts DecisionEntry

### Item 30
- **requirement**: Secure SDLC evidence that OCR, auditors and carriers accept: change control, vulnerability management (NPRM 6-month scans, annual pen test, 15/30-day patching)
- **citation**: 45 CFR 164.308(a)(8), 164.312(c); NPRM 164.312 technical safeguards; SOC 2 CC7/CC8
- **control**: CI gates (tsc, vitest, e2e probes, secret scan, dependency audit, coverage floor, version stamps, guard-coverage test), quarterly scans, annual third-party pen test with findings tracked to closure
- **implementation in product**: .github/workflows/ci.yml extended; dependency audit and secret scan blocking; SBOM per release; pen test in Phase 4 exit; patch SLA documented and measured
- **priority**: Phase 0
- **reuse from**: /home/user/catcorner22/dental/.github/workflows/ci.yml version guards; e2e/*.mjs

### Item 31
- **requirement**: Honest public claims: no 'HIPAA compliant/certified' product adjective, no lawsuit-proof or board-proof, substantiated attestation statements
- **citation**: 15 U.S.C. 45; FTC v. Henry Schein Practice Solutions (2016); Tenn. Comp. R. & Regs. 0460-02-.10 (practice advertising)
- **control**: Marketing review checklist and trust-page content model that shows dated evidence (SOC 2 report date, pen-test date, BAA status) instead of adjectives
- **implementation in product**: Trust Page renders attestation status from records with dates; marketing copy checklist in docs; in-product copy never says 'compliant'
- **priority**: Phase 1
- **reuse from**: /home/user/catcorner22/dental/docs/brand.md voice rules

## Architecture

TRUST BOUNDARIES (legal view). Four boundaries, each with a named legal instrument. (1) Practice ↔ vendor: the vendor is a business associate of each tenant; the BAA (vendor form, countersigned in the setup wizard, stored in baas with signed_at and document_id) is the instrument, and no patient row may exist in a tenant until it does. Each location of a group is a location of one covered entity or of affiliated covered entities under a common-ownership designation (164.105(b)) — the organizations tier in Phase 5 must capture which, because it determines whether cross-location clinical grants are a use within one CE or a disclosure between CEs. (2) Vendor ↔ subprocessor: every downstream party that creates, receives, maintains or transmits PHI is a subcontractor BA (164.502(e)(1)(ii)); the registry gates enablement. Classification by vendor class: managed Postgres (AWS RDS via AWS Artifact BAA, or Neon — Neon signs a BAA and covers PITR/backups/branching but only on its Scale plan today with a disclosed future 15% surcharge; Free/Launch plans are not HIPAA-eligible), object storage (S3 under the AWS BAA), hosting (AWS Fargate under the AWS BAA; Fly.io will sign a pre-signed BAA on its $99/month compliance add-on and covers Machines and Managed Postgres — acceptable, but AWS keeps everything under one BAA and one audit report, which is why the recommendation is AWS for Phase 0), clearinghouse (a covered entity in its own right and a BA of the practice; select with breach-history due diligence — Change Healthcare's 192.7 million-record breach is the cautionary case), payment processor (NOT a BA under section 1179 provided only payment data crosses; keep procedure descriptions out of the processor payload), transactional email (Resend does not offer a BAA — keep it for non-PHI system mail only or replace; Twilio SendGrid requires the Twilio enterprise BAA process; Paubox or AWS SES under the AWS BAA are BAA-covered alternatives), SMS/voice (Twilio Programmable Messaging is HIPAA-eligible with a BAA on Security/Enterprise editions), STT and model providers (Anthropic offers a BAA for HIPAA-ready/zero-retention API configurations; AWS Bedrock and Azure OpenAI are covered under their platform BAAs; xAI/Grok signs none and is excluded), bank aggregator (Plaid does not sign BAAs and does not need to — bank transactions are the practice's financial records, not PHI, as long as the deposit-matching data sent to the aggregator never carries patient identifiers; execute a DPA and keep the integration read-only), eRx vendor (DoseSpot/DrFirst under BAA plus DEA EPCS). (3) Vendor ↔ patient (portal): the portal is offered by the practice through its BA — this keeps the FTC Health Breach Notification Rule out of scope and keeps the portal identity realm inside the covered entity's designated record set; record that determination in an ADR and never market a direct-to-consumer app without re-analysis. (4) Vendor ↔ regulator/auditor: OCR can audit the BA directly; SOC 2 and pen-test reports are produced for customers under NDA; the audit-protocol evidence binder lives in a compliance repository separate from product code.

TENANCY ISOLATION AS A LEGAL CONTROL. Shared database with tenant_id on every row and Postgres RLS keyed on current_setting('app.tenant_id'), connecting as a non-owner role, is the technical embodiment of the BAA promise that one covered entity's PHI is never used or disclosed for another's benefit. The Phase 0 RLS negative test (a deliberately missing WHERE cannot leak rows) is an audit artifact — keep its output. Per-tenant KMS data keys give a per-covered-entity cryptographic boundary and make termination-of-BAA deletion demonstrable (destroy the data key, log the destruction, retain what the BAA's return-or-destroy clause requires). UUIDv7 and per-tenant sequences prevent cross-tenant volume inference, which is itself a disclosure of business information.

NETWORK AND HOSTING. Single region with cross-region backups in Phases 0-2, two-region active/passive at Phase 4 GA, all inside the AWS BAA. WAF in front, no public database endpoint, workers in the same VPC, egress allowlisted to registered subprocessors so a new destination cannot be reached without a registry (and therefore BAA) row — this turns 'PHI leaves only through a named boundary' into a network fact. Production boots only with verify-full Postgres TLS, a KMS key, a backup target, object storage config and the append-only role present (extend resolveDbBackend); the refusal itself is logged.

KEY MANAGEMENT. AWS KMS customer-managed keys: one master per environment, per-tenant data keys wrapped by it, AES-GCM at the field level for mfa_secret, SSN, member IDs, bank identifiers and portal tokens; storage-level encryption for everything else; TLS 1.2+ (prefer 1.3) everywhere. Key rotation annually (KMS automatic) with envelope re-wrap; AUTH_SECRET dual-key rollover window; documented rotation runbook is a Phase 4 exit item. Names and DOB remain cleartext for search — a defensible choice under an addressable standard today and under the NPRM's encryption mandate only if the storage layer is encrypted, which it is; document the reasoning and compensating controls (RLS, access logging, MFA) in the product SRA because it is the first question an OCR investigator or plaintiff expert will ask.

SECRETS. A vault (AWS Secrets Manager) with rotation; no secrets in the repository (precog's committed PREVIEW_CLIENT_SECRET is rotated and its history not carried forward); secret scanning in CI; break-glass credentials replaced by the two-admin ceremony.

ENVIRONMENTS. Production (PHI), staging (synthetic data only — never a production restore unless de-identified under 164.514(b)), development (PGlite/synthetic). Restore drills into an isolated account that is itself under the BAA. The rule 'preview branches may not hold real clinical rows' from GO-LIVE.md becomes a boot guard.

DESIGNATED RECORD SET AND DATA CLASSIFICATION. Define the DRS in writing (patients, encounters, notes, chart, perio, imaging, treatment plans, ledger, claims, consents, documents, prescriptions); classify tables as PHI / PHI-adjacent (audit and access logs, disclosures) / practice-financial (bank, controls, scoring) / vendor-operational. The classification drives what the export bundle contains, what the accounting of disclosures covers, and what may reach analytics.

## Identity and access

Legal requirements mapped onto the design's identity spine. (1) Unique user identification (164.312(a)(2)(i), required) — no shared logins anywhere, including operatory tablets: the device profile with a PIN author switch that wipes local state and re-authenticates the person satisfies the requirement while fitting the workflow; a shared 'hygiene room' account would be a per-se violation and is refused at provisioning. (2) Person/entity authentication (164.312(d)) — mandatory TOTP for every role with hashed recovery codes; passkeys/WebAuthn as a Phase 4 enhancement; the no-oracle login copy and pair-keyed throttle carry forward as documented compensating controls for a practice behind one NAT. (3) Emergency access (164.312(a)(2)(ii), required) — two-admin dual-control recovery ceremony (distinct approver, time-boxed, audited, owner notified) replaces the environment-variable break-glass; a documented emergency-access procedure is an OCR audit-protocol line item, so write it as a policy with the ceremony as its implementation. (4) Automatic logoff (164.312(a)(2)(iii)) — server-enforced 10/30-minute idle and 12-hour absolute limits with per-device revocation; the client overlay is convenience only. (5) Workforce security and termination (164.308(a)(3)) — deactivation kills the session on the next request (fresh-row guard), grants are an append-only event log so a terminated user still holding entitlements is a finding, and SCIM deprovisioning at the group tier must revoke within one minute. (6) Information access management and minimum necessary (164.308(a)(4), 164.514(d)) — three orthogonal axes: administrative rank (roles.ts), clinical licence (clinicalRoles.ts, derived from Tennessee scope-of-practice rules), financial entitlement (Precog's 14 entitlements plus PMS additions), each enforced from a fresh database row inside withGuard with location scope and a phiRead purpose. Write the minimum-necessary policy the rule requires as the mapping from role templates to PHI categories, and generate it from role_templates so policy and code cannot drift. (7) Restricted patients and break-glass — VIP/employee/family records flagged restricted require a break_glass entitlement, a validated justification and write a phi_access_log row with purpose=break_glass that pages the owner; this is the 'treatment relationship' control the current repos lack. (8) Vendor access — support staff reach tenant PHI only through owner-granted, time-boxed support_grants, act through the same guard, and appear in the owner's digest; production database console access is separately logged and reviewed monthly. (9) Segregation of duties inside identity — the person who can reset a colleague's password cannot see one (MANAGE_CEILING), MFA reset refuses a self-target, and grant-time SoD detection over user_entitlements refuses critical conflicts without a recorded decision. (10) Portal identity is a separate realm with its own authentication, verification of identity per 164.514(h) at enrollment (two identifiers plus an out-of-band code), guardian/personal-representative scoping per 164.502(g), and no shared cookies with the staff realm. (11) Access reviews — quarterly recertification of every tenant's owner-level and financial-entitlement grants and of all vendor staff access, produced as an attested compliance_task; this is the evidence the audit protocol and SOC 2 CC6 both ask for.

## Encryption

Encryption is simultaneously a Security Rule safeguard (164.312(a)(2)(iv), (e)(2)(ii) — addressable today, proposed mandatory), the HIPAA breach safe harbor (PHI encrypted consistent with HHS guidance is not 'unsecured' and its loss is not reportable), and the Tennessee statutory safe harbor under 47-18-2107. Program: (a) In transit — TLS 1.2+ with verify-full to Postgres (pinPostgresSslMode lifted verbatim; it converts require/prefer/verify-ca to verify-full and appends verify-full to any non-loopback URL), HSTS with includeSubDomains, TLS to every subprocessor, SFTP/AS2 or TLS to the clearinghouse per its spec, no unencrypted email containing PHI except a patient's documented election under 164.522(b) guidance. (b) At rest — provider storage encryption under the BAA for the database, backups, PITR and object storage (SSE-KMS); field-level AES-256-GCM envelope encryption with per-tenant KMS data keys for mfa_secret, SSN, insurance member IDs, bank account identifiers, portal tokens and API keys (hashed, not encrypted); frozen legal artifacts (filed notes, 837 bytes, statements, day closes) stored in object storage with SSE-KMS and Object Lock for WORM copies. (c) Endpoint — no cleartext PHI persisted on browsers: the draft mirror and degraded-mode cache use WebCrypto with a key derived from the server session, are wiped on sign-out or author switch, and are disabled on the operatory device profile; the Phase 3 exit test inspects a shared device after logout for zero cleartext PHI. (d) Key management — KMS customer-managed keys, automatic annual rotation, envelope re-wrap job, separation so the database role cannot call KMS Decrypt for another tenant's key, dual-key AUTH_SECRET rollover, documented rotation runbook, and a break-glass key-destruction procedure for BAA termination. (e) Hashing — bcrypt cost 12 for passwords with the hash gate; SHA-256 for reset tokens and API keys; HMAC per tenant for the audit chain. (f) Documented exceptions — names, DOB and clinical text remain searchable cleartext behind storage encryption, RLS, MFA and access logging; the SRA records this as a considered addressable decision with compensating controls, and the trust page states plainly what is field-encrypted and what is storage-encrypted. (g) Verification — CI asserts sslmode pinning, the boot guard refuses without a KMS key, and the annual pen test includes a backup-media and key-separation scenario. (h) Breach analysis integration — the incident module's 4-factor assessment pre-populates 'encrypted at rest and keys not compromised' from the asset inventory so the safe-harbor conclusion is evidenced, not asserted.

## Audit logging and monitoring

Legal anchors: audit controls (164.312(b)), information system activity review (164.308(a)(1)(ii)(D)), log-in monitoring (164.308(a)(5)(ii)(C)), accounting of disclosures (164.528), 6-year documentation retention (164.316(b)(2)), and the HITECH 'recognized security practices' 12-month evidence window. Design: (1) domain_event as a transactional outbox written in the same transaction as every business write, hash-chained per tenant (prev_hash/row_hash HMAC), INSERT-only role with UPDATE/DELETE revoked and BEFORE triggers, partitioned monthly, retained at least 6 years with legal hold. (2) phi_access_log for reads, written by withGuard when a handler declares phiRead, carrying actor (frozen), patient, resource, purpose enum (treatment|payment|operations|break_glass|export|ai|print|fax|portal|sms), justification and IP/UA; this is the control that detects snooping and supports 164.528 and investigations. (3) disclosures for every egress (print, export, fax, SMS, email, portal, AI) so the statutory accounting of disclosures is a query, with TPO disclosures distinguishable from those that must be included in the accounting. (4) Nightly chain verification writing audit_chain_checks and a daily chain head to S3 Object Lock so tampering by anyone with database credentials is detectable and the record is admissible as regularly kept business records. (5) Monthly information-system-activity review as a compliance_task that produces an attested row (who reviewed, what queries, findings) — this is the specific artifact OCR asks for and most small vendors cannot produce. (6) Security telemetry — auth.lockout, auth.spray, new-device-on-financial-role, mass export, after-hours refund, retroactive-dated entry, waived dual control, deposit variance over threshold and chain-verification failure are hard events that page the owner (and, for vendor-level events, the security official) immediately; everything else flows into the weekly digest with acknowledgement stamping. (7) Vendor-side monitoring — CloudTrail/GuardDuty-class logging of console and database access, WAF logs, EDR on staff endpoints (a cyber-insurance precondition), centralized retention 1 year hot / 6 years cold. (8) Content stays out of logs — codes, ids, versions and counts only; unknown usernames never logged (the dental repo's rule), no note text or prompts. (9) Rendering — plain sentences for owners and investigators, default filter hiding routine sign-ins, export row counts derived from rendered rows. (10) Retention and access to the logs themselves — the audit and access logs are PHI-adjacent; access to them is a named entitlement and is itself logged. (11) Evidence of the monitoring program (review attestations, alert runbooks, drill results) is retained 6 years and mapped to audit-protocol items.

## Ai and phi policy

Position: PHI may reach a model only through a named, logged, BAA-gated boundary, and only where a deterministic twin exists. Legal basis: an AI provider that receives PHI on behalf of the practice is a business associate (or the vendor's subcontractor BA) and requires a BAA that prohibits training on PHI, limits retention and requires breach notification; without a BAA the only lawful inputs are de-identified data under 164.514(b) (Safe Harbor removal of the 18 identifiers, or expert determination) or a limited data set under a data use agreement. Provider selection: Anthropic offers a BAA for HIPAA-ready API configurations (note its published position that BAA-covered models require a 30-day retention configuration and are not available under zero-data-retention, so the choice is HIPAA-ready-with-BAA, not ZDR-without-BAA); AWS Bedrock and Azure OpenAI are covered under their platform BAAs; xAI/Grok signs no BAA and is excluded, which also disposes of precog's Grok-federated auth. Product controls: (1) per-tenant opt-in recorded as a policy decision with the owner's attestation; (2) field-level minimum-necessary filter deciding which fields may cross (never the header, member IDs, SSN, bank data; clinical text only when the capability needs it); (3) the Smile Notes PHI classifier (phi.ts, phi-secondary.ts, maskPhi.ts) re-scoped from 'block filing' to 'egress classifier' — additive-only merge so a model-based scanner can only add findings; (4) every call writes a disclosures row and a parseable audit row with capability, prompt version, model identity, token counts and outcome — never content — so refusal rates have a denominator and model drift is attributable; (5) verifyMeaning and evidence pinning on every output, source spans shown, no confidence percentages, READBACK_CLASS tokens (tooth, surface, dose, amount, payer) confirmed on accept; (6) ambient dictation and browser SpeechRecognition disabled on PHI fields until an on-device engine or BAA STT clears a frozen dental WER corpus; (7) controls coach receives role labels only (Precog context-pack reshaped), never staff names, because person-scored output is both a liability and a walkout trigger; (8) AI is included in the price or off, never metered, and 'AI off' never removes a feature. De-identification for analytics and training corpora: Safe Harbor plus the given-names lexicon classifier, maskPhi's random-not-derived tokens (consistent within a document, inconsistent across documents so masked notes cannot be linked into a patient key), reviewed by a documented process; expert determination only if a statistician is engaged. Verifier patterns from Smile Notes to keep: the sealed independent byteaudit verifier restates the promises rather than importing them; the AI gate runs before the meter; refusals are logged with the same schema as successes; the model charter (docs/model-charter.md) and non-goals list are versioned and stamped (ASSIST_PROMPT_VERSION) with a CI guard. Marketing: never 'AI-powered' as a compliance claim; the trust page lists the model provider, BAA status and retention terms.

## Vendors and baas

Two BAA directions and one DPA class. UPSTREAM (vendor as BA of each practice): a vendor-form BAA signed in the setup wizard before any patient row exists, covering permitted uses (services, management/administration, data aggregation only if elected, de-identification only if the BAA permits), subcontractor flow-down, security safeguards, breach reporting to the CE within 5 business days of discovery (statutory outer limit 60 days), contingency-activation notice within 24 hours (NPRM-aligned), access/amendment/accounting support within timelines that let the CE meet TN's 10 working days, return-or-destroy at termination with certified destruction and a no-fee export, audit cooperation, and a limitation-of-liability structure that carves out breach costs to a defined cap tied to insurance limits. Offer to act as the CE's delegated breach notifier (as Change Healthcare did for most affected CEs) as a paid service with a template. DOWNSTREAM (subcontractor BAAs and other agreements), by connector: AWS (RDS, S3, Fargate, KMS, SES, Bedrock) — one BAA via AWS Artifact; Neon — BAA on Scale plan only; Fly.io — pre-signed BAA on the compliance add-on if chosen instead; clearinghouse (DentalXChange/Vyne/Change) — BAA plus EDI agreements; payment processor — no BAA needed under section 1179 if payload is payment-only, but a written data-flow statement and its PCI AOC annually; transactional email — replace Resend for PHI (no BAA) with SES under the AWS BAA or Paubox; SMS — Twilio Security/Enterprise edition with BAA, HIPAA-eligible services only; STT — BAA vendor or on-device; model provider — Anthropic/Bedrock/Azure BAA with no-training and retention terms; bank aggregator (Plaid class) — DPA and security terms, no PHI, read-only; eRx — BAA plus EPCS; error tracking/analytics/support tooling — either BAA-covered or PHI-free by redaction (redact.ts) with the classification documented; email for staff (Google Workspace/M365) — BAA required if PHI can appear in support mail. Registry: business_associates/baas rows carry vendor, kind, signed_at, expires_at, controls_named, document_id, attestation (SOC 2/HITRUST report date), breach history, annual review date; integration_registry.enabled requires a live row; the public subprocessor list on the trust page renders from it. Due diligence per vendor before signing: SOC 2 Type II or HITRUST report, pen-test summary, breach history (OCR portal search), incident-notification terms, data location, subprocessor list, insurance. Annual verification task per vendor (NPRM expects written verification by a subject-matter expert). Practices already have 8-15 business associates on average and a missing BAA is a violation before any breach — the compliance module's BAA document management (Phase 4) is therefore a real product, with the gating primitive in Phase 0.

## Backup dr and availability

Legal anchor: contingency plan standard (164.308(a)(7)) — data backup plan, disaster recovery plan, emergency mode operation plan, testing and revision, applications and data criticality analysis (required/addressable today); the NPRM would mandate restoration within 72 hours, an RPO of no more than 48 hours, and monthly backup/restore testing — build to those numbers now because they are also what carriers and DSOs ask for. Targets: RPO 5 minutes for the primary database (PITR), 24 hours for object storage cross-region copies; RTO 4 hours for single-region failure in Phases 0-2 (documented runbook, cross-region backups) and 1 hour at Phase 4 with two-region active/passive; degraded read-only mode target availability of today's schedule, alerts and chart summaries within 5 minutes of an outage. Criticality tiers: Tier 1 ledger, approvals, claims, encounters, audit chain (never degrade, never offline — controls cannot be enforced without the server); Tier 2 schedule, chart summaries (read-only degraded mode); Tier 3 reports, digests, AI. Backup program: managed PITR under the BAA, cross-region encrypted copies, daily chain head and day closes to S3 Object Lock (WORM; also the tamper-evidence anchor), weekly automated restore drill into an isolated account that writes its own audit row (Phase 0 exit criterion), monthly documented restore test in production runbook, annual full DR exercise and tabletop with the incident plan. Offline/degraded posture given the market's outage complaints: v1 is honest bounded offline — durable autosave plus encrypted read-only degraded mode disabled on shared devices — because a client-side PHI replica is a breach surface and an offline ledger would mean unenforced controls; the behavior is published on the trust page, the status page shows incident history and post-mortems, and Phase 5 decides on queued clinical capture from measured outage minutes. Emergency mode operations: documented manual procedures for practices (paper day sheet template that ties out on restore), vendor on-call, subprocessor outage playbooks (clearinghouse down: queue and resubmit exact frozen bytes; processor down: cash/check only with later reconciliation). Contractual: SLA with credits at GA, 24-hour contingency-activation notice to tenants, published uptime history. Cyber-insurance alignment: immutable, tested backups and a written IR/DR plan are underwriting requirements in 2026; keep the drill evidence in the compliance binder.

## Breach and incident response

Program built to the strictest applicable clock and evidenced end to end. Definitions: security incident (164.304) vs breach of unsecured PHI (164.402) with the presumption of breach unless a documented 4-factor assessment (nature/extent, unauthorized person, whether actually acquired/viewed, extent mitigated) shows low probability of compromise; encryption per HHS guidance takes data out of 'unsecured'. Clocks the incidents module computes from discovered_at: BA→CE contractual 5 business days (statutory ≤60 days; MMG Fusion, a dental PMS vendor, was sanctioned in March 2026 for never notifying); CE→individuals ≤60 calendar days HIPAA but 45 days under Tenn. Code Ann. 47-18-2107 — adopt 45 as the internal SLA; 30 days for residents of Colorado, Florida, Maine, Rhode Island and Washington; HHS ≤60 days when 500+ individuals, otherwise logged and reported by March 1 of the following year (60 days after year end); prominent media when more than 500 residents of one state; Tennessee consumer reporting agencies when more than 1,000 Tennesseans are notified; state AG notices per state thresholds; FTC HBNR only if a non-BA consumer product ever exists. Roles: vendor security official (incident commander), privacy official, outside counsel (owner should not be the only lawyer — privilege and independence), forensics firm and breach-notification vendor pre-contracted via the cyber policy panel, tenant owners as CE decision-makers. Runbook phases: detect (hard-event alerts, chain-verification failure, subprocessor notice) → contain (revoke sessions/keys, isolate, preserve logs) → assess (4-factor, affected-individual determination by tenant and state from patients.state) → notify (templates per 164.404(c): what happened, PHI involved, steps individuals should take, what the entity is doing, contact info; substitute notice via web posting 90 days or major media plus toll-free line when 10+ addresses fail) → remediate (risk register entries, CAP) → document (burden of proof under 164.414 sits with the regulated entity; retain 6 years). Product features: incidents(kind, discovered_at, risk_assessment jsonb, affected by state, computed deadlines, law_enforcement_delay, notices sent, evidence_document_ids); tip channel (anonymous, PHI-gated) as a detection source; owner and vendor dashboards of open clocks; quarterly tabletop with a written after-action; annual full exercise; post-incident report template published on the status page for availability incidents (security incidents are reported to affected CEs, not publicly, unless counsel decides otherwise). Law-enforcement delay handled per 164.412 with the written request retained. Insurance: notify the cyber carrier per policy conditions (often 72 hours) — add the carrier clock to the module. Regulatory posture: cooperate with OCR (typical 10-business-day data requests), rely on the 12-month recognized-security-practices evidence for mitigation, and never make public statements about the cause before forensics and counsel sign off.

## Secure sdlc

Requirements it satisfies: integrity controls (164.312(c)), evaluation (164.308(a)(8)), NPRM vulnerability management (scans every 6 months, annual penetration test, critical patches within 15 days and high within 30), SOC 2 CC7/CC8, PCI SAQ A r1's script-attack criterion, and the FTC's expectation that security claims are backed by process. Program: (1) Blocking CI — tsc, vitest with a coverage floor, the dental e2e probes (headers, lockout, MFA no-oracle, submission immutability, account lifecycle) promoted into the blocking job against real Postgres, the route-glob guard-coverage test (100% of handlers wrapped), RLS negative test, migration shadow-DB dry run and fresh-vs-migrated schema equality, version-stamp guards (RULESET_VERSION, ASSIST_PROMPT_VERSION, SCORING_VERSION, CONTROL_RULEBOOK_VERSION, migration id), dependency audit, secret scanning, license check, SBOM per release. (2) Code review — two-person review for anything touching packages/db, auth, ledger, controls-engine, verifier; the sealed byteaudit manifest hash changes only through a reviewed release. (3) Vulnerability management — weekly dependency updates, quarterly authenticated scans (exceeds the NPRM's 6 months), annual third-party penetration test (Phase 4 exit) with a findings register and remediation SLAs; CVE triage runbook with the 15/30-day clocks. (4) Environments — no production PHI in non-production; synthetic fixtures (Precog demo-data becomes a test fixture; Smile Notes synthetic-notes corpus). (5) Change control — drizzle-kit migrations with history table, one transaction per file, rollback plan for destructive changes, release notes, and a change log that the SOC 2 auditor can sample. (6) Supply chain — pinned next-auth beta and all dependencies with lockfile integrity, provenance checks, no install scripts without review. (7) Threat modeling at each phase gate using the adversarial panels in dental/knowledge/sources as the attacker personas; property tests for the ledger before UI. (8) Security headers and CSP tested off the wire (e2e/headers.mjs); nonce-based CSP and SRI when portal/intake ships, which also satisfies the SAQ A iframe criterion. (9) Logging discipline enforced by lint: no PHI fields in log statements; redact.ts on error reporting. (10) Documentation as a deliverable — every control has an ADR and an evidence pointer so an auditor can go from policy to proof; a 'controls recorded vs enforced' table is rendered in-product and mirrored in the compliance binder. (11) Incident learning — post-mortems for availability incidents are published; security post-mortems are internal with a CAP.

## Compliance program

GOVERNANCE. Name a Security Official and a Privacy Official (may be the same person in Phase 0, but the roles are documented); the owner, as an attorney, should retain outside healthcare regulatory counsel for the SRA sign-off, the BAA forms, the Tennessee content review, the RPC 5.7 opinion on generated policies, and incident response — so that privilege and independence do not depend on the owner personally. Adopt NIST CSF 2.0 plus HHS 405(d) HICP (small-practice volume) as the 'recognized security practices' framework and keep 12 months of continuous evidence.

CADENCE. Risk analysis: initial vendor SRA before any PHI (end of Phase 0), refreshed at every phase gate and at least annually, and on material change (new subprocessor, new region, new data class); risk management plan with owners and dates reviewed monthly. Policies: full set drafted in Phase 0 (security management, workforce, access, awareness/training, incident, contingency, evaluation, BA management, facility/workstation/device, access control, audit, integrity, authentication, transmission, privacy uses/disclosures, minimum necessary, individual rights, complaints, sanctions, documentation/retention, breach notification, AI/PHI, vendor access, secure development, data classification, acceptable use), approved through maker-checker, versioned, reviewed annually. Training: HIPAA privacy/security and security awareness for all vendor staff at hire and annually, role-specific for engineers with production access, phishing exercises quarterly; records retained 6 years. BAAs: gating in Phase 0; annual verification of each subprocessor; practice-side BAA management in Phase 4. Sanctions: written policy applied consistently and logged; vendor staff and (through the product) practice staff. Evidence: an audit-protocol-mapped binder (policy → procedure → evidence artifact → owner → last reviewed) maintained in a compliance repository; all artifacts retained 6 years.

ATTESTATIONS AND TIMING. Phase 1 (~month 6): readiness assessment against the OCR audit protocol and a gap letter; SOC 2 Type I at the end of Phase 1 as the point-in-time report early customers can hold. Phase 2: engage the SOC 2 auditor, start the Type II observation window (6 months recommended; 3 is the minimum) so it overlaps the build. Phase 4 GA: SOC 2 Type II report issued or observation complete, third-party pen test, product SRA published in summary on the trust page, PCI SAQ A/AOC posture documented, cyber and tech E&O policies bound. Year 2: HITRUST e1 if a group/DSO or payer requires it; r2 only on demand. Ongoing: annual SOC 2 Type II renewals.

COMPLIANCE CALENDAR. Daily — automated chain verification, backup success, hard-event alert triage; practice-side reconciliation. Weekly — dependency/patch review, restore drill in isolated account (Phase 0-1, then monthly), digest review. Monthly — information-system-activity log review with attested row; production restore test; vendor/admin access review; BAA registry expiry check; open-incident and breach-log review; under-500 breach log maintenance; risk-management plan status. Quarterly — authenticated vulnerability scan; access recertification (vendor staff and tenant owner/financial grants); IR/DR tabletop; policy change review; phishing exercise; cyber-insurance control attestation check; board/management compliance report; PCI posture check. Semi-annual — external scan floor (NPRM), key/secret rotation review, SoD review of vendor staff duties, training refresh for engineers. Annual — SRA refresh and sign-off; full policy review and approval; workforce HIPAA and security training; penetration test; Security Rule compliance audit against every standard (NPRM); asset inventory and network map review; contingency plan full exercise; BA written verification for every subprocessor; NPP template review; cyber insurance renewal with application accuracy review; SOC 2 Type II period; PCI SAQ A and processor AOC; recognized-security-practices evidence roll-up; retention/destruction run with destruction log; TN dental rule and statute currency review (Board rule revisions, records-fee caps). Fixed dates — by March 1 each year: report prior-year under-500 breaches to HHS (60 days after calendar year end); Feb 16, 2026 (passed): Part 2 NPP language in all practice NPP templates; 2027-01-01: Public Chapter 1107 supervision rule effective (unverified — confirm text); Jan 28 each year (approximately): HHS penalty inflation adjustment update in the risk register. Event-driven — breach clocks (BA→CE 5 business days; individuals 45 days TN / 30 days CO-FL-ME-RI-WA / 60 days HIPAA; HHS 60 days if 500+; media >500 per state; CRAs >1,000 TN; carrier per policy); right of access 10 working days TN / 30 days HIPAA; amendment 60 days; accounting 60 days; termination of workforce same day; new subprocessor: BAA before enablement (enforced); tenant BAA termination: return/destroy with certificate within 30 days; material change: SRA delta.

PRACTICE-FACING PROGRAM (Phase 4, counsel-reviewed, labelled provisional until then). Guided SRA questionnaire → tailored versioned policies → remediation tasks → server-verified training with certificates → BAA document management → incident intake with the clocks above → OSHA logs (BBP training 3 years, exposure records employment+30 years, sterilizer monitoring 2 years TN) → annual SRA reminder. Content is legal material: the RPC 5.7 analysis and disclaimers must be settled before commercial distribution.

## Citations to verify

- 45 CFR 160.103 defines 'business associate' to include an entity that creates, receives, maintains or transmits PHI on behalf of a covered entity, and 'covered entity' includes a health care provider that transmits any health information in electronic form in connection with a HIPAA standard transaction.
- 45 CFR 164.502(e)(1)(ii) and 164.504(e)(5) require a business associate to obtain satisfactory assurances (a BAA) from any subcontractor that creates, receives, maintains or transmits PHI on its behalf.
- 45 CFR 164.524(b)(2) requires a covered entity to act on a right-of-access request within 30 days, with one extension of up to 30 days; the 2021 Privacy Rule NPRM (86 Fed. Reg. 6446, Jan 21, 2021) proposed 15 days plus a 15-day extension and, per the 2026 OMB Unified Agenda, a final rule was targeted for August 2026 but has not been published as of Sept 3, 2026.
- 45 CFR 164.526(b)(2) requires action on an amendment request within 60 days with one 30-day extension, and 164.526(c) requires the amendment to be linked to the record.
- 45 CFR 164.528 gives individuals an accounting of disclosures for the six years prior to the request, excluding disclosures for treatment, payment and health care operations, with a 60-day response window plus one 30-day extension.
- 45 CFR 164.522(a)(1)(vi) requires a covered entity to agree to a request to restrict disclosure to a health plan for an item or service paid out of pocket in full.
- 45 CFR 164.502(f) protects PHI of a decedent for 50 years following death.
- 45 CFR 164.316(b)(2)(i) and 164.530(j)(2) require Security Rule and Privacy Rule documentation to be retained for 6 years from the date of creation or the date it was last in effect, whichever is later.
- 45 CFR 164.312(a)(2)(i) (unique user identification), 164.312(a)(2)(ii) (emergency access procedure) and 164.312(b) (audit controls) are 'required' implementation specifications; 164.312(a)(2)(iii) (automatic logoff) and 164.312(a)(2)(iv) (encryption and decryption) are 'addressable' under the current Security Rule.
- The HIPAA Security Rule NPRM 'HIPAA Security Rule To Strengthen the Cybersecurity of Electronic Protected Health Information' (RIN 0945-AA22) was published in the Federal Register on January 6, 2025 (90 Fed. Reg. 898), comments closed March 7, 2025, and as of September 2026 no final rule has been published; the OMB 2026 Unified Agenda lists a target of July 2027.
- The Security Rule NPRM proposes to eliminate the required/addressable distinction and to mandate MFA, encryption of ePHI at rest and in transit, a technology asset inventory and network map reviewed at least every 12 months, restoration of critical systems within 72 hours, an RPO of 48 hours with monthly backup testing, vulnerability scanning at least every 6 months, penetration testing at least every 12 months, an annual compliance audit, patching of critical vulnerabilities within 15 days and high within 30 days, 24-hour notice by business associates of contingency plan activation, and annual written verification of business associates' technical safeguards.
- For HIPAA civil monetary penalties assessed on or after January 28, 2026, the inflation-adjusted amounts are Tier 1 $145-$73,011, Tier 2 $1,461-$73,011, Tier 3 $14,602-$73,011, Tier 4 $73,011-$2,190,294 per violation, with a calendar-year cap of $2,190,294 per identical provision (45 CFR 102.3), and OCR's April 2019 Notice of Enforcement Discretion applies lower annual caps to Tiers 1-3.
- The HITECH Act (Pub. L. 111-5, Div. A, Title XIII, Feb 17, 2009) made business associates directly liable for Security Rule violations and specified Privacy Rule provisions, created the four penalty tiers, authorized state attorneys general to bring civil actions for HIPAA violations (42 U.S.C. 1320d-5(d)), and established the Breach Notification Rule.
- Public Law 116-321 (Jan 5, 2021) amended the HITECH Act to require HHS to consider whether a covered entity or business associate had 'recognized security practices' in place for the previous 12 months when determining fines, audit results and remedies; 'recognized security practices' are defined as NIST Cybersecurity Act 2(c)(15) standards, section 405(d) of the Cybersecurity Act of 2015 approaches (HICP), or other regulatory programs.
- 45 CFR 164.404(b) requires notification to individuals without unreasonable delay and in no case later than 60 calendar days after discovery of a breach of unsecured PHI; 164.404(d)(2) requires substitute notice (conspicuous website posting for 90 days or major print/broadcast media, with a toll-free number active 90 days) when contact information is insufficient for 10 or more individuals.
- 45 CFR 164.406 requires notice to prominent media outlets serving a state or jurisdiction when a breach involves more than 500 residents of that state or jurisdiction, within 60 calendar days of discovery.
- 45 CFR 164.408 requires notice to the HHS Secretary contemporaneously with individual notice (within 60 days) for breaches involving 500 or more individuals, and for breaches involving fewer than 500 individuals a log maintained and submitted not later than 60 days after the end of the calendar year in which the breaches were discovered.
- 45 CFR 164.410 requires a business associate to notify the covered entity of a breach without unreasonable delay and no later than 60 calendar days after discovery; 164.412 permits delay at a law enforcement official's written request; 164.414 places the burden of proof on the covered entity or business associate.
- HHS 'Guidance Specifying the Technologies and Methodologies That Render PHI Unusable, Unreadable, or Indecipherable to Unauthorized Individuals' (74 Fed. Reg. 19006, Apr 27, 2009, as updated) treats PHI encrypted consistent with NIST SP 800-111 (at rest) and NIST SP 800-52/800-77/800-113 (in transit) as 'secured' so that its loss is not a reportable breach, provided the decryption key was not also breached.
- On March 5, 2026, HHS OCR announced a $10,000 settlement and three-year corrective action plan with MMG Fusion, LLC, a dental practice-management software business associate, for a breach affecting approximately 15 million individuals, citing impermissible disclosure, failure to conduct an accurate and thorough risk analysis, and failure to notify affected covered entities within 60 days under 45 CFR 164.410.
- OCR's Risk Analysis Initiative, begun in late 2023/2024, produced at least twelve enforcement actions by 2026, with failure to conduct an accurate and thorough risk analysis under 45 CFR 164.308(a)(1)(ii)(A) as the common finding.
- HHS-OIG report A-18-21-08014 (November 2024) found OCR's 2016-2017 HIPAA audits assessed only 8 of 180 audit-protocol requirements and recommended enhancements; OCR announced in December 2024 that it would resume HIPAA audits of 50 covered entities and business associates focused on Security Rule provisions relevant to hacking and ransomware.
- The HHS OCR HIPAA Audit Protocol was last revised in 2018 and covers Privacy Rule, Security Rule and Breach Notification Rule provisions.
- The FTC Health Breach Notification Rule (16 CFR Part 318) as amended (89 Fed. Reg. 47028, May 30, 2024; effective July 29, 2024) applies to vendors of personal health records and PHR-related entities not covered by HIPAA, requires individual notice without unreasonable delay and no later than 60 calendar days after discovery, notice to the FTC at the same time as individual notice for breaches involving 500 or more individuals, annual notice to the FTC within 60 days after the end of the calendar year for smaller breaches, and media notice for breaches involving 500 or more residents of a state; entities acting as HIPAA covered entities or business associates are excluded to the extent of those activities.
- In January 2016 the FTC settled with Henry Schein Practice Solutions, Inc. (FTC File No. 142-3161) for $250,000 over claims that Dentrix G5 provided 'encryption' meeting HIPAA requirements when it used a data-camouflage method not recognized as encryption by NIST.
- Tenn. Code Ann. 47-18-2107 requires an information holder to notify affected Tennessee residents of a breach of system security immediately but no later than 45 days from discovery or notification of the breach (subject to law enforcement delay), requires notice to consumer reporting agencies when more than 1,000 persons are notified at one time, provides an encryption safe harbor, and deems persons subject to HIPAA/HITECH (or GLBA Title V) in compliance if they comply with those laws' notice provisions.
- Tennessee Public Chapter 991 (2024), signed May 21, 2024 and codified at Tenn. Code Ann. 29-34-215, provides that a private entity is not civilly liable in a class action resulting from a cybersecurity event unless the event was caused by willful and wanton misconduct or gross negligence, and does not apply to events before its effective date.
- The Tennessee Information Protection Act (Tenn. Code Ann. 47-18-3201 et seq.) took effect July 1, 2025, applies to controllers with more than $25 million in revenue that control or process personal information of at least 175,000 consumers (or 25,000 consumers with more than 50% of revenue from sale of personal information), and exempts HIPAA covered entities and business associates and protected health information; it offers an affirmative defense for a written privacy program reasonably conforming to the NIST Privacy Framework.
- Tenn. Code Ann. 63-2-101 requires a health care provider (including a dentist licensed under Title 63) to furnish a copy of a patient's medical record within 10 working days of receipt of a written request, and Tenn. Code Ann. 63-2-102 caps reproduction charges (for electronically provided records: $25 for 10 pages or fewer, $0.25 per page thereafter, up to $90) and provides that records not furnished within 10 working days are provided free; failure may be reported to the licensing board.
- Tenn. Comp. R. & Regs. 0460-02-.12 requires retention of adult dental records for at least 7 years after the last professional contact, minors' records for at least 1 year after majority or 7 years after last contact (whichever is longer), records of incompetent patients indefinitely, corrections by dated addendum, and destruction only under a confidentiality-protecting procedure; the Tennessee Department of Health Standards of Practice Manual states a 10-year floor for minors from last date of service.
- Tenn. Comp. R. & Regs. 0460-01-.11 requires dental offices to retain sterilizer biological-monitoring documentation for at least 2 years; 0460-02-.10 requires retention of advertising copies for 2 years; 0460-01-.12 lists false or inconsistent patient-record entries and unauthorized disclosure as unprofessional conduct; 0460-01-.16 enumerates patient rights including record confidentiality and access.
- Tennessee Public Chapter 1107 (2026) tightens hygienist supervision for new patients effective January 1, 2027 (as encoded in /home/user/catcorner22/dental/src/lib/audit/rules/supervision.ts and src/lib/law/tn-law.ts) — UNVERIFIED in this review because publications.tnsosfiles.com is blocked from this environment; confirm the chapter number, text and effective date at capitol.tn.gov before the scheduler rule ships.
- Tenn. Code Ann. 63-5-108 limits a dentist to supervising no more than three dental hygienists at one time under general supervision, and Tenn. Code Ann. 63-5-115 governs employment and practice of hygienists and assistants including the 15-consecutive-business-day general-supervision window when the dentist examined the patient within the prior 11 months.
- Tenn. Code Ann. 53-10-310(e) requires a healthcare practitioner to check the Controlled Substance Monitoring Database before prescribing an opioid or benzodiazepine (and other substances designated by rule) at the beginning of a new episode of treatment, before each new prescription during the first 90 days, and at least every six months thereafter while treatment continues, and requires practice sites to provide electronic CSMD access; verify current dentist-specific exemptions.
- Tennessee law requires electronic prescribing of controlled substances (Schedule II-V) with enumerated exemptions — confirm the statutory citation (Tenn. Code Ann. 53-11-308 as amended, or Title 63 provisions) and the effective date (reported as January 1, 2021).
- The 42 CFR Part 2 final rule (89 Fed. Reg. 12472, Feb 16, 2024) took effect April 16, 2024 with a compliance date of February 16, 2026, requires HIPAA covered entities to include Part 2-related statements in their Notices of Privacy Practices (45 CFR 164.520 as amended), and applies HIPAA civil and criminal penalties to Part 2 violations; a general dental practice is not a 'Part 2 program' under 42 CFR 2.11.
- Purl v. U.S. Department of Health and Human Services, No. 2:24-CV-228-Z (N.D. Tex. June 18, 2025), vacated the 2024 HIPAA Privacy Rule to Support Reproductive Health Care Privacy nationwide except its Notice of Privacy Practices provisions relating to Part 2; the government's Fifth Circuit appeal was dismissed in September 2025.
- On June 20, 2024, in American Hospital Association v. Becerra (N.D. Tex.), the court vacated the portion of OCR's Online Tracking Technologies bulletin treating the combination of an IP address with a visit to an unauthenticated webpage about health conditions or providers as PHI; HHS withdrew its appeal in August 2024; the bulletin's guidance on authenticated pages (e.g., patient portals) remains in effect.
- Under 45 CFR Part 171 (information blocking), 'health care provider' uses the Public Health Service Act definition at 42 U.S.C. 300jj(3), which the ADA and ONC interpret to include dentists regardless of whether they use certified health IT or participate in CMS programs; a software vendor is an actor only as a 'health IT developer of certified health IT' if it offers at least one ONC-certified health IT module.
- Since October 6, 2022, 'electronic health information' for information-blocking purposes means ePHI in a designated record set (45 CFR 171.102), no longer limited to USCDI.
- The HHS final rule 'Establishment of Disincentives for Health Care Providers That Have Committed Information Blocking' (89 Fed. Reg. 54662, July 1, 2024) applies disincentives only through the Medicare Promoting Interoperability Program, MIPS and the Medicare Shared Savings Program (MSSP disincentives effective January 1, 2025), so most dentists are not subject to a finalized disincentive today.
- OIG's information-blocking enforcement rule (88 Fed. Reg. 42820, July 3, 2023; enforcement from September 1, 2023) authorizes civil monetary penalties of up to $1 million per violation against health IT developers of certified health IT, health information networks and exchanges.
- ONC's HTI-1 final rule (89 Fed. Reg. 1192, Jan 9, 2024) imposes decision-support-intervention transparency, real-world testing and Insights Condition reporting on developers of certified health IT; subsequent HTI-4 and HTI-5 rules (2025-2026) modified certification criteria and deregulated portions of the program — verify current status before the ONC-certification decision.
- PCI DSS v4.0 was retired March 31, 2024; PCI DSS v4.0.1 is the only active version and its future-dated requirements became mandatory March 31, 2025.
- PCI SSC removed Requirements 6.4.3 and 11.6.1 from SAQ A in the January 2025 SAQ A r1 revision (effective March 31, 2025) and added an eligibility criterion that a merchant embedding a PCI-compliant processor's hosted payment form in an iframe must confirm its site is not susceptible to script attacks; merchants that fully redirect to the processor's page are not subject to that criterion.
- Section 1179 of the Social Security Act (42 U.S.C. 1320d-8) exempts from HIPAA Administrative Simplification the activities of financial institutions in authorizing, processing, clearing, settling, billing, transferring, reconciling or collecting payments for health care, and HHS's 2002 guidance confirms a payment processor is not a business associate when it only processes payments.
- Change Healthcare reported to OCR that its February 2024 ransomware breach affected approximately 192.7 million individuals (updated July 31, 2025), the largest breach ever reported to OCR; Change Healthcare is a health care clearinghouse and a covered entity in its own right.
- AWS offers a Business Associate Addendum through AWS Artifact covering HIPAA-eligible services including RDS, S3, ECS/Fargate, KMS, SES and Bedrock.
- Neon signs a Business Associate Agreement and is HIPAA-audited only on its Scale plan (Free and Launch plans are not HIPAA-eligible), with backups, PITR, read replicas and branching covered, and has announced a future 15% HIPAA surcharge.
- Fly.io will sign a pre-signed Business Associate Agreement for customers on its compliance add-on (about $99/month) covering Fly Machines and Fly Managed Postgres, and is SOC 2 Type 2 audited.
- Resend does not offer a Business Associate Agreement and therefore cannot be used to send email containing PHI.
- Twilio's Programmable Messaging (SMS/MMS), Programmable Voice and Elastic SIP Trunking are HIPAA-eligible only under a Twilio Business Associate Addendum available on Security or Enterprise editions; Twilio SendGrid is not HIPAA-eligible except through Twilio's enterprise BAA process.
- Anthropic offers a Business Associate Agreement for commercial API customers using HIPAA-ready configurations, and its documentation states that BAA-covered models require a 30-day retention configuration and are not available under zero-data-retention.
- xAI (Grok) and the auth.grok.me identity broker do not offer a HIPAA Business Associate Agreement.
- Plaid does not sign HIPAA Business Associate Agreements; bank transaction data about a dental practice's accounts is not PHI unless linked to an identifiable patient's health information.
- The FCC's July 10, 2015 TCPA Declaratory Ruling and Order (FCC 15-72) exempts certain non-telemarketing health care messages by HIPAA covered entities or their business associates to wireless numbers provided by the patient from prior-express-consent requirements, subject to conditions (free to the recipient, one message per day and three per week, 160 characters, opt-out, not for billing/debt collection or marketing); marketing texts require prior express written consent.
- State breach statutes in Colorado (C.R.S. 6-1-716), Florida (Fla. Stat. 501.171), Maine (10 M.R.S. 1348), Rhode Island (R.I. Gen. Laws 11-49.3-4) and Washington (RCW 19.255.010) require individual notice within 30 days of discovery, shorter than HIPAA's 60 days; Texas Health & Safety Code chapter 181 (HB 300) defines 'covered entity' to include any person who possesses PHI and imposes training and 15-business-day electronic-record access requirements, and Tex. Bus. & Com. Code 521.053 requires notice within 60 days.
- 29 CFR 1910.1030 requires an exposure control plan reviewed annually, annual bloodborne-pathogens training with records retained 3 years (1910.1030(h)(2)), employee medical records retained for the duration of employment plus 30 years (1910.1030(h)(1)), and a sharps injury log for employers required to keep injury records under 29 CFR 1904; offices of dentists (NAICS 6212) are partially exempt from routine OSHA 300 recordkeeping under 29 CFR 1904.2 Appendix A.
- The AICPA Trust Services Criteria (TSP Section 100, 2017 with 2022 revised points of focus) govern SOC 2 examinations; a SOC 2 Type 2 report requires an observation period commonly 6-12 months with a practical minimum of about 3 months.
- HITRUST's assessment portfolio comprises e1 (about 44 requirements, one-year validity), i1 (about 182 requirements, one-year validity) and r2 (tailored, roughly 200-400+ requirements, two-year validity with interim assessment).
- Tennessee Supreme Court Rule 8, RPC 5.7 subjects a lawyer providing law-related services (including through an entity the lawyer owns) to the Rules of Professional Conduct unless the lawyer takes reasonable measures to assure the recipient knows the services are not legal services and no client-lawyer relationship exists.
- IBM's 2026 Cost of a Data Breach report places the average healthcare breach cost at about $6.64 million (as cited in the owner's market research via Patient Protect) — confirm the figure and year against the IBM report itself.
- The ADA's Current Dental Terminology (CDT) code set is copyrighted by the American Dental Association and adopted as the HIPAA dental procedure code set at 45 CFR 162.1002; redistribution requires an ADA license.

## Open questions

- Public Chapter 1107 (2026), encoded in the dental repo with a 2027-01-01 effective date, could not be verified from this environment (publications.tnsosfiles.com blocked). Confirm the chapter, its text and effective date at capitol.tn.gov before the scheduler's supervision validator ships; if the rule is misstated the product would refuse lawful bookings.
- Does assembling 837D transactions on the practice's behalf and forwarding them to a clearinghouse risk classifying the vendor as a 'health care clearinghouse' (a covered entity) rather than a business associate? Structure the contract and architecture (the practice is the submitter of record; the clearinghouse performs any translation) and obtain counsel's written analysis.
- Who is the vendor's designated Privacy Official and Security Official, and will the owner retain outside healthcare regulatory counsel so that the SRA, incident response and BAA negotiations are not dependent on the owner personally (privilege, independence, and OCR's expectation of a named official)?
- RPC 5.7 exposure: the compliance module generates tailored HIPAA/OSHA policies and Tennessee-law references for customers of a company owned by a Tennessee attorney. Obtain a written opinion on whether this is a 'law-related service', what disclaimers and separation are required, and whether the owner's law license changes marketing or support obligations.
- Will the vendor offer to act as delegated breach notifier for tenants (as Change Healthcare did), and at what price and liability cap? This changes the BAA, the incident module and the cyber-insurance limits.
- Neon's HIPAA tier is the Scale plan with a disclosed future 15% surcharge; AWS RDS keeps everything under one BAA and one audit report. Which is chosen, and is the whole stack (compute, storage, database, KMS, email, model) under a single BAA?
- Transactional email: Resend has no BAA. Decide whether system mail is provably PHI-free (reset links, invites, alerts with no patient data) and stays on Resend, or move all mail to SES/Paubox under a BAA to avoid classification disputes.
- Bank aggregator: confirm with counsel that deposit-matching data sent to Plaid-class vendors carries no patient identifiers (so it is not PHI and no BAA is needed) and that the DPA and read-only scope are sufficient; document the classification.
- Is the clearinghouse shortlist (DentalXChange, Vyne, Change Healthcare) filtered by breach history and incident-notification terms, given Change Healthcare's 192.7 million-record breach and multi-month outage?
- ONC certification: record the decision before API v1. If 'no', confirm no marketing uses 'certified' or 'ONC'; if 'yes', budget HTI-1/HTI-4/HTI-5 obligations and developer information-blocking exposure (up to $1M per violation).
- Minors' retention: the Board rule and the Department of Health manual differ (7 vs 10 years). The design takes the longer; confirm with counsel which governs and whether the Board's 'incompetent — indefinitely' term maps to current guardianship law.
- Cleartext names and DOB for search: is the SRA's compensating-controls argument acceptable to the owner as counsel, or should searchable encryption (blind indexes/HMAC tokens) be budgeted before GA given the NPRM's encryption mandate?
- Will early customers accept a SOC 2 Type I plus pen test in lieu of a Type II for roughly a year, and will the pilot agreement disclose that plainly?
- What are the cyber and tech E&O limits and who is the carrier? Application accuracy is now a claim-denial risk; the compliance binder should be the source of every application answer. Should tenants be contractually required to carry their own cyber coverage?
- Multi-state: will any out-of-state practice, or a Tennessee practice with a material out-of-state patient base, be onboarded before per-state jurisdiction packs exist? The incident engine must compute per-state deadlines from day one regardless.
- Patient portal HBNR analysis: confirm in an ADR that the portal is offered only as a business associate function of each practice (excluding the FTC Health Breach Notification Rule) and that no direct-to-consumer app is planned; revisit if one is.
- Person-scoped signals and the designated reviewer/CPA seat: does giving an external CPA read access to person-scoped control signals require that CPA to be a business associate of the practice (financial data is not PHI, but ledger rows carry patient identifiers)? Decide the CPA seat's data scope and BAA status.
- Vendor staff access to production PHI: what is the minimum team size and rota that satisfies the 'two-admin' ceremonies and quarterly access reviews in Phase 0 with a solo founder, and is a fractional security official engaged?
