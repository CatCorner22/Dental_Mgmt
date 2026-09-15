import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const extraction: ModuleDef = {
  id: "extraction",
  title: "Extraction Add-On",
  order: 120,
  description: "Simple and surgical extractions, coronectomy, root removal.",
  sections: [
    {
      id: "main",
      title: "Extraction",
      fields: [
        {
          id: "teeth",
          type: "toothPicker",
          label: "Tooth or root",
          required: true,
          dentitions: ["permanent", "primary", "supernumerary-permanent", "supernumerary-primary"],
          multiple: true
        },
        {
          id: "eruption-status",
          type: "text",
          label: "Eruption or impaction status and classification",
          placeholderHint: "<clinician-supplied fact>"
        },
        {
          id: "indication",
          type: "text",
          label: "Indication and image",
          required: true,
          placeholderHint: "<fact>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "simple extraction",
            "surgical extraction",
            "coronectomy",
            "sectioning",
            "root removal"
          ),
          allowOther: true
        },
        {
          id: "steps",
          type: "textarea",
          label:
            "Flap, bone removal, sectioning, elevation, delivery, socket inspection, curettage, irrigation, and smoothing",
          placeholderHint: "<performed steps>",
          helpText: "Record only the steps actually performed."
        },
        {
          id: "root-findings",
          type: "text",
          label: "Root completeness and anatomical findings",
          placeholderHint: "<fact>"
        },
        {
          id: "events",
          type: "text",
          label:
            "Sinus, nerve, adjacent tooth, tuberosity, fracture, displacement, or other event",
          standardPhrases: [
            "No sinus communication, nerve exposure, adjacent-tooth injury, or fracture was observed during the procedure."
          ]
        },
        {
          id: "socket",
          type: "text",
          label: "Socket preservation, medicament, membrane, or graft",
          standardPhrases: ["None placed."]
        },
        {
          id: "closure",
          type: "text",
          label: "Closure, suture, hemostasis, specimen, and postoperative image",
          placeholderHint: "<fact>"
        },
        {
          id: "instructions",
          type: "textarea",
          label: "Instructions, precautions, prescription, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
