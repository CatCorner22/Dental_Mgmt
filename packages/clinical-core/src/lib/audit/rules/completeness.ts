import type { AuditFinding } from "../types";

// Anticipatory completeness: the questions a note's own content raises.
//
// Reactive rules catch what IS written. These catch what the writing PROMISES
// and then fails to deliver — the note mentions imaging, so a later reader
// will ask what it showed; it mentions anesthetic, so a later reader will ask
// how much. Each of these gaps is a documented deposition failure pattern
// (see knowledge/sources/): "RCT complete #30 with local" lost a case not for
// what it said but for everything it implied and left out.
//
// Deliberately conservative: each rule needs a strong TRIGGER (the note
// clearly performed the thing) and fires only when NO satisfying cue appears
// anywhere in the note. S2 — a clinician reviews, fixes, or attests; the
// attest path exists precisely because free text has edge cases no cue list
// anticipates.

interface CompletenessRule {
  id: string;
  trigger: RegExp;
  satisfiedBy: RegExp;
  what: string;
  how: string;
}

const RULES: CompletenessRule[] = [
  {
    id: "complete.imaging-no-interpretation",
    // Images were ACQUIRED — not merely referenced ("reviewed prior BW").
    trigger:
      /\b(?:radiographs?|bitewings?|BWX?s?|PANO|panoramic|FMX|CBCT|periapicals?|PAs?)\b[^.\n]{0,60}\b(?:taken|acquired|exposed|obtained|captured)\b|\b(?:taken|acquired|exposed|obtained|captured)\b[^.\n]{0,60}\b(?:radiographs?|bitewings?|PANO|panoramic|FMX|CBCT|periapicals?)\b/i,
    satisfiedBy:
      /\b(?:interpret|findings?|impression|reveal|shows?|showed|demonstrat|radioluc|radiopac|caries|bone\s+level|within\s+normal|no\s+(?:significant\s+)?(?:pathology|findings?|abnormalit)|WNL|unremarkable|reviewed\s+by\s+(?:the\s+)?(?:dr|dentist|doctor)|referred\s+for\s+interpretation)/i,
    what: "Images were acquired, but the note never says what they showed.",
    how:
      "Record the interpreting dentist's findings — even 'no significant findings' — or the " +
      "referral for interpretation. An image without an interpretation reads as an image nobody looked at."
  },
  {
    id: "complete.anesthetic-no-amount",
    trigger:
      /\b(?:lidocaine|articaine|septocaine|mepivacaine|carbocaine|bupivacaine|marcaine|prilocaine)\b|\blocal\s+anesthe(?:tic|sia)\b[^.\n]{0,40}\b(?:administered|given|delivered|injected)\b/i,
    satisfiedBy: /\b\d+(?:\.\d+)?\s*(?:carpules?|cartridges?|mg|mL|ml)\b|\b(?:one|two|three|four)\s+(?:carpules?|cartridges?)\b/i,
    what: "An anesthetic is named, but no amount is recorded.",
    how:
      "State the amount (carpules or milligrams) and the concentration. The amount administered " +
      "is a Tennessee minimum-record element for pharmaceuticals."
  },
  {
    id: "complete.extraction-no-outcome",
    trigger: /\b(?:extraction|extracted)\b/i,
    satisfiedBy:
      /\b(?:without\s+complication|no\s+complication|uneventful|complication[s]?\s*:|hemostasis|post-?op(?:erative)?\s+instructions?|gauze|socket)\b/i,
    what: "An extraction is documented with no outcome, complications statement, or post-operative instructions.",
    how:
      "State whether a complication was observed during the recorded period, that hemostasis was " +
      "achieved (with the observation), and that post-operative instructions were given. These are " +
      "the first three questions a later reader asks about any extraction."
  },
  {
    id: "complete.rx-no-duration",
    trigger:
      /\b(?:prescribed|prescription|dispensed?)\b[^.\n]{0,80}\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|doxycycline|ibuprofen|naproxen|acetaminophen|hydrocodone|oxycodone|codeine|tramadol|chlorhexidine|fluconazole|nystatin)\b/i,
    satisfiedBy:
      /\b(?:for|x)\s*\d+\s*(?:days?|weeks?)\b|\bday\s+supply\b|\buntil\s+(?:finished|gone|follow)/i,
    what: "A prescription is recorded without a duration or supply.",
    how: "State the course ('for 7 days', '× 5 days', 'until finished'). Dose, frequency, and duration together are what make a prescription reconstructible."
  },
  {
    id: "complete.consent-no-decision",
    trigger: /\b(?:consent|risks?\s+and\s+benefits?|treatment\s+options?)\s+(?:was\s+|were\s+)?(?:discussed|reviewed|presented|explained)\b/i,
    satisfiedBy:
      /\b(?:consented|consent\s+(?:was\s+)?(?:obtained|given|signed|recorded)|agreed|accepted|declined|refused|chose|elected|deferred)\b/i,
    what: "A consent conversation is documented without the patient's decision.",
    how: "Record what the patient decided — agreed, declined, or deferred — in their own terms. A discussion without a decision is half a consent record."
  },
  {
    id: "complete.consent-thin-assertion",
    // Doctors Company: "patient consented" and signed forms are not the conversation.
    // Fires on checkbox theater — assertion without risks, alternatives, or questions.
    trigger:
      /\b(?:patient\s+)?consented\b|\bconsent\s+(?:was\s+)?(?:obtained|given|signed|on\s+file|recorded)\b|\b(?:signed|verbal)\s+consent\b/i,
    satisfiedBy:
      /\b(?:risks?|benefits?|alternatives?|options?|questions?|declined|deferred|teach-?back|understands?|informed\s+of|material\s+risks?|no\s+treatment|consequence)\b/i,
    what: "Consent is asserted, but the note never records what was discussed.",
    how:
      "Name the diagnosis, material risks, alternatives (including no treatment), any patient questions, and the decision. A signature or \"patient consented\" is not the conversation."
  },
  {
    id: "complete.clinical-rationale",
    // Doctors Company #3 insufficient-documentation gap: procedure without documented reasoning.
    trigger:
      /\b(?:crown(?:\s+prep)?|root\s+canal|RCT|endodont|extraction|extracted|SRP|scaling\s+and\s+root\s+planing|root\s+planing|implant\s+placement|bridge\s+prep|core\s+buildup|build-?up|apicoectomy|pulpotomy|pulpectomy|bone\s+graft|sinus\s+(?:lift|augment)|restoration|composite|amalgam|onlay|inlay|veneer)\b/i,
    satisfiedBy:
      /\b(?:because|due\s+to|indicated\s+(?:for|by)|recommended\s+(?:for|because)|in\s+order\s+to|secondary\s+to|based\s+on|given\s+(?:the|patient)|to\s+address|to\s+treat|for\s+treatment\s+of|diagnosed|diagnosis|fracture|recurrent\s+decay|caries|infection|abscess|periodont|bone\s+loss|mobility|radiolucen|radiopaque|symptom|pain|swelling|failed\s+restoration|cracked|broken|non-?restorable|periapical|lesion|defect|defective|leak|secondary\s+caries|deep\s+caries|irreversible\s+pulpitis|necrotic|symptomatic|asymptomatic|moderate|severe|advanced|stage\s+(?:I{1,3}|IV|[1-4]))\b/i,
    what: "A significant procedure is documented without clinical reasoning.",
    how:
      "State why this treatment was indicated — the finding, diagnosis, or symptom it addresses. Procedure codes and billing narratives are not a substitute for clinical rationale."
  },
  {
    id: "complete.referral-loop-open",
    // Doctors Company referral documentation guidance; delayed-diagnosis claim pattern.
    trigger:
      /\b(?:referred|referral\s+(?:to|placed|made|given|pending)|refer\s+to|will\s+refer)\b/i,
    satisfiedBy:
      /\b(?:endodontist|periodontist|oral\s+surgeon|oral\s+surgery|OMFS|orthodont|prosthodont|pedodont|physician|PCP|primary\s+care|specialist|Dr\.|to\s+Dr\b|for\s+(?:evaluation|consult|biopsy|extraction|surgical|periodontal|orthodontic|urgent|stat)|because|due\s+to|regarding|evaluate|periapical|lesion|radiolucen|pain|swelling|abscess|fracture|impacted|interpretation|interpreted|read\s+by)\b/i,
    what: "A referral is documented without naming the recipient or the clinical reason.",
    how:
      "Record to whom (named specialist or service), why (finding or symptom), and urgency when time-sensitive. \"Referral placed\" alone does not close the loop."
  },
  {
    id: "complete.rx-no-indication",
    // Deep-research medication-information gap: drug without why.
    // Deliberately does NOT treat "for 7 days" as an indication.
    trigger:
      /\b(?:prescribed|prescription|dispensed?)\b[^.\n]{0,80}\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|doxycycline|ibuprofen|naproxen|acetaminophen|hydrocodone|oxycodone|codeine|tramadol|chlorhexidine|fluconazole|nystatin)\b/i,
    satisfiedBy:
      /\b(?:to\s+treat|indicated(?:\s+for)?|due\s+to|secondary\s+to|prophylaxis|prophylactic|infection|abscess|cellulitis|pericoronitis|odontalgia|periodont|post-?op(?:erative)?\s+pain|for\s+(?:the\s+)?(?:infection|abscess|pain|swelling|extraction|procedure|odontogenic))\b/i,
    what: "A prescription is recorded without a clinical indication.",
    how:
      "State why the drug was prescribed — the infection, pain, prophylaxis, or other indication. Duration alone does not explain the clinical reason."
  },
  {
    id: "complete.finding-no-disposition",
    // Soft-tissue / radiographic finding without a closed loop (deep-research open-loop taxonomy).
    // "No lesions" is satisfied by the negation cue so clean exams stay silent.
    trigger: /\b(?:lesion|ulceration|ulcer|radiolucency|PARL)\b/i,
    satisfiedBy:
      /\b(?:refer(?:ral|red)?|biopsy|monitor(?:ed|ing)?|recheck|disclosed|discussed|scheduled|observ(?:e|ed|ation)|follow-?ups?|no\s+(?:lesions?|ulcers?|radiolucenc(?:y|ies)))\b/i,
    what: "A soft-tissue or radiographic finding is recorded without a disposition.",
    how:
      "Close the loop: disclosed to the patient, monitored with a recheck plan, biopsied, or referred. A finding alone is an open clinical loop."
  },
  {
    id: "complete.procedure-no-followup",
    // FOLLOWUP_MISSING for significant procedures (advisor pillars made auditable).
    // Hygiene-only and simple restorative notes deliberately do not trigger.
    trigger:
      /\b(?:crown(?:\s+prep)?|root\s+canal|RCT|endodont|extraction|extracted|SRP|scaling\s+and\s+root\s+planing|root\s+planing|implant\s+placement|bridge\s+prep|apicoectomy|pulpotomy|pulpectomy|bone\s+graft|sinus\s+(?:lift|augment))\b/i,
    satisfiedBy:
      /\b(?:follow-?ups?|recall|RTC|return\s+(?:to|in)|next\s+visit|second\s+visit|re-?eval(?:uation|uate[ds]?)?|referral|referred|come\s+back|(?:in|within)\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)(?:\s*-\s*|\s+to\s+)?(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)?\s*(?:days?|weeks?|months?)|seat(?:ing)?\s+(?:visit|appointment))\b/i,
    what: "A significant procedure is documented without a follow-up plan.",
    how:
      "State the next step — recall interval, return visit, seating appointment, or referral. Treatment without a planned next contact leaves an open safety loop."
  }
];

export function runCompletenessRules(text: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const rule of RULES) {
    if (!new RegExp(rule.trigger.source, rule.trigger.flags).test(text)) continue;
    if (new RegExp(rule.satisfiedBy.source, rule.satisfiedBy.flags).test(text)) continue;
    findings.push({
      ruleId: rule.id,
      category: "required",
      severity: "S2",
      message: `${rule.what} A later reader — a colleague, an auditor, an attorney — will ask.`,
      suggestion: rule.how,
      occurrences: 1
    });
  }
  return findings;
}
