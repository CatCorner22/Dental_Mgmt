import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Oral appliance therapy for sleep-disordered breathing.
//
// A whole service line that previously had two words of coverage — "sleep" as
// one option in an Oral Medicine select. That is not enough to record a therapy
// whose defensibility rests on facts a dentist does NOT generate: the diagnosis
// and the sleep study belong to a physician, and the dentist treats on referral.
//
// So the first section is about somebody else's findings, and every field in it
// asks who said so. A note that reads as though the dental practice diagnosed
// sleep apnoea is a note describing an act outside the practice of dentistry.
export const sleepApnea: ModuleDef = {
  id: "sleep-apnea",
  title: "Sleep Apnea and Oral Appliance Add-On",
  order: 205,
  description:
    "Oral appliance therapy for sleep-disordered breathing, snoring, and obstructive sleep apnea: mandibular advancement and tongue-retaining devices, titration, and positive-airway-pressure intolerance. The diagnosis and the sleep study belong to the physician; this records the dental therapy delivered on that referral.",
  sections: [
    {
      id: "referral",
      title: "Referral and medical diagnosis",
      fields: [
        {
          id: "referral-source",
          type: "text",
          label: "Referring physician and specialty",
          required: true,
          placeholderHint: "<role and specialty, no name>",
          helpText:
            "A dentist treats sleep-disordered breathing on a physician's diagnosis. Record the referral, not a dental diagnosis."
        },
        {
          id: "diagnosis-source",
          type: "select",
          label: "Whose diagnosis is recorded here",
          required: true,
          options: opts(
            "physician diagnosis on file",
            "physician diagnosis reported by the patient, not yet on file",
            "no diagnosis on file — referred back for evaluation"
          ),
          helpText: "This tool never converts a dental observation into a medical diagnosis."
        },
        {
          id: "study-type",
          type: "select",
          label: "Sleep study type",
          options: opts(
            "in-laboratory polysomnography",
            "home sleep apnea test",
            "reported by the patient, type unknown",
            "not available"
          ),
          allowOther: true
        },
        {
          id: "severity-reported",
          type: "text",
          label: "Severity as reported in the study",
          placeholderHint: "<AHI or RDI as written in the physician's report>",
          helpText:
            "Copy the figure from the report. Do not compute, estimate, or convert one index into another.",
          standardPhrases: ["Not available in the record reviewed."]
        },
        {
          id: "epworth",
          type: "text",
          label: "Epworth Sleepiness Scale, if recorded",
          placeholderHint: "<score as recorded>",
          standardPhrases: ["Not recorded."]
        },
        {
          id: "prior-therapy",
          type: "text",
          label: "Prior therapy and why it was changed",
          placeholderHint: "<fact>",
          standardPhrases: [
            "The patient reports intolerance of positive airway pressure.",
            "No prior therapy reported."
          ]
        }
      ]
    },
    {
      id: "appliance",
      title: "Appliance and fit",
      fields: [
        {
          id: "appliance-type",
          type: "select",
          label: "Appliance type",
          required: true,
          options: opts(
            "mandibular advancement device",
            "tongue-retaining device",
            "combination appliance",
            "repair or replacement of an existing appliance"
          ),
          allowOther: true
        },
        {
          id: "appliance-make",
          type: "text",
          label: "Make and model",
          placeholderHint: "<make and model>"
        },
        {
          id: "records",
          type: "text",
          label: "Records taken",
          placeholderHint: "<fact>",
          standardPhrases: [
            "Digital scans of both arches and a protrusive bite record were taken.",
            "Impressions of both arches and a protrusive bite record were taken."
          ]
        },
        {
          id: "protrusive",
          type: "text",
          label: "Protrusive bite record and starting position",
          placeholderHint: "<as measured>",
          helpText:
            "Record what was measured. This tool never suggests a starting position or an advancement amount."
        },
        {
          id: "fit",
          type: "textarea",
          label: "Fit, retention, and comfort at delivery",
          placeholderHint: "<observed facts>"
        }
      ]
    },
    {
      id: "titration-followup",
      title: "Titration, side effects, and follow-up",
      fields: [
        {
          id: "titration",
          type: "textarea",
          label: "Titration instructions given and adjustments made",
          placeholderHint: "<instructions and adjustments as given>",
          helpText: "State what was instructed and what was adjusted, with the amount as measured."
        },
        {
          id: "morning-occlusion",
          type: "text",
          label: "Morning occlusion check",
          required: true,
          placeholderHint: "<observed>",
          standardPhrases: [
            "The patient was instructed in the morning repositioning exercise and returned to their usual occlusion.",
            "Not assessed at this visit."
          ],
          helpText:
            "Occlusal change is the commonest complication of this therapy, so it is asked at every visit."
        },
        {
          id: "side-effects",
          type: "textarea",
          label: "Side effects reported or observed",
          placeholderHint: "<facts>",
          standardPhrases: [
            "None reported.",
            "The patient reports transient jaw soreness on waking, resolving within an hour."
          ],
          helpText: "Temporomandibular symptoms, tooth movement, salivation, dry mouth."
        },
        {
          id: "efficacy-followup",
          type: "text",
          label: "Efficacy follow-up arranged with the physician",
          required: true,
          placeholderHint: "<arrangement>",
          standardPhrases: [
            "The patient was advised that a follow-up sleep study is arranged by the referring physician.",
            "Referred back to the physician for efficacy testing."
          ],
          helpText:
            "Whether the appliance is working is a medical determination. The dental record states that testing was arranged, never that the condition is controlled."
        },
        {
          id: "next-review",
          type: "text",
          label: "Next dental review",
          placeholderHint: "<interval and purpose>"
        }
      ]
    }
  ]
};
