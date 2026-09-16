import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const preventive: ModuleDef = {
  id: "preventive",
  title: "Preventive Add-On",
  order: 40,
  description: "Prophylaxis, fluoride, sealant, caries-arrest material, hygiene instruction.",
  sections: [
    {
      id: "main",
      title: "Preventive care",
      fields: [
        {
          id: "procedure",
          type: "select",
          label: "Procedure",
          required: true,
          options: opts(
            "prophylaxis",
            "periodontal maintenance",
            "fluoride application",
            "sealant",
            "caries-arrest material",
            "oral-hygiene instruction"
          ),
          allowOther: true
        },
        {
          id: "indication",
          type: "text",
          label: "Indication and risk drivers",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "teeth",
          type: "toothPicker",
          label: "Teeth",
          dentitions: ["permanent", "primary", "supernumerary-permanent", "supernumerary-primary"],
          multiple: true
        },
        {
          id: "surfaces",
          type: "surfacePicker",
          label: "Surfaces",
          linkedToothFieldId: "teeth"
        },
        {
          id: "deposits",
          type: "text",
          label: "Plaque, calculus, stain, gingival inflammation, bleeding, and deposits",
          placeholderHint: "<site and extent>"
        },
        {
          id: "method",
          type: "text",
          label: "Method and instruments",
          placeholderHint: "<fact>"
        },
        {
          id: "product",
          type: "text",
          label: "Product or material, concentration, amount, manufacturer, and lot",
          standardPhrases: ["Recorded in the EDR."],
          helpText: "Complete manufacturer and lot in the EDR when required."
        },
        {
          id: "isolation",
          type: "text",
          label: "Isolation and moisture control",
          placeholderHint: "<fact>"
        },
        {
          id: "steps",
          type: "textarea",
          label: "Application or treatment steps",
          placeholderHint: "<clinician-supplied facts>"
        },
        {
          id: "sdf-consent",
          type: "text",
          label: "SDF or other caries-arrest consent, expected discoloration, and site",
          visibleIf: { fieldId: "procedure", equals: "caries-arrest material" },
          placeholderHint: "<when applicable>"
        },
        {
          id: "teaching",
          type: "text",
          label: "Oral-hygiene teaching and teach-back",
          placeholderHint: "<fact>"
        },
        {
          id: "response",
          type: "text",
          label: "Response, adverse event, reassessment, and interval basis",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
