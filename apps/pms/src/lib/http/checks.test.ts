import { describe, expect, it } from "vitest";
import { expectedOrigin, originAllowed, requestSurfaceOk } from "./checks";

/**
 * Next.js hands route handlers a `req.url` built from its own listen
 * address (http://localhost:3000/...), whatever hostname the browser used.
 * The same-origin check must therefore read the request's Host header, not
 * `req.url`, or every browser write behind a real hostname is refused.
 */
function post(headers: Record<string, string>, url = "http://localhost:3000/api/controls/grants"): Request {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers } });
}

describe("originAllowed", () => {
  it("accepts the origin the request arrived at, read from Host, not from req.url", () => {
    const req = post({ host: "pms.example.com", origin: "http://pms.example.com" });
    expect(expectedOrigin(req, {})).toBe("http://pms.example.com");
    expect(originAllowed(req, undefined, {})).toBe(true);
    expect(originAllowed(post({ host: "127.0.0.1:3333", origin: "http://127.0.0.1:3333" }), undefined, {})).toBe(true);
  });

  it("refuses a different origin, and a malformed one", () => {
    expect(originAllowed(post({ host: "pms.example.com", origin: "http://evil.example" }), undefined, {})).toBe(false);
    expect(originAllowed(post({ host: "pms.example.com", origin: "https://pms.example.com" }), undefined, {})).toBe(false);
    expect(originAllowed(post({ host: "pms.example.com", origin: "not a url" }), undefined, {})).toBe(false);
  });

  it("honours a trusted proxy's forwarded host and scheme, and ignores them when told not to", () => {
    const behindTls = post({
      host: "10.0.0.5:3000",
      "x-forwarded-host": "pms.example.com",
      "x-forwarded-proto": "https",
      origin: "https://pms.example.com",
    });
    expect(originAllowed(behindTls, undefined, {})).toBe(true);
    expect(originAllowed(behindTls, undefined, { TRUST_PROXY_HEADERS: "auto" })).toBe(true);
    expect(originAllowed(behindTls, undefined, { TRUST_PROXY_HEADERS: "none" })).toBe(false);
    // A forwarded header may carry a chain; the first hop is the client-facing one.
    const chain = post({
      host: "10.0.0.5:3000",
      "x-forwarded-host": "pms.example.com, edge.internal",
      "x-forwarded-proto": "https, http",
      origin: "https://pms.example.com",
    });
    expect(originAllowed(chain, undefined, {})).toBe(true);
  });

  it("lets APP_ORIGIN pin the one allowed origin over every header", () => {
    const env = { APP_ORIGIN: "https://pms.example.com/" };
    expect(originAllowed(post({ host: "pms.example.com", origin: "https://pms.example.com" }), undefined, env)).toBe(true);
    expect(originAllowed(post({ host: "pms.example.com", origin: "http://pms.example.com" }), undefined, env)).toBe(false);
    expect(originAllowed(post({ host: "other.example", origin: "https://pms.example.com" }), undefined, env)).toBe(true);
  });

  it("lets a request without an Origin header through to the sec-fetch-site check", () => {
    expect(originAllowed(post({ host: "pms.example.com" }), undefined, {})).toBe(true);
    expect(requestSurfaceOk(post({ host: "pms.example.com", "sec-fetch-site": "cross-site" }), {})).toEqual({
      ok: false,
      status: 403,
      error: "Cross-site request refused.",
    });
  });
});

describe("requestSurfaceOk", () => {
  it("refuses a write without a JSON or form body type, and an oversized body", () => {
    const bare = new Request("http://localhost:3000/api/x", { method: "POST", headers: { host: "localhost:3000" } });
    expect(requestSurfaceOk(bare, {})).toEqual({ ok: false, status: 415, error: "Content-Type is not accepted." });
    const big = post({ host: "localhost:3000", "content-length": String(65 * 1024) });
    expect(requestSurfaceOk(big, {})).toEqual({ ok: false, status: 413, error: "Body is too large." });
    expect(requestSurfaceOk(post({ host: "localhost:3000", origin: "http://localhost:3000" }), {})).toEqual({ ok: true });
  });

  it("lets a read through without a content type", () => {
    const get = new Request("http://localhost:3000/api/x", { headers: { host: "pms.example.com", origin: "http://pms.example.com" } });
    expect(requestSurfaceOk(get, {})).toEqual({ ok: true });
  });
});
