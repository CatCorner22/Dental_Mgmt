import { describe, expect, it } from "vitest";
import { clientIp, normalizeIp } from "./clientIp";

describe("clientIp", () => {
  it("strips an ephemeral port from a forwarded v4 address", () => {
    expect(normalizeIp("203.0.113.5:44321")).toBe("203.0.113.5");
  });

  it("reads x-real-ip from the last token", () => {
    const req = new Request("http://localhost/signin", {
      headers: { "x-real-ip": "203.0.113.9" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });
});
