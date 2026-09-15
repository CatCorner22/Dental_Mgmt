// TENNESSEE LICENSE SCOPE — can / cannot by professional level.
//
// Summaries for staff training. Every claim cites TCA or Tenn. Comp. R. & Regs.
// NOT LEGAL ADVICE — verify current Code and Rule 0460 PDFs before relying.
// Full duty lists live in 0460-03-.09 and 0460-04-.08; charts group them.

export type LicenseLevel =
  | "dentist"
  | "dental-hygienist"
  | "registered-dental-assistant"
  | "practical-dental-assistant";

export interface ScopeItem {
  /** Short plain-language act. */
  text: string;
  /** Formal citation(s). */
  citations: string[];
}

export interface LicenseScope {
  id: LicenseLevel;
  title: string;
  shortLabel: string;
  /** Who may practice this level. */
  licenseBasis: string;
  /** Default supervision posture. */
  supervision: string;
  may: ScopeItem[];
  mayNot: ScopeItem[];
  /** Optional certifications that expand scope when held. */
  withCertification: ScopeItem[];
}

export const LICENSE_SCOPES: readonly LicenseScope[] = [
  {
    id: "dentist",
    title: "Licensed dentist (D.D.S. / D.M.D.)",
    shortLabel: "Dentist",
    licenseBasis: "Tenn. Code Ann. Title 63, Chapter 5; Tenn. Comp. R. & Regs. 0460-02",
    supervision:
      "Independent licensed practice within education, training, and experience. Delegates only under the Dentist’s direct supervision and full responsibility where the Act and rules require it (Tenn. Code Ann. § 63-5-108(d)).",
    may: [
      {
        text: "Evaluate, diagnose, prevent, and treat oral / maxillofacial disease and conditions (the practice of dentistry).",
        citations: ["Tenn. Code Ann. § 63-5-108(a)–(b)"]
      },
      {
        text: "Diagnosis, treatment planning, oral surgery, cutting hard/soft tissue (except hygiene curettage/root planing as assigned to hygienists), permanent restorations (except as Board certifies auxiliaries), and interpreting dental radiographs.",
        citations: ["Tenn. Code Ann. § 63-5-108(b)", "Tenn. Code Ann. § 63-5-108(d)"]
      },
      {
        text: "Administer anesthetic (other than topical in connection with a dental operation) and sedation under Board permit rules; authorize teledentistry with required protocols.",
        citations: ["Tenn. Code Ann. § 63-5-108(b)", "Tenn. Comp. R. & Regs. 0460-02-.07"]
      },
      {
        text: "Assign lawful tasks to hygienists and assistants, remaining fully responsible.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-03-.09", "Tenn. Comp. R. & Regs. 0460-04-.08"]
      }
    ],
    mayNot: [
      {
        text: "Practice dentistry without a current Tennessee license (or outside Board rules / ethics / applicable law).",
        citations: ["Tenn. Code Ann. Title 63, Chapter 5", "Tenn. Comp. R. & Regs. 0460-02"]
      },
      {
        text: "Allow more than three hygienists under general supervision at one time (volunteer free-clinic exception: up to ten under direct supervision).",
        citations: ["Tenn. Code Ann. § 63-5-108(f)"]
      },
      {
        text: "Use general anesthesia / deep / conscious sedation without the required Board permit and facility standards.",
        citations: ["Tenn. Code Ann. § 63-5-108(g)", "Tenn. Comp. R. & Regs. 0460-02-.07"]
      }
    ],
    withCertification: []
  },
  {
    id: "dental-hygienist",
    title: "Licensed dental hygienist",
    shortLabel: "Hygienist",
    licenseBasis: "Tenn. Code Ann. § 63-5-108(c); Tenn. Comp. R. & Regs. 0460-03",
    supervision:
      "Must practice under direct and/or general supervision of a licensed dentist — never as a separate independent hygiene practice (Tenn. Code Ann. § 63-5-108(c)(3); Tenn. Comp. R. & Regs. 0460-03-.09).",
    may: [
      {
        text: "Preventive / educational / therapeutic hygiene: scaling deposits to the sulcus, polish, prophylaxis, sealants, topical fluoride, radiographs for dentist diagnosis, vitals/history/charting, OHI, and other duties listed in Rule 0460-03-.09(1).",
        citations: ["Tenn. Code Ann. § 63-5-108(c)(2)", "Tenn. Comp. R. & Regs. 0460-03-.09(1)"]
      },
      {
        text: "Under general supervision (when statutory conditions are met): hygiene services other than those limited to direct supervision — dentist examined patient within 11 months, written treatment plan, emergency protocols, patient notice that dentist is absent and hygienist cannot diagnose, ≥1 year FTE experience, ≤15 consecutive business days.",
        citations: ["Tenn. Code Ann. § 63-5-108(c)(5)"]
      },
      {
        text: "Limited prescriptive authority (fluoride agents, topical oral anesthetics, nonsystemic oral antimicrobials — not controlled substances) under general supervision per Board rules; dentist reviews prescription within 30 days.",
        citations: ["Tenn. Code Ann. § 63-5-108(h)"]
      }
    ],
    mayNot: [
      {
        text: "Comprehensive examination, diagnosis, or treatment planning; practice separate from a supervising dentist.",
        citations: ["Tenn. Code Ann. § 63-5-108(c)(3)", "Tenn. Comp. R. & Regs. 0460-03-.09(7)(a)"]
      },
      {
        text: "Surgical/cutting procedures on hard or soft tissue (except root planing / curettage); place sutures; approve final occlusion; fit/adjust/place prosthodontic appliances; use high-speed handpiece intraorally.",
        citations: ["Tenn. Comp. R. & Regs. 0460-03-.09(7)", "Tenn. Code Ann. § 63-5-108(d)"]
      },
      {
        text: "Administer conscious sedation or general anesthesia; issue unauthorized prescriptions.",
        citations: ["Tenn. Comp. R. & Regs. 0460-03-.09(7)(d),(h)"]
      },
      {
        text: "Scale/curettage duties assigned to assistants — scaling/curettage is hygienist-only among auxiliaries.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)"]
      }
    ],
    withCertification: [
      {
        text: "Root planing and subgingival curettage — direct supervision only.",
        citations: ["Tenn. Code Ann. § 63-5-108(c)(4)", "Tenn. Comp. R. & Regs. 0460-03-.09(3)"]
      },
      {
        text: "Local anesthesia (infiltration/block) — Board permit; dentist physically present at same office; direct supervision.",
        citations: ["Tenn. Code Ann. § 63-5-108(b)(12), (c)(4), (d)", "Tenn. Comp. R. & Regs. 0460-03-.12", "Tenn. Comp. R. & Regs. 0460-03-.09(5)"]
      },
      {
        text: "Administer and/or monitor nitrous oxide — Board certification; direct supervision.",
        citations: ["Tenn. Code Ann. § 63-5-108(c)(4), (e)", "Tenn. Comp. R. & Regs. 0460-03-.06", "Tenn. Comp. R. & Regs. 0460-03-.09(4)"]
      },
      {
        text: "Restorative / prosthetic functions listed by Board — certification + direct supervision.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-03-.10", "Tenn. Comp. R. & Regs. 0460-03-.09(6)"]
      }
    ]
  },
  {
    id: "registered-dental-assistant",
    title: "Registered dental assistant (RDA)",
    shortLabel: "RDA",
    licenseBasis: "Tenn. Comp. R. & Regs. 0460-01-.01(26); 0460-04; Tenn. Code Ann. § 63-5-108(d)",
    supervision:
      "Practices under the direct supervision and full responsibility of a licensed dentist (Tenn. Comp. R. & Regs. 0460-01-.01(26); 0460-04-.08).",
    may: [
      {
        text: "Delegable chairside/support duties in Rule 0460-04-.08(3) when trained and assigned (examples: process radiographs for diagnosis, topical fluoride, vitals/history/charting, rubber dam, temporary restorations, alginate impressions for non-permanent work, ortho banding assistive steps listed in the rule, topical anesthetic, etc.).",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.08(3)"]
      }
    ],
    mayNot: [
      {
        text: "Examination, diagnosis, or treatment planning; scale / root plane / curettage; surgical or cutting procedures; place sutures; approve final occlusion.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.08(4)"]
      },
      {
        text: "Administer local anesthesia, nitrous oxide, conscious sedation, or general anesthesia; use high-speed handpiece intraorally; use lasers unless specifically authorized.",
        citations: ["Tenn. Comp. R. & Regs. 0460-04-.08(4)(h),(l),(m)"]
      },
      {
        text: "Expose radiographs, coronal polish, apply sealants, monitor nitrous, or perform expanded restorative/prosthetic functions without the matching Board certification.",
        citations: ["Tenn. Comp. R. & Regs. 0460-04-.08(2), (4)(i)–(k),(n)–(o)"]
      }
    ],
    withCertification: [
      {
        text: "Coronal polishing — Board-approved training + clinical/didactic exam (statute).",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.04", "Tenn. Comp. R. & Regs. 0460-04-.08(2)(a)"]
      },
      {
        text: "Monitor nitrous oxide — certification; still cannot administer N2O.",
        citations: ["Tenn. Comp. R. & Regs. 0460-04-.05", "Tenn. Comp. R. & Regs. 0460-04-.08(2)(b)"]
      },
      {
        text: "Apply sealants — Board-approved training.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.09", "Tenn. Comp. R. & Regs. 0460-04-.08(2)(c)"]
      },
      {
        text: "Expose dental radiographs — radiology certification.",
        citations: ["Tenn. Comp. R. & Regs. 0460-04-.11", "Tenn. Comp. R. & Regs. 0460-04-.08(2)(f)"]
      },
      {
        text: "Expanded restorative / prosthetic functions — Board certification + direct supervision.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.10", "Tenn. Comp. R. & Regs. 0460-04-.08(2)(d)–(e)"]
      }
    ]
  },
  {
    id: "practical-dental-assistant",
    title: "Practical dental assistant",
    shortLabel: "Practical DA",
    licenseBasis: "Tenn. Comp. R. & Regs. 0460-01-.01(23); 0460-04-.01; Tenn. Code Ann. § 63-5-108(d)",
    supervision:
      "Supportive chairside procedures under the direct supervision and full responsibility of a licensed dentist (Tenn. Comp. R. & Regs. 0460-01-.01(23)).",
    may: [
      {
        text: "Supportive chairside duties under direct supervision that do not invade procedures reserved to registered dental assistants or hygienists (Rule 0460-04-.01(1)(b)). Commonly assignable assistant duties appear in Rule 0460-04-.08(3) when the dentist trains and assigns them.",
        citations: [
          "Tenn. Code Ann. § 63-5-108(d)",
          "Tenn. Comp. R. & Regs. 0460-04-.01(1)(b)",
          "Tenn. Comp. R. & Regs. 0460-04-.08(1), (3)"
        ]
      }
    ],
    mayNot: [
      {
        text: "Any act reserved to a dentist or dental hygienist; any prohibited assistant act in Rule 0460-04-.08(4); scaling/curettage.",
        citations: ["Tenn. Code Ann. § 63-5-108(d)", "Tenn. Comp. R. & Regs. 0460-04-.08(4)"]
      },
      {
        text: "Procedures only assignable to registered dental assistants (or requiring Board certification): expose radiographs, coronal polish, sealants, N2O monitoring, expanded restorative/prosthetic functions.",
        citations: [
          "Tenn. Comp. R. & Regs. 0460-04-.01(1)(b)",
          "Tenn. Comp. R. & Regs. 0460-04-.08(2), (4)"
        ]
      }
    ],
    withCertification: []
  }
] as const;

/** Mermaid sources — kept as data so the UI and docs cannot drift. */
export const LICENSE_SCOPE_MERMAID = {
  hierarchy: `flowchart TD
  DDS["Licensed dentist<br/>TCA § 63-5-108(a)–(b)<br/>Rules 0460-02"]
  RDH["Licensed dental hygienist<br/>TCA § 63-5-108(c)<br/>Rules 0460-03"]
  RDA["Registered dental assistant<br/>0460-01-.01(26)<br/>Rules 0460-04"]
  PDA["Practical dental assistant<br/>0460-01-.01(23)<br/>Rules 0460-04"]

  DDS -->|"employs / supervises<br/>TCA § 63-5-108(d)"| RDH
  DDS -->|"direct supervision<br/>+ full responsibility"| RDA
  DDS -->|"direct supervision<br/>+ full responsibility"| PDA

  RDH -.->|"may not practice<br/>independent of dentist<br/>TCA § 63-5-108(c)(3)"| STOP["No independent<br/>hygiene office"]`,

  supervision: `flowchart LR
  subgraph DIRECT["Direct supervision — dentist present / responsible"]
    D1["RDH: root planing, subgingival curettage,<br/>N2O, local anesthesia<br/>TCA § 63-5-108(c)(4)"]
    D2["RDH local anesthesia: dentist<br/>physically at same office<br/>0460-03-.09(5) / .12"]
    D3["RDA / practical DA: all intraoral<br/>assisting under direct supervision<br/>0460-01-.01(23),(26); 0460-04-.08"]
  end

  subgraph GENERAL["General supervision — RDH only, statutory conditions"]
    G1["Other hygiene services ≤15 consecutive<br/>business days if TCA § 63-5-108(c)(5)<br/>conditions all met"]
    G2["Dentist examined patient ≤11 months prior;<br/>written Tx plan; emergency protocols;<br/>patient notice; ≥1 yr FTE experience"]
  end

  subgraph PC1107["New — Pub. Ch. 1107, eff. 1/1/2027"]
    P1["New patient: RDH needs direct supervision<br/>by a dentist who has seen the patient<br/>before Dx radiographs, hard/soft-tissue<br/>data, prophylaxis, or fluoride"]
  end`,

  reserved: `flowchart TD
  ONLYDDS["Dentist only — professional judgment<br/>TCA § 63-5-108(d)"]
  ONLYDDS --> A["Diagnosis and treatment planning"]
  ONLYDDS --> B["Oral surgery / cutting hard or soft tissue<br/>except RDH curettage / root planing"]
  ONLYDDS --> C["Interpret dental radiographs<br/>TCA § 63-5-108(b)(11)"]
  ONLYDDS --> D["Permanent restorations unless Board-certified<br/>auxiliary pathway applies"]
  ONLYDDS --> E["General / conscious sedation — permit rules"]

  ONLYRDH["Hygienist only among auxiliaries"]
  ONLYRDH --> F["Scaling / curettage of deposits<br/>TCA § 63-5-108(d)"]

  CERT["Certification gates"]
  CERT --> G["RDH: local anesthesia .12 · N2O .06 · restorative/prosthetic .10"]
  CERT --> H["RDA: polish .04 · N2O monitor .05 · sealants .09 · radiographs .11 · expanded .10"]`
} as const;

export function scopeById(id: LicenseLevel): LicenseScope | undefined {
  return LICENSE_SCOPES.find((s) => s.id === id);
}
