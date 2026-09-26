import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { addReasonCode, listReasonCodes, renameReasonCode, setReasonCodeActive, setReasonThreshold } from "@/lib/ledger/reasonCodes";
import { isRole, type Role } from "@/lib/auth/roles";
import { reasonCodesForViewer } from "@/lib/ledger/reasons";

/**
 * The practice's reason codes (Increment 1.45). Anyone who posts needs to read
 * them, because the posting forms are built from them; changing them is the
 * administrator's, as with the locations and the policy.
 *
 * What "them" means depends on the rank (Increment 1.103). The forms are built
 * from the code, the kind, the label and whether it is live. The approval
 * threshold and the entry count are the practice's governance of its own
 * reasons, they reach a screen only at `manager` and above, and the threshold
 * is the line under which a write-off gets no second pair of eyes — so the
 * rank that posts receives the list its forms need and nothing further.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const rows = await withTenantTransaction(user.tenantId, user.id, (db) => listReasonCodes(db, user.tenantId));
    /**
     * A rank this product does not have reads as the narrower answer rather
     * than throwing: `withGuard` has already decided the seat may be here, and
     * the safe reading of an unfamiliar label is the one that gives less.
     */
    const rank: Role = isRole(user.role) ? user.role : "user";
    return Response.json({ items: reasonCodesForViewer(rows, rank) });
  },
  { minRank: "user" }
);

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => null)) as
      | {
          action?: string;
          code?: string;
          kind?: string;
          label?: string;
          cents?: number | null;
          decision?: { kind: string; note: string; reviewBy?: string };
        }
      | null;
    if (!body?.action || !body.code) {
      return Response.json({ error: "An action and a code are required." }, { status: 400 });
    }
    const actor = { id: user.id, name: user.displayName };
    const code = body.code;

    const result = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      switch (body.action) {
        case "add":
          return addReasonCode(db, { tenantId: user.tenantId, actor, code, kind: body.kind ?? "", label: body.label ?? "" });
        case "relabel":
          return renameReasonCode(db, { tenantId: user.tenantId, actor, code, label: body.label ?? "" });
        case "retire":
          return setReasonCodeActive(db, { tenantId: user.tenantId, actor, code, active: false });
        case "restore":
          return setReasonCodeActive(db, { tenantId: user.tenantId, actor, code, active: true });
        case "threshold":
          return setReasonThreshold(db, { tenantId: user.tenantId, actor, code, cents: body.cents ?? null, decision: body.decision });
        default:
          return null;
      }
    });

    if (!result) return Response.json({ error: "The action must be add, relabel, retire, restore, or threshold." }, { status: 400 });
    if (!result.ok) return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    return Response.json({ ok: true, row: result.row });
  },
  { minRank: "admin" }
);
