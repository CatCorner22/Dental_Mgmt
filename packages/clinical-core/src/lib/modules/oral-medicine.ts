import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const oralMedicine: ModuleDef = {
  id: "oral-medicine",
  title: "Oral Medicine Add-On",
  order: 200,
  description: "Mucosal lesion, salivary, TMD, sleep, cancer screening.",
  sections: [
    {
      id: "main",
      title: "Oral medicine",
      fields: [
        {
          id: "domain",
          type: "select",
          label: "Domain",
          required: true,
          options: opts(
            "mucosal",
            "salivary",
            "orofacial pain",
            "temporomandibular disorder",
            "sleep",
            "medication-related",
            "cancer therapy"
          ),
          allowOther: true
        },
        {
          id: "history",
          type: "textarea",
          label: "Site, duration, pattern, triggers, systemic features, and prior care",
          placeholderHint: "<facts>"
        },
        {
          id: "examination",
          type: "textarea",
          label: "Examination and measurements",
          placeholderHint: "<specific findings>"
        },
        {
          id: "regional-findings",
          type: "textarea",
          label:
            "Cranial nerve, muscle, joint, range of motion, salivary, lymph node, skin, and mucosal findings",
          placeholderHint: "<assessed domains>"
        },
        {
          id: "studies",
          type: "text",
          label: "Image, laboratory, culture, biopsy, sleep study, or external report",
          placeholderHint: "<fact>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis or differential",
          required: true,
          placeholderHint: "<term>"
        },
        {
          id: "medication-review",
          type: "text",
          label: "Medication review and possible association",
          placeholderHint: "<clinician-supplied fact>"
        },
        {
          id: "plan",
          type: "textarea",
          label:
            "Plan, biopsy, referral, medical coordination, self-care, warning signs, and reassessment",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
