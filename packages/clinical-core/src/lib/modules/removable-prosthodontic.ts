import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const removableProsthodontic: ModuleDef = {
  id: "removable-prosthodontic",
  title: "Removable Prosthodontic Add-On",
  order: 70,
  description: "Denture, partial denture, reline, rebase, repair.",
  sections: [
    {
      id: "main",
      title: "Removable prosthodontics",
      fields: [
        {
          id: "stage",
          type: "select",
          label: "Appliance and stage",
          required: true,
          options: opts(
            "complete denture",
            "partial denture",
            "overdenture",
            "immediate denture",
            "reline",
            "rebase",
            "repair",
            "evaluation"
          )
        },
        optionalTeeth(
          "abutment-teeth",
          "Abutment or retained teeth",
          "Pick the natural teeth the appliance engages. Describe the arch and design below."
        ),
        {
          id: "arch-design",
          type: "text",
          label: "Arch and design",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Diagnosis and indication",
          placeholderHint: "<fact>"
        },
        {
          id: "goal",
          type: "text",
          label: "Therapeutic goal, risk, and prognosis",
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "existing-appliance",
          type: "text",
          label: "Existing appliance findings",
          placeholderHint: "<fit, retention, stability, support, occlusion, tissue>"
        },
        {
          id: "records",
          type: "textarea",
          label:
            "Impression, scan, border molding, jaw relation, vertical dimension, and facebow",
          placeholderHint: "<fact>"
        },
        {
          id: "design-details",
          type: "text",
          label: "Tooth mold, shade, arrangement, framework, base, and material",
          placeholderHint: "<fact>"
        },
        {
          id: "try-in",
          type: "text",
          label: "Try-in findings and patient decision",
          placeholderHint: "<fact>"
        },
        {
          id: "delivery",
          type: "textarea",
          label: "Delivery adjustments",
          placeholderHint:
            "<pressure areas, border, retention, stability, phonetics, esthetics, occlusion>"
        },
        {
          id: "identification",
          type: "text",
          label: "Identification mark and laboratory details",
          standardPhrases: ["Recorded in the EDR."]
        },
        {
          id: "instructions",
          type: "textarea",
          label: "Insertion, removal, hygiene, sleep, diet, sore-spot, and recall instructions",
          placeholderHint: "<fact>"
        },
        {
          id: "outcome",
          type: "text",
          label: "Complication and follow-up",
          placeholderHint: "<fact>"
        },
        {
          id: "goal-achieved",
          type: "text",
          label: "Goal achieved, deviation and reason, maintenance, and interdisciplinary coordination",
          placeholderHint: "<facts>"
        }
      ]
    }
  ]
};
