import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const implant: ModuleDef = {
  id: "implant",
  title: "Implant Add-On",
  order: 100,
  description: "Implant placement, uncovering, restoration, maintenance, removal.",
  sections: [
    {
      id: "main",
      title: "Implant",
      fields: [
        {
          id: "stage",
          type: "select",
          label: "Stage",
          required: true,
          options: opts(
            "evaluation",
            "guided planning",
            "placement",
            "grafting",
            "uncovering",
            "impression",
            "scan",
            "provisional",
            "final restoration",
            "maintenance",
            "repair",
            "removal"
          )
        },
        optionalTeeth(
          "adjacent-teeth",
          "Adjacent natural teeth",
          "The implant site itself is edentulous — name the neighbouring teeth here and the site below."
        ),
        {
          id: "site",
          type: "text",
          label: "Edentulous site",
          required: true,
          placeholderHint: "<value>",
          helpText: "Name the edentulous site (e.g. the space, region, or arch position)."
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Diagnosis and indication",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "image-risk",
          type: "text",
          label: "Image and anatomical risk review",
          placeholderHint: "<fact>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "guide-plan",
          type: "text",
          label: "Guide and plan",
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "components",
          type: "text",
          label: "Implant or component manufacturer, system, dimensions, lot, and catalog",
          standardPhrases: ["Recorded in the EDR."],
          helpText: "Manufacturer, lot, and catalog numbers stay in the EDR."
        },
        {
          id: "surgical-values",
          type: "textarea",
          label:
            "Osteotomy, irrigation, insertion torque, stability measure, depth, position, and angulation",
          placeholderHint: "<verified values>"
        },
        {
          id: "closure-stage",
          type: "text",
          label: "Cover screw or healing abutment",
          placeholderHint: "<fact>"
        },
        {
          id: "graft",
          type: "text",
          label: "Graft, membrane, biologic, fixation, and closure",
          placeholderHint: "<fact>"
        },
        {
          id: "restoration",
          type: "textarea",
          label:
            "Restoration component, torque source and verified value, screw access, cement, contacts, and occlusion",
          placeholderHint: "<fact>"
        },
        {
          id: "baseline",
          type: "text",
          label: "Baseline probing and image",
          placeholderHint: "<when appropriate>"
        },
        {
          id: "outcome",
          type: "textarea",
          label:
            "Complication, neurosensory status, sinus or anatomical event, instructions, hygiene, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
