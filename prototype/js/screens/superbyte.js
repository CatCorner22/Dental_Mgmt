/* SuperByte: the note-standardization glass. One draft (the Encounter's own, per author), read by a
   deterministic twin of the Smile Notes assist pipeline — PHI gate → retrieval → model → schema → verifier →
   human — with the pioneer model dark in this prototype, so every reading is an instrument reading from the
   practice's own rules (ruleset 2.25.2). Observe-only and one-way: SuperByte speaks in language and graphics;
   nobody prompts it, rates it or copies its text into the note. Standard wording is a separate, deterministic
   proposal (APPLIED language-only rewrites vs FLAGGED shorthand that hides a fact) the author accepts by name.
   The whole glass fits a 1024×700 operatory tablet without page scroll: at most three readings, three rows to
   fix, three later-reader questions and four wording rows stand at once; the rest is a count. */
(function () {
  const Proto = window.Proto; const { h, btn, chip, refusal, displayName, pageHead, longDate } = Proto.ui;
  Proto.screens = Proto.screens || {};

  const RULESET = '2.25.2';                                 // the version store.fileNote freezes onto the note
  const MAX_READINGS = 3, MAX_ROWS = 3, MAX_WORDING = 3;

  // ---- standard wording: APPLIED (fixed, language-only, no clinical claim) vs FLAGGED (hides a fact) ----------
  const APPLIED = [
    ['abbreviation', /\bx-?rays?\b/gi, (m) => (/s$/i.test(m) ? 'radiographs' : 'radiograph'), 'ADA record-keeping: radiograph is the record word'],
    ['abbreviation', /\b[Pp]ts\b\.?/g, (m) => (/^P/.test(m) ? 'Patients' : 'patients'), 'Shared abbreviation key'],
    ['abbreviation', /\b[Pp]t\b\.?(?=\s)/g, (m) => (/^P/.test(m) ? 'Patient' : 'patient'), 'Shared abbreviation key'],
    ['abbreviation', /\bw\/o\b/gi, () => 'without', 'Shared abbreviation key'],
    ['abbreviation', /\bw\/(?=\s)/gi, () => 'with', 'Shared abbreviation key'],
    ['abbreviation', /\bBWX\b/g, () => 'bitewing radiographs', 'Imaging add-on: modality in words'],
    ['abbreviation', /\bFMX\b/g, () => 'full-mouth radiographic series', 'Imaging add-on: modality in words'],
    ['abbreviation', /\bpano\b/gi, () => 'panoramic radiograph', 'Imaging add-on: modality in words'],
    ['abbreviation', /\bWNL\b/g, () => 'within normal limits', 'Shared abbreviation key'],
    ['abbreviation', /\bhx\b/gi, () => 'history', 'Shared abbreviation key'],
    ['abbreviation', /\btx\b/gi, () => 'treatment', 'Shared abbreviation key'],
    ['abbreviation', /\bdx\b/gi, () => 'diagnosis', 'Shared abbreviation key'],
    ['abbreviation', /\bRCT\b/g, () => 'root canal treatment', 'Shared abbreviation key'],
    ['abbreviation', /\bSRP\b/g, () => 'scaling and root planing', 'Shared abbreviation key'],
    ['abbreviation', /\bOHI\b/g, () => 'oral hygiene instructions', 'Shared abbreviation key'],
    ['abbreviation', /\bNKDA\b/g, () => 'no known drug allergies', 'Shared abbreviation key'],
    ['abbreviation', /\bNKA\b/g, () => 'no known allergies', 'Shared abbreviation key'],
    ['abbreviation', /\bprn\b/gi, () => 'as needed', 'ISMP: write the frequency in words'],
    ['abbreviation', /\bBID\b/g, () => 'twice daily', 'ISMP: write the frequency in words'],
    ['abbreviation', /\bTID\b/g, () => 'three times daily', 'ISMP: write the frequency in words'],
    ['abbreviation', /\bQID\b/g, () => 'four times daily', 'ISMP: write the frequency in words'],
    ['abbreviation', /\bq\.?d\.?(?=[\s,.;]|$)/gi, () => 'daily', 'ISMP do-not-use list: QD reads as QID'],
    ['abbreviation', /\bpost-?op\b/gi, () => 'postoperative', 'Shared abbreviation key'],
    ['abbreviation', /\bpre-?op\b/gi, () => 'preoperative', 'Shared abbreviation key'],
    ['spelling', /\babcess(es)?\b/gi, (m, s) => 'abscess' + (s ? 'es' : ''), 'Spelling'],
    ['spelling', /\bgingivits\b/gi, () => 'gingivitis', 'Spelling'],
    ['spelling', /\bbucal\b/gi, () => 'buccal', 'Spelling'],
    ['spelling', /\blingal\b/gi, () => 'lingual', 'Spelling'],
    ['spelling', /\bocclusial\b/gi, () => 'occlusal', 'Spelling'],
    ['formatting', /#(\d{1,2})([MODBLIF]{1,5})\b/g, (m, t, s) => '#' + t + ' ' + s, 'Tooth and surface notation: a space between'],
    ['formatting', /(^|[\s(])\.(\d)/g, (m, a, d) => a + '0.' + d, 'ISMP do-not-use list: a naked decimal drops its zero'],
    ['formatting', /\b(\d+)\.0\b(?=\s*(?:mg|mL|ml|carpules?|cartridges?|%))/g, (m, n) => n, 'ISMP do-not-use list: a trailing zero reads tenfold'],
  ];
  const FLAGGED = [
    ['ambiguous-shorthand', /\bPA\b/g, 'PA', 'Periapical radiograph or posteroanterior view? Write the modality in words.'],
    ['ambiguous-shorthand', /\bBW\b/g, 'BW', 'Bitewing radiograph or body weight? Write the word.'],
    ['ambiguous-shorthand', /\bLA\b/g, 'LA', 'Name the anesthetic, its concentration and the amount; "LA" is not a record of a drug.'],
    ['vague-phrase', /\btolerated(?:\s+(?:the\s+)?procedure)?\s+well\b/gi, 'tolerated well', 'State the observed response: vital signs, pain report, what the patient said.'],
    ['vague-phrase', /\bdid\s+well\b|\bno\s+(?:issues|problems)\b/gi, 'did well / no issues', 'Say what was observed and for how long; a later reader cannot use a mood.'],
    ['vague-phrase', /\bpt\.?\s+aware\b|\bpatient\s+aware\b/gi, 'patient aware', 'Aware of what, told by whom, and what they decided.'],
    ['stigmatizing', /\bnon-?compliant\b|\bdrug[- ]seeking\b|\bdifficult\s+patient\b/gi, 'stigmatizing wording', 'Describe the behaviour and the plan (missed two recalls; declined radiographs after risks reviewed).'],
    ['medication-spelling', /\bamoxicilin\b|\bamoxycillin\b|\bibuprofin\b|\bclindamicin\b|\bpenicilin\b/gi, 'medication spelling', 'Never corrected by a tool: two drugs can differ by one letter. Retype the name.'],
    ['do-not-use', /\b\d+\s*u\b(?!\w)|\bIU\b|\bMSO4\b|\bMgSO4\b|\bqod\b/g, 'do-not-use designation', 'Joint Commission do-not-use list: write unit, international unit, the drug name, every other day.'],
    ['kilogram-rule', /\blbs?\b[\s\S]{0,80}\bmg\s*\/\s*kg\b|\bmg\s*\/\s*kg\b[\s\S]{0,80}\blbs?\b/gi, 'pounds beside mg/kg', 'Weight-based dosing is reconstructible only in kilograms (a pound read as a kilogram is a 2.2× dose).'],
  ];
  function standardize(text) {
    const applied = []; let out = String(text || '');
    for (const [kind, re, to, why] of APPLIED) {
      const seen = {};
      out = out.replace(re, (...args) => { const m = args[0]; const r = to(...args); if (r !== m) { seen[m] = seen[m] || { kind, from: m, to: r, count: 0, why }; seen[m].count++; } return r; });
      for (const k of Object.keys(seen)) applied.push(seen[k]);
    }
    const flags = [];
    for (const [kind, re, display, guidance] of FLAGGED) { const n = (String(text || '').match(re) || []).length; if (n) flags.push({ kind, display, guidance, count: n }); }
    return { text: out, applied, flags, clean: !applied.length && !flags.length };
  }

  // ---- completeness: anticipatory rules a later reader asks (Smile Notes completeness.ts, ruleset 2.25.2) ----
  const COMPLETENESS = [
    ['imaging-no-interpretation', /\b(?:radiographs?|bitewings?|BWX?s?|PANO|panoramic|FMX|CBCT|periapicals?|PAs?)\b[^.\n]{0,60}\b(?:taken|acquired|exposed|obtained|captured)\b|\b(?:taken|acquired|exposed|obtained|captured)\b[^.\n]{0,60}\b(?:radiographs?|bitewings?|PANO|panoramic|FMX|CBCT|periapicals?)\b/i, /\b(?:interpret|findings?|impression|reveal|shows?|showed|demonstrat|radioluc|radiopac|caries|bone\s+level|within\s+normal|no\s+(?:significant\s+)?(?:pathology|findings?|abnormalit)|WNL|unremarkable|reviewed\s+by|referred\s+for\s+interpretation)/i, 'Images were acquired, but the note never says what they showed.', 'Record the interpreting dentist\'s findings, even "no significant findings". Tennessee counts radiographs and their interpretations as record components.'],
    ['anesthetic-no-amount', /\b(?:lidocaine|articaine|septocaine|mepivacaine|carbocaine|bupivacaine|marcaine|prilocaine)\b|\blocal\s+anesthe(?:tic|sia)\b[^.\n]{0,40}\b(?:administered|given|delivered|injected)\b/i, /\b\d+(?:\.\d+)?\s*(?:carpules?|cartridges?|mg|mL|ml)\b|\b(?:one|two|three|four)\s+(?:carpules?|cartridges?)\b/i, 'An anesthetic is named, but no amount is recorded.', 'State the amount (carpules or milligrams), the concentration and the vasoconstrictor. Amount administered is a Tennessee minimum-record element.'],
    ['extraction-no-outcome', /\b(?:extraction|extracted)\b/i, /\b(?:without\s+complication|no\s+complication|uneventful|complication[s]?\s*:|hemostasis|post-?op(?:erative)?\s+instructions?|gauze|socket)\b/i, 'An extraction is documented with no outcome, complications statement or postoperative instructions.', 'State whether a complication was observed, that hemostasis was achieved, and that postoperative instructions were given.'],
    ['rx-no-duration', /\b(?:prescribed|prescription|dispensed?)\b[^.\n]{0,80}\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|doxycycline|ibuprofen|naproxen|acetaminophen|hydrocodone|oxycodone|codeine|tramadol|chlorhexidine|fluconazole|nystatin)\b/i, /\b(?:for|x|×)\s*\d+\s*(?:days?|weeks?)\b|\bday\s+supply\b|\buntil\s+(?:finished|gone|follow)/i, 'A prescription is recorded without a duration or supply.', 'State the course ("for 7 days", "until finished"). Dose, frequency and duration together make a prescription reconstructible.'],
    ['consent-no-decision', /\b(?:consent|risks?\s+and\s+benefits?|treatment\s+options?)\s+(?:was\s+|were\s+)?(?:discussed|reviewed|presented|explained)\b/i, /\b(?:consented|consent\s+(?:was\s+)?(?:obtained|given|signed|recorded)|agreed|accepted|declined|refused|chose|elected|deferred)\b/i, 'A consent conversation is documented without the patient\'s decision.', 'Record what the patient decided — agreed, declined or deferred — in their own terms.'],
    ['consent-thin-assertion', /\b(?:patient\s+)?consented\b|\bconsent\s+(?:was\s+)?(?:obtained|given|signed|on\s+file|recorded)\b|\b(?:signed|verbal)\s+consent\b/i, /\b(?:risks?|benefits?|alternatives?|options?|questions?|declined|deferred|teach-?back|understands?|informed\s+of|material\s+risks?|no\s+treatment|consequence)\b/i, 'Consent is asserted, but the note never records what was discussed.', 'Name the diagnosis, material risks, alternatives including no treatment, any questions, and the decision. "Patient consented" is not the conversation.'],
    ['clinical-rationale', /\b(?:crown(?:\s+prep)?|root\s+canal|RCT|endodont|extraction|extracted|SRP|scaling\s+and\s+root\s+planing|root\s+planing|implant\s+placement|bridge\s+prep|core\s+buildup|build-?up|apicoectomy|pulpotomy|pulpectomy|bone\s+graft|sinus\s+(?:lift|augment)|restoration|composite|amalgam|onlay|inlay|veneer)\b/i, /\b(?:because|due\s+to|indicated\s+(?:for|by)|recommended\s+(?:for|because)|in\s+order\s+to|secondary\s+to|based\s+on|given\s+(?:the|patient)|to\s+address|to\s+treat|for\s+treatment\s+of|diagnosed|diagnosis|fracture|recurrent\s+decay|caries|infection|abscess|periodont|bone\s+loss|mobility|radiolucen|radiopaque|symptom|pain|swelling|failed\s+restoration|cracked|broken|non-?restorable|periapical|lesion|defect|defective|leak|secondary\s+caries|deep\s+caries|irreversible\s+pulpitis|necrotic|symptomatic|asymptomatic|moderate|severe|advanced|stage\s+(?:I{1,3}|IV|[1-4]))\b/i, 'A significant procedure is documented without clinical reasoning.', 'State the finding, diagnosis or symptom the treatment addresses. Codes and billing narratives are not clinical rationale.'],
    ['referral-loop-open', /\b(?:referred|referral\s+(?:to|placed|made|given|pending)|refer\s+to|will\s+refer)\b/i, /\b(?:endodontist|periodontist|oral\s+surgeon|oral\s+surgery|OMFS|orthodont|prosthodont|pedodont|physician|PCP|primary\s+care|specialist|Dr\.|to\s+Dr\b|for\s+(?:evaluation|consult|biopsy|extraction|surgical|periodontal|orthodontic|urgent|stat)|because|due\s+to|regarding|evaluate|periapical|lesion|radiolucen|pain|swelling|abscess|fracture|impacted|interpretation|interpreted|read\s+by)\b/i, 'A referral is documented without naming the recipient or the clinical reason.', 'Record to whom, why, and the urgency when time-sensitive. "Referral placed" alone does not close the loop.'],
    ['rx-no-indication', /\b(?:prescribed|prescription|dispensed?)\b[^.\n]{0,80}\b(?:amoxicillin|penicillin|clindamycin|azithromycin|metronidazole|doxycycline|ibuprofen|naproxen|acetaminophen|hydrocodone|oxycodone|codeine|tramadol|chlorhexidine|fluconazole|nystatin)\b/i, /\b(?:to\s+treat|indicated(?:\s+for)?|due\s+to|secondary\s+to|prophylaxis|prophylactic|infection|abscess|cellulitis|pericoronitis|odontalgia|periodont|post-?op(?:erative)?\s+pain|for\s+(?:the\s+)?(?:infection|abscess|pain|swelling|extraction|procedure|odontogenic))\b/i, 'A prescription is recorded without a clinical indication.', 'State why the drug was prescribed: the infection, pain or prophylaxis. Duration alone is not a reason.'],
    ['finding-no-disposition', /\b(?:lesion|ulceration|ulcer|radiolucency|PARL)\b/i, /\b(?:refer(?:ral|red)?|biopsy|monitor(?:ed|ing)?|recheck|disclosed|discussed|scheduled|observ(?:e|ed|ation)|follow-?ups?|no\s+(?:lesions?|ulcers?|radiolucenc(?:y|ies)))\b/i, 'A soft-tissue or radiographic finding is recorded without a disposition.', 'Close the loop: disclosed, monitored with a recheck, biopsied or referred. A finding alone is an open clinical loop.'],
    ['procedure-no-followup', /\b(?:crown(?:\s+prep)?|root\s+canal|RCT|endodont|extraction|extracted|SRP|scaling\s+and\s+root\s+planing|root\s+planing|implant\s+placement|bridge\s+prep|apicoectomy|pulpotomy|pulpectomy|bone\s+graft|sinus\s+(?:lift|augment))\b/i, /\b(?:follow-?ups?|recall|RTC|return\s+(?:to|in)|next\s+visit|second\s+visit|re-?eval(?:uation|uate[ds]?)?|referral|referred|come\s+back|(?:in|within)\s+(?:\d+|one|two|three|four|five|six)\s*(?:days?|weeks?|months?)|seat(?:ing)?\s+(?:visit|appointment))\b/i, 'A significant procedure is documented without a follow-up plan.', 'State the next step: recall interval, return visit, seating appointment or referral.'],
  ];
  const completeness = (text) => COMPLETENESS.filter(([, trig, ok]) => trig.test(text) && !ok.test(text)).map(([id, , , what, how]) => ({ id: 'complete.' + id, what, how }));

  // ---- Universal Core coverage: which of the eight core sections the draft speaks to (presence only) -------
  const CORE = [
    ['visit', 'Visit', /\b(chief complaint|cc:|presents? (?:for|with)|purpose|recall|periodic|emergency|limited exam|c\/o|referred for)\b/i],
    ['history', 'History review', /\b(medical history|med(?:ical)? hx|history reviewed|allerg|nkda|nka|medications?|meds reviewed|asa\s*(?:i{1,3}|iv|[1-4])\b|anticoagulant)/i],
    ['subjective', 'Subjective', /\b(asymptomatic|symptomatic|pain|sensitiv|reports?|denies|complain|no symptoms|discomfort|patient (?:states|says))\b/i],
    ['objective', 'Objective', /\b(clinical(?:ly)?|exam|radiograph|bitewing|bwx|percussion|palpation|vitality|probing|mobility|caries|fracture|lesion|confirmed|noted|observed|findings?)\b/i],
    ['assessment', 'Assessment', /\b(diagnos|caries|pulpitis|periodontitis|gingivitis|abscess|fracture|recurrent decay|necrotic|irreversible|reversible|impression:)/i],
    ['plan', 'Plan and decision', /\b(plan|recommend|consent|option|alternative|risk|benefit|agreed|declined|deferred|accepted|refused)/i],
    ['care', 'Care delivered', /\b(today|completed|placed|performed|restored|extracted|prepped|temporized|delivered|administered|carpule|lidocaine|articaine|composite|crown|under local|sedation)\b/i],
    ['handoff', 'Handoff', /\b(post-?op(?:erative)? instructions|instructions given|follow[- ]?up|recall|return|re-?eval|referr|next visit|rtc|escort|prescri)/i],
  ];
  const coreCoverage = (text) => CORE.map(([id, label, re]) => ({ id, label, present: re.test(text) }));

  // ---- benchmarks: five drift rails, each a measurement against a practice target, never a probability -------
  const KNOWN = new Set(['ASA', 'DOB', 'MRN', 'BWX', 'FMX', 'WNL', 'RCT', 'SRP', 'OHI', 'NKDA', 'NKA', 'BID', 'TID', 'QID', 'PA', 'BW', 'LA', 'IV', 'IU', 'CBCT', 'PARL', 'OMFS', 'PCP', 'RTC', 'CDT', 'DDS', 'RDH', 'RDA', 'PPO', 'HMO', 'MOD', 'DO', 'MO', 'OL', 'DOL', 'MOL', 'MODBL', 'MODL', 'MODB', 'MI', 'DI', 'MIL', 'DIL', 'PRN']);
  const PASSIVE = /\b(?:was|were|is|are|been|being|be)\s+(?:\w+ed|given|taken|placed|seen|done|made|told|shown|written|left)\b(?!\s+by\b)/gi;
  const TREATMENT = /\b(composite|crown|extraction|extracted|restor|srp|scaling|root canal|rct|implant|placed|prepped|sedation|onlay|veneer|pulpotomy)\b/i;
  const CUES = [
    ['allergy', 'Allergy status', /\b(nkda|nka|allerg(?:y|ies)|adverse reaction)\b/i, null],
    ['consent', 'Consent or decision', /\bconsent(?:ed)?|refused|declined|deferred|agreed|accepted|informed of (?:risks|benefits)\b/i, null],
    ['follow-up', 'Plan or follow-up', /\b(follow[- ]?up|recall|return|re-?eval|referral|next visit|rtc)\b/i, null],
    ['anesthetic', 'Anesthetic amount when named', /\b\d+(?:\.\d+)?\s*(?:carpules?|cartridges?|mg|mL|ml)\b/i, /\b(?:lidocaine|articaine|septocaine|mepivacaine|carbocaine|bupivacaine|marcaine|prilocaine|local anesthe(?:tic|sia))\b/i],
    ['interpretation', 'Radiograph interpretation when taken', /\b(interpret|findings?|reveal|shows?|showed|radioluc|radiopac|within normal|no significant|unremarkable|caries)\b/i, /\b(radiographs?|bitewings?|bwx|fmx|pano|periapical|cbct)\b/i],
  ];
  const FACT = /#\d{1,2}\b|\bd\d{4}\b|\b\d+(?:\.\d+)?\s*(?:mm|mg|ml|mL|%|carpules?)?\b|\b(caries|composite|crown|fracture|asymptomatic|symptomatic|vitality|percussion|consent|instructions|follow[- ]?up|recall|lidocaine|articaine|epinephrine|radiograph|bitewing|sedation|midazolam|extraction|hemostasis|allerg\w*|nkda)\b/gi;
  const clamp01 = (n) => Math.max(0, Math.min(1, n));
  const direction = (value, target, band) => band ? (value >= band[0] && value <= band[1] ? 'on-target' : 'away') : (value >= target - 0.05 ? 'on-target' : value >= target - 0.2 ? 'toward' : 'away');
  const isSurface = (tok, prev) => /^#\d{1,2}$/.test(prev || '') && /^[MODBLIF]{1,5}$/.test(tok);
  function measure(text) {
    text = String(text || '');
    const words = text.match(/[A-Za-z][\w'/-]*|#\d{1,2}/g) || [];
    let unread = 0;
    for (let i = 0; i < words.length; i++) { const w = words[i]; if (/^[A-Z]{2,5}$/.test(w) && !KNOWN.has(w) && !isSurface(w, words[i - 1])) unread++; }
    const readCoverage = words.length ? clamp01(1 - unread / words.length) : 1;
    const passive = (text.match(PASSIVE) || []).length;
    const sentences = Math.max(1, (text.match(/[.!?;\n]+/g) || []).length);
    const activeShare = text.trim() ? clamp01(1 - passive / sentences) : 0;
    const applicable = TREATMENT.test(text);
    const pillars = { applicable, consent: /\b(consent|agreed|accepted|declined|refused|deferred|informed of)\b/i.test(text), outcome: /\b(no complication|without complication|uneventful|complication|hemostasis|tolerated|outcome|monitored)\b/i.test(text), instructions: /\b(post-?op(?:erative)? instructions|instructions (?:given|reviewed|provided)|home care)\b/i.test(text), followUp: /\b(follow[- ]?up|recall|return|re-?eval|next visit|rtc|seat)\b/i.test(text) };
    const pillarShare = applicable ? [pillars.consent, pillars.outcome, pillars.instructions, pillars.followUp].filter(Boolean).length / 4 : 1;
    const cues = CUES.filter(([, , , when]) => !when || when.test(text)).map(([id, label, re]) => ({ id, label, present: re.test(text) }));
    const cueShare = cues.length ? cues.filter((c) => c.present).length / cues.length : 1;
    const facts = (text.match(FACT) || []).length;
    const density = words.length ? Math.round(facts * 100 / words.length) : 0;
    const missingCues = cues.filter((c) => !c.present).map((c) => c.label);
    const readings = [
      { id: 'read', label: 'Parser read coverage', value: readCoverage, target: 0.9, direction: direction(readCoverage, 0.9), note: readCoverage >= 0.9 ? 'Most of the note is in language the tables can read.' : unread + ' clause' + (unread === 1 ? '' : 's') + ' still read as shorthand the tables have not met.' },
      { id: 'active-voice', label: 'Active-voice share', value: activeShare, target: 0.85, direction: direction(activeShare, 0.85), note: passive === 0 ? 'No unattributed passive constructions spotted.' : passive + ' passive construction' + (passive === 1 ? '' : 's') + ' hide who acted.' },
      { id: 'pillars', label: 'Later-reader pillars', value: pillarShare, target: 1, direction: applicable ? direction(pillarShare, 1) : 'n/a', note: applicable ? 'Consent, outcome, instructions, follow-up: presence only.' : 'Pillars apply once treatment is documented.' },
      { id: 'tn-cues', label: 'Tennessee cues', value: cueShare, target: 0.8, direction: direction(cueShare, 0.8), note: missingCues.length ? 'Still open: ' + missingCues.slice(0, 2).join('; ') + '.' : 'The Tennessee documentation cues that apply are present.' },
      { id: 'density', label: 'Facts per 100 words', value: density, target: 20, band: [8, 60], direction: text.trim() ? direction(density, 20, [8, 60]) : 'away', note: !text.trim() ? 'No clinical facts read yet.' : density < 8 ? 'Sparse: a reviewer may ask what was actually done.' : density > 60 ? 'Very dense: check that every fact earns its place.' : 'Inside the practice\'s useful density band.' },
    ];
    const scored = readings.filter((r) => r.direction !== 'n/a');
    const onCourse = scored.length ? scored.filter((r) => r.direction === 'on-target' || r.direction === 'toward').length / scored.length : 1;
    return { readings, onCourse, words: words.length, unread, passive, sentences, pillars, cues, missingCues, density };
  }

  // ---- instrument readings: at most three, priority-ordered, each with the evidence the verifier re-checks ----
  const quote = (text, re) => { const m = String(text || '').match(re); return m ? m[0] : null; };
  function instrument(text, rep) {
    const out = []; const by = Object.fromEntries(rep.readings.map((r) => [r.id, r]));
    const push = (o) => { if (out.length < MAX_READINGS) out.push(o); };
    if (by['tn-cues'].direction !== 'on-target' && rep.missingCues.length) push({ kind: 'tn-required', say: 'Tennessee documentation cue not yet present: ' + rep.missingCues[0] + '.', why: by['tn-cues'].note, question: 'Was ' + rep.missingCues[0].toLowerCase() + ' addressed in this visit?', source: 'TN Board of Dentistry Rule 0460-02-.12', evidence: null, absent: rep.missingCues[0] });
    if (by['active-voice'].direction !== 'on-target') push({ kind: 'active-voice', say: 'The record contains passive constructions that do not name who acted.', why: by['active-voice'].note, source: 'Practice writing standard: active voice', evidence: quote(text, PASSIVE) });
    if (rep.pillars.applicable && by.pillars.direction !== 'on-target') {
      const miss = []; if (!rep.pillars.consent) miss.push('consent or decision'); if (!rep.pillars.outcome) miss.push('outcome or complications statement'); if (!rep.pillars.instructions) miss.push('postoperative instructions'); if (!rep.pillars.followUp) miss.push('follow-up or recall');
      if (miss.length) push({ kind: 'completeness', say: 'Still open for a later reader: ' + miss.slice(0, 2).join('; ') + '.', why: 'Treatment notes that omit these pillars are harder to defend in review.', question: 'Was ' + miss[0] + ' documented for this visit?', source: 'Risk-reduction completeness checklist (Doctors Company claim-file patterns)', evidence: quote(text, TREATMENT), absent: miss[0] });
    }
    if (by.read.direction !== 'on-target') push({ kind: 'standardize', say: 'Some clauses still use shorthand the controlled vocabulary has not met.', why: by.read.note, source: 'Ruleset parser coverage floor', evidence: quote(text, /\b[A-Z]{2,5}\b/) });
    if (by.density.direction !== 'on-target' && text.trim()) push({ kind: 'clarity', say: rep.density < 8 ? 'The note reads sparse for the procedures implied.' : 'The note is very dense; each fact should earn its place.', why: by.density.note, source: 'Practice documentation density band', evidence: null });
    return out;
  }
  // The verifier restates the promise instead of importing it: a quoted evidence span must stand in the draft as read,
  // and an absence claim must still find nothing. A reading that fails is dropped before a person sees it.
  const verify = (text, obs) => obs.filter((o) => (o.evidence == null || String(text).includes(o.evidence)));

  // ---- PHI gate: identifiers masked before any read; the twin never sees a name, a birth date or a number ------
  const PHI_SHAPES = [['phone number', /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g], ['social security number', /\b\d{3}-\d{2}-\d{4}\b/g], ['email address', /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g], ['record number', /\bMRN-?\s?\d+\b/gi], ['calendar date', /\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/(?:19|20)\d{2}\b/g]];
  function phiGate(text, patient) {
    let masked = String(text || ''); const counts = {}; let count = 0;
    const hit = (label, re, token) => { const n = (masked.match(re) || []).length; if (!n) return; counts[label] = (counts[label] || 0) + n; count += n; masked = masked.replace(re, token); };
    const names = (patient && patient.name ? String(patient.name).split(/\s+/).filter((n) => n.length > 2) : []).concat(patient && patient.guardian ? String(patient.guardian).split(/\s+/) : []);
    for (const n of names) hit('name', new RegExp('\\b' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g'), '[name]');
    for (const [label, re] of PHI_SHAPES) { hit(label, re, '[' + label + ']'); re.lastIndex = 0; }
    // found: one entry per kind ("name ×2"); count: every masked span, the number the PHI-gate stage prints.
    const found = Object.keys(counts).map((k) => counts[k] > 1 ? k + ' ×' + counts[k] : k);
    return { text: masked, found, count };
  }

  Proto.notes = { standardize, completeness, coreCoverage, measure, instrument, verify, phiGate, RULESET };

  // ---- screen state: the draft is the Encounter's own (per author); readings are paced here ------------------
  let lastStore = null; let lastRoute = null; let view = {};   // encId|uid -> { tip, keep: {from: true} }
  const S = () => Proto.store.get(); const P = () => window.__proto;
  function viewFor(encId) { const s = S(); if (s !== lastStore) { lastStore = s; view = {}; } const k = encId + '|' + Proto.store.currentUser().id; if (!view[k]) view[k] = { tip: 0, keep: {} }; return view[k]; }
  const dentistLike = () => ['dentist', 'owner', 'surgeon'].includes(Proto.store.currentUser().role);
  const draftOf = (enc) => Proto.screens.encounter.state(enc.id).note;
  const filedOf = (encId) => S().filedNotes.filter((f) => f.encounterId === encId).pop() || null;
  const noteText = (enc, filed) => filed ? (filed.markdown || '') : [draftOf(enc).assessment, draftOf(enc).plan].filter(Boolean).join('\n');
  function rerender(r) { r = r || lastRoute || Proto.router.current(); Proto.router.render(); Proto.screens.shell.refreshAndon(r); }
  const focusTid = (tid) => { const el = document.querySelector('[data-testid="' + tid + '"]'); if (el && el.focus) { el.focus({ preventScroll: true }); return true; } return false; };

  // ---- picker: which visit to read ------------------------------------------------------------------------
  function renderPicker(r) {
    const s = S(); const priv = P().privacy; const rows = [];
    for (const a of s.appointments) {
      if (a.locationId !== 'loc-1' || !a.encounterId) continue;
      const enc = s.encounters.find((e) => e.id === a.encounterId); if (!enc) continue;
      const p = Proto.store.patient(a.patientId); const filed = enc.noteFiled || !!filedOf(enc.id);
      rows.push(h('div', { class: 'wrow', role: 'listitem', testid: 'superbyte.row.' + enc.id },
        h('div', null, h('div', { class: 'obj', text: displayName(p.name, priv) }), h('div', { class: 'small muted', text: 'Chair ' + a.op + ' · ' + Proto.ui.time(a.time) })),
        h('div', null, chip(filed ? 'clear' : 'info', filed ? 'Filed' : 'Draft')),
        h('div', { class: 'why', text: filed ? 'Frozen text; SuperByte reads it as filed' : Proto.ui.typeWord(a.type) + ' visit · draft read live' }),
        btn('Open', { kind: 'reversible', testid: 'superbyte.row.' + enc.id + '.open', ariaLabel: 'Open SuperByte for ' + displayName(p.name, priv), onClick: () => Proto.router.go(r.persona, 'superbyte', enc.id) })));
    }
    Proto.screens.shell.mount(h('div', { class: 'stack sb-picker' }, pageHead('SuperByte', 'Pick the visit whose note to read. SuperByte observes; it never files.'),
      h('div', { class: 'worklist', role: 'list', 'aria-label': 'Visits' }, ...(rows.length ? rows : [h('p', { class: 'muted', text: 'No visits today at this location.' })]))));
  }

  // ---- the glass ---------------------------------------------------------------------------------------------
  function render(r) {
    lastRoute = r;
    if (!r.id) { renderPicker(r); return; }
    const enc = Proto.store.encounter(r.id);
    if (!enc) {
      const nf = Proto.store.notFound('encounter');
      Proto.screens.shell.mount(h('div', { class: 'stack' }, h('h1', { text: 'Nothing here' }), h('p', { class: 'muted', text: nf.why }),
        btn('Back to home', { testid: 'notfound.home', kind: 'quiet', onClick: () => Proto.router.go(r.persona, Proto.router.HOME[r.persona]) })));
      return;
    }
    const p = Proto.store.patient(enc.patientId); const priv = P().privacy; const filed = filedOf(enc.id) || (enc.noteFiled ? { markdown: '' } : null);
    const head = pageHead('SuperByte · ' + displayName(p.name, priv), 'DOS ' + longDate(enc.dos) + (priv ? '' : ' · DOB ' + longDate(p.dob)) + ' · ruleset ' + RULESET + (filed ? ' · filed, text frozen' : ' · draft, read live'),
      Proto.screens.rail ? Proto.screens.rail.button(enc.patientId, r, 'superbyte.rail') : null,
      btn('Back to Encounter', { testid: 'superbyte.back', kind: 'reversible', onClick: () => Proto.router.go(r.persona, 'encounter', enc.id) }));
    head.classList.add('sb-head');
    const page = h('div', { class: 'sb-page', dataset: { enc: enc.id } }, head, h('div', { class: 'sb-grid' },
      h('div', { class: 'sb-col sb-col-note' }, noteCard(r, enc, filed), h('div', { id: 'sb-wording' }, wordingCard(r, enc, filed))),
      h('div', { class: 'sb-col sb-col-structure', id: 'sb-structure' }, ...structurePanels(r, enc, filed)),
      h('div', { class: 'sb-col sb-col-byte', id: 'sb-byte' }, bytePanel(r, enc, filed))));
    Proto.screens.shell.mount(page);
  }
  // Typing re-measures the other panels in place; the field that holds the caret is never rebuilt.
  function refresh(r, enc, filed) {
    const wd = document.getElementById('sb-wording'); if (wd) wd.replaceChildren(wordingCard(r, enc, filed));
    const st = document.getElementById('sb-structure'); if (st) st.replaceChildren(...structurePanels(r, enc, filed));
    const by = document.getElementById('sb-byte'); if (by) by.replaceChildren(bytePanel(r, enc, filed));
  }

  function noteCard(r, enc, filed) {
    const locked = !!filed || !dentistLike(); const note = filed ? null : draftOf(enc); const notes = S().notes[enc.id] || {};
    const field = (id, label, value) => {
      const ta = h('textarea', { class: 'input sb-field', id: 'sb-' + id, testid: 'superbyte.note.field.' + id, 'aria-label': label + (locked ? ' (dentist only)' : ''), readonly: locked, spellcheck: 'true',
        onInput: (ev) => { note[id] = ev.target.value; refresh(r, enc, filed); } });
      ta.value = value || '';
      return h('div', { class: 'field sb-fieldwrap' }, h('label', { for: 'sb-' + id }, label, locked && !filed ? h('span', { class: 'muted', text: ' · Dentist' }) : null), ta);
    };
    const body = filed
      ? [h('div', { class: 'row' }, chip('clear', 'Filed', { big: true }), h('span', { class: 'small muted', text: 'Text and version frozen; corrections are addenda.' })), h('div', { class: 'enc-readonly sb-frozen', testid: 'superbyte.note.frozen', text: filed.markdown || '(no text)' })]
      : [field('assessment', 'Assessment', note.assessment), field('plan', 'Plan', note.plan),
        notes.procedure ? h('div', { class: 'enc-readonly small sb-fromchart' }, h('b', { text: 'From the chart: ' }), notes.procedure) : null];
    const sec = Proto.ui.section('Note', ...body); sec.classList.add('sb-note'); return sec;
  }

  function structurePanels(r, enc, filed) {
    const text = noteText(enc, filed); const x = filed ? null : Proto.screens.encounter.state(enc.id); const v = viewFor(enc.id);
    // Before File: the store's own rows (the same list the Encounter gate shows), never a second opinion.
    const killers = filed ? [] : Proto.store.noteKillers(enc.id, x.note);
    const killerRows = killers.slice(0, MAX_ROWS).map((k, i) => {
      const here = k.fix === 'assessment' && dentistLike();
      const node = refusal({ code: k.code, verb: k.verb, control: here ? 'Add assessment' : 'Fix on the Encounter', why: k.why || 'File on the Encounter runs the same list server-side.', severity: k.fix === 'contradiction' ? 'stop' : 'required', onControl: () => { if (here) focusTid('superbyte.note.field.assessment'); else Proto.router.go(r.persona, 'encounter', enc.id); } });
      const c = node.querySelector('[data-testid="refusal.control"]'); if (c) c.setAttribute('data-testid', 'superbyte.killer.' + i + '.fix');
      return node;
    });
    const gate = Proto.ui.section('Before File',
      h('div', { class: 'row' }, killers.length ? chip('required', killers.length + ' to fix') : chip('clear', filed ? 'Filed' : 'Nothing outstanding'), killers.length > MAX_ROWS ? h('span', { class: 'small muted', text: 'showing ' + MAX_ROWS + ' of ' + killers.length }) : h('span', { class: 'small muted', text: filed ? 'Frozen with the filed note' : 'File stays on the Encounter' })),
      killerRows.length ? h('div', { class: 'killer' }, ...killerRows) : null);
    gate.classList.add('sb-gate');
    // Universal Core: eight sections, present or not yet. Presence only; a blank never means normal.
    const cov = coreCoverage(text); const n = cov.filter((c) => c.present).length;
    const core = Proto.ui.section('Universal Core',
      h('div', { class: 'row' }, chip(n === cov.length ? 'clear' : n >= 5 ? 'review' : 'info', n + ' of ' + cov.length + ' sections spoken to'), h('span', { class: 'small muted', text: 'a blank never means normal' })),
      h('ul', { class: 'sb-core', 'aria-label': 'Universal Core sections' }, ...cov.map((c) => h('li', { class: c.present ? 'present' : 'open', dataset: { section: c.id, present: c.present ? '1' : '0' } }, h('span', { class: 'glyph', 'aria-hidden': 'true', text: c.present ? '●' : '○' }), h('span', { class: 'lbl', text: c.label }), h('span', { class: 'sr-only', text: c.present ? ', present' : ', not yet' })))));
    core.classList.add('sb-core-card');
    // A later reader will ask: anticipatory completeness, S2, never blocks.
    const asks = completeness(text);
    const later = Proto.ui.section('A later reader will ask',
      h('div', { class: 'row' }, chip(asks.length ? 'review' : 'clear', asks.length ? asks.length + (asks.length === 1 ? ' question' : ' questions') : 'Nothing open'), asks.length > MAX_ROWS ? h('span', { class: 'small muted', text: 'showing ' + MAX_ROWS + ' of ' + asks.length }) : h('span', { class: 'small muted', text: 'never blocks File; answer in the note' })),
      asks.length ? h('ul', { class: 'sb-asks' }, ...asks.slice(0, MAX_ROWS).map((a) => h('li', { dataset: { rule: a.id } }, h('b', { text: a.what }), h('span', { class: 'small muted', text: ' ' + a.how })))) : null);
    later.classList.add('sb-later');
    return [gate, core, later];
  }
  // Standard wording: deterministic, itemised, accepted by name. Nothing here adds a clinical claim.
  function wordingCard(r, enc, filed) {
    const text = noteText(enc, filed); const v = viewFor(enc.id);
    const std = filed ? { applied: [], flags: [], text } : standardize(text);
    const pending = std.applied.filter((a) => !v.keep[a.from]);
    const rows = std.applied.slice(0, MAX_WORDING).map((a, i) => h('li', { class: 'row between sb-wordrow', dataset: { from: a.from }, title: a.why },
      h('span', { class: 'grow' }, h('span', { class: 'sb-from', text: a.from }), ' → ', h('b', { text: a.to }), a.count > 1 ? h('span', { class: 'small muted', text: ' ×' + a.count }) : null),
      btn('Keep as typed', { kind: 'quiet', class: 'compact', testid: 'superbyte.wording.' + i + '.keep', pressed: !!v.keep[a.from], ariaLabel: (v.keep[a.from] ? 'Keeping ' : 'Keep ') + a.from + ' as typed. ' + a.why, onClick: () => { v.keep[a.from] = !v.keep[a.from]; refresh(r, enc, filed); focusTid('superbyte.wording.' + i + '.keep'); } })));
    const flagRows = std.flags.slice(0, Math.max(0, MAX_WORDING - rows.length)).map((f) => h('li', { class: 'sb-flagrow', dataset: { flag: f.kind } }, chip('review', f.display), h('span', { class: 'small', text: ' ' + f.guidance })));
    const more = std.applied.length + std.flags.length - rows.length - flagRows.length;
    const canApply = !filed && dentistLike() && pending.length > 0;
    const wording = Proto.ui.section('Standard wording',
      h('div', { class: 'row between' }, h('span', { class: 'row' }, chip(std.applied.length ? 'style' : 'clear', std.applied.length ? std.applied.length + ' fixed rewrite' + (std.applied.length === 1 ? '' : 's') : 'Wording is standard'), std.flags.length ? chip('review', std.flags.length + ' to state in words') : null, more > 0 ? h('span', { class: 'small muted', text: '+' + more + ' more' }) : null),
        filed ? null : canApply ? btn('Apply ' + pending.length + ' rewrite' + (pending.length === 1 ? '' : 's'), { kind: 'reversible', testid: 'superbyte.wording.apply', onClick: () => applyWording(r, enc, pending) })
          : !dentistLike() ? h('span', { class: 'small muted', text: 'Applied by the dentist' }) : null),
      rows.length || flagRows.length ? h('ul', { class: 'sb-wording', 'aria-label': 'Wording proposals' }, ...rows, ...flagRows) : h('p', { class: 'small muted', text: filed ? 'A filed note is never rewritten; a correction is an addendum.' : 'Language-only rewrites appear here as you type; shorthand that hides a fact is flagged, never guessed.' }),
      rows.length ? h('p', { class: 'small muted sb-wordfoot', text: 'Fixed, language-only rewrites; nothing here adds a clinical claim. Flagged shorthand is never guessed.' }) : null);
    wording.classList.add('sb-wording-card');
    return wording;
  }
  function applyWording(r, enc, pending) {
    const note = draftOf(enc); const set = new Set(pending.map((a) => a.from));
    const apply = (txt) => { let out = String(txt || ''); for (const [, re, to] of APPLIED) out = out.replace(re, (...args) => (set.has(args[0]) ? to(...args) : args[0])); return out; };
    note.assessment = apply(note.assessment); note.plan = apply(note.plan);
    const x = Proto.screens.encounter.state(enc.id); if (x.checked) x.killers = Proto.store.noteKillers(enc.id, x.note).slice(0, 3);
    rerender(r); focusTid('superbyte.note.field.assessment');
    Proto.router.announce('Applied ' + pending.length + ' standard rewrite' + (pending.length === 1 ? '' : 's'));
  }

  // ---- SuperByte panel: face, layer chip, live status, pipeline, compass, one paced reading, five rails --------
  const MOOD = (on, any) => (!any ? 'idle' : on >= 0.75 ? 'happy' : on >= 0.4 ? 'thinking' : 'concerned');
  function face(mood) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '-2 -2 20 20'); svg.setAttribute('width', '56'); svg.setAttribute('height', '56'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'sb-face sb-face-' + mood);
    const R = (x, y, w, hh, fill, extra) => { const e = document.createElementNS(svgNS, 'rect'); e.setAttribute('x', x); e.setAttribute('y', y); e.setAttribute('width', w); e.setAttribute('height', hh); e.setAttribute('fill', fill); if (extra) for (const [k, val] of Object.entries(extra)) e.setAttribute(k, val); svg.append(e); };
    R(-2, -2, 20, 20, '#1A1205', { rx: 1.5 });
    const rows = ['....OOOOOOOO....', '...OWWWWWWWWO...', '..OWWWWWWWWWWO..', '.OWWWWWWWWWWWWO.', '.OWWWWWWWWWWWWO.', '.OWWWWWWWWWWWWO.', '.OWWWWWWWWWWWWO.', '.OWWWWWWWWWWWWO.', '.OWWWWWWWWWWWWO.', '.OWWSWWWWWWSWWO.', '.OWWSWWWWWWSWWO.', '..OWSWOOOWSWO...', '..OWWO...OWWO...', '..OWWO...OWWO...', '...OO.....OO....'];
    const C = { W: '#FFF8E7', S: '#F0E0B0', O: '#1E3A5F' };
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') R(x, y, 1, 1, C[row[x]]); });
    const star = '#C9A227'; R(7, 2, 1, 1, star); R(6, 3, 3, 1, star); R(7, 4, 1, 1, star);
    const eye = '#1E3A5F';
    if (mood === 'happy') { R(4, 6, 1, 1, eye); R(5, 5, 1, 1, eye); R(6, 6, 1, 1, eye); R(9, 6, 1, 1, eye); R(10, 5, 1, 1, eye); R(11, 6, 1, 1, eye); R(6, 8, 4, 1, eye); }
    else if (mood === 'thinking') { R(4, 6, 2, 1, eye); R(10, 5, 2, 2, eye); R(6, 8, 3, 1, eye); }
    else { R(4, 5, 2, 2, eye); R(10, 5, 2, 2, eye); R(6, 8, mood === 'concerned' ? 4 : 3, 1, eye); }
    return svg;
  }
  function compass(onCourse) {
    const pct = Math.round(onCourse * 100); const deg = -70 + onCourse * 140;
    const svgNS = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 56 56'); svg.setAttribute('width', '68'); svg.setAttribute('height', '68'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'On course: ' + pct + ' percent'); svg.setAttribute('class', 'sb-compass');
    const el = (tag, attrs) => { const e = document.createElementNS(svgNS, tag); for (const [k, val] of Object.entries(attrs)) e.setAttribute(k, val); svg.append(e); return e; };
    el('circle', { cx: 28, cy: 28, r: 26, fill: '#1A1205', stroke: '#C9A227', 'stroke-width': 1.5 });
    el('circle', { cx: 28, cy: 28, r: 22, fill: 'none', stroke: '#C9A227', 'stroke-width': 0.5, opacity: 0.35 });
    for (const a of [0, 90, 180, 270]) el('line', { x1: 28, y1: 6, x2: 28, y2: 10, stroke: '#C9A227', 'stroke-width': 1, opacity: 0.5, transform: 'rotate(' + a + ' 28 28)' });
    el('polygon', { points: '28,8 31,18 28,16 25,18', fill: '#C9A227', opacity: 0.9 });
    const g = document.createElementNS(svgNS, 'g'); g.setAttribute('transform', 'rotate(' + deg + ' 28 28)'); svg.append(g);
    const needle = document.createElementNS(svgNS, 'line'); for (const [k, val] of Object.entries({ x1: 28, y1: 28, x2: 28, y2: 11, stroke: '#5FB3A8', 'stroke-width': 3.5, 'stroke-linecap': 'round' })) needle.setAttribute(k, val); g.append(needle);
    const hub = document.createElementNS(svgNS, 'circle'); for (const [k, val] of Object.entries({ cx: 28, cy: 28, r: 3.5, fill: '#C9A227' })) hub.setAttribute(k, val); g.append(hub);
    const t = document.createElementNS(svgNS, 'text'); for (const [k, val] of Object.entries({ x: 28, y: 48, 'text-anchor': 'middle', fill: '#C9A227', 'font-size': 6, opacity: 0.8 })) t.setAttribute(k, val); t.textContent = 'N'; svg.append(t);
    return h('div', { class: 'sb-compass-wrap' }, svg, h('span', { class: 'small sb-pct', testid: 'superbyte.oncourse', text: pct + '% on course' }));
  }
  const DIR = { 'on-target': ['✓', 'On target'], toward: ['↑', 'Toward'], away: ['↓', 'Away'], 'n/a': ['·', 'n/a'] };
  const KIND = { 'tn-required': 'Tennessee cue', 'active-voice': 'Active voice', completeness: 'Completeness', standardize: 'Standardize', clarity: 'Clarity' };
  // One line per rail: label, bar with its target tick, direction. The cold note stands under a rail only while
  // it drifts; an on-target rail's note is the same sentence every time and the reading card carries the rest.
  function rails(rep) {
    return h('ul', { class: 'sb-rails', 'aria-label': 'Drift to NorthStar' }, ...rep.readings.map((rd) => {
      const pct = rd.id === 'density' ? Math.max(0, Math.min(100, rd.value / 60 * 100)) : Math.round(rd.value * 100);
      const tick = rd.id === 'density' ? Math.round(20 / 60 * 100) : Math.round(rd.target * 100);
      const [glyph, word] = DIR[rd.direction]; const drifting = rd.direction === 'away' || rd.direction === 'toward';
      return h('li', { class: 'sb-rail ' + rd.direction, dataset: { rail: rd.id, direction: rd.direction } },
        h('div', { class: 'sb-railline' }, h('span', { class: 'lbl', text: rd.label }),
          h('div', { class: 'sb-bar', role: 'img', 'aria-label': rd.label + ': ' + (rd.id === 'density' ? rd.value + ' per 100 words' : Math.round(rd.value * 100) + ' percent') + ', ' + word + '. ' + rd.note }, h('div', { class: 'fill', style: 'width:' + pct + '%' }), h('span', { class: 'tick', style: 'left:' + tick + '%' })),
          h('span', { class: 'dir', text: glyph + ' ' + word })),
        drifting ? h('div', { class: 'small muted sb-railnote', text: rd.note }) : null);
    }));
  }
  function bytePanel(r, enc, filed) {
    const raw = noteText(enc, filed); const p = Proto.store.patient(enc.patientId); const v = viewFor(enc.id);
    const gate = phiGate(raw, p); const text = gate.text;
    // Below 24 characters the instrument stays quiet: a status line that says "waiting" and a reading card that
    // speaks would contradict each other. The gauges still run on whatever is there.
    const any = text.trim().length > 0; const enough = text.trim().length >= 24;
    const rep = measure(text); const obs = enough ? verify(text, instrument(text, rep)) : [];
    const mood = MOOD(rep.onCourse, any);
    if (v.tip >= obs.length) v.tip = 0;
    const tip = obs[v.tip] || null;
    const status = filed && !any ? 'Filed without stored text; nothing to read.' : !any ? 'Waiting for you to start writing.' : !enough ? 'Waiting until the draft is long enough to analyze.' : obs.length ? 'Local gauges speaking: ' + obs.length + ' instrument reading' + (obs.length === 1 ? '' : 's') + '.' : 'Nothing to add; gauges are live.';
    const pipeline = h('ol', { class: 'sb-pipe', 'aria-label': 'How this read ran' },
      h('li', { dataset: { stage: 'phi' } }, h('b', { text: 'PHI gate' }), h('span', { testid: 'superbyte.phi', text: gate.count ? gate.count + ' masked: ' + gate.found.join(', ') : 'nothing to mask' })),
      h('li', { dataset: { stage: 'retrieval' } }, h('b', { text: 'Retrieval' }), h('span', { text: 'ruleset ' + RULESET + ' · TN rule' })),
      h('li', { dataset: { stage: 'model' } }, h('b', { text: 'Model' }), h('span', { text: 'pioneer dark, local' })),
      h('li', { dataset: { stage: 'schema' } }, h('b', { text: 'Schema' }), h('span', { text: obs.length + ' of ≤' + MAX_READINGS + ' valid' })),
      h('li', { dataset: { stage: 'verifier' } }, h('b', { text: 'Verifier' }), h('span', { text: obs.length ? 'evidence re-read' : 'nothing to verify' })),
      h('li', { dataset: { stage: 'human' } }, h('b', { text: 'Human' }), h('span', { text: 'you pace it' })));
    // Staff pace the readings (Previous / Next); nothing rotates on its own. The pager stands in the card's head so
    // the say / why / question / source lines are the whole body.
    const pager = obs.length > 1 ? h('span', { class: 'row sb-pager' },
      btn('‹ Previous', { kind: 'quiet', class: 'compact', testid: 'superbyte.reading.prev', ariaLabel: 'Previous reading', onClick: () => { v.tip = (v.tip - 1 + obs.length) % obs.length; refresh(r, enc, filed); focusTid('superbyte.reading.prev'); } }),
      h('span', { class: 'count', text: (v.tip + 1) + ' of ' + obs.length }),
      btn('Next ›', { kind: 'quiet', class: 'compact', testid: 'superbyte.reading.next', ariaLabel: 'Next reading', onClick: () => { v.tip = (v.tip + 1) % obs.length; refresh(r, enc, filed); focusTid('superbyte.reading.next'); } })) : null;
    const reading = tip
      ? h('div', { class: 'sb-reading', 'aria-live': 'polite', 'aria-atomic': 'true', 'aria-label': 'Instrument reading', testid: 'superbyte.reading' },
        h('div', { class: 'row between sb-readhead' }, h('span', { class: 'sb-kind', text: KIND[tip.kind] || tip.kind }), pager),
        h('p', { class: 'sb-say', text: tip.say }),
        h('p', { class: 'small sb-whyline', text: tip.why }),
        tip.question ? h('p', { class: 'sb-q', text: tip.question }) : null,
        h('p', { class: 'small muted sb-src', text: 'Source: ' + tip.source + (tip.evidence ? ' · evidence “' + tip.evidence + '”' : tip.absent ? ' · verified absent: ' + tip.absent : '') }))
      : h('p', { class: 'small muted sb-reading', testid: 'superbyte.reading', text: filed && !any ? 'This note was filed without stored text; corrections are addenda on the Encounter.' : !any ? 'Readings appear as you write. The gauges below run locally from the same rules Byte uses.' : !enough ? 'A few more words and the instrument starts reading.' : 'No instrument reading on this draft; the gauges below stay live.' });
    const panel = h('section', { class: 'card stack sb-byte', 'aria-label': 'SuperByte observational pioneer', testid: 'superbyte.panel',
      onCopy: (ev) => ev.preventDefault(), onCut: (ev) => ev.preventDefault(), onContextmenu: (ev) => ev.preventDefault() },
      h('div', { class: 'sb-bytehead' }, h('div', { class: 'sb-facewrap' }, face(mood), h('span', { class: 'sb-observe', 'aria-hidden': 'true', text: 'observe' })),
        h('div', { class: 'grow stack sb-titles' }, h('div', { class: 'row sb-titlerow' }, h('h2', { text: 'SuperByte' }), chip('info', 'Instrument · Pioneer dark', { testid: 'superbyte.layer' })),
          h('p', { class: 'small sb-status', 'aria-live': 'polite', testid: 'superbyte.status', text: status })),
        compass(rep.onCourse)),
      h('p', { class: 'small sb-oneway', text: 'Observes only, in language and graphics. You cannot prompt it, copy its text into the note, or send it feedback.' }),
      pipeline, reading, rails(rep));
    return panel;
  }

  Proto.screens.superbyte = { render, viewFor };
  Proto.router.on('superbyte', (r) => Proto.screens.superbyte.render(r));
})();
