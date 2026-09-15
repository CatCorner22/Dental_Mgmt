import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Elective cosmetic dentistry: whitening and smile-design workup.
//
// Veneers and crowns already have Fixed Prosthodontic, which covers the
// restorative sequence properly. What had no home at all was whitening — not
// even an option in Preventive — and the case workup that precedes a smile
// makeover.
//
// The governing difference from restorative work: this is ELECTIVE. There is no
// disease being treated, so "the patient wanted it" is the whole indication,
// and the consent conversation carries more weight than it does when a tooth
// is broken. Hence a consent field that is required rather than optional, and
// an expectations field — unmet expectation is what a cosmetic complaint is
// actually about.
export const cosmetic: ModuleDef = {
  id: "cosmetic",
  title: "Cosmetic and Whitening Add-On",
  order: 207,
  description:
    "Elective aesthetic care: whitening and bleaching, and the photographic and mock-up workup behind a smile-design or smile-makeover case. Use Fixed Prosthodontic for the veneer or crown sequence itself.",
  sections: [
    {
      id: "goal",
      title: "Patient goal and consent",
      fields: [
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "in-office whitening",
            "take-home whitening",
            "combined in-office and take-home whitening",
            "internal (non-vital) bleaching",
            "smile-design workup",
            "cosmetic re-contouring"
          ),
          allowOther: true
        },
        {
          id: "patient-goal",
          type: "textarea",
          label: "What the patient asked for, in their words",
          required: true,
          placeholderHint: "<de-identified patient-reported words>",
          helpText:
            "Elective care has no disease to point at. What the patient wanted is the indication, so it is recorded as they said it."
        },
        {
          id: "expectations",
          type: "textarea",
          label: "Expectations discussed, including limits",
          required: true,
          placeholderHint: "<what was discussed>",
          standardPhrases: [
            "Discussed that existing restorations do not change color with whitening and may need replacing to match.",
            "Discussed that results vary between patients and that a specific shade cannot be guaranteed."
          ],
          helpText:
            "A cosmetic complaint is almost always about an expectation, not a defect. Record what was actually said."
        },
        {
          id: "consent",
          type: "select",
          label: "Consent for elective treatment",
          required: true,
          // Phrased to name the DISCUSSION rather than assert the conclusion.
          // "Consent obtained" is on this app's own vague-phrase list — and the
          // module integrity test caught it here, which is the rule doing
          // exactly its job on the form that models the language.
          options: opts(
            "risks, benefits, and alternatives discussed; the patient agreed verbally, recorded in the EDR",
            "risks, benefits, and alternatives discussed; the patient signed the form stored in the EDR",
            "discussed; the patient declined treatment",
            "discussed; the patient deferred the decision"
          )
        },
        {
          id: "photos",
          type: "select",
          label: "Clinical photographs",
          options: opts(
            "not taken",
            "taken for the clinical record only",
            "taken; separate written consent for use beyond the record is on file in the EDR"
          ),
          helpText:
            "Use beyond the clinical record — teaching, marketing — needs its own consent, separately from consent to treat."
        }
      ]
    },
    {
      id: "whitening",
      title: "Whitening detail",
      fields: [
        {
          id: "agent",
          type: "text",
          label: "Agent and concentration",
          placeholderHint: "<agent and concentration as supplied>",
          helpText: "Record what was used. This tool never suggests an agent or a concentration."
        },
        {
          id: "delivery",
          type: "select",
          label: "Delivery",
          options: opts(
            "custom trays",
            "prefabricated trays",
            "in-office application with isolation",
            "internal, sealed in the access cavity"
          ),
          allowOther: true
        },
        {
          id: "isolation",
          type: "text",
          label: "Soft-tissue isolation and protection",
          placeholderHint: "<what was used>",
          standardPhrases: ["Liquid dam and retractors placed; tissues checked before activation."]
        },
        {
          id: "shade-before",
          type: "text",
          label: "Shade before",
          placeholderHint: "<shade guide and tab>",
          helpText: "Name the guide as well as the tab, or the two visits are not comparable."
        },
        {
          id: "shade-after",
          type: "text",
          label: "Shade after",
          placeholderHint: "<shade guide and tab>"
        },
        {
          id: "sensitivity",
          type: "textarea",
          label: "Sensitivity reported and what was advised",
          placeholderHint: "<facts and advice>",
          standardPhrases: [
            "None reported at this visit.",
            "Transient sensitivity discussed; desensitizing advice given."
          ]
        },
        {
          id: "home-instructions",
          type: "textarea",
          label: "Home instructions given",
          placeholderHint: "<instructions as given>"
        }
      ]
    },
    {
      id: "design",
      title: "Smile-design workup",
      fields: [
        {
          id: "records-taken",
          type: "multiselect",
          label: "Records taken",
          options: opts(
            "photographic series",
            "digital scans",
            "impressions",
            "face-bow or facial reference",
            "shade photographs with reference tab"
          )
        },
        {
          id: "mockup",
          type: "select",
          label: "Mock-up or trial",
          options: opts(
            "none at this visit",
            "diagnostic wax-up prepared",
            "intraoral mock-up trialled",
            "digital design reviewed with the patient"
          ),
          allowOther: true
        },
        {
          id: "patient-response",
          type: "textarea",
          label: "Patient response to the trial",
          placeholderHint: "<what the patient said>",
          visibleIf: { fieldId: "mockup", notEquals: "none at this visit" },
          helpText: "The approval that a later dispute turns on. Record it as the patient said it."
        },
        {
          id: "sequence",
          type: "textarea",
          label: "Agreed sequence and phasing",
          placeholderHint: "<phases and order>",
          helpText:
            "Health before aesthetics: record any disease, periodontal, or occlusal treatment that comes first."
        },
        {
          id: "prerequisites",
          type: "text",
          label: "Prerequisites to be completed first",
          placeholderHint: "<fact>",
          standardPhrases: ["None outstanding.", "Periodontal stability required before restorative phases."]
        }
      ]
    }
  ]
};
