import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const pediatric: ModuleDef = {
  id: "pediatric",
  title: "Pediatric and Behavior Add-On",
  order: 180,
  description: "Pediatric or special-needs care and behavior guidance.",
  sections: [
    {
      id: "main",
      title: "Pediatric and behavior",
      fields: [
        {
          id: "needs",
          type: "text",
          label: "Developmental and communication needs",
          placeholderHint: "<fact>"
        },
        {
          id: "caregiver",
          type: "text",
          label:
            "Accompanying-adult role, caregiver presence, parent or guardian report, and legal authority",
          required: true,
          placeholderHint: "<identity and authority stay in the EDR>",
          helpText: "Roles only. Identity and legal authority stay in the EDR."
        },
        {
          id: "interpreter",
          type: "text",
          label: "Interpreter, translation, and communication aid",
          standardPhrases: ["Not applicable."]
        },
        {
          id: "preop-compliance",
          type: "select",
          label: "Preoperative instruction compliance and supplemental-document link",
          options: opts("linked in the EDR", "not applicable", "unresolved")
        },
        {
          id: "behavior-guidance",
          type: "select",
          label: "Behavior guidance",
          options: opts("tell-show-do", "distraction", "positive reinforcement"),
          allowOther: true,
          helpText: "Name the exact method."
        },
        {
          id: "patient-response",
          type: "text",
          label: "Patient response",
          placeholderHint: "<objective behavior>"
        },
        {
          id: "stabilization",
          type: "textarea",
          label: "Protective stabilization or restraint",
          placeholderHint:
            "<method, reason, alternatives tried, duration, monitoring, written consent, parent access status>",
          standardPhrases: ["Not used."],
          helpText:
            "Tennessee Rule 0460-01-.18 sets consent, method, duration, documentation, and parent-access requirements. Obtain current guidance and legal review before any use."
        },
        {
          id: "procedure",
          type: "select",
          label: "Pediatric procedure",
          options: opts(
            "sealant",
            "silver diamine fluoride",
            "stainless steel crown",
            "pulpotomy",
            "pulpectomy",
            "space maintainer",
            "trauma care"
          ),
          allowOther: true
        },
        optionalTeeth(
          "teeth",
          "Teeth treated",
          "Primary and permanent designations are both available. Record surfaces and steps below."
        ),
        {
          id: "details",
          type: "textarea",
          label: "Surface, isolation, material, medicament, appliance, and steps",
          placeholderHint: "<facts>"
        },
        {
          id: "instructions",
          type: "text",
          label: "Parent or guardian instructions and teach-back",
          placeholderHint: "<fact>"
        },
        {
          id: "outcome",
          type: "text",
          label: "Complication, planned next treatment, and follow-up",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
