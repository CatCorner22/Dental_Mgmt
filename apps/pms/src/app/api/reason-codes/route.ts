import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { addReasonCode, listReasonCodes, renameReasonCode, setReasonCodeActive } from "@/lib/ledger/reasonCodes";

/**
 * The practice's reason codes (Increment 1.45). Anyone who posts needs to read
 * them, because the posting forms are built from them; changing them is the
 * administrator's, as with the locations and the policy.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const items = await withTenantTransaction(user.tenantId, user.id, (db) => listReasonCodes(db, user.tenantId));
    return Response.json({ items });
  },
  { minRank: "user" }
);

export const POST = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const body = (await req.json().catch(() => null)) as
      | { action?: string; code?: string; kind?: string; label?: string }
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
        default:
          return null;
      }
    });

    if (!result) return Response.json({ error: "The action must be add, relabel, retire, or restore." }, { status: 400 });
    if (!result.ok) return Response.json({ error: result.code, verb: result.verb, why: result.why }, { status: result.status });
    return Response.json({ ok: true, row: result.row });
  },
  { minRank: "admin" }
);
