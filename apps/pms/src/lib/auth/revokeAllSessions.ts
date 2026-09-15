import type { AuthStore } from "./store";

export interface RevokeAllSessionsResult {
  revoked: number;
}

/**
 * Incident-response helper: end every live session in the tenant and record
 * the action in the append-only event stream.
 */
export async function revokeAllSessionsForTenant(
  store: AuthStore,
  input: { tenantId: string; actorUserId: string; reason: string; at: Date }
): Promise<RevokeAllSessionsResult> {
  const revoked = await store.revokeSessionsForTenant(input.tenantId, input.at);
  await store.appendDomainEvent({
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    kind: "auth.sessions_revoked_all",
    payload: { reason: input.reason, revoked },
    at: input.at,
  });
  return { revoked };
}
