import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Temporomandibular disorders.
//
// Previously two options in an Oral Medicine select with everything else as
// free prose. The measurements are the reason this needs structure: range of
// motion and joint noise are the findings a later reader compares against, and
// a number buried in a paragraph cannot be compared with anything.
//
// The numeric fields are `measurement`, not text, so the existing range audit
// actually inspects them — a 90 mm opening is a typo, and nothing was checking.
export const tmjTmd: ModuleDef = {
  id: "tmj-tmd",
  title: "TMJ and Orofacial Pain Add-On",
  order: 206,
  description:
    "Temporomandibular joint and muscle disorders (TMD): pain history, measured range of motion, joint noise, muscle palpation, clenching and grinding, and splint or appliance therapy.",
  sections: [
    {
      id: "history",
      title: "Pain history",
      fields: [
        {
          id: "complaint",
          type: "text",
          label: "Presenting complaint in the patient's words",
          required: true,
          placeholderHint: "<de-identified patient-reported words>",
          helpText: "Patient-reported. Keep it attributed rather than restated as a finding."
        },
        {
          id: "laterality",
          type: "select",
          label: "Side",
          required: true,
          options: opts("right", "left", "bilateral", "not localized by the patient")
        },
        {
          id: "onset",
          type: "text",
          label: "Onset and course",
          placeholderHint: "<relative interval, not an identifying date>"
        },
        {
          id: "aggravating",
          type: "text",
          label: "Aggravating and relieving factors",
          placeholderHint: "<facts>",
          standardPhrases: ["The patient reports worse symptoms on waking."]
        },
        {
          id: "parafunction",
          type: "textarea",
          label: "Parafunction and contributing history",
          placeholderHint: "<facts>",
          helpText: "Clenching, grinding, nail biting, gum, prior trauma, prior treatment."
        }
      ]
    },
    {
      id: "examination",
      title: "Measured examination",
      fields: [
        {
          id: "mio",
          type: "measurement",
          label: "Maximum incisal opening",
          units: ["mm"],
          min: 0,
          max: 80,
          helpText: "Measured, not estimated. Comfortable and maximum openings are different facts — say which."
        },
        {
          id: "opening-type",
          type: "select",
          label: "Which opening was measured",
          options: opts("maximum unassisted", "maximum assisted", "comfortable")
        },
        {
          id: "excursion-right",
          type: "measurement",
          label: "Right lateral excursion",
          units: ["mm"],
          min: 0,
          max: 30
        },
        {
          id: "excursion-left",
          type: "measurement",
          label: "Left lateral excursion",
          units: ["mm"],
          min: 0,
          max: 30
        },
        {
          id: "protrusion",
          type: "measurement",
          label: "Protrusion",
          units: ["mm"],
          min: 0,
          max: 30
        },
        {
          id: "deviation",
          type: "text",
          label: "Deviation or deflection on opening",
          placeholderHint: "<observed>",
          standardPhrases: ["Opens without deviation."]
        },
        {
          id: "joint-noise",
          type: "multiselect",
          label: "Joint noise",
          options: opts(
            "none",
            "click, right",
            "click, left",
            "crepitus, right",
            "crepitus, left",
            "locking reported"
          ),
          helpText: "Record what was heard or felt, and on which side."
        },
        {
          id: "palpation",
          type: "textarea",
          label: "Muscle and joint palpation",
          placeholderHint: "<sites and response>",
          helpText: "Name the sites palpated and the response at each — masseter, temporalis, lateral pole."
        },
        {
          id: "imaging",
          type: "text",
          label: "Imaging reviewed and by whom interpreted",
          placeholderHint: "<image type and interpreter's role>",
          standardPhrases: ["No imaging taken at this visit."],
          helpText:
            "Acquisition and interpretation are separate facts. A radiographic finding is attributed to the dentist who interpreted it."
        }
      ]
    },
    {
      id: "management",
      title: "Management",
      fields: [
        {
          id: "appliance",
          type: "select",
          label: "Appliance",
          options: opts(
            "none at this visit",
            "flat-plane stabilization splint",
            "anterior repositioning appliance",
            "soft appliance",
            "adjustment of an existing appliance"
          ),
          allowOther: true
        },
        {
          id: "appliance-detail",
          type: "textarea",
          label: "Appliance fit, adjustment, and wear instruction",
          placeholderHint: "<what was fitted or adjusted, and what was instructed>",
          visibleIf: { fieldId: "appliance", notEquals: "none at this visit" }
        },
        {
          id: "self-care",
          type: "textarea",
          label: "Self-care advice given",
          placeholderHint: "<advice as given>",
          standardPhrases: [
            "Soft diet, heat, and jaw-rest advice given.",
            "Awareness of daytime clenching discussed."
          ]
        },
        {
          id: "referral",
          type: "text",
          label: "Referral or co-management",
          placeholderHint: "<role and purpose>",
          standardPhrases: ["Not indicated at this visit."]
        },
        {
          id: "review",
          type: "text",
          label: "Review interval and what will be reassessed",
          required: true,
          placeholderHint: "<interval and measures to repeat>",
          helpText: "Name the measurements to repeat, so the next visit is comparable to this one."
        }
      ]
    }
  ]
};
