/**
 * The reason options a form offers, derived from the practice's own rows
 * (Increment 1.45; a hard-coded list until then).
 *
 * `ledger_entries.reason_code` is a foreign key into each practice's
 * `reason_codes`, so an option exists only because that practice adopted it.
 * Offering a list rather than a free-text box keeps a reason the practice
 * never adopted from reaching the database at all; the posting services refuse
 * an unregistered one in words besides (Increment 1.39).
 *
 * Reading the rows rather than a constant also settled a disagreement the
 * constant had been hiding: it offered `correction` under the adjustment kind
 * while the seed files that code under `reversal`.
 */

/**
 * The reason a correction into a closed month must carry (Increment 1.36's
 * refusal). It lives here rather than beside the close, because the forms and
 * the browser need it and must not pull the database in with it.
 */
export const PRIOR_PERIOD_REASON = "prior_period";

/** Codes the product reserves: the practice may relabel them, never retire them. */
export const RESERVED_REASON_CODES = [PRIOR_PERIOD_REASON] as const;

/** The reason kinds the column admits (migration 0010's CHECK). */
export const REASON_KINDS = ["adjustment", "write_off", "refund", "reversal", "transfer", "variance"] as const;
export type ReasonKind = (typeof REASON_KINDS)[number];

export const REASON_KIND_LABEL: Record<ReasonKind, string> = {
  adjustment: "Adjustment",
  write_off: "Write-off",
  refund: "Refund",
  reversal: "Reversal",
  transfer: "Transfer",
  variance: "Bank variance",
};

/**
 * The reason kind a posting kind draws from. `transfer_out` and `transfer_in`
 * share one reason kind, and `variance` belongs to bank reconciliation rather
 * than to any posting, so no posting form offers it.
 */
export const REASON_KIND_FOR_POSTING: Record<string, ReasonKind> = {
  adjustment: "adjustment",
  write_off: "write_off",
  refund: "refund",
  reversal: "reversal",
  transfer_out: "transfer",
  transfer_in: "transfer",
};

/** One reason code as the practice holds it, with how many entries cite it. */
export type ReasonCodeRow = {
  code: string;
  kind: string;
  label: string;
  active: boolean;
  /** True where the product needs this code to exist; it may be relabelled, never retired. */
  reserved: boolean;
  /**
   * The figure above which a posting under this reason waits for a second
   * person (Increment 1.46); null where the practice set no rule and the
   * channel's threshold governs, 0 where every one of them waits.
   */
  requiresApprovalOverCents: number | null;
  /** How many ledger entries cite it: why a code in use is retired rather than removed. */
  entries: number;
};

export type ReasonOption = { value: string; label: string };


function toOption(row: ReasonCodeRow): ReasonOption {
  return { value: row.code, label: row.label };
}

function byLabel(a: ReasonOption, b: ReasonOption): number {
  return a.label.localeCompare(b.label);
}

/**
 * What a first posting of this kind may cite: the practice's active codes for
 * the matching reason kind, minus the reserved ones. `prior_period` is the
 * reason a correction into a closed month carries, and the correction service
 * applies it itself, so offering it as a first posting's reason would invite
 * a meaning it does not have.
 */
export function reasonOptionsForPosting(rows: ReasonCodeRow[], postingKind: string): ReasonOption[] {
  const kind = REASON_KIND_FOR_POSTING[postingKind];
  if (!kind) return [];
  return rows
    .filter((r) => r.active && r.kind === kind && !(RESERVED_REASON_CODES as readonly string[]).includes(r.code))
    .map(toOption)
    .sort(byLabel);
}

/**
 * What a correction may cite: every active code the practice holds, because a
 * repost keeps the kind of the entry it replaces, whatever that was. The
 * reserved codes stay out for the same reason as above — into a closed month
 * the service applies `prior_period` itself.
 */
export function allReasonOptions(rows: ReasonCodeRow[]): ReasonOption[] {
  return rows
    .filter((r) => r.active && !(RESERVED_REASON_CODES as readonly string[]).includes(r.code))
    .map(toOption)
    .filter((option, i, all) => all.findIndex((o) => o.value === option.value) === i)
    .sort(byLabel);
}
