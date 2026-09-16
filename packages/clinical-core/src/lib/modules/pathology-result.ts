import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const pathologyResult: ModuleDef = {
  id: "pathology-result",
  title: "Pathology Result Add-On",
  order: 240,
  description: "Pathology or laboratory result review.",
  sections: [
    {
      id: "main",
      title: "Pathology result",
      fields: [
        {
          id: "specimen-link",
          type: "select",
          label: "Specimen and procedure link",
          required: true,
          options: opts("linked in the EDR", "unresolved")
        },
        {
          id: "source-status",
          type: "text",
          label: "Result source and status",
          required: true,
          placeholderHint: "<laboratory role; preliminary/final/amended>"
        },
        {
          id: "review",
          type: "select",
          label: "Clinician review",
          required: true,
          options: opts("reviewed by the clinician", "pending clinician review")
        },
        {
          id: "summary",
          type: "textarea",
          label: "Clinician-supplied result summary and diagnosis effect",
          required: true,
          placeholderHint: "<de-identified facts>"
        },
        {
          id: "communication",
          type: "text",
          label: "Communication to patient, caregiver, referrer, or other clinician",
          placeholderHint: "<roles and status only>"
        },
        {
          id: "plan",
          type: "text",
          label: "Plan, referral, surveillance, or additional procedure",
          placeholderHint: "<fact>"
        },
        {
          id: "tracking",
          type: "text",
          label: "Tracking owner and closure status",
          required: true,
          placeholderHint: "<role and status>"
        }
      ]
    }
  ]
};
