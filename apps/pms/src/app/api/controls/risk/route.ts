import { withGuard } from "@/lib/auth/withGuard";
import { withTenantTransaction } from "@/lib/db/client";
import { computeSnapshot, latestSnapshot, takeSnapshot } from "@/lib/controls/snapshots";

/**
 * Practice Risk: residual portfolio, COSO, leading indicators, tornado,
 * channel coverage, and decision coverage. Returns the last frozen
 * snapshot; `?fresh=1` recomputes from live rows without writing.
 */
export const GET = withGuard(
  async (req, ctx) => {
    const user = ctx.access.user;
    const fresh = new URL(req.url).searchParams.get("fresh") === "1";
    const out = await withTenantTransaction(user.tenantId, user.id, async (db) => {
      if (!fresh) {
        const stored = await latestSnapshot(db, user.tenantId);
        if (stored) return { source: "stored" as const, ...stored };
      }
      const { snapshot } = await computeSnapshot(db, user.tenantId);
      return { source: "live" as const, id: null, takenAt: snapshot.takenAt, trigger: "live", snapshot };
    });
    return Response.json(out);
  },
  { minRank: "manager" }
);

/** Freezes a snapshot and refreshes the findings table. */
export const POST = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const stored = await withTenantTransaction(user.tenantId, user.id, async (db) =>
      takeSnapshot(db, {
        tenantId: user.tenantId,
        actor: { id: user.id, name: user.displayName },
        trigger: "manual",
      })
    );
    return Response.json({ source: "stored", ...stored }, { status: 201 });
  },
  { minRank: "admin" }
);
