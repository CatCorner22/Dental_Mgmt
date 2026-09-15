// Increment 0.1 expansion — module-mapped, cited entries concatenated into
// KNOWLEDGE. Categories: completeness, justification, medication safety,
// Tennessee license scope (including Public Chapter 1107), claim-narrative,
// and named omission licences.
//
// Predicates are total: they read the context and return a boolean. They
// never throw. They are written not to steal the original 23 fixtures' top
// advice slots (narrower triggers, complementary gaps).

import type { AdvisorContext, KnowledgeEntry } from "./knowledge";

const mentions = (ctx: AdvisorContext, ...needles: string[]): boolean =>
  needles.some((n) => ctx.lower.includes(n));

const hasAffirmedProcedure = (ctx: AdvisorContext, category: string): boolean =>
  ctx.facts.some(
    (f) => f.kind === "procedure" && f.category === category && f.assertion.polarity === "affirmed"
  );

const hasCareEvent = (ctx: AdvisorContext, needle: string): boolean =>
  ctx.facts.some((f) => f.kind === "care-event" && f.event.includes(needle));

export const KNOWLEDGE_EXPANSION: KnowledgeEntry[] = [
  // --- Completeness (imaging module) ---------------------------------------
  {
    id: "byte.imaging-pano-or-cone-beam",
    say: "A panoramic or cone-beam study needs a written reading, not only that it was exposed.",
    why:
      "Tennessee includes radiographs and their interpretations in the dental record. " +
      "Naming the exposure documents radiation; naming who read the study and what they " +
      "saw documents the diagnostic act. An unread image is an open loop a later dentist " +
      "cannot close from this chart alone.",
    source: "Tenn. Comp. R. 0460-02-.12 (radiographs and interpretations); complete.imaging-no-interpretation",
    priority: 74,
    nextAction: "Record the interpreting dentist's findings, or that interpretation is pending with an owner.",
    when: (ctx) =>
      mentions(ctx, "panoramic", "cone-beam", "cone beam", "cbct") &&
      mentions(ctx, "taken", "acquired", "exposed", "obtained", "captured") &&
      !mentions(ctx, "interpret", "reviewed by", "read by", "impression", "findings", "unremarkable")
  },

  // --- Completeness (communication-followup / consent) ---------------------
  {
    id: "byte.consent-teach-back",
    say: "Risks are on the page. Did the patient show they understood them?",
    why:
      "A list of risks proves they were spoken. Teach-back — the patient restating the " +
      "material risks and the option of no treatment in their own words — is what " +
      "Agency for Healthcare Research and Quality guidance treats as evidence of " +
      "understanding. Sanders turned on the conversation, not the form.",
    source: "AHRQ teach-back guidance; Sanders (Tenn. Ct. App. 1997); The Doctors Company consent items",
    priority: 52,
    nextAction: "Add one sentence: the patient restated the material risks and chose the plan.",
    when: (ctx) =>
      mentions(ctx, "consent") &&
      mentions(ctx, "risk") &&
      !mentions(ctx, "teach-back", "teach back", "restated", "understands", "in their own words")
  },

  // --- Completeness (communication-followup / referral) --------------------
  {
    id: "byte.referral-timeframe",
    say: "The specialist is named. The loop still wants a timeframe or urgency.",
    why:
      "A named recipient answers to whom. Delayed-diagnosis claims still ask when the " +
      "patient was expected to be seen. Routine, soon, or urgent — one word — turns a " +
      "hand-off into a timed act of care. D'Amour is the delayed-diagnosis lesson.",
    source: "D'Amour v. Bd. of Registration in Dentistry, 409 Mass. 572 (1991); CNA referral documentation guidance",
    priority: 48,
    nextAction: "Add urgency or a return window: routine, soon, or urgent, and why.",
    when: (ctx) =>
      (hasCareEvent(ctx, "referral") || mentions(ctx, "referred", "referral")) &&
      mentions(ctx, "endodontist", "periodontist", "oral surg", "orthodont", "specialist") &&
      !mentions(ctx, "urgent", "stat", "soon", "routine", "within", "days", "weeks", "timeframe")
  },

  // --- Completeness (oral-medicine / finding disposition) ------------------
  {
    id: "byte.radiolucency-disposition",
    say: "A radiolucency without a next step is an open diagnostic loop.",
    why:
      "The integrity digest treats an unreferred, unmonitored radiographic finding the " +
      "same way D'Amour treated an undiscussed lesion: observed, then dropped. Disposition " +
      "is one sentence — disclosed, referred, scheduled for review, or biopsy planned.",
    source:
      "D'Amour v. Bd. of Registration in Dentistry, 409 Mass. 572 (1991); complete.finding-no-disposition",
    priority: 71,
    nextAction: "Close the loop: disclose, refer, monitor with a recheck, or plan biopsy.",
    when: (ctx) =>
      mentions(ctx, "radiolucen", "radiopaque", "periapical lucency") &&
      !mentions(ctx, "refer", "biopsy", "monitor", "recheck", "disclosed", "discussed", "scheduled", "no radiolucen")
  },

  // --- Completeness (extraction / aftercare quality) -----------------------
  {
    id: "byte.aftercare-verbal-and-written",
    say: "Aftercare is mentioned. Was it given verbally and in writing?",
    why:
      "Schwarcz stood on missing disclosure and missing complication documentation, not " +
      "on the extraction itself. A single word \"instructions\" does not say how they " +
      "were delivered. Verbal plus written is the reconstructible form a later reader " +
      "can defend.",
    source: "Bureau of Health Care Servs. v. Schwarcz (Mich. Ct. App. 2015); complete.extraction-no-outcome",
    priority: 54,
    nextAction: "State that post-operative instructions were given verbally and in writing.",
    when: (ctx) =>
      hasAffirmedProcedure(ctx, "surgical") &&
      mentions(ctx, "post-op", "postoperative", "post-operative") &&
      !(mentions(ctx, "verbal") && mentions(ctx, "writ"))
  },

  // --- Completeness (medication / anesthetic amount) -----------------------
  {
    id: "byte.anesthetic-amount-stated",
    say: "An anesthetic is named. The amount is still missing.",
    why:
      "Tennessee's minimum pharmaceutical record wants what was given, not only the " +
      "drug name. A carpule count or a milligram total is what makes the later arithmetic " +
      "possible. Concentration without amount still leaves the dose uncomputable.",
    source: "Tenn. Comp. R. 0460-02-.12 (pharmaceuticals in the dental record); complete.anesthetic-no-amount",
    priority: 77,
    nextAction: "Add carpules or milligrams next to the anesthetic name.",
    when: (ctx) =>
      mentions(ctx, "lidocaine", "articaine", "mepivacaine", "bupivacaine", "prilocaine") &&
      !/\b\d+(?:\.\d+)?\s*(?:carpules?|cartridges?|mg|mL|ml)\b/i.test(ctx.text) &&
      !/\b(?:one|two|three|four)\s+(?:carpules?|cartridges?)\b/i.test(ctx.text)
  },

  // --- Completeness (medication / prescription duration) -------------------
  {
    id: "byte.rx-duration",
    say: "This prescription has a drug and no course length.",
    why:
      "Name, strength, and frequency reconstruct the order only when duration is " +
      "present. Medication-information gaps are a documented integrity pattern. " +
      "\"For seven days\" or \"until finished\" is the missing third number.",
    source: "documentation-integrity-deep-research.md; complete.rx-no-duration; ISMP patient-information guidance",
    priority: 73,
    nextAction: "Add the course length: a day count, or until finished.",
    when: (ctx) =>
      /\b(?:prescribed|prescription|dispensed?)\b/i.test(ctx.text) &&
      /\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|ibuprofen|hydrocodone|oxycodone)\b/i.test(
        ctx.text
      ) &&
      !/\b(?:for|x)\s*\d+\s*(?:days?|weeks?)\b/i.test(ctx.text) &&
      !/\b(?:day\s+supply|until\s+(?:finished|gone))\b/i.test(ctx.text)
  },

  // --- Completeness (communication-followup / procedure follow-up) ---------
  {
    id: "byte.significant-procedure-next-visit",
    say: "A significant procedure is here. When does this patient return?",
    why:
      "The integrity digest lists missing follow-up as an open safety loop. A crown " +
      "seat, a root-canal finish, or an implant placement without a next contact " +
      "leaves the later reader unable to see the planned continuity of care.",
    source: "documentation-integrity-deep-research.md; complete.procedure-no-followup; Tenn. Comp. R. 0460-02-.12",
    priority: 50,
    nextAction: "Name the next visit, recall interval, or seating appointment.",
    when: (ctx) =>
      mentions(ctx, "root canal", "implant placement", "apicoectomy", "bone graft") &&
      !mentions(ctx, "follow-up", "follow up", "recall", "return", "next visit", "re-eval", "referred")
  },

  // --- Justification (fixed-prosthodontic / crown) -------------------------
  {
    id: "byte.crown-structural-necessity",
    say: "A crown was seated or delivered. The structural why is still missing.",
    why:
      "Carrier reviewers read the narrative, not the operatory. A seated crown without " +
      "the fractured cusp, the extensive decay, or the endodontic history reads as a " +
      "billing line. The finding lives in the exam; the narrative has to carry it.",
    source: "The Doctors Company closed dental claims 2010–2020; justify.crown-necessity; CNA claim-file criteria",
    priority: 58,
    authorScope: "dentist",
    nextAction: "Name the fracture, extensive decay, failed restoration, or endodontic history.",
    when: (ctx) =>
      /\bcrown\s+(?:seated|delivered|cemented|placed)\b/i.test(ctx.text) &&
      !/\b(?:fracture|cracked|cusp|undermined|extensive|failed\s+restoration|root\s+canal|endodontic|wear|caries|decay)\b/i.test(
        ctx.text
      )
  },

  // --- Justification (periodontal / scaling and root planing) --------------
  {
    id: "byte.srp-periodontal-numbers",
    say: "Scaling and root planing is named. The pocket numbers are not.",
    why:
      "Payers who review scaling and root planing look for probing depths at or beyond " +
      "four millimetres and for bone or attachment loss in the same narrative. A " +
      "procedure name without those measurements is a code without evidence.",
    source: "justify.srp-periodontal-evidence; CNA/Dentist's Advantage periodontal claim criteria",
    priority: 57,
    authorScope: "dentist",
    nextAction: "Point at probing depths of four millimetres or deeper and the bone or attachment loss.",
    when: (ctx) =>
      /\b(?:scaling\s+and\s+root\s+planing|root\s+planing)\b/i.test(ctx.text) &&
      !/\b[4-9](?:\.\d+)?\s*mm\b/i.test(ctx.text) &&
      !mentions(ctx, "bone loss", "attachment loss", "clinical attachment")
  },

  // --- Justification (operative / core buildup) ----------------------------
  {
    id: "byte.core-buildup-retention",
    say: "A core buildup needs the retention story in the tooth's own facts.",
    why:
      "Carriers ask why a buildup was required: insufficient remaining tooth structure " +
      "after excavation, or a fracture that removed it. \"Buildup placed\" names the " +
      "act and hides the indication.",
    source: "justify.buildup-retention; The Doctors Company clinical-rationale gap (51 of 172 items)",
    priority: 56,
    authorScope: "dentist",
    nextAction: "State insufficient retentive tooth structure, or the fracture that removed it.",
    when: (ctx) =>
      /\b(?:core\s+build-?up|build-?up)\b/i.test(ctx.text) &&
      !/\b(?:insufficient|inadequate|fracture|undermined|retentive|structure)\b/i.test(ctx.text)
  },

  // --- Justification (extraction / indication) -----------------------------
  {
    id: "byte.extraction-clinical-why",
    say: "An extraction is recorded. The clinical why is still off the page.",
    why:
      "Tennessee Board actions enforcing Rule 0460-02-.12 treated missing record " +
      "elements as independently disciplinable. A tooth number plus \"extracted\" " +
      "does not tell the next dentist — or a reviewer — whether the indication was " +
      "non-restorable caries, fracture, or periodontal hopelessness.",
    source: "Tenn. Comp. R. 0460-02-.12; Tennessee Board of Dentistry, Jones (2018); complete.clinical-rationale",
    priority: 59,
    authorScope: "dentist",
    nextAction: "Add the finding that made the tooth non-restorable or otherwise indicated for removal.",
    when: (ctx) =>
      /\b(?:extraction|extracted)\b/i.test(ctx.text) &&
      !/\b(?:because|due\s+to|indicated|non-?restorable|hopeless|fracture|caries|infection|periodont|pain|abscess)\b/i.test(
        ctx.text
      )
  },

  // --- Med-safety (pediatric / weight in kilograms) ------------------------
  {
    id: "byte.weight-based-dose-needs-kg",
    say: "A per-kilogram dose is on the page. The weight in kilograms is not.",
    why:
      "Joint Commission Sentinel Event Alert 39 and Institute for Safe Medication " +
      "Practices guidance exist because a pounds figure read as kilograms more than " +
      "doubles the dose. A milligram-per-kilogram line without a kilogram weight " +
      "cannot be checked by anyone, including you later.",
    source: "Joint Commission Sentinel Event Alert 39; ISMP pediatric dosing guidance; medsafe.lb-with-mg-per-kg",
    priority: 86,
    nextAction: "Write the dosing weight in kilograms next to the per-kilogram figure.",
    when: (ctx) =>
      /\bmg\s*\/\s*kg\b/i.test(ctx.text) && !/\b\d+(?:\.\d+)?\s*kg\b/i.test(ctx.text)
  },

  // --- Med-safety (medication / allergy line on antibiotics) ---------------
  {
    id: "byte.antibiotic-allergy-line",
    say: "An antibiotic is prescribed. The allergy line for this visit is missing.",
    why:
      "The allergy sentence is the safety line a later prescriber will trust or " +
      "discard. Institute for Safe Medication Practices treats an unverified allergy " +
      "history as a rumor. Name the allergy, or write that no known drug allergies " +
      "were verified today.",
    source: "Tenn. Comp. R. 0460-02-.12 (concise medical history); ISMP allergy documentation",
    priority: 79,
    nextAction: "Write the allergy verified today, or that no known drug allergies were verified today.",
    when: (ctx) =>
      /\b(?:prescribed|prescription|dispensed?)\b/i.test(ctx.text) &&
      mentions(ctx, "amoxicillin", "penicillin", "clindamycin", "azithromycin", "metronidazole") &&
      !mentions(ctx, "allerg", "nkda", "nka", "no known")
  },

  // --- Med-safety (medication / opioid CSMD date) --------------------------
  {
    id: "byte.opioid-csmd-dated",
    say: "The monitoring-database check is mentioned. The date of the check is not.",
    why:
      "Tennessee Code annotated section 53-10-310 requires the Controlled Substance " +
      "Monitoring Database check before an opioid is prescribed. A check without a " +
      "date is a check a reviewer cannot place in time. One dated line closes it.",
    source: "Tenn. Code Ann. § 53-10-310; TN Department of Health opioid prescribing guidance",
    priority: 64,
    nextAction: "Add the date of the database check and what was found.",
    when: (ctx) =>
      mentions(ctx, "hydrocodone", "oxycodone", "codeine", "tramadol", "opioid", "percocet", "norco") &&
      mentions(ctx, "csmd", "pmp", "monitoring database") &&
      !mentions(ctx, "checked today", "reviewed today", "date", "dated")
  },

  // --- Med-safety (oral-medicine / premedication decision) -----------------
  {
    id: "byte.premed-decision-recorded",
    say: "Premedication is on the page. The decide-and-why sentence is not.",
    why:
      "American Heart Association guidance narrowed prophylaxis to specific cardiac " +
      "conditions. American Dental Association and American Academy of Orthopaedic " +
      "Surgeons criteria no longer treat most joints as routine prophylaxis. The " +
      "chart needs the decision, not only the word premedication.",
    source: "American Heart Association endocarditis-prevention guidance; ADA/AAOS appropriate-use criteria",
    priority: 62,
    nextAction: "Write indicated or not indicated, and which guidance the decision followed.",
    when: (ctx) =>
      mentions(ctx, "premed", "premedication") &&
      !mentions(ctx, "not indicated", "indicated per", "withheld", "given because")
  },

  // --- Med-safety (nitrous / recovery on oxygen) ---------------------------
  {
    id: "byte.nitrous-recovery-on-oxygen",
    say: "Nitrous has a percent. Recovery on one hundred percent oxygen is still missing.",
    why:
      "Tennessee sedation-record rules and the American Academy of Pediatric Dentistry " +
      "nitrous guideline want concentration, duration, and recovery on oxygen before " +
      "dismissal. A percent without recovery documents delivery and not safe emergence.",
    source: "Tenn. Comp. R. 0460-02-.07 (sedation records); AAPD nitrous oxide guideline",
    priority: 69,
    nextAction: "Add duration and recovery on one hundred percent oxygen before dismissal.",
    when: (ctx) =>
      mentions(ctx, "nitrous", "n2o") &&
      /\d+\s*%/.test(ctx.text) &&
      !mentions(ctx, "recover", "oxygen", "100%")
  },

  // --- Med-safety (sedation-anesthesia / published ceiling) ----------------
  {
    id: "byte.local-anesthetic-ceiling",
    say: "Local anesthetic is here without concentration. The published ceiling cannot be applied.",
    why:
      "Malamed tables state both a milligram-per-kilogram ceiling and an absolute " +
      "milligram ceiling. Volume without concentration cannot be converted. The " +
      "practice's anesthetic-dose rule will not invent the missing percent.",
    source: "Malamed Handbook of Local Anesthesia dose tables; anesthetic-dose rule (ruleset 2.13.0)",
    priority: 84,
    nextAction: "State the percent concentration next to the volume or carpule count.",
    when: (ctx) =>
      mentions(ctx, "lidocaine", "articaine", "mepivacaine", "bupivacaine") &&
      mentions(ctx, "administered", "given", "injected") &&
      !/\d+(?:\.\d+)?\s*%/.test(ctx.text)
  },

  // --- Tennessee scope (hygienist records findings, not diagnosis) ---------
  {
    id: "byte.hygienist-does-not-diagnose",
    say: "A diagnosis word is in this hygiene draft. That sentence belongs to the dentist.",
    why:
      "Tennessee Code annotated section 63-5-108(c) lets a hygienist record clinical " +
      "findings and measurements for diagnosis by the dentist. It does not authorize " +
      "the hygienist to diagnose or to write the treatment plan. Move that sentence " +
      "to Objective, and leave Assessment for the dentist.",
    source: "Tenn. Code Ann. § 63-5-108(c)(3); Tenn. Comp. R. & Regs. 0460-03-.09(7)(a)",
    priority: 67,
    authorScope: "hygienist",
    nextAction: "Rewrite the diagnosis line as a finding. Leave Assessment empty for the dentist.",
    when: (ctx) =>
      mentions(ctx, "diagnosis", "diagnosed", "treatment plan", "i diagnose", "my diagnosis")
  },

  // --- Tennessee scope (assistant attribution / no judgement) --------------
  {
    id: "byte.assistant-no-clinical-judgement",
    say: "Assessment or diagnosis language is in an assistant draft. That is dentist work.",
    why:
      "Tennessee Code annotated section 63-5-108(d) limits an assistant to documenting " +
      "what they performed and observed under dentist direction. A diagnosis or a plan " +
      "written in an assistant's voice documents an act outside that license.",
    source: "Tenn. Code Ann. § 63-5-108(d); Tenn. Comp. R. & Regs. 0460-04 (dental assistants)",
    priority: 67,
    authorScope: "assistant",
    nextAction: "Record what you did and saw. Ask the dentist to write Assessment and Plan.",
    when: (ctx) =>
      mentions(ctx, "diagnosis", "diagnosed", "assessment:", "treatment plan", "i recommend")
  },

  // --- Tennessee scope (dentist-owned assessment and plan) -----------------
  {
    id: "byte.dentist-owns-assessment-plan",
    say: "Hygiene measurements are here. Assessment and Plan are still the dentist's to write.",
    why:
      "The practice locks Assessment and Plan as dentist-owned sections because " +
      "Tennessee reserves diagnosis and treatment planning to the dentist. Probing " +
      "depths and bleeding points are the hygienist's facts; the diagnosis sentence " +
      "is yours.",
    source: "Tenn. Code Ann. § 63-5-108(c); Tenn. Comp. R. & Regs. 0460-02-.12; 0460-03-.09",
    priority: 49,
    authorScope: "dentist",
    nextAction: "Add the dentist's assessment and plan, or leave those sections for your own entry.",
    when: (ctx) =>
      (mentions(ctx, "probing", "bleeding on probing", "prophylaxis") || ctx.kinds.has("measurement")) &&
      !mentions(ctx, "assessment", "diagnosis", "plan:", "treatment plan")
  },

  // --- Tennessee scope (Public Chapter 1107 supervision heads-up) ----------
  {
    id: "byte.pc1107-new-patient-supervision",
    say: "New-patient hygiene work: Public Chapter 1107 will want direct supervision on the record.",
    why:
      "Public Chapter 1107 of 2026 takes effect in 2027. From that effective date, a " +
      "hygienist completing diagnostic radiographs, hard- or soft-tissue data, " +
      "prophylaxis, or fluoride for a new patient must be under direct supervision of " +
      "a dentist who has seen that patient. Record patient status and supervision now " +
      "so the habit exists before the date arrives.",
    source: "Public Chapter 1107 (2026), effective 2027; Tenn. Comp. R. 0460 supervision; supervision.pc1107-new-patient",
    priority: 76,
    authorScope: "hygienist",
    nextAction: "Record patient status and whether supervision was direct, with the dentist who saw the patient.",
    when: (ctx) =>
      mentions(ctx, "new patient", "new-patient", "first visit") &&
      mentions(ctx, "prophylaxis", "prophy", "fluoride", "radiograph", "probing", "periodont") &&
      !mentions(ctx, "direct supervision", "dentist saw", "dentist examined")
  },

  // --- Claim-narrative (never billing-only language) -----------------------
  {
    id: "byte.claim-not-billing-only",
    say: "This line reads as a billing phrase. Attach the clinical finding it stands on.",
    why:
      "Centers for Medicare and Medicaid Services and the American Dental Association " +
      "treat the chart as evidence when a claim is challenged. A sentence that only " +
      "names a billed service, without the finding that made the service necessary, " +
      "is the documentation-integrity pattern called coding divergence.",
    source:
      "documentation-integrity-deep-research.md (payment-support function); CMS/ADA chart-as-evidence; The Doctors Company",
    priority: 44,
    authorScope: "dentist",
    nextAction: "Rewrite the billing phrase as a finding plus the procedure it indicated.",
    when: (ctx) =>
      mentions(ctx, "billed", "for insurance", "claim narrative", "procedure code") &&
      !mentions(ctx, "because", "due to", "indicated", "finding", "diagnosis", "caries", "fracture")
  },

  // --- Claim-narrative (attach finding to procedure class) -----------------
  {
    id: "byte.procedure-class-needs-finding",
    say: "A prosthodontic or periodontal act is named. The supporting finding is not.",
    why:
      "The note is the claim's evidence. Current Dental Terminology class lives in the " +
      "practice-management system; the narrative written here still has to attach a " +
      "finding to that class so a reviewer can see necessity. Procedure name alone is " +
      "not a clinical rationale.",
    source: "The Doctors Company (1,185 dental claims, 2010–2020); justify.* narrative rules; CMS documentation integrity",
    priority: 45,
    authorScope: "dentist",
    nextAction: "Name the finding (pocket, fracture, decay, bone loss) next to the procedure class.",
    when: (ctx) =>
      (hasAffirmedProcedure(ctx, "prosthodontic") || hasAffirmedProcedure(ctx, "periodontal")) &&
      !ctx.facts.some((f) => f.kind === "finding") &&
      !mentions(ctx, "caries", "fracture", "pocket", "bone loss", "decay", "indicated")
  },

  // --- Omission licences (no treatment performed) --------------------------
  {
    id: "byte.silence-licensed-no-treatment",
    say: "If no treatment was performed, say so in a sentence. Silence is not a licence.",
    why:
      "Named omission licences come from emergency-dispatch protocol: a question may " +
      "be skipped only when the skip is enumerated. \"No treatment performed\" is a " +
      "licence. An empty treatment paragraph is not, and a later reader cannot tell " +
      "omission from forgetfulness.",
    source:
      "Medical Priority Dispatch System named omission licences; high-stakes-documentation-patterns.md; Tenn. Comp. R. 0460-02-.12",
    priority: 42,
    nextAction: "Write \"No treatment performed this visit.\" if that is what happened.",
    when: (ctx) =>
      mentions(ctx, "exam", "evaluation", "consultation", "limited exam", "periodic") &&
      !hasAffirmedProcedure(ctx, "restorative") &&
      !hasAffirmedProcedure(ctx, "surgical") &&
      !hasAffirmedProcedure(ctx, "endodontic") &&
      !hasAffirmedProcedure(ctx, "periodontal") &&
      !mentions(ctx, "no treatment", "not performed", "not applicable", "observation only")
  },

  // --- Omission licences (diagnostic-only visit) ---------------------------
  {
    id: "byte.silence-licensed-diagnostic-visit",
    say: "A diagnostic-only visit does not owe aftercare theater. It owes a clear licence.",
    why:
      "Reader pillars apply once treatment is documented. A diagnostic visit that " +
      "invents post-operative instructions to look complete is fabricating content. " +
      "Write that the visit was diagnostic only, or that treatment was not performed. " +
      "That silence is licensed because it is named.",
    source:
      "documentation-integrity-deep-research.md (do not invent clinical facts); GOV.UK not-knowing-as-a-valid-answer; Tenn. Comp. R. 0460-02-.12",
    priority: 41,
    nextAction: "Write that this visit was diagnostic only, and skip invented aftercare.",
    when: (ctx) =>
      (hasAffirmedProcedure(ctx, "diagnostic") || mentions(ctx, "periodic exam", "limited exam", "consultation only")) &&
      mentions(ctx, "post-op", "postoperative", "gauze", "sutures") &&
      !hasAffirmedProcedure(ctx, "surgical") &&
      !hasAffirmedProcedure(ctx, "restorative")
  },

  // --- Omission licences (not applicable is a sentence) --------------------
  {
    id: "byte.not-applicable-is-a-sentence",
    say: "\"Not applicable\" is a licence only when it is a whole sentence with a subject.",
    why:
      "The four-state field model is: affirmatively present, affirmatively absent, " +
      "not applicable, or not documented. A fragment dropped in a box is not the " +
      "same as \"Fluoride not applicable; no treatment performed.\" Tennessee Board " +
      "actions on Rule 0460-02-.12 treated missing elements as missing, not as implied none.",
    source:
      "Tennessee Board of Dentistry, Lubovich (2018); DES-12 four-state field model; Tenn. Comp. R. 0460-02-.12",
    priority: 38,
    nextAction: "Rewrite the fragment as a sentence: what is not applicable, and why this visit.",
    when: (ctx) =>
      /\b(?:n\/a|not appl)\b/i.test(ctx.text) &&
      !/\bnot applicable[.;:]/i.test(ctx.text)
  },

  // --- Omission licences (not documented is not none) ----------------------
  {
    id: "byte.not-documented-is-not-none",
    say: "\"None\" and \"within normal limits\" are claims. \"Not documented\" is a different claim.",
    why:
      "The owner legal blueprint states the rule in one line: not documented must " +
      "never be silently transformed into none. Brewer and Cordice show Rule " +
      "0460-02-.12 enforced as a list of required elements, not as a suggestion. " +
      "If nobody looked, write not assessed. If it does not arise, write not applicable.",
    source:
      "Tennessee Board of Dentistry, Brewer (2020) and Cordice (2018); DES-12 four-state field model; Tenn. Comp. R. 0460-02-.12",
    priority: 39,
    nextAction: "Replace a bare none with not assessed, not applicable, or the actual finding.",
    when: (ctx) =>
      /\b(?:wnl|within normal limits|\bnone\b)\b/i.test(ctx.text) &&
      !mentions(ctx, "not assessed", "not applicable", "not documented", "not examined")
  },

  // --- Late-entry module ---------------------------------------------------
  {
    id: "byte.late-entry-names-the-gap",
    say: "A late entry must say it is late, what it adds, and that the original still stands.",
    why:
      "Tennessee wants an addendum, never an overwrite. A late sentence that does not " +
      "identify itself as late reads as if it were written at the visit. Spoliation " +
      "doctrine treats silent alteration as consciousness of a problem even when the " +
      "care was fine.",
    source: "Tenn. Comp. R. 0460-02-.12; litigation-documentation-research.md (spoliation); late-entry module",
    priority: 63,
    nextAction: "Label this an addendum, say what it corrects, and state the original entry remains.",
    when: (ctx) =>
      mentions(ctx, "late entry", "late-entry", "entered later") &&
      !mentions(ctx, "addendum", "original entry remains", "not backdated")
  },

  // --- Pathology-result / biopsy loop --------------------------------------
  {
    id: "byte.biopsy-result-loop",
    say: "A biopsy is documented. The result or a pending owner is not.",
    why:
      "Pathology without a result and without a named person waiting for it is another " +
      "open loop. D'Amour is the delayed-diagnosis shape. Write the result, or write " +
      "pending with who will call the patient when it arrives.",
    source: "D'Amour v. Bd. of Registration in Dentistry, 409 Mass. 572 (1991); complete.finding-no-disposition",
    priority: 61,
    nextAction: "Record the pathology result, or pending with the owner who will disclose it.",
    when: (ctx) =>
      mentions(ctx, "biopsy", "biopsied") &&
      !mentions(ctx, "result", "pending", "awaiting", "pathology report", "benign", "malignant")
  },

  // --- Implant module ------------------------------------------------------
  {
    id: "byte.implant-system-without-identifier-cue",
    say: "An implant was placed. The system and a lot or reference belong in the note.",
    why:
      "A later explant or a recall needs the system and a traceable reference. Write " +
      "the manufacturer and lot in words. Do not paste a long digit run that looks " +
      "like an identifier the privacy screen must stop.",
    source: "Tenn. Comp. R. 0460-02-.12 (materials in the record); FDA medical-device identification guidance",
    priority: 47,
    authorScope: "dentist",
    nextAction: "Name the implant system and a short lot or reference, not a long digit string.",
    when: (ctx) =>
      mentions(ctx, "implant placed", "implant placement", "fixture placed") &&
      !mentions(ctx, "lot", "system", "manufacturer", "reference", "nobel", "straumann", "zimmer")
  },

  // --- Emergency module ----------------------------------------------------
  {
    id: "byte.emergency-next-contact",
    say: "An urgent swelling or abscess is on the page. The next contact is not.",
    why:
      "Emergency notes are judged on the next safe contact, not on procedure volume. " +
      "The Doctors Company referral and follow-up gaps recur in delayed-diagnosis " +
      "files. Name when the patient returns, or to whom they were sent, and how soon.",
    source: "The Doctors Company referral documentation guidance; complete.procedure-no-followup; CNA emergency-care documentation",
    priority: 68,
    nextAction: "Write the return window or the named urgent referral.",
    when: (ctx) =>
      mentions(ctx, "abscess", "cellulitis", "facial swelling", "emergency") &&
      !mentions(ctx, "follow-up", "follow up", "return", "referred", "recall", "tomorrow", "urgent")
  },

  // --- Teledentistry module ------------------------------------------------
  {
    id: "byte.teledentistry-patient-location",
    say: "A remote visit needs where the patient was, and who provided the service.",
    why:
      "A teledentistry encounter is still a Tennessee dental record. Location of the " +
      "patient and identity of the treating dentist are what make supervision and " +
      "jurisdiction reconstructible. \"Virtual visit\" alone is a channel, not a record.",
    source: "Tenn. Comp. R. 0460-02-.12; Tenn. Code Ann. § 63-5-108; ADA teledentistry policy statement",
    priority: 46,
    nextAction: "Name the patient's location during the visit and the treating dentist.",
    when: (ctx) =>
      mentions(ctx, "teledentistry", "tele-dentistry", "virtual visit", "remote exam", "video visit") &&
      !mentions(ctx, "located", "location", "in tennessee", "at home", "treating dentist")
  },

  // --- Records request (Tenn. Code Ann. § 63-2-101) ------------------------
  {
    id: "byte.records-request-full-chart",
    say: "A records request is noted. Tennessee wants the full record, not only a summary.",
    why:
      "Tennessee Code annotated section 63-2-101 requires the record to be furnished " +
      "within ten working days of a written request. A summary does not satisfy the " +
      "right to the full record. Write that the full chart was sent, and that a " +
      "summary if offered was extra, not a substitute.",
    source: "Tenn. Code Ann. § 63-2-101 (access within ten working days); DES-12 legal blueprint",
    priority: 53,
    nextAction: "State that the full record was provided, and the working-day window.",
    when: (ctx) =>
      mentions(ctx, "records request", "requested records", "copy of records", "chart request") &&
      !mentions(ctx, "full record", "ten working", "complete chart")
  },

  // --- Endodontic module (rationale already partly covered; working length) -
  {
    id: "byte.endodontic-working-length",
    say: "A root canal is documented. Working length or the obturation endpoint is not.",
    why:
      "Another endodontist — or a later claim reviewer — reconstructs the visit from " +
      "working length, canal findings, and how the canals were filled. \"Root canal " +
      "completed\" is a status, not a record of the work.",
    source: "Tenn. Comp. R. 0460-02-.12; The Doctors Company endodontic claim patterns; complete.clinical-rationale",
    priority: 51,
    authorScope: "dentist",
    nextAction: "Add working length, canal findings, and how obturation was completed.",
    when: (ctx) =>
      mentions(ctx, "root canal", "pulpectomy", "obturation") &&
      !mentions(ctx, "working length", "to length", "obturation", "filled to")
  },

  // --- Pediatric module (weight already covered; guardian consent) ---------
  {
    id: "byte.pediatric-guardian-consent",
    say: "A pediatric procedure is here. Who consented, and in what role?",
    why:
      "A child's consent record is the guardian conversation: who was present, what " +
      "was explained, and what they decided. A signed form without the adult's role " +
      "does not reconstruct the conversation Sanders required.",
    source: "Sanders (Tenn. Ct. App. 1997); The Doctors Company informed-consent items; AAPD behavior-guidance guideline",
    priority: 58,
    nextAction: "Name the accompanying adult, their relationship, and the decision they made.",
    when: (ctx) =>
      mentions(ctx, "pediatric", "child", "pulpotomy") &&
      mentions(ctx, "consent") &&
      !mentions(ctx, "parent", "guardian", "mother", "father", "caregiver")
  },

  // --- Communication: informed refusal complementary (consequences) --------
  {
    id: "byte.refusal-names-consequences",
    say: "A decline is recorded. The consequences that were explained are not.",
    why:
      "Dentist's Advantage informed-refusal guidance wants three sentences: " +
      "what was recommended, what could happen without it, and the decision in the " +
      "patient's words. A bare \"declined\" is the silence those cases are lost on.",
    source: "CNA/Dentist's Advantage informed-refusal guidance; The Doctors Company referral documentation guidance",
    priority: 55,
    when: (ctx) =>
      mentions(ctx, "refused", "declined") &&
      mentions(ctx, "explained", "informed of", "advised of") &&
      !mentions(ctx, "consequence", "without treatment", "risk of delaying", "could happen")
  }
];
