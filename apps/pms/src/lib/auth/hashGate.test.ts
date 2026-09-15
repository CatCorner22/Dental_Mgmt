import { describe, expect, it } from "vitest";
import { hashesInFlight, resetHashGate, withHashSlot } from "./hashGate";

describe("hashGate", () => {
  it("releases the slot after a thrown hash", async () => {
    resetHashGate();
    await expect(
      withHashSlot(async () => {
        throw new Error("bad hash");
      })
    ).rejects.toThrow("bad hash");
    expect(hashesInFlight()).toBe(0);
  });
});
