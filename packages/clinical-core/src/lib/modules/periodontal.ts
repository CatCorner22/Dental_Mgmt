import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

// Periodontics was the least structured module in the tool, which is backwards:
// it is the discipline whose whole practice is comparing numbers between
// visits. Probing depth, recession, attachment level, bleeding, suppuration,
// mobility, furcation and plaque all collapsed into ONE optional single-line
// field whose standard phrase was "Site-specific chart linked in the EDR." A
// note could satisfy the entire periodontal record by pointing somewhere else.
//
// The summary measures are now `measurement` fields, so the range audit
// inspects them and the next visit is comparable to this one. They are
// deliberately WHOLE-MOUTH summaries: the six-point chart belongs in the EDR
// and this tool does not pretend to replace it. What changed is that saying
// "it's in the EDR" is now an answer to a specific question — recorded when? —
// rather than the whole periodontal record.
//
// The narrative field is kept, and so is the EDR phrase. Numbers cannot carry
// a mucogingival finding or a note about a failing implant.
export const periodontal: ModuleDef = {
  id: "periodontal",
  title: "Periodontal Add-On",
  order: 90,
  description: "Periodontal evaluation, debridement, scaling, maintenance, surgery.",
  sections: [
    {
      id: "main",
      title: "Periodontics",
      fields: [
        {
          id: "exam-type",
          type: "select",
          label: "Examination type",
          required: true,
          options: opts("screening", "comprehensive", "reassessment", "maintenance")
        },
        {
          id: "chart-status",
          type: "select",
          label: "Site-specific charting",
          required: true,
          options: opts(
            "Full six-point chart recorded in the EDR at this visit.",
            "Full six-point chart recorded in the EDR at a previous visit; not repeated at this visit.",
            "Screening probing only; no full chart at this visit.",
            "Charting was not completed at this visit."
          ),
          helpText:
            "The six-point chart itself lives in the EDR — this tool does not replace it. Say which of these is true, because \"chart in the EDR\" means something different when there isn't one."
        },
        {
          id: "ppd-max",
          type: "measurement",
          label: "Deepest probing depth recorded",
          units: ["mm"],
          min: 0,
          max: 15,
          helpText: "Whole-mouth summary. The site-by-site depths stay in the EDR chart."
        },
        {
          id: "cal-max",
          type: "measurement",
          label: "Greatest clinical attachment loss recorded",
          units: ["mm"],
          min: 0,
          max: 20
        },
        {
          id: "recession-max",
          type: "measurement",
          label: "Greatest recession recorded",
          units: ["mm"],
          min: 0,
          max: 20
        },
        {
          id: "bop-percent",
          type: "measurement",
          label: "Bleeding on probing",
          units: ["%"],
          min: 0,
          max: 100,
          helpText:
            "The number a later reader compares this visit against the next one. Record it even when it is zero."
        },
        {
          id: "plaque-percent",
          type: "measurement",
          label: "Plaque score",
          units: ["%"],
          min: 0,
          max: 100
        },
        {
          id: "mobility-max",
          type: "select",
          label: "Greatest mobility recorded",
          options: opts(
            "none recorded",
            "Grade 1",
            "Grade 2",
            "Grade 3",
            "not assessed at this visit"
          ),
          helpText: "Name the grading scale in the narrative if the practice uses more than one."
        },
        {
          id: "furcation-max",
          type: "select",
          label: "Greatest furcation involvement recorded",
          options: opts(
            "none recorded",
            "Class I",
            "Class II",
            "Class III",
            "not assessed at this visit"
          )
        },
        {
          id: "suppuration",
          type: "select",
          label: "Suppuration",
          options: opts(
            "none observed",
            "present; sites recorded in the EDR chart",
            "present; sites named in the narrative below",
            "not assessed at this visit"
          )
        },
        {
          id: "chart",
          type: "textarea",
          label:
            "Periodontal narrative: site-specific findings, calculus, mucogingival and implant findings, and anything the summary above does not carry",
          placeholderHint: "<facts>",
          standardPhrases: ["Site-specific chart recorded in the EDR."],
          helpText:
            "The summary measurements above are comparable between visits; this is for what a number cannot say."
        },
        {
          id: "occlusal-findings",
          type: "text",
          label:
            "Proximal contacts, endodontic-periodontal lesions, restoration and prosthesis status, fremitus, and occlusal findings",
          placeholderHint: "<facts>"
        },
        {
          id: "image-bone",
          type: "text",
          label: "Image and bone findings",
          placeholderHint: "<fact>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "bone-quality",
          type: "text",
          label: "Bone quality, quantity, pattern, and anatomic limitations",
          placeholderHint: "<clinician-supplied image or examination facts>"
        },
        {
          id: "risk-factors",
          type: "text",
          label:
            "Named systemic, behavioral, tobacco, glycemic, medication, genetic, and local risk factors",
          placeholderHint: "<facts>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis",
          required: true,
          placeholderHint: "<gingival/periodontal/peri-implant term>"
        },
        {
          id: "stage-grade",
          type: "text",
          label: "Periodontitis extent, stage, and grade",
          placeholderHint: "<when diagnosed>"
        },
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "debridement",
            "scaling and root planing",
            "periodontal maintenance",
            "gingivectomy",
            "flap surgery",
            "graft",
            "regeneration",
            "crown lengthening"
          ),
          allowOther: true
        },
        optionalTeeth(
          "teeth",
          "Teeth treated (if site-specific)",
          "Leave blank for full-mouth or quadrant work; describe those in the field below."
        ),
        {
          id: "sites",
          type: "text",
          label: "Quadrant, sextant, surfaces, and sites",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "technique",
          type: "textarea",
          label:
            "Anesthesia, instruments, irrigation, medicament, laser settings, graft, membrane, biologic, and sutures",
          placeholderHint: "<only supplied facts>"
        },
        {
          id: "response",
          type: "text",
          label: "Tissue response, deposits removed, endpoint, complications, and hemostasis",
          placeholderHint: "<fact>"
        },
        {
          id: "follow-up",
          type: "textarea",
          label:
            "Self-care instruction, risk-factor counseling, reevaluation, maintenance interval, and referral",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
