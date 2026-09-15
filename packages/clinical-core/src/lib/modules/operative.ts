import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const operative: ModuleDef = {
  id: "operative",
  title: "Operative Add-On",
  order: 110,
  description:
    "Surgical operations. Pair with the named procedure add-on (extraction, biopsy, graft, trauma).",
  sections: [
    {
      id: "main",
      title: "Operation",
      fields: [
        {
          id: "operation",
          type: "text",
          label: "Exact operation",
          required: true,
          placeholderHint: "<name>"
        },
        {
          id: "team-roles",
          type: "text",
          label: "Surgeon, assistants, anesthesia roles",
          placeholderHint: "<roles only in this draft>",
          helpText: "Roles only. Names and credentials stay in the EDR."
        },
        {
          id: "preop-diagnosis",
          type: "text",
          label: "Preoperative diagnosis and indication",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "postop-diagnosis",
          type: "text",
          label: "Postoperative diagnosis",
          placeholderHint: "<clinician-supplied term>"
        },
        optionalTeeth(
          "teeth",
          "Teeth involved (if tooth-specific)",
          "Leave blank for soft-tissue or region-only procedures; describe those in the field below."
        ),
        {
          id: "site-status",
          type: "text",
          label: "Site, side, arch, lesion, and procedure status",
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
          id: "preparation",
          type: "text",
          label: "Preparation, antisepsis, draping, and isolation",
          placeholderHint: "<fact>"
        },
        {
          id: "technique",
          type: "textarea",
          label:
            "Incision, flap, exposure, dissection, bone removal, sectioning, debridement, irrigation, and technique",
          placeholderHint: "<only performed steps>"
        },
        { id: "findings", type: "textarea", label: "Findings", placeholderHint: "<fact>" },
        {
          id: "specimen",
          type: "text",
          label: "Specimen, culture, pathology request, orientation, and chain status",
          standardPhrases: ["Recorded in the EDR.", "No specimen was collected."]
        },
        {
          id: "devices",
          type: "text",
          label: "Device, graft, implant, material, manufacturer, and lot",
          standardPhrases: ["Recorded in the EDR.", "None used."]
        },
        {
          id: "closure",
          type: "text",
          label: "Drain, fixation, closure, suture, dressing, and pack",
          placeholderHint: "<fact>"
        },
        {
          id: "blood-loss",
          type: "measurement",
          label: "Estimated blood loss",
          units: ["mL"],
          min: 0,
          max: 5000,
          helpText: "State the estimation method in Findings when recorded."
        },
        {
          id: "counts",
          type: "text",
          label: "Counts when applicable",
          standardPhrases: ["Not applicable.", "Counts reconciled: "]
        },
        {
          id: "complication",
          type: "text",
          label: "Complication and management",
          standardPhrases: [
            "No complication was observed during the stated procedure and observation period."
          ]
        },
        {
          id: "hemostasis",
          type: "text",
          label: "Hemostasis",
          required: true,
          placeholderHint: "<method and observed status>",
          helpText: "State the method and the observed bleeding status."
        },
        {
          id: "transfer",
          type: "textarea",
          label:
            "Condition at transfer, instructions, prescription, referral, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
