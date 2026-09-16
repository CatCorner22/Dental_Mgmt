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
      return Response.json({ error: surface.error }, { status: surface.status });
    }
    const resolved = ports ?? (await getAuthPorts(getSessionIdFromAuth));
    if (!resolved) {
      return Response.json(
        { error: "Authorization ports are not configured." },
        { status: 503 }
      );
    }
    const access = await requireAccess(req, opts, resolved);
    if (!access.ok) return access.response;
    return handler(req, { ...ctx, access: { user: access.user, session: access.session } });
  };
}
