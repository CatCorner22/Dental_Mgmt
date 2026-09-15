import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const directRestorative: ModuleDef = {
  id: "direct-restorative",
  title: "Direct Restorative Add-On",
  order: 50,
  description: "Direct restoration, core, buildup, temporary restoration.",
  sections: [
    {
      id: "main",
      title: "Direct restoration",
      fields: [
        {
          id: "teeth",
          type: "toothPicker",
          label: "Tooth",
          required: true,
          dentitions: ["permanent", "primary", "supernumerary-permanent", "supernumerary-primary"],
          multiple: true
        },
        {
          id: "surfaces",
          type: "surfacePicker",
          label: "Surfaces",
          required: true,
          linkedToothFieldId: "teeth"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Diagnosis and indication",
          required: true,
          placeholderHint: "<clinician-supplied term>"
        },
        {
          id: "preop-tests",
          type: "text",
          label: "Preoperative tests and image",
          placeholderHint: "<fact>"
        },
        {
          id: "anesthesia",
          type: "text",
          label: "Anesthesia",
          standardPhrases: ["See the Medication and Prescription add-on.", "None."]
        },
        {
          id: "isolation",
          type: "select",
          label: "Isolation",
          options: opts("dental dam", "relative isolation"),
          allowOther: true
        },
        {
          id: "removal",
          type: "text",
          label: "Existing material or caries removed",
          placeholderHint: "<fact>"
        },
        {
          id: "preparation",
          type: "text",
          label: "Preparation and pulp protection",
          placeholderHint: "<fact>"
        },
        {
          id: "materials",
          type: "textarea",
          label: "Material, shade, liner, base, adhesive, matrix, wedge, and curing",
          placeholderHint: "<exact supplied facts>"
        },
        {
          id: "finish",
          type: "textarea",
          label: "Contacts, margins, contour, occlusion, and finish",
          placeholderHint: "<specific findings and adjustments>"
        },
        {
          id: "postop-image",
          type: "text",
          label: "Postoperative image",
          standardPhrases: ["See the Imaging add-on.", "None acquired."]
        },
        {
          id: "outcome",
          type: "text",
          label: "Complication, response, instructions, and prognosis",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
