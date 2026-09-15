const MAX_BODY_BYTES = 64 * 1024;

export function originAllowed(req: Request, allowedOrigin?: string): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  if (allowedOrigin) return origin === allowedOrigin;
  try {
    return new URL(origin).origin === new URL(req.url).origin;
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

export function requestSurfaceOk(req: Request, allowedOrigin?: string): { ok: true } | { ok: false; status: number; error: string } {
  if (!originAllowed(req, allowedOrigin)) {
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
