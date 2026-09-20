import { describe, expect, it } from "vitest";
import {
  INVITE_LIFE_DAYS,
  inviteUrl,
  inviteWorksUntil,
  packInviteRef,
  parseInviteRef,
  usernameProblem,
} from "./inviteLink";

/**
 * The shape of an invitation link (Increment 1.71).
 *
 * The rule worth proving is that nothing here decides anything: the reference
 * is parsed to shape before the practice id inside it is set as a
 * transaction's own, because a value of the wrong shape would fail as a cast
 * rather than as an answer and reach the reader as a broken page.
 */
const TENANT = "0196b0a0-0000-7000-8000-000000000001";
const SECRET = "a".repeat(43);

describe("parseInviteRef", () => {
  it("reads a reference this product could have issued", () => {
    expect(parseInviteRef(packInviteRef({ tenantId: TENANT, secret: SECRET }))).toEqual({
      tenantId: TENANT,
      secret: SECRET,
    });
  });

  it("refuses anything that is not one, rather than passing it to a cast", () => {
    expect(parseInviteRef("")).toBeNull();
    expect(parseInviteRef("not-a-uuid." + SECRET)).toBeNull();
    // The secret is a fixed 43 characters of base64url; one more or one fewer is not one.
    expect(parseInviteRef(`${TENANT}.${"a".repeat(42)}`)).toBeNull();
    expect(parseInviteRef(`${TENANT}.${"a".repeat(44)}`)).toBeNull();
    // Neither half may carry the separator, so a third segment is not a reference.
    expect(parseInviteRef(`${TENANT}.${SECRET}.more`)).toBeNull();
  });

  it("puts the whole reference in one path segment", () => {
    expect(inviteUrl("https://app.example/", { tenantId: TENANT, secret: SECRET })).toBe(
      `https://app.example/invite/${TENANT}.${SECRET}`
    );
  });
});

describe("inviteWorksUntil", () => {
  it("runs from the invitation, for a week", () => {
    const at = new Date("2026-03-01T00:00:00.000Z");
    expect(inviteWorksUntil(at).toISOString()).toBe("2026-03-08T00:00:00.000Z");
    expect(INVITE_LIFE_DAYS).toBe(7);
  });

  it("is far shorter than a stop link's life, because this secret opens an account", async () => {
    const { STOP_LIFE_DAYS } = await import("../notices/stopLink");
    expect(INVITE_LIFE_DAYS).toBeLessThan(STOP_LIFE_DAYS);
  });
});

describe("usernameProblem", () => {
  it("accepts what somebody can be told over the phone and type at a sign-in box", () => {
    expect(usernameProblem("firm-accounting")).toBeNull();
    expect(usernameProblem("abc")).toBeNull();
  });

  it("refuses anything that would make 'the same username' a question with two answers", () => {
    // The unique index folds nothing, so case and spaces cannot be allowed.
    expect(usernameProblem("Firm-Accounting")).not.toBeNull();
    expect(usernameProblem("firm accounting")).not.toBeNull();
    expect(usernameProblem("-leading-hyphen")).not.toBeNull();
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("a".repeat(41))).not.toBeNull();
  });
});
