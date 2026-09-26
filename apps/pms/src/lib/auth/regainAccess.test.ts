import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  eligibleAdmins,
  isEligibleAdmin,
  regainCandidates,
  regainRefusal,
  regainStanding,
  type MemberRow,
} from "./regainAccess";

const enrolledAt = new Date("2026-01-04T09:00:00.000Z");

function member(over: Partial<MemberRow> & Pick<MemberRow, "id">): MemberRow {
  return {
    username: `user-${over.id}`,
    displayName: `Person ${over.id}`,
    role: "user",
    active: true,
    mfaSecretEnc: { v: 1 },
    mfaEnrolledAt: enrolledAt,
    recoveryCodesHash: JSON.stringify(["a", "b", "c"]),
    ...over,
  };
}

describe("who may take a part in a recovery", () => {
  it("counts an administrator who carries a factor they can prove", () => {
    expect(isEligibleAdmin(member({ id: "1", role: "admin" }))).toBe(true);
  });

  it("does not count an administrator whose own factor is gone", () => {
    // `totpOk` in recoveryCeremony.ts refuses them, so counting them would
    // promise a second pair of hands that refuses on submit.
    expect(isEligibleAdmin(member({ id: "1", role: "admin", mfaSecretEnc: null }))).toBe(false);
    expect(isEligibleAdmin(member({ id: "1", role: "admin", mfaEnrolledAt: null }))).toBe(false);
  });

  it("does not count somebody who is not an administrator, whatever their factor", () => {
    expect(isEligibleAdmin(member({ id: "1", role: "manager" }))).toBe(false);
  });

  it("does not count an administrator who has left", () => {
    expect(isEligibleAdmin(member({ id: "1", role: "admin", active: false }))).toBe(false);
  });

  it("counts across the practice", () => {
    const rows = [
      member({ id: "1", role: "admin" }),
      member({ id: "2", role: "admin" }),
      member({ id: "3", role: "admin", mfaEnrolledAt: null }),
      member({ id: "4", role: "manager" }),
    ];
    expect(eligibleAdmins(rows)).toBe(2);
  });
});

describe("the refusal a practice that cannot run this reads", () => {
  it("says nothing where two administrators can act", () => {
    expect(regainRefusal(2)).toBeNull();
  });

  it("names the rule, this practice's number, and the one thing that would change it", () => {
    const said = regainRefusal(1);
    expect(said).toHaveLength(3);
    expect(said?.[0]).toContain("two administrators");
    expect(said?.[1]).toContain("one administrator");
    expect(said?.[2]).toContain("Appoint a second administrator");
  });

  /**
   * Increment 1.75 answered the same shape with a governed exception. This
   * control gets none, and the refusal says so out loud: a reader who has met
   * the GL mapping exception must not be left expecting one here.
   */
  it("says there is no recorded exception, and why", () => {
    expect(regainRefusal(1)?.[2]).toContain("no recorded exception");
    expect(regainRefusal(0)?.[2]).toContain("maker-checker");
  });

  it("tells a practice with no eligible administrator apart from one with a single one", () => {
    expect(regainRefusal(0)?.[1]).not.toEqual(regainRefusal(1)?.[1]);
    expect(regainRefusal(0)?.[1]).toContain("no administrator");
  });
});

describe("who the practice could bring back", () => {
  const rows = [
    member({ id: "b", displayName: "Brooke Ellery", role: "admin" }),
    member({ id: "a", displayName: "Avery Nkemdi", recoveryCodesHash: JSON.stringify([]) }),
    member({ id: "c", displayName: "Casey Odili", mfaSecretEnc: null, mfaEnrolledAt: null }),
    member({ id: "d", displayName: "Devon Marr", active: false }),
  ];

  it("leaves out the viewer, whom the act refuses anyway", () => {
    expect(regainCandidates(rows, "b").map((c) => c.userId)).toEqual(["a", "c"]);
  });

  it("leaves out somebody who has left the practice", () => {
    expect(regainCandidates(rows, "zzz").some((c) => c.userId === "d")).toBe(false);
  });

  it("reads in the order a person would look for a name", () => {
    expect(regainCandidates(rows, "zzz").map((c) => c.displayName)).toEqual([
      "Avery Nkemdi",
      "Brooke Ellery",
      "Casey Odili",
    ]);
  });

  it("says whether a factor stands and how many codes are left, which is what names the lockout", () => {
    const [avery, , casey] = regainCandidates(rows, "zzz");
    expect(avery).toMatchObject({ enrolled: true, codesLeft: 0 });
    expect(casey).toMatchObject({ enrolled: false, codesLeft: 3 });
  });

  it("reads a missing or unreadable code column as none left rather than throwing", () => {
    const odd = [
      member({ id: "x", recoveryCodesHash: null }),
      member({ id: "y", recoveryCodesHash: "not json" }),
      member({ id: "z", recoveryCodesHash: '"a string"' }),
    ];
    expect(regainCandidates(odd, "none").map((c) => c.codesLeft)).toEqual([0, 0, 0]);
  });
});

describe("the sentence a practice that can run this reads", () => {
  it("says nothing is waiting where nothing is", () => {
    expect(regainStanding(2, 0)).toContain("Nothing is waiting");
  });

  it("counts what waits, in singular and plural", () => {
    expect(regainStanding(3, 1)).toContain("One recovery is waiting");
    expect(regainStanding(3, 2)).toContain("2 recoveries are waiting");
  });
});


const srcDir = fileURLToPath(new URL("../../", import.meta.url));

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/**
 * The one premise the two-administrator rule now rests on (Increment 1.99).
 *
 * The argument above `regainAccess.ts` used to rest on three claims about what
 * one administrator can do alone, and Increments 1.78 and 1.79 made two of
 * them false: a rank can be changed and a person can be stood down. Both of
 * those acts take something away. Neither is *becoming* that person, which is
 * the power the rule withholds.
 *
 * Becoming them needs their password, so the argument now rests on this: the
 * only thing that sets another person's password is the recovery ceremony,
 * which needs two administrators. A one-administrator password reset anywhere
 * in this codebase would make the whole argument false, so this reads the
 * source and says so rather than letting the next reader find a comment that
 * has quietly stopped being true.
 */
describe("the premise the two-administrator rule rests on", () => {
  it("has exactly one caller of setPassword, and it is the recovery ceremony", () => {
    const callers = filesUnder(srcDir)
      .filter((f) => !/\.test\.tsx?$/.test(f))
      .filter((f) => /\.setPassword\(/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(srcDir.length))
      .sort();
    expect(callers).toEqual(["lib/auth/recoveryCeremony.ts"]);
  });

  /**
   * `claimSeat` writes a password too, and it is the claimant setting their
   * own from a link only they hold — not one person setting another's. It
   * writes the column directly rather than through the store, which is why it
   * does not appear above; this names it so the omission reads as known.
   */
  it("knows the other writer of a password, and that it is the person's own", () => {
    const invite = readFileSync(join(srcDir, "lib/auth/invite.ts"), "utf8");
    expect(invite).toMatch(/passwordHash: await hashPassword\(password\)/);
    expect(invite).toMatch(/claimSeat/);
  });
});
