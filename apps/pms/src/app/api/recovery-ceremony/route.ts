import { withGuard } from "@/lib/auth/withGuard";
import { initiateRecoveryCeremony } from "@/lib/auth/recoveryCeremony";
import { eligibleAdmins, loadMembers, openCeremonies, regainCandidates, regainRefusal, regainStanding } from "@/lib/auth/regainAccess";
import { withTenantTransaction } from "@/lib/db/client";
import { getAuthStore } from "@/lib/auth/resolveStore";

type Body = { targetUserId?: unknown; totp?: unknown };

/**
 * What this practice can do about somebody locked out (Increment 1.77).
 *
 * Manager rank reads it and administrator rank acts on it, which is the same
 * split Practice Risk holds everywhere else: the page that shows a practice
 * its controls is not the page that changes them. A manager sees who is
 * reachable, what is waiting, and who may act — enough to know whom to ask.
 */
export const GET = withGuard(
  async (_req, ctx) => {
    const user = ctx.access.user;
    const now = new Date();
    const { members, open } = await withTenantTransaction(user.tenantId, user.id, async (db) => ({
      members: await loadMembers(db, user.tenantId),
      open: await openCeremonies(db, user.tenantId, user.id, now),
    }));
    const eligible = eligibleAdmins(members);
    return Response.json({
      candidates: regainCandidates(members, user.id),
      open,
      eligibleAdmins: eligible,
      refusal: regainRefusal(eligible),
      standing: regainStanding(eligible, open.length),
      asOf: now.toISOString(),
    });
  },
  { minRank: "manager" }
);

/**
 * Starts a recovery: an administrator names the person and proves their own
 * second factor.
 *
 * The count of administrators who could take a part is read here and handed to
 * the act, so a practice with fewer than two is refused before a ceremony
 * exists. `approveRecoveryCeremony` refuses the initiator, so without this
 * check a single-administrator practice would open ceremonies that nobody
 * alive could approve.
 */
export const POST = withGuard(
  async (req, ctx) => {
    const store = await getAuthStore();
    if (!store) {
      return Response.json({ error: "Authorization store is not configured." }, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as Body;
    const targetUserId = typeof body.targetUserId === "string" ? body.targetUserId : "";
    const totp = typeof body.totp === "string" ? body.totp.trim() : "";
    if (!targetUserId || !totp) {
      return Response.json({ error: "targetUserId and totp are required." }, { status: 400 });
    }
    const initiator = await store.getUserById(ctx.access.user.id);
    if (!initiator) {
      return Response.json({ error: "This account is not active." }, { status: 403 });
    }
    const members = await withTenantTransaction(initiator.tenantId, initiator.id, (db) =>
      loadMembers(db, initiator.tenantId)
    );
    const eligible = eligibleAdmins(members);
    const result = await initiateRecoveryCeremony(
      store,
      initiator,
      targetUserId,
      totp,
      eligible,
      new Date()
    );
    if (!result.ok) {
      /**
       * The one refusal a practice can act on gets its own sentences; every
       * other reason is answered alike, because telling a wrong code apart
       * from a wrong person only helps somebody guessing.
       */
      if (result.reason === "no_second_admin") {
        return Response.json({ error: "This practice cannot run a recovery.", refusal: regainRefusal(eligible) }, { status: 409 });
      }
      return Response.json({ error: "Could not start recovery." }, { status: 400 });
    }
    return Response.json({ ok: true, ceremonyId: result.ceremonyId });
  },
  { minRank: "admin" }
);
