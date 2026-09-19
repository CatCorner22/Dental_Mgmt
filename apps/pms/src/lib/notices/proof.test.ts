import { describe, expect, it } from "vitest";
import { hashCode, mintCode, normaliseCode } from "./proof";
import { CODE_WINDOW_HOURS, renderProofMessage } from "./proofMessage";

/**
 * The code, and the message that carries it (Increment 1.61).
 */

describe("the code", () => {
  it("avoids the characters a person reads wrong off a screen", () => {
    // A code is read in one window and typed into another. I against 1 and O
    // against 0 makes a correct answer look like a wrong one, and the person
    // is told their code failed when the alphabet failed.
    const many = Array.from({ length: 200 }, () => mintCode()).join("");
    expect(many).not.toMatch(/[ILO01]/);
    expect(many).toMatch(/^[A-HJKMNP-Z2-9]+$/);
  });

  it("is ten characters, and different each time", () => {
    const codes = new Set(Array.from({ length: 200 }, () => mintCode()));
    expect([...codes].every((c) => c.length === 10)).toBe(true);
    // Two equal codes out of two hundred would mean the randomness is not.
    expect(codes.size).toBe(200);
  });

  it("reads a code back through the punctuation and the case a person typed", () => {
    // Refusing a correct answer for being punctuated is refusing a correct
    // answer, and the person has no way to tell which half was wrong.
    expect(normaliseCode(" abcd-234 xyz ")).toBe("ABCD234XYZ");
    expect(hashCode("abcd 234-xyz")).toBe(hashCode("ABCD234XYZ"));
  });

  it("hashes to something that cannot be read back as the code", () => {
    const code = mintCode();
    const digest = hashCode(code);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain(code);
    expect(hashCode(code)).toBe(digest);
    expect(hashCode(mintCode())).not.toBe(digest);
  });
});

describe("the message that carries a code", () => {
  const message = renderProofMessage({
    practiceName: "Ridgeview Dental",
    code: "ABCD234XYZ",
    appUrl: "https://app.example",
  });

  it("keeps the code out of the subject", () => {
    // Increment 1.58 settled that a subject is the part a person sees without
    // choosing to look. A code there is a bearer secret shown to whoever
    // glances at a lock screen, which would make the proof measure who can see
    // the phone rather than who can open the mailbox.
    expect(message.subject).toBe("Ridgeview Dental: confirm where your messages go");
    expect(message.subject).not.toContain("ABCD234XYZ");
    expect(message.body).toContain("Your code is ABCD234XYZ");
  });

  it("says how long the code lasts and what happens until it comes back", () => {
    expect(message.body).toContain(`${CODE_WINDOW_HOURS} hours`);
    expect(message.body).toContain("nothing else will be sent to this address");
    // Somebody who was not expecting this is told the safe thing to do, which
    // is nothing: an address nobody confirms receives nothing.
    expect(message.body).toContain("If you were not expecting this, ignore it");
  });

  it("names nobody, like every message this product sends", () => {
    expect(message.body).toContain("This message names no patient and quotes nobody's words.");
  });
});
