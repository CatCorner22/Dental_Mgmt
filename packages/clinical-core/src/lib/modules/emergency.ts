import type { ModuleDef } from "@/lib/schema/types";

export const emergency: ModuleDef = {
  id: "emergency",
  title: "Emergency Add-On",
  order: 20,
  description: "Pain, swelling, trauma, urgent or palliative care.",
  sections: [
    {
      id: "main",
      title: "Emergency",
      fields: [
        {
          id: "chief-problem",
          type: "text",
          label: "Chief problem and urgency",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "screen",
          type: "textarea",
          label:
            "Airway, breathing, circulation, fever, swelling, dysphagia, dyspnea, trismus, neurologic, and trauma screen",
          placeholderHint: "<specific findings or not assessed>",
          standardPhrases: ["Not assessed: "]
        },
        { id: "site-spread", type: "text", label: "Site and spread", placeholderHint: "<fact>" },
        {
          id: "pain",
          type: "text",
          label: "Pain assessment",
          placeholderHint: "<scale, quality, course>"
        },
        {
          id: "tests",
          type: "text",
          label: "Dental tests and controls",
          placeholderHint: "<fact>"
        },
        {
          id: "images",
          type: "text",
          label: "Images and interpretation",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis or working diagnosis",
          required: true,
          placeholderHint: "<term>"
        },
        {
          id: "care",
          type: "textarea",
          label: "Definitive, palliative, or stabilization care",
          required: true,
          placeholderHint: "<exact procedure>"
        },
        {
          id: "stabilization-details",
          type: "text",
          label:
            "Drainage, hemostasis, occlusion, splint, dressing, or temporary restoration",
          placeholderHint: "<fact>"
        },
        {
          id: "medication",
          type: "text",
          label: "Prescription and medication",
          standardPhrases: ["See the Medication and Prescription add-on.", "None."]
        },
        {
          id: "escalation",
          type: "textarea",
          label: "Escalation, emergency referral, or return precautions",
          placeholderHint: "<exact criteria>"
        },
        {
          id: "follow-up-plan",
          type: "text",
          label: "Follow-up and definitive-care plan",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
