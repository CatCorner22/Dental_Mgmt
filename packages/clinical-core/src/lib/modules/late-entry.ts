import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const lateEntry: ModuleDef = {
  id: "late-entry",
  title: "Late Entry, Correction, or Addendum Add-On",
  order: 260,
  description:
    "Complete this only in the EDR. Never alter, hide, or overwrite the signed original. This draft only standardizes the wording you will enter there.",
  sections: [
    {
      id: "main",
      title: "Late entry, correction, or addendum",
      fields: [
        {
          id: "entry-type",
          type: "select",
          label: "Entry type",
          required: true,
          options: opts("late entry", "correction", "addendum")
        },
        {
          id: "original-reference",
          type: "select",
          label: "Original entry reference",
          required: true,
          options: opts("identified in the EDR only")
        },
        { id: "reason", type: "text", label: "Reason", required: true, placeholderHint: "<fact>" },
        {
          id: "new-fact",
          type: "textarea",
          label: "New or corrected fact and source",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "original-visible",
          type: "select",
          label: "Original remains visible",
          required: true,
          options: opts("yes — EDR control preserves the original")
        },
        {
          id: "attestation",
          type: "select",
          label: "Current author, date, time, attestation, and signature",
          required: true,
          options: opts("to be completed in the EDR only")
        }
      ]
    }
  ]
};
