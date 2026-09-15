import { describe, expect, it } from "vitest";
import { createMemoryStore } from "./memoryStore";
import { revokeAllSessionsForTenant } from "./revokeAllSessions";
import { DEV_USERS } from "./devSeed";

const now = new Date("2026-09-15T12:00:00.000Z");

describe("revokeAllSessionsForTenant", () => {
  it("revokes every live session and appends an audit event", async () => {
    const store = await createMemoryStore({ now });
    const owner = DEV_USERS[0];
    await store.createSession({
      tenantId: owner.tenantId,
      userId: owner.id,
      deviceProfile: "desk",
      userAgent: "test",
      now,
    });
    const otherTenant = DEV_USERS[3];
    await store.createSession({
      tenantId: otherTenant.tenantId,
      userId: otherTenant.id,
      deviceProfile: "desk",
      userAgent: "test",
      now,
    });

    const result = await revokeAllSessionsForTenant(store, {
      tenantId: owner.tenantId,
      actorUserId: owner.id,
      reason: "incident_response",
      at: now,
    });
    expect(result.revoked).toBe(1);
    expect(store.events).toEqual([
      {
        kind: "auth.sessions_revoked_all",
        payload: { reason: "incident_response", revoked: 1 },
      },
    ]);
  });
});
