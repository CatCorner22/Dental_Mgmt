import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Dental anxiety and comfort.
//
// The practice asks about anxiety at intake, and until now the answer had
// nowhere to live except a sentence in the subjective narrative — where the
// next clinician does not look, so the patient gets asked again from scratch
// and the measures that worked last time are re-invented or forgotten.
//
// The rating is a THREE-POINT SELECT, deliberately. The intake question the
// practice already asks is a low/moderate/high one, and a select records the
// patient's own answer. A 0-10 score would invite the tool to convert one scale
// into another, which it must never do, and would imply a precision that a
// single self-report question does not have.
//
// Nothing in this module infers a management plan from the rating. A high
// rating does not suggest sedation; the clinician decides, and sedation has its
// own module with its own required fields.
export const anxietyComfort: ModuleDef = {
  id: "anxiety-comfort",
  title: "Anxiety and Comfort Add-On",
  order: 185,
  description:
    "Dental anxiety, fear, and comfort: what the patient reported, what the team did about it, what worked, and what to repeat next time. Also covers gagging, needle and drill concerns, and accessibility needs.",
  sections: [
    {
      id: "reported",
      title: "What the patient reported",
      fields: [
        {
          id: "anxiety-level",
          type: "select",
          label: "Anxiety level the patient reported",
          required: true,
          options: [
            { value: "low anxiety, reported by the patient", label: "Low anxiety" },
            { value: "moderate anxiety, reported by the patient", label: "Moderate anxiety" },
            { value: "high anxiety, reported by the patient", label: "High anxiety" },
            {
              value: "the patient declined to rate it",
              label: "The patient declined to rate it"
            },
            { value: "not asked at this encounter", label: "Not asked at this encounter" }
          ],
          helpText:
            "The patient's own answer to the question the practice asks, not the clinician's impression of how the patient seemed."
        },
        {
          id: "concerns",
          type: "multiselect",
          label: "What the patient said concerns them",
          options: opts(
            "needles or injections",
            "the drill sound or vibration",
            "gagging",
            "pain during treatment",
            "numbness after treatment",
            "loss of control in the chair",
            "a previous dental experience",
            "sounds or smells in the office",
            "lying back or the chair position",
            "how long the appointment will take"
          ),
          helpText:
            "Patient-reported. Record what they said, not what you inferred. Anything not on the list goes in the next field, in their own words."
        },
        {
          id: "in-their-words",
          type: "textarea",
          label: "In the patient's own words",
          rows: 2,
          placeholderHint: "<de-identified patient-reported words>",
          standardPhrases: ["The patient reports "]
        },
        {
          id: "accessibility-needs",
          type: "textarea",
          label: "Communication and accessibility needs",
          rows: 2,
          placeholderHint: "<need and how the team met it>",
          helpText:
            "Interpreter, hearing or vision support, wheelchair transfer, sensory sensitivity, a support person present. Describe the need and the accommodation, never a diagnosis the patient did not give you.",
          standardPhrases: ["None reported.", "The patient asked for "]
        }
      ]
    },
    {
      id: "measures",
      title: "What the team did",
      fields: [
        {
          id: "comfort-measures",
          type: "multiselect",
          label: "Comfort measures used",
          options: opts(
            "explained each step before doing it",
            "agreed a stop signal with the patient",
            "took breaks on request",
            "topical anesthetic before injection",
            "slow injection technique",
            "shorter appointment by agreement",
            "first appointment of the day by agreement",
            "headphones or music",
            "sunglasses or an eye cover",
            "blanket or neck support",
            "a support person in the room",
            "distraction during treatment",
            "topical for the gag reflex",
            "upright or semi-upright chair position"
          ),
          helpText:
            "The high-value field. This is the list the next clinician reads before the patient sits down. Anything not on the list goes in \"what helped\" below."
        },
        {
          id: "sedation-link",
          type: "text",
          label: "Sedation or nitrous oxide",
          standardPhrases: [
            "None used at this encounter.",
            "See the Nitrous Oxide add-on.",
            "See the Sedation and Anesthesia add-on."
          ],
          helpText:
            "Record the drug detail in its own add-on, where the required safety fields live. This tool never suggests sedation and never calculates a dose."
        },
        {
          id: "what-helped",
          type: "textarea",
          label: "What helped, and what to repeat next time",
          rows: 2,
          required: true,
          placeholderHint: "<what worked, in words the next clinician can act on>",
          helpText:
            "The one field that carries forward. Write it for the person who has this patient next, not for the chart."
        },
        {
          id: "what-did-not-help",
          type: "text",
          label: "What did not help, or what to avoid",
          standardPhrases: ["Nothing identified at this encounter."]
        }
      ]
    },
    {
      id: "outcome",
      title: "How the encounter went",
      fields: [
        {
          id: "encounter-outcome",
          type: "select",
          label: "Outcome",
          required: true,
          options: opts(
            "the planned care was completed",
            "the planned care was completed with extra time or breaks",
            "part of the planned care was completed; the rest was rescheduled by agreement",
            "the care was stopped at the patient's request",
            "the care was stopped by the clinician",
            "the patient declined to start"
          ),
          helpText: "Use the exact state. Do not collapse states."
        },
        {
          id: "plan-next-time",
          type: "textarea",
          label: "Plan for the next appointment",
          rows: 2,
          placeholderHint: "<what the team will do differently>",
          standardPhrases: [
            "The clinician and the patient agreed a plan for the next appointment.",
            "The patient asked to discuss options before the next appointment."
          ]
        }
      ]
    }
  ]
};
