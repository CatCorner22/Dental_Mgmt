import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Robotic-assisted implant surgery (Yomi / Neocis-class haptic guidance and
// dynamic-navigation systems).
//
// The legal shape of this record, and the reason every field below exists: in
// a passive-guidance model THE SURGEON operates and the robot constrains. A
// note that reads as "the robot placed the implant" is wrong twice — it
// misstates the device's FDA-cleared role, and it hands a plaintiff's
// attorney the theory that the practice delegated surgery to a machine. So
// the record must show: what was planned, that the system was registered and
// calibrated, what was actually achieved, every deviation and every human
// override, and that the surgeon remained in control throughout.
//
// Planned-vs-actual is the heart of it. A deviation is not a defect — brains
// override plans for live anatomy all the time — but an UNDOCUMENTED
// deviation reads as either carelessness or concealment, and a records
// reviewer cannot tell which.
export const roboticSurgery: ModuleDef = {
  id: "robotic-surgery",
  title: "Robotic-Assisted Surgery Add-On",
  order: 105,
  description:
    "Robotic and dynamic-navigation guided implant surgery: Yomi, robot, haptic guidance, navigation, registration, planned versus actual, deviation, override. Use with the Implant add-on — this records the guidance system's part of the visit.",
  sections: [
    {
      id: "planning",
      title: "Digital plan",
      fields: [
        {
          id: "system",
          type: "text",
          label: "Guidance system and software version",
          required: true,
          placeholderHint: "<system name and version>",
          helpText: "Name the system as the practice licenses it (e.g. the robotic guidance platform and its software release)."
        },
        {
          id: "guidance-mode",
          type: "select",
          label: "Guidance mode",
          required: true,
          options: opts("haptic passive guidance", "dynamic navigation display only"),
          helpText:
            "Passive haptic guidance constrains the handpiece; dynamic navigation only displays position. The record must say which, because the surgeon's control claim below depends on it."
        },
        {
          id: "plan-source",
          type: "select",
          label: "CBCT-based digital plan on file",
          required: true,
          options: opts("linked in the EDR", "unresolved"),
          helpText: "The plan itself (imaging, prosthetic design) stays in the EDR; this note references it."
        },
        {
          id: "planned-positions",
          type: "textarea",
          label: "Planned implant positions, angulations, and depths",
          required: true,
          placeholderHint: "<verified values per site, as planned>",
          helpText: "Per site. These are the numbers the actual placement is judged against."
        }
      ]
    },
    {
      id: "intraoperative",
      title: "Registration and execution",
      fields: [
        {
          id: "registration",
          type: "select",
          label: "Patient registration and system calibration verified before osteotomy",
          required: true,
          options: opts("verified and accepted by the surgeon", "unresolved"),
          helpText:
            "An unregistered or stale registration invalidates every guided value that follows. If tracking was lost and re-registered mid-case, say so in the deviations field."
        },
        {
          id: "actual-positions",
          type: "textarea",
          label: "Actual positions, angulations, and depths achieved",
          required: true,
          placeholderHint: "<verified values per site, as achieved>"
        },
        {
          id: "deviations",
          type: "textarea",
          label: "Deviations from the plan and surgeon overrides, with the clinical reason",
          required: true,
          standardPhrases: [
            "Placement followed the digital plan within the system's stated tolerance; no surgeon override occurred."
          ],
          helpText:
            "A documented deviation with its reason is a clinical decision. An undocumented one is a records problem. Include any mid-case re-registration or tracking loss here."
        },
        {
          id: "haptic-events",
          type: "text",
          label: "Haptic boundary events or guidance interruptions",
          standardPhrases: ["None during the recorded period."],
          placeholderHint: "<what the system signalled and what the surgeon did>"
        },
        {
          id: "surgeon-control",
          type: "select",
          label:
            "The surgeon remained in physical control of the instrumentation throughout; the system provided guidance only",
          required: true,
          options: opts("confirmed", "unresolved"),
          helpText:
            "This is the passive-guidance model in one sentence, and the sentence a board reviewer looks for. If it was not true at any moment, resolve that in the deviations field before filing."
        }
      ]
    },
    {
      id: "verification",
      title: "Verification and outcome",
      fields: [
        {
          id: "verification-method",
          type: "multiselect",
          label: "Final position verification method",
          required: true,
          options: opts(
            "post-placement radiograph",
            "post-placement CBCT",
            "guidance-system placement report",
            "direct clinical verification"
          ),
          joiner: ", "
        },
        {
          id: "outcome",
          type: "textarea",
          label: "Outcome, complications, and neurosensory status",
          required: true,
          standardPhrases: [
            "No complication was observed during the recorded period; neurosensory status intact at discharge assessment."
          ]
        }
      ]
    }
  ]
};
