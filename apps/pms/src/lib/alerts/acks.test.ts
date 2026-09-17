import { describe, expect, it } from "vitest";
import { ackKey, attachAcks, summarizeAcks, type HardEventAck } from "./acks";
import type { HardEvent } from "./hardEvents";

const variance: HardEvent = {
  kind: "deposit_variance",
  label: "Deposit variance over threshold",
  at: "2026-09-16T12:00:00Z",
  subjectKind: "reconciliation_run",
  subjectId: "run-1",
  sentence: "The bank run carries a $150.00 variance.",
  href: "/reconciliation/run-1",
};
const device: HardEvent = { ...variance, kind: "new_device_financial_role", label: "New device on a financial role", subjectKind: "session", subjectId: "s-1", href: "/risk" };
const ack: HardEventAck = {
  id: "a-1",
  kind: "deposit_variance",
  subjectKind: "reconciliation_run",
  subjectId: "run-1",
  eventAt: "2026-09-16T12:00:00Z",
  note: "Fee line; cleared in the variance queue.",
  acknowledgedById: "u-owner",
  acknowledgedByName: "Riley Owner",
  acknowledgedAt: "2026-09-17T09:00:00Z",
};

describe("hard-event acknowledgments (Increment 1.33)", () => {
  it("keys an event by kind and the row it names", () => {
    expect(ackKey("deposit_variance", "reconciliation_run", "run-1")).toBe("deposit_variance|reconciliation_run|run-1");
  });

  it("attaches the acknowledgment to its event only, and counts what still waits", () => {
    const items = attachAcks([variance, device], [ack]);
    expect(items[0]!.ack).toEqual({ acknowledgedByName: "Riley Owner", acknowledgedAt: "2026-09-17T09:00:00Z", note: "Fee line; cleared in the variance queue." });
    expect(items[1]!.ack).toBeNull();
    expect(summarizeAcks(items)).toEqual({ total: 2, acknowledged: 1, waiting: 1 });
    expect(summarizeAcks(attachAcks([], []))).toEqual({ total: 0, acknowledged: 0, waiting: 0 });
  });
});
