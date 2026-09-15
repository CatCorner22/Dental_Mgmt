import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const refusalIncomplete: ModuleDef = {
  id: "refusal-incomplete",
  title: "Refusal and Incomplete Care Add-On",
  order: 250,
  description: "Refused, deferred, stopped, or incomplete care.",
  sections: [
    {
      id: "main",
      title: "Refusal and incomplete care",
      fields: [
        {
          id: "recommended-care",
          type: "text",
          label: "Recommended care and clinical reason",
          required: true,
          placeholderHint: "<facts>"
        },
        {
          id: "benefit-risk",
          type: "text",
          label: "Expected benefit and material risk",
          required: true,
          placeholderHint: "<facts>"
        },
        {
          id: "alternatives",
          type: "text",
          label: "Alternatives and no-care option",
          required: true,
          placeholderHint: "<facts>"
        },
        {
          id: "questions",
          type: "text",
          label: "Questions and clinician responses",
          placeholderHint: "<facts>",
          standardPhrases: ["The clinician answered the patient's stated questions."]
        },
        {
          id: "decision",
          type: "select",
          label: "Exact decision",
          required: true,
          options: opts("declined", "deferred", "stopped", "partly completed")
        },
        {
          id: "care-performed",
          type: "textarea",
          label: "Care actually performed and care not performed",
          required: true,
          placeholderHint: "<facts>"
        },
        {
          id: "condition",
          type: "text",
          label: "Current condition",
          required: true,
          placeholderHint: "<facts>"
        },
        {
          id: "consequences",
          type: "textarea",
          label: "Consequences, instructions, follow-up, referral, and return precautions",
          required: true,
          placeholderHint: "<facts>"
        }
      ]
    }
  ]
};
