/**
 * The chart-of-accounts vocabulary and row shape. Lives here, not in
 * mappings.ts, because the month-end page is a client component: importing
 * the service would pull the Postgres driver into the browser bundle and
 * break `next build` (the same reason `lib/ledger/types.ts` exists).
 */
export const GL_BUCKETS = ["patient_ar", "ins_ar_primary", "ins_ar_secondary", "unapplied_credit", "undeposited_funds"] as const;
export const GL_KINDS = ["charge", "patient_payment", "insurance_payment", "adjustment", "write_off", "refund", "transfer_out", "transfer_in", "reversal"] as const;
export const GL_SIDES = ["debit", "credit"] as const;
/** The reason code that stands for every reason code on a bucket and kind. */
export const ANY_REASON = "*";

export type GlSide = (typeof GL_SIDES)[number];
export type MappingStatus = "proposed" | "approved" | "rejected";

export type GlMapping = {
  id: string;
  glBucket: string;
  kind: string;
  reasonCode: string;
  accountCode: string;
  accountName: string;
  side: GlSide;
  note: string;
  status: MappingStatus;
  proposedById: string;
  proposedByName: string;
  /** ISO timestamp. */
  proposedAt: string;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  supersedesId: string | null;
};

export function mappingKey(glBucket: string, kind: string, reasonCode: string): string {
  return `${glBucket}|${kind}|${reasonCode}`;
}
