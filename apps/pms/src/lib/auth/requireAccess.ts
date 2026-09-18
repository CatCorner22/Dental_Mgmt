import { isDisclosureChannel, isDisclosurePurpose } from "@pms/db";
import { meetsRole } from "./roles";
import { IDLE_MS } from "./ports";
import type { AuthPorts } from "./ports";
import type { AccessOpts, AccessResult } from "./types";

function deny(status: number, error: string): AccessResult {
  return { ok: false, response: Response.json({ error }, { status }) };
}

export async function requireAccess(
  req: Request,
  opts: AccessOpts,
  ports: AuthPorts,
  now: Date = new Date()
): Promise<AccessResult> {
  const sessionId = await ports.getSessionId(req);
  if (!sessionId) return deny(401, "Not signed in.");

  const session = await ports.getSession(sessionId);
  if (!session || session.revokedAt) return deny(401, "This session was ended. Sign in again.");
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) {
    return deny(401, "This session has expired. Sign in again.");
  }
  if (session.idleExpiresAt.getTime() <= now.getTime()) {
    return deny(401, "This session timed out. Sign in again.");
  }

  const user = await ports.getUser(session.userId);
  if (!user || !user.active) return deny(403, "This account is not active.");
  if (user.tenantId !== session.tenantId) return deny(403, "You do not have access to this action.");

  if (opts.requireMfa !== false && !user.mfaEnrolledAt) {
    return deny(403, "MFA enrollment is required before this account may continue.");
  }

  if (opts.minRank && !meetsRole(user.role, opts.minRank)) {
    // A grant may open the route in the rank's place (Increment 1.49).
    const opened = opts.orEntitlement !== undefined && user.entitlements.includes(opts.orEntitlement);
    if (!opened) return deny(403, "You do not have access to this action.");
  }

  if (opts.entitlements?.length) {
    const have = new Set(user.entitlements);
    const missing = opts.entitlements.filter((e) => !have.has(e));
    if (missing.length) return deny(403, "You do not have access to this action.");
  }

  await ports.setTenantContext(user.tenantId, user.id);
  const idle = IDLE_MS[session.deviceProfile];
  await ports.touchSession(session.id, now, new Date(now.getTime() + idle));

  if (opts.phiRead) {
    await ports.logPhiAccess({
      tenantId: user.tenantId,
      userId: user.id,
      purpose: opts.phiRead.purpose,
      recordKind: opts.phiRead.kind,
      recordIds: opts.phiRead.ids,
      at: now,
    });
  }

  if (opts.disclosure) {
    const { disclosure } = opts;
    if (!isDisclosureChannel(disclosure.channel)) {
      return deny(400, "Disclosure channel is not allowed.");
    }
    if (!isDisclosurePurpose(disclosure.purpose)) {
      return deny(400, "Disclosure purpose is not allowed.");
    }
    if (!disclosure.recordIds.length) {
      return deny(400, "Disclosure must name at least one record.");
    }
    await ports.recordDisclosure({
      tenantId: user.tenantId,
      patientId: disclosure.patientId,
      channel: disclosure.channel,
      recipient: disclosure.recipient.trim(),
      recordIds: disclosure.recordIds,
      purpose: disclosure.purpose,
      actorUserId: user.id,
      actorName: user.displayName,
      documentId: disclosure.documentId ?? null,
      at: now,
    });
  }

  return { ok: true, user, session };
}
