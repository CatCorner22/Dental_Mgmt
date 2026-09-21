import { describe, expect, it } from "vitest";
import { parseRegainRef, regainUrl } from "./regainLink";

const CEREMONY = "018f2a10-4c3b-7d21-9e44-5f6a7b8c9d0e";
const SECRET = "A".repeat(43);
const TOKEN = `${CEREMONY}.${SECRET}`;

describe("the shape of a recovery link", () => {
  it("reads a token this product could have issued", () => {
    expect(parseRegainRef(TOKEN)).toBe(TOKEN);
  });

  it("ignores the whitespace a person pastes around it", () => {
    expect(parseRegainRef(`  ${TOKEN}\n`)).toBe(TOKEN);
  });

  it("refuses anything of another shape, before a row is looked up", () => {
    // Checked first so a wrong value reaches the reader as a sentence rather
    // than as a failed uuid cast.
    for (const bad of [
      "",
      CEREMONY,
      `${CEREMONY}.`,
      `${CEREMONY}.${"A".repeat(42)}`,
      `${CEREMONY}.${"A".repeat(44)}`,
      `${CEREMONY}.${"A".repeat(42)}+`,
      `not-a-uuid.${SECRET}`,
      `${CEREMONY}.${SECRET}.${SECRET}`,
    ]) {
      expect(parseRegainRef(bad)).toBeNull();
    }
  });

  it("builds the one link the approver hands over, with no trailing slash left behind", () => {
    expect(regainUrl("https://pms.example/", TOKEN)).toBe(`https://pms.example/regain/${TOKEN}`);
    expect(regainUrl("https://pms.example", TOKEN)).toBe(`https://pms.example/regain/${TOKEN}`);
  });
});
