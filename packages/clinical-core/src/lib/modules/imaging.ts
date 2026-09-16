import type { ModuleDef } from "@/lib/schema/types";
import { opts } from "./shared";

// Modalities from the imaging catalog in skill/references/sedation-and-imaging.md.
const MODALITIES = opts(
  "periapical radiograph",
  "horizontal bitewing radiograph",
  "vertical bitewing radiograph",
  "occlusal radiograph",
  "full-mouth intraoral radiographic series",
  "panoramic radiograph",
  "lateral cephalometric radiograph",
  "posteroanterior cephalometric radiograph",
  "submentovertex projection",
  "transcranial projection",
  "transpharyngeal projection",
  "conventional tomography",
  "cone-beam computed tomography",
  "multidetector or medical computed tomography (outside source)",
  "nuclear medicine, PET, SPECT, or fused study (outside source)",
  "intraoral visible-light photograph",
  "extraoral visible-light photograph",
  "fluorescence, transillumination, or other optical caries image",
  "intraoral optical scan",
  "digitized study model",
  "three-dimensional facial surface scan",
  "magnetic resonance imaging (outside source)",
  "ultrasonography (outside source)"
);

export const imaging: ModuleDef = {
  id: "imaging",
  title: "Imaging Add-On",
  order: 30,
  description: "Any image acquired, received, or interpreted. One entry per study.",
  sections: [
    {
      id: "main",
      title: "Imaging",
      fields: [
        {
          id: "study-status",
          type: "select",
          label: "Study status",
          required: true,
          options: opts("ordered", "acquired", "received", "reviewed", "interpreted", "referred")
        },
        {
          id: "modality",
          type: "select",
          label: "Modality and exact view",
          required: true,
          options: MODALITIES,
          allowOther: true,
          helpText: "Use other for a new or uncommon study rather than forcing a wrong label."
        },
        { id: "count", type: "text", label: "Count or series", placeholderHint: "<value>" },
        {
          id: "reason",
          type: "text",
          label: "Patient-specific reason and selection facts",
          required: true,
          placeholderHint: "<value>",
          helpText: "Do not order an image merely because a preset interval elapsed."
        },
        {
          id: "prior-images",
          type: "text",
          label: "Prior images reviewed or unavailable",
          placeholderHint: "<fact>"
        },
        {
          id: "anatomy",
          type: "text",
          label: "Anatomy, side, arch, teeth, and field of view",
          placeholderHint: "<value>"
        },
        {
          id: "acquisition",
          type: "text",
          label: "Acquisition source and protocol metadata",
          placeholderHint: "<value>"
        },
        {
          id: "quality",
          type: "text",
          label: "Quality, artifacts, and diagnostic limits",
          placeholderHint: "<value>"
        },
        {
          id: "comparison",
          type: "text",
          label: "Comparison",
          placeholderHint: "<de-identified reference>",
          standardPhrases: ["No prior study was available for comparison."]
        },
        {
          id: "findings",
          type: "textarea",
          label: "Findings by structure",
          placeholderHint: "<clinician-supplied interpretation>"
        },
        {
          id: "fov-status",
          type: "select",
          label: "Structure or field-of-view status",
          options: opts(
            "assessed — finding recorded",
            "assessed — no abnormality observed",
            "not in field",
            "not assessable — reason recorded"
          )
        },
        {
          id: "impression",
          type: "text",
          label: "Impression",
          placeholderHint: "<clinician-supplied interpretation>"
        },
        {
          id: "incidental",
          type: "text",
          label: "Incidental finding and action",
          standardPhrases: ["None observed in the reviewed field."]
        },
        {
          id: "communication",
          type: "text",
          label: "Result communication and follow-up",
          placeholderHint: "<value>"
        },
        {
          id: "cbct-volume",
          type: "select",
          label: "CBCT entire volume reviewed or referred",
          options: opts("yes", "no", "not applicable"),
          requiredIf: { fieldId: "modality", equals: "cone-beam computed tomography" },
          helpText:
            "The ordering clinician interprets the entire acquired volume or refers to an oral and maxillofacial radiologist."
        },
        {
          id: "cbct-interpreter",
          type: "text",
          label: "Qualified interpreter or radiology referral",
          visibleIf: { fieldId: "modality", equals: "cone-beam computed tomography" },
          placeholderHint: "<role only>"
        }
      ]
    }
  ]
};
