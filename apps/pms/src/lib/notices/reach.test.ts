import { describe, expect, it } from "vitest";
import { reachSentence } from "./reach";

/**
 * The one wording for who the practice cannot reach (Increment 1.69).
 *
 * Pure and tested apart from the rows, because the reading appears on the
 * owner's board and beside the weekly digest, and Increment 1.52 settled that
 * a reading shown twice comes from one function rather than from two sentences
 * that could drift.
 */

describe("the sentence for somebody the practice cannot reach", () => {
  it("says who said no, and that the address cannot come back", () => {
    const said = reachSentence({ name: "Riley Owner", why: "refused", since: "2026-04-02T09:00:00.000Z" });
    expect(said).toContain("Somebody reading Riley Owner's address said on 2026-04-02");
    expect(said).toContain("cannot be saved again");
  });

  it("says how many codes went unanswered when the address was let go", () => {
    const said = reachSentence({ name: "Finn Front", why: "retired", since: "2026-04-05T00:00:00.000Z", asked: 3 });
    expect(said).toContain("stopped being a destination on 2026-04-05");
    expect(said).toContain("3 codes went unanswered");
    expect(said).toContain("save an address again and prove it");
  });

  it("says the practice is still asking, and when it stops", () => {
    // The distinction Increment 1.68 drew: a lapse still being chased reads
    // differently from one the practice has given up on, and a single sentence
    // for both would tell a reader a code is coming when none is.
    const said = reachSentence({
      name: "Casey Prentice",
      why: "lapsed",
      since: "2026-01-01T00:00:00.000Z",
      stopsOn: "2026-04-05T00:00:00.000Z",
    });
    expect(said).toContain("lapsed on 2026-01-01");
    expect(said).toContain("still asking");
    expect(said).toContain("stops on 2026-04-05");
    expect(said).not.toContain("stopped being a destination");
  });

  it("omits the end date where there is none to give rather than inventing one", () => {
    const said = reachSentence({ name: "Casey Prentice", why: "lapsed", since: "2026-01-01T00:00:00.000Z" });
    expect(said).toContain("still asking");
    expect(said).not.toContain("stops on");
  });

  it("says when an address nobody ever proved was saved", () => {
    const said = reachSentence({ name: "Avery Lead", why: "unproved", since: "2026-03-10T12:00:00.000Z" });
    expect(said).toContain("saved on 2026-03-10");
    expect(said).toContain("Nobody has proved");
  });

  it("names the person and never an address", () => {
    // Increment 1.58: where somebody is reachable is theirs. The practice needs
    // to know that Riley cannot be reached, not what Riley typed — and this
    // function is never handed an address to leak.
    for (const why of ["refused", "retired", "lapsed", "unproved"] as const) {
      const said = reachSentence({ name: "Riley Owner", why, since: "2026-04-02T09:00:00.000Z", asked: 3 });
      expect(said).toContain("Riley Owner");
      expect(said).not.toMatch(/@/);
    }
  });
});
