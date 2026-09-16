import { describe, expect, it } from "vitest";
import { loginFailureMessage, sanitizeCallbackPath } from "./loginFormState";

describe("sanitizeCallbackPath", () => {
  it("keeps a same-origin path", () => {
    expect(sanitizeCallbackPath("/home")).toBe("/home");
  });

  it("strips an absolute URL down to its path", () => {
    expect(sanitizeCallbackPath("https://evil.example/phish")).toBe("/phish");
  });

  it("refuses protocol-relative and javascript URLs", () => {
    expect(sanitizeCallbackPath("//host/x")).toBe("/home");
    expect(sanitizeCallbackPath("javascript:alert(1)")).toBe("/home");
  });
});

describe("loginFailureMessage", () => {
  it("never names the failure reason", () => {
    const message = loginFailureMessage(true, true, 3);
    expect(message).toMatch(/username, password, and authenticator code/);
    expect(message).toMatch(/wait a few minutes/);
    expect(message).not.toMatch(/unknown|locked|wrong password/i);
  });
});
