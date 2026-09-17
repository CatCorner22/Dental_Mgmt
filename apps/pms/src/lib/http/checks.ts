const MAX_BODY_BYTES = 64 * 1024;

type Env = Record<string, string | undefined>;

/** Mirrors clientIp.ts: proxy headers are trusted unless TRUST_PROXY_HEADERS=none. */
function trustsProxyHeaders(env: Env): boolean {
  return (env.TRUST_PROXY_HEADERS ?? "auto").toLowerCase() !== "none";
}

function firstToken(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first ? first : null;
}

/**
 * The origin the browser must have sent the request from, read from the
 * request itself: the Host header (or X-Forwarded-Host and X-Forwarded-Proto
 * from a trusted proxy), never from `req.url`. Next.js builds `req.url` from
 * its own listen address, so behind any hostname other than localhost that
 * origin never matches what the browser sends.
 */
export function expectedOrigin(req: Request, env: Env = process.env): string | null {
  const trust = trustsProxyHeaders(env);
  const host = firstToken(trust ? req.headers.get("x-forwarded-host") : null) ?? firstToken(req.headers.get("host"));
  if (!host) return null;
  let proto = firstToken(trust ? req.headers.get("x-forwarded-proto") : null);
  if (!proto) {
    try {
      proto = new URL(req.url).protocol.replace(/:$/, "");
    } catch {
      return null;
    }
  }
  return `${proto}://${host}`.toLowerCase();
}

/**
 * Same-origin check for state-changing requests. APP_ORIGIN, when set, is
 * the one origin allowed and wins over every header. Otherwise the Origin
 * header must equal the origin the request arrived at.
 */
export function originAllowed(req: Request, allowedOrigin?: string, env: Env = process.env): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  let sent: string;
  try {
    sent = new URL(origin).origin.toLowerCase();
  } catch {
    return false;
  }
  const allowed = allowedOrigin ?? env.APP_ORIGIN;
  if (allowed) return sent === allowed.replace(/\/+$/, "").toLowerCase();
  const expected = expectedOrigin(req, env);
  if (expected) return sent === expected;
  try {
    return sent === new URL(req.url).origin.toLowerCase();
  } catch {
    return false;
  }
}

export function fetchSiteOk(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (!site) return true;
  return site === "same-origin" || site === "same-site" || site === "none";
}

export function contentTypeOk(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return true;
  const type = req.headers.get("content-type") ?? "";
  return (
    type.includes("application/json") ||
    type.includes("application/x-www-form-urlencoded") ||
    type.includes("multipart/form-data")
  );
}

export function bodySizeOk(req: Request): boolean {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (!Number.isFinite(len) || len < 0) return false;
  return len <= MAX_BODY_BYTES;
}

export function requestSurfaceOk(
  req: Request,
  env: Env = process.env
): { ok: true } | { ok: false; status: number; error: string } {
  if (!originAllowed(req, undefined, env)) {
    return { ok: false, status: 403, error: "Origin is not allowed." };
  }
  if (!fetchSiteOk(req)) {
    return { ok: false, status: 403, error: "Cross-site request refused." };
  }
  if (!contentTypeOk(req)) {
    return { ok: false, status: 415, error: "Content-Type is not accepted." };
  }
  if (!bodySizeOk(req)) {
    return { ok: false, status: 413, error: "Body is too large." };
  }
  return { ok: true };
}
