import { describe, expect, it } from "vitest";
import {
  allReasonOptions,
  narrowForPostingSeat,
  reasonCodesForViewer,
  reasonOptionsForPosting,
  REASON_FIELDS_ABOVE_POSTING,
  REASON_KIND_FOR_POSTING,
  type ReasonCodeRow,
} from "./reasons";
import { ROLE_RANK, type Role } from "../auth/roles";

function row(over: Partial<ReasonCodeRow> & Pick<ReasonCodeRow, "code" | "kind" | "label">): ReasonCodeRow {
  return { active: true, reserved: false, requiresApprovalOverCents: null, entries: 0, ...over };
}

const rows: ReasonCodeRow[] = [
  row({ code: "courtesy", kind: "write_off", label: "Courtesy adjustment" }),
  row({ code: "contractual_ppo", kind: "write_off", label: "Contractual PPO write-off" }),
  row({ code: "correction", kind: "reversal", label: "Correction" }),
  row({ code: "prior_period", kind: "adjustment", label: "Prior period correction", reserved: true }),
  row({ code: "retired_one", kind: "write_off", label: "No longer used", active: false, entries: 4 }),
  row({ code: "bank_fee", kind: "variance", label: "Bank fee" }),
];

describe("the reason options a form offers", () => {
  it("offers the practice's active codes for the posting kind, in the reader's order", () => {
    expect(reasonOptionsForPosting(rows, "write_off")).toEqual([
      { value: "contractual_ppo", label: "Contractual PPO write-off" },
      { value: "courtesy", label: "Courtesy adjustment" },
    ]);
    // Sorted by what the front desk reads, not by the code underneath it.
    expect(reasonOptionsForPosting(rows, "write_off").map((o) => o.label)).toEqual(
      [...reasonOptionsForPosting(rows, "write_off").map((o) => o.label)].sort()
    );
  });

  it("leaves a retired code off the forms while its entries keep citing it", () => {
    expect(reasonOptionsForPosting(rows, "write_off").map((o) => o.value)).not.toContain("retired_one");
    expect(allReasonOptions(rows).map((o) => o.value)).not.toContain("retired_one");
    // The row itself is still there, with the entries that are the reason it was retired, not deleted.
    expect(rows.find((r) => r.code === "retired_one")).toMatchObject({ active: false, entries: 4 });
  });

  it("keeps the reserved reason off both forms, because the service applies it itself", () => {
    // prior_period is the reason a correction into a closed month must carry;
    // offering it as a first posting's reason would invite a meaning it lacks.
    expect(reasonOptionsForPosting(rows, "adjustment")).toEqual([]);
    expect(allReasonOptions(rows).map((o) => o.value)).not.toContain("prior_period");
  });

  it("maps both transfer kinds onto the one reason kind, and offers none for a kind that takes no reason", () => {
    expect(REASON_KIND_FOR_POSTING.transfer_out).toBe("transfer");
    expect(REASON_KIND_FOR_POSTING.transfer_in).toBe("transfer");
    // A payment and a charge cite no reason at all, so the form offers nothing.
    expect(reasonOptionsForPosting(rows, "patient_payment")).toEqual([]);
    expect(reasonOptionsForPosting(rows, "charge")).toEqual([]);
  });

  it("offers a correction every active code, whatever kind the entry it replaces was", () => {
    // A repost keeps the kind of the entry it replaces, so the correction form
    // cannot narrow by kind the way the posting form does.
    expect(allReasonOptions(rows).map((o) => o.value)).toEqual(["bank_fee", "contractual_ppo", "correction", "courtesy"]);
  });

  it("files `correction` under reversal, which the hard-coded list had wrong", () => {
    // The constant this replaced offered `correction` under the adjustment kind
    // while the seed files it under `reversal`. Reading the rows settles it.
    expect(reasonOptionsForPosting(rows, "reversal").map((o) => o.value)).toEqual(["correction"]);
    expect(reasonOptionsForPosting(rows, "adjustment").map((o) => o.value)).not.toContain("correction");
  });
});

/**
 * What one rank receives (Increment 1.103).
 *
 * `GET /api/reason-codes` opens at `user`, because the posting forms are
 * built from this list. It handed every posting seat the approval threshold
 * on each reason — the line under which a write-off gets no second pair of
 * hands — and a count of the entries citing it. No screen below `manager`
 * reads either.
 */
describe("the reason codes one rank receives", () => {
  const governed: ReasonCodeRow[] = [
    row({ code: "courtesy", kind: "write_off", label: "Courtesy adjustment", requiresApprovalOverCents: 50_000, entries: 12 }),
  ];

  it("gives a posting seat the fields its forms are built from, and no others", () => {
    expect(narrowForPostingSeat(governed)).toEqual([
      { code: "courtesy", kind: "write_off", label: "Courtesy adjustment", active: true, reserved: false },
    ]);
  });

  /**
   * The gate. A field added to `ReasonCodeRow` reaches every posting seat
   * unless somebody narrows it, and the narrowing is invisible from the
   * route. This reads both objects and fails the day the difference between
   * them stops being the two fields somebody decided on.
   */
  it("drops exactly the fields nobody below manager reads", () => {
    const [full] = governed;
    const [narrow] = narrowForPostingSeat(governed);
    const dropped = Object.keys(full!).filter((k) => !(k in narrow!));
    expect(dropped.sort()).toEqual([...REASON_FIELDS_ABOVE_POSTING].sort());
  });

  it("answers manager and above with the practice's governance of its reasons", () => {
    for (const rank of ["manager", "admin"] as Role[]) {
      expect(reasonCodesForViewer(governed, rank)).toEqual(governed);
    }
  });

  it("answers every rank below manager with the narrower list", () => {
    for (const rank of ["readonly", "user", "lead"] as Role[]) {
      expect(reasonCodesForViewer(governed, rank)).toEqual(narrowForPostingSeat(governed));
    }
  });

  /** Every rank this product has is decided here, so a sixth cannot slip through unconsidered. */
  it("decides every rank the product has", () => {
    for (const rank of Object.keys(ROLE_RANK) as Role[]) {
      expect(reasonCodesForViewer(governed, rank)).toHaveLength(1);
    }
    expect(Object.keys(ROLE_RANK)).toEqual(["readonly", "user", "lead", "manager", "admin"]);
  });
});
