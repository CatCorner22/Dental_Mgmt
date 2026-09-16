import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const fixedProsthodontic: ModuleDef = {
  id: "fixed-prosthodontic",
  title: "Fixed Prosthodontic Add-On",
  order: 60,
  description: "Crown, veneer, inlay, onlay, bridge, provisional.",
  sections: [
    {
      id: "main",
      title: "Fixed prosthodontics",
      fields: [
        {
          id: "stage",
          type: "select",
          label: "Procedure stage",
          required: true,
          options: opts(
            "evaluation",
            "preparation",
            "impression",
            "scan",
            "provisional",
            "try-in",
            "cementation",
            "repair",
            "removal"
          )
        },
        optionalTeeth(
          "teeth",
          "Natural teeth involved (abutments or restored teeth)",
          "Pick the natural teeth. Describe pontics, implant sites, or spans in the field below."
        ),
        {
          id: "site",
          type: "text",
          label: "Pontic, implant site, or span detail",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Diagnosis and indication",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "goal",
          type: "text",
          label: "Therapeutic goal, risk, and prognosis",
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "material-design",
          type: "text",
          label: "Material and design",
          placeholderHint: "<fact>"
        },
        {
          id: "preparation",
          type: "textarea",
          label: "Reduction, margin design and location, core, post, and tissue management",
          placeholderHint: "<fact>"
        },
        {
          id: "impression",
          type: "text",
          label: "Impression or optical scan, opposing arch, bite record, and quality",
          placeholderHint: "<fact>"
        },
        {
          id: "shade",
          type: "text",
          label: "Shade and characterization",
          placeholderHint: "<fact>"
        },
        {
          id: "provisional",
          type: "text",
          label: "Provisional material, cement, contacts, margins, and occlusion",
          placeholderHint: "<fact>"
        },
        {
          id: "laboratory",
          type: "text",
          label: "Laboratory prescription and due stage",
          standardPhrases: ["Linked in the EDR."]
        },
        {
          id: "try-in",
          type: "text",
          label: "Try-in evaluation",
          placeholderHint: "<fit, margins, contacts, occlusion, shade, patient decision>"
        },
        {
          id: "cementation",
          type: "text",
          label: "Final cement, isolation, cleanup, radiograph, and occlusion",
          placeholderHint: "<fact>"
        },
        {
          id: "outcome",
          type: "text",
          label: "Complication, instructions, hygiene, and follow-up",
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
