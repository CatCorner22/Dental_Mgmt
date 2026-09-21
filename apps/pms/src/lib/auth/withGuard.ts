import { requestSurfaceOk } from "../http/checks";
import { requireAccess } from "./requireAccess";
import { getAuthPorts } from "./resolveStore";
import { getSessionIdFromAuth } from "./sessionId";
import type { AuthPorts } from "./ports";
import type { AccessOpts, FreshUser, SessionRow } from "./types";

export type GuardContext = {
  params: Promise<Record<string, string | string[]>>;
  access: { user: FreshUser; session: SessionRow };
};

export type AppRouteHandler = (
  req: Request,
  ctx: GuardContext
) => Promise<Response> | Response;

type NextRouteHandler = (
  req: Request,
  ctx: { params: Promise<Record<string, string | string[]>> }
) => Promise<Response> | Response;

/**
 * A guarded answer is correct only while the session that earned it lives, so
 * it is never stored (Increment 1.81).
 *
 * Found by a browser case, not by reading: a case cleared its cookies, reloaded
 * the practice home, and watched the server render a signed-out header while
 * `fetch("/api/me")` came back 200 with the owner's name, username, rank and
 * grants. No cookie went with that request. The answer came out of the
 * browser's own HTTP cache, where an earlier 200 had been left because nothing
 * said not to leave it there.
 *
 * That is the shape of it on a shared front-desk machine: sign out, hand the
 * keyboard over, and the next person's browser can still be handed the last
 * person's guarded answers. Every route behind this wrapper reads tenant rows
 * under a session, so the wrapper is where the rule belongs rather than on the
 * one route that happened to expose it.
 *
 * `no-store` rather than `no-cache`: `no-cache` permits storing and requires
 * revalidation, which is a promise about a request that a cache is free to
 * skip when it cannot reach the server. Nothing guarded should rest on disk.
 */
function unstored(res: Response): Response {
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * Default-deny wrapper for every route handler and server action.
 * Session → fresh user row → tenant scope → SET LOCAL → origin checks →
 * optional PHI access log → typed 401/403.
 */
export function withGuard(
  handler: AppRouteHandler,
  opts: AccessOpts = {},
  ports?: AuthPorts
): NextRouteHandler {
  return async (req, ctx) => {
    const surface = requestSurfaceOk(req, process.env);
    if (!surface.ok) {
      return unstored(Response.json({ error: surface.error }, { status: surface.status }));
    }
    const resolved = ports ?? (await getAuthPorts(getSessionIdFromAuth));
    if (!resolved) {
      return unstored(
        Response.json({ error: "Authorization ports are not configured." }, { status: 503 })
      );
    }
    const access = await requireAccess(req, opts, resolved);
    if (!access.ok) return unstored(access.response);
    return unstored(await handler(req, { ...ctx, access: { user: access.user, session: access.session } }));
  };
}
