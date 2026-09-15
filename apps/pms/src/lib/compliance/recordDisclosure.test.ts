import { describe, expect, it } from "vitest";
import { createMemoryStore } from "../auth/memoryStore";
import { recordDisclosure } from "./recordDisclosure";
import { DEV_USERS } from "../auth/devSeed";

const now = new Date("2026-09-15T12:00:00.000Z");
const owner = DEV_USERS[0];
const patientId = "0196b0a0-0000-7000-8000-000000009999";

describe("recordDisclosure", () => {
  it("appends a disclosure row through the store", async () => {
    const store = await createMemoryStore({ now });
    const result = await recordDisclosure(store, {
      tenantId: owner.tenantId,
      patientId,
      channel: "export",
      recipient: "patient@example.com",
      recordIds: ["doc-1"],
      purpose: "patient_request",
      actorUserId: owner.id,
      actorName: owner.displayName,
      at: now,
    });
    expect(result.ok).toBe(true);
    expect(store.disclosures).toHaveLength(1);
  });
});
