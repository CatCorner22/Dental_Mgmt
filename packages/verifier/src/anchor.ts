import { createHmac } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RecordedTenant } from "./record";

export interface ChainHeadDocument {
  tenantId: string;
  day: string;
  headHash: string;
  eventCount: number;
  ok: boolean;
  checkedAt: string;
  signature: string;
}

export interface ObjectLockSink {
  put(key: string, body: string): Promise<void>;
}

export function chainHeadObjectKey(tenantId: string, day: string): string {
  return `audit-heads/${tenantId}/${day}.json`;
}

export function canonicalChainHeadPayload(input: {
  tenantId: string;
  day: string;
  headHash: string;
  eventCount: number;
  ok: boolean;
  checkedAt: string;
}): string {
  return JSON.stringify({
    tenantId: input.tenantId,
    day: input.day,
    headHash: input.headHash,
    eventCount: input.eventCount,
    ok: input.ok,
    checkedAt: input.checkedAt,
  });
}

/** Phase 0 dev signer. Production replaces this with KMS ECDSA P-256. */
export function signChainHead(payload: string, signKey: string): string {
  return createHmac("sha256", signKey).update(payload).digest("hex");
}

export function verifyChainHeadSignature(payload: string, signature: string, signKey: string): boolean {
  return signChainHead(payload, signKey) === signature;
}

export function fileObjectLockSink(storageUrl: string): ObjectLockSink {
  const parsed = new URL(storageUrl);
  if (parsed.protocol !== "file:") {
    throw new Error(`Unsupported OBJECT_STORAGE_URL protocol: ${parsed.protocol}`);
  }
  const root = fileURLToPath(parsed);
  return {
    async put(key, body) {
      const path = join(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body, { encoding: "utf8", flag: "wx" });
    },
  };
}

export interface AnchoredTenant extends RecordedTenant {
  objectLockKey: string | null;
  anchored: boolean;
}

export async function anchorRecordedHeads(
  recorded: RecordedTenant[],
  checkedAt: string,
  sink: ObjectLockSink,
  signKey: string
): Promise<AnchoredTenant[]> {
  const out: AnchoredTenant[] = [];
  for (const tenant of recorded) {
    if (!tenant.inserted) {
      out.push({ ...tenant, objectLockKey: null, anchored: false });
      continue;
    }
    const objectLockKey = chainHeadObjectKey(tenant.tenantId, tenant.day);
    const payload = canonicalChainHeadPayload({
      tenantId: tenant.tenantId,
      day: tenant.day,
      headHash: tenant.headHash,
      eventCount: tenant.eventCount,
      ok: tenant.ok,
      checkedAt,
    });
    const signature = signChainHead(payload, signKey);
    const document: ChainHeadDocument = {
      tenantId: tenant.tenantId,
      day: tenant.day,
      headHash: tenant.headHash,
      eventCount: tenant.eventCount,
      ok: tenant.ok,
      checkedAt,
      signature,
    };
    await sink.put(objectLockKey, `${JSON.stringify(document, null, 2)}\n`);
    out.push({ ...tenant, objectLockKey, anchored: true });
  }
  return out;
}
