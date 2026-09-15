// The single source of truth for the deterministic ruleset version. It is
// stamped onto every submission and audit report and frozen into the
// submissions record, so a later change to the rules never silently rewrites
// what a past note was audited against. Bump on any change to audit rules,
// module definitions, or controlled vocabulary.
// 2.1.0 — plural-preserving first-use shorthand expansion (pluralExpansion):
//         "SSCs" no longer expands to a singular; counts survive.
// 2.2.0 — Mockingbird medication-safety gates (kg rule, dose reconciliation,
//         household units, dental interaction screens), effort gates
//         (gibberish, unprofessional tone), and anticipatory completeness
//         rules (imaging interpretation, anesthetic amount, extraction
//         outcome, prescription duration, consent decision).
// 2.3.0 — robotic-assisted surgery module; sedation module gains the
//         monitors-in-use list and emergency-preparedness confirmation;
//         opioid prescriptions require a documented CSMD/PMP check.
// 2.4.0 — billing-narrative justification rules (SRP periodontal evidence,
//         core-buildup retention, crown necessity) and the note GPA stamp
//         (deriveGpa v1) frozen onto filings.
// 2.5.0 — the patient-experience layer and its review pass. The plain-language
//         rule set and the "plain-language" category; suppression of STYLE
//         abbreviation findings inside patient-facing text; the anxiety-comfort
//         module; the "Written for the patient" and "Open items" sections of
//         universal-core; telephone and portal encounter types; PLAIN_WORDS,
//         the quadrant and s/s shorthand, four lexicon words, and a widened
//         vague.moderate carve-out.
//
//         Recorded rather than tidied away: this layer merged under 2.1.0 and
//         went unstamped until now, so notes filed in that window carry a
//         version that does not describe the rules that ran. That is the exact
//         failure this constant exists to prevent, and the CI guard added in
//         2.4.0 is what stops it happening again.
// 2.6.0 — obfuscation screen (phi.obfuscated-digits, phi.hidden-characters):
//         an identifier typed in a non-ASCII decimal script, or split by a
//         zero-width character, was invisible to every \d-based PHI pattern
//         while reading normally to a human. The obfuscation is now the finding,
//         so no pattern has to be taught about Unicode individually.
// 2.7.0 — the vocabulary staff actually type: w/, w/o, c/o, MH, BP, ant, iso,
//         epi, lido, fl, tol, mo expand deterministically; perc, endo, imp,
//         temp, mod, cal, tp, cx are flagged as ambiguous rather than guessed;
//         EXT and NKA extend their existing ASK to lower case; PFM and PVS join
//         the first-use terms of art. Measured cause: on notes typed the way
//         staff type them the transformer made ~2 changes each and the AI
//         verifier accepted 0 of 5 faithful rewrites, because the tables are
//         both what the deterministic pass applies AND what licenses a model's
//         expansions.
// 2.8.0 — abbreviation preload: 54 entries across dental terms of art (endodontic
//         working length and irrigants, periodontal grafting and SPT, MRONJ and
//         oroantral communication, prosthodontic and paediatric terms), the
//         medical history that changes dental treatment (HTN, DM, CHF, COPD, CVA,
//         GERD, OSA, SBE, PMH), safe pharmacy sig codes, and a second batch of
//         ISMP / Joint Commission do-not-use constructs (hs/qhs, TIW/BIW, the
//         eye-and-ear Latin set, ss, APAP, cc, D/C) which are FLAGGED AND NEVER
//         EXPANDED, because expanding a dangerous abbreviation launders it.
//         Ambiguous additions (MI, CAD, RA, cap, ac/pc) ask rather than guess.
//         See knowledge/sources/dental-abbreviation-preload.md.
// 2.9.0 — text-to-STRUCTURE. A read-only extraction layer (src/lib/extract)
//         parses clauses into clinical facts — tooth sites with surfaces,
//         procedures with a coarse category — and a ConText assertion layer
//         decides whether the note affirmed or denied each one. New controlled
//         vocabulary: vocab/procedures.ts.
//
//         Stamped because the facts a note yields are now part of what the
//         ruleset means: a chart drawn from this, or a consistency finding
//         raised by it, has to be reproducible against the version that ran.
//
//         Extraction NEVER edits a note. It returns spans into the input and
//         values from controlled tables, so the meaning-preservation contract
//         in standardize.ts is untouched by construction. Negation is assigned
//         (the algorithm measures 97/97); temporality is only ever hinted (67%
//         recall on "historical" is below this product's bar for deciding).
// 2.10.0 — the parser learns the rest of a note. Measured against a corpus of
//         real shorthand it read 26.2% of clauses; it now reads 94.6%, and
//         coverage.test.ts ratchets that so it cannot regress quietly.
//
//         New fact kinds: medication (with dose, concentration, and carpule-to-
//         millilitre arithmetic where the convention is exact), measurement
//         (including ranges and blood pressure), finding, material, care-event.
//         New controlled vocabulary: vocab/clinical-terms.ts, plus operative
//         steps in vocab/procedures.ts.
//
//         Two defects the corpus caught that inspection had not:
//         "no caries noted" was in the pseudo-trigger list, so every clean exam
//         reported caries; and chart.ts kept a private copy of the site
//         accessor, so the day findings started carrying teeth, a negated
//         finding stopped reaching the chart at all.
//
//         impliesNegation exists for NKA/NKDA. Reading an absence of allergy as
//         an allergy is the most dangerous inference available to this parser,
//         so the term's own meaning overrides surrounding cues rather than
//         combining with them.
// 2.11.0 — the tiered shorthand filing gate (audit/rules/shorthand-gate.ts).
//         Ambiguous shorthand, shorthand no table can read, and Joint
//         Commission / ISMP do-not-use constructs now raise S1 and stop FILING.
//         Shorthand the tables can already expand is untouched and still costs
//         the writer nothing, because a gate that stops "BW" and "10U" with the
//         same force teaches people to clear both with the same reflex.
//
//         Four false positives found by the existing suite while building it,
//         each of which would have been enough on its own to get the gate
//         switched off: units of measurement ("5 mm" blocked a note for
//         containing a millimetre), Roman numerals ("ASA II"), the tool's own
//         PHI masks (blocking a note BECAUSE it had been redacted), and
//         alphanumeric terms truncated at the first digit ("ETCO2" reported as
//         "ETCO"). All four are now pinned regression tests.
//
//         New controlled vocabulary: ETCO2, SpO2, ECG/EKG, NIBP. The sedation
//         module's own labels were rewritten to define ASA and ETCO2 on first
//         use, because the app failing its own gate is a real finding.
// 2.12.0 — quadrants are extracted as REGIONS. "SRP UR and LR quads" now
//         reaches the chart as two bands rather than as nothing, and it is
//         deliberately NOT expanded into sixteen tooth facts: a quadrant says
//         work happened in a region and does not say which teeth, so filling
//         them in would put a claim on the chart the note never made. A region
//         is dropped when the note also named teeth inside it, because the
//         teeth are the more specific statement.
// 2.13.0 — local anaesthetic maximum-dose arithmetic (rules/anesthetic-dose.ts).
//         The first rule in this product that only exists because the
//         transformer READS notes: "2 carp lido 2%" contains no "mg", so no
//         regex over milligrams can reach it. The dose is implied by three
//         conventions -- 1.8 mL per carpule, 2% = 20 mg/mL -- and getting to a
//         number needs structured facts.
//
//         S2, never blocking, and that is a safety decision rather than
//         caution: a note is a RECORD, and if more than the maximum was given
//         the note MUST say so. A gate refusing to file it would suppress the
//         documentation of the event it was worried about, and teach staff to
//         under-record doses to get the note out.
//
//         Fires only on exceedance, never on approaching a limit, and only
//         when volume and concentration are both stated. An incomplete dose is
//         silent: an earlier version blamed the writer for a complete note the
//         extractor could not assemble across a clause boundary.
// 2.14.0 — the owner's templates and the rule with a start date.
//         Four owner-authored scaffolds join the verified blocks (operative
//         with assistant, hygiene composite, patient-readable summary,
//         addendum), adapted to house rules: no exact dates in draft text
//         (Curve's visit supplies the date of service), attribution as
//         placeholders so the residue rule blocks filing until a person is
//         named, and no pre-attested findings.
//
//         Public Chapter 1107 (2026): from January 1, 2027 a new patient's
//         diagnostic radiographs, tissue-data collection, prophylaxis, or
//         fluoride require direct supervision by a dentist who has seen the
//         patient. Implemented now as an effective-dated rule with the audit
//         date as an INPUT (AuditContext.today), so the engine stays a pure
//         function and tests pin both sides of the boundary. Before the date:
//         a heads-up on the risky combination. After: it blocks filing.
//
//         Patient status and Supervision join universal-core as fields that
//         are contextually required BY THE RULE — hygiene-service notes, once
//         the law is in force — and deliberately not schema-required, because
//         a plainly required field blocks every draft already saved.
// 2.15.0 — unit COMPOUNDS pass the filing gate. "mg/kg" — the standard
//         weight-based dosing notation, which the medication-safety rules
//         themselves match — read as unknown shorthand because isUnit()
//         stripped the slash and looked up "mgkg". A slash-joined token whose
//         every part is a known unit is now a unit ("mg/kg", "L/min"). Found
//         when Byte's own dosing advice, quoting the published 4.4 mg/kg
//         ceiling, tripped the gate that would next have tripped on a real
//         note. Recorded late: the change shipped with the advisor commit and
//         should have carried this bump the same day.
//
//         Also under this bump: CSMD and PMP join the vocabulary. The opioid
//         rule REQUIRES "CSMD reviewed" in the note while the filing gate
//         blocked any note containing the token as unknown shorthand — two
//         rules in direct contradiction, found the same way as mg/kg: Byte's
//         opioid advice failed his own blocking-audit test. The practice
//         cannot demand a word its own vocabulary refuses to read.
// 2.16.0 — line breaks are clause boundaries, and clauses have a ceiling.
//         A 1,500-line pasted note parsed as ONE clause because the tokenizer
//         swallowed newlines as whitespace: assertion scoping inside a clause
//         is O(facts × cues), so the paste cost 12 seconds on the keystroke
//         path, and a "no" on line one was in scope to negate a finding forty
//         lines down. Staff shorthand is one statement per line; the parser
//         now agrees. A defensive 250-token clause ceiling covers the
//         remaining adversarial shape (an unbroken wall with no punctuation).
//         Found by a hostile stress battery, not by a user — which is the
//         only acceptable way to find a 12-second keystroke.
// 2.17.0 — staff-adoption + Gate-1 follow-ons without learned weights:
//         ambiguous-shorthand reading proposals (display-only); unread-clause
//         category router for the readback panel; provider-only second-line
//         PHI patterns (email/MRN/street/ZIP) merged before assist/SuperByte
//         calls; learning-ledger surface-variant clustering; Byte next-action
//         + gauge explanations; TN license-scope retrieval cue.
// 2.18.0 — frozen disambiguation + unread-routing evals (charter §4.1/§4.2
//         gates); expanded proposeReading cue families (PD/PPD/MI/CAD/RA/cap/ASA);
//         grammar-growth digest by unread category.
// 2.19.0 — reading-proposer injection seam (eval-only encoder slot); dental
//         synonym map for learning-ledger clusters; more proposeReading cues
//         (qd/qod/ac-pc) + restorative context boost; staff HelpTips on
//         Dashboard / Builder / Audit / TN law banner; visible export-lock copy.
// 2.20.0 — the web app is the only runtime, in the vocabulary too: the
//         spelling lexicon regenerated from the scrubbed skill/ docs (the
//         "chatgpt" token and retired-assistant deployment doc are gone).
//         Same bump covers the personal-blocks PHI refusal at save — a new
//         place the identifier rules run, not a change to what they match.
// 2.21.0 — claim-file documentation research encoded as anticipatory rules:
//         complete.clinical-rationale (Doctors Company #3 gap) and
//         complete.consent-thin-assertion (checkbox theater); advisor entry
//         byte.clinical-rationale; internal "language optimizer for risk
//         reduction" terminology; knowledge/sources/litigation-documentation-research.md.
// 2.22.0 — complete.referral-loop-open (Doctors Company referral guidance);
//         Team Lead+ claim-file research digest on /reference/risk-management;
//         documentationResearch added to reference doc allowlist.
// 2.23.0 — precision. The first measurement of how often the audit stops a note
//         that was already fine (src/lib/audit/precision/), and the five
//         narrowings it demanded. Every one was a BLOCKING false positive found
//         by running the rules over 34 notes written to house style:
//           anatomy.text-tooth (S0) read "#557 carbide bur" as an impossible ADA
//             tooth designation — one of the commonest tokens in a restorative
//             note. Instrument nouns now end the tooth run.
//           medsafe.interaction.* (S1) blocked "no NSAIDs advised" on an
//             anticoagulated patient — the tool punishing the clinician who
//             spotted the interaction and documented avoiding it. Bare negation
//             of the agent now counts as an avoidance cue.
//           effort.unprofessional (S1) fired on "buccal fat pad", "gross
//             debridement", "lying supine", "lies distal". Context gates either
//             side of the hit; the slur itself still fires, including when it
//             sits beside a legitimate phrase.
//           effort.gibberish (S1) fired on "------" and on runs of pasted
//             spaces. Repeated WORD characters only; punctuation is formatting.
//           phi.ssn-bare (S0) fired on any nine-digit run, so an implant lot
//             number and a scanner serial both blocked filing. Now requires a
//             cue (ssn / social security / tax id / identifier / member /
//             subscriber / policy / account).
//         No rule was weakened to make the number green: a negative control
//         asserts the shorthand corpus still blocks, and the recall tests over
//         the persona and scenario corpora are unchanged.
// 2.24.0 — license-scope-aware templates and capability-tailored coaching:
//         Quick picks / featured scaffolds filtered by clinical role; audit
//         tailor suppresses dentist-judgement required.missing for auxiliaries
//         (scope.author-handoff S3); Byte knowledge gains authorScope; SuperByte
//         receives an AUTHOR LICENSE lens. EDR product seam (edr/product.ts)
//         replaces hard-coded Curve Hero handoff copy for multi-PMS deploys.
// 2.25.0 — the visit narrative: universal-core gains a "Visit narrative"
//         section (narrative-safety / -subjective / -objective) plus a
//         narrative field inside Assessment and inside Plan. These are the
//         second note surface — the free-prose page — brought inside the note,
//         so a note can be written in sentences and still be saved, audited,
//         composed, filed and copied like any other.
//         None of the five is required: runRequiredRule only tests emptiness,
//         so a required prose field is satisfied by any paragraph at all, which
//         is not a gate. The structured fields keep the requirements.
//         The assessment and plan narratives sit INSIDE the dentist-owned
//         sections rather than with the other three, so dentistOwnedKeys picks
//         them up from the module definitions and the scope lock, the audit
//         tailoring and the filing check all cover prose without learning a new
//         rule. Composed notes now carry the narrative headings, which is why
//         this is a ruleset bump and not a UI change.
// 2.25.1 — Help text in five modules stopped shouting: WORKING, DIRECT, NEW,
//          DIFFERENT, WHICH and IS became lower case. No rule, threshold,
//          vocabulary entry or field changed, and no audit output moves. It is
//          a patch rather than a minor because the guard is mechanical — it
//          greps for any diff under src/lib/modules/ — and a stamped report
//          should be able to say which text a clinician was reading, even when
//          the difference is only that it was not being shouted at them.
// 2.25.2 — Two audit FINDING messages stopped shouting: the supervision rule's
//          "require DIRECT supervision" (both the blocking and the advance-notice
//          variant) and the justification rule's "State WHY the buildup was
//          needed". Wording, severity, rule ids and what triggers them are all
//          unchanged — only the capitals. This one is called out separately from
//          2.25.1 because a finding message is rendered in the audit panel AND
//          frozen into the submitted report, so a reader comparing an old filed
//          note with a new one will see the difference and is entitled to know
//          it was typography rather than a changed rule.
export const RULESET_VERSION = "2.25.2";
