import { describe, expect, it, vi } from "vitest";

/**
 * `withGuard` reaches NextAuth through `resolveStore` and `sessionId`, which
 * is why it had no unit test before Increment 1.81. Every case here passes its
 * own ports, so those two are only ever imported, never called.
 */
vi.mock("./resolveStore", () => ({ getAuthPorts: async () => null, getAuthStore: async () => null }));
vi.mock("./sessionId", () => ({ getSessionIdFromAuth: async () => null }));

import { memoryPorts } from "./ports";
import { withGuard } from "./withGuard";
import type { FreshUser, SessionRow } from "./types";

const now = new Date("2026-09-21T12:00:00.000Z");

const user: FreshUser = {
  id: "u1",
  tenantId: "t1",
  username: "owner",
  displayName: "Riley Owner",
  role: "admin",
  clinicalRole: "dentist",
  active: true,
  passwordChangedAt: now,
  mfaEnrolledAt: now,
  entitlements: ["approve_writeoffs"],
};

const live: SessionRow = {
  id: "s1",
  tenantId: "t1",
  userId: "u1",
  revokedAt: null,
  idleExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  absoluteExpiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
  lastSeenAt: now,
  deviceProfile: "desk",
};

const ctx = { params: Promise.resolve({}) };
const get = () => new Request("http://localhost/api/me", { method: "GET" });

/**
 * Increment 1.81. A browser case cleared its cookies, reloaded, watched the
 * server render a signed-out header, and still had `fetch("/api/me")` answer
 * 200 with the owner's name, rank and grants — out of the browser's own cache,
 * because nothing told it not to keep one. On a shared front-desk machine that
 * is the last person's guarded answers handed to the next one.
 */
describe("withGuard does not let a guarded answer be stored", () => {
  it("stamps the answer a live session earns", async () => {
    const ports = memoryPorts({ session: live, user, sessionId: "s1" });
    const route = withGuard(async () => Response.json({ ok: true }), { minRank: "readonly" }, ports);
    const res = await route(get(), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("stamps a refusal that names the session", async () => {
    // The 401 matters as much as the 200: it is the answer that replaces a
    // cached 200, and a cache that kept the older one would undo the refusal.
    const route = withGuard(async () => Response.json({ ok: true }), {}, memoryPorts());
    const res = await route(get(), ctx);
    expect(res.status).toBe(401);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("stamps a refusal about the seat", async () => {
    const ports = memoryPorts({ session: live, user: { ...user, role: "user" }, sessionId: "s1" });
    const route = withGuard(async () => Response.json({ ok: true }), { minRank: "admin" }, ports);
    const res = await route(get(), ctx);
    expect(res.status).toBe(403);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("stamps a refusal made before the session is read at all", async () => {
    // The same-origin check answers before anything is looked up, and its
    // answer is as much a fact about this session as any other.
    const ports = memoryPorts({ session: live, user, sessionId: "s1" });
    const route = withGuard(async () => Response.json({ ok: true }), { minRank: "readonly" }, ports);
    const res = await route(
      new Request("http://localhost/api/me", {
        method: "POST",
        headers: { origin: "http://elsewhere.example", "content-type": "application/json" },
        body: "{}",
      }),
      ctx
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("leaves the handler's own answer otherwise untouched", async () => {
    const ports = memoryPorts({ session: live, user, sessionId: "s1" });
    const route = withGuard(
      async () => Response.json({ ok: true, who: "riley" }, { headers: { "x-pms-test": "kept" } }),
      { minRank: "readonly" },
      ports
    );
    const res = await route(get(), ctx);
    expect(res.headers.get("x-pms-test")).toBe("kept");
    expect(await res.json()).toEqual({ ok: true, who: "riley" });
  });
});
