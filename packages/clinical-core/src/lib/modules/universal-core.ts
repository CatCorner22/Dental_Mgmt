import type { ModuleDef } from "@/lib/schema/types";
import {
  ALLERGY_STATUS,
  CARE_STATUS,
  CONFIRM_ASKED,
  CONTACT_METHOD,
  ITEM_OPEN,
  EDR_ONLY_STATUS,
  EVIDENCE_PHRASES,
  MEDICATION_STATUS,
  NEGATIVE_STATUS_HISTORY,
  NKA,
  NKDA,
  NONE_REPORTED,
  NO_HISTORY_CHANGES,
  NO_MEDICATIONS,
  OPEN_ITEM_DUE,
  OPEN_ITEM_OWNER,
  OPEN_ITEM_STATUS,
  OPEN_ITEM_TRACKING,
  PATIENT_DECISION,
  PATIENT_SUMMARY_DELIVERY,
  PREMEDICATION_STATUS,
  PREMED_NOT_REQUIRED,
  URGENCY,
  YES_NO,
  opts
} from "./shared";

export const universalCore: ModuleDef = {
  id: "universal-core",
  title: "Universal Core",
  order: 0,
  alwaysOn: true,
  description: "Every encounter uses this module. Add-on modules extend it.",
  sections: [
    // NARRATIVE — the merge of the two note surfaces, expressed as data.
    //
    // Smile Notes used to have two places to write: this structured form, and a
    // separate page that was one big textarea. Prose could be checked there but
    // never filed, and the form could be filed but had nowhere to put a
    // paragraph. Anyone who thinks in sentences had to pick, before writing a
    // word, which half of the product they were using.
    //
    // These five fields are that second surface, inside the note. Text written
    // or pasted here is saved, versioned, audited by every text rule, composed
    // into the filed note and copied to the EDR like anything else — so a whole
    // note can still be written as prose.
    //
    // NOT REQUIRED, and that is deliberate. `runRequiredRule` only tests whether
    // a value is empty, so a required narrative field would be satisfied by any
    // paragraph at all — a gate that opens for prose is not a gate. The
    // structured fields keep the requirements; this section keeps the sentences.
    //
    // The section sits FIRST because it is where the writing starts.
    //
    // It holds only Safety, Subjective and Objective. The narrative halves of
    // Assessment and Plan live as a field inside the EXISTING Assessment and
    // Plan sections, not here — those two sections are dentist-owned, and a
    // narrative field outside them would have been a way for an auxiliary to
    // write a diagnosis that the scope guard never sees. Putting the prose in
    // the section that already owns the judgement means the lock, the audit
    // tailoring and the filing check all apply to it without any of them
    // learning a new rule. Between them the five narrative fields are the same
    // partition structureIntoSoap() produces, so pasted prose has a home for
    // every piece.
    {
      id: "narrative",
      title: "Visit narrative",
      fields: [
        {
          id: "narrative-safety",
          type: "textarea",
          label: "Safety and history in your own words",
          helpText:
            "Allergies, medications, premedication, vitals — anything that changes whether care is safe today. The structured fields below still record the status this note files on.",
          placeholderHint: "<what changes whether treatment is safe today>"
        },
        {
          id: "narrative-subjective",
          type: "textarea",
          label: "What the patient reports",
          helpText: "The patient's own de-identified words, and why they are here.",
          placeholderHint: "<what the patient reports>"
        },
        {
          id: "narrative-objective",
          type: "textarea",
          label: "What you observed and did",
          helpText: "Findings, measurements, and the care delivered this visit.",
          placeholderHint: "<what was observed and performed>"
        }
      ]
    },
    {
      id: "visit",
      title: "Visit",
      fields: [
        {
          id: "encounter-type",
          type: "select",
          label: "Encounter type",
          required: true,
          options: [
            ...opts(
              "comprehensive examination",
              "periodic examination",
              "limited examination",
              "consultation",
              "recall visit",
              "treatment visit",
              "emergency visit",
              "postoperative visit",
              "teledentistry encounter"
            ),
            {
              value: "telephone contact",
              label: "Telephone contact (not teledentistry)"
            },
            {
              value: "written or portal message",
              label: "Written or portal message (not teledentistry)"
            }
          ],
          allowOther: true,
          helpText:
            "Tennessee Rule 0460-01-.19 counts an encounter as teledentistry only when secure video or store-and-forward technology carried it; audio-only, email alone, and fax alone do not qualify. A phone call is a telephone contact. A cost-only conversation is a consultation — money never enters this record."
        },
        {
          id: "patient-status",
          type: "select",
          label: "Patient status",
          // NOT plainly required, on the ALWAYS_REQUIRED principle: a new
          // required field blocks every draft already saved. The supervision
          // rule requires it contextually — hygiene-service notes, once
          // Public Chapter 1107 is in force — which is the only place the
          // answer changes anything.
          options: opts("Established patient", "New patient — first visit to this practice"),
          helpText:
            "One click, and it matters more from January 1, 2027: Public Chapter 1107 requires direct supervision by a dentist who has seen a new patient before a hygienist takes diagnostic radiographs, collects hard- or soft-tissue data, performs prophylaxis, or applies fluoride."
        },
        {
          id: "supervision",
          type: "select",
          label: "Supervision",
          // Contextually required by the supervision rule; see patient-status.
          options: opts(
            "Not applicable — the dentist personally provided this care",
            "Direct — the dentist was on the premises",
            "General — the dentist authorized in advance"
          ),
          helpText:
            "Who stood behind this visit. Direct means the dentist was physically present in the office during the service; general means prior authorization without presence."
        },
        {
          id: "contact-method",
          type: "select",
          label: "Contact method",
          options: CONTACT_METHOD,
          helpText: "How the practice and the patient reached each other at this encounter."
        },
        {
          id: "urgency",
          type: "select",
          label: "Urgency",
          options: URGENCY,
          helpText: "The clinician's own judgement. This tool never infers urgency."
        },
        {
          id: "visit-purpose",
          type: "text",
          label: "Visit purpose",
          required: true,
          placeholderHint: "<patient-reported words, de-identified>",
          helpText: "Use the patient's de-identified words."
        },
        {
          id: "interval-events",
          type: "text",
          label: "Interval events",
          standardPhrases: [NONE_REPORTED, "The patient reports ", "The external record states "]
        },
        {
          id: "source-limits",
          type: "text",
          label: "Source and reliability limits",
          standardPhrases: ["Not applicable.", "The history source is limited because "]
        }
      ]
    },
    {
      id: "history-review",
      title: "Medical and dental review",
      fields: [
        {
          id: "history-reviewed",
          type: "select",
          label: "History reviewed in the clinical system",
          required: true,
          options: YES_NO
        },
        {
          id: "history-changes-status",
          type: "select",
          label: "Medical history changes",
          required: true,
          options: NEGATIVE_STATUS_HISTORY,
          helpText:
            '"No changes" is a statement about the patient, not an empty box. Say it only if you asked.'
        },
        {
          id: "history-changes-confirm",
          type: "select",
          label: "Double-check: no history changes",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "history-changes-status", equals: NO_HISTORY_CHANGES },
          requiredIf: { fieldId: "history-changes-status", equals: NO_HISTORY_CHANGES },
          helpText: "Carried forward without asking is a different fact. Say which this is."
        },
        {
          id: "history-changes",
          type: "text",
          label: "Changes reported",
          visibleIf: { fieldId: "history-changes-status", notEquals: NO_HISTORY_CHANGES },
          standardPhrases: [NONE_REPORTED, "The patient reports "]
        },
        {
          id: "allergies-status",
          type: "select",
          label: "Allergy status",
          required: true,
          options: ALLERGY_STATUS,
          helpText:
            "NKA and NKDA are different statements. NKDA covers drugs only — a latex or food allergy can still exist. Pick the one you actually verified."
        },
        {
          id: "allergies-confirm",
          type: "select",
          label: "Double-check: no known allergies",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "allergies-status", in: [NKA, NKDA] },
          requiredIf: { fieldId: "allergies-status", in: [NKA, NKDA] },
          helpText:
            "A negative allergy statement is an affirmative clinical claim, and it is the one a later reader relies on before prescribing. It gets its own confirmation."
        },
        {
          id: "medications-status",
          type: "select",
          label: "Current medications",
          required: true,
          options: MEDICATION_STATUS,
          helpText: "The medication list itself stays in the EDR."
        },
        {
          id: "medications-confirm",
          type: "select",
          label: "Double-check: no current medications",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "medications-status", equals: NO_MEDICATIONS },
          requiredIf: { fieldId: "medications-status", equals: NO_MEDICATIONS },
          helpText:
            "\"None\" is the answer most often carried forward unasked, and the one that hides an interaction."
        },
        {
          id: "premedication-status",
          type: "select",
          label: "Antibiotic premedication",
          required: true,
          options: PREMEDICATION_STATUS,
          helpText:
            "Required-and-not-taken is a reason to stop and ask the dentist, not a note to write afterwards."
        },
        {
          id: "premedication-confirm",
          type: "select",
          label: "Double-check: premedication not required",
          options: CONFIRM_ASKED,
          visibleIf: { fieldId: "premedication-status", equals: PREMED_NOT_REQUIRED },
          requiredIf: { fieldId: "premedication-status", equals: PREMED_NOT_REQUIRED },
          helpText:
            "Prophylaxis turns on cardiac and joint history. If that history was not reviewed at this visit, say so rather than implying it was."
        },
        {
          id: "relevant-conditions",
          type: "textarea",
          label:
            "Relevant conditions, surgeries, pregnancy, substance use, and prior anesthesia events",
          placeholderHint: "<de-identified clinical facts>",
          standardPhrases: EVIDENCE_PHRASES
        },
        {
          id: "dental-history",
          type: "textarea",
          label: "Relevant dental history and risk factors",
          placeholderHint: "<facts>"
        },
        {
          id: "clearance-status",
          type: "text",
          label: "Consultation or clearance status",
          standardPhrases: ["Not applicable.", "Unresolved."]
        }
      ]
    },
    {
      id: "subjective",
      title: "Subjective",
      fields: [
        { id: "site", type: "text", label: "Site", placeholderHint: "<region/tooth/surface>" },
        { id: "symptom", type: "text", label: "Symptom", placeholderHint: "<value>" },
        {
          id: "onset-course",
          type: "text",
          label: "Onset and course",
          placeholderHint: "<relative duration, not an identifying date>"
        },
        {
          id: "severity",
          type: "text",
          label: "Severity and scale",
          placeholderHint: "<value>",
          standardPhrases: ["The patient rates the pain <0-10> of 10.", "The patient reports no pain."]
        },
        { id: "quality", type: "text", label: "Quality", placeholderHint: "<value>" },
        {
          id: "triggers-relief",
          type: "text",
          label: "Triggers and relief",
          placeholderHint: "<value>"
        },
        {
          id: "associated-symptoms",
          type: "text",
          label: "Associated symptoms",
          standardPhrases: [NONE_REPORTED]
        },
        {
          id: "pertinent-negatives",
          type: "text",
          label: "Pertinent negatives reported",
          standardPhrases: ["The patient reports no "]
        },
        { id: "patient-goal", type: "text", label: "Patient goal", placeholderHint: "<value>" },
        {
          id: "comfort-concern",
          type: "select",
          label: "Anxiety or comfort concern",
          options: [
            { value: "None reported.", label: "None reported" },
            {
              value:
                "The patient reported an anxiety or comfort concern; see the Anxiety and Comfort add-on.",
              label: "Reported — add the Anxiety and Comfort add-on"
            },
            { value: "Not asked at this encounter.", label: "Not asked at this encounter" }
          ],
          helpText:
            "The add-on records what the patient said concerns them, what the team did about it, and what to repeat next time. It is the field the next clinician reads before the patient sits down."
        }
      ]
    },
    {
      id: "objective",
      title: "Objective",
      fields: [
        {
          id: "general-observation",
          type: "text",
          label: "General observation",
          placeholderHint: "<specific finding>"
        },
        {
          id: "extraoral",
          type: "textarea",
          label: "Extraoral examination",
          placeholderHint: "<specific structures and findings>",
          standardPhrases: ["Not assessed.", "The clinician observed "]
        },
        {
          id: "intraoral-soft-tissue",
          type: "textarea",
          label: "Intraoral soft-tissue examination",
          placeholderHint: "<specific structures and findings>",
          standardPhrases: ["Not assessed.", "The clinician observed "]
        },
        {
          id: "dentition-hard-tissue",
          type: "textarea",
          label: "Dentition and hard-tissue examination",
          placeholderHint: "<tooth/site/surface and finding>"
        },
        {
          id: "periodontal-screening",
          type: "text",
          label: "Periodontal screening or examination",
          placeholderHint: "<method and findings>"
        },
        {
          id: "occlusion-function",
          type: "text",
          label: "Occlusion and function",
          placeholderHint: "<finding>"
        },
        {
          id: "tests",
          type: "textarea",
          label: "Tests",
          placeholderHint: "<name, site, method, result, control, limitation>",
          standardPhrases: ["Not assessed."]
        },
        {
          id: "images",
          type: "text",
          label: "Images",
          standardPhrases: ["See the Imaging add-on.", "No image was acquired at this encounter."],
          helpText: "Add the Imaging add-on for any image acquired, received, or interpreted."
        },
        {
          id: "exam-limits",
          type: "text",
          label: "Examination limits",
          standardPhrases: ["Not applicable."]
        }
      ]
    },
    {
      id: "assessment",
      title: "Assessment",
      fields: [
        // The narrative half of Assessment. It lives inside this section rather
        // than with the other narrative fields precisely because this section
        // is dentist-owned: the scope lock, the audit tailoring and the filing
        // check already cover everything in here, and prose is exactly the shape
        // in which a diagnosis could otherwise have slipped past all three.
        //
        // Not required — the structured diagnosis field below still is. A
        // required prose field is satisfied by any paragraph at all, which is
        // not a gate.
        {
          id: "narrative-assessment",
          type: "textarea",
          label: "Assessment in your own words",
          helpText:
            "The clinician's judgement as a sentence. The structured fields below are what the note files on.",
          placeholderHint: "<the clinician's assessment>"
        },
        {
          id: "diagnosis",
          type: "text",
          label: "Clinician-supplied diagnosis",
          required: true,
          placeholderHint: "<exact term>",
          helpText: "The clinician supplies the diagnosis. This tool never suggests one."
        },
        {
          id: "diagnosis-status",
          type: "select",
          label: "Diagnosis status",
          required: true,
          options: opts("final", "working", "differential")
        },
        {
          id: "site-extent",
          type: "text",
          label: "Tooth, site, surface, extent, stage, grade, or severity",
          placeholderHint: "<when applicable>"
        },
        {
          id: "supporting-evidence",
          type: "text",
          label: "Supporting evidence",
          placeholderHint: "<fact>"
        },
        {
          id: "unresolved-evidence",
          type: "text",
          label: "Unresolved evidence or differential",
          standardPhrases: [NONE_REPORTED, "Unresolved: "]
        },
        {
          id: "prognosis",
          type: "text",
          label: "Prognosis and basis",
          placeholderHint: "<clinician-supplied fact>"
        },
        {
          id: "diagnostic-code",
          type: "text",
          label: "Current licensed diagnostic terminology or code",
          standardPhrases: ["Completed in the EDR from the licensed code set."],
          helpText: "Do not type licensed codes from memory. Verify locally."
        }
      ]
    },
    {
      id: "plan",
      title: "Plan and decision",
      fields: [
        // The narrative half of Plan, inside the dentist-owned section for the
        // same reason the assessment narrative is inside Assessment.
        {
          id: "narrative-plan",
          type: "textarea",
          label: "Plan in your own words",
          helpText:
            "What was recommended, decided and scheduled, as sentences. The structured fields below are what the note files on.",
          placeholderHint: "<what was recommended and decided>"
        },
        {
          id: "recommended-care",
          type: "textarea",
          label: "Recommended care and purpose",
          required: true,
          placeholderHint: "<fact>"
        },
        { id: "expected-benefit", type: "text", label: "Expected benefit", placeholderHint: "<fact>" },
        { id: "material-risks", type: "text", label: "Material risks", placeholderHint: "<fact>" },
        { id: "alternatives", type: "text", label: "Alternatives", placeholderHint: "<fact>" },
        {
          id: "no-treatment-option",
          type: "text",
          label: "No-treatment option and likely consequence",
          placeholderHint: "<fact>"
        },
        {
          id: "questions-discussed",
          type: "text",
          label: "Questions discussed",
          // The practice's own standard line (section 3.1), as a chip the
          // clinician chooses. It is never inserted for them: the tool would be
          // asserting that an explanation happened, which is the one thing a
          // note must not manufacture.
          standardPhrases: [
            "The clinician answered the patient's stated questions.",
            "The clinician explained the diagnosis and the treatment options in plain language."
          ]
        },
        {
          id: "patient-decision",
          type: "select",
          label: "Patient decision",
          required: true,
          options: PATIENT_DECISION
        },
        {
          id: "consent-form-status",
          type: "select",
          label: "Consent or refusal form status",
          options: EDR_ONLY_STATUS,
          helpText: "Complete the form itself only in the EDR."
        },
        { id: "planned-sequence", type: "text", label: "Planned sequence", placeholderHint: "<fact>" }
      ]
    },
    {
      id: "care-delivered",
      title: "Care delivered",
      fields: [
        {
          id: "procedure-status",
          type: "select",
          label: "Procedure status",
          required: true,
          options: CARE_STATUS,
          helpText: "Use the exact state. Do not collapse states."
        },
        {
          id: "complication-status",
          type: "text",
          label: "Complication status",
          required: true,
          standardPhrases: [
            "No complication was observed during the stated procedure and observation period.",
            "Complication: "
          ]
        },
        {
          id: "patient-response",
          type: "text",
          label: "Patient response",
          placeholderHint: "<objective observation and patient report>"
        }
      ]
    },
    {
      id: "handoff",
      title: "Handoff",
      fields: [
        {
          id: "condition-at-end",
          type: "text",
          label: "Condition at end of visit",
          placeholderHint: "<specific findings>"
        },
        {
          id: "instructions",
          type: "textarea",
          label: "Instructions",
          placeholderHint: "<topic and delivery method>",
          standardPhrases: [
            "The clinician gave verbal and written postoperative instructions and confirmed teach-back."
          ]
        },
        {
          id: "return-precautions",
          type: "textarea",
          label: "Return precautions",
          placeholderHint: "<exact trigger and action>",
          standardPhrases: [
            "Call the office if swelling spreads, breathing or swallowing becomes hard, bleeding does not stop with pressure for 30 minutes, or fever develops. Seek emergency care if breathing is blocked."
          ]
        },
        {
          id: "medication-link",
          type: "text",
          label: "Medication or prescription",
          standardPhrases: ["See the Medication and Prescription add-on.", "None."]
        },
        {
          id: "follow-up",
          type: "text",
          label: "Follow-up interval and purpose",
          placeholderHint: "<value>",
          // Section 3.4's line, with the "[date/time]" placeholder removed. An
          // exact appointment date beside clinical detail is an identifier and
          // the privacy rule stops it, so the interval is what belongs here and
          // the appointment itself lives in the schedule.
          standardPhrases: [
            "The next visit is scheduled before the patient leaves. ",
            "The next visit is scheduled in ",
            "The patient prefers to be contacted by "
          ]
        },
        {
          id: "referral",
          type: "text",
          label: "Referral or communication",
          placeholderHint: "<role, reason, urgency, status>",
          standardPhrases: ["None."]
        },
        {
          id: "signature-status",
          type: "select",
          label: "Author, reviewer, attestation, and signature",
          options: opts("to be completed in the EDR only"),
          helpText: "Names, credentials, and signatures never enter this tool."
        }
      ]
    },
    {
      id: "patient-facing",
      title: "Written for the patient",
      // A section boundary is a voice boundary. Everything above is written for
      // the next clinician and for a lawyer; this block is written for the
      // person who was in the chair, and the audit treats it differently
      // because of where it sits. composeNote omits an empty section entirely,
      // so a note that skips this costs nothing.
      fields: [
        {
          id: "patient-summary",
          type: "textarea",
          label: "Summary for the patient",
          audience: "patient",
          rows: 4,
          placeholderHint: "<what we found, what we did, what happens next — in plain words>",
          // Openers first, then the procedures in the words a patient uses.
          // Friendly names only — no code numbers. The ADA code set is licensed
          // and a number means nothing to the person reading this anyway.
          standardPhrases: [
            "Here is what we found at this visit: ",
            "Here is what we did at this visit: ",
            "Here is what happens next: ",
            "Call the office if ",
            "We cleaned your teeth. ",
            "We filled a cavity in ",
            "We took the tooth out. ",
            "We started a root canal. ",
            "We fitted a crown — a cap that covers the tooth. ",
            "We took x-rays to see inside the tooth and the bone. ",
            "We checked your gums. ",
            "Nothing needed treatment at this visit. "
          ],
          helpText:
            "Patients read their own notes by law. Write this the way you said it out loud. The tool checks this box against a plain-word list instead of the clinical one. Standardize still works here if you want it — it rewrites toward clinical wording, which is usually the wrong direction for this box, and Undo puts your words back."
        },
        {
          id: "patient-summary-delivery",
          type: "select",
          label: "How the patient received this summary",
          options: PATIENT_SUMMARY_DELIVERY,
          requiredIf: { fieldId: "patient-summary", notEmpty: true },
          helpText: "Written and not given to anyone is a draft, not a handoff."
        }
      ]
    },
    {
      id: "open-items",
      title: "Open items",
      fields: [
        {
          id: "open-item",
          type: "select",
          label: "Is anything still open after this encounter?",
          options: OPEN_ITEM_STATUS,
          helpText:
            "The item most often dropped is the one everybody assumed somebody else had. Naming the role and the interval is what turns an intention into a handoff."
        },
        {
          id: "open-item-what",
          type: "textarea",
          label: "What is open",
          rows: 2,
          visibleIf: { fieldId: "open-item", equals: ITEM_OPEN },
          requiredIf: { fieldId: "open-item", equals: ITEM_OPEN },
          placeholderHint: "<the action, in plain words>",
          helpText: "Describe the action. Roles only — no staff or patient names."
        },
        {
          id: "open-item-owner",
          type: "select",
          label: "Who owns it",
          options: OPEN_ITEM_OWNER,
          visibleIf: { fieldId: "open-item", equals: ITEM_OPEN },
          requiredIf: { fieldId: "open-item", equals: ITEM_OPEN },
          helpText: "A role, never a person. The role is what a later reader can act on."
        },
        {
          id: "open-item-due",
          type: "select",
          label: "By when",
          options: OPEN_ITEM_DUE,
          visibleIf: { fieldId: "open-item", equals: ITEM_OPEN },
          requiredIf: { fieldId: "open-item", equals: ITEM_OPEN },
          helpText: "A relative interval. Exact dates belong in the EDR, not here."
        },
        {
          id: "open-item-tracking",
          type: "select",
          label: "Where it is tracked",
          options: OPEN_ITEM_TRACKING,
          visibleIf: { fieldId: "open-item", equals: ITEM_OPEN },
          requiredIf: { fieldId: "open-item", equals: ITEM_OPEN },
          helpText:
            "\"Not yet tracked anywhere\" is a real answer and a useful one. Say it rather than naming a system that does not hold the item."
        }
      ]
    }
  ]
};
