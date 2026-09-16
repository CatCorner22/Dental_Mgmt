import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const endodontic: ModuleDef = {
  id: "endodontic",
  title: "Endodontic Add-On",
  order: 80,
  description: "Root-canal or pulp procedures.",
  sections: [
    {
      id: "main",
      title: "Endodontics",
      fields: [
        {
          id: "teeth",
          type: "toothPicker",
          label: "Tooth",
          required: true,
          dentitions: ["permanent", "primary"],
          multiple: false
        },
        {
          id: "pulpal-diagnosis",
          type: "text",
          label: "Clinician-supplied pulpal diagnosis",
          required: true,
          placeholderHint: "<term>"
        },
        {
          id: "apical-diagnosis",
          type: "text",
          label: "Clinician-supplied apical diagnosis",
          required: true,
          placeholderHint: "<term>"
        },
        {
          id: "tests",
          type: "textarea",
          label:
            "Symptoms, sensibility, percussion, palpation, bite, probing, mobility, and controls",
          placeholderHint: "<results>"
        },
        {
          id: "preop-image",
          type: "text",
          label: "Preoperative image and restorability",
          placeholderHint: "<fact>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "case-risk",
          type: "text",
          label: "Case risk and disposition",
          placeholderHint:
            "<patient, diagnostic, tooth, anatomy, prior-treatment, isolation, vital-structure proximity, capability, and referral facts when assessed>"
        },
        {
          id: "stage",
          type: "select",
          label: "Treatment stage",
          required: true,
          options: opts(
            "pulp therapy",
            "root-canal initiation",
            "working length",
            "cleaning and shaping",
            "obturation",
            "retreatment",
            "surgery",
            "emergency"
          )
        },
        {
          id: "anesthesia-isolation",
          type: "text",
          label: "Anesthesia and isolation",
          placeholderHint: "<fact; dental dam status>",
          helpText: "State the dental dam status."
        },
        {
          id: "canals",
          type: "text",
          label: "Access and canals located or treated",
          placeholderHint: "<named canals>"
        },
        {
          id: "working-length",
          type: "text",
          label: "Working-length method and length for each canal",
          placeholderHint: "<value/unit>"
        },
        {
          id: "instrumentation",
          type: "text",
          label: "Instrumentation and apical preparation",
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "irrigants",
          type: "text",
          label: "Irrigants",
          placeholderHint: "<name, concentration, amount, delivery, activation>"
        },
        {
          id: "medicament",
          type: "text",
          label: "Intracanal medicament",
          placeholderHint: "<name and placement>",
          standardPhrases: ["None placed."]
        },
        {
          id: "obturation",
          type: "text",
          label: "Obturation",
          placeholderHint: "<material, sealer, technique, length, density>"
        },
        {
          id: "coronal-seal",
          type: "text",
          label: "Temporary or definitive coronal seal",
          placeholderHint: "<material>"
        },
        {
          id: "procedural-events",
          type: "text",
          label:
            "Procedural error, separation, ledge, transportation, perforation, extrusion, or other complication",
          standardPhrases: [
            "No procedural complication was observed during the stated procedure."
          ]
        },
        {
          id: "outcome",
          type: "textarea",
          label:
            "Postoperative image, occlusion, restoration plan, prognosis, instructions, and referral",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
