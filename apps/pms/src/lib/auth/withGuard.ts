import { requestSurfaceOk } from "../http/checks";
import { requireAccess } from "./requireAccess";
import type { AuthPorts } from "./ports";
import type { AccessOpts } from "./types";

export type AppRouteHandler = (
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
): AppRouteHandler {
  return async (req, ctx) => {
    const surface = requestSurfaceOk(req);
    if (!surface.ok) {
      return Response.json({ error: surface.error }, { status: surface.status });
    }
    if (!ports) {
      return Response.json(
        { error: "Authorization ports are not configured." },
        { status: 503 }
      );
    }
    const access = await requireAccess(req, opts, ports);
    if (!access.ok) return access.response;
    return handler(req, ctx);
  };
}
