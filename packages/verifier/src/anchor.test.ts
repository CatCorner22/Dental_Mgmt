import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  anchorRecordedHeads,
  canonicalChainHeadPayload,
  chainHeadObjectKey,
  fileObjectLockSink,
  signChainHead,
  verifyChainHeadSignature,
} from "./anchor";

describe("chain head anchor", () => {
  it("signs and writes an immutable file per tenant", async () => {
    const dir = await mkdtemp(join(tmpdir(), "pms-heads-"));
    const sink = fileObjectLockSink(`file://${dir}`);
    const checkedAt = "2026-09-15T00:00:00.000Z";
    const signKey = "test-sign-key";
    const recorded = [
      {
        tenantId: "t1",
        day: "2026-09-15",
        ok: true,
        headHash: "abc",
        eventCount: 2,
        inserted: true,
        objectLockKey: null,
        anchored: false,
      },
    ];
    const anchored = await anchorRecordedHeads(recorded, checkedAt, sink, signKey);
    expect(anchored[0]?.anchored).toBe(true);
    const key = chainHeadObjectKey("t1", "2026-09-15");
    const raw = await readFile(join(dir, key), "utf8");
    const doc = JSON.parse(raw) as { signature: string };
    const payload = canonicalChainHeadPayload({
      tenantId: "t1",
      day: "2026-09-15",
      headHash: "abc",
      eventCount: 2,
      ok: true,
      checkedAt,
    });
    expect(verifyChainHeadSignature(payload, doc.signature, signKey)).toBe(true);
    expect(signChainHead(payload, signKey)).toBe(doc.signature);
  });
});
