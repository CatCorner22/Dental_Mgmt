// CONTROLLED PROCEDURE VOCABULARY — the verbs a dental note performs.
//
// Used ONLY by the read-only extractor (src/lib/extract). Nothing here is ever
// substituted into a note; these literals exist so the extractor can recognise
// that a clause describes a procedure and of what coarse class, which is what
// the consistency rules and the odontogram reason over.
//
// THE CATEGORY IS THE POINT, not the name. "Composite", "amalgam" and "onlay"
// are different procedures but they are all things that ADD material to a
// tooth, and the single cleanest contradiction a dental note can contain is a
// tooth that was removed and restored in the same visit. Categories make that
// checkable without enumerating pairs.
//
// AMBIGUOUS SHORTHAND IS ABSENT ON PURPOSE, on the same rule the abbreviation
// table follows: an initialism with more than one real reading in a dental
// chart is not resolved by guessing. The ones deliberately left out, with why:
//
//   CR   composite resin / centric relation
//   GP   gutta-percha / general practitioner
//   FMX  full-mouth series / full-mouth extraction  <- the dangerous one
//   RC   root canal / rubber cup
//   IMP  impression / implant
//   PA   periapical radiograph / posteroanterior
//
// A writer who used one of those gets an ambiguity prompt from the existing
// vocabulary path. What they must never get is a chart drawn from a coin flip.

import type { ProcedureCategory } from "@/lib/extract/facts";

export interface ProcedureTerm {
  id: string;
  /** Lowercased token sequence, matched in order. */
  literal: string[];
  /** Canonical name. Reported in facts; never written into the note. */
  display: string;
  category: ProcedureCategory;
  /**
   * Does this procedure act on specific tooth surfaces?
   *
   * Extractions and root canals take a tooth but never a surface, so a surface
   * string next to one is a signal that the writer meant something else — a
   * discriminator worth having rather than a detail worth ignoring.
   */
  takesSurfaces: boolean;
}

const term = (
  id: string,
  literal: string,
  display: string,
  category: ProcedureCategory,
  takesSurfaces = false
): ProcedureTerm => ({ id, literal: literal.split(" "), display, category, takesSurfaces });

export const PROCEDURE_TERMS: ProcedureTerm[] = [
  // --- Restorative: material added to a tooth. Surfaces apply. ---
  term("proc.composite", "composite", "composite restoration", "restorative", true),
  term("proc.composite.abbr", "comp", "composite restoration", "restorative", true),
  term("proc.resin", "resin", "composite restoration", "restorative", true),
  term("proc.amalgam", "amalgam", "amalgam restoration", "restorative", true),
  term("proc.amalgam.abbr", "amg", "amalgam restoration", "restorative", true),
  term("proc.filling", "filling", "restoration", "restorative", true),
  term("proc.restoration", "restoration", "restoration", "restorative", true),
  term("proc.buildup", "build up", "core build-up", "restorative", true),
  term("proc.buildup.one", "buildup", "core build-up", "restorative", true),
  term("proc.core", "core build up", "core build-up", "restorative", true),
  term("proc.sedative", "sedative filling", "sedative filling", "restorative", true),

  // --- Surgical: tooth or tissue removed. ---
  term("proc.extraction", "extraction", "extraction", "surgical"),
  term("proc.extraction.ext", "ext", "extraction", "surgical"),
  term("proc.extraction.exo", "exo", "extraction", "surgical"),
  term("proc.extraction.extract", "extract", "extraction", "surgical"),
  term("proc.extraction.extracted", "extracted", "extraction", "surgical"),
  term("proc.surgical.ext", "surgical extraction", "surgical extraction", "surgical"),
  term("proc.alveoloplasty", "alveoloplasty", "alveoloplasty", "surgical"),
  term("proc.biopsy", "biopsy", "biopsy", "surgical"),
  term("proc.frenectomy", "frenectomy", "frenectomy", "surgical"),
  term("proc.implant", "implant placement", "implant placement", "surgical"),
  term("proc.incision.drainage", "incision and drainage", "incision and drainage", "surgical"),

  // --- Endodontic. ---
  term("proc.rct", "root canal", "root canal therapy", "endodontic"),
  term("proc.rct.abbr", "rct", "root canal therapy", "endodontic"),
  term("proc.rct.full", "root canal therapy", "root canal therapy", "endodontic"),
  term("proc.pulpotomy", "pulpotomy", "pulpotomy", "endodontic"),
  term("proc.pulpectomy", "pulpectomy", "pulpectomy", "endodontic"),
  term("proc.apicoectomy", "apicoectomy", "apicoectomy", "endodontic"),

  // --- Periodontal. ---
  term("proc.srp", "scaling and root planing", "scaling and root planing", "periodontal"),
  term("proc.srp.abbr", "srp", "scaling and root planing", "periodontal"),
  term("proc.gingivectomy", "gingivectomy", "gingivectomy", "periodontal"),
  term("proc.perio.maint", "periodontal maintenance", "periodontal maintenance", "periodontal"),
  term("proc.perio.maint.abbr", "perio maintenance", "periodontal maintenance", "periodontal"),
  term("proc.osseous", "osseous surgery", "osseous surgery", "periodontal"),
  term("proc.debridement", "debridement", "full-mouth debridement", "periodontal"),

  // --- Preventive. ---
  term("proc.prophy", "prophylaxis", "prophylaxis", "preventive"),
  term("proc.prophy.abbr", "prophy", "prophylaxis", "preventive"),
  term("proc.fluoride", "fluoride varnish", "fluoride varnish", "preventive"),
  term("proc.sealant", "sealant", "sealant", "preventive", true),
  term("proc.ohi", "oral hygiene instruction", "oral hygiene instruction", "preventive"),
  term("proc.ohi.abbr", "ohi", "oral hygiene instruction", "preventive"),

  // --- Prosthodontic. ---
  term("proc.crown", "crown", "crown", "prosthodontic"),
  term("proc.crown.prep", "crown prep", "crown preparation", "prosthodontic"),
  term("proc.onlay", "onlay", "onlay", "prosthodontic", true),
  term("proc.inlay", "inlay", "inlay", "prosthodontic", true),
  term("proc.veneer", "veneer", "veneer", "prosthodontic"),
  term("proc.bridge", "bridge", "fixed partial denture", "prosthodontic"),
  term("proc.denture", "denture", "denture", "prosthodontic"),
  term("proc.partial", "partial denture", "partial denture", "prosthodontic"),
  term("proc.post.core", "post and core", "post and core", "prosthodontic"),

  // --- Operative STEPS, added after measuring coverage against real shorthand.
  //
  // These are not billable procedures; they are the steps a note records to show
  // the procedure was done properly, and they were most of the parser's blind
  // spot. "Flap raised", "socket curetted", "cord packed" are what an insurer or
  // an attorney reads to decide whether the work described actually happened.
  term("proc.flap", "flap raised", "flap reflection", "surgical"),
  term("proc.flap.reflected", "flap reflected", "flap reflection", "surgical"),
  term("proc.bone.removal", "bone removed", "bone removal", "surgical"),
  term("proc.sectioned", "sectioned", "tooth sectioning", "surgical"),
  term("proc.socket.curetted", "socket curetted", "socket curettage", "surgical"),
  term("proc.curetted", "curetted", "curettage", "surgical"),
  term("proc.irrigated", "irrigated", "irrigation", "surgical"),
  term("proc.sutures.placed", "sutures placed", "suture placement", "surgical"),
  term("proc.sutures.removed", "sutures removed", "suture removal", "surgical"),
  term("proc.caries.excavated", "caries excavated", "caries excavation", "restorative"),
  term("proc.excavated", "excavated", "caries excavation", "restorative"),
  term("proc.pulp.amputated", "pulp amputated", "pulp amputation", "endodontic"),
  term("proc.prep.refined", "prep refined", "preparation refinement", "prosthodontic"),
  term("proc.cord.packed", "cord packed", "retraction cord placement", "prosthodontic"),
  term("proc.impression", "impression taken", "impression", "prosthodontic"),
  term("proc.cemented", "cemented", "cementation", "prosthodontic"),
  term("proc.isolated", "isolated", "isolation", "restorative"),
  term("proc.etched", "etched", "acid etch", "restorative"),
  term("proc.bonded", "bonded", "bonding", "restorative"),
  term("proc.smoothed", "smoothed", "selective smoothing", "restorative"),
  term("proc.calculus.removed", "calculus removed", "calculus removal", "periodontal"),
  term("proc.polished", "polished", "coronal polishing", "preventive"),

  // --- Diagnostic. ---
  term("proc.fms", "fms", "full-mouth radiographic series", "diagnostic"),
  term("proc.exam.comp", "comprehensive exam", "comprehensive oral evaluation", "diagnostic"),
  term("proc.exam.periodic", "periodic exam", "periodic oral evaluation", "diagnostic"),
  term("proc.exam.limited", "limited exam", "limited oral evaluation", "diagnostic"),
  term("proc.bitewing", "bitewing", "bitewing radiograph", "diagnostic"),
  term("proc.bitewing.abbr", "bw", "bitewing radiograph", "diagnostic"),
  term("proc.periapical", "periapical", "periapical radiograph", "diagnostic"),
  term("proc.panoramic", "panoramic", "panoramic radiograph", "diagnostic"),
  term("proc.panoramic.abbr", "pano", "panoramic radiograph", "diagnostic"),
  term("proc.cbct", "cbct", "cone beam computed tomography", "diagnostic")
];

// Longest literal first, so "root canal therapy" wins over "root canal" and
// "surgical extraction" over "extraction".
export const PROCEDURE_TERMS_BY_LENGTH: ProcedureTerm[] = [...PROCEDURE_TERMS].sort(
  (a, b) => b.literal.length - a.literal.length
);
