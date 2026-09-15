import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

export const examination: ModuleDef = {
  id: "examination",
  title: "Examination Add-On",
  order: 10,
  description: "Comprehensive, periodic, limited, consultation, or recall evaluations.",
  sections: [
    {
      id: "main",
      title: "Examination",
      fields: [
        {
          id: "exam-type",
          type: "select",
          label: "Examination type",
          required: true,
          options: opts("comprehensive", "periodic", "limited", "consultation", "postoperative")
        },
        {
          id: "caries-risk",
          type: "text",
          label: "Caries-risk assessment",
          placeholderHint: "<method, clinician-supplied level, drivers>"
        },
        {
          id: "perio-classification",
          type: "text",
          label: "Periodontal classification",
          placeholderHint: "<clinician-supplied diagnosis, extent, stage, grade>"
        },
        {
          id: "cancer-screening",
          type: "textarea",
          label: "Oral cancer and mucosal screening",
          placeholderHint: "<structures, findings, limits>",
          standardPhrases: ["Not assessed."]
        },
        {
          id: "domain-findings",
          type: "textarea",
          label:
            "Occlusal, orthodontic, prosthetic, endodontic, implant, TMD, airway, and esthetic findings",
          placeholderHint: "<only assessed domains>"
        },
        {
          id: "charting-status",
          type: "select",
          label: "Existing conditions and treatment charted",
          options: opts("yes", "no", "limited")
        },
        {
          id: "diagnostic-records",
          type: "text",
          label: "Diagnostic records selected",
          placeholderHint: "<facts>"
        },
        {
          id: "problem-list",
          type: "textarea",
          label: "Problem list and priorities",
          placeholderHint: "<facts>"
        },
        {
          id: "recall-basis",
          type: "text",
          label: "Recall or reassessment basis",
          placeholderHint: "<risk and condition, not routine>",
          helpText: "State the risk or condition. Do not write routine."
        }
      ]
    }
  ]
};
