import { CPA_SEAT_ENTITLEMENT, isCpaSeat } from "@/lib/auth/seats";
import { isRole } from "@/lib/auth/roles";
import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { attestChannelMonth, listMonthAttestations, type AttestationSeat } from "@/lib/controls/attestations";

/**
 * Who reviewed each channel the product cannot enforce, for one month
 * (Increment 1.51). The Practice Risk coverage table reads it, and the
 * month-end package carries it, so whoever may read either may read this.
 *
 * The seat is read from the signed-in user rather than the request body: an
 * attestation the practice makes about its own external channel is worth less
 * than one an independent reader makes, so it is not the caller's to assert.
 */
function seatOf(user: { role: string; entitlements: string[] }): AttestationSeat {
  const role = isRole(user.role) ? user.role : undefined;
  return role && isCpaSeat({ role, entitlements: user.entitlements }) ? "accountant" : "practice";
}

export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const month = new URL(req.url).searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
    const items = await withTenantTransaction(user.tenantId, user.id, (db) => listMonthAttestations(db, user.tenantId, month));
    return Response.json({ month, items, seat: seatOf(user) });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => null)) as { month?: string; channel?: string; note?: string } | null;
    if (!body?.channel) return Response.json({ error: "A channel is required." }, { status: 400 });

    const result = await withTenantTransaction(user.tenantId, user.id, (db) =>
      attestChannelMonth(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        seat: seatOf(user),
        month: body.month ?? "",
        channel: body.channel!,
        note: body.note ?? "",
      })
    );
    if (!result.ok) return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    return Response.json({ ok: true, attestation: result.attestation });
  },
  { minRank: "manager", orEntitlement: CPA_SEAT_ENTITLEMENT }
);
