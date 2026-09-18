export type DepositRow = {
  depositId: string;
  locationId: string;
  businessDate: string;
  method: string;
  amountCents: number;
  reference: string | null;
  status: string;
  preparedByName: string;
};

/**
 * One ledger row the database admitted against this day after the practice
 * sealed it (Increment 1.40). A first posting arrived with nothing to announce
 * it; a correction names the entry it replaces, so the two read differently.
 */
export type LatePostingRow = {
  entryId: string;
  kind: string;
  amountCents: number;
  postedAt: string;
  createdByName: string;
  reasonCode: string | null;
  /** Set when this row is half of a correction pair rather than a first posting. */
  correctsEntryId: string | null;
  memo: string | null;
};

export type DayCloseSnapshot = {
  dayCloseId: string | null;
  locationId: string;
  businessDate: string;
  status: "open" | "frozen";
  depositTotalCents: number;
  daySheetTotalCents: number;
  varianceCents: number;
  deposits: DepositRow[];
  frozenAt: string | null;
  frozenByName: string | null;
  /** Dual-count verdict recorded at the seal; null while the day is open. */
  sealStatus: string | null;
  degradedOwnerSeal: boolean;
  /** Rows that landed after the seal, oldest first; empty while the day is open. */
  latePostings: LatePostingRow[];
  /** What those rows move the day by, in the ledger's own signs. */
  latePostingTotalCents: number;
};
