import { describe, expect, it } from "vitest";
import { mergeDualReleasePolicy } from "@pms/controls-engine";
import { createPostEntry, makeInMemoryWriter } from "./post";
import { postGuarded } from "./postGuarded";
import type { LedgerEntry, PaymentAllocation } from "./types";

const people = [
  {
    id: "u-biller",
    name: "Dana Biller",
    role: "Billing Specialist",
    active: true,
    tenureYears: 3,
  },
  {
    id: "u-owner",
    name: "Dr. Reagan",
    role: "Owner / Dentist",
    active: true,
    tenureYears: 12,
  },
];

describe("postGuarded", () => {
  it("refuses a large write-off without a second approver", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const policy = mergeDualReleasePolicy({ enabled: true });

    const result = await postGuarded(post, {
      tenantId: "t1",
      accountId: "a1",
      patientId: "p1",
      locationId: "l1",
      kind: "write_off",
      glBucket: "patient_ar",
      amountCents: -30000,
      reasonCode: "courtesy",
      effectiveDate: "2026-09-01",
      createdById: "u-biller",
      createdByName: "Dana Biller",
      policy,
      people,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("blocked_missing_second");
    expect(store.entries).toHaveLength(0);
  });

  it("posts a write-off when dual release is satisfied", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const policy = mergeDualReleasePolicy({ enabled: true });

    const result = await postGuarded(post, {
      tenantId: "t1",
      accountId: "a1",
      patientId: "p1",
      locationId: "l1",
      kind: "write_off",
      glBucket: "patient_ar",
      amountCents: -30000,
      reasonCode: "courtesy",
      effectiveDate: "2026-09-01",
      createdById: "u-biller",
      createdByName: "Dana Biller",
      secondPersonId: "u-owner",
      policy,
      people,
    });

    expect(result.ok).toBe(true);
    expect(store.entries).toHaveLength(1);
  });
});
