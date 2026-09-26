import { describe, expect, it } from "vitest";
import { memoryPorts } from "./ports";
import { requireAccess } from "./requireAccess";
import type { FreshUser, SessionRow } from "./types";

const now = new Date("2026-09-14T12:00:00.000Z");

const user: FreshUser = {
  id: "u1",
  tenantId: "t1",
  username: "owner",
  displayName: "Owner",
  role: "manager",
  clinicalRole: "dentist",
  active: true,
  passwordChangedAt: now,
  mfaEnrolledAt: now,
  entitlements: ["approve_writeoffs"],
};

const session: SessionRow = {
  id: "s1",
  tenantId: "t1",
  userId: "u1",
  revokedAt: null,
  idleExpiresAt: new Date(now.getTime() + 30 * 60 * 1000),
  absoluteExpiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
  lastSeenAt: now,
  deviceProfile: "desk",
};

function req(): Request {
  return new Request("http://localhost/api/me", { method: "GET" });
}

describe("requireAccess", () => {
  it("returns 401 when there is no session", async () => {
    const ports = memoryPorts();
    const result = await requireAccess(req(), {}, ports, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it("returns 403 when the account is inactive", async () => {
    const ports = memoryPorts({
      session,
      user: { ...user, active: false },
      sessionId: "s1",
    });
    const result = await requireAccess(req(), {}, ports, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it("forces MFA enrollment", async () => {
    const ports = memoryPorts({
      session,
      user: { ...user, mfaEnrolledAt: null },
      sessionId: "s1",
    });
    const result = await requireAccess(req(), {}, ports, now);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      expect(await result.response.json()).toMatchObject({
        error: expect.stringMatching(/MFA/),
      });
    }
  });

  it("lets a grant open a route in the rank's place, and refuses without it (Increment 1.49)", async () => {
    const seat: FreshUser = { ...user, role: "readonly", entitlements: ["view_reports_only"] };
    const opened = await requireAccess(
      req(),
      { minRank: "manager", orEntitlement: "view_reports_only" },
      memoryPorts({ session, user: seat, sessionId: "s1" }),
      now
    );
    expect(opened.ok).toBe(true);

    // The same seat without the grant is refused, so the rank is still the rule.
    const bare = await requireAccess(
      req(),
      { minRank: "manager", orEntitlement: "view_reports_only" },
      memoryPorts({ session, user: { ...seat, entitlements: [] }, sessionId: "s1" }),
      now
    );
    expect(bare.ok).toBe(false);
    if (!bare.ok) expect(bare.response.status).toBe(403);

    // It relaxes the rank alone: a declared entitlement still has to be held.
    const andList = await requireAccess(
      req(),
      { minRank: "manager", orEntitlement: "view_reports_only", entitlements: ["approve_writeoffs"] },
      memoryPorts({ session, user: seat, sessionId: "s1" }),
      now
    );
    expect(andList.ok).toBe(false);
    if (!andList.ok) expect(andList.response.status).toBe(403);
  });

  it("sets tenant context and logs a PHI read", async () => {
    const ports = memoryPorts({ session, user, sessionId: "s1" });
    const result = await requireAccess(
      req(),
      { minRank: "user", phiRead: { kind: "chart", ids: ["c1"], purpose: "treatment" } },
      ports,
      now
    );
    expect(result.ok).toBe(true);
    expect(ports.tenantSets).toEqual(["t1:u1"]);
    expect(ports.phiLog).toHaveLength(1);
  });

  it("records a disclosure when PHI egress is declared", async () => {
    const ports = memoryPorts({ session, user, sessionId: "s1" });
    const result = await requireAccess(
      req(),
      {
        disclosure: {
          patientId: "p1",
          channel: "export",
          recipient: "patient@example.com",
          recordIds: ["doc-1"],
          purpose: "patient_request",
        },
      },
      ports,
      now
    );
    expect(result.ok).toBe(true);
    expect(ports.disclosureLog).toHaveLength(1);
  });
});
