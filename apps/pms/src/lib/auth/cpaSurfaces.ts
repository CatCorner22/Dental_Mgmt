/**
 * Everything the outside accountant's seat can read, written down
 * (Increment 1.106).
 *
 * Increment 1.49 gave the seat its argument: the month-end package is
 * aggregate and names no patient, so an outside firm may read it without the
 * countersigned agreement `docs/05` otherwise requires, and a live test reads
 * the practice's own patient rows and looks for any of their names, record
 * numbers or ids in the package and its export.
 *
 * That argument is about **what the seat reads**, and the set of things it
 * reads has grown three times since — the question threads (1.50), the
 * channel attestations (1.51), and where its own notices go (1.74) — without
 * anybody reading the argument again. Two of those carry words a person
 * typed, which no test can check the content of.
 *
 * So the set is written down, and a test reads every route file for the
 * seat's entitlement and fails when the two disagree. A new surface cannot
 * open to this seat until somebody has said, here, what the seat receives
 * there. That is the whole of what a check can do; deciding whether a
 * practice is content with a free-text channel to an outside firm is the
 * practice's, and `docs/05` is where it belongs.
 */
export type CpaSurface = {
  /** The route file, relative to `src/app`. */
  route: string;
  /** What the seat receives there. */
  receives: string;
  /**
   * Whether what the seat reads there can contain words a person typed, as
   * against figures the product computed. Free text is the case the live test
   * cannot cover, because it can only prove that what the product *derived*
   * names no patient.
   */
  freeText: boolean;
};

export const CPA_SURFACES: CpaSurface[] = [
  {
    route: "api/cpa/package/route.ts",
    receives: "The month's package: aggregate figures, hash-stamped, with the seals and the attestation counts.",
    freeText: false,
  },
  {
    route: "api/cpa/package/export/route.ts",
    receives: "The same package as CSV or JSON, and a chain event naming who exported it.",
    freeText: false,
  },
  {
    route: "api/cpa/questions/route.ts",
    receives:
      "The threads about that month's lines — both halves. The subject is a line the package states, and the body is whatever either side wrote.",
    freeText: true,
  },
  {
    route: "api/controls/attestations/route.ts",
    receives:
      "The channels the product cannot enforce, and each attestation with the note whoever attested it wrote.",
    freeText: true,
  },
  {
    route: "api/notices/address/route.ts",
    receives: "Where this seat's own notices go, and nothing about anybody else's.",
    freeText: false,
  },
  {
    route: "api/notices/prove/route.ts",
    receives: "The proof of this seat's own address.",
    freeText: false,
  },
  {
    route: "api/notices/send/route.ts",
    receives: "What would be sent to this seat, and the outcome of sending it.",
    freeText: false,
  },
];

/** The surfaces whose contents nothing can check, because a person wrote them. */
export function freeTextSurfaces(): CpaSurface[] {
  return CPA_SURFACES.filter((s) => s.freeText);
}

/**
 * What the practice reads before it writes to the accountant (Increment 1.106).
 *
 * The product cannot stop somebody typing a patient's name, and a check that
 * pretended to would be worse than none. What it can do is say, where the
 * typing happens, who reads this and what the month-end package's own rule
 * is — the same reasoning Increment 1.90 used for the sign-out reason: a
 * sentence beside the field is a better guard than a dialogue somebody
 * dismisses, and it leaves the practice able to say it was told.
 */
export function outsideReaderSentence(): string {
  return "This goes to the outside accountant, who holds no agreement to receive patient information. Name the line and the figure, never the patient.";
}
