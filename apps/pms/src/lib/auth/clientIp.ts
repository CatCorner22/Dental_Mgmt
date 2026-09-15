export const TRUSTED_PROXY_HOPS = Math.max(
  1,
  Math.trunc(Number(process.env.TRUSTED_PROXY_HOPS)) || 1
);

const TRUST_HEADERS = (process.env.TRUST_PROXY_HEADERS ?? "auto").toLowerCase() !== "none";

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function isIpv4(s: string): boolean {
  const m = IPV4.exec(s);
  return m !== null && m.slice(1).every((o) => o.length <= 3 && Number(o) <= 255);
}

function isIpv6(s: string): boolean {
  if (s.length > 45 || !/^[0-9a-fA-F:]*$/.test(s)) return false;
  const doubleColons = s.split("::").length - 1;
  if (doubleColons > 1) return false;
  const groups = s.split(":").filter((g) => g !== "");
  if (groups.length === 0 || groups.length > 8) return false;
  if (doubleColons === 0 && s.split(":").length !== 8) return false;
  return groups.every((g) => g.length <= 4);
}

export function normalizeIp(raw: string): string | null {
  let s = raw.trim();
  if (!s || s.length > 60) return null;
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(s);
  if (bracketed) s = bracketed[1]!;
  const pct = s.indexOf("%");
  if (pct !== -1) s = s.slice(0, pct);
  if (isIpv6(s)) return s.toLowerCase();
  const v4port = /^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/.exec(s);
  if (v4port) s = v4port[1]!;
  return isIpv4(s) ? s : null;
}

function proxyOwnedToken(v: string | null | undefined): string | null {
  if (!v) return null;
  const parts = v.split(",");
  return normalizeIp(parts[parts.length - 1]!);
}

export function clientIp(req: Request | undefined): string | null {
  if (!req || !TRUST_HEADERS) return null;
  const vercel = proxyOwnedToken(req.headers.get("x-vercel-forwarded-for"));
  if (vercel) return vercel;
  const real = proxyOwnedToken(req.headers.get("x-real-ip"));
  if (real) return real;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",");
    const idx = parts.length - TRUSTED_PROXY_HOPS;
    if (idx >= 0) return normalizeIp(parts[idx]!);
  }
  return null;
}
