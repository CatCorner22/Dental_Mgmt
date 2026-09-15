import type { ModuleDef } from "@/lib/schema/types";

export const boneGraftSinus: ModuleDef = {
  id: "bone-graft-sinus",
  title: "Bone Graft, Regeneration, and Sinus Add-On",
  order: 140,
  description: "Grafting, guided regeneration, and sinus procedures.",
  sections: [
    {
      id: "main",
      title: "Bone graft, regeneration, and sinus",
      fields: [
        {
          id: "procedure-site",
          type: "text",
          label: "Procedure and site",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "defect",
          type: "text",
          label: "Defect type and measurements",
          placeholderHint: "<fact>"
        },
        {
          id: "donor-recipient",
          type: "text",
          label: "Donor and recipient sites",
          placeholderHint: "<fact>"
        },
        {
          id: "sinus-membrane",
          type: "text",
          label: "Sinus membrane status and management",
          placeholderHint: "<fact>",
          standardPhrases: ["Not applicable."]
        },
        {
          id: "materials",
          type: "text",
          label: "Graft, membrane, biologic, fixation, manufacturer, amount, and lot",
          standardPhrases: ["Recorded in the EDR."]
        },
        {
          id: "steps",
          type: "textarea",
          label:
            "Preparation, decortication, harvest, placement, containment, closure, and stability",
          placeholderHint: "<performed steps>"
        },
        {
          id: "outcome",
          type: "textarea",
          label: "Complication, hemostasis, image, instructions, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
