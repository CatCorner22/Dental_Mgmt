import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const teledentistry: ModuleDef = {
  id: "teledentistry",
  title: "Teledentistry Add-On",
  order: 220,
  description:
    "Remote encounters. Tennessee Rule 0460-01-.19 requires secure video or store-and-forward technology; audio-only, email alone, and fax alone do not qualify.",
  sections: [
    {
      id: "main",
      title: "Teledentistry",
      fields: [
        {
          id: "technology",
          type: "select",
          label: "Technology",
          required: true,
          options: opts("secure video conferencing", "store-and-forward")
        },
        {
          id: "jurisdiction",
          type: "text",
          label: "Dentist location and patient jurisdiction",
          required: true,
          placeholderHint: "<state only in this draft>",
          helpText: "State only. Exact locations stay in the EDR."
        },
        {
          id: "identity-consent",
          type: "select",
          label: "Identity and consent verification",
          required: true,
          options: opts("recorded in the EDR", "unresolved")
        },
        {
          id: "participants",
          type: "text",
          label: "Participants and roles",
          required: true,
          placeholderHint: "<roles only>"
        },
        {
          id: "records-available",
          type: "text",
          label: "Records available",
          placeholderHint: "<fact>"
        },
        {
          id: "data-quality",
          type: "select",
          label: "Data and image quality",
          required: true,
          options: opts("diagnostic quality met the stated purpose", "limited — reason recorded"),
          helpText:
            "If the transmitted information is inadequate, record that an opinion cannot be formed and obtain more data, direct examination, or referral."
        },
        {
          id: "findings",
          type: "textarea",
          label: "History, remote examination limits, findings, and opinion",
          placeholderHint: "<facts>"
        },
        {
          id: "in-person-needed",
          type: "text",
          label: "In-person examination or additional data needed",
          placeholderHint: "<fact>",
          standardPhrases: ["None identified during this encounter."]
        },
        {
          id: "follow-up",
          type: "textarea",
          label: "Referral, escalation, prescription, instructions, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
