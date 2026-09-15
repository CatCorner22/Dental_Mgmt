import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const nitrous: ModuleDef = {
  id: "nitrous",
  title: "Nitrous Oxide Add-On",
  order: 160,
  description:
    "Nitrous oxide and oxygen inhalation only. Use the Sedation and Anesthesia add-on for any other technique.",
  sections: [
    {
      id: "main",
      title: "Nitrous oxide and oxygen",
      fields: [
        { id: "indication", type: "text", label: "Indication", required: true, placeholderHint: "<fact>" },
        {
          id: "preprocedure",
          type: "text",
          label: "Preprocedure review and baseline",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "roles",
          type: "text",
          label: "Administrator and monitor roles",
          required: true,
          placeholderHint: "<roles only>",
          helpText:
            "Tennessee: a dentist, or a certified hygienist under direct supervision, administers. The dentist stays on the premises."
        },
        {
          id: "times",
          type: "select",
          label: "Start and stop times",
          options: opts("recorded in the EDR"),
          helpText: "Exact times stay in the EDR."
        },
        {
          id: "concentrations",
          type: "text",
          label: "Nitrous oxide and oxygen concentrations over time",
          required: true,
          standardPhrases: ["Recorded in the time-oriented record in the EDR."],
          helpText: "The delivery equipment must provide at least 30 percent oxygen."
        },
        {
          id: "observation",
          type: "text",
          label: "Continuous direct observation",
          required: true,
          standardPhrases: [
            "An authorized team member observed the patient continuously and directly during administration."
          ]
        },
        {
          id: "response",
          type: "text",
          label: "Patient responsiveness, ventilation, oxygenation, and adverse change",
          placeholderHint: "<fact>"
        },
        {
          id: "recovery",
          type: "text",
          label: "Oxygen recovery period and endpoint",
          required: true,
          placeholderHint: "<fact>"
        },
        {
          id: "discharge",
          type: "text",
          label: "Discharge condition and instructions",
          required: true,
          placeholderHint: "<specific facts>"
        }
      ]
    }
  ]
};
