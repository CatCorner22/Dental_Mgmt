import { describe, expect, it } from "vitest";
import { PROOF_LIFE_MS, REPROVE_WINDOW_MS, hashCode, mintCode, normaliseCode, proofLapsesAt, proofStanding } from "./proof";
import { CODE_WINDOW_HOURS, renderProofMessage } from "./proofMessage";
import { STOP_LIFE_DAYS } from "./stopLink";

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
    place: "Month-end",
    stopUrl: "https://app.example/notices/stop/00000000-0000-7000-8000-000000000001.aaa",
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
  });

  it("offers a reader who did not ask for this something to do about it", () => {
    // Increment 1.61 ended this message by telling such a reader to ignore it.
    // Ignoring it stops nothing: the practice may ask again, five times an
    // hour, for as long as it likes. Increment 1.67 replaces the advice with a
    // link, and the link is the whole of what this reader is owed.
    expect(message.body).toContain("If that was not you, say so here:");
    expect(message.body).toContain("https://app.example/notices/stop/00000000-0000-7000-8000-000000000001.aaa");
    expect(message.body).toContain(`works for ${STOP_LIFE_DAYS} days`);
    expect(message.body).toContain("will not be able to save it again");
    expect(message.body).not.toContain("ignore it");
  });

  it("names nobody, like every message this product sends", () => {
    expect(message.body).toContain("This message names no patient and quotes nobody's words.");
  });

  it("sends the reader to the screen the caller named, not to one screen for everybody", () => {
    // Increment 1.74. This line used to name Practice Risk, which is the one
    // screen the outside accountant's seat may not open, so the product mailed
    // that seat a code and pointed it at a refusal. The caller knows the seat;
    // the message takes the name.
    expect(message.body).toContain("open Month-end, and type it beside your address");
    expect(message.body).not.toContain("Practice Risk");
  });
});

describe("how long a proof stands", () => {
  // Increment 1.65. A proof was forever, which quietly reintroduced the failure
  // Increment 1.61 exists to prevent: a mailbox somebody loses access to stays
  // proved, and the notices keep arriving where nobody reads them.
  const provedAt = "2026-01-15T09:00:00.000Z";
  const proof = { provedAt };
  const after = (ms: number) => new Date(new Date(provedAt).getTime() + ms);

  it("says nothing about an address nobody ever proved", () => {
    expect(proofStanding(null, new Date())).toBe("none");
  });

  it("stands for a year", () => {
    expect(proofStanding(proof, after(0))).toBe("good");
    expect(proofStanding(proof, after(PROOF_LIFE_MS - REPROVE_WINDOW_MS - 1))).toBe("good");
    expect(proofLapsesAt(proof)).toBe("2027-01-15T09:00:00.000Z");
  });

  it("starts asking thirty days out, rather than the day it stops", () => {
    // Four states rather than a boolean, and this is why: a product that knew
    // only proved-or-not would have nothing to say until the day the notices
    // stopped, and stopping without warning is the silence this arc refuses.
    expect(proofStanding(proof, after(PROOF_LIFE_MS - REPROVE_WINDOW_MS))).toBe("expiring");
    expect(proofStanding(proof, after(PROOF_LIFE_MS - 1))).toBe("expiring");
  });

  it("has lapsed on the day, not the day after", () => {
    expect(proofStanding(proof, after(PROOF_LIFE_MS))).toBe("lapsed");
    expect(proofStanding(proof, after(PROOF_LIFE_MS * 2))).toBe("lapsed");
  });
});
