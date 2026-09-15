import { createHash } from "node:crypto";

/** Builds a stable idempotency key for a posting attempt. */
export function buildIdempotencyKey(parts: Record<string, string | number | null | undefined>): string {
  const serialized = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ""}`)
    .join("&");
  return createHash("sha256").update(serialized).digest("hex").slice(0, 32);
}

export function isIdempotentDuplicate(error: unknown): boolean {
  const pg = error as { code?: string; constraint?: string };
  return pg.code === "23505" && (pg.constraint?.includes("idempotency") ?? false);
}
