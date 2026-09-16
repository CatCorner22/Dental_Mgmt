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

  it("returns needs_second when policy allows held posting", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const policy = mergeDualReleasePolicy({ enabled: true, hardBlockWithoutSecond: false });

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
    if (!result.ok) {
      expect(result.code).toBe("needs_second");
      expect(result.held).toBe(true);
    }
    expect(store.entries).toHaveLength(0);
  });

  it("does not accept a second person named inline as the second decision", async () => {
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

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("approval_request_required");
      expect(result.held).toBe(false);
    }
    expect(store.entries).toHaveLength(0);
  });

  it("posts a write-off that cites an approved request and stamps that id, never a person id", async () => {
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
      approvalRequestId: "req-1",
      policy,
      people,
    });

    expect(result.ok).toBe(true);
    expect(store.entries).toHaveLength(1);
    expect(store.entries[0].approvalRequestId).toBe("req-1");
    expect(store.entries[0].appliedExceptionId).toBeNull();
  });

  it("stamps the exception that licensed a single release above the threshold", async () => {
    const store = { entries: [] as LedgerEntry[], allocations: [] as PaymentAllocation[] };
    const post = createPostEntry(makeInMemoryWriter(store));
    const policy = mergeDualReleasePolicy({
      enabled: true,
      exceptions: [
        {
          id: "ex-writeoff-raise",
          label: "Temporary write-off raise",
          channels: ["writeoff"],
          action: "raise_threshold",
          thresholdUsd: 400,
          enabled: true,
          reason: "Owner out of office.",
          residualNote: "Review all write-offs on return.",
          approvedByPersonId: "u-owner",
          createdAt: "2026-09-01",
        },
      ],
    });

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

    expect(result.ok).toBe(true);
    expect(store.entries[0].appliedExceptionId).toBe("ex-writeoff-raise");
    expect(store.entries[0].approvalRequestId).toBeNull();
  });

  it("posts a small write-off with neither request nor exception", async () => {
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
      amountCents: -10000,
      reasonCode: "courtesy",
      effectiveDate: "2026-09-01",
      createdById: "u-biller",
      createdByName: "Dana Biller",
      policy,
      people,
    });

    expect(result.ok).toBe(true);
    expect(store.entries[0].approvalRequestId).toBeNull();
    expect(store.entries[0].appliedExceptionId).toBeNull();
  });
});
