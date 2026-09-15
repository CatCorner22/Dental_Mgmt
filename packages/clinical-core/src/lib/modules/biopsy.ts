import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const biopsy: ModuleDef = {
  id: "biopsy",
  title: "Biopsy, Lesion, and Infection Add-On",
  order: 130,
  description: "Biopsy, aspiration, culture, incision and drainage, exposure.",
  sections: [
    {
      id: "main",
      title: "Biopsy, lesion, and infection",
      fields: [
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "incisional biopsy",
            "excisional biopsy",
            "aspiration",
            "culture",
            "incision and drainage",
            "exposure"
          ),
          allowOther: true
        },
        {
          id: "site",
          type: "text",
          label: "Lesion or infection site",
          required: true,
          placeholderHint: "<precise anatomy>"
        },
        {
          id: "lesion-description",
          type: "textarea",
          label:
            "Size in three dimensions, color, surface, border, consistency, mobility, symptoms, duration, and image findings",
          placeholderHint: "<facts>"
        },
        {
          id: "differential",
          type: "text",
          label: "Differential or diagnosis",
          required: true,
          placeholderHint: "<clinician-supplied terms>"
        },
        {
          id: "technique",
          type: "textarea",
          label:
            "Incision, tissue removed, drainage amount and character, irrigation, drain, closure, and hemostasis",
          placeholderHint: "<facts>"
        },
        {
          id: "specimen",
          type: "text",
          label:
            "Specimen container, fixative, orientation, test request, laboratory, and tracking",
          standardPhrases: ["Recorded in the EDR."]
        },
        {
          id: "pathology-follow-up",
          type: "text",
          label: "Pathology follow-up owner and due status",
          placeholderHint: "<role and workflow>"
        },
        {
          id: "escalation",
          type: "textarea",
          label: "Escalation and return precautions",
          placeholderHint: "<exact triggers>"
        }
      ]
    }
  ]
};
