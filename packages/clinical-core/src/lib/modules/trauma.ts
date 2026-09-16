import type { ModuleDef } from "@/lib/schema/types";
import { opts, optionalTeeth } from "./shared";

export const trauma: ModuleDef = {
  id: "trauma",
  title: "Dentoalveolar Trauma Add-On",
  order: 150,
  description: "Traumatic dental and alveolar injuries.",
  sections: [
    {
      id: "main",
      title: "Dentoalveolar trauma",
      fields: [
        {
          id: "event",
          type: "text",
          label: "Event mechanism, relative timing, witness role, and prior care",
          required: true,
          placeholderHint: "<de-identified facts>"
        },
        {
          id: "red-flags",
          type: "textarea",
          label:
            "Loss of consciousness, altered mental status, headache, nausea, vomiting, neck pain, airway symptoms, nasal or ear bleeding, and other injury",
          placeholderHint: "<assessed findings or limits>",
          standardPhrases: ["The patient reports no loss of consciousness. ", "Not assessed: "]
        },
        {
          id: "fragment",
          type: "text",
          label: "Missing tooth or fragment location, transport medium, and dry time",
          placeholderHint: "<facts when triggered>",
          standardPhrases: ["Not applicable."]
        },
        {
          id: "extraoral-findings",
          type: "textarea",
          label:
            "Facial bones, cranial nerves, temporomandibular joints, wounds, foreign body, and soft-tissue sites",
          placeholderHint: "<findings>"
        },
        {
          id: "occlusion",
          type: "text",
          label: "Preinjury and current occlusion; midline, interference, overbite, and overjet",
          placeholderHint: "<facts when relevant>"
        },
        optionalTeeth(
          "teeth",
          "Injured teeth",
          "Pick the teeth involved; record each one's findings in the field below."
        ),
        {
          id: "per-tooth",
          type: "textarea",
          label:
            "Per-tooth infraction, fracture, pulp exposure, mobility, displacement direction and extent, percussion, color, probing, sensibility, caries, and restorations",
          placeholderHint: "<facts>",
          helpText: "Record each injured tooth separately."
        },
        {
          id: "image-findings",
          type: "text",
          label:
            "Root development, root fracture, periodontal-ligament, alveolar, periapical, and foreign-body image findings",
          placeholderHint: "<clinician interpretation>",
          standardPhrases: ["See the Imaging add-on."]
        },
        {
          id: "accounted",
          type: "select",
          label: "All teeth, fragments, and appliance parts located",
          required: true,
          options: opts("yes", "no — action recorded", "unknown — action recorded")
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied injury diagnosis",
          required: true,
          placeholderHint: "<term>"
        },
        {
          id: "treatment",
          type: "textarea",
          label:
            "Repositioning, replantation, splint type, teeth included, material, duration plan, sutures, and wound care",
          placeholderHint: "<fact>"
        },
        {
          id: "referral-status",
          type: "text",
          label: "Photograph status, safeguarding concern, and medical or tetanus referral status",
          placeholderHint: "<fact>"
        },
        {
          id: "follow-up",
          type: "textarea",
          label:
            "Prognosis, instructions, diet, hygiene, medication, warning signs, referral, scheduled follow-up, and sensibility-monitoring plan",
          placeholderHint: "<fact>"
        }
      ]
    }
  ]
};
