import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const communicationFollowup: ModuleDef = {
  id: "communication-followup",
  title: "Communication and Follow-Up Add-On",
  order: 230,
  description: "Postoperative call or other clinical communication.",
  sections: [
    {
      id: "main",
      title: "Communication and follow-up",
      fields: [
        {
          id: "type",
          type: "select",
          label: "Communication type",
          required: true,
          options: opts("postoperative call", "telephone", "portal message"),
          allowOther: true
        },
        {
          id: "roles",
          type: "text",
          label: "Initiating and receiving roles",
          required: true,
          placeholderHint: "<roles only>"
        },
        { id: "reason", type: "text", label: "Reason", required: true, placeholderHint: "<fact>" },
        {
          id: "report",
          type: "textarea",
          label: "Patient or caregiver report",
          placeholderHint: "<de-identified facts>"
        },
        {
          id: "observations",
          type: "text",
          label: "Clinician observations available and limits",
          placeholderHint: "<facts>"
        },
        {
          id: "advice",
          type: "textarea",
          label: "Advice, instruction, recommendation, or no new advice",
          placeholderHint: "<clinician-supplied facts>",
          standardPhrases: ["The clinician gave no new advice during this contact."]
        },
        {
          id: "teach-back",
          type: "text",
          label: "Understanding or teach-back",
          placeholderHint: "<fact>"
        },
        {
          id: "escalation",
          type: "text",
          label: "Escalation, urgent or emergency trigger, and action",
          standardPhrases: ["No escalation trigger was reported or identified during this contact."]
        },
        {
          id: "tracking",
          type: "text",
          label: "Follow-up owner, next step, and tracking status",
          required: true,
          placeholderHint: "<role and status>"
        }
      ]
    }
  ]
};
