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
};
