import { describe, expect, it } from "vitest";
import { aggregateDailyMetrics } from "./aggregate";
import { redactEventPayload } from "./redact";

describe("redactEventPayload", () => {
  it("keeps safe scalar fields and drops secrets", () => {
    expect(
      redactEventPayload("auth.sessions_revoked_all", {
        reason: "incident_response",
        revoked: 3,
        recipient: "patient@example.com",
        password: "nope",
      })
    ).toEqual({
      kind: "auth.sessions_revoked_all",
      reason: "incident_response",
      revoked: 3,
    });
  });
});

describe("aggregateDailyMetrics", () => {
  it("counts events per tenant/day/kind with a redacted sample", () => {
    const rows = aggregateDailyMetrics([
      {
        tenantId: "t1",
        kind: "auth.signin",
        payload: { channel: "web" },
        occurredAt: "2026-09-15T10:00:00.000Z",
      },
      {
        tenantId: "t1",
        kind: "auth.signin",
        payload: { channel: "web" },
        occurredAt: "2026-09-15T11:00:00.000Z",
      },
      {
        tenantId: "t1",
        kind: "backup.restore_drill",
        payload: { ok: true, backupTarget: "s3://backups" },
        occurredAt: "2026-09-15T12:00:00.000Z",
      },
    ]);
    expect(rows).toEqual([
      {
        tenantId: "t1",
        day: "2026-09-15",
        kind: "auth.signin",
        count: 2,
        sample: { kind: "auth.signin", channel: "web" },
      },
      {
        tenantId: "t1",
        day: "2026-09-15",
        kind: "backup.restore_drill",
        count: 1,
        sample: { kind: "backup.restore_drill", ok: true, backupTarget: "s3://backups" },
      },
    ]);
  });
});
