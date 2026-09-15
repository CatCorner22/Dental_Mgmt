const SENSITIVE_KEY =
  /(password|secret|token|email|phone|patient|recipient|displayname|username|hash|payload|document)/i;

/** Strips likely PHI and secrets from a domain_event payload before aggregation. */
export function redactEventPayload(kind: string, payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { kind };
  }
  const input = payload as Record<string, unknown>;
  const out: Record<string, unknown> = { kind };
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (typeof value === "string" && value.length > 64) continue;
    if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    if (typeof value === "string") out[key] = value;
  }
  return out;
}
