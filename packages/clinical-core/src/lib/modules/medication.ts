import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const medication: ModuleDef = {
  id: "medication",
  title: "Medication and Prescription Add-On",
  order: 210,
  description:
    "One entry per drug action. This tool records only clinician-supplied facts. It never selects a drug, calculates a dose, or converts units.",
  sections: [
    {
      id: "main",
      title: "Medication and prescription",
      fields: [
        {
          id: "action",
          type: "select",
          label: "Action",
          required: true,
          options: opts(
            "administered",
            "prescribed",
            "dispensed",
            "recommended",
            "discontinued",
            "reconciled"
          )
        },
        {
          id: "drug",
          type: "text",
          label: "Generic drug and formulation",
          required: true,
          placeholderHint: "<fact>",
          helpText: "Use the exact generic name the clinician supplied."
        },
        {
          id: "dose-facts",
          type: "text",
          label: "Concentration, amount, dose, unit, route, and actual time",
          required: true,
          placeholderHint: "<fact>",
          standardPhrases: ["Recorded in the time-oriented record and the EDR."],
          helpText:
            "Copy verified facts only. Do not convert between cartridges, milliliters, milligrams, or micrograms."
        },
        { id: "indication", type: "text", label: "Indication", required: true, placeholderHint: "<fact>" },
        {
          id: "risk-review",
          type: "text",
          label:
            "Allergy, interaction, contraindication, pregnancy, renal, hepatic, bleeding, and substance-risk review",
          placeholderHint: "<clinician verification>"
        },
        {
          id: "prescription-details",
          type: "text",
          label: "Quantity, directions, duration, refills, monitoring, and disposal instruction",
          placeholderHint: "<verified prescription>",
          visibleIf: { fieldId: "action", in: ["prescribed", "dispensed"] }
        },
        {
          id: "controlled-substance",
          type: "select",
          label: "Controlled-substance database or statutory workflow",
          options: opts(
            "completed as required by current law",
            "not a controlled substance",
            "unresolved"
          )
        },
        {
          id: "counseling",
          type: "text",
          label: "Counseling and teach-back",
          placeholderHint: "<fact>"
        },
        {
          id: "adverse-event",
          type: "text",
          label: "Adverse event and response",
          standardPhrases: ["None observed or reported during the stated period."]
        }
      ]
    }
  ]
};
