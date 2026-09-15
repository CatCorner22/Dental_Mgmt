import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const orthodontic: ModuleDef = {
  id: "orthodontic",
  title: "Orthodontic Add-On",
  order: 190,
  description:
    "Braces, aligners, retainers, appliances. Complete the case record for records or consultation visits; complete the progress visit for active treatment.",
  sections: [
    {
      id: "case-record",
      title: "Comprehensive Orthodontic Case Record",
      fields: [
        {
          id: "diagnosis",
          type: "textarea",
          label: "Clinician-supplied diagnosis, problem list, prognosis, and treatment objectives",
          placeholderHint: "<facts>"
        },
        {
          id: "assessment",
          type: "textarea",
          label:
            "Facial, skeletal, dental, occlusal, periodontal, airway, temporomandibular, growth, and risk assessment",
          placeholderHint: "<assessed facts and limits>"
        },
        {
          id: "records",
          type: "multiselect",
          label: "Records",
          options: opts(
            "photographs",
            "radiographs",
            "cephalometrics",
            "scan",
            "models",
            "measurements"
          ),
          helpText: "Link the records themselves in the EDR."
        },
        {
          id: "options",
          type: "textarea",
          label:
            "Options, risks, benefits, alternatives, no-treatment option, referral, and decision",
          placeholderHint: "<facts>"
        },
        {
          id: "plan",
          type: "textarea",
          label: "Treatment plan, appliance strategy, planned stages, coordination, and retention plan",
          placeholderHint: "<facts>"
        },
        {
          id: "progress-evaluation",
          type: "textarea",
          label:
            "Progress evaluation, deviations, outcome, final records, prognosis, and maintenance",
          placeholderHint: "<facts>"
        }
      ]
    },
    {
      id: "progress-visit",
      title: "Orthodontic Progress Visit",
      fields: [
        {
          id: "stage",
          type: "select",
          label: "Stage",
          options: opts(
            "bonding",
            "adjustment",
            "aligner delivery",
            "interproximal reduction",
            "emergency",
            "debond",
            "retention",
            "observation"
          )
        },
        {
          id: "objective",
          type: "text",
          label: "Visit objective and progress",
          placeholderHint: "<facts>"
        },
        {
          id: "appliance",
          type: "textarea",
          label:
            "Appliance, arch, teeth, brackets, bands, wire, elastics, attachments, auxiliaries, and settings",
          placeholderHint: "<fact>"
        },
        {
          id: "ipr",
          type: "text",
          label: "Interproximal reduction",
          placeholderHint: "<tooth pair, surface, exact amount and unit>",
          visibleIf: { fieldId: "stage", equals: "interproximal reduction" },
          requiredIf: { fieldId: "stage", equals: "interproximal reduction" }
        },
        {
          id: "aligner",
          type: "text",
          label: "Aligner number, fit, tracking, attachments, and wear instruction",
          placeholderHint: "<fact>"
        },
        {
          id: "observations",
          type: "text",
          label: "Oral hygiene, periodontal, caries, root, TMD, and compliance observations",
          placeholderHint: "<objective facts>"
        },
        {
          id: "adverse-events",
          type: "text",
          label: "Breakage, soft-tissue injury, emergency action, and adverse event",
          standardPhrases: ["None observed or reported during this visit."]
        },
        {
          id: "debond",
          type: "text",
          label:
            "Debond, adhesive removal, final records, retainer type, delivery, wear, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
