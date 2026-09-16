import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const universalProcedure: ModuleDef = {
  id: "universal-procedure",
  title: "Universal Procedure Add-On",
  order: 270,
  description: "Any procedure without a dedicated module. Name the exact procedure.",
  sections: [
    {
      id: "main",
      title: "Procedure",
      fields: [
        {
          id: "name",
          type: "text",
          label: "Exact procedure name",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "domain-status",
          type: "text",
          label: "Procedure domain and status",
          required: true,
          placeholderHint: "<value>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Diagnosis and indication",
          required: true,
          placeholderHint: "<clinician-supplied fact>"
        },
        {
          id: "site",
          type: "text",
          label: "Site, side, arch, tooth, surface, and structure",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "consent-pause",
          type: "select",
          label: "Consent and procedural pause",
          required: true,
          options: opts(
            "consent discussion recorded and procedural pause performed",
            "recorded in the EDR",
            "unresolved"
          )
        },
        {
          id: "technique",
          type: "textarea",
          label:
            "Anesthesia, isolation, preparation, technique, instruments, materials, devices, settings, and measurements",
          placeholderHint: "<only supplied facts>"
        },
        {
          id: "findings",
          type: "text",
          label: "Findings and endpoint",
          placeholderHint: "<specific facts>"
        },
        {
          id: "complication",
          type: "text",
          label: "Complication, intervention, and response",
          standardPhrases: [
            "No complication was observed during the stated procedure and observation period."
          ]
        },
        {
          id: "handoff",
          type: "textarea",
          label: "Condition at end, instructions, return precautions, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
