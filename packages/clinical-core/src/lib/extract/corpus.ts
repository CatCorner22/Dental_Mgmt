// REAL SHORTHAND, as staff actually type it.
//
// The measurement corpus for the clause parser. Every note here is written the
// way a hygienist or dentist writes between patients: telegraphic, comma-run,
// abbreviation-dense, no sentences. That is the input the parser has to survive,
// and measuring against tidy prose would tell us nothing we need to know.
//
// THIS FILE IS THE GROWTH SIGNAL. coverage.test.ts asserts a floor against it
// and prints what could not be read, so the grammar grows from phrases people
// really type rather than from ones we imagined. When coverage rises, the floor
// rises with it and cannot silently regress.
//
// NO REAL PATIENT CONTENT. Every note is synthetic, written for this file. No
// names, no dates, no identifiers — the corpus is committed to the repository
// and must be safe to read by anyone who can read the repository.

export interface CorpusNote {
  id: string;
  noteType: string;
  text: string;
}

export const SHORTHAND_CORPUS: CorpusNote[] = [
  {
    id: "endo-emergency",
    noteType: "endodontic",
    text: "Pt c/o pain UR quad x3 days. #3 PARL on PA. Perc +, cold lingering. Dx irrev pulpitis #3. RCT #3 started, 2 carp lido 2% w epi 1:100k, rubber dam iso. CaOH placed, temp Cavit. Rx ibuprofen 600 mg q6h prn. RTC 2 wks for obturation."
  },
  {
    id: "restorative-two-teeth",
    noteType: "restorative",
    text: "#14 MOD comp, #15 DO comp. 1.8 mL lido 2% w epi. Rubber dam iso, etch bond A2 shade. Occlusion checked and adjusted. Pt tol well, NKA."
  },
  {
    id: "hygiene-recall",
    noteType: "hygiene",
    text: "Adult prophy completed. 4 BW taken, no caries noted. Perio probing WNL, no BOP. OHI given, floss demo. Fluoride varnish applied. RTC 6 mo."
  },
  {
    id: "surgical-extraction",
    noteType: "surgical",
    text: "#17 surgical extraction. 3 carp lido 2% w epi 1:100k. Flap raised, bone removed, tooth sectioned and delivered. Socket curetted and irrigated. 3-0 chromic gut sutures placed. Post-op instr given verbally and in writing. Rx ibuprofen 600 mg."
  },
  {
    id: "perio-srp",
    noteType: "periodontal",
    text: "SRP UR and LR quads. 2 carp lido. Generalized 4-5 mm pockets, localized 6 mm #3 and #30. Heavy calculus removed. Pt tol well. RTC 4 wks for re-eval, then perio maintenance."
  },
  {
    id: "crown-prep",
    noteType: "prosthodontic",
    text: "#19 crown prep. Existing MOD amalgam removed, recurrent caries excavated. Core build up placed. Prep refined, cord packed, PVS impression taken. Temp crown fabricated and cemented with temp cement. Occlusion and contacts verified. Shade A3."
  },
  {
    id: "peds-pulpotomy",
    noteType: "pediatric",
    text: "#T pulpotomy and SSC. N2O 30%. 1 carp lido. Caries excavated, pulp amputated, formocresol applied. SSC sized, crimped and cemented. Pt cooperative. Parent given post-op instr."
  },
  {
    id: "exam-new-patient",
    noteType: "diagnostic",
    text: "Comprehensive exam. FMS taken. Existing crown #19, existing MOD amalgam #14 and #30. Caries #4 O, #12 MO, #29 DO. No perio pockets over 3 mm. Oral cancer screening negative. Tx plan discussed and presented."
  },
  {
    id: "post-op-check",
    noteType: "follow-up",
    text: "Post-op check #17 extraction. Socket healing well, no signs of dry socket, no swelling. Sutures removed. Pt reports mild soreness only, no longer taking ibuprofen. No further treatment needed today."
  },
  {
    id: "range-sealants",
    noteType: "preventive",
    text: "Sealants placed #2-5. Teeth isolated and etched. No caries present. Occlusion checked. RTC 6 mo for recall."
  },
  {
    id: "emergency-limited",
    noteType: "diagnostic",
    text: "Limited exam. Pt c/o broken tooth LL. #19 fractured cusp, no pulp exposure. PA taken, no PARL. Smoothed sharp edge. Tx options discussed, pt elects crown. RTC for crown prep."
  },
  {
    id: "denture-delivery",
    noteType: "prosthodontic",
    text: "Upper complete denture delivered. Fit and retention verified, occlusion adjusted. Two sore spots relieved. Home care instr given. RTC 1 wk for adjustment."
  },
  {
    id: "medical-history-heavy",
    noteType: "hygiene",
    text: "MH reviewed and updated. HTN controlled, DM type 2 A1c 6.8. Pt on anticoagulant, no premed needed per physician. BP 128/78. NKDA. Adult prophy completed. Perio maintenance 3 mo interval."
  },
  {
    id: "negated-heavy",
    noteType: "diagnostic",
    text: "Periodic exam. No caries. No BOP. No perio pockets over 3 mm. No lesions. TMJ WNL, no clicking. Occlusion stable. Existing restorations intact."
  },
  {
    id: "quadrant-composite",
    noteType: "restorative",
    text: "#3 MO comp, #4 O comp, #5 DO comp. 2 carp lido 2% w epi. Rubber dam iso. Shade A2. Occlusion checked and adjusted. Pt tol well."
  }
];
